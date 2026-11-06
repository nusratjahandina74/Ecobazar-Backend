const axios = require("axios");
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const { createOrderFromCart, restoreOrderStock, reserveStock } = require('../services/orderService');

const BACKEND_URL = () => process.env.BACKEND_URL || "http://localhost:5000";
const FRONTEND_URL = () => process.env.FRONTEND_URL || "http://localhost:5173";
const GATEWAY = () => ({
  storeId: process.env.AAMARPAY_STORE_ID || "aamarpaytest",
  signatureKey: process.env.AAMARPAY_SIGNATURE_KEY || "dbb74894e82415a2f7ff0ec3a97e4183",
  apiUrl: process.env.AAMARPAY_API_URL || "https://sandbox.aamarpay.com/jsonpost.php",
  verifyUrl: process.env.AAMARPAY_VERIFY_URL || ""
});

const effectivePrice = (p) => (p.discountPrice && p.discountPrice > 0 ? p.discountPrice : p.price);
const toFrontend = (path, params) => `${FRONTEND_URL()}${path}?${new URLSearchParams(params).toString()}`;

const REQUIRED = ['cus_name', 'cus_email', 'cus_add1', 'cus_phone'];

const paymentController = async (req, res) => {
  const body = req.body || {};
  const userId = req.user.id;

  const missing = REQUIRED.filter((k) => !body[k] || !String(body[k]).trim());
  if (missing.length) {
    return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
  }
  const paymentMethod = body.paymentMethod === 'cod' ? 'cod' : 'online';
  const deliveryZone = body.deliveryZone === 'outside_dhaka' ? 'outside_dhaka' : 'inside_dhaka';
  const clean = (k, max = 200) => String(body[k] || '').trim().slice(0, max);
  const shipping = {
    name: clean('cus_name', 100), email: clean('cus_email', 150), phone: clean('cus_phone', 30).replace(/\s+/g, ''),
    address1: clean('cus_add1'), address2: clean('cus_add2') || 'N/A', city: clean('cus_city', 80) || (deliveryZone === 'inside_dhaka' ? 'Dhaka' : 'Outside Dhaka'),
    state: clean('cus_state', 80) || 'N/A', postcode: clean('cus_postcode', 20) || '1000',
  };

  let order;
  try {
    // Prices, stock check, delivery charge (80 inside / 120 outside Dhaka by default) are all computed on the server.
    order = await createOrderFromCart({ userId, shipping, paymentMethod, deliveryZone, couponCode: clean('couponCode', 30) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.log('Order create error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not place the order' });
  }

  if (paymentMethod === 'cod') {
    return res.status(201).json({
      success: true, cod: true, message: 'Order placed successfully. Pay cash on delivery.',
      orderId: order._id, orderNumber: order.orderNumber, transactionId: order.transactionId, totalAmount: order.totalAmount,
    });
  }

  try {
    const g = GATEWAY();
    const transactionId = order.transactionId;
    // Callback routes are mounted at the app root: /payment/success|fail|cancel|ipn
    const paymentData = {
      store_id: g.storeId,
      tran_id: transactionId,
      success_url: `${BACKEND_URL()}/payment/success?txnId=${transactionId}`,
      fail_url: `${BACKEND_URL()}/payment/fail?txnId=${transactionId}`,
      cancel_url: `${BACKEND_URL()}/payment/cancel?txnId=${transactionId}`,
      amount: order.totalAmount.toFixed(2),
      currency: "BDT",
      signature_key: g.signatureKey,
      desc: "EcoBazaar Product Purchase",
      cus_name: shipping.name, cus_email: shipping.email, cus_add1: shipping.address1, cus_add2: shipping.address2,
      cus_city: shipping.city, cus_state: shipping.state, cus_postcode: shipping.postcode,
      cus_country: "Bangladesh", cus_phone: shipping.phone, type: "json"
    };

    const { data } = await axios.post(g.apiUrl, new URLSearchParams(paymentData).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 20000 });

    let responseData = data;
    if (typeof data === "string") { try { responseData = JSON.parse(data); } catch (e) { responseData = null; } }

    if (responseData && responseData.payment_url) {
      return res.status(200).json({ success: true, message: "Payment link generated successfully", paymentUrl: responseData.payment_url,
        orderId: order._id, orderNumber: order.orderNumber, transactionId });
    }
    throw new Error('gateway rejected');
  } catch (error) {
    console.log("Payment init error:", error.message);
    order.paymentStatus = 'Failed'; order.orderStatus = 'Cancelled';
    order.statusHistory.push({ status: 'Cancelled', note: 'Payment gateway unavailable' });
    await order.save();
    await restoreOrderStock(order._id);
    return res.status(502).json({ success: false, message: "Payment gateway is unavailable right now. Please try again or choose Cash on Delivery." });
  }
};

const verifyWithGateway = async (transactionId) => {
  const g = GATEWAY();
  if (!g.verifyUrl) return null;
  try {
    const { data } = await axios.get(g.verifyUrl, {
      params: { request_id: transactionId, store_id: g.storeId, signature_key: g.signatureKey, type: "json" },
      timeout: 15000
    });
    const status = (data && (data.pay_status || data.status_code)) || "";
    return String(status).toLowerCase() === "successful" || String(status) === "2";
  } catch (e) {
    return false;
  }
};

const getTxn = (req) => req.query.txnId || (req.body && req.body.mer_txnid);

const markPaid = async (order, payload) => {
  order.paymentStatus = 'Paid';
  order.gatewayResponse = payload;
  if (order.orderStatus === 'Cancelled') {
    // Customer paid after our 45-minute hold expired: try to take the stock again.
    try {
      await reserveStock(order.products.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, title: l.title, variantLabel: l.variantLabel })));
      order.stockRestored = false; order.orderStatus = 'Processing';
      order.statusHistory.push({ status: 'Processing', note: 'Payment received after hold expired - stock re-reserved' });
    } catch (e) {
      order.internalNote = `${order.internalNote ? order.internalNote + '\n' : ''}PAID after the order expired and stock ran out - refund or fulfil manually.`;
    }
  } else {
    order.orderStatus = 'Processing';
    order.statusHistory.push({ status: 'Processing', note: 'Online payment confirmed' });
  }
  await order.save();
  await Cart.deleteMany({ user: order.user });
};

const paymentSuccessController = async (req, res) => {
  try {
    const transactionId = getTxn(req);
    const order = transactionId ? await Order.findOne({ transactionId }) : null;
    if (!order) return res.redirect(toFrontend('/order-failed', { reason: 'not_found' }));

    if (order.paymentStatus === 'Paid') {
      return res.redirect(toFrontend('/order-success', { txnId: transactionId }));
    }

    const body = req.body || {};
    const statusOk = String(body.pay_status || '').toLowerCase() === 'successful';
    const amountOk = body.amount === undefined || Number(body.amount) === Number(order.totalAmount);
    let verified = statusOk && amountOk;
    if (verified) {
      const remote = await verifyWithGateway(transactionId);
      if (remote === false) verified = false;
    }

    if (!verified) {
      if (order.paymentStatus === 'Pending') {
        order.paymentStatus = 'Failed';
        order.orderStatus = 'Cancelled';
        order.gatewayResponse = body;
        order.statusHistory.push({ status: 'Cancelled', note: 'Payment could not be verified' });
        await order.save();
        await restoreOrderStock(order._id);
      }
      return res.redirect(toFrontend('/order-failed', { txnId: transactionId, reason: 'unverified' }));
    }

    await markPaid(order, body);
    return res.redirect(toFrontend('/order-success', { txnId: transactionId }));
  } catch (error) {
    console.log("Payment success callback error:", error.message);
    return res.redirect(toFrontend('/order-failed', { reason: 'server_error' }));
  }
};

const paymentFailController = async (req, res) => {
  try {
    const transactionId = getTxn(req);
    const order = transactionId ? await Order.findOne({ transactionId }) : null;
    if (order && order.paymentStatus === 'Pending') {
      order.paymentStatus = 'Failed';
      order.orderStatus = 'Cancelled';
      order.gatewayResponse = req.body;
      order.statusHistory.push({ status: 'Cancelled', note: 'Payment failed' });
      await order.save();
      await restoreOrderStock(order._id);
    }
    return res.redirect(toFrontend('/order-failed', { txnId: transactionId || '', reason: 'failed' }));
  } catch (error) {
    return res.redirect(toFrontend('/order-failed', { reason: 'server_error' }));
  }
};

const paymentCancelController = async (req, res) => {
  try {
    const transactionId = getTxn(req);
    const order = transactionId ? await Order.findOne({ transactionId }) : null;
    if (order && order.paymentStatus === 'Pending') {
      order.paymentStatus = 'Cancelled';
      order.orderStatus = 'Cancelled';
      order.gatewayResponse = req.body;
      order.statusHistory.push({ status: 'Cancelled', note: 'Customer cancelled payment' });
      await order.save();
      await restoreOrderStock(order._id);
    }
    return res.redirect(toFrontend('/order-failed', { txnId: transactionId || '', reason: 'cancelled' }));
  } catch (error) {
    return res.redirect(toFrontend('/order-failed', { reason: 'server_error' }));
  }
};

const paymentIPNController = async (req, res) => {
  try {
    const { mer_txnid, pay_status, amount } = req.body || {};
    const order = await Order.findOne({ transactionId: mer_txnid });

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.paymentStatus !== 'Paid' && pay_status === 'Successful' && Number(amount) === Number(order.totalAmount)) {
      const remote = await verifyWithGateway(mer_txnid);
      if (remote !== false) await markPaid(order, req.body);
    }
    return res.status(200).json({ success: true, message: "IPN Processed" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  paymentController,
  paymentSuccessController,
  paymentFailController,
  paymentCancelController,
  paymentIPNController
};
