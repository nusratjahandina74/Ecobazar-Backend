const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const { bdStartOfDay, bdStartOfMonth, addDays, bdDateKey, BD_OFFSET_MS, memo } = require('../utils/helpers');
const { getSettings } = require('./settingsService');

// "Real" sales: not cancelled, and either cash-on-delivery or already paid online.
const REVENUE = { orderStatus: { $ne: 'Cancelled' }, $or: [{ paymentMethod: 'cod' }, { paymentStatus: 'Paid' }] };
const TZ = 'Asia/Dhaka';

const rangeFor = (range, from, to) => {
    const now = new Date(); const today = bdStartOfDay(now); const tomorrow = addDays(today, 1);
    switch (range) {
        case 'today': return { from: today, to: tomorrow };
        case 'yesterday': return { from: addDays(today, -1), to: today };
        case '7d': return { from: addDays(today, -6), to: tomorrow };
        case 'month': return { from: bdStartOfMonth(now), to: tomorrow };
        case 'custom': {
            const f = from ? bdStartOfDay(new Date(from)) : addDays(today, -29);
            const t = to ? addDays(bdStartOfDay(new Date(to)), 1) : tomorrow;
            return { from: f, to: t };
        }
        case '30d': default: return { from: addDays(today, -29), to: tomorrow };
    }
};

const sumBlock = (rows) => {
    const r = rows[0] || {};
    return { revenue: r.revenue || 0, orders: r.orders || 0, deliveryCharges: r.delivery || 0, itemsSold: r.items || 0 };
};
const totalsPipeline = () => ([
    { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }, delivery: { $sum: '$deliveryCharge' }, items: { $sum: { $sum: '$products.quantity' } } } },
]);

const overview = ({ range = '30d', from, to } = {}) => memo(`overview:${range}:${from}:${to}`, 15000, async () => {
    const r = rangeFor(range, from, to);
    const span = r.to - r.from; const prev = { from: new Date(r.from - span), to: r.from };
    const today = bdStartOfDay(); const yesterday = addDays(today, -1);
    const settings = await getSettings();
    const lowThreshold = (settings.inventory && settings.inventory.lowStockThreshold) ?? 5;

    const inRange = (a, b) => ({ ...REVENUE, createdAt: { $gte: a, $lt: b } });
    const [curRows, prevRows, splitRows, cancelledN, todayRows, yRows, statusRows, lowStock, outStock, customers, newCustomers, pendingOnline] = await Promise.all([
        Order.aggregate([{ $match: inRange(r.from, r.to) }, ...totalsPipeline()]),
        Order.aggregate([{ $match: inRange(prev.from, prev.to) }, ...totalsPipeline()]),
        Order.aggregate([{ $match: inRange(r.from, r.to) }, { $group: { _id: '$paymentMethod', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }]),
        Order.countDocuments({ orderStatus: 'Cancelled', createdAt: { $gte: r.from, $lt: r.to } }),
        Order.aggregate([{ $match: { ...REVENUE, createdAt: { $gte: today } } }, ...totalsPipeline()]),
        Order.aggregate([{ $match: inRange(yesterday, today) }, ...totalsPipeline()]),
        Order.aggregate([{ $match: { createdAt: { $gte: r.from, $lt: r.to } } }, { $group: { _id: '$orderStatus', n: { $sum: 1 } } }]),
        Product.countDocuments({ status: 'active', stock: { $gt: 0, $lte: lowThreshold } }),
        Product.countDocuments({ status: 'active', stock: { $lte: 0 } }),
        User.countDocuments({ role: 'user' }),
        User.countDocuments({ role: 'user', createdAt: { $gte: today } }),
        Order.countDocuments({ paymentMethod: 'online', paymentStatus: 'Pending', createdAt: { $gte: addDays(today, -2) } }),
    ]);
    const cur = sumBlock(curRows); const prv = sumBlock(prevRows);
    const split = { cod: { revenue: 0, orders: 0 }, online: { revenue: 0, orders: 0 } };
    splitRows.forEach((s) => { split[s._id] = { revenue: s.revenue, orders: s.orders }; });
    const statusCounts = { 'Order Placed': 0, Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
    statusRows.forEach((s) => { statusCounts[s._id] = s.n; });
    const pct = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : (a ? 100 : 0));
    return {
        range: { key: range, from: r.from, to: r.to },
        totalRevenue: cur.revenue, totalOrders: cur.orders,
        avgOrderValue: cur.orders ? Math.round(cur.revenue / cur.orders) : 0,
        itemsSold: cur.itemsSold, deliveryCharges: cur.deliveryCharges,
        revenueChange: pct(cur.revenue, prv.revenue), ordersChange: pct(cur.orders, prv.orders),
        today: { sales: sumBlock(todayRows).revenue, orders: sumBlock(todayRows).orders, yesterdaySales: sumBlock(yRows).revenue, change: pct(sumBlock(todayRows).revenue, sumBlock(yRows).revenue) },
        paymentSplit: split,
        statusCounts, cancelledOrders: cancelledN,
        inventory: { lowStock, outOfStock: outStock, lowStockThreshold: lowThreshold },
        customers: { total: customers, newToday: newCustomers },
        awaitingOnlinePayment: pendingOnline,
    };
});

const monthKeys = (n) => {
    const keys = []; let d = bdStartOfMonth();
    for (let i = 0; i < n; i++) { keys.unshift(bdDateKey(new Date(d.getTime() + 2 * 86400000)).slice(0, 7)); d = bdStartOfMonth(addDays(d, -1)); }
    return keys;
};

const salesSeries = ({ view = 'daily', days = 30, months = 12, from, to } = {}) => memo(`series:${view}:${days}:${months}:${from}:${to}`, 15000, async () => {
    const monthly = view === 'monthly';
    let start; let end;
    if (monthly) { const keys = monthKeys(months); const [y, m] = keys[0].split('-').map(Number); start = new Date(Date.UTC(y, m - 1, 1) - BD_OFFSET_MS); end = addDays(bdStartOfDay(), 1); }
    else if (from || to) { const r = rangeFor('custom', from, to); start = r.from; end = r.to; }
    else { end = addDays(bdStartOfDay(), 1); start = addDays(end, -Math.min(Math.max(Number(days) || 30, 1), 366)); }
    const rows = await Order.aggregate([
        { $match: { ...REVENUE, createdAt: { $gte: start, $lt: end } } },
        { $group: {
            _id: { $dateToString: { format: monthly ? '%Y-%m' : '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
            revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 },
            cod: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'cod'] }, '$totalAmount', 0] } },
            online: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'online'] }, '$totalAmount', 0] } },
        } },
    ]);
    const map = new Map(rows.map((r) => [r._id, r]));
    const keys = [];
    if (monthly) keys.push(...monthKeys(months));
    else for (let d = start; d < end; d = addDays(d, 1)) keys.push(bdDateKey(new Date(d.getTime() + 3600000)));
    return keys.map((k) => { const r = map.get(k) || {}; return { date: k, revenue: r.revenue || 0, orders: r.orders || 0, cod: r.cod || 0, online: r.online || 0 }; });
});

const topProducts = ({ range = '30d', limit = 8 } = {}) => memo(`top:${range}:${limit}`, 30000, async () => {
    const r = rangeFor(range);
    return Order.aggregate([
        { $match: { ...REVENUE, createdAt: { $gte: r.from, $lt: r.to } } },
        { $unwind: '$products' },
        { $group: { _id: '$products.productId', title: { $first: '$products.title' }, image: { $first: '$products.image' }, quantity: { $sum: '$products.quantity' }, revenue: { $sum: '$products.totalPrice' } } },
        { $sort: { revenue: -1 } }, { $limit: Math.min(Number(limit) || 8, 20) },
    ]);
});

module.exports = { overview, salesSeries, topProducts, REVENUE, rangeFor };
