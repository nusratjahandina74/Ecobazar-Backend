// Public + customer APIs for the shop: categories, CMS pages, reviews, newsletter, order tracking, coupon preview.
const Category = require('../models/categoryModel');
const Page = require('../models/pageModel');
const Review = require('../models/reviewModel');
const Subscriber = require('../models/subscriberModel');
const Product = require('../models/productModel');
const Order = require('../models/orderModel');
const User = require('../models/userModel');
const { getSettings } = require('../services/settingsService');
const { previewCart } = require('../services/orderService');
const { recalcRating } = require('../services/reviewService');
const { ensureDefaultPages } = require('../services/pageService');
const { cleanText } = require('../utils/sanitize');
const { isId, parsePagination, pageMeta, memo, memoClear } = require('../utils/helpers');
const sendError = require('../utils/sendError');

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const h = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { sendError(res, e); } };

// ---- categories (only the ones the shop owner switched on)
const publicCategories = h(async (req, res) => {
    const data = await memo('public-categories', 60000, async () => {
        const cats = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
        const counts = await Promise.all(cats.map((c) => Product.countDocuments({ status: 'active', category: c.name })));
        return cats.map((c, i) => ({ _id: c._id, name: c.name, slug: c.slug, image: c.image, description: c.description, showOnHome: c.showOnHome, productCount: counts[i] }));
    });
    res.set('Cache-Control', 'public, max-age=30'); res.json({ success: true, data });
});

// ---- CMS pages
const publicPages = h(async (req, res) => {
    const data = await memo('pages', 60000, async () => {
        await ensureDefaultPages();
        return Page.find({ isActive: true }).sort({ order: 1, title: 1 }).select('slug title showInFooter').lean();
    });
    res.set('Cache-Control', 'public, max-age=30'); res.json({ success: true, data });
});
const publicPage = h(async (req, res) => {
    await ensureDefaultPages();
    const p = await Page.findOne({ slug: String(req.params.slug).toLowerCase(), isActive: true }).select('slug title content updatedAt').lean();
    if (!p) return fail(res, 404, 'Page not found');
    res.json({ success: true, data: p });
});

// ---- newsletter
const subscribe = h(async (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 150) return fail(res, 400, 'Enter a valid email address');
    await Subscriber.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true }); // idempotent
    res.status(201).json({ success: true, message: 'Thanks for subscribing!' });
});

// ---- public order tracking (order number + phone)
const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
const trackOrder = h(async (req, res) => {
    const num = String((req.body || {}).orderNumber || '').trim().toUpperCase();
    const phone = digits((req.body || {}).phone);
    if (!num || phone.length < 10) return fail(res, 400, 'Enter your order number and the phone number used for the order');
    const o = await Order.findOne({ orderNumber: num }).lean();
    if (!o || digits(o.shippingAddress && o.shippingAddress.phone) !== phone) return fail(res, 404, 'We could not find an order with these details');
    res.json({ success: true, data: {
        orderNumber: o.orderNumber, status: o.orderStatus, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, createdAt: o.createdAt,
        subtotal: o.subtotal, discountAmount: o.discountAmount || 0, deliveryCharge: o.deliveryCharge, totalAmount: o.totalAmount,
        items: o.products.map((p) => ({ title: p.title, variantLabel: p.variantLabel, quantity: p.quantity, image: p.image })),
        courier: o.courier && o.courier.trackingCode ? { provider: o.courier.provider, trackingCode: o.courier.trackingCode } : null,
        history: (o.statusHistory || []).map((x) => ({ status: x.status, at: x.at })),
    } });
});

// ---- coupon / total preview for checkout
const cartPreview = h(async (req, res) => {
    try {
        const data = await previewCart({ userId: req.user.id, deliveryZone: req.body.deliveryZone, couponCode: req.body.couponCode });
        res.json({ success: true, data });
    } catch (e) { if (e.status) return fail(res, e.status, e.message); throw e; }
});

// ---- reviews
const summaryFor = async (productId) => {
    const rows = await Review.find({ product: productId, status: 'approved' }).select('rating').limit(10000).lean();
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; rows.forEach((r) => { dist[r.rating] += 1; });
    const count = rows.length; const avg = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return { average: avg, count, distribution: dist };
};
const listProductReviews = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid Product ID format');
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 30 });
    const filter = { product: req.params.id, status: 'approved' };
    const [data, total, summary] = await Promise.all([
        Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('userName rating title comment verified adminReply createdAt').lean(),
        Review.countDocuments(filter), summaryFor(req.params.id),
    ]);
    res.json({ success: true, data, summary, pagination: pageMeta(total, page, limit) });
});
const hasPurchased = (userId, productId) => Order.exists({ user: userId, orderStatus: 'Delivered', 'products.productId': productId });
const myReviewState = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid Product ID format');
    const s = await getSettings();
    if (s.reviews.enabled === false) return res.json({ success: true, data: { canReview: false, reason: 'Reviews are turned off' } });
    const [existing, bought] = await Promise.all([Review.findOne({ product: req.params.id, user: req.user.id }).select('rating title comment status').lean(), hasPurchased(req.user.id, req.params.id)]);
    const canReview = !s.reviews.requirePurchase || !!bought;
    res.json({ success: true, data: { canReview, reason: canReview ? null : 'Only customers who received this product can review it', existing } });
});
const createReview = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid Product ID format');
    const s = await getSettings();
    if (s.reviews.enabled === false) return fail(res, 403, 'Reviews are turned off');
    const rating = Math.floor(Number((req.body || {}).rating));
    if (!(rating >= 1 && rating <= 5)) return fail(res, 400, 'Choose a rating from 1 to 5 stars');
    const product = await Product.findById(req.params.id).select('_id').lean(); if (!product) return fail(res, 404, 'Product not found');
    const bought = !!(await hasPurchased(req.user.id, req.params.id));
    if (s.reviews.requirePurchase && !bought) return fail(res, 403, 'Only customers who received this product can review it');
    const user = await User.findById(req.user.id).select('firstName lastName email').lean();
    const name = cleanText([user && user.firstName, user && user.lastName && user.lastName[0] ? `${user.lastName[0]}.` : ''].filter(Boolean).join(' '), 80) || 'Customer';
    const status = s.reviews.autoApprove ? 'approved' : 'pending';
    const r = await Review.findOneAndUpdate({ product: req.params.id, user: req.user.id },
        { $set: { rating, title: cleanText(req.body.title, 100), comment: cleanText(req.body.comment, 1500), userName: name, verified: bought, status } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
    await recalcRating(req.params.id); memoClear('testimonials');
    res.status(201).json({ success: true, message: status === 'approved' ? 'Thanks for your review!' : 'Thanks! Your review will appear after approval.', data: { status: r.status } });
});
// Home page: best recent reviews
const testimonials = h(async (req, res) => {
    const data = await memo('testimonials', 120000, async () => {
        const rows = await Review.find({ status: 'approved', rating: { $gte: 4 }, comment: { $ne: '' } }).sort({ createdAt: -1 }).limit(6).populate('product', 'title').lean();
        return rows.map((r) => ({ _id: r._id, name: r.userName, rating: r.rating, comment: r.comment, verified: r.verified, product: r.product && r.product.title }));
    });
    res.set('Cache-Control', 'public, max-age=60'); res.json({ success: true, data });
});

module.exports = { publicCategories, publicPages, publicPage, subscribe, trackOrder, cartPreview, listProductReviews, myReviewState, createReview, testimonials };
