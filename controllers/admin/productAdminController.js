const mongoose = require('mongoose');
const Product = require('../../models/productModel');
const Cart = require('../../models/cartModel');
const Wishlist = require('../../models/wishlistModel');
const sendError = require('../../utils/sendError');
const audit = require('../../utils/audit');
const { cleanHtml, cleanText } = require('../../utils/sanitize');
const { removeImages, removeRequestFiles } = require('../../utils/storage');
const { escapeRegex, isId, parsePagination, pageMeta, num, bool, memoClear } = require('../../utils/helpers');
const Category = require('../../models/categoryModel');
const { getSettings } = require('../../services/settingsService');

const STATUSES = ['pending', 'active', 'inactive'];
const SORTS = {
    newest: { createdAt: -1 }, oldest: { createdAt: 1 }, price_asc: { price: 1 }, price_desc: { price: -1 },
    stock_asc: { stock: 1 }, stock_desc: { stock: -1 }, name: { title: 1 }, best_selling: { soldCount: -1 },
};
const LIST_FIELDS = 'title slug sku price discountPrice stock category subCategory brand status images variants soldCount isFeatured ratingAvg ratingCount createdAt updatedAt';

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const parseJson = (v, fallback) => {
    if (v === undefined || v === null || v === '') return fallback;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return fallback; }
};
const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9ঀ-৿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);

const normalizeVariants = (raw, baseSku) => {
    const list = parseJson(raw, null);
    if (!Array.isArray(list)) return undefined;
    return list.slice(0, 100).map((v, i) => {
        const size = cleanText(v.size, 40); const color = cleanText(v.color, 40);
        const out = {
            sku: cleanText(v.sku, 60) || `${baseSku}-V${i + 1}`,
            size, color, label: cleanText(v.label, 80) || [color, size].filter(Boolean).join(' / ') || `Variant ${i + 1}`,
            price: num(v.price, undefined), discountPrice: num(v.discountPrice, undefined),
            stock: Math.max(0, Math.floor(num(v.stock, 0))), isActive: v.isActive === undefined ? true : (v.isActive === true || v.isActive === 'true'),
            image: v.image ? String(v.image).slice(0, 500) : undefined,
        };
        if (v._id && isId(v._id)) out._id = v._id;
        return out;
    });
};

/** Build a validated update document from request body (multipart or JSON). */
const buildFields = (body, { partial }) => {
    const d = {}; const errors = [];
    const has = (k) => body[k] !== undefined;
    if (has('title')) { const t = cleanText(body.title, 200); if (!t) errors.push('Title is required'); d.title = t; d.slug = slugify(t); }
    if (has('description')) d.description = cleanHtml(body.description);
    if (has('shortDescription')) d.shortDescription = cleanText(body.shortDescription, 500);
    if (has('additionalInfo')) d.additionalInfo = cleanHtml(body.additionalInfo);
    if (has('category')) { const c = cleanText(body.category, 80); if (!c) errors.push('Category is required'); d.category = c; }
    if (has('subCategory')) d.subCategory = cleanText(body.subCategory, 80);
    if (has('brand')) d.brand = cleanText(body.brand, 80);
    if (has('unit')) d.unit = cleanText(body.unit, 30);
    if (has('price')) { const p = num(body.price, NaN); if (!(p > 0)) errors.push('Price must be greater than 0'); else d.price = p; }
    if (has('discountPrice')) { const p = num(body.discountPrice, 0); if (p < 0) errors.push('Discount price cannot be negative'); else d.discountPrice = p; }
    if (has('stock')) { const s = num(body.stock, NaN); if (!(s >= 0)) errors.push('Stock cannot be less than 0'); else d.stock = Math.floor(s); }
    if (has('status')) { if (!STATUSES.includes(body.status)) errors.push(`Status must be one of ${STATUSES.join(', ')}`); else d.status = body.status; }
    if (has('isFeatured')) d.isFeatured = bool(body.isFeatured);
    if (has('tag')) { const t = parseJson(body.tag, body.tag); d.tag = (Array.isArray(t) ? t : String(t).split(',')).map((x) => cleanText(x, 40)).filter(Boolean).slice(0, 20); }
    if (!partial) {
        if (d.title === undefined) errors.push('Title is required');
        if (d.price === undefined) errors.push('Price must be greater than 0');
        if (d.category === undefined) errors.push('Category is required');
    }
    if (d.price !== undefined && d.discountPrice > 0 && d.discountPrice >= d.price) errors.push('Discount price must be lower than the regular price');
    return { d, errors };
};

const applyVariantRules = (doc) => {
    const active = (doc.variants || []).filter((v) => v.isActive !== false);
    if (active.length) {
        doc.stock = active.reduce((s, v) => s + (v.stock || 0), 0);
        const prices = active.map((v) => v.price ?? doc.price).filter((n) => n > 0);
        if (prices.length && !(doc.price > 0)) doc.price = Math.min(...prices);
    }
};

const imageObjects = (files = [], hasMain = false) => files.map((f, i) => ({ url: f.url, isMain: !hasMain && i === 0 }));
const applyMain = (images, mainRef, addedStart = 0) => {
    if (!images.length) return images;
    let idx = -1;
    if (mainRef) {
        const m = /^new:(\d+)$/.exec(String(mainRef));
        idx = m ? addedStart + Number(m[1]) : images.findIndex((i) => i.url === mainRef);
    }
    if (idx < 0 || idx >= images.length) idx = images.findIndex((i) => i.isMain);
    if (idx < 0) idx = 0;
    const list = images.map((i, n) => ({ url: i.url, isMain: n === idx }));
    const [main] = list.splice(idx, 1);
    return [main, ...list];
};

const buildFilter = (q, lowThreshold = 5) => {
    const f = {};
    if (q.status && STATUSES.includes(q.status)) f.status = q.status;
    if (q.category) f.category = q.category;
    if (q.featured === 'true') f.isFeatured = true;
    if (q.ids) { const ids = String(q.ids).split(',').filter(isId).slice(0, 100); f._id = { $in: ids }; }
    if (q.subCategory) f.subCategory = q.subCategory;
    const min = num(q.minPrice, null); const max = num(q.maxPrice, null);
    if (min !== null || max !== null) { f.price = {}; if (min !== null) f.price.$gte = min; if (max !== null) f.price.$lte = max; }
    if (q.stock === 'out') f.stock = { $lte: 0 };
    else if (q.stock === 'in') f.stock = { $gt: 0 };
    else if (q.stock === 'low') f.stock = { $gt: 0, $lte: lowThreshold };
    if (q.q && String(q.q).trim()) {
        const rx = new RegExp(escapeRegex(String(q.q).trim().slice(0, 80)), 'i');
        f.$or = [{ title: rx }, { sku: rx }, { brand: rx }, { tag: rx }];
    }
    return f;
};

// GET /admin/products?page&limit&q&status&category&stock=low|out|in&minPrice&maxPrice&sort
const listProducts = async (req, res) => {
    try {
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
        const settings = await getSettings();
        const filter = buildFilter(req.query, settings.inventory.lowStockThreshold);
        const sort = SORTS[req.query.sort] || SORTS.newest;
        const [items, total] = await Promise.all([
            Product.find(filter).select(LIST_FIELDS).sort(sort).skip(skip).limit(limit).lean().maxTimeMS(8000),
            Product.countDocuments(filter).maxTimeMS(8000),
        ]);
        res.json({ success: true, data: items, pagination: pageMeta(total, page, limit) });
    } catch (e) { sendError(res, e); }
};

const getProduct = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Product ID format');
        const p = await Product.findById(req.params.id).lean();
        if (!p) return fail(res, 404, 'Product not found');
        res.json({ success: true, data: p });
    } catch (e) { sendError(res, e); }
};

// Categories + sub-categories + counts (drives dropdowns & filters; tiny aggregation)
const productMeta = async (req, res) => {
    try {
        const [cats, statusRows] = await Promise.all([
            Product.aggregate([{ $group: { _id: { c: '$category', s: '$subCategory' }, n: { $sum: 1 } } }]),
            Product.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        ]);
        const map = new Map();
        cats.forEach(({ _id, n }) => {
            if (!_id.c) return;
            const e = map.get(_id.c) || { name: _id.c, count: 0, subcategories: [] };
            e.count += n; if (_id.s && !e.subcategories.includes(_id.s)) e.subcategories.push(_id.s);
            map.set(_id.c, e);
        });
        (await Category.find({ isActive: true }).select('name').lean()).forEach((c) => { if (!map.has(c.name)) map.set(c.name, { name: c.name, count: 0, subcategories: [] }); });
        const status = { pending: 0, active: 0, inactive: 0 }; statusRows.forEach((s) => { status[s._id] = s.n; });
        const settings = await getSettings();
        res.json({ success: true, data: { categories: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)), status, lowStockThreshold: settings.inventory.lowStockThreshold } });
    } catch (e) { sendError(res, e); }
};

const createProduct = async (req, res) => {
    res.on('finish', () => { if (res.statusCode >= 400) removeRequestFiles(req); });
    try {
        const { d, errors } = buildFields(req.body, { partial: false });
        if (errors.length) return fail(res, 400, errors[0]);
        if (await Product.exists({ title: d.title })) return fail(res, 409, 'Product title already exists');
        const sku = cleanText(req.body.sku, 60) || `EB-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
        if (await Product.exists({ sku })) return fail(res, 409, 'Product SKU already exists');
        const variants = normalizeVariants(req.body.variants, sku);
        const doc = new Product({ ...d, sku, ...(variants ? { variants } : {}), images: applyMain(imageObjects(req.files), req.body.mainImage) });
        applyVariantRules(doc);
        await doc.save();
        memoClear('overview');
        audit(req, 'product.create', 'product', doc._id, `Created product "${doc.title}"`);
        res.status(201).json({ success: true, message: 'Product created successfully', data: doc });
    } catch (e) { sendError(res, e); }
};

const updateProduct = async (req, res) => {
    res.on('finish', () => { if (res.statusCode >= 400) removeRequestFiles(req); });
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Product ID format');
        const existing = await Product.findById(req.params.id);
        if (!existing) return fail(res, 404, 'Product not found');
        const { d, errors } = buildFields(req.body, { partial: true });
        if (errors.length) return fail(res, 400, errors[0]);
        if (d.title && d.title !== existing.title && await Product.exists({ title: d.title, _id: { $ne: existing._id } })) return fail(res, 409, 'Product title already exists');
        const effPrice = d.price ?? existing.price; const effDisc = d.discountPrice ?? existing.discountPrice;
        if (effDisc > 0 && effDisc >= effPrice) return fail(res, 400, 'Discount price must be lower than the regular price');

        let remove = req.body.removeImages || [];
        if (typeof remove === 'string') remove = parseJson(remove, [remove]);
        if (!Array.isArray(remove)) remove = [remove];
        const kept = existing.images.filter((i) => !remove.includes(i.url)).map((i) => ({ url: i.url, isMain: !!i.isMain }));
        const added = imageObjects(req.files, true);
        if (kept.length + added.length > 5) return fail(res, 400, 'A product can have at most 5 images');
        if (req.files?.length || remove.length || req.body.mainImage) existing.images = applyMain([...kept, ...added], req.body.mainImage, kept.length);

        Object.assign(existing, d);
        const variants = normalizeVariants(req.body.variants, existing.sku);
        if (variants) existing.variants = variants;
        applyVariantRules(existing);
        await existing.save();
        removeImages(remove.filter((u) => !existing.images.some((i) => i.url === u)));
        memoClear('overview');
        audit(req, 'product.update', 'product', existing._id, `Updated product "${existing.title}"`, { fields: Object.keys(d) });
        res.json({ success: true, message: 'Product updated successfully', data: existing });
    } catch (e) { sendError(res, e); }
};

// PATCH /admin/products/:id/quick  { status?, price?, discountPrice?, stock? }  - inline edits from the table / popup
const quickUpdate = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Product ID format');
        const allowed = {};
        for (const k of ['status', 'price', 'discountPrice', 'stock', 'isFeatured']) if (req.body[k] !== undefined) allowed[k] = req.body[k];
        const { d, errors } = buildFields(allowed, { partial: true });
        if (errors.length) return fail(res, 400, errors[0]);
        if (!Object.keys(d).length) return fail(res, 400, 'Nothing to update');
        const p = await Product.findById(req.params.id);
        if (!p) return fail(res, 404, 'Product not found');
        if (d.stock !== undefined && p.variants.some((v) => v.isActive !== false)) return fail(res, 400, 'This product has variants - edit stock per variant.');
        const effPrice = d.price ?? p.price; const effDisc = d.discountPrice ?? p.discountPrice;
        if (effDisc > 0 && effDisc >= effPrice) return fail(res, 400, 'Discount price must be lower than the regular price');
        Object.assign(p, d); await p.save();
        memoClear('overview');
        audit(req, 'product.quick', 'product', p._id, `Quick edit "${p.title}"`, d);
        res.json({ success: true, data: p });
    } catch (e) { sendError(res, e); }
};

// POST /admin/products/bulk  { ids: [], action: 'status', status } | { action: 'delete' }
const bulkProducts = async (req, res) => {
    try {
        const { ids, action } = req.body || {};
        if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !ids.every(isId)) return fail(res, 400, 'Provide 1-200 valid product ids');
        if (action === 'status') {
            if (!STATUSES.includes(req.body.status)) return fail(res, 400, 'Invalid status');
            const r = await Product.updateMany({ _id: { $in: ids } }, { $set: { status: req.body.status } });
            audit(req, 'product.bulk_status', 'product', null, `Set ${r.modifiedCount} products to ${req.body.status}`, { ids });
            memoClear('overview');
            return res.json({ success: true, message: `${r.modifiedCount} products updated`, modified: r.modifiedCount });
        }
        if (action === 'delete') {
            const docs = await Product.find({ _id: { $in: ids } }).select('images title').lean();
            await Promise.all([Product.deleteMany({ _id: { $in: ids } }), Cart.deleteMany({ product: { $in: ids } }), Wishlist.deleteMany({ product: { $in: ids } })]);
            docs.forEach((p) => removeImages(p.images));
            audit(req, 'product.bulk_delete', 'product', null, `Deleted ${docs.length} products`, { ids });
            memoClear('overview');
            return res.json({ success: true, message: `${docs.length} products deleted`, deleted: docs.length });
        }
        return fail(res, 400, 'Unknown bulk action');
    } catch (e) { sendError(res, e); }
};

const deleteProduct = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Product ID format');
        const p = await Product.findByIdAndDelete(req.params.id);
        if (!p) return fail(res, 404, 'Product not found');
        removeImages(p.images);
        await Promise.all([Cart.deleteMany({ product: p._id }), Wishlist.deleteMany({ product: p._id })]);
        memoClear('overview');
        audit(req, 'product.delete', 'product', p._id, `Deleted product "${p.title}"`);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (e) { sendError(res, e); }
};

module.exports = { listProducts, getProduct, productMeta, createProduct, updateProduct, quickUpdate, bulkProducts, deleteProduct };
