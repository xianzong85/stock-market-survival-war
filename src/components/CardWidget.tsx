import React, { useState } from 'react';
import { Card, GameState, PlayerState, StockId, TargetingState } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Info, X } from 'lucide-react';
import { cn } from '../utils';

interface CardWidgetProps {
    key?: React.Key;
    card: Card;
    index: number;
    total: number;
    gameState: GameState;
    me: PlayerState;
    currentRoom: string;
    socket: any;
    targetingState: TargetingState | null;
    setTargetingState: (state: TargetingState | null) => void;
}

export default function CardWidget({ card, index, total, gameState, me, currentRoom, socket, targetingState, setTargetingState }: CardWidgetProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingTarget, setPendingTarget] = useState<{ sid?: StockId, pid?: string } | null>(null);

    const isDarkPhase = gameState.phase === 'play';
    const isDiscardPhase = gameState.phase === 'discard';
    const myUnplugged = me.unpluggedUntil >= gameState.round;
    const canPlay = (isDarkPhase && !myUnplugged && !me.isReady) || (isDiscardPhase && me.hand.length > me.handLimit);
    const isThisCardTargeting = targetingState?.cardId === card.id;

    // Listen for global target selection
    React.useEffect(() => {
        if (!isThisCardTargeting) return;

        const handleTargetSelected = (e: any) => {
            const { stockId, playerId } = e.detail;
            setPendingTarget({ sid: stockId, pid: playerId });
            setShowConfirm(true);
            setTargetingState(null); // Exit targeting mode
        };

        window.addEventListener('card-target-selected', handleTargetSelected);
        return () => window.removeEventListener('card-target-selected', handleTargetSelected);
    }, [isThisCardTargeting, setTargetingState]);

    const handlePlayExecute = () => {
        if (isDiscardPhase) {
            socket.emit('discardCard', currentRoom, card.id);
        } else {
            socket.emit('playCard', currentRoom, card.id, pendingTarget?.sid, pendingTarget?.pid);
        }
        resetStates();
    };

    const resetStates = () => {
        setShowConfirm(false);
        setPendingTarget(null);
        if (isThisCardTargeting) setTargetingState(null);
    };

    const needsStockTarget = ['good_news', 'bad_news', 'vip', 'clarify', 'intercept'].includes(card.type);
    const needsPlayerTarget = ['liquidate', 'unplug'].includes(card.type);

    // Calculate rotation and translation for fan effect
    const angle = (index - (total - 1) / 2) * 8;
    const yOffset = Math.abs(index - (total - 1) / 2) * 5;

    // Get opponents for target selection
    const opponents = Object.values(gameState.players).filter(p => p.id !== me.id);

    return (
        <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative group origin-bottom"
            style={{
                transform: `rotate(${angle}deg) translateY(${yOffset}px)`,
                zIndex: index + (isThisCardTargeting || showConfirm ? 100 : 0)
            }}
        >
            <motion.div
                whileHover={canPlay ? { y: -30, scale: 1.15, zIndex: 50 } : {}}
                className={cn(
                    "w-32 h-48 rounded-2xl bg-slate-800 border-[6px] shadow-[6px_6px_0_theme(colors.slate.800)] flex flex-col cursor-pointer transition-all duration-200 overflow-hidden relative",
                    !canPlay && "opacity-50 grayscale cursor-not-allowed",
                    "border-slate-800",
                    isThisCardTargeting ? "ring-4 ring-yellow-400 scale-110 -translate-y-8 z-50" : "hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[10px_10px_0_theme(colors.slate.800)]"
                )}
                onClick={() => {
                    if (!canPlay || showConfirm || isThisCardTargeting) return;

                    if (isDiscardPhase) {
                        setShowConfirm(true);
                        return;
                    }

                    if (needsStockTarget || needsPlayerTarget) {
                        setTargetingState({
                            cardId: card.id,
                            type: card.type,
                            needsStock: needsStockTarget,
                            needsPlayer: needsPlayerTarget
                        });
                    } else {
                        setShowConfirm(true);
                    }
                }}
            >
                {/* Confirmation Overlay */}
                <AnimatePresence>
                    {showConfirm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-2 gap-2"
                        >
                            <div className="text-[10px] font-black text-white text-center leading-tight mb-1">
                                {isDiscardPhase ? '确认弃置此牌？' : '确认打出此牌？'}
                                {pendingTarget?.sid && `\n目标: ${gameState.stocks[pendingTarget.sid].name}`}
                                {pendingTarget?.pid && `\n对象: ${gameState.players[pendingTarget.pid].name}`}
                            </div>
                            <div className="flex flex-col w-full gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePlayExecute(); }}
                                    className="w-full py-2 bg-emerald-500 text-white text-xs font-black rounded-lg border-b-4 border-emerald-700 active:translate-y-1 active:border-b-0"
                                >
                                    确认
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); resetStates(); }}
                                    className="w-full py-2 bg-slate-600 text-white text-xs font-black rounded-lg border-b-4 border-slate-800 active:translate-y-1 active:border-b-0"
                                >
                                    取消
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Targeting Active Marker */}
                {isThisCardTargeting && (
                    <div className="absolute inset-0 z-40 bg-blue-500/20 flex flex-col items-center justify-center p-2">
                        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg">
                            选择目标中...
                        </motion.div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setTargetingState(null); }}
                            className="mt-4 px-3 py-1 bg-white text-slate-800 text-[10px] font-black rounded-lg shadow-md border-2 border-slate-800"
                        >
                            取消
                        </button>
                    </div>
                )}
                <div className="text-xs font-black text-center py-2 px-1 tracking-wider border-b-[6px] border-slate-800 bg-slate-800 text-white shrink-0">
                    {card.name}
                </div>

                <div className="flex-1 flex flex-col bg-white overflow-hidden pointer-events-none rounded-b-lg">
                    <img
                        src={`/cards/${card.type}.png`}
                        alt=""
                        className="w-full h-[96px] object-cover shrink-0 pointer-events-none"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
                    />
                    <div className="text-[10px] text-slate-700 text-center font-bold leading-tight w-full flex-1 flex items-center justify-center p-1 bg-slate-50 border-t-[4px] border-slate-800">
                        {card.desc}
                    </div>
                </div>
            </motion.div>


        </motion.div>
    );
}
