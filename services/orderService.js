const mongoose = require('mongoose');
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const Counter = require('../models/counterModel');
const { getSettings, computeDelivery } = require('./settingsService');
const { evaluateCoupon, redeemCoupon, releaseCoupon } = require('./couponService');

const effectivePrice = (p) => (p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p.price);
const httpError = (status, message) => Object.assign(new Error(message), { status, expose: true });

const nextOrderNumber = async () => `EB-${String(await Counter.next('order')).padStart(6, '0')}`;

/** Atomically take `qty` units from stock. Returns false when there is not enough. */
const takeStock = async (line) => {
    if (line.variantId) {
        const r = await Product.updateOne(
            { _id: line.productId, variants: { $elemMatch: { _id: line.variantId, stock: { $gte: line.quantity } } } },
            { $inc: { 'variants.$.stock': -line.quantity, stock: -line.quantity, soldCount: line.quantity } });
        return r.modifiedCount === 1;
    }
    const r = await Product.updateOne({ _id: line.productId, stock: { $gte: line.quantity } }, { $inc: { stock: -line.quantity, soldCount: line.quantity } });
    return r.modifiedCount === 1;
};
const giveStock = async (line) => {
    if (line.variantId) {
        return Product.updateOne({ _id: line.productId, 'variants._id': line.variantId },
            { $inc: { 'variants.$.stock': line.quantity, stock: line.quantity, soldCount: -line.quantity } });
    }
    return Product.updateOne({ _id: line.productId }, { $inc: { stock: line.quantity, soldCount: -line.quantity } });
};

const reserveStock = async (lines) => {
    const done = [];
    for (const line of lines) {
        if (await takeStock(line)) done.push(line);
        else {
            await Promise.all(done.map(giveStock)); // roll back what we already took
            throw httpError(400, `"${line.title}${line.variantLabel ? ` (${line.variantLabel})` : ''}" is out of stock or has fewer units than requested. Please update your cart.`);
        }
    }
};

/** Give stock back exactly once per order (guarded by the stockRestored flag). */
const restoreOrderStock = async (orderId) => {
    const order = await Order.findOneAndUpdate({ _id: orderId, stockRestored: false }, { $set: { stockRestored: true } }, { returnDocument: 'after' });
    if (!order) return false;
    await Promise.all(order.products.map((l) => giveStock({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })));
    if (order.couponId) await releaseCoupon(order.couponId);
    return true;
};

/** Validate the user's cart against *current* DB prices/stock and build the order lines. */
const buildLinesFromCart = async (userId) => {
    const cart = await Cart.find({ user: userId }).populate('product');
    const lines = [];
    for (const item of cart) {
        const p = item.product;
        if (!p || p.status !== 'active') continue;
        let price = effectivePrice(p); let variantLabel; let sku = p.sku;
        if (item.variantId) {
            const v = p.variants.id(item.variantId);
            if (!v || v.isActive === false) throw httpError(400, `A variant of "${p.title}" is no longer available. Please update your cart.`);
            price = effectivePrice({ price: v.price ?? p.price, discountPrice: v.discountPrice });
            variantLabel = v.label; sku = v.sku || p.sku;
            if (item.quantity > v.stock) throw httpError(400, `"${p.title} (${v.label})" has only ${v.stock} left in stock. Please update your cart.`);
        } else {
            if (p.variants && p.variants.some((v) => v.isActive !== false)) throw httpError(400, `Please choose a variant for "${p.title}" in your cart.`);
            if (item.quantity > p.stock) throw httpError(400, `"${p.title}" has only ${p.stock} left in stock. Please update your cart.`);
        }
        const main = (p.images || []).find((i) => i.isMain) || (p.images || [])[0];
        lines.push({ productId: p._id, variantId: item.variantId || undefined, variantLabel, title: p.title, sku, image: main && main.url, price, quantity: item.quantity, totalPrice: price * item.quantity });
    }
    if (!lines.length) throw httpError(400, 'Cart is empty');
    return lines;
};

/**
 * Create an order from the signed-in user's cart. The browser never sends prices:
 * subtotal + delivery charge are computed here from the database + dashboard settings.
 */
const createOrderFromCart = async ({ userId, shipping, paymentMethod, deliveryZone, couponCode }) => {
    const settings = await getSettings();
    if (paymentMethod === 'cod' && settings.delivery.codEnabled === false) throw httpError(400, 'Cash on delivery is currently unavailable.');
    if (paymentMethod === 'online' && settings.delivery.onlineEnabled === false) throw httpError(400, 'Online payment is currently unavailable.');

    const lines = await buildLinesFromCart(userId);
    const subtotal = lines.reduce((s, l) => s + l.totalPrice, 0);
    const coupon = couponCode ? await evaluateCoupon({ code: couponCode, userId, subtotal }) : null;
    const delivery = computeDelivery(settings, deliveryZone, subtotal);
    const deliveryCharge = coupon && coupon.freeDelivery ? 0 : delivery.charge;
    const discount = coupon ? coupon.discount : 0;
    await reserveStock(lines);
    let redeemed = false;
    try {
        if (coupon) { await redeemCoupon(coupon.coupon); redeemed = true; }
        const order = await Order.create({
            orderNumber: await nextOrderNumber(),
            user: userId, products: lines, subtotal, discountAmount: discount, couponCode: coupon ? coupon.coupon.code : undefined, couponId: coupon ? coupon.coupon._id : undefined,
            deliveryCharge, deliveryZone: delivery.zone,
            totalAmount: subtotal - discount + deliveryCharge, paymentMethod,
            transactionId: `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
            paymentStatus: 'Pending', orderStatus: 'Order Placed', shippingAddress: shipping,
            statusHistory: [{ status: 'Order Placed', note: paymentMethod === 'cod' ? 'Cash on delivery order placed' : 'Awaiting online payment' }],
        });
        if (paymentMethod === 'cod') await Cart.deleteMany({ user: userId });
        return order;
    } catch (e) {
        await Promise.all(lines.map(giveStock));
        if (redeemed) await releaseCoupon(coupon.coupon._id);
        throw e;
    }
};

/** Cart total preview for the checkout page (coupon + delivery), all computed server-side. */
const previewCart = async ({ userId, deliveryZone, couponCode }) => {
    const settings = await getSettings();
    const lines = await buildLinesFromCart(userId);
    const subtotal = lines.reduce((s, l) => s + l.totalPrice, 0);
    let discount = 0; let freeDelivery = false; let code = null;
    if (couponCode) { const c = await evaluateCoupon({ code: couponCode, userId, subtotal }); discount = c.discount; freeDelivery = c.freeDelivery; code = c.coupon.code; }
    const delivery = computeDelivery(settings, deliveryZone, subtotal);
    const deliveryCharge = freeDelivery ? 0 : delivery.charge;
    return { subtotal, discount, couponCode: code, deliveryCharge, freeReason: freeDelivery ? 'coupon' : delivery.freeReason, total: subtotal - discount + deliveryCharge };
};

// ---- status machine -------------------------------------------------------------------------
const FLOW = ['Order Placed', 'Processing', 'Shipped', 'Delivered'];
const canTransition = (from, to) => {
    if (from === to) return false;
    if (from === 'Delivered' || from === 'Cancelled') return false;
    if (to === 'Cancelled') return true;
    return FLOW.indexOf(to) > FLOW.indexOf(from);   // forward only
};

/** Apply a status change (+ side effects). Throws on illegal transitions. */
const applyStatus = async (order, to, { by, note } = {}) => {
    if (!canTransition(order.orderStatus, to)) throw httpError(409, `Cannot move order ${order.orderNumber || order._id} from "${order.orderStatus}" to "${to}"`);
    order.orderStatus = to;
    if (to === 'Delivered' && order.paymentMethod === 'cod' && order.paymentStatus === 'Pending') order.paymentStatus = 'Paid';
    if (to === 'Cancelled') {
        if (order.paymentStatus === 'Pending') order.paymentStatus = 'Cancelled';
        else if (order.paymentStatus === 'Paid') order.internalNote = `${order.internalNote ? order.internalNote + '\n' : ''}Cancelled after payment - refund needed.`;
    }
    order.statusHistory.push({ status: to, note, by });
    await order.save();
    if (to === 'Cancelled') await restoreOrderStock(order._id);
    return order;
};

/** Cancel unpaid online orders that sat in "Pending" for too long so reserved stock is released. */
const expireStaleOnlineOrders = async (minutes = 45) => {
    const cutoff = new Date(Date.now() - minutes * 60000);
    const stale = await Order.find({ paymentMethod: 'online', paymentStatus: 'Pending', orderStatus: 'Order Placed', createdAt: { $lt: cutoff } }).select('_id').limit(200).lean();
    for (const o of stale) {
        const upd = await Order.updateOne({ _id: o._id, paymentStatus: 'Pending' },
            { $set: { paymentStatus: 'Cancelled', orderStatus: 'Cancelled' }, $push: { statusHistory: { status: 'Cancelled', note: 'Payment not completed in time' } } });
        if (upd.modifiedCount) await restoreOrderStock(o._id);
    }
    return stale.length;
};

module.exports = { createOrderFromCart, previewCart, reserveStock, restoreOrderStock, canTransition, applyStatus, expireStaleOnlineOrders, httpError, effectivePrice, FLOW };
