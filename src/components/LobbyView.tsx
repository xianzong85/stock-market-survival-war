import React from 'react';
import { GameState, PlayerState } from '../types';
import { motion } from 'motion/react';

interface LobbyViewProps {
    gameState: GameState;
    me: PlayerState;
    currentRoom: string;
    onStartGame: () => void;
}

export default function LobbyView({ gameState, me, currentRoom, onStartGame }: LobbyViewProps) {
    const players = Object.values(gameState.players);
    const isHost = gameState.hostId === me.id;

    return (
        <div className="min-h-screen lobby-pattern flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/95 p-8 rounded-3xl shadow-2xl border-4 border-slate-300 w-full max-w-2xl relative overflow-hidden z-10"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400 rounded-full blur-2xl opacity-20 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400 rounded-full blur-2xl opacity-20 pointer-events-none -translate-x-1/2 translate-y-1/2"></div>

                <h1 className="text-4xl font-black text-center mb-2 mt-4 text-emerald-800 tracking-tight drop-shadow-sm flex items-center justify-center gap-3">
                    大富翁：散户逆袭
                </h1>
                <p className="text-center text-slate-500 font-bold mb-8 outline-dashed outline-1 outline-slate-300 w-fit mx-auto px-4 py-1 rounded-full bg-slate-50">
                    房间号: {currentRoom}
                </p>

                <div className="bg-slate-50 rounded-xl p-6 border-2 border-slate-200 shadow-inner mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-700">已入座玩家</h2>
                        <span className="text-emerald-600 font-bold bg-emerald-100 px-3 py-1 rounded-full text-sm">{players.length}/8</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {players.map(p => (
                            <motion.div
                                key={p.id}
                                initial={{ scale: 0, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                whileHover={{ y: -5, scale: 1.05 }}
                                className={`p-4 rounded-xl border-4 text-center bg-white shadow-sm relative ${p.id === me.id ? 'border-emerald-400' : 'border-slate-200'}`}
                            >
                                {gameState.hostId === p.id && (
                                    <div className="absolute -top-3 -right-2 text-[10px] text-yellow-800 font-black bg-yellow-400 border-2 border-yellow-600 rounded-full px-2 py-0.5 shadow-md transform rotate-12">
                                        房主
                                    </div>
                                )}
                                <div className="w-12 h-12 mx-auto bg-slate-100 border-2 border-slate-200 rounded-full flex items-center justify-center mb-2 overflow-hidden shadow-inner">
                                    <img src={p.avatar || '/head/head1.png'} alt={p.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="font-bold text-slate-800 truncate px-1">{p.name}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-center">
                    {isHost ? (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onStartGame}
                            disabled={players.length < 2}
                            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-300 disabled:border-slate-400 disabled:text-slate-500 text-white text-xl font-black py-4 px-12 rounded-xl shadow-[0_6px_0_theme(colors.emerald.700)] active:shadow-none active:translate-y-[6px] transition-all border-2 border-emerald-600"
                        >
                            {players.length < 2 ? '等待对手加入...' : '开始游戏!'}
                        </motion.button>
                    ) : (
                        <div className="text-xl font-bold text-slate-600 animate-pulse bg-slate-100 border-2 border-slate-200 py-3 px-8 rounded-xl shadow-inner">
                            等候房主发车...
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
