const axios = require('axios');
// Steadfast Courier merchant API. Set STEADFAST_API_KEY + STEADFAST_SECRET_KEY (and optionally STEADFAST_BASE_URL).
const base = () => (process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1').replace(/\/+$/, '');
const headers = () => ({ 'Api-Key': process.env.STEADFAST_API_KEY, 'Secret-Key': process.env.STEADFAST_SECRET_KEY, 'Content-Type': 'application/json' });
const isConfigured = () => !!(process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY);

const address = (a) => [a.address1, a.address2 && a.address2 !== 'N/A' ? a.address2 : '', a.city, a.state && a.state !== 'N/A' ? a.state : '', a.postcode].filter(Boolean).join(', ');

const createParcel = async (order) => {
    const cod = order.paymentMethod === 'cod' && order.paymentStatus !== 'Paid' ? order.totalAmount : 0;
    const { data } = await axios.post(`${base()}/create_order`, {
        invoice: order.orderNumber || String(order._id),
        recipient_name: order.shippingAddress.name,
        recipient_phone: String(order.shippingAddress.phone).replace(/\s+/g, ''),
        recipient_address: address(order.shippingAddress),
        cod_amount: cod,
        note: order.internalNote || undefined,
    }, { headers: headers(), timeout: 20000 });
    const c = data && data.consignment;
    if (!c || !c.consignment_id) throw new Error((data && data.message) || 'Steadfast did not return a consignment id');
    return { consignmentId: String(c.consignment_id), trackingCode: c.tracking_code, status: c.status || 'in_review', raw: data };
};

const getStatus = async (consignmentId) => {
    const { data } = await axios.get(`${base()}/status_by_cid/${encodeURIComponent(consignmentId)}`, { headers: headers(), timeout: 15000 });
    return { status: data.delivery_status || 'unknown', raw: data };
};

module.exports = { isConfigured, createParcel, getStatus };
