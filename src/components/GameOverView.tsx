import React from 'react';
import { GameState } from '../types';
import { motion } from 'motion/react';

interface GameOverViewProps {
    gameState: GameState;
    roomId: string;
    socket: any;
    myId: string;
}

export default function GameOverView({ gameState, roomId, socket, myId }: GameOverViewProps) {
    const isHost = gameState.hostId === myId;
    const sortedPlayers = Object.values(gameState.players).sort((a, b) => b.totalAsset - a.totalAsset);

    const handleReturn = () => {
        socket.emit('returnToLobby', roomId);
    };

    return (
        <div className="min-h-screen bg-[var(--board-bg)] flex flex-col items-center justify-center p-8 text-slate-800 game-board-pattern">
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="w-full max-w-4xl bg-white border-4 border-slate-300 rounded-3xl p-8 shadow-[8px_8px_0_theme(colors.slate.300)] relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400 rounded-full blur-3xl opacity-20 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400 rounded-full blur-3xl opacity-20 pointer-events-none -translate-x-1/2 translate-y-1/2"></div>

                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="text-6xl mb-2">🏆</div>
                    <h1 className="text-5xl font-black text-center mb-2 tracking-widest text-slate-800 drop-shadow-sm flex items-center gap-4">
                        游戏结束
                    </h1>
                    <p className="text-center text-slate-500 font-bold tracking-wider bg-slate-100 px-6 py-2 rounded-full border-2 border-slate-200">最终资产排行榜单</p>
                </div>

                <div className="space-y-4 mb-10 relative z-10">
                    {sortedPlayers.map((p, index) => {
                        const isMe = p.id === myId;
                        let rankColor = 'bg-slate-50 border-slate-200';
                        let rankLabelColor = 'text-slate-400';
                        let medal = '';

                        if (index === 0) {
                            rankColor = 'bg-amber-50 border-amber-300 shadow-[0_4px_15px_rgba(251,191,36,0.3)]';
                            rankLabelColor = 'text-amber-500';
                            medal = '🥇';
                        }
                        else if (index === 1) {
                            rankColor = 'bg-slate-100 border-slate-300 shadow-sm';
                            rankLabelColor = 'text-slate-500';
                            medal = '🥈';
                        }
                        else if (index === 2) {
                            rankColor = 'bg-orange-50 border-orange-200 shadow-sm';
                            rankLabelColor = 'text-orange-500';
                            medal = '🥉';
                        }

                        return (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`flex items-center gap-4 p-4 rounded-2xl border-4 ${rankColor} ${isMe ? 'shadow-md' : ''} transition-all hover:scale-[1.01]`}
                            >
                                <div className={`w-16 text-center text-3xl font-black flex items-center justify-center gap-1 ${rankLabelColor}`}>
                                    {medal} <span className="text-2xl">#{index + 1}</span>
                                </div>
                                <div className="w-16 h-16 bg-white rounded-full border-4 border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                    <img src={p.avatar || '/head/head1.png'} alt={p.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-2xl font-black flex items-center gap-2 text-slate-700">
                                        {p.name} {isMe && <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full lowercase tracking-wider shadow-sm">You</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 font-bold bg-white inline-block px-2 py-0.5 rounded border border-slate-200 mt-1">最终清算，股票已全部变现</div>
                                </div>
                                <div className="text-right bg-white p-3 rounded-xl border-2 border-slate-100 shadow-inner">
                                    <div className="text-xs text-slate-400 font-black mb-1 uppercase tracking-wider">总资产</div>
                                    <div className="text-3xl font-black text-emerald-600 drop-shadow-sm">
                                        ¥{p.totalAsset.toFixed(2)}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <div className="flex justify-center mt-6">
                    {isHost ? (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleReturn}
                            className="bg-blue-500 text-white text-2xl font-black py-5 px-16 rounded-2xl shadow-[0_6px_0_theme(colors.blue.700)] active:shadow-none active:translate-y-[6px] border-4 border-blue-600 transition-all flex items-center gap-3"
                        >
                            返回大户室 (重新开始)
                        </motion.button>
                    ) : (
                        <div className="text-slate-500 font-black animate-pulse text-xl border-4 border-slate-300 bg-slate-100 py-4 px-10 rounded-2xl flex items-center gap-3">
                            <span className="text-2xl">⏳</span> 等待房主重置房间...
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
