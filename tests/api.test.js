// Integration test. Needs a MongoDB:  TEST_MONGODB_URL=mongodb://127.0.0.1:27017/ecobazar_test npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.MONGODB_URL = process.env.TEST_MONGODB_URL || 'mongodb://127.0.0.1:27017/ecobazar_test';
process.env.ACCESS_TOKEN_SECRET = 'test-secret';
process.env.PORT = process.env.PORT || '5055';
process.env.NODE_ENV = 'development';
const BASE = `http://127.0.0.1:${process.env.PORT}`;

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const app = require('../index.js'); // eslint-disable-line no-unused-vars
const User = require('../models/userModel');
const Product = require('../models/productModel');

const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
};
const ctx = {};
// FerretDB (used for local testing without MongoDB) lacks $elemMatch-on-fields, so variant stock reservation is only exercised on real MongoDB.
const skipVariantOrders = () => ctx.ferret;

before(async () => {
    for (let i = 0; i < 50 && mongoose.connection.readyState !== 1; i++) await new Promise((r) => setTimeout(r, 200));
    ctx.ferret = !!(await mongoose.connection.db.admin().command({ buildInfo: 1 })).ferretdbVersion;
    await mongoose.connection.dropDatabase();
    const hash = await bcrypt.hash('Passw0rd!', 4);
    await User.create([
        { email: 'admin@test.com', password: hash, terms: true, role: 'admin', isVerified: true },
        { email: 'staff@test.com', password: hash, terms: true, role: 'staff', isVerified: true },
        { email: 'cust@test.com', password: hash, terms: true, role: 'user', isVerified: true, firstName: 'Rahim' },
    ]);
    for (const [k, e] of [['admin', 'admin@test.com'], ['staff', 'staff@test.com'], ['cust', 'cust@test.com']]) {
        const r = await call('POST', '/login', { body: { email: e, password: 'Passw0rd!' } });
        assert.equal(r.status, 200, `login ${e}`);
        ctx[k] = r.body.accessToken; ctx[`${k}Id`] = r.body.user._id;
    }
});
after(async () => { await mongoose.connection.close(); process.exit(0); });

test('permissions: customer blocked, staff cannot create products', async () => {
    assert.equal((await call('GET', '/admin/orders', { token: ctx.cust })).status, 403);
    assert.equal((await call('POST', '/admin/products', { token: ctx.staff, body: { title: 'x', price: 5, category: 'c' } })).status, 403);
    assert.equal((await call('GET', '/admin/orders')).status, 401);
});

test('settings: default delivery charges 80 / 120', async () => {
    const r = await call('GET', '/public/settings');
    assert.equal(r.body.data.delivery.insideDhakaCharge, 80);
    assert.equal(r.body.data.delivery.outsideDhakaCharge, 120);
    const q = await call('GET', '/public/delivery-quote?zone=outside_dhaka&subtotal=500');
    assert.equal(q.body.data.charge, 120);
});

test('product create/update/list with rich text sanitising, variants and filters', async () => {
    const r = await call('POST', '/admin/products', { token: ctx.admin, body: {
        title: 'Organic Rice 5kg', price: 500, discountPrice: 450, stock: 20, category: 'Grocery', subCategory: 'Rice', status: 'active', tag: 'rice,organic',
        description: '<p>Good <strong>rice</strong><script>alert(1)</script><img src=x onerror=alert(1)></p>',
    } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.ok(!/script|onerror/.test(r.body.data.description), 'html sanitised');
    ctx.p1 = r.body.data._id;

    const v = await call('POST', '/admin/products', { token: ctx.admin, body: {
        title: 'Cotton T-Shirt', price: 600, category: 'Fashion', status: 'active',
        variants: JSON.stringify([{ size: 'M', color: 'Red', stock: 2, price: 650 }, { size: 'L', color: 'Blue', stock: 3 }]),
    } });
    assert.equal(v.status, 201, JSON.stringify(v.body));
    assert.equal(v.body.data.stock, 5, 'stock = sum of variants');
    ctx.p2 = v.body.data._id; ctx.variantId = v.body.data.variants[0]._id;

    assert.equal((await call('POST', '/admin/products', { token: ctx.admin, body: { title: 'Organic Rice 5kg', price: 5, category: 'x' } })).status, 409);
    assert.equal((await call('POST', '/admin/products', { token: ctx.admin, body: { title: 'Bad', price: 10, discountPrice: 20, category: 'x' } })).status, 400);

    const up = await call('PUT', `/admin/products/${ctx.p1}`, { token: ctx.admin, body: { price: 520, description: '<p>New</p>' } });
    assert.equal(up.body.data.price, 520);

    const list = await call('GET', '/admin/products?page=1&limit=1&sort=price_desc', { token: ctx.admin });
    assert.equal(list.body.pagination.total, 2); assert.equal(list.body.data.length, 1); assert.equal(list.body.pagination.pages, 2);
    assert.equal((await call('GET', '/admin/products?q=cotton', { token: ctx.admin })).body.data.length, 1);
    assert.equal((await call('GET', '/admin/products?stock=low', { token: ctx.admin })).body.data.length, 1);

    const q = await call('PATCH', `/admin/products/${ctx.p1}/quick`, { token: ctx.admin, body: { status: 'inactive' } });
    assert.equal(q.body.data.status, 'inactive');
    await call('PATCH', `/admin/products/${ctx.p1}/quick`, { token: ctx.admin, body: { status: 'active' } });
});

test('COD checkout: server-side delivery charge, stock reservation, variant cart', async () => {
    const add = await call('POST', '/createcart', { token: ctx.cust, body: { proId: ctx.p1, userId: ctx.custId } });
    assert.equal(add.status, 201, JSON.stringify(add.body));
    assert.equal((await call('POST', '/createcart', { token: ctx.cust, body: { proId: ctx.p2, userId: ctx.custId } })).status, 400, 'variant required');
    if (!skipVariantOrders()) assert.equal((await call('POST', '/createcart', { token: ctx.cust, body: { proId: ctx.p2, userId: ctx.custId, variantId: ctx.variantId } })).status, 201);

    const form = { cus_name: 'Rahim Uddin', cus_email: 'r@x.com', cus_phone: '01712345678', cus_add1: 'House 1', cus_city: 'Sylhet', cus_postcode: '3100' };
    const pay = await call('POST', '/payment', { token: ctx.cust, body: { ...form, paymentMethod: 'cod', deliveryZone: 'outside_dhaka' } });
    assert.equal(pay.status, 201, JSON.stringify(pay.body));
    assert.equal(pay.body.cod, true);
    // 520 -> discount 450 ; variant 650 ; total = 450 + 650 + 120
    assert.equal(pay.body.totalAmount, skipVariantOrders() ? 450 + 120 : 450 + 650 + 120);
    ctx.order1 = pay.body.orderId;

    const p1 = await Product.findById(ctx.p1); assert.equal(p1.stock, 19);
    if (!skipVariantOrders()) { const p2 = await Product.findById(ctx.p2); assert.equal(p2.stock, 4); assert.equal(p2.variants[0].stock, 1); }
    assert.equal((await call('GET', `/getcart/${ctx.custId}`, { token: ctx.cust })).body.data.length, 0, 'cart cleared');
});

test('out-of-stock is rejected and rolled back', async () => {
    await Product.updateOne({ _id: ctx.p1 }, { $set: { stock: 1 } });
    await call('POST', '/createcart', { token: ctx.cust, body: { proId: ctx.p1, userId: ctx.custId } });
    const cart = await call('POST', '/createcart', { token: ctx.cust, body: { proId: ctx.p1, userId: ctx.custId } });
    assert.equal(cart.status, 400);
    await call('DELETE', '/deletecart/' + (await mongoose.model('Cart').findOne({ user: ctx.custId }))._id, { token: ctx.cust });
    await Product.updateOne({ _id: ctx.p1 }, { $set: { stock: 19 } });
});

test('orders: tabs, counts, status machine, bulk, courier, invoices, cancel restores stock', async () => {
    // create 3 more COD orders inside Dhaka (free threshold off => 80)
    const ids = [ctx.order1];
    for (let i = 0; i < 3; i++) {
        await call('POST', '/createcart', { token: ctx.cust, body: { proId: ctx.p1, userId: ctx.custId } });
        const r = await call('POST', '/payment', { token: ctx.cust, body: { cus_name: 'A', cus_email: 'a@b.com', cus_phone: '01812345678', cus_add1: 'Road 5', cus_city: 'Dhaka', cus_postcode: '1200', paymentMethod: 'cod', deliveryZone: 'inside_dhaka' } });
        assert.equal(r.body.totalAmount, 450 + 80);
        ids.push(r.body.orderId);
    }
    const counts = await call('GET', '/admin/orders/counts', { token: ctx.staff });
    assert.equal(counts.body.data.pending, 4); assert.equal(counts.body.data.all, 4);

    const tab = await call('GET', '/admin/orders?status=pending&limit=2&page=2', { token: ctx.staff });
    assert.equal(tab.body.data.length, 2); assert.equal(tab.body.pagination.total, 4);

    const search = await call('GET', '/admin/orders?q=01812', { token: ctx.admin });
    assert.equal(search.body.pagination.total, 3);

    // staff may move status but not skip backwards
    const s1 = await call('PATCH', `/admin/orders/${ids[0]}/status`, { token: ctx.staff, body: { status: 'processing' } });
    assert.equal(s1.status, 200, JSON.stringify(s1.body));
    assert.equal((await call('PATCH', `/admin/orders/${ids[0]}/status`, { token: ctx.staff, body: { status: 'Order Placed' } })).status, 409);

    // staff cannot use courier / bulk
    assert.equal((await call('POST', `/admin/orders/${ids[0]}/courier`, { token: ctx.staff, body: {} })).status, 403);

    // courier (mock) -> Shipped + tracking
    const c = await call('POST', `/admin/orders/${ids[0]}/courier`, { token: ctx.admin, body: { provider: 'steadfast' } });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(c.body.data.orderStatus, 'Shipped'); assert.match(c.body.data.courier.trackingCode, /^MOCK-/);
    assert.equal((await call('POST', `/admin/orders/${ids[0]}/courier`, { token: ctx.admin, body: {} })).status, 409, 'no double booking');

    // bulk
    const b = await call('POST', '/admin/orders/bulk/status', { token: ctx.admin, body: { ids: ids.slice(1), status: 'processing' } });
    assert.equal(b.body.updated.length, 3);
    const bc = await call('POST', '/admin/orders/bulk/courier', { token: ctx.admin, body: { ids: ids.slice(1, 3) } });
    assert.equal(bc.body.results.filter((r) => r.ok).length, 2);

    // deliver -> COD becomes Paid
    await call('PATCH', `/admin/orders/${ids[0]}/status`, { token: ctx.admin, body: { status: 'delivered' } });
    const d = await call('GET', `/admin/orders/${ids[0]}`, { token: ctx.admin });
    assert.equal(d.body.data.paymentStatus, 'Paid'); assert.ok(d.body.data.statusHistory.length >= 3);

    // invoices
    const inv = await call('GET', `/admin/orders/invoices?ids=${ids.join(',')}`, { token: ctx.admin });
    assert.equal(inv.body.data.orders.length, 4);

    // cancel restores stock exactly once
    const before = (await Product.findById(ctx.p1)).stock;
    const lastId = ids[3];
    assert.equal((await call('PATCH', `/admin/orders/${lastId}/status`, { token: ctx.admin, body: { status: 'cancelled' } })).status, 200);
    assert.equal((await Product.findById(ctx.p1)).stock, before + 1);
    assert.equal((await call('PATCH', `/admin/orders/${lastId}/status`, { token: ctx.admin, body: { status: 'cancelled' } })).status, 409);
    assert.equal((await Product.findById(ctx.p1)).stock, before + 1);

    // csv export
    const csv = await fetch(`${BASE}/admin/orders/export`, { headers: { Authorization: `Bearer ${ctx.admin}` } });
    assert.match(await csv.text(), /"Order","Date"/);
});

test('delivery settings change affects new orders; free-delivery threshold', async () => {
    const s = await call('PUT', '/admin/settings/delivery', { token: ctx.admin, body: { insideDhakaCharge: 60, outsideDhakaCharge: 100, freeDeliveryEnabled: true, freeDeliveryThreshold: 400 } });
    assert.equal(s.status, 200, JSON.stringify(s.body));
    assert.equal((await call('GET', '/public/delivery-quote?zone=inside_dhaka&subtotal=100')).body.data.charge, 60);
    assert.equal((await call('GET', '/public/delivery-quote?zone=inside_dhaka&subtotal=450')).body.data.charge, 0);
    assert.equal((await call('PUT', '/admin/settings/delivery', { token: ctx.staff, body: { insideDhakaCharge: 1 } })).status, 403);
    assert.equal((await call('PUT', '/admin/settings/delivery', { token: ctx.admin, body: { insideDhakaCharge: -5 } })).status, 400);
    await call('PUT', '/admin/settings/delivery', { token: ctx.admin, body: { insideDhakaCharge: 80, outsideDhakaCharge: 120, freeDeliveryEnabled: false } });
});

test('analytics: overview, daily + monthly series, top products', async () => {
    const o = await call('GET', '/admin/analytics/overview?range=30d', { token: ctx.admin });
    assert.equal(o.status, 200, JSON.stringify(o.body));
    const d = o.body.data;
    if (!ctx.ferret) assert.ok(d.totalRevenue > 0);
    // FerretDB evaluates { $sum: 1 } as 0, real MongoDB does not: only assert counts on real MongoDB
    if (!ctx.ferret) assert.ok(d.totalOrders >= 3);
    // Aggregation operators below ($dateToString, $sum:1, timezone match) are not fully supported by FerretDB; verified with mingo + real-Mongo semantics
    if (ctx.ferret) return;
    assert.equal(d.paymentSplit.online.revenue, 0); assert.ok(d.paymentSplit.cod.revenue > 0);
    assert.ok(d.today.sales > 0);
    const daily = await call('GET', '/admin/analytics/sales?view=daily&days=7', { token: ctx.admin });
    assert.equal(daily.body.data.length, 7);
    assert.ok(daily.body.data.at(-1).revenue > 0);
    const monthly = await call('GET', '/admin/analytics/sales?view=monthly&months=6', { token: ctx.admin });
    assert.equal(monthly.body.data.length, 6); assert.ok(monthly.body.data.at(-1).revenue > 0);
    const top = await call('GET', '/admin/analytics/top-products', { token: ctx.admin });
    assert.ok(top.body.data.length >= 1);
});

test('banners, notice, contact messages, team', async () => {
    await call('PUT', '/admin/settings/notice', { token: ctx.admin, body: { text: 'Eid sale!', isActive: true } });
    assert.equal((await call('GET', '/public/settings')).body.data.notice.text, 'Eid sale!');
    assert.equal((await call('POST', '/public/contact', { body: { name: 'Karim', phone: '017', message: 'Hello <b>x</b>' } })).status, 201);
    const m = await call('GET', '/admin/messages', { token: ctx.admin });
    assert.equal(m.body.data[0].message, 'Hello x'); assert.equal(m.body.unread, 1);
    const t = await call('POST', '/admin/users', { token: ctx.admin, body: { email: 'mgr@test.com', password: 'Passw0rd!', role: 'manager' } });
    assert.equal(t.status, 201);
    assert.equal((await call('PATCH', `/admin/users/${ctx.adminId}`, { token: ctx.admin, body: { role: 'staff' } })).status, 400, 'cannot demote self');
    assert.ok((await call('GET', '/admin/audit', { token: ctx.admin })).body.data.length > 5);
});

test('1000 order burst is paginated and fast', async () => {
    const Order = require('../models/orderModel');
    const now = Date.now(); const docs = [];
    for (let i = 0; i < 1000; i++) docs.push({ orderNumber: `EB-9${String(i).padStart(5, '0')}`, user: ctx.custId, products: [{ productId: ctx.p1, title: 'Organic Rice 5kg', price: 450, quantity: 1, totalPrice: 450 }], subtotal: 450, deliveryCharge: 80, totalAmount: 530, paymentMethod: i % 3 ? 'cod' : 'online', paymentStatus: i % 3 ? 'Pending' : 'Paid', orderStatus: ['Order Placed', 'Processing', 'Shipped', 'Delivered'][i % 4], transactionId: `TXN-B-${i}`, shippingAddress: { name: `Cust ${i}`, email: 'c@x.com', phone: `0171${String(i).padStart(7, '0')}`, address1: 'a', city: 'Dhaka' }, createdAt: new Date(now - (i % 24) * 3600000) });
    await Order.insertMany(docs);
    const t0 = Date.now();
    const [l, c, o] = await Promise.all([call('GET', '/admin/orders?status=processing&limit=50', { token: ctx.admin }), call('GET', '/admin/orders/counts', { token: ctx.admin }), call('GET', '/admin/analytics/overview?range=today', { token: ctx.admin })]);
    assert.equal(l.body.data.length, 50); assert.ok(c.body.data.all >= 1000);
    if (!ctx.ferret) assert.ok(o.body.data.today.orders > 500);
    assert.ok(o.body.data.today.sales > 200000);
    assert.ok(Date.now() - t0 < 3000, `took ${Date.now() - t0}ms`);
});

test('business: categories, coupons (checkout + cancel release), reviews, pages, newsletter, tracking', async () => {
    const A = { token: ctx.admin };
    // categories
    const cat = await call('POST', '/admin/categories', { ...A, body: { name: 'Pantry' } });
    assert.equal(cat.status, 201, JSON.stringify(cat.body));
    assert.equal((await call('POST', '/admin/categories', { ...A, body: { name: 'Pantry' } })).status, 409);
    assert.equal((await call('POST', '/admin/categories/import', A)).status, 200);
    const pubCats = await call('GET', '/public/categories');
    assert.ok(pubCats.body.data.some((c) => c.name === 'Pantry'));
    assert.equal((await call('DELETE', `/admin/categories/${(pubCats.body.data.find((c) => c.name === 'Grocery') || {})._id}`, A)).status, 409, 'category in use cannot be deleted');
    // coupons
    assert.equal((await call('POST', '/admin/coupons', { ...A, body: { code: 'x', type: 'percent', value: 10 } })).status, 400);
    const cp = await call('POST', '/admin/coupons', { ...A, body: { code: 'save10', type: 'percent', value: 10, maxDiscount: 30, minOrder: 100, usageLimit: 1, perUserLimit: 1 } });
    assert.equal(cp.status, 201, JSON.stringify(cp.body)); assert.equal(cp.body.data.code, 'SAVE10');
    await call('POST', '/createcart', { token: ctx.cust, body: { proId: ctx.p1, userId: ctx.custId } });
    assert.equal((await call('POST', '/cart/preview', { token: ctx.cust, body: { deliveryZone: 'inside_dhaka', couponCode: 'NOPE' } })).status, 400);
    const pv = await call('POST', '/cart/preview', { token: ctx.cust, body: { deliveryZone: 'inside_dhaka', couponCode: 'save10' } });
    assert.equal(pv.status, 200, JSON.stringify(pv.body));
    assert.equal(pv.body.data.discount, 30, 'capped at maxDiscount'); assert.equal(pv.body.data.total, 450 - 30 + 80);
    const form = { cus_name: 'A', cus_email: 'a@b.com', cus_phone: '01812345678', cus_add1: 'Road 5', paymentMethod: 'cod', deliveryZone: 'inside_dhaka', couponCode: 'SAVE10' };
    const ord = await call('POST', '/payment', { token: ctx.cust, body: form });
    assert.equal(ord.status, 201, JSON.stringify(ord.body)); assert.equal(ord.body.totalAmount, 450 - 30 + 80);
    // single-use: second attempt is refused
    await call('POST', '/createcart', { token: ctx.cust, body: { proId: ctx.p1, userId: ctx.custId } });
    assert.equal((await call('POST', '/payment', { token: ctx.cust, body: form })).status, 400, 'coupon fully redeemed');
    // cancelling releases the coupon
    assert.equal((await call('PATCH', `/admin/orders/${ord.body.orderId}/status`, { ...A, body: { status: 'Cancelled' } })).status, 200);
    assert.equal((await mongoose.model('Coupon').findOne({ code: 'SAVE10' })).usedCount, 0);
    assert.equal((await call('POST', '/payment', { token: ctx.cust, body: form })).status, 201, 'usable again after cancel');
    // reviews: must have a delivered order, then moderation
    assert.equal((await call('POST', `/products/${ctx.p1}/reviews`, { token: ctx.staff, body: { rating: 5, comment: 'great' } })).status, 403, 'needs a delivered order');
    const delivered = (await mongoose.model('Order').findOne({ user: ctx.custId, orderStatus: 'Delivered', 'products.productId': ctx.p1 }));
    if (!delivered) { const o = await mongoose.model('Order').findOne({ user: ctx.custId, orderStatus: { $ne: 'Cancelled' } }); await mongoose.model('Order').updateOne({ _id: o._id }, { $set: { orderStatus: 'Delivered' } }); }
    const rv = await call('POST', `/products/${ctx.p1}/reviews`, { token: ctx.cust, body: { rating: 5, title: 'Nice', comment: 'Very fresh <b>rice</b>' } });
    assert.equal(rv.status, 201, JSON.stringify(rv.body)); assert.equal(rv.body.data.status, 'pending');
    assert.equal((await call('GET', `/products/${ctx.p1}/reviews`)).body.data.length, 0, 'hidden until approved');
    const list = await call('GET', '/admin/reviews?status=pending', A); assert.equal(list.body.data.length, 1);
    await call('PATCH', `/admin/reviews/${list.body.data[0]._id}`, { ...A, body: { status: 'approved', adminReply: 'Thank you!' } });
    const pub = await call('GET', `/products/${ctx.p1}/reviews`);
    assert.equal(pub.body.data.length, 1); assert.equal(pub.body.summary.average, 5); assert.ok(!/<b>/.test(pub.body.data[0].comment));
    assert.equal((await Product.findById(ctx.p1)).ratingCount, 1);
    // CMS pages + newsletter
    const pages = await call('GET', '/public/pages'); assert.ok(pages.body.data.length >= 5);
    const about = await call('GET', '/public/pages/about-us'); assert.equal(about.status, 200);
    const np = await call('POST', '/admin/pages', { ...A, body: { title: 'Shipping info', content: '<p>Hi</p><script>x()</script>' } });
    assert.equal(np.status, 201); assert.ok(!/script/.test(np.body.data.content));
    assert.equal((await call('POST', '/public/subscribe', { body: { email: 'bad' } })).status, 400);
    assert.equal((await call('POST', '/public/subscribe', { body: { email: 'News@Test.com' } })).status, 201);
    assert.equal((await call('POST', '/public/subscribe', { body: { email: 'news@test.com' } })).status, 201, 'duplicate is harmless');
    assert.equal((await call('GET', '/admin/subscribers', A)).body.data.length, 1);
    // tracking needs matching phone
    const orderNo = (await mongoose.model('Order').findOne({ user: ctx.custId }).sort({ createdAt: -1 })).orderNumber;
    assert.equal((await call('POST', '/public/track', { body: { orderNumber: orderNo, phone: '01999999999' } })).status, 404);
    const tr = await call('POST', '/public/track', { body: { orderNumber: orderNo, phone: '+8801812345678' } });
    assert.equal(tr.status, 200, JSON.stringify(tr.body)); assert.ok(tr.body.data.items.length >= 1);
    // staff cannot manage coupons
    assert.equal((await call('GET', '/admin/coupons', { token: ctx.staff })).status, 403);
});

test('home settings: flash sale + brand color validated', async () => {
    const A = { token: ctx.admin };
    assert.equal((await call('PUT', '/admin/settings/home', { ...A, body: { flash: { enabled: true } } })).status, 400, 'flash needs an end date');
    const ends = new Date(Date.now() + 86400000).toISOString();
    assert.equal((await call('PUT', '/admin/settings/home', { ...A, body: { flash: { enabled: true, title: 'Eid Sale', endsAt: ends, productIds: [String(ctx.p1)] }, showTestimonials: false } })).status, 200);
    assert.equal((await call('PUT', '/admin/settings/theme', { ...A, body: { primary: 'red' } })).status, 400);
    assert.equal((await call('PUT', '/admin/settings/theme', { ...A, body: { primary: '#0f766e' } })).status, 200);
    const pub = (await call('GET', '/public/settings')).body.data;
    assert.equal(pub.home.flash.title, 'Eid Sale'); assert.equal(pub.home.flash.productIds[0], String(ctx.p1)); assert.equal(pub.home.showTestimonials, false); assert.equal(pub.theme.primary, '#0f766e');
    assert.equal(pub.home.badges.length, 4, 'default highlights');
});
