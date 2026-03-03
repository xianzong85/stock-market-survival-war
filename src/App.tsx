import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState, ClientToServerEvents, ServerToClientEvents, RoomSummary, StockId, TargetingState } from './types';
import LobbyView from './components/LobbyView';
import PlayerDashboard from './components/PlayerDashboard';
import StockWidget from './components/StockWidget';
import CardWidget from './components/CardWidget';
import GameOverView from './components/GameOverView';
import { cn } from './utils';

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(import.meta.env.VITE_BACKEND_URL || undefined);
const AVATARS = [
  '/head/head1.png',
  '/head/head2.png',
  '/head/head3.png',
  '/head/head4.png',
];

function FloatingCash({ value }: { value: number }) {
  const [floats, setFloats] = useState<{ id: string, diff: number }[]>([]);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const diff = value - prevValueRef.current;
    if (Math.abs(diff) > 0.01) {
      const id = Math.random().toString(36).substring(7);
      setFloats(f => [...f, { id, diff }]);
      setTimeout(() => setFloats(f => f.filter(item => item.id !== id)), 2000);
    }
    prevValueRef.current = value;
  }, [value]);

  return (
    <div className="absolute top-0 right-[-60px] pointer-events-none z-50">
      <AnimatePresence>
        {floats.map(f => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 10, scale: 0.5 }}
            animate={{ opacity: 1, y: -20, scale: 1.2 }}
            exit={{ opacity: 0, y: -40 }}
            className={cn("text-xs font-black absolute whitespace-nowrap drop-shadow-md", f.diff > 0 ? "text-emerald-500" : "text-red-500")}
          >
            {f.diff > 0 ? '+' : ''}{f.diff.toFixed(2)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>(() => {
    let id = sessionStorage.getItem('playerId');
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('playerId', id);
    }
    return id;
  });
  const [nameInput, setNameInput] = useState(() => localStorage.getItem('playerName') || '');
  const [selectedAvatar, setSelectedAvatar] = useState(() => localStorage.getItem('playerAvatar') || AVATARS[0]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [view, setView] = useState<'nameInput' | 'roomSelection'>('nameInput');
  const [availableRooms, setAvailableRooms] = useState<RoomSummary[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomOptions, setRoomOptions] = useState({ roomName: '', maxRounds: 10, darkPhaseTime: 30 });
  const [targetingState, setTargetingState] = useState<TargetingState | null>(null);
  const menuAudioRef = useRef<HTMLAudioElement | null>(null);
  const battleAudioRef = useRef<HTMLAudioElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Initialize audio objects once
  useEffect(() => {
    menuAudioRef.current = new Audio('/audio/menu.mp3');
    menuAudioRef.current.loop = true;
    menuAudioRef.current.volume = 0.4;

    battleAudioRef.current = new Audio('/audio/battle.mp3');
    battleAudioRef.current.loop = true;
    battleAudioRef.current.volume = 0.4;

    return () => {
      menuAudioRef.current?.pause();
      battleAudioRef.current?.pause();
      menuAudioRef.current = null;
      battleAudioRef.current = null;
    };
  }, []);

  // 全局“无感解锁”：用户只要动一下，音乐就响应
  useEffect(() => {
    const unlock = () => {
      if (menuAudioRef.current && menuAudioRef.current.paused) {
        menuAudioRef.current.play().catch(() => { });
      }
      // 成功触发后移除所有监听
      window.removeEventListener('mousedown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('mousedown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    return () => {
      window.removeEventListener('mousedown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Manage music playback based on game state
  useEffect(() => {
    // Menu music phases: NOT in a room, waiting in lobby, or game results screen
    const isMenuPhase = !gameState || !currentRoom || gameState.phase === 'waiting' || gameState.phase === 'gameover';

    // Battle music: Any active gameplay phase (everything between lobby and gameover)
    const isBattlePhase = gameState && !isMenuPhase;

    if (isMenuPhase) {
      battleAudioRef.current?.pause();
      menuAudioRef.current?.play().catch(() => { });
    } else if (isBattlePhase) {
      menuAudioRef.current?.pause();
      battleAudioRef.current?.play().catch(() => { });
    }
  }, [gameState?.phase, currentRoom, view]);

  // Refs to avoid stale closures in socket listeners
  const nameInputRef = useRef(nameInput);
  const avatarRef = useRef(selectedAvatar);

  useEffect(() => {
    nameInputRef.current = nameInput;
  }, [nameInput]);

  useEffect(() => {
    avatarRef.current = selectedAvatar;
  }, [selectedAvatar]);

  useEffect(() => {
    socket.emit('checkReconnect', playerId);

    socket.on('reconnectInfo', (roomId) => {
      setCurrentRoom(roomId);
      socket.emit('join', roomId, localStorage.getItem('playerName') || '散户', playerId, localStorage.getItem('playerAvatar') || AVATARS[0]);
      // Let the subsequent gameState handle displaying the game
    });

    socket.on('roomsList', (rooms) => {
      setAvailableRooms(rooms.sort((a, b) => b.playerCount - a.playerCount));
    });

    socket.on('roomCreated', (roomId) => {
      // The server initialized it, now we formally "join" it so all the join lifecycle hooks run
      setCurrentRoom(roomId);
      socket.emit('join', roomId, nameInputRef.current.trim(), playerId, avatarRef.current);
    });

    socket.on('gameState', (state) => setGameState(state));
    socket.on('log', (msg) => setLogs(prev => [...prev, msg].slice(-50)));
    socket.on('error', (msg) => alert(msg));

    return () => {
      socket.off('reconnectInfo');
      socket.off('roomsList');
      socket.off('roomCreated');
      socket.off('gameState');
      socket.off('log');
      socket.off('error');
    };
  }, [playerId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      menuAudioRef.current?.play().catch(() => { }); // 提交时双重保险
      localStorage.setItem('playerName', nameInput.trim());
      localStorage.setItem('playerAvatar', selectedAvatar);
      setView('roomSelection');
      socket.emit('getRooms');
      socket.emit('checkReconnect', playerId);
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = roomOptions.roomName.trim() || `${nameInput}的大户室`;
    socket.emit('createRoom', { roomName: finalName, maxRounds: Number(roomOptions.maxRounds), darkPhaseTime: Number(roomOptions.darkPhaseTime) }, nameInput.trim(), playerId, selectedAvatar);
    setShowCreateRoom(false);
  };

  const handleJoinRoom = (roomId: string) => {
    setCurrentRoom(roomId);
    socket.emit('join', roomId, nameInput.trim(), playerId, selectedAvatar);
  };

  const handleStartGame = () => {
    if (currentRoom) socket.emit('startGame', currentRoom);
  };

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && currentRoom) {
      socket.emit('chat', currentRoom, chatInput.trim());
      setChatInput('');
    }
  };

  if (!gameState || !currentRoom) {
    return (
      <div className="min-h-screen lobby-pattern flex items-center justify-center font-sans tracking-wide relative overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'nameInput' ? (
            <motion.form key="name" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} onSubmit={handleNameSubmit} className="bg-white/95 p-10 py-12 rounded-3xl border-4 border-slate-300 shadow-2xl flex flex-col gap-5 w-[450px] relative z-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400 rounded-full blur-2xl opacity-20 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400 rounded-full blur-2xl opacity-20 pointer-events-none -translate-x-1/2 translate-y-1/2"></div>

              <h1 className="text-4xl font-black text-slate-800 text-center mb-2 drop-shadow-sm flex items-center justify-center gap-3">大富翁：散户逆袭</h1>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">江湖称号 (昵称)</label>
                <input type="text" placeholder="输入你想叫的名字..." className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:border-emerald-500 shadow-inner" value={nameInput} onChange={e => setNameInput(e.target.value)} required />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">选择身份头像</label>
                <div className="grid grid-cols-4 gap-3">
                  {AVATARS.map((url) => (
                    <motion.div
                      key={url}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedAvatar(url);
                        menuAudioRef.current?.play().catch(() => { }); // 点头像也解锁
                      }}
                      className={cn(
                        "aspect-square rounded-2xl border-4 cursor-pointer overflow-hidden transition-all",
                        selectedAvatar === url ? "border-emerald-500 shadow-lg scale-105" : "border-slate-100 opacity-60 hover:opacity-100"
                      )}
                    >
                      <img src={url} alt="avatar" className="w-full h-full object-cover" />
                    </motion.div>
                  ))}
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className="bg-emerald-500 text-white text-xl font-black py-3 rounded-xl shadow-[0_4px_0_theme(colors.emerald.700)] active:shadow-none active:translate-y-[4px] mt-4 border-2 border-emerald-600 transition-all">
                踏入股海
              </motion.button>
            </motion.form>
          ) : (
            <motion.div key="rooms" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="bg-white/95 p-8 rounded-3xl border-4 border-slate-300 shadow-2xl flex flex-col gap-6 w-[600px] max-h-[80vh] relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-black text-slate-800">选择大户室</h1>
                  <p className="text-sm font-bold text-slate-500 mt-1">当前身份: {nameInput}</p>
                </div>
                <button onClick={() => setView('nameInput')} className="text-sm font-bold text-blue-500 hover:underline">修改昵称</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 min-h-[300px]">
                {availableRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 font-bold gap-2">
                    <span className="text-4xl">👻</span>
                    <p>当前没有开放的大户室</p>
                    <p className="text-xs">不如自己建一个？</p>
                  </div>
                ) : (
                  availableRooms.map(room => (
                    <motion.div whileHover={{ scale: 1.01 }} key={room.id} className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-blue-400 transition-colors">
                      <div>
                        <div className="font-black text-lg text-slate-700">{room.name || `大户室 #${room.id}`}</div>
                        <div className="flex gap-3 text-xs font-bold mt-1">
                          <span className={cn(room.status === 'playing' ? "text-red-500" : "text-emerald-500")}>
                            {room.status === 'playing' ? '交易中...' : '等待开盘'}
                          </span>
                          <span className="text-slate-500">人数: {room.playerCount}/{room.maxPlayers}</span>
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleJoinRoom(room.id)}
                        disabled={room.playerCount >= room.maxPlayers}
                        className={cn(
                          "px-6 py-2 rounded-lg font-black text-white shadow-[0_3px_0_theme(colors.slate.800)] active:shadow-none active:translate-y-[3px] border-2",
                          room.playerCount >= room.maxPlayers ? "bg-slate-300 border-slate-400 shadow-[0_3px_0_theme(colors.slate.400)] text-slate-500 cursor-not-allowed" : "bg-blue-500 border-blue-700 shadow-[0_3px_0_theme(colors.blue.800)] hover:bg-blue-400"
                        )}
                      >
                        {room.playerCount >= room.maxPlayers ? '已满' : '加入'}
                      </motion.button>
                    </motion.div>
                  ))
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateRoom(true)}
                className="w-full bg-emerald-500 text-white text-lg font-black py-4 rounded-xl shadow-[0_4px_0_theme(colors.emerald.700)] active:shadow-none active:translate-y-[4px] border-2 border-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                <span className="text-2xl">+</span> 创建新的大户室
              </motion.button>

              <AnimatePresence>
                {showCreateRoom && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center rounded-3xl">
                    <motion.form initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onSubmit={handleCreateRoom} className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-4 border-4 border-slate-300">
                      <h2 className="text-2xl font-black text-slate-800 text-center">房间设置</h2>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">大户室名称</label>
                        <input autoFocus type="text" placeholder={`${nameInput}的大户室`} className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" value={roomOptions.roomName} onChange={e => setRoomOptions(o => ({ ...o, roomName: e.target.value }))} />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1">游戏回合</label>
                          <select className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" value={roomOptions.maxRounds} onChange={e => setRoomOptions(o => ({ ...o, maxRounds: Number(e.target.value) }))}>
                            <option value={5}>5 回合 (极速)</option>
                            <option value={10}>10 回合 (标准)</option>
                            <option value={15}>15 回合 (持久战)</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1">暗盘时间</label>
                          <select className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-blue-500" value={roomOptions.darkPhaseTime} onChange={e => setRoomOptions(o => ({ ...o, darkPhaseTime: Number(e.target.value) }))}>
                            <option value={15}>15秒 (紧张)</option>
                            <option value={30}>30秒 (标准)</option>
                            <option value={45}>45秒 (从容)</option>
                            <option value={60}>60秒 (闲庭信步)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-2">
                        <button type="button" onClick={() => setShowCreateRoom(false)} className="flex-1 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl border-2 border-slate-300 transition-colors">取消</button>
                        <button type="submit" className="flex-1 font-bold text-white bg-blue-500 hover:bg-blue-400 py-3 rounded-xl border-2 border-blue-600 shadow-[0_3px_0_theme(colors.blue.800)] active:shadow-none active:translate-y-[3px] transition-all">创建并加入</button>
                      </div>
                    </motion.form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const me = gameState.players[playerId];
  if (!me) return <div className="min-h-screen game-board-pattern flex items-center justify-center font-bold text-slate-500 text-xl">等待系统发牌...</div>;

  if (gameState.phase === 'waiting') {
    return <LobbyView gameState={gameState} me={me} currentRoom={currentRoom} onStartGame={handleStartGame} />;
  }

  if (gameState.phase === 'gameover') {
    return <GameOverView gameState={gameState} roomId={currentRoom} socket={socket} myId={me.id} />;
  }

  const isDarkPhase = gameState.phase === 'play';
  const isRevealPhase = gameState.phase === 'reveal';
  const isDiscardPhase = gameState.phase === 'discard';
  const myUnplugged = me.unpluggedUntil >= gameState.round;

  return (
    <div className={cn("h-screen w-screen p-4 font-sans text-slate-800 transition-colors duration-1000 overflow-hidden flex flex-col gap-4", isDarkPhase ? "bg-indigo-950" : isRevealPhase ? "bg-amber-100" : "bg-emerald-50")}>
      <div className="absolute inset-0 game-board-pattern opacity-10 pointer-events-none"></div>
      <div className="relative z-10 flex flex-col gap-4 h-full w-full">

        {myUnplugged && (
          <div className="fixed inset-0 z-50 pointer-events-none bg-red-900/50 backdrop-blur-[6px] flex items-center justify-center animate-shake">
            <motion.div initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", bounce: 0.6 }} className="bg-red-600 text-white text-6xl font-black rotate-[-15deg] border-8 border-white p-8 rounded-2xl tracking-widest shadow-[0_0_80px_rgba(220,38,38,1)]">
              断网重连中...
            </motion.div>
          </div>
        )}

        {/* Top Header Panel (Opponents + Phase/Timer) */}
        <div className="flex gap-4 shrink-0 h-44 items-stretch">

          {/* Opponents Area (Moved to top) flex-1 */}
          <div className="flex-[2] min-w-0 h-full">
            <PlayerDashboard
              gameState={gameState}
              myId={me.id}
              targetingState={targetingState}
              onSelectTarget={(pid) => {
                if (targetingState?.needsPlayer) {
                  window.dispatchEvent(new CustomEvent('card-target-selected', { detail: { playerId: pid } }));
                }
              }}
            />
          </div>

          {/* Global Trend Header */}
          <div className="bg-white border-[6px] border-slate-800 rounded-3xl p-4 flex flex-col justify-center min-w-[220px] h-full shadow-[8px_8px_0_theme(colors.slate.800)] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full translate-x-16 -translate-y-16 pointer-events-none"></div>
            <div className="text-[11px] font-black text-slate-400 mb-2 flex items-center gap-1 uppercase tracking-widest relative z-10"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block border-2 border-blue-200 animate-pulse"></span> 全球风向标</div>
            <div className="flex-1 border-4 border-blue-400 bg-blue-50/80 backdrop-blur-sm rounded-2xl px-4 flex flex-col items-center justify-center relative overflow-hidden shadow-inner w-full z-10">
              <div className="text-[10px] font-black text-blue-400 mb-1">当前大势</div>
              <div className="font-black text-blue-700 text-2xl leading-none truncate w-full text-center px-1">{gameState.trends[gameState.currentTrendIndex]?.name || '未知'}</div>
              <div className="text-xl font-black text-white bg-blue-500 px-4 py-1 rounded-xl shadow-[0_3px_0_theme(colors.blue.600)] mt-2 transform rotate-3 origin-center border-2 border-white">
                {gameState.trends[gameState.currentTrendIndex]?.effect > 0 ? '+' : ''}{Math.round((gameState.trends[gameState.currentTrendIndex]?.effect || 0) * 100)}%
              </div>
            </div>
          </div>

          {/* Phase / Timer Header */}
          <div className="bg-white border-[6px] border-slate-800 rounded-3xl p-4 flex flex-col items-center justify-center min-w-[220px] h-full relative shadow-[8px_8px_0_theme(colors.slate.800)] overflow-hidden">
            {isRevealPhase && <div className="absolute inset-0 bg-yellow-400/20 animate-pulse"></div>}
            <div className={cn("absolute top-0 w-full h-5", isDarkPhase ? "bg-purple-600" : isRevealPhase ? "bg-yellow-500" : isDiscardPhase ? "bg-red-500" : "bg-blue-500")}></div>
            <div className="text-sm font-black text-slate-400 tracking-widest mb-1 mt-3">第 {gameState.round} 回合</div>
            <motion.div
              key={gameState.phase}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn("text-3xl font-black drop-shadow-sm truncate px-2 w-full text-center", isRevealPhase ? "text-yellow-600" : isDarkPhase ? "text-purple-600" : isDiscardPhase ? "text-red-600" : "text-slate-700")}
            >
              {
                gameState.phase === 'unfreeze' ? '解冻交收' :
                  gameState.phase === 'open' ? '开盘撮合' :
                    gameState.phase === 'draw' ? '福利发放' :
                      gameState.phase === 'play' ? '暗盘角力' :
                        gameState.phase === 'discard' ? '强制遗弃' :
                          gameState.phase === 'reveal' ? '命运揭晓' :
                            gameState.phase === 'close' ? '闭市清算' : '交易终止'
              }
            </motion.div>
            {gameState.timeRemaining !== undefined && (gameState.phase === 'play' || gameState.phase === 'discard') && (
              <motion.div
                animate={gameState.timeRemaining <= 10 ? { scale: [1, 1.15, 1], textShadow: ["0 0 0px red", "0 0 15px red", "0 0 0px red"] } : { scale: 1 }}
                transition={gameState.timeRemaining <= 10 ? { repeat: Infinity, duration: 1, ease: "easeInOut" } : {}}
                className={cn("text-3xl font-black mt-1", gameState.timeRemaining <= 10 ? "text-red-500" : "text-emerald-600")}
              >
                00:{gameState.timeRemaining.toString().padStart(2, '0')}
              </motion.div>
            )}
          </div>
        </div>

        {/* Main Boards Area */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Play Area: Stocks */}
          <div className="flex flex-col flex-[2] min-w-0 h-full overflow-hidden">
            <div className="grid grid-cols-3 grid-rows-3 gap-3 h-full">
              {(Object.keys(gameState.stocks) as StockId[]).map(stockId => (
                <StockWidget
                  key={stockId}
                  stockId={stockId}
                  gameState={gameState}
                  me={me}
                  currentRoom={currentRoom!}
                  socket={socket}
                  isBeingTargeted={targetingState?.needsStock}
                  onTargetSelect={(sid) => {
                    if (targetingState?.needsStock) {
                      window.dispatchEvent(new CustomEvent('card-target-selected', { detail: { stockId: sid } }));
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right Panel: Logs */}
          <div className="flex flex-col gap-3 flex-[1] min-w-0 h-full">

            <div className="bg-[#FFFDF5] border-[6px] border-slate-800 rounded-3xl p-4 flex-1 flex flex-col min-h-0 relative shadow-[8px_8px_0_theme(colors.slate.800)]">
              <div className="flex items-center justify-between mb-3 border-b-4 border-slate-100 pb-3">
                <div className="text-sm font-black text-slate-800 tracking-wider flex items-center gap-2">
                  <span className="text-xl">📰</span> 财经快讯
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 text-sm font-bold pr-2 custom-scrollbar mb-4 z-10">
                <AnimatePresence initial={false}>
                  {logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-3 rounded-xl border-2 shadow-sm font-bold flex items-start gap-2 text-sm leading-snug",
                        log.includes('警告') || log.includes('强制') ? 'bg-red-50 border-red-300 text-red-700' :
                          log.includes('撮合') || log.includes('解冻') ? 'bg-emerald-50 border-emerald-300 text-emerald-700' :
                            log.includes('暗盘') ? 'bg-purple-50 border-purple-300 text-purple-700' :
                              log.includes('翻开牌') ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                                log.includes('私密') ? 'bg-fuchsia-50 border-fuchsia-300 text-fuchsia-800' :
                                  log.includes('加入') ? 'bg-blue-50 border-blue-300 text-blue-700' :
                                    'bg-slate-50 border-slate-300 text-slate-700'
                      )}
                    >
                      <div className="shrink-0 mt-0.5">
                        {log.includes('警告') ? '🚨' :
                          log.includes('强制') ? '💸' :
                            log.includes('撮合') ? '⚖️' :
                              log.includes('加入') ? '👋' :
                                log.includes('翻开') ? '🃏' : '🔔'}
                      </div>
                      <div>{log}</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={logsEndRef} />
              </div>
              <form onSubmit={handleChat} className="mt-auto">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="大声喊出你的报价..." className="w-full bg-white border-[4px] border-slate-800 hover:border-blue-500 rounded-2xl px-5 py-4 text-base text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-[#F0FAFF] font-black transition-all shadow-[inset_0_4px_0_rgba(0,0,0,0.05)]" />
              </form>
            </div>
          </div>

        </div>

        {/* Bottom Panel: Hand & Controls */}
        <div className="flex gap-4 h-56 shrink-0 relative">

          {/* Player Stats (Moved to bottom left) */}
          <div className="bg-white border-[6px] border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative shadow-[8px_8px_0_theme(colors.slate.800)] overflow-hidden w-64 shrink-0 z-10">
            <div className="h-full flex flex-col justify-between">

              <div className="flex items-center gap-3 mb-2 border-b-2 border-slate-100 pb-2">
                <div className="w-10 h-10 bg-indigo-50 border-2 border-indigo-200 rounded-full flex items-center justify-center overflow-hidden shadow-inner shrink-0 leading-none">
                  <img src={me.avatar || '/head/head1.png'} alt={me.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-slate-700 font-black truncate text-sm leading-tight">{me.name}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black text-slate-400 mb-0.5 uppercase tracking-wider">总资产</div>
                <motion.div key={me.totalAsset} initial={{ y: -5 }} animate={{ y: 0 }} className="text-2xl font-black text-emerald-600 drop-shadow-sm mb-2 leading-none">
                  ¥{me.totalAsset.toFixed(2)}
                </motion.div>

                <div className="relative bg-slate-50 p-2 rounded-lg border-2 border-slate-200 shadow-inner mb-2">
                  <div className="text-xs text-slate-500 font-bold mb-1 border-b border-slate-200 pb-1">可用现金</div>
                  <motion.div key={me.cash.available} className="text-slate-800 font-black text-lg">
                    ¥{me.cash.available.toFixed(2)}
                  </motion.div>
                  <FloatingCash value={me.cash.available} />
                </div>
              </div>

              <div />
            </div>
          </div>

          <div className="bg-emerald-100/50 backdrop-blur-sm border-[6px] border-slate-800 rounded-2xl flex-1 relative flex flex-col shadow-[8px_8px_0_theme(colors.slate.800)]">

            {isRevealPhase && gameState.playedCards.length > 0 && (
              <div className="absolute inset-0 bg-slate-900/80 z-40 flex flex-col items-center justify-center p-4 backdrop-blur-md">
                <div className="text-yellow-400 font-black text-2xl tracking-widest mb-6 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] scale-110">命运揭晓</div>
                <div className="flex gap-6">
                  <AnimatePresence>
                    {gameState.playedCards.map((played, i) => (
                      <motion.div key={played.id} initial={{ opacity: 0, y: 100, rotate: -10 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: i * 0.3, type: "spring" }} className="w-32 bg-white rounded-xl shadow-2xl relative border-4 border-slate-300 flex flex-col">
                        <div className="absolute -top-4 -left-2 bg-yellow-400 border-2 border-yellow-600 text-yellow-900 font-bold text-[10px] px-2 py-0.5 rounded shadow-sm z-10 transform -rotate-6">
                          {gameState.players[played.playerId]?.name} 翻开
                        </div>
                        <div className="bg-slate-100 p-2 border-b-2 border-slate-200 text-center font-black tracking-wider text-slate-800 text-xs">{played.card.name}</div>
                        <div className="p-3 text-[10px] text-slate-600 font-bold text-center leading-relaxed h-20 flex items-center justify-center">
                          {played.card.desc}
                        </div>
                        {(played.targetStockId || played.targetPlayerId) && (
                          <div className="bg-slate-800 text-cyan-300 text-[10px] p-2 text-center font-bold border-t border-slate-700">
                            目标: {played.targetPlayerId ? gameState.players[played.targetPlayerId]?.name : ''} {played.targetStockId ? gameState.stocks[played.targetStockId]?.name : ''}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            <div className="flex-1 flex gap-2 w-full justify-center pt-2 overflow-visible relative z-10">
              {me.hand.map((card, i) => (
                <CardWidget
                  key={card.id || i}
                  card={card}
                  index={i}
                  total={me.hand.length}
                  gameState={gameState}
                  me={me}
                  currentRoom={currentRoom!}
                  socket={socket}
                  targetingState={targetingState}
                  setTargetingState={setTargetingState}
                />
              ))}
              {me.hand.length === 0 && <div className="text-slate-400 font-bold opacity-50 text-2xl tracking-widest uppercase self-center absolute top-1/2 -translate-y-1/2">手牌打空了</div>}
            </div>
          </div>

          <div className="bg-white border-[6px] border-slate-800 rounded-2xl p-4 w-64 flex flex-col justify-center gap-2 shadow-[8px_8px_0_theme(colors.slate.800)] z-10">
            <div className="text-center font-black text-xs text-red-500/80 mb-1">注意: 低于300资产将强制爆仓</div>
            <motion.button
              whileHover={(!me.isReady && !myUnplugged && isDarkPhase) || (isDiscardPhase && me.hand.length > me.handLimit) ? { scale: 1.02 } : {}}
              whileTap={(!me.isReady && !myUnplugged && isDarkPhase) || (isDiscardPhase && me.hand.length > me.handLimit) ? { scale: 0.98 } : {}}
              onClick={() => {
                if (isDiscardPhase && me.hand.length > me.handLimit) {
                  return; // Need to click cards directly
                }
                socket.emit('endTurn', currentRoom);
              }}
              disabled={(!isDarkPhase && !(isDiscardPhase && me.hand.length > me.handLimit)) || me.isReady || (myUnplugged && !isDiscardPhase)}
              className={cn(
                "w-full h-16 rounded-xl font-black text-xl transition-all border-b-4 relative overflow-hidden",
                (myUnplugged && isDarkPhase) ? "bg-red-100 text-red-500 border-red-300" :
                  me.isReady ? "bg-slate-100 text-slate-400 border-slate-300" :
                    (isDiscardPhase && me.hand.length > me.handLimit) ? "bg-red-500 text-white border-red-700 shadow-[0_4px_0_theme(colors.red.800)] animate-pulse" :
                      "bg-blue-500 hover:bg-blue-400 text-white border-blue-700 shadow-[0_4px_0_theme(colors.blue.800)] active:shadow-none active:translate-y-[4px] cursor-pointer"
              )}
            >
              {isDiscardPhase && me.hand.length > me.handLimit && <div className="absolute inset-0 bg-red-400/30 w-full h-full striped-bg"></div>}
              <span className="relative z-10">
                {(myUnplugged && isDarkPhase) ? '连接中断' :
                  (isDiscardPhase && me.hand.length > me.handLimit) ? `需弃置 ${me.hand.length - me.handLimit} 张` :
                    me.isReady ? '静观其变...' : '结束回合'}
              </span>
            </motion.button>
            <div className="text-[10px] text-center font-bold text-slate-400">暗盘部署完毕请结束回合</div>
          </div>
        </div>

        {/* Game Over Leaderboard Overlay */}
        <AnimatePresence>
          {gameState.phase === 'gameover' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white border-4 border-emerald-500 rounded-3xl p-8 max-w-2xl w-full shadow-[0_0_50px_rgba(16,185,129,0.5)] flex flex-col items-center"
              >
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-4xl font-black text-emerald-800 mb-2 tracking-tight">模拟交易结束</h2>
                <p className="text-slate-500 font-bold mb-8">最终资产排行榜</p>

                <div className="w-full flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {(Object.values(gameState.players) as any[])
                    .sort((a, b) => b.totalAsset - a.totalAsset)
                    .map((p, i) => (
                      <div key={p.id} className={cn("flex items-center justify-between p-4 rounded-2xl border-2", i === 0 ? "bg-yellow-50 border-yellow-400 shadow-md" : i === 1 ? "bg-slate-50 border-slate-300" : i === 2 ? "bg-orange-50 border-orange-300" : "bg-white border-slate-100")}>
                        <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black text-xl", i === 0 ? "bg-yellow-400 text-yellow-900" : i === 1 ? "bg-slate-300 text-slate-700" : i === 2 ? "bg-orange-300 text-orange-900" : "bg-slate-100 text-slate-400")}>
                            {i + 1}
                          </div>
                          <div className="font-bold text-lg text-slate-800">{p.name} {p.id === me.id ? <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full ml-2">是我</span> : ''}</div>
                        </div>
                        <div className={cn("text-2xl font-black", i === 0 ? "text-yellow-600" : "text-emerald-600")}>
                          ¥{p.totalAsset.toFixed(2)}
                        </div>
                      </div>
                    ))}
                </div>

                <div className="mt-8 text-slate-400 font-bold text-sm text-center">
                  感谢参与散户生存战！刷新页面可重新开始。
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
