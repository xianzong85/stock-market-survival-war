import React from 'react';
import { GameState } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';

interface PlayerDashboardProps {
    gameState: GameState;
    myId: string;
    targetingState?: any;
    onSelectTarget?: (playerId: string) => void;
}

export default function PlayerDashboard({ gameState, myId, targetingState, onSelectTarget }: PlayerDashboardProps) {
    const opponents = Object.values(gameState.players).filter(p => p.id !== myId);
    const isDarkPhase = gameState.phase === 'play';

    return (
        <div className="bg-[#FFFDF5] border-[6px] border-slate-800 rounded-2xl p-3 shrink-0 flex items-center justify-between relative min-h-[120px] shadow-[8px_8px_0_theme(colors.slate.800)] overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100 rounded-full translate-x-16 -translate-y-16 pointer-events-none"></div>

            {/* Opponents List */}
            <div className="flex gap-4 z-10 overflow-x-auto w-full pr-32 custom-scrollbar pb-2">
                {opponents.length === 0 ? (
                    <div className="text-slate-400 font-bold italic w-full text-center">等待对手...</div>
                ) : (
                    opponents.map(opp => (
                        <div
                            key={opp.id}
                            onClick={() => {
                                if (targetingState?.needsPlayer && onSelectTarget) {
                                    onSelectTarget(opp.id);
                                }
                            }}
                            className={cn(
                                "min-w-[190px] bg-white border-[4px] border-slate-800 rounded-2xl p-3 flex flex-col gap-2 relative shadow-[4px_4px_0_theme(colors.slate.800)] transition-all",
                                targetingState?.needsPlayer ? "cursor-crosshair border-blue-400 ring-4 ring-blue-400/50 animate-pulse" : "hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_theme(colors.slate.800)]"
                            )}
                        >
                            {opp.isReady && (
                                <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full border-4 border-white shadow-md rotate-12 z-20">
                                    READY
                                </div>
                            )}
                            {opp.unpluggedUntil >= gameState.round && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500/90 text-white text-xs font-black px-3 py-1.5 rounded border-2 border-red-700 shadow-lg -rotate-12 whitespace-nowrap z-20 animate-pulse backdrop-blur-sm">
                                    离线 (拔网线)
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-50 border-2 border-indigo-200 rounded-full flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                                    <img src={opp.avatar || '/head/head1.png'} alt={opp.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-slate-700 font-black truncate text-sm">{opp.name}</div>
                                    <div className="text-emerald-600 font-black text-base drop-shadow-sm">¥{opp.totalAsset.toFixed(2)}</div>
                                </div>
                            </div>
                            <div className="flex gap-1 mt-1 justify-center bg-white p-1.5 rounded-lg border border-slate-200">
                                {Array.from({ length: opp.hand.length }).map((_, i) => (
                                    <div key={i} className="w-5 h-7 bg-white rounded-[3px] border-2 border-slate-800 shadow-[2px_2px_0_theme(colors.slate.800)] flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full border border-slate-200"></div>
                                    </div>
                                ))}
                                {opp.hand.length === 0 && <span className="text-[10px] text-slate-400 font-bold">空手牌</span>}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Staging Area (Face Down Cards during Play) */}
            <div className="absolute right-6 inset-y-0 flex items-center z-20 pointer-events-none">
                {isDarkPhase && gameState.playedCards.length > 0 && (
                    <div className="flex -space-x-8">
                        <AnimatePresence>
                            {gameState.playedCards.map((played, i) => (
                                <motion.div
                                    key={played.id}
                                    initial={{ opacity: 0, scale: 0, rotate: -30, x: played.playerId === myId ? 100 : -100 }}
                                    animate={{ opacity: 1, scale: 1, rotate: (i * 5) - 10, x: 0 }}
                                    className="w-16 h-24 bg-red-600 border-4 border-white rounded-xl shadow-[0_5px_15px_rgba(0,0,0,0.2)] flex items-center justify-center bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(255,255,255,0.2)_5px,rgba(255,255,255,0.2)_10px)]"
                                >
                                    <div className="w-8 h-12 border-2 border-white/50 rounded-md"></div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
