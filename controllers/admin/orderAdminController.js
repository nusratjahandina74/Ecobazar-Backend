const Order = require('../../models/orderModel');
const sendError = require('../../utils/sendError');
const audit = require('../../utils/audit');
const { cleanText } = require('../../utils/sanitize');
const { escapeRegex, isId, parsePagination, pageMeta, memoClear, bdStartOfDay, addDays } = require('../../utils/helpers');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../models/orderModel');
const { applyStatus, httpError } = require('../../services/orderService');
const { computeDelivery, getSettings } = require('../../services/settingsService');
const courier = require('../../services/courier');

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, amount_desc: { totalAmount: -1 }, amount_asc: { totalAmount: 1 } };
const LIST_SELECT = '-gatewayResponse -__v -statusHistory';
const TAB_TO_STATUS = { pending: 'Order Placed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', canceled: 'Cancelled' };

const buildFilter = (q, { ignoreStatus = false } = {}) => {
    const f = {};
    const st = TAB_TO_STATUS[String(q.status || '').toLowerCase()] || (ORDER_STATUSES.includes(q.status) ? q.status : null);
    if (st && !ignoreStatus) f.orderStatus = st;
    if (['cod', 'online'].includes(q.paymentMethod)) f.paymentMethod = q.paymentMethod;
    if (PAYMENT_STATUSES.includes(q.paymentStatus)) f.paymentStatus = q.paymentStatus;
    if (['inside_dhaka', 'outside_dhaka'].includes(q.zone)) f.deliveryZone = q.zone;
    if (q.courier === 'sent') f['courier.consignmentId'] = { $exists: true, $ne: null };
    if (q.courier === 'not_sent') f['courier.consignmentId'] = { $in: [null] };
    if (q.from || q.to) {
        f.createdAt = {};
        if (q.from) f.createdAt.$gte = bdStartOfDay(new Date(q.from));
        if (q.to) f.createdAt.$lt = addDays(bdStartOfDay(new Date(q.to)), 1);
    }
    const term = q.q ? String(q.q).trim().slice(0, 60) : '';
    if (term) {
        if (/^EB-/i.test(term)) f.orderNumber = new RegExp('^' + escapeRegex(term), 'i');
        else if (/^TXN-/i.test(term)) f.transactionId = term;
        else if (/^[+\d\s-]{4,}$/.test(term)) f['shippingAddress.phone'] = new RegExp('^' + escapeRegex(term.replace(/[\s-]/g, '')));
        else if (isId(term)) f._id = term;
        else f.$or = [{ 'shippingAddress.name': new RegExp(escapeRegex(term), 'i') }, { 'courier.consignmentId': term }, { 'shippingAddress.email': new RegExp('^' + escapeRegex(term), 'i') }];
    }
    return f;
};

// GET /admin/orders?status=pending|processing|shipped|delivered|cancelled&page&limit&q&paymentMethod&zone&from&to&sort
const listOrders = async (req, res) => {
    try {
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
        const filter = buildFilter(req.query);
        const [items, total] = await Promise.all([
            Order.find(filter).select(LIST_SELECT).populate('user', 'email firstName lastName').sort(SORTS[req.query.sort] || SORTS.newest).skip(skip).limit(limit).lean().maxTimeMS(10000),
            Order.countDocuments(filter).maxTimeMS(10000),
        ]);
        res.json({ success: true, data: items, pagination: pageMeta(total, page, limit) });
    } catch (e) { sendError(res, e); }
};

// GET /admin/orders/counts  -> numbers for the status tabs (honours the same filters except "status")
const orderCounts = async (req, res) => {
    try {
        const filter = buildFilter(req.query, { ignoreStatus: true });
        const rows = await Order.aggregate([{ $match: filter }, { $group: { _id: '$orderStatus', n: { $sum: 1 } } }]);
        const counts = { all: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
        const key = { 'Order Placed': 'pending', Processing: 'processing', Shipped: 'shipped', Delivered: 'delivered', Cancelled: 'cancelled' };
        rows.forEach((r) => { counts[key[r._id]] = r.n; counts.all += r.n; });
        res.json({ success: true, data: counts });
    } catch (e) { sendError(res, e); }
};

const getOrder = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Order ID format');
        const o = await Order.findById(req.params.id).select('-gatewayResponse -__v').populate('user', 'email firstName lastName phoneNumber').populate('statusHistory.by', 'email firstName lastName').lean();
        if (!o) return fail(res, 404, 'Order not found');
        res.json({ success: true, data: o });
    } catch (e) { sendError(res, e); }
};

// PATCH /admin/orders/:id/status { status, note }   (status accepts "Processing" or "processing" ...)
const normalizeStatus = (s) => TAB_TO_STATUS[String(s || '').toLowerCase()] || s;

const updateStatus = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Order ID format');
        const to = normalizeStatus(req.body.status || req.body.orderStatus);
        if (!ORDER_STATUSES.includes(to)) return fail(res, 400, `status must be one of: ${ORDER_STATUSES.join(', ')}`);
        const order = await Order.findById(req.params.id);
        if (!order) return fail(res, 404, 'Order not found');
        await applyStatus(order, to, { by: req.user.id, note: cleanText(req.body.note, 300) || undefined });
        memoClear('overview'); memoClear('series'); memoClear('top');
        audit(req, 'order.status', 'order', order._id, `${order.orderNumber || order._id} -> ${to}`);
        res.json({ success: true, message: `Order marked as ${to}`, data: order });
    } catch (e) { if (e.status) return fail(res, e.status, e.message); sendError(res, e); }
};

// PATCH /admin/orders/:id  { internalNote, paymentStatus, shippingAddress{...}, deliveryZone }
const updateOrder = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Order ID format');
        const order = await Order.findById(req.params.id);
        if (!order) return fail(res, 404, 'Order not found');
        const b = req.body || {};
        if (b.internalNote !== undefined) order.internalNote = cleanText(b.internalNote, 1000);
        if (b.paymentStatus !== undefined) {
            if (!PAYMENT_STATUSES.includes(b.paymentStatus)) return fail(res, 400, 'Invalid payment status');
            order.paymentStatus = b.paymentStatus;
        }
        if (b.shippingAddress && typeof b.shippingAddress === 'object') {
            for (const k of ['name', 'email', 'phone', 'address1', 'address2', 'city', 'state', 'postcode']) {
                if (b.shippingAddress[k] !== undefined) {
                    const v = cleanText(b.shippingAddress[k], 200);
                    if (['name', 'phone', 'address1', 'city'].includes(k) && !v) return fail(res, 400, `${k} is required`);
                    order.shippingAddress[k] = v;
                }
            }
        }
        if (b.deliveryZone !== undefined && b.deliveryZone !== order.deliveryZone) {
            if (['Shipped', 'Delivered', 'Cancelled'].includes(order.orderStatus)) return fail(res, 409, 'Delivery zone cannot change after the order is shipped');
            const d = computeDelivery(await getSettings(), b.deliveryZone, order.subtotal || 0);
            order.deliveryZone = d.zone; order.deliveryCharge = d.charge; order.totalAmount = (order.subtotal || 0) + d.charge;
        }
        await order.save();
        memoClear('overview'); memoClear('series');
        audit(req, 'order.update', 'order', order._id, `Edited ${order.orderNumber || order._id}`, { fields: Object.keys(b) });
        res.json({ success: true, message: 'Order updated', data: order });
    } catch (e) { sendError(res, e); }
};

// POST /admin/orders/bulk/status { ids, status }
const bulkStatus = async (req, res) => {
    try {
        const { ids } = req.body || {}; const to = normalizeStatus(req.body.status);
        if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !ids.every(isId)) return fail(res, 400, 'Provide 1-200 valid order ids');
        if (!ORDER_STATUSES.includes(to)) return fail(res, 400, `status must be one of: ${ORDER_STATUSES.join(', ')}`);
        const orders = await Order.find({ _id: { $in: ids } });
        const updated = []; const failed = [];
        for (const o of orders) {
            try { await applyStatus(o, to, { by: req.user.id, note: 'Bulk update' }); updated.push(String(o._id)); }
            catch (e) { failed.push({ id: String(o._id), orderNumber: o.orderNumber, reason: e.message }); }
        }
        memoClear('overview'); memoClear('series'); memoClear('top');
        audit(req, 'order.bulk_status', 'order', null, `Bulk -> ${to}: ${updated.length} ok, ${failed.length} skipped`, { ids });
        res.json({ success: true, message: `${updated.length} orders updated${failed.length ? `, ${failed.length} skipped` : ''}`, updated, failed });
    } catch (e) { sendError(res, e); }
};

const sendOneToCourier = async (order, providerName, settings, userId) => {
    if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Delivered') throw httpError(409, `A ${order.orderStatus.toLowerCase()} order cannot be sent to courier`);
    if (order.courier && order.courier.consignmentId) throw httpError(409, `Already sent via ${order.courier.provider} (${order.courier.trackingCode || order.courier.consignmentId})`);
    const provider = providerName || (settings.courier && settings.courier.defaultProvider) || 'steadfast';
    if (provider === 'manual') throw httpError(400, 'Use the manual tracking form for manual couriers');
    try {
        const r = await courier.createParcel(provider, order, settings);
        order.courier = { provider: r.provider, consignmentId: r.consignmentId, trackingCode: r.trackingCode, status: r.status, sentAt: new Date(), error: undefined };
        if (order.orderStatus !== 'Shipped') await applyStatus(order, 'Shipped', { by: userId, note: `Sent to ${r.provider === 'mock' ? 'courier (TEST mode)' : r.provider} - ${r.trackingCode}` });
        else await order.save();
        return order;
    } catch (e) {
        if (e.status) throw e;
        order.courier = { ...(order.courier && order.courier.toObject ? order.courier.toObject() : {}), error: String(e.response?.data?.message || e.message).slice(0, 300) };
        await order.save();
        throw httpError(502, `Courier API error: ${order.courier.error}`);
    }
};

// POST /admin/orders/:id/courier { provider }  -> "Send to Courier" button
const sendToCourier = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Order ID format');
        const order = await Order.findById(req.params.id);
        if (!order) return fail(res, 404, 'Order not found');
        await sendOneToCourier(order, req.body && req.body.provider, await getSettings(), req.user.id);
        memoClear('overview');
        audit(req, 'order.courier', 'order', order._id, `${order.orderNumber} -> ${order.courier.provider} ${order.courier.trackingCode}`);
        res.json({ success: true, message: `Sent to courier. Tracking: ${order.courier.trackingCode}`, data: order });
    } catch (e) { if (e.status) return fail(res, e.status, e.message); sendError(res, e); }
};

// POST /admin/orders/bulk/courier { ids, provider }
const bulkCourier = async (req, res) => {
    try {
        const { ids, provider } = req.body || {};
        if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !ids.every(isId)) return fail(res, 400, 'Provide 1-100 valid order ids');
        const settings = await getSettings();
        const orders = await Order.find({ _id: { $in: ids } });
        const results = [];
        for (const o of orders) {   // sequential: courier APIs rate-limit parallel bursts
            try { await sendOneToCourier(o, provider, settings, req.user.id); results.push({ id: String(o._id), orderNumber: o.orderNumber, ok: true, trackingCode: o.courier.trackingCode }); }
            catch (e) { results.push({ id: String(o._id), orderNumber: o.orderNumber, ok: false, reason: e.message }); }
        }
        memoClear('overview');
        const ok = results.filter((r) => r.ok).length;
        audit(req, 'order.bulk_courier', 'order', null, `Bulk courier: ${ok} sent, ${results.length - ok} failed`, { ids });
        res.json({ success: true, message: `${ok} sent to courier${results.length - ok ? `, ${results.length - ok} failed` : ''}`, results });
    } catch (e) { sendError(res, e); }
};

// POST /admin/orders/:id/courier/manual { provider, trackingCode }
const manualTracking = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Order ID format');
        const code = cleanText(req.body.trackingCode, 80);
        if (!code) return fail(res, 400, 'Tracking code is required');
        const order = await Order.findById(req.params.id);
        if (!order) return fail(res, 404, 'Order not found');
        order.courier = { provider: 'manual', consignmentId: code, trackingCode: code, status: 'booked', sentAt: new Date() };
        if (['Order Placed', 'Processing'].includes(order.orderStatus)) await applyStatus(order, 'Shipped', { by: req.user.id, note: `Manual tracking ${code}` }); else await order.save();
        audit(req, 'order.courier_manual', 'order', order._id, `${order.orderNumber} manual tracking ${code}`);
        res.json({ success: true, data: order });
    } catch (e) { if (e.status) return fail(res, e.status, e.message); sendError(res, e); }
};

// POST /admin/orders/:id/courier/sync
const syncCourier = async (req, res) => {
    try {
        if (!isId(req.params.id)) return fail(res, 400, 'Invalid Order ID format');
        const order = await Order.findById(req.params.id);
        if (!order || !order.courier || !order.courier.consignmentId) return fail(res, 404, 'This order has not been sent to a courier');
        const r = await courier.syncStatus(order);
        order.courier.status = r.status; await order.save();
        const s = String(r.status).toLowerCase();
        if (s === 'delivered' && order.orderStatus === 'Shipped') await applyStatus(order, 'Delivered', { by: req.user.id, note: 'Courier reported delivered' });
        res.json({ success: true, data: order, courierStatus: r.status });
    } catch (e) { if (e.status) return fail(res, e.status, e.message); sendError(res, e); }
};

// GET /admin/orders/invoices?ids=a,b,c  -> data for printing many invoices at once (max 100)
const invoices = async (req, res) => {
    try {
        const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
        if (!ids.length || ids.length > 100 || !ids.every(isId)) return fail(res, 400, 'Provide 1-100 valid order ids');
        const [orders, settings] = await Promise.all([
            Order.find({ _id: { $in: ids } }).select('-gatewayResponse -__v -statusHistory').sort({ createdAt: 1 }).lean(),
            getSettings(),
        ]);
        await Order.updateMany({ _id: { $in: ids } }, { $set: { invoicePrintedAt: new Date() } });
        res.json({ success: true, data: { orders, store: settings.store } });
    } catch (e) { sendError(res, e); }
};

// GET /admin/orders/export?...same filters... -> CSV (max 5000 rows)
const exportCsv = async (req, res) => {
    try {
        const rows = await Order.find(buildFilter(req.query)).select('-gatewayResponse -statusHistory').sort({ createdAt: -1 }).limit(5000).lean().maxTimeMS(20000);
        const esc = (v) => { const s = String(v ?? '').replace(/"/g, '""'); return /^[=+\-@]/.test(s) ? `"'${s}"` : `"${s}"`; };
        const head = ['Order', 'Date', 'Customer', 'Phone', 'Address', 'City', 'Zone', 'Items', 'Subtotal', 'Delivery', 'Total', 'Payment', 'Payment status', 'Order status', 'Courier', 'Tracking'];
        const lines = rows.map((o) => [o.orderNumber || o._id, new Date(o.createdAt).toISOString(), o.shippingAddress.name, o.shippingAddress.phone, o.shippingAddress.address1, o.shippingAddress.city,
            o.deliveryZone, o.products.map((p) => `${p.title} x${p.quantity}`).join('; '), o.subtotal, o.deliveryCharge, o.totalAmount, o.paymentMethod, o.paymentStatus, o.orderStatus, o.courier && o.courier.provider, o.courier && o.courier.trackingCode].map(esc).join(','));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send('﻿' + [head.map(esc).join(','), ...lines].join('\n'));
    } catch (e) { sendError(res, e); }
};

module.exports = { listOrders, orderCounts, getOrder, updateStatus, updateOrder, bulkStatus, sendToCourier, bulkCourier, manualTracking, syncCourier, invoices, exportCsv };
