const bcrypt = require('bcrypt');
const User = require('../../models/userModel');
const Order = require('../../models/orderModel');
const Setting = require('../../models/settingModel');
const Banner = require('../../models/bannerModel');
const ContactMessage = require('../../models/contactMessageModel');
const AuditLog = require('../../models/auditLogModel');
const analytics = require('../../services/analyticsService');
const courier = require('../../services/courier');
const { getSettings, invalidateSettings, publicSettings, computeDelivery, withDefaults } = require('../../services/settingsService');
const { cleanText } = require('../../utils/sanitize');
const { removeImage, removeRequestFiles } = require('../../utils/storage');
const { escapeRegex, isId, parsePagination, pageMeta, num, bool } = require('../../utils/helpers');
const { DASHBOARD_ROLES, PERMISSIONS } = require('../../middleware/permissions');
const sendError = require('../../utils/sendError');
const audit = require('../../utils/audit');

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const h = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { sendError(res, e); } };

// ---------------------------------------------------------------- analytics
const overview = h(async (req, res) => res.json({ success: true, data: await analytics.overview(req.query) }));
const sales = h(async (req, res) => res.json({ success: true, data: await analytics.salesSeries(req.query) }));
const topProducts = h(async (req, res) => res.json({ success: true, data: await analytics.topProducts(req.query) }));
const recentOrders = h(async (req, res) => {
    const data = await Order.find({}).select('orderNumber totalAmount orderStatus paymentMethod paymentStatus createdAt shippingAddress.name').sort({ createdAt: -1 }).limit(8).lean();
    res.json({ success: true, data });
});

// ---------------------------------------------------------------- customers & team
const userFilter = (q) => {
    const f = {};
    if (q.role === 'team') f.role = { $in: DASHBOARD_ROLES };
    else if (q.role) f.role = q.role;
    if (q.hold === 'true') f.isHold = true;
    if (q.q && String(q.q).trim()) {
        const rx = new RegExp(escapeRegex(String(q.q).trim().slice(0, 60)), 'i');
        f.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }, { phoneNumber: rx }];
    }
    return f;
};
const listUsers = h(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = userFilter(req.query);
    const [users, total] = await Promise.all([
        User.find(filter).select('-password -__v').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(filter),
    ]);
    // order stats for just this page (one grouped query, indexed on user)
    const stats = await Order.aggregate([{ $match: { user: { $in: users.map((u) => u._id) }, orderStatus: { $ne: 'Cancelled' } } }, { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$totalAmount' } } }]);
    const sm = new Map(stats.map((s) => [String(s._id), s]));
    res.json({ success: true, data: users.map((u) => ({ ...u, orders: (sm.get(String(u._id)) || {}).orders || 0, totalSpent: (sm.get(String(u._id)) || {}).spent || 0 })), pagination: pageMeta(total, page, limit) });
});
const createTeamMember = h(async (req, res) => {
    const { email, password, firstName, lastName, role } = req.body || {};
    if (!email || !password) return fail(res, 400, 'Email and password are required');
    if (String(password).length < 8) return fail(res, 400, 'Password must be at least 8 characters');
    if (!['admin', 'manager', 'staff'].includes(role)) return fail(res, 400, 'Role must be admin, manager or staff');
    if (await User.exists({ email: String(email).toLowerCase().trim() })) return fail(res, 409, 'A user with this email already exists');
    const u = await User.create({ email, password: await bcrypt.hash(String(password), 10), firstName: cleanText(firstName, 50), lastName: cleanText(lastName, 50), role, terms: true, isVerified: true });
    audit(req, 'user.create', 'user', u._id, `Created ${role} ${u.email}`);
    res.status(201).json({ success: true, data: { _id: u._id, email: u.email, role: u.role } });
});
const updateUserAdmin = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid user id');
    const u = await User.findById(req.params.id);
    if (!u) return fail(res, 404, 'User not found');
    const { role, isHold } = req.body || {};
    if (String(u._id) === req.user.id && (role !== undefined && role !== u.role || isHold === true)) return fail(res, 400, 'You cannot change your own role or suspend yourself');
    if (role !== undefined) {
        if (!Object.keys(PERMISSIONS).includes(role)) return fail(res, 400, 'Invalid role');
        u.role = role;
    }
    if (isHold !== undefined) u.isHold = bool(isHold);
    await u.save();
    audit(req, 'user.update', 'user', u._id, `${u.email}: role=${u.role} hold=${u.isHold}`);
    res.json({ success: true, data: { _id: u._id, email: u.email, role: u.role, isHold: u.isHold } });
});

// ---------------------------------------------------------------- settings
const SECTIONS = {
    store: { name: 'str', tagline: 'str', email: 'str', phone: 'str', address: 'str', logo: 'str', returnPolicy: 'long', facebook: 'str', instagram: 'str', youtube: 'str', tiktok: 'str' },
    seo: { title: 'str', description: 'str' },
    theme: { primary: 'color' },
    reviews: { enabled: 'bool', autoApprove: 'bool', requirePurchase: 'bool' },
    delivery: { insideDhakaCharge: 'money', outsideDhakaCharge: 'money', freeDeliveryEnabled: 'bool', freeDeliveryThreshold: 'money', freeAllEnabled: 'bool', freeAllStartDate: 'date', freeAllEndDate: 'date', codEnabled: 'bool', onlineEnabled: 'bool' },
    notice: { text: 'str', isActive: 'bool' },
    whatsapp: { phone: 'str', isActive: 'bool' },
    courier: { defaultProvider: 'provider', pathaoStoreId: 'str' },
    inventory: { lowStockThreshold: 'int' },
    home: {},
};
const HOME_FLAGS = ['showCategories', 'showFeatured', 'showNewArrivals', 'showBestSellers', 'showTestimonials', 'showNewsletter'];
const coerceHome = (b) => {
    const set = {};
    for (const k of HOME_FLAGS) if (b[k] !== undefined) set[`home.${k}`] = bool(b[k]);
    if (b.flash) {
        const f = b.flash;
        if (f.enabled !== undefined) set['home.flash.enabled'] = bool(f.enabled);
        if (f.title !== undefined) set['home.flash.title'] = cleanText(f.title, 60);
        if (f.subtitle !== undefined) set['home.flash.subtitle'] = cleanText(f.subtitle, 120);
        if (f.endsAt !== undefined) set['home.flash.endsAt'] = coerce('date', f.endsAt);
        if (f.productIds !== undefined) {
            if (!Array.isArray(f.productIds) || f.productIds.length > 24 || !f.productIds.every(isId)) throw new Error('Choose up to 24 products for the flash sale');
            set['home.flash.productIds'] = f.productIds;
        }
        if (set['home.flash.enabled'] && !(set['home.flash.endsAt'] || f.keepEnd)) throw new Error('Set an end date and time for the flash sale');
    }
    if (b.badges !== undefined) {
        if (!Array.isArray(b.badges) || b.badges.length > 6) throw new Error('Up to 6 highlights are allowed');
        set['home.badges'] = b.badges.map((x) => ({ icon: ['truck', 'shield', 'refresh', 'headset', 'leaf', 'gift', 'clock', 'star'].includes(x.icon) ? x.icon : 'star', title: cleanText(x.title, 40), text: cleanText(x.text, 80) })).filter((x) => x.title);
    }
    return set;
};
const coerce = (type, v) => {
    switch (type) {
        case 'str': return cleanText(v, 300);
        case 'long': return cleanText(v, 5000);
        case 'bool': return bool(v);
        case 'money': { const n = num(v, NaN); if (!(n >= 0)) throw new Error('Amounts must be 0 or more'); return n; }
        case 'int': { const n = Math.floor(num(v, NaN)); if (!(n >= 0)) throw new Error('Value must be 0 or more'); return n; }
        case 'date': { if (!v) return null; const d = new Date(v); if (Number.isNaN(d.getTime())) throw new Error('Invalid date'); return d; }
        case 'color': { const c = String(v || '').trim(); if (c && !/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error('Color must look like #16a34a'); return c; }
        case 'provider': if (!['steadfast', 'pathao', 'manual'].includes(v)) throw new Error('Invalid courier'); return v;
        default: return v;
    }
};
const getAdminSettings = h(async (req, res) => res.json({ success: true, data: await getSettings(), courierStatus: courier.status() }));
const updateSettings = h(async (req, res) => {
    const spec = SECTIONS[req.params.section];
    if (!spec) return fail(res, 404, 'Unknown settings section');
    const set = {};
    try {
        if (req.params.section === 'home') Object.assign(set, coerceHome(req.body));
        else for (const [k, type] of Object.entries(spec)) if (req.body[k] !== undefined) set[`${req.params.section}.${k}`] = coerce(type, req.body[k]);
    } catch (e) { return fail(res, 400, e.message); }
    if (!Object.keys(set).length) return fail(res, 400, 'Nothing to update');
    if (req.params.section === 'delivery' && set['delivery.freeAllStartDate'] && set['delivery.freeAllEndDate'] && set['delivery.freeAllEndDate'] < set['delivery.freeAllStartDate']) return fail(res, 400, 'End date must be after the start date');
    const doc = await Setting.findOneAndUpdate({ key: 'main' }, { $set: set }, { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }).lean();
    invalidateSettings();
    audit(req, 'settings.update', 'setting', req.params.section, `Updated ${req.params.section} settings`, { section: req.params.section, fields: Object.keys(spec).filter((k) => req.body[k] !== undefined) });
    res.json({ success: true, message: 'Settings saved', data: withDefaults(doc) });
});

// public (storefront)
const getPublicSettings = h(async (req, res) => {
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ success: true, data: publicSettings(await getSettings()) });
});
const deliveryQuote = h(async (req, res) => {
    const subtotal = Math.max(0, num(req.query.subtotal, 0));
    res.json({ success: true, data: computeDelivery(await getSettings(), req.query.zone, subtotal) });
});

// ---------------------------------------------------------------- banners
const listBanners = h(async (req, res) => {
    const filter = req.originalUrl.includes('/admin/') ? {} : { isActive: true };
    if (!filter.isActive) res.set('Cache-Control', 'no-store'); else res.set('Cache-Control', 'public, max-age=60');
    res.json({ success: true, data: await Banner.find(filter).sort({ order: 1, createdAt: -1 }).lean() });
});
const bannerFields = (b) => ({ title: cleanText(b.title, 120), subtitle: cleanText(b.subtitle, 200), link: cleanText(b.link, 300), buttonText: cleanText(b.buttonText, 40), order: Math.floor(num(b.order, 0)), isActive: b.isActive === undefined ? true : bool(b.isActive) });
const createBanner = async (req, res) => {
    res.on('finish', () => { if (res.statusCode >= 400) removeRequestFiles(req); });
    try {
        const f = req.files && req.files[0]; if (!f) return fail(res, 400, 'Banner image is required');
        const b = await Banner.create({ ...bannerFields(req.body), image: f.url });
        audit(req, 'banner.create', 'banner', b._id, `Created banner ${b.title}`);
        res.status(201).json({ success: true, data: b });
    } catch (e) { sendError(res, e); }
};
const updateBanner = async (req, res) => {
    res.on('finish', () => { if (res.statusCode >= 400) removeRequestFiles(req); });
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
        const b = await Banner.findById(req.params.id); if (!b) return fail(res, 404, 'Banner not found');
        const f = req.files && req.files[0];
        const data = bannerFields({ ...b.toObject(), ...req.body });
        Object.assign(b, data);
        if (f) { removeImage(b.image); b.image = f.url; }
        await b.save();
        audit(req, 'banner.update', 'banner', b._id, `Updated banner ${b.title}`);
        res.json({ success: true, data: b });
    } catch (e) { sendError(res, e); }
};
const deleteBanner = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    const b = await Banner.findByIdAndDelete(req.params.id); if (!b) return fail(res, 404, 'Banner not found');
    removeImage(b.image); audit(req, 'banner.delete', 'banner', b._id, `Deleted banner ${b.title}`);
    res.json({ success: true });
});

// ---------------------------------------------------------------- contact messages
const submitContact = h(async (req, res) => {
    const { name, email, phone, subject, message } = req.body || {};
    if (!cleanText(name, 100) || !cleanText(message, 3000)) return fail(res, 400, 'Name and message are required');
    if (!cleanText(email, 150) && !cleanText(phone, 30)) return fail(res, 400, 'Please provide an email or phone number');
    await ContactMessage.create({ name: cleanText(name, 100), email: cleanText(email, 150), phone: cleanText(phone, 30), subject: cleanText(subject, 200), message: cleanText(message, 3000) });
    res.status(201).json({ success: true, message: 'Thanks! We received your message.' });
});
const listMessages = h(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = req.query.unread === 'true' ? { isRead: false } : {};
    const [data, total, unread] = await Promise.all([ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), ContactMessage.countDocuments(filter), ContactMessage.countDocuments({ isRead: false })]);
    res.json({ success: true, data, unread, pagination: pageMeta(total, page, limit) });
});
const updateMessage = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    const set = {}; if (req.body.isRead !== undefined) set.isRead = bool(req.body.isRead); if (req.body.adminNote !== undefined) set.adminNote = cleanText(req.body.adminNote, 1000);
    const m = await ContactMessage.findByIdAndUpdate(req.params.id, { $set: set }, { returnDocument: 'after' }); if (!m) return fail(res, 404, 'Message not found');
    res.json({ success: true, data: m });
});
const deleteMessage = h(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 400, 'Invalid id');
    await ContactMessage.findByIdAndDelete(req.params.id); res.json({ success: true });
});

// ---------------------------------------------------------------- audit log
const listAudit = h(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30 });
    const filter = {}; if (req.query.entity) filter.entity = req.query.entity;
    const [data, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]);
    res.json({ success: true, data, pagination: pageMeta(total, page, limit) });
});

// current user's permissions (dashboard uses this to hide menu items)
const myPermissions = (req, res) => {
    const list = PERMISSIONS[req.user.role] || [];
    res.json({ success: true, data: { role: req.user.role, permissions: list } });
};

module.exports = { overview, sales, topProducts, recentOrders, listUsers, createTeamMember, updateUserAdmin, getAdminSettings, updateSettings, getPublicSettings, deliveryQuote,
    listBanners, createBanner, updateBanner, deleteBanner, submitContact, listMessages, updateMessage, deleteMessage, listAudit, myPermissions };
