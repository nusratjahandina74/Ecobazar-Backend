const Coupon = require('../models/couponModel');
const Order = require('../models/orderModel');

const httpError = (status, message) => Object.assign(new Error(message), { status, expose: true });
const money = (n) => `৳${Math.round(n)}`;

/** Validate a coupon code for this customer + cart subtotal. Returns { coupon, discount, freeDelivery }. */
const evaluateCoupon = async ({ code, userId, subtotal, now = new Date() }) => {
    const c = String(code || '').trim().toUpperCase();
    if (!c) throw httpError(400, 'Enter a coupon code');
    const coupon = await Coupon.findOne({ code: c });
    if (!coupon || !coupon.isActive) throw httpError(400, 'This coupon code is not valid');
    if (coupon.startsAt && now < coupon.startsAt) throw httpError(400, 'This coupon is not active yet');
    if (coupon.expiresAt && now > coupon.expiresAt) throw httpError(400, 'This coupon has expired');
    if (coupon.minOrder > 0 && subtotal < coupon.minOrder) throw httpError(400, `Add ${money(coupon.minOrder - subtotal)} more to use this coupon (minimum order ${money(coupon.minOrder)})`);
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) throw httpError(400, 'This coupon has been fully redeemed');
    if (coupon.perUserLimit > 0 && userId) {
        const used = await Order.countDocuments({ user: userId, couponId: coupon._id, orderStatus: { $ne: 'Cancelled' } });
        if (used >= coupon.perUserLimit) throw httpError(400, 'You have already used this coupon');
    }
    let discount = 0;
    if (coupon.type === 'percent') {
        discount = Math.floor((subtotal * coupon.value) / 100);
        if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
    } else if (coupon.type === 'fixed') discount = Math.min(coupon.value, subtotal);
    return { coupon, discount, freeDelivery: coupon.type === 'free_delivery' };
};

/** Atomically count one redemption (respects the total usage limit under concurrency). */
const redeemCoupon = async (coupon) => {
    const filter = coupon.usageLimit > 0 ? { _id: coupon._id, usedCount: { $lt: coupon.usageLimit } } : { _id: coupon._id };
    const r = await Coupon.updateOne(filter, { $inc: { usedCount: 1 } });
    if (r.modifiedCount !== 1) throw httpError(400, 'This coupon has been fully redeemed');
};
const releaseCoupon = (couponId) => Coupon.updateOne({ _id: couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });

module.exports = { evaluateCoupon, redeemCoupon, releaseCoupon };
