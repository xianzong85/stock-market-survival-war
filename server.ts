import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import { GameState, Stock, StockId, Order, OrderBook, PlayerState, Card, TrendCard, ClientToServerEvents, ServerToClientEvents, CardType, RoomSummary, StockCategory } from "./src/types.js";
import { getRandomStocks } from "./src/stockPool.js";

import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*" }
});

const PORT = Number(process.env.PORT) || 3000;

const initialTrends: TrendCard[] = [
  { id: 't1', name: '利好降息', effect: 0.15, target: 'all' },
  { id: 't2', name: '行业整顿', effect: -0.15, target: ['tech', 'st'] },
  { id: 't3', name: '资金涌入', effect: 0.20, target: 'all' },
  { id: 't4', name: '外围大跌', effect: -0.10, target: 'all' },
  { id: 't5', name: '平稳过渡', effect: 0, target: 'all' },
  { id: 't6', name: '政策扶持', effect: 0.10, target: ['ev', 'tech'] },
  { id: 't7', name: '集采杀跌', effect: -0.20, target: ['pharma'] },
  { id: 't8', name: '并购重组', effect: 0.25, target: ['st', 'tech'] },
  { id: 't9', name: '消费复苏', effect: 0.10, target: ['consumer'] },
  { id: 't10', name: '牛市启动', effect: 0.30, target: ['finance', 'tech', 'ev'] },
];

const rooms: Record<string, GameState> = {};

function getRoom(roomId: string, initOptions?: { roomName: string, maxRounds: number, darkPhaseTime: number }): GameState {
  if (!rooms[roomId]) {
    const selectedStocks = getRandomStocks(9);
    const stocksObj: Record<string, Stock> = {};
    const orderBookObj: Record<string, OrderBook> = {};

    selectedStocks.forEach(sc => {
      stocksObj[sc.id] = {
        id: sc.id,
        name: sc.name,
        category: sc.category,
        price: sc.basePrice,
        history: [sc.basePrice],
        ohlcHistory: [],
        volatility: sc.volatility
      };
      orderBookObj[sc.id] = { buys: [], sells: [] };
    });

    rooms[roomId] = {
      roomName: initOptions ? initOptions.roomName : `大户室 ${roomId}`,
      maxRounds: initOptions ? initOptions.maxRounds : 10,
      darkPhaseTime: initOptions ? initOptions.darkPhaseTime : 30,
      round: 1,
      phase: 'waiting',
      stocks: stocksObj,
      orderBook: orderBookObj,
      playedCards: [],
      players: {},
      trends: [...initialTrends].sort(() => Math.random() - 0.5),
      currentTrendIndex: 0,
      logs: ['等待玩家加入...']
    };
  }
  return rooms[roomId];
}

const timerIdMap: Record<string, NodeJS.Timeout> = {};

function startTimer(roomId: string, seconds: number, callback: () => void) {
  if (timerIdMap[roomId]) clearInterval(timerIdMap[roomId]);
  const gameState = rooms[roomId];
  if (!gameState) return;
  gameState.timeRemaining = seconds;
  broadcastState(roomId);

  timerIdMap[roomId] = setInterval(() => {
    gameState.timeRemaining! -= 1;
    if (gameState.timeRemaining! <= 0) {
      clearInterval(timerIdMap[roomId]);
      callback();
    } else {
      broadcastState(roomId);
    }
  }, 1000);
}

function broadcastState(roomId: string) {
  io.to(roomId).emit('gameState', rooms[roomId]);
}

function addLog(roomId: string, msg: string) {
  const gameState = rooms[roomId];
  if (!gameState) return;
  gameState.logs.push(msg);
  if (gameState.logs.length > 50) gameState.logs.shift();
  io.to(roomId).emit('log', msg);
}

function calculateTotalAsset(gameState: GameState, playerId: string) {
  const p = gameState.players[playerId];
  if (!p) return 0;
  let total = p.cash.available + p.cash.frozen;
  for (const stockId of Object.keys(p.portfolio) as StockId[]) {
    const qty = p.portfolio[stockId].available + p.portfolio[stockId].frozen;
    total += qty * gameState.stocks[stockId].price;
  }
  return total;
}

function updatePlayerAssets(gameState: GameState) {
  for (const pid in gameState.players) {
    const p = gameState.players[pid];
    p.totalAsset = calculateTotalAsset(gameState, pid);
    if (p.totalAsset >= 1000) p.handLimit = 5;
    else if (p.totalAsset >= 600) p.handLimit = 4;
    else if (p.totalAsset >= 300) p.handLimit = 3;
    else p.handLimit = 2;
  }
}

function matchOrders(roomId: string, stockId: StockId) {
  const gameState = rooms[roomId];
  if (!gameState) return;
  const book = gameState.orderBook[stockId];
  const stock = gameState.stocks[stockId];

  // Sort buys descending, sells ascending
  book.buys.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
  book.sells.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);

  while (book.buys.length > 0 && book.sells.length > 0) {
    const highestBuy = book.buys[0];
    const lowestSell = book.sells[0];

    if (highestBuy.price >= lowestSell.price) {
      // Match found
      const matchPrice = highestBuy.timestamp < lowestSell.timestamp ? highestBuy.price : lowestSell.price;
      const matchQty = Math.min(highestBuy.quantity, lowestSell.quantity);

      // Execute trade
      const buyer = gameState.players[highestBuy.playerId];
      const seller = gameState.players[lowestSell.playerId];

      if (buyer && seller) {
        // Buyer pays matchPrice, unfreezes original price
        buyer.cash.frozen -= highestBuy.price * matchQty;
        buyer.cash.available += (highestBuy.price - matchPrice) * matchQty; // refund difference
        buyer.portfolio[stockId].frozen += matchQty; // T+1

        // Seller receives cash
        seller.portfolio[stockId].frozen -= matchQty; // was frozen when order placed
        seller.cash.available += matchPrice * matchQty;

        addLog(roomId, `[撮合成交] ${stock.name} ${matchQty}股 @ ¥${matchPrice}`);
        stock.price = matchPrice;
        stock.history.push(matchPrice);
      }

      highestBuy.quantity -= matchQty;
      lowestSell.quantity -= matchQty;

      if (highestBuy.quantity === 0) book.buys.shift();
      if (lowestSell.quantity === 0) book.sells.shift();
    } else {
      break;
    }
  }
  updatePlayerAssets(gameState);
}

function clearOrderBook(roomId: string) {
  const gameState = rooms[roomId];
  if (!gameState) return;
  addLog(roomId, '所有未成交隔夜订单已被清空，资金持仓退还。');

  for (const sid of Object.keys(gameState.orderBook) as StockId[]) {
    const book = gameState.orderBook[sid];
    for (const o of book.buys) {
      const p = gameState.players[o.playerId];
      if (p) {
        p.cash.frozen -= o.price * o.quantity;
        p.cash.available += o.price * o.quantity;
      }
    }
    for (const o of book.sells) {
      const p = gameState.players[o.playerId];
      if (p) {
        p.portfolio[sid].frozen -= o.quantity;
        p.portfolio[sid].available += o.quantity;
      }
    }
    book.buys = [];
    book.sells = [];
  }
}

function checkMarginCall(roomId: string) {
  const gameState = rooms[roomId];
  if (!gameState) return;

  for (const pid in gameState.players) {
    const p = gameState.players[pid];
    updatePlayerAssets(gameState);

    // Initial asset was 1000, let's say < 300 triggers hard liquidate
    if (p.totalAsset < 300) {
      addLog(roomId, `[爆仓警告] ${p.name} 资产跌破300，触发强制平仓！`);
      for (const sid of Object.keys(p.portfolio) as StockId[]) {
        const qty = p.portfolio[sid].available + p.portfolio[sid].frozen;
        if (qty > 0) {
          addLog(roomId, `${p.name} 的 ${qty}股 ${gameState.stocks[sid].name} 被强制按市价抛售`);
          p.portfolio[sid].available = 0;
          p.portfolio[sid].frozen = 0;
          p.cash.available += qty * gameState.stocks[sid].price; // Simply convert to cash for simplicity
        }
      }
    }
  }
  updatePlayerAssets(gameState);
}

function drawCards(gameState: GameState, playerId: string, count: number) {
  const p = gameState.players[playerId];
  if (!p) return;
  const cardPool: CardType[] = ['good_news', 'bad_news', 'peek', 'vip', 'liquidate', 'clarify', 'unplug', 'intercept'];
  for (let i = 0; i < count; i++) {
    const type = cardPool[Math.floor(Math.random() * cardPool.length)];
    let name = '';
    let desc = '';
    switch (type) {
      case 'good_news': name = '重磅利好'; desc = '指定股票价格上涨 15%'; break;
      case 'bad_news': name = '突发黑天鹅'; desc = '指定股票价格暴跌 15%'; break;
      case 'peek': name = '内幕探查'; desc = '偷看下回合趋势'; break;
      case 'vip': name = 'VIP通道'; desc = 'T+1股票转可用'; break;
      case 'liquidate': name = '强制平仓'; desc = '强制对手按市价卖出最多持仓'; break;
      case 'clarify': name = '澄清公告'; desc = '撤回指定股票的所有未成交订单'; break;
      case 'unplug': name = '拔网线'; desc = '打断撤单'; break;
      case 'intercept': name = '老鼠仓'; desc = '截胡交易'; break;
    }
    p.hand.push({ id: Math.random().toString(36).substring(7), type, name, desc });
  }
}

function startGame(roomId: string) {
  const gameState = rooms[roomId];
  if (!gameState) return;
  gameState.phase = 'unfreeze';
  gameState.round = 1;
  addLog(roomId, '游戏开始！第 1 回合');
  for (const pid in gameState.players) {
    drawCards(gameState, pid, 5);
  }
  processPhase(roomId);
}

function processPhase(roomId: string) {
  const gameState = rooms[roomId];
  if (!gameState) return;

  if (gameState.phase === 'unfreeze') {
    for (const pid in gameState.players) {
      const p = gameState.players[pid];
      for (const sid of Object.keys(p.portfolio) as StockId[]) {
        p.portfolio[sid].available += p.portfolio[sid].frozen;
        p.portfolio[sid].frozen = 0;
      }
      p.isReady = false;
      // Clear unplug status if past
      if (p.unpluggedUntil && gameState.round > p.unpluggedUntil) {
        p.unpluggedUntil = 0;
      }
    }
    addLog(roomId, '交易日开启。T+1股票已解冻。');
    gameState.phase = 'open';
    setTimeout(() => processPhase(roomId), 1500);
  } else if (gameState.phase === 'open') {
    const trend = gameState.trends[gameState.currentTrendIndex];
    addLog(roomId, `当前趋势揭晓：【${trend.name}】(${trend.effect > 0 ? '+' : ''}${Math.round(trend.effect * 100)}%)`);

    // Evaluate system gravity / baseline shift without matching against order books (since we clear overnight orders)
    for (const sid of Object.keys(gameState.stocks) as StockId[]) {
      const stock = gameState.stocks[sid];
      let trendEffect = 0;
      if (trend.target === 'all' || (trend.target as string[]).includes(stock.category)) {
        trendEffect = trend.effect;
      }

      const drift = stock.price * (Math.random() - 0.5) * (stock.volatility * 0.05);
      let newPrice = stock.price * (1 + trendEffect) + drift;

      if (newPrice < 1) newPrice = 1;
      if (newPrice > 300) newPrice = 300; // raised upper limit for meme stocks

      newPrice = Math.round(newPrice * 100) / 100;

      if (newPrice !== stock.price) {
        stock.price = newPrice;
        stock.history.push(newPrice);
        addLog(roomId, `${stock.name} 开盘价调整为 ¥${newPrice} ${drift !== 0 ? (drift > 0 ? '(市场异动变高)' : '(市场异动走低)') : ''}`);
      }
    }
    gameState.phase = 'draw';
    setTimeout(() => processPhase(roomId), 1500);
  } else if (gameState.phase === 'draw') {
    addLog(roomId, '发放手牌...');
    for (const pid in gameState.players) {
      drawCards(gameState, pid, 2);
    }
    gameState.phase = 'play';
    gameState.playedCards = [];
    addLog(roomId, `进入暗盘期，你们有${gameState.darkPhaseTime || 30}秒的时间布局...`);
    startTimer(roomId, gameState.darkPhaseTime || 30, () => {
      gameState.phase = 'reveal';
      processPhase(roomId);
    });
  } else if (gameState.phase === 'reveal') {
    addLog(roomId, '[时间到！进入结算揭晓]');
    // Step 1: Resolve Cards
    for (const played of gameState.playedCards) {
      const p = gameState.players[played.playerId];
      if (!p) continue;

      addLog(roomId, `${p.name} 翻开底牌【${played.card.name}】`);

      if (played.card.type === 'good_news' && played.targetStockId) {
        gameState.stocks[played.targetStockId].price = Math.min(300, gameState.stocks[played.targetStockId].price * 1.15);
        gameState.stocks[played.targetStockId].history.push(gameState.stocks[played.targetStockId].price);
        addLog(roomId, `${gameState.stocks[played.targetStockId].name} 受到重磅利好，价格飙升至 ¥${gameState.stocks[played.targetStockId].price.toFixed(2)}`);
      } else if (played.card.type === 'bad_news' && played.targetStockId) {
        gameState.stocks[played.targetStockId].price = Math.max(0.1, gameState.stocks[played.targetStockId].price * 0.85);
        gameState.stocks[played.targetStockId].history.push(gameState.stocks[played.targetStockId].price);
        addLog(roomId, `${gameState.stocks[played.targetStockId].name} 遭遇黑天鹅，价格暴跌至 ¥${gameState.stocks[played.targetStockId].price.toFixed(2)}`);
      } else if (played.card.type === 'vip' && played.targetStockId) {
        const qty = p.portfolio[played.targetStockId].frozen;
        p.portfolio[played.targetStockId].frozen = 0;
        p.portfolio[played.targetStockId].available += qty;
        addLog(roomId, `${p.name} 通过内线关系解冻了 ${gameState.stocks[played.targetStockId].name}`);
      } else if (played.card.type === 'liquidate' && played.targetPlayerId && played.targetStockId) {
        // Find opponent
        const oppId = played.targetPlayerId;
        const sid = played.targetStockId;
        if (oppId && gameState.players[oppId]) {
          const opp = gameState.players[oppId];
          const qty = opp.portfolio[sid].available; // Need targetStockId for liquidate
          if (qty > 0) {
            const dumpQty = Math.ceil(qty / 2); // Dump 50%
            opp.portfolio[sid].available -= dumpQty;
            opp.portfolio[sid].frozen += dumpQty; // Will be cleared to cash below
            gameState.orderBook[sid].sells.push({
              id: Math.random().toString(36).substring(7),
              playerId: oppId, stockId: sid, type: 'sell',
              price: gameState.stocks[sid].price - 1 > 0 ? gameState.stocks[sid].price - 1 : 1, // Dump at lower price
              quantity: dumpQty, timestamp: Date.now()
            });
            addLog(roomId, `${opp.name} 被强制平仓了 ${dumpQty}股 ${gameState.stocks[sid].name}!`);
          }
        }
      } else if (played.card.type === 'clarify' && played.targetStockId) {
        // Clear order book for this stock
        const book = gameState.orderBook[played.targetStockId];
        addLog(roomId, `发布澄清公告！${gameState.stocks[played.targetStockId].name} 的所有盘口订单被撤回.`);
        for (const o of book.buys) {
          const buyer = gameState.players[o.playerId];
          if (buyer) { buyer.cash.frozen -= o.price * o.quantity; buyer.cash.available += o.price * o.quantity; }
        }
        for (const o of book.sells) {
          const seller = gameState.players[o.playerId];
          if (seller) { seller.portfolio[played.targetStockId].frozen -= o.quantity; seller.portfolio[played.targetStockId].available += o.quantity; }
        }
        book.buys = []; book.sells = [];
      } else if (played.card.type === 'unplug' && played.targetPlayerId) {
        const oppId = played.targetPlayerId;
        if (oppId && gameState.players[oppId]) {
          gameState.players[oppId].unpluggedUntil = gameState.round;
          addLog(roomId, `${gameState.players[oppId].name} 的网线被拔了！下回合无法操作。`);
        }
      } else if (played.card.type === 'intercept' && played.targetStockId) {
        // Buy 2 shares directly from system at current price
        const cost = gameState.stocks[played.targetStockId].price * 2;
        if (p.cash.available >= cost) {
          p.cash.available -= cost;
          p.portfolio[played.targetStockId].frozen += 2;
          addLog(roomId, `${p.name} 建立了老鼠仓，直接获得 2 股.`);
        }
      }
    }

    // Step 2: Match Orders
    addLog(roomId, '[撮合阶段开始]');
    for (const sid of Object.keys(gameState.stocks) as StockId[]) {
      matchOrders(roomId, sid);
    }

    // Step 3: Margin Call End of Round
    checkMarginCall(roomId);

    setTimeout(() => {
      let needsDiscard = false;
      for (const pid in gameState.players) {
        if (gameState.players[pid].hand.length > gameState.players[pid].handLimit) needsDiscard = true;
      }
      if (needsDiscard) {
        gameState.phase = 'discard';
        addLog(roomId, '进入弃牌阶段，请超限玩家选择要弃置的手牌。');
        processPhase(roomId);
      } else {
        gameState.phase = 'close';
        processPhase(roomId);
      }
    }, 3000);
  } else if (gameState.phase === 'discard') {
    startTimer(roomId, 15, () => {
      for (const pid in gameState.players) {
        const p = gameState.players[pid];
        while (p.hand.length > p.handLimit) {
          p.hand.pop();
        }
        if (p.hand.length > p.handLimit) {
          addLog(roomId, `${p.name} 超时，系统自动遗弃了多余手牌。`);
        }
      }
      gameState.phase = 'close';
      processPhase(roomId);
    });
  } else if (gameState.phase === 'close') {
    addLog(roomId, '收盘阶段：结算资产并撤单。');

    clearOrderBook(roomId);
    updatePlayerAssets(gameState);

    // Record OHLC for the round
    for (const sid of Object.keys(gameState.stocks) as StockId[]) {
      const stock = gameState.stocks[sid];
      const roundClosingPrice = stock.price;
      // For simplicity, we define 'open' as the price at start of round (previous close)
      // and high/low as max/min across all history points added this round.
      // If no trades happened, they are all equal to the price.
      const lastOHLC = stock.ohlcHistory[stock.ohlcHistory.length - 1];
      const open = lastOHLC ? lastOHLC.close : 10;

      // Get all prices added in this round's trades
      // (This is a bit hacky - ideally we'd track these during the round)
      // But we can approximate it:
      const high = Math.max(open, roundClosingPrice, ...stock.history.slice(-10)); // check last few ticks
      const low = Math.min(open, roundClosingPrice, ...stock.history.slice(-10));

      stock.ohlcHistory.push({
        open,
        high,
        low,
        close: roundClosingPrice
      });
    }

    gameState.round++;
    gameState.currentTrendIndex++;
    if (gameState.round > (gameState.maxRounds || 10)) {
      gameState.phase = 'gameover';
      addLog(roomId, '游戏结束！强制平仓结算。');
      for (const pid in gameState.players) {
        const p = gameState.players[pid];
        for (const sid of Object.keys(p.portfolio) as StockId[]) {
          const qty = p.portfolio[sid].available + p.portfolio[sid].frozen;
          p.cash.available += qty * gameState.stocks[sid].price;
          p.portfolio[sid].available = 0;
          p.portfolio[sid].frozen = 0;
        }
        updatePlayerAssets(gameState);
      }
    } else {
      gameState.phase = 'unfreeze';
      setTimeout(() => processPhase(roomId), 3000);
    }
  }
  broadcastState(roomId);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  const emitRooms = () => {
    const list: RoomSummary[] = Object.keys(rooms).map(rid => {
      const g = rooms[rid];
      return {
        id: rid,
        name: g.roomName,
        playerCount: Object.keys(g.players).length,
        maxPlayers: 8,
        status: g.phase === 'waiting' ? 'waiting' : 'playing'
      };
    });
    socket.emit('roomsList', list);
  };

  socket.on('checkReconnect', (playerId) => {
    if (!playerId) return;
    for (const rid in rooms) {
      if (rooms[rid].players[playerId]) {
        // Player is in this room!
        socket.emit('reconnectInfo', rid);
        return;
      }
    }
  });

  socket.on('getRooms', () => {
    emitRooms();
  });

  socket.on('createRoom', (options, playerName, playerId, avatar) => {
    if (!playerId || !options) {
      socket.emit('error', '缺少必要信息');
      return;
    }
    const rid = Math.random().toString(36).substring(2, 8).toUpperCase();
    getRoom(rid, options); // Initialize it

    // The client will immediately emit 'join' with this rid upon receiving 'roomCreated'.
    // So we don't have to duplicate the join logic here!

    socket.emit('roomCreated', rid);

    // Update others in lobby
    socket.broadcast.emit('roomsList', Object.keys(rooms).map((id): RoomSummary => {
      const g = rooms[id];
      return {
        id,
        name: g.roomName,
        playerCount: Object.keys(g.players).length,
        maxPlayers: 8,
        status: g.phase === 'waiting' ? 'waiting' : 'playing'
      };
    }));
  });

  socket.on('join', (roomId, name, playerId, avatar) => {
    const gameState = getRoom(roomId);
    socket.join(roomId);

    if (!playerId) {
      socket.emit('error', '需要唯一标识');
      return;
    }

    const currentNameCount = Object.values(gameState.players).filter(p => p.name === name && p.id !== playerId).length;
    if (currentNameCount > 0) {
      socket.emit('error', '该昵称太火爆已被占用，换个更霸气的吧！');
      return;
    }

    (socket as any).playerId = playerId;
    (socket as any).roomId = roomId;

    if (Object.keys(gameState.players).length >= 8 && !gameState.players[playerId]) {
      socket.emit('error', '房间已满');
      return;
    }
    if (!gameState.players[playerId]) {
      const initialPortfolio: Record<string, { available: number; frozen: number }> = {};
      Object.keys(gameState.stocks).forEach(sid => {
        initialPortfolio[sid] = { available: 0, frozen: 0 };
      });

      gameState.players[playerId] = {
        id: playerId,
        name: name || `散户${Math.floor(Math.random() * 1000)}`,
        cash: { available: 1000, frozen: 0 },
        portfolio: initialPortfolio,
        hand: [],
        totalAsset: 1000,
        handLimit: 5,
        isReady: false,
        unpluggedUntil: 0,
        avatar: avatar || '/head/head1.png'
      };

      if (!gameState.hostId) {
        gameState.hostId = playerId;
      }
      addLog(roomId, `${gameState.players[playerId].name} 加入了游戏。`);
    } else {
      gameState.players[playerId].name = name;
      if (avatar) gameState.players[playerId].avatar = avatar;
      addLog(roomId, `${gameState.players[playerId].name} 重新连接到了游戏。`);
    }

    broadcastState(roomId);

    socket.broadcast.emit('roomsList', Object.keys(rooms).map((id): RoomSummary => {
      const g = rooms[id];
      return {
        id,
        name: g.roomName,
        playerCount: Object.keys(g.players).length,
        maxPlayers: 8,
        status: g.phase === 'waiting' ? 'waiting' : 'playing'
      };
    }));
  });

  socket.on('startGame', (roomId) => {
    const gameState = rooms[roomId];
    if (!gameState) return;
    const pid = (socket as any).playerId;
    if (gameState.hostId !== pid) {
      socket.emit('error', '只有房主可以开始游戏');
      return;
    }
    if (Object.keys(gameState.players).length < 2) {
      socket.emit('error', '至少需要2名玩家');
      return;
    }
    if (gameState.phase === 'waiting') {
      startGame(roomId);
    }
  });

  socket.on('returnToLobby', (roomId) => {
    const gameState = rooms[roomId];
    if (!gameState) return;
    const pid = (socket as any).playerId;
    if (gameState.hostId !== pid) {
      socket.emit('error', '只有房主可以返回房间');
      return;
    }

    gameState.phase = 'waiting';
    gameState.round = 1;
    gameState.logs = ['游戏重置，等待下一次开盘...'];
    gameState.playedCards = [];
    gameState.trends = [...initialTrends].sort(() => Math.random() - 0.5);
    gameState.currentTrendIndex = 0;

    const selectedStocks = getRandomStocks(9);
    const stocksObj: Record<string, Stock> = {};
    const orderBookObj: Record<string, OrderBook> = {};

    selectedStocks.forEach(sc => {
      stocksObj[sc.id] = {
        id: sc.id,
        name: sc.name,
        category: sc.category,
        price: sc.basePrice,
        history: [sc.basePrice],
        ohlcHistory: [],
        volatility: sc.volatility
      };
      orderBookObj[sc.id] = { buys: [], sells: [] };
    });
    gameState.stocks = stocksObj;
    gameState.orderBook = orderBookObj;

    for (const pId in gameState.players) {
      const p = gameState.players[pId];
      p.cash = { available: 1000, frozen: 0 };
      const initialPortfolio: Record<string, { available: number; frozen: number }> = {};
      Object.keys(gameState.stocks).forEach(sid => {
        initialPortfolio[sid] = { available: 0, frozen: 0 };
      });
      p.portfolio = initialPortfolio;
      p.hand = [];
      p.totalAsset = 1000;
      p.isReady = false;
      p.unpluggedUntil = 0;
    }

    broadcastState(roomId);
  });

  socket.on('placeOrder', (roomId, stockId, type, price, quantity) => {
    const gameState = rooms[roomId];
    if (!gameState) return;
    if (gameState.phase !== 'play') {
      socket.emit('error', '现在不是暗盘交易期');
      return;
    }
    if (price <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      socket.emit('error', '无效的数量或价格');
      return;
    }
    const pid = (socket as any).playerId;
    const p = gameState.players[pid];
    if (!p) return;
    if (p.unpluggedUntil >= gameState.round) {
      socket.emit('error', '你被拔网线了，当前无法操作！');
      return;
    }

    if (type === 'buy') {
      const cost = price * quantity;
      if (p.cash.available < cost) {
        socket.emit('error', '可用资金不足');
        return;
      }
      p.cash.available -= cost;
      p.cash.frozen += cost;
      gameState.orderBook[stockId].buys.push({
        id: Math.random().toString(36).substring(7),
        playerId: pid,
        stockId,
        type: 'buy',
        price,
        quantity,
        timestamp: Date.now()
      });
      // Do not announce exact orders in blind phase, just activity
      addLog(roomId, `${p.name} 在暗盘提交了一笔买单...`);
    } else {
      if (p.portfolio[stockId].available < quantity) {
        socket.emit('error', '可用持仓不足');
        return;
      }
      p.portfolio[stockId].available -= quantity;
      p.portfolio[stockId].frozen += quantity;
      gameState.orderBook[stockId].sells.push({
        id: Math.random().toString(36).substring(7),
        playerId: pid,
        stockId,
        type: 'sell',
        price,
        quantity,
        timestamp: Date.now()
      });
      addLog(roomId, `${p.name} 在暗盘提交了一笔卖单...`);
    }
    // We NO LONGER match immediately here. Matching happens in Reveal phase.
    broadcastState(roomId);
  });

  socket.on('cancelOrder', (roomId, orderId) => {
    const gameState = rooms[roomId];
    if (!gameState) return;
    if (gameState.phase !== 'play') return;
    const pid = (socket as any).playerId;
    const p = gameState.players[pid];
    if (!p) return;

    for (const sid of Object.keys(gameState.orderBook) as StockId[]) {
      const book = gameState.orderBook[sid];
      const buyIdx = book.buys.findIndex(o => o.id === orderId && o.playerId === pid);
      if (buyIdx > -1) {
        const o = book.buys[buyIdx];
        p.cash.frozen -= o.price * o.quantity;
        p.cash.available += o.price * o.quantity;
        book.buys.splice(buyIdx, 1);
        addLog(roomId, `${p.name} 撤销了买单`);
        broadcastState(roomId);
        return;
      }
      const sellIdx = book.sells.findIndex(o => o.id === orderId && o.playerId === pid);
      if (sellIdx > -1) {
        const o = book.sells[sellIdx];
        p.portfolio[sid].frozen -= o.quantity;
        p.portfolio[sid].available += o.quantity;
        book.sells.splice(sellIdx, 1);
        addLog(roomId, `${p.name} 撤销了卖单`);
        broadcastState(roomId);
        return;
      }
    }
  });

  socket.on('playCard', (roomId, cardId, targetStockId, targetPlayerId) => {
    const gameState = rooms[roomId];
    if (!gameState) return;
    if (gameState.phase !== 'play') return;
    const pid = (socket as any).playerId;
    const p = gameState.players[pid];
    if (!p) return;
    if (p.unpluggedUntil >= gameState.round) {
      socket.emit('error', '你被拔网线了，不能出牌');
      return;
    }

    const cardIdx = p.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return;
    const card = p.hand[cardIdx];

    if (card.type === 'peek') {
      // peek is instant self-effect
      p.hand.splice(cardIdx, 1);
      const nextTrend = gameState.trends[gameState.currentTrendIndex + 1];
      if (nextTrend) {
        socket.emit('log', `[私密内幕] 下回合趋势是：${nextTrend.name} (${nextTrend.effect})`);
      }
      broadcastState(roomId);
      return;
    }

    // Other cards go to the stack to resolve in Reveal
    p.hand.splice(cardIdx, 1);
    gameState.playedCards.push({
      id: Math.random().toString(36).substring(7),
      card,
      playerId: pid,
      targetStockId,
      targetPlayerId
    });

    addLog(roomId, `${p.name} 盖放了一张底牌...`);
    broadcastState(roomId);
  });

  socket.on('discardCard', (roomId, cardId) => {
    const gameState = rooms[roomId];
    if (!gameState || gameState.phase !== 'discard') return;
    const pid = (socket as any).playerId;
    const p = gameState.players[pid];
    if (!p) return;

    if (p.hand.length <= p.handLimit) return;

    const cardIdx = p.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return;

    const card = p.hand[cardIdx];
    p.hand.splice(cardIdx, 1);
    addLog(roomId, `${p.name} 弃置了卡牌【${card.name}】`);

    broadcastState(roomId);

    let allDone = true;
    for (const player of Object.values(gameState.players)) {
      if (player.hand.length > player.handLimit) {
        allDone = false;
        break;
      }
    }

    if (allDone) {
      if (timerIdMap[roomId]) clearInterval(timerIdMap[roomId]);
      gameState.phase = 'close';
      processPhase(roomId);
    }
  });

  socket.on('endTurn', (roomId) => {
    const gameState = rooms[roomId];
    if (!gameState) return;
    if (gameState.phase !== 'play') return;
    const pid = (socket as any).playerId;
    const p = gameState.players[pid];
    if (!p) return;
    p.isReady = true;
    addLog(roomId, `${p.name} 已准备就绪。`);

    const allReady = Object.values(gameState.players).every(player => player.isReady);
    if (allReady && Object.keys(gameState.players).length >= 2) {
      // Early trigger if everyone ready
      if (timerIdMap[roomId]) {
        clearInterval(timerIdMap[roomId]);
      }
      gameState.phase = 'reveal';
      processPhase(roomId);
    } else {
      broadcastState(roomId);
    }
  });

  socket.on('chat', (roomId, message) => {
    const gameState = rooms[roomId];
    if (!gameState) return;
    const pid = (socket as any).playerId;
    const p = gameState.players[pid];
    if (!p) return;
    addLog(roomId, `${p.name}: ${message}`);
  });

  socket.on('disconnect', () => {
    const pid = (socket as any).playerId;
    const rid = (socket as any).roomId;
    console.log('User disconnected:', socket.id, 'PlayerId:', pid);

    if (rid && pid) {
      const gameState = rooms[rid];
      if (gameState && gameState.phase === 'waiting') {
        // If the game hasn't started, just remove them so they can rejoin with a different name or to free up space
        delete gameState.players[pid];

        // Re-assign host if the host left
        if (gameState.hostId === pid) {
          const remainingPlayers = Object.keys(gameState.players);
          gameState.hostId = remainingPlayers.length > 0 ? remainingPlayers[0] : undefined;
        }

        addLog(rid, `一位散户离开了大户室。`);
        broadcastState(rid);

        socket.broadcast.emit('roomsList', Object.keys(rooms).map((id): RoomSummary => {
          const g = rooms[id];
          return {
            id,
            playerCount: Object.keys(g.players).length,
            maxPlayers: 8,
            status: g.phase === 'waiting' ? 'waiting' : 'playing'
          };
        }));
      }
      // If the game has started, we keep them in the state so they can reconnect to their assets
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
