const axios = require('axios');
// Pathao Courier Merchant API. Env: PATHAO_BASE_URL, PATHAO_CLIENT_ID, PATHAO_CLIENT_SECRET, PATHAO_USERNAME, PATHAO_PASSWORD, PATHAO_STORE_ID
// (sandbox base url: https://courier-api-sandbox.pathao.com , live: https://api-hermes.pathao.com)
const base = () => (process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com').replace(/\/+$/, '');
const isConfigured = () => !!(process.env.PATHAO_CLIENT_ID && process.env.PATHAO_CLIENT_SECRET && process.env.PATHAO_USERNAME && process.env.PATHAO_PASSWORD && (process.env.PATHAO_STORE_ID));

let token = null; let tokenExp = 0;
const getToken = async () => {
    if (token && tokenExp > Date.now() + 60000) return token;
    const { data } = await axios.post(`${base()}/aladdin/api/v1/issue-token`, {
        client_id: process.env.PATHAO_CLIENT_ID, client_secret: process.env.PATHAO_CLIENT_SECRET,
        username: process.env.PATHAO_USERNAME, password: process.env.PATHAO_PASSWORD, grant_type: 'password',
    }, { timeout: 15000 });
    token = data.access_token; tokenExp = Date.now() + (Number(data.expires_in) || 3600) * 1000;
    return token;
};

const address = (a) => [a.address1, a.address2 && a.address2 !== 'N/A' ? a.address2 : '', a.city].filter(Boolean).join(', ');

const createParcel = async (order, settings) => {
    const t = await getToken();
    const cod = order.paymentMethod === 'cod' && order.paymentStatus !== 'Paid' ? Math.round(order.totalAmount) : 0;
    const { data } = await axios.post(`${base()}/aladdin/api/v1/orders`, {
        store_id: Number(process.env.PATHAO_STORE_ID || (settings && settings.courier && settings.courier.pathaoStoreId)),
        merchant_order_id: order.orderNumber || String(order._id),
        recipient_name: order.shippingAddress.name,
        recipient_phone: String(order.shippingAddress.phone).replace(/\s+/g, ''),
        recipient_address: address(order.shippingAddress),
        delivery_type: 48, item_type: 2,
        special_instruction: order.internalNote || '',
        item_quantity: order.products.reduce((s, p) => s + p.quantity, 0),
        item_weight: 0.5,
        amount_to_collect: cod,
    }, { headers: { Authorization: `Bearer ${t}` }, timeout: 20000 });
    const d = data && data.data;
    if (!d || !d.consignment_id) throw new Error((data && data.message) || 'Pathao did not return a consignment id');
    return { consignmentId: String(d.consignment_id), trackingCode: String(d.consignment_id), status: d.order_status || 'Pending', raw: data };
};

const getStatus = async (consignmentId) => {
    const t = await getToken();
    const { data } = await axios.get(`${base()}/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`, { headers: { Authorization: `Bearer ${t}` }, timeout: 15000 });
    return { status: (data.data && data.data.order_status) || 'unknown', raw: data };
};

module.exports = { isConfigured, createParcel, getStatus };
