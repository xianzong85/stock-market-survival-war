export type StockId = string;
export type StockCategory = 'tech' | 'ev' | 'consumer' | 'finance' | 'pharma' | 'st';

export interface StockHistoryPoint {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TargetingState {
  cardId: string;
  type: CardType;
  needsStock: boolean;
  needsPlayer: boolean;
}

export interface Stock {
  id: StockId;
  name: string;
  category: StockCategory;
  price: number;
  history: number[]; // Still keep raw ticks for real-time line if needed
  ohlcHistory: StockHistoryPoint[];
  volatility: number; // Inherent volatility / idiosyncratic risk (e.g. 1 means +/-1 default swing, 2 for ST)
}

export interface Order {
  id: string;
  playerId: string;
  stockId: StockId;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: number;
}

export interface OrderBook {
  buys: Order[];
  sells: Order[];
}

export interface PlayedCard {
  id: string; // the card instance id
  card: Card;
  playerId: string;
  targetStockId?: StockId;
  targetPlayerId?: string;
}

export type CardType = 'good_news' | 'bad_news' | 'peek' | 'vip' | 'liquidate' | 'clarify' | 'unplug' | 'intercept';

export interface Card {
  id: string;
  type: CardType;
  name: string;
  desc: string;
}

export interface PlayerState {
  id: string;
  name: string;
  cash: {
    available: number;
    frozen: number;
  };
  portfolio: Record<string, { available: number; frozen: number }>;
  hand: Card[];
  totalAsset: number;
  handLimit: number;
  isReady: boolean;
  unpluggedUntil: number; // round number until which player is unplugged
  avatar: string;
}

export interface TrendCard {
  id: string;
  name: string;
  effect: number; // e.g., +1, -2
  target: 'all' | StockCategory[]; // 'all' for macro, or array of specific stock categories
}

export interface GameState {
  roomName?: string;
  maxRounds?: number;
  darkPhaseTime?: number;
  round: number;
  phase: 'waiting' | 'unfreeze' | 'open' | 'draw' | 'play' | 'reveal' | 'discard' | 'close' | 'gameover';
  timeRemaining?: number; // for play phase
  stocks: Record<StockId, Stock>;
  orderBook: Record<StockId, OrderBook>;
  playedCards: PlayedCard[]; // cards played in the current round (unrevealed until reveal phase)
  players: Record<string, PlayerState>;
  trends: TrendCard[];
  currentTrendIndex: number;
  logs: string[];
  hostId?: string;
}

export interface RoomSummary {
  id: string;
  name?: string;
  playerCount: number;
  maxPlayers: number;
  status: 'waiting' | 'playing';
}

export interface ClientToServerEvents {
  checkReconnect: (playerId: string) => void;
  getRooms: () => void;
  createRoom: (options: { roomName: string, maxRounds: number, darkPhaseTime: number }, playerName: string, playerId: string, avatar: string) => void;
  join: (roomId: string, name: string, playerId: string, avatar: string) => void;
  startGame: (roomId: string) => void;
  placeOrder: (roomId: string, stockId: StockId, type: 'buy' | 'sell', price: number, quantity: number) => void;
  cancelOrder: (roomId: string, orderId: string) => void;
  playCard: (roomId: string, cardId: string, targetStockId?: StockId, targetPlayerId?: string) => void;
  endTurn: (roomId: string) => void;
  chat: (roomId: string, message: string) => void;
  returnToLobby: (roomId: string) => void;
  discardCard: (roomId: string, cardId: string) => void;
}

export interface ServerToClientEvents {
  roomsList: (rooms: RoomSummary[]) => void;
  roomCreated: (roomId: string) => void;
  reconnectInfo: (roomId: string) => void;
  gameState: (state: GameState) => void;
  error: (msg: string) => void;
  log: (msg: string) => void;
}
