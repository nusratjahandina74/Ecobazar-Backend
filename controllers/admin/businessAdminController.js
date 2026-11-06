// Dashboard APIs for categories, coupons, reviews, CMS pages and newsletter subscribers.
const Category = require('../../models/categoryModel');
const Coupon = require('../../models/couponModel');
const Review = require('../../models/reviewModel');
const Page = require('../../models/pageModel');
const Subscriber = require('../../models/subscriberModel');
const Product = require('../../models/productModel');
const Order = require('../../models/orderModel');
const { cleanText, cleanHtml } = require('../../utils/sanitize');
const { removeImage, removeRequestFiles } = require('../../utils/storage');
const { escapeRegex, isId, parsePagination, pageMeta, num, bool, memoClear } = require('../../utils/helpers');
const { recalcRating } = require('../../services/reviewService');
const { ensureDefaultPages } = require('../../services/pageService');
const sendError = require('../../utils/sendError');
const audit = require('../../utils/audit');

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const h = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { sendError(res, e); } };
const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9ঀ-৿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// ---------------------------------------------------------------- categories
const listCategories = h(async (req, res) => {
    const cats = await Category.find({}).sort({ order: 1, name: 1 }).lean();
    const counts = await Promise.all(cats.map((c) => Product.countDocuments({ category: c.name })));
    const known = new Set(cats.map((c) => c.name));
    const used = (await Product.distinct('category')).filter((n) => n && !known.has(n));
    res.json({ success: true, data: cats.map((c, i) => ({ ...c, productCount: counts[i] })), unmanaged: used });
});
const catFields = (b) => ({
    name: cleanText(b.name, 80), description: cleanText(b.description, 300), order: Math.floor(num(b.order, 0)),
    isActive: b.isActive === undefined ? true : bool(b.isActive), showOnHome: b.showOnHome === undefined ? true : bool(b.showOnHome),
});
const createCategory = async (req, res) => {
    res.on('finish', () => { if (res.statusCode >= 400) removeRequestFiles(req); });
    try {
        const d = catFields(req.body || {}); if (!d.name) return fail(res, 400, 'Category name is required');
        if (await Category.exists({ name: d.name })) return fail(res, 409, 'A category with this name already exists');
        const f = req.files && req.files[0];
        const c = await Category.create({ ...d, slug: slugify(d.name), image: f ? f.url : '' });
        memoClear('public-categories'); audit(req, 'category.create', 'category', c._id, `Created category "${c.name}"`);
        res.status(201).json({ success: true, data: c });
    } catch (e) { sendError(res, e); }
};
const updateCategory = async (req, res) => {
    res.on('finish', () => { if (res.statusCode >= 400) removeRequestFiles(req); });
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
        const c = await Category.findById(req.params.id); if (!c) return fail(res, 404, 'Category not found');
        const d = catFields({ ...c.toObject(), ...req.body }); if (!d.name) return fail(res, 400, 'Category name is required');
        if (d.name !== c.name) {
            if (await Category.exists({ name: d.name, _id: { $ne: c._id } })) return fail(res, 409, 'A category with this name already exists');
            await Product.updateMany({ category: c.name }, { $set: { category: d.name } }); // keep products attached
            c.slug = slugify(d.name);
        }
        const f = req.files && req.files[0];
        if (f) { removeImage(c.image); c.image = f.url; } else if (req.body.removeImage === 'true') { removeImage(c.image); c.image = ''; }
        Object.assign(c, d); await c.save();
        memoClear('public-categories'); audit(req, 'category.update', 'category', c._id, `Updated category "${c.name}"`);
        res.json({ success: true, data: c });
    } catch (e) { sendError(res, e); }
};
const deleteCategory = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    const c = await Category.findById(req.params.id); if (!c) return fail(res, 404, 'Category not found');
    const n = await Product.countDocuments({ category: c.name });
    if (n > 0) return fail(res, 409, `${n} product(s) use this category. Move them to another category first, or just hide the category.`);
    removeImage(c.image); await c.deleteOne();
    memoClear('public-categories'); audit(req, 'category.delete', 'category', c._id, `Deleted category "${c.name}"`);
    res.json({ success: true });
});
// Turn the category names already typed on products into managed categories (one click for existing shops)
const importCategories = h(async (req, res) => {
    const names = (await Product.distinct('category')).filter(Boolean);
    let created = 0;
    for (const name of names) if (!(await Category.exists({ name }))) { await Category.create({ name, slug: slugify(name), order: 100 }); created++; }
    memoClear('public-categories'); audit(req, 'category.import', 'category', null, `Imported ${created} categories from products`);
    res.json({ success: true, message: created ? `${created} categories added` : 'All categories are already managed', created });
});

// ---------------------------------------------------------------- coupons
const couponFields = (b, { partial }) => {
    const d = {}; const errors = []; const has = (k) => b[k] !== undefined;
    if (has('code')) { const c = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''); if (c.length < 3) errors.push('Code must be at least 3 letters or numbers'); d.code = c.slice(0, 30); }
    if (has('description')) d.description = cleanText(b.description, 200);
    if (has('type')) { if (!['percent', 'fixed', 'free_delivery'].includes(b.type)) errors.push('Choose a discount type'); else d.type = b.type; }
    for (const k of ['value', 'maxDiscount', 'minOrder', 'usageLimit', 'perUserLimit']) if (has(k)) { const n = num(b[k], NaN); if (!(n >= 0)) errors.push(`${k} must be 0 or more`); else d[k] = Math.floor(n); }
    if (has('startsAt')) d.startsAt = b.startsAt ? new Date(b.startsAt) : null;
    if (has('expiresAt')) d.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
    if (has('isActive')) d.isActive = bool(b.isActive);
    if (!partial && !d.code) errors.push('Coupon code is required');
    if (!partial && !d.type) errors.push('Choose a discount type');
    if (d.type === 'percent' && !(d.value > 0 && d.value <= 100)) errors.push('Percent must be between 1 and 100');
    if (d.type === 'fixed' && !(d.value > 0)) errors.push('Discount amount must be more than 0');
    if (d.startsAt && d.expiresAt && d.expiresAt < d.startsAt) errors.push('Expiry must be after the start date');
    return { d, errors };
};
const listCoupons = h(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
    const filter = {};
    if (req.query.q) filter.code = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 30)), 'i');
    const now = new Date();
    if (req.query.state === 'active') Object.assign(filter, { isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] });
    if (req.query.state === 'expired') filter.expiresAt = { $lt: now };
    const [data, total] = await Promise.all([Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Coupon.countDocuments(filter)]);
    res.json({ success: true, data, pagination: pageMeta(total, page, limit) });
});
const createCoupon = h(async (req, res) => {
    const { d, errors } = couponFields(req.body || {}, { partial: false });
    if (errors.length) return fail(res, 400, errors[0]);
    if (await Coupon.exists({ code: d.code })) return fail(res, 409, 'This coupon code already exists');
    const c = await Coupon.create(d); audit(req, 'coupon.create', 'coupon', c._id, `Created coupon ${c.code}`);
    res.status(201).json({ success: true, data: c });
});
const updateCoupon = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    const c = await Coupon.findById(req.params.id); if (!c) return fail(res, 404, 'Coupon not found');
    const { d, errors } = couponFields({ ...c.toObject(), ...req.body }, { partial: true });
    if (errors.length) return fail(res, 400, errors[0]);
    if (d.code && d.code !== c.code && await Coupon.exists({ code: d.code })) return fail(res, 409, 'This coupon code already exists');
    Object.assign(c, d); await c.save(); audit(req, 'coupon.update', 'coupon', c._id, `Updated coupon ${c.code}`);
    res.json({ success: true, data: c });
});
const deleteCoupon = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    const c = await Coupon.findByIdAndDelete(req.params.id); if (!c) return fail(res, 404, 'Coupon not found');
    audit(req, 'coupon.delete', 'coupon', c._id, `Deleted coupon ${c.code}`); res.json({ success: true });
});

// ---------------------------------------------------------------- reviews
const listReviews = h(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
    const filter = {}; if (['pending', 'approved', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
    const [data, total, pending] = await Promise.all([
        Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('product', 'title images').lean(),
        Review.countDocuments(filter), Review.countDocuments({ status: 'pending' }),
    ]);
    res.json({ success: true, data, pending, pagination: pageMeta(total, page, limit) });
});
const updateReview = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    const r = await Review.findById(req.params.id); if (!r) return fail(res, 404, 'Review not found');
    if (req.body.status !== undefined) { if (!['pending', 'approved', 'rejected'].includes(req.body.status)) return fail(res, 400, 'Invalid status'); r.status = req.body.status; }
    if (req.body.adminReply !== undefined) r.adminReply = cleanText(req.body.adminReply, 800);
    await r.save(); await recalcRating(r.product); memoClear('testimonials');
    audit(req, 'review.update', 'review', r._id, `Review ${r.status}`);
    res.json({ success: true, data: r });
});
const deleteReview = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    const r = await Review.findByIdAndDelete(req.params.id); if (!r) return fail(res, 404, 'Review not found');
    await recalcRating(r.product); memoClear('testimonials'); audit(req, 'review.delete', 'review', r._id, 'Deleted a review');
    res.json({ success: true });
});

// ---------------------------------------------------------------- CMS pages
const listPages = h(async (req, res) => { await ensureDefaultPages(); res.json({ success: true, data: await Page.find({}).sort({ order: 1, title: 1 }).select('-content').lean() }); });
const getPage = h(async (req, res) => { if (!isId(req.params.id)) return fail(res, 400, 'Invalid id'); const p = await Page.findById(req.params.id).lean(); if (!p) return fail(res, 404, 'Page not found'); res.json({ success: true, data: p }); });
const pageFields = (b) => ({ title: cleanText(b.title, 120), content: cleanHtml(b.content || ''), isActive: b.isActive === undefined ? true : bool(b.isActive), showInFooter: b.showInFooter === undefined ? true : bool(b.showInFooter), order: Math.floor(num(b.order, 0)) });
const createPage = h(async (req, res) => {
    const d = pageFields(req.body || {}); if (!d.title) return fail(res, 400, 'Page title is required');
    const slug = slugify(req.body.slug || d.title); if (!slug) return fail(res, 400, 'Page address is required');
    if (await Page.exists({ slug })) return fail(res, 409, 'A page with this address already exists');
    const p = await Page.create({ ...d, slug }); memoClear('pages'); audit(req, 'page.create', 'page', p._id, `Created page "${p.title}"`);
    res.status(201).json({ success: true, data: p });
});
const updatePage = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    const p = await Page.findById(req.params.id); if (!p) return fail(res, 404, 'Page not found');
    const d = pageFields({ ...p.toObject(), ...req.body }); if (!d.title) return fail(res, 400, 'Page title is required');
    Object.assign(p, d); await p.save(); memoClear('pages'); audit(req, 'page.update', 'page', p._id, `Updated page "${p.title}"`);
    res.json({ success: true, data: p });
});
const deletePage = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    const p = await Page.findByIdAndDelete(req.params.id); if (!p) return fail(res, 404, 'Page not found');
    memoClear('pages'); audit(req, 'page.delete', 'page', p._id, `Deleted page "${p.title}"`); res.json({ success: true });
});

// ---------------------------------------------------------------- subscribers
const listSubscribers = h(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30 });
    const filter = {}; if (req.query.q) filter.email = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 60)), 'i');
    const [data, total] = await Promise.all([Subscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Subscriber.countDocuments(filter)]);
    res.json({ success: true, data, pagination: pageMeta(total, page, limit) });
});
const exportSubscribers = h(async (req, res) => {
    const rows = await Subscriber.find({}).sort({ createdAt: -1 }).limit(50000).lean();
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="subscribers.csv"' });
    res.send(`email,subscribed_at\n${rows.map((r) => `"${r.email}","${new Date(r.createdAt).toISOString()}"`).join('\n')}\n`);
});
const deleteSubscriber = h(async (req, res) => { if (!isId(req.params.id)) return fail(res, 400, 'Invalid id'); await Subscriber.findByIdAndDelete(req.params.id); res.json({ success: true }); });

module.exports = { listCategories, createCategory, updateCategory, deleteCategory, importCategories, listCoupons, createCoupon, updateCoupon, deleteCoupon,
    listReviews, updateReview, deleteReview, listPages, getPage, createPage, updatePage, deletePage, listSubscribers, exportSubscribers, deleteSubscriber };
