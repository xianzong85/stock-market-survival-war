export type StockCategory = 'tech' | 'ev' | 'consumer' | 'finance' | 'pharma' | 'st';

export interface StockConfig {
    id: string;
    name: string;
    category: StockCategory;
    basePrice: number;
    volatility: number;
}

export const STOCK_POOL: StockConfig[] = [
    // --- 科技板块 (tech) ---
    { id: 't_ppt', name: 'PPT造车', category: 'tech', basePrice: 15.00, volatility: 2.5 },
    { id: 't_ai_pig', name: 'AI养猪', category: 'tech', basePrice: 8.50, volatility: 1.8 },
    { id: 't_meta_bbq', name: '元宇宙烧烤', category: 'tech', basePrice: 12.00, volatility: 3.0 },
    { id: 't_quantum', name: '量子拔罐', category: 'tech', basePrice: 22.50, volatility: 2.8 },
    { id: 't_chip', name: '国产牛皮硅', category: 'tech', basePrice: 35.00, volatility: 2.2 },
    { id: 't_compute', name: '算力大妖', category: 'tech', basePrice: 42.00, volatility: 3.5 },
    { id: 't_vr', name: 'VR画大饼', category: 'tech', basePrice: 6.80, volatility: 1.5 },
    { id: 't_blockchain', name: '区块链养鸡', category: 'tech', basePrice: 18.20, volatility: 2.6 },
    { id: 't_robot', name: '铁皮人智能', category: 'tech', basePrice: 28.00, volatility: 2.1 },
    { id: 't_cloud', name: '云端跑路', category: 'tech', basePrice: 5.50, volatility: 1.2 },
    { id: 't_cyborg', name: '全息投影龙', category: 'tech', basePrice: 19.90, volatility: 2.4 },
    { id: 't_5g', name: '5G挖矿', category: 'tech', basePrice: 14.30, volatility: 1.9 },
    { id: 't_crypto', name: '空气币概念', category: 'tech', basePrice: 9.90, volatility: 4.0 },
    { id: 't_drone', name: '送外卖无人机', category: 'tech', basePrice: 31.00, volatility: 1.7 },
    { id: 't_low_orbit', name: '低轨放卫星', category: 'tech', basePrice: 25.50, volatility: 2.9 },

    // --- 新能源 (ev) ---
    { id: 'e_solid', name: '固态电池饼', category: 'ev', basePrice: 45.00, volatility: 2.5 },
    { id: 'e_hydrogen', name: '水变氢动力', category: 'ev', basePrice: 11.20, volatility: 3.2 },
    { id: 'e_wind', name: '西北风电王', category: 'ev', basePrice: 8.80, volatility: 1.4 },
    { id: 'e_solar', name: '光伏内卷王', category: 'ev', basePrice: 13.50, volatility: 1.8 },
    { id: 'e_lithium', name: '家里有锂矿', category: 'ev', basePrice: 58.00, volatility: 2.7 },
    { id: 'e_charging', name: '充电桩刺客', category: 'ev', basePrice: 16.60, volatility: 1.6 },
    { id: 'e_recycling', name: '废电池炼金', category: 'ev', basePrice: 20.00, volatility: 2.0 },
    { id: 'e_sodium', name: '钠离子传说', category: 'ev', basePrice: 27.30, volatility: 2.3 },
    { id: 'e_flying', name: '飞行汽车', category: 'ev', basePrice: 33.30, volatility: 3.8 },
    { id: 'e_grid', name: '特高压电驴', category: 'ev', basePrice: 19.50, volatility: 1.5 },
    { id: 'e_green', name: '绿电割韭菜', category: 'ev', basePrice: 7.70, volatility: 1.3 },
    { id: 'e_carbon', name: '碳排放空气', category: 'ev', basePrice: 12.80, volatility: 1.9 },

    // --- 大消费 (consumer) ---
    { id: 'c_sauce', name: '酱香科技', category: 'consumer', basePrice: 188.00, volatility: 1.5 },
    { id: 'c_premade', name: '僵尸肉预制菜', category: 'consumer', basePrice: 6.60, volatility: 1.8 },
    { id: 'c_blindbox', name: '割韭菜盲盒', category: 'consumer', basePrice: 48.00, volatility: 2.8 },
    { id: 'c_milktea', name: '植脂末奶茶', category: 'consumer', basePrice: 22.00, volatility: 1.7 },
    { id: 'c_live', name: '直播家人们', category: 'consumer', basePrice: 15.50, volatility: 3.1 },
    { id: 'c_beauty', name: '医美毁容针', category: 'consumer', basePrice: 99.00, volatility: 2.6 },
    { id: 'c_sports', name: '国潮大扑蛾', category: 'consumer', basePrice: 34.20, volatility: 1.6 },
    { id: 'c_pet', name: '主子猫粮坊', category: 'consumer', basePrice: 26.80, volatility: 1.9 },
    { id: 'c_camping', name: '露营破帐篷', category: 'consumer', basePrice: 10.50, volatility: 2.2 },
    { id: 'c_dutyfree', name: '免税代购村', category: 'consumer', basePrice: 65.00, volatility: 2.0 },
    { id: 'c_movie', name: '烂片制造机', category: 'consumer', basePrice: 8.80, volatility: 2.5 },
    { id: 'c_hotel', name: '快捷黑店', category: 'consumer', basePrice: 12.30, volatility: 1.4 },
    { id: 'c_spicy', name: '卫龙辣条股', category: 'consumer', basePrice: 5.50, volatility: 1.1 },
    { id: 'c_gold', name: '假黄金大妈', category: 'consumer', basePrice: 108.00, volatility: 1.8 },
    { id: 'c_beer', name: '工业水啤', category: 'consumer', basePrice: 18.60, volatility: 1.3 },

    // --- 金融 (finance) ---
    { id: 'f_broker', name: '牛市旗手渣男', category: 'finance', basePrice: 14.50, volatility: 2.2 },
    { id: 'f_bank', name: '宇宙第一大行', category: 'finance', basePrice: 5.20, volatility: 0.5 },
    { id: 'f_debt', name: '催收概念股', category: 'finance', basePrice: 8.90, volatility: 1.8 },
    { id: 'f_insurance', name: '拒赔险企', category: 'finance', basePrice: 38.00, volatility: 1.2 },
    { id: 'f_trust', name: '暴雷信托', category: 'finance', basePrice: 3.50, volatility: 3.5 },
    { id: 'f_p2p', name: 'P2P老赖', category: 'finance', basePrice: 2.80, volatility: 4.0 },
    { id: 'f_fund', name: '绿油油基金', category: 'finance', basePrice: 1.50, volatility: 1.5 },
    { id: 'f_leasing', name: '高利贷金服', category: 'finance', basePrice: 22.00, volatility: 2.6 },
    { id: 'f_asset', name: '不良资产包', category: 'finance', basePrice: 6.60, volatility: 2.1 },
    { id: 'f_fintech', name: '金融壳公司', category: 'finance', basePrice: 11.10, volatility: 2.9 },
    { id: 'f_gold_exchange', name: '纸黄金交易所', category: 'finance', basePrice: 15.80, volatility: 1.9 },

    // --- 医药创新 (pharma) ---
    { id: 'p_antiaging', name: '长生不老药', category: 'pharma', basePrice: 88.00, volatility: 3.2 },
    { id: 'p_hair', name: '植发第一股', category: 'pharma', basePrice: 35.50, volatility: 2.1 },
    { id: 'p_diet', name: '减肥神药王', category: 'pharma', basePrice: 120.00, volatility: 3.8 },
    { id: 'p_covid', name: '核酸老龙头', category: 'pharma', basePrice: 4.50, volatility: 1.8 },
    { id: 'p_tcm', name: '祖传老中医', category: 'pharma', basePrice: 45.60, volatility: 1.4 },
    { id: 'p_tooth', name: '天价种牙', category: 'pharma', basePrice: 55.00, volatility: 1.9 },
    { id: 'p_eye', name: '近视眼瞎搞', category: 'pharma', basePrice: 66.60, volatility: 1.6 },
    { id: 'p_cxo', name: 'CXO代工', category: 'pharma', basePrice: 28.90, volatility: 2.4 },
    { id: 'p_biotech', name: '烧钱抗癌药', category: 'pharma', basePrice: 18.50, volatility: 3.5 },
    { id: 'p_vaccine', name: '假疫苗风波', category: 'pharma', basePrice: 9.90, volatility: 2.8 },
    { id: 'p_medical_device', name: '集采医疗器械', category: 'pharma', basePrice: 24.00, volatility: 2.2 },

    // --- 神奇动物 / ST 妖股 (st) ---
    { id: 's_scallop', name: '扇贝度假去了', category: 'st', basePrice: 3.80, volatility: 4.5 },
    { id: 's_pork', name: '饿死猪业', category: 'st', basePrice: 5.50, volatility: 3.6 },
    { id: 's_fake_acc', name: '财务造假狂', category: 'st', basePrice: 1.20, volatility: 5.0 },
    { id: 's_suspend', name: '万年停牌王', category: 'st', basePrice: 8.80, volatility: 2.0 },
    { id: 's_restructure', name: '卖壳重组队', category: 'st', basePrice: 4.50, volatility: 4.8 },
    { id: 's_delist', name: '退市边缘', category: 'st', basePrice: 0.88, volatility: 6.0 },
    { id: 's_crossover', name: '水泥跨界AI', category: 'st', basePrice: 11.10, volatility: 4.2 },
    { id: 's_boss_run', name: '董事长跑路', category: 'st', basePrice: 2.20, volatility: 4.5 },
    { id: 's_divorce', name: '天价离婚案', category: 'st', basePrice: 18.00, volatility: 3.3 },
    { id: 's_family', name: '夺权父子兵', category: 'st', basePrice: 7.70, volatility: 3.9 },
    { id: 's_lawsuit', name: '官司缠身', category: 'st', basePrice: 3.30, volatility: 3.1 },
    // ... (To 100 stocks as needed, keeping it around 60 is plenty for 9 random pulls every game)
];

// Helper to get exactly 9 random stocks
export function getRandomStocks(count: number = 9): StockConfig[] {
    const shuffled = [...STOCK_POOL].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
