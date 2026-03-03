import React, { useState, useEffect } from 'react';
import { GameState, PlayerState, StockId } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { cn } from '../utils';

interface StockWidgetProps {
    key?: React.Key;
    stockId: StockId;
    gameState: GameState;
    me: PlayerState;
    currentRoom: string;
    socket: any;
    isBeingTargeted?: boolean;
    onTargetSelect?: (stockId: StockId) => void;
}

const CandlestickShape = (props: any) => {
    const { x, y, width, height, payload } = props;
    const { open, close, high, low, isUp } = payload;

    // Safety check for empty or loading data
    if (high === undefined) return null;

    const getY = (val: number) => {
        if (high === low) return y + height / 2;
        return y + height * ((high - val) / (high - low));
    };

    const openY = getY(open);
    const closeY = getY(close);
    const topY = Math.min(openY, closeY);
    const bottomY = Math.max(openY, closeY);

    const bodyHeight = Math.max(bottomY - topY, 2);
    const fill = isUp ? "#ef4444" : "#10b981";

    const w = width;
    const center = x + width / 2;

    return (
        <g>
            <line x1={center} y1={y} x2={center} y2={y + height} stroke={fill} strokeWidth={2} />
            <rect x={center - w / 2} y={topY} width={w} height={bodyHeight} fill={fill} />
        </g>
    );
};

export default function StockWidget({ stockId, gameState, me, currentRoom, socket, isBeingTargeted, onTargetSelect }: StockWidgetProps) {
    const stock = gameState.stocks[stockId];
    const book = gameState.orderBook[stockId];
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
    const [priceInput, setPriceInput] = useState(stock.price.toString());
    const [qtyInput, setQtyInput] = useState('1');

    const isDarkPhase = gameState.phase === 'play';
    const myUnplugged = me.unpluggedUntil >= gameState.round;
    const canTrade = isDarkPhase && !myUnplugged && !me.isReady;

    useEffect(() => {
        if (isModalOpen) {
            setPriceInput(stock.price.toString());
        }
    }, [isModalOpen, stock.price]);

    const candleData = stock.ohlcHistory.map((p, i) => ({
        time: i + 1,
        lowHigh: [p.low, p.high],
        openClose: [p.open, p.close],
        isUp: p.close >= p.open,
        open: p.open,
        close: p.close,
        high: p.high,
        low: p.low
    }));

    if (candleData.length === 0) {
        candleData.push({
            time: 1,
            lowHigh: [stock.price, stock.price],
            openClose: [stock.price, stock.price],
            isUp: true,
            open: stock.price,
            close: stock.price,
            high: stock.price,
            low: stock.price
        });
    }

    const minSlots = 15;
    const paddingCount = Math.max(0, minSlots - candleData.length);
    const displayData = [...candleData];
    for (let i = 0; i < paddingCount; i++) {
        displayData.push({
            time: candleData.length + i + 1,
        } as any);
    }

    const prevPrice = stock.history.length > 1 ? stock.history[stock.history.length - 2] : stock.history[0];
    const isUp = stock.price >= prevPrice;
    const pctChange = prevPrice > 0 ? ((stock.price - prevPrice) / prevPrice) * 100 : 0;
    const pctStr = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`;

    const handleExecuteTrade = () => {
        if (!canTrade) return;
        socket.emit('placeOrder', currentRoom, stockId, tradeType, parseFloat(priceInput), parseInt(qtyInput, 10));
        setIsModalOpen(false);
    };

    const buyDepth = book.buys.reduce((acc, o) => {
        acc[o.price] = (acc[o.price] || 0) + o.quantity;
        return acc;
    }, {} as Record<number, number>);
    const sellDepth = book.sells.reduce((acc, o) => {
        acc[o.price] = (acc[o.price] || 0) + o.quantity;
        return acc;
    }, {} as Record<number, number>);

    const buyLevels = Object.entries(buyDepth).map(([p, q]) => ({ price: parseFloat(p), qty: q })).sort((a, b) => b.price - a.price).slice(0, 5);
    const sellLevels = Object.entries(sellDepth).map(([p, q]) => ({ price: parseFloat(p), qty: q })).sort((a, b) => a.price - b.price).slice(0, 5);

    return (
        <>
            <motion.div
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                    if (isBeingTargeted && onTargetSelect) {
                        onTargetSelect(stockId);
                        return;
                    }
                    setIsModalOpen(true);
                }}
                className={cn(
                    "bg-white border-[6px] rounded-2xl p-4 flex flex-col cursor-pointer relative overflow-hidden group transition-all duration-200 h-32",
                    isBeingTargeted ? "border-blue-400 ring-4 ring-blue-400/50 animate-pulse shadow-[0_0_15px_rgba(96,165,250,0.5)]" :
                        isModalOpen ? "border-blue-500 shadow-[6px_6px_0_theme(colors.blue.500)]" : "border-slate-800 shadow-[8px_8px_0_theme(colors.slate.800)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0_theme(colors.slate.800)]"
                )}
            >
                <div className={cn(
                    "absolute top-0 left-0 w-full h-4 border-b-[6px] border-slate-800",
                    stock.category === 'tech' ? 'bg-[#3b82f6]' : // Blue
                        stock.category === 'ev' ? 'bg-[#10b981]' : // Emerald
                            stock.category === 'st' ? 'bg-[#d946ef]' : // Fuchsia
                                stock.category === 'consumer' ? 'bg-[#f43f5e]' : // Rose
                                    stock.category === 'finance' ? 'bg-[#f59e0b]' : // Amber
                                        'bg-[#06b6d4]' // Cyan
                )}></div>

                <div className="text-xl font-black text-slate-700 mt-2 z-10">{stock.name}</div>

                <div className="flex justify-between items-end mt-auto z-10">
                    <div className={cn("text-3xl font-black flex items-center gap-1 drop-shadow-sm", isUp ? "text-red-500" : "text-emerald-500")}>
                        <motion.span key={stock.price} initial={{ scale: 1.2 }} animate={{ scale: 1 }}>
                            ¥{stock.price.toFixed(2)}
                        </motion.span>
                        <span className="text-base font-bold ml-1">{pctStr}</span>
                    </div>
                </div>

                {/* Background watermarked arrow for juiciness */}
                <div className="absolute -bottom-2 -right-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
                    {isUp ? <ArrowUp size={100} className="stroke-[4px] text-red-500" /> : <ArrowDown size={100} className="stroke-[4px] text-emerald-500" />}
                </div>
            </motion.div>

            {/* Trade Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className="bg-[#FFFDF5] border-[6px] border-slate-800 rounded-3xl p-6 w-full max-w-4xl shadow-[12px_12px_0_theme(colors.slate.800)] relative flex gap-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors z-50">
                                <X size={24} className="text-slate-400" />
                            </button>

                            {/* Left Side: Chart & Order Book */}
                            <div className="flex-1 flex flex-col gap-4 border-r-2 border-slate-100 pr-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={cn("w-4 h-12 rounded-full border-[4px] border-slate-800 shadow-[2px_2px_0_theme(colors.slate.800)]", stock.category === 'tech' ? 'bg-[#3b82f6]' : stock.category === 'ev' ? 'bg-[#10b981]' : stock.category === 'st' ? 'bg-[#d946ef]' : stock.category === 'consumer' ? 'bg-[#f43f5e]' : stock.category === 'finance' ? 'bg-[#f59e0b]' : 'bg-[#06b6d4]')}></div>
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-800 tracking-wider">{stock.name}</h2>
                                        <div className={cn("text-2xl font-black flex items-center gap-1 mt-1", isUp ? "text-red-500" : "text-emerald-500")}>
                                            ¥{stock.price.toFixed(2)} {isUp ? <ArrowUp size={24} className="stroke-[4px]" /> : <ArrowDown size={24} className="stroke-[4px]" />}
                                            <span className="text-lg ml-1">{pctStr}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* K-Line Chart */}
                                <div className="h-56 w-full border-2 border-slate-200 bg-slate-50 rounded-xl relative overflow-hidden shrink-0 p-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barCategoryGap={2} barGap={0}>
                                            <XAxis dataKey="time" hide />
                                            <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length && payload[0].payload.open !== undefined) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-white p-2 border-2 border-slate-200 rounded shadow-sm text-xs font-bold z-50">
                                                                <div className={data.isUp ? "text-red-500" : "text-emerald-500"}>
                                                                    开: {data.open.toFixed(2)} 收: {data.close.toFixed(2)}
                                                                </div>
                                                                <div className="text-slate-500 mt-1">
                                                                    高: {data.high.toFixed(2)} 低: {data.low.toFixed(2)}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="lowHigh" shape={<CandlestickShape />} isAnimationActive={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Order Book */}
                                <div className="flex-1 relative bg-slate-50 p-3 rounded-xl border-2 border-slate-200 overflow-hidden font-mono flex flex-col min-h-[140px]">
                                    <div className="text-slate-400 mb-1 text-center font-black tracking-widest uppercase text-xs">买卖五档盘口</div>
                                    {isDarkPhase ? (
                                        <div className="absolute inset-0 bg-slate-800/90 backdrop-blur-sm flex items-center justify-center z-20 rounded-xl m-0.5">
                                            <div className="absolute inset-0 game-board-pattern opacity-10"></div>
                                            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-fuchsia-400 font-black flex flex-col items-center">
                                                <span className="text-3xl">🤵</span>
                                                <span className="text-sm mt-2">暗盘竞价中...</span>
                                            </motion.div>
                                        </div>
                                    ) : null}
                                    <div className="flex-1 flex flex-col justify-between text-xs py-1">
                                        <div className="space-y-0.5">
                                            {sellLevels.reverse().map((l, i) => (
                                                <div key={`s-${i}`} className="flex justify-between items-center text-emerald-700 h-4 relative">
                                                    <div className="absolute right-0 top-0 h-full bg-emerald-200 opacity-20" style={{ width: `${Math.min(100, (l.qty / 50) * 100)}%` }}></div>
                                                    <span className="z-10 bg-white/50 px-1 rounded font-bold">卖{5 - i} {l.price.toFixed(2)}</span>
                                                    <span className="z-10 min-w-8 text-right px-1 font-bold">{l.qty}</span>
                                                </div>
                                            ))}
                                            {sellLevels.length === 0 && <div className="text-center text-slate-300 text-xs italic py-1">无卖单</div>}
                                        </div>
                                        <div className="h-[2px] bg-slate-200 my-1 w-full flex-shrink-0"></div>
                                        <div className="space-y-0.5">
                                            {buyLevels.map((l, i) => (
                                                <div key={`b-${i}`} className="flex justify-between items-center text-red-700 h-4 relative">
                                                    <div className="absolute left-0 top-0 h-full bg-red-200 opacity-20" style={{ width: `${Math.min(100, (l.qty / 50) * 100)}%` }}></div>
                                                    <span className="z-10 bg-white/50 px-1 rounded font-bold">买{i + 1} {l.price.toFixed(2)}</span>
                                                    <span className="z-10 min-w-8 text-right px-1 font-bold">{l.qty}</span>
                                                </div>
                                            ))}
                                            {buyLevels.length === 0 && <div className="text-center text-slate-300 text-xs italic py-1">无买单</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Trading Form */}
                            <div className="w-[320px] flex flex-col pt-2 shrink-0">
                                <div className="flex gap-2 mb-6">
                                    <button
                                        onClick={() => setTradeType('buy')}
                                        className={cn("flex-1 py-3 rounded-xl font-black text-lg transition-all border-b-4", tradeType === 'buy' ? "bg-red-500 text-white border-red-700 shadow-[0_4px_0_theme(colors.red.800)]" : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-red-50 hover:text-red-400")}
                                    >买入</button>
                                    <button
                                        onClick={() => setTradeType('sell')}
                                        className={cn("flex-1 py-3 rounded-xl font-black text-lg transition-all border-b-4", tradeType === 'sell' ? "bg-emerald-500 text-white border-emerald-700 shadow-[0_4px_0_theme(colors.emerald.800)]" : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-emerald-50 hover:text-emerald-400")}
                                    >卖出</button>
                                </div>

                                <div className="space-y-6 flex-1 flex flex-col">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 block ml-1 uppercase">委托价格 (¥)</label>
                                        <input
                                            type="number"
                                            value={priceInput}
                                            onChange={e => setPriceInput(e.target.value)}
                                            disabled={!canTrade}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-4 text-2xl font-black text-slate-800 outline-none focus:border-blue-400 transition-colors disabled:opacity-50"
                                        />
                                        <div className="flex justify-between px-1">
                                            <button onClick={() => setPriceInput(stock.price.toString())} disabled={!canTrade} className="text-xs font-bold text-blue-500 hover:underline disabled:opacity-50">填入市价: ¥{stock.price}</button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 block ml-1 uppercase">委托数量 (股)</label>
                                        <input
                                            type="number"
                                            value={qtyInput}
                                            onChange={e => setQtyInput(e.target.value)}
                                            disabled={!canTrade}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-4 text-2xl font-black text-slate-800 outline-none focus:border-blue-400 transition-colors disabled:opacity-50"
                                        />
                                        <div className="flex gap-2">
                                            {[1, 5, 10, 20].map(n => (
                                                <button key={n} onClick={() => setQtyInput(n.toString())} disabled={!canTrade} className="flex-1 py-2 rounded-lg border-2 border-slate-200 text-xs font-black hover:bg-slate-200 transition-colors disabled:opacity-50">{n}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-auto">
                                        <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 flex justify-between items-center mb-4">
                                            <span className="text-sm font-bold text-slate-400">总计金额:</span>
                                            <span className="text-2xl font-black text-slate-800">¥{(parseFloat(priceInput || '0') * parseInt(qtyInput || '0')).toFixed(2)}</span>
                                        </div>

                                        <motion.button
                                            whileHover={canTrade ? { scale: 1.02 } : {}}
                                            whileTap={canTrade ? { scale: 0.98 } : {}}
                                            onClick={handleExecuteTrade}
                                            disabled={!canTrade}
                                            className={cn(
                                                "w-full py-4 rounded-2xl font-black text-xl text-white shadow-lg transition-all border-b-4",
                                                !canTrade ? "bg-slate-300 border-slate-400 shadow-none cursor-not-allowed" :
                                                    tradeType === 'buy' ? 'bg-red-500 border-red-700 shadow-[0_4px_0_theme(colors.red.800)] active:shadow-none active:translate-y-[4px]' : 'bg-emerald-500 border-emerald-700 shadow-[0_4px_0_theme(colors.emerald.800)] active:shadow-none active:translate-y-[4px]'
                                            )}
                                        >
                                            {!isDarkPhase ? '非交易时间' : myUnplugged ? '拔网线中' : me.isReady ? '已结束回合' : '确认交易'}
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
