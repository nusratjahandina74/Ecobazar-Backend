const axios = require("axios");
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');

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

const REQUIRED = ['cus_name', 'cus_email', 'cus_add1', 'cus_city', 'cus_postcode', 'cus_phone'];

const paymentController = async (req, res) => {
  const body = req.body || {};
  const userId = req.user.id;

  const missing = REQUIRED.filter((k) => !body[k] || !String(body[k]).trim());
  if (missing.length) {
    return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
  }
  const { cus_name, cus_email, cus_add1, cus_add2, cus_city, cus_state, cus_postcode, cus_phone } = body;

  try {
    const cart = await Cart.find({ user: userId }).populate('product');

    if (!cart || cart.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }
    let dbTotalPrice = 0;
    const pro = [];
    for (const item of cart) {
      if (!item.product) continue;
      if (item.quantity > item.product.stock) {
        return res.status(400).json({
          success: false,
          message: `"${item.product.title}" has only ${item.product.stock} left in stock. Please update your cart.`
        });
      }
      const price = effectivePrice(item.product);
      const lineTotal = price * item.quantity;
      dbTotalPrice += lineTotal;
      pro.push({
        productId: item.product._id,
        title: item.product.title,
        price,
        sku: item.product.sku,
        quantity: item.quantity,
        totalPrice: lineTotal
      });
    }
    if (pro.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = new Order({
      user: userId,
      products: pro,
      totalAmount: dbTotalPrice,
      transactionId,
      paymentStatus: 'Pending',
      orderStatus: 'Order Placed',
      shippingAddress: {
        name: cus_name,
        email: cus_email,
        phone: cus_phone,
        address1: cus_add1,
        address2: cus_add2 || "N/A",
        city: cus_city,
        state: cus_state || "N/A",
        postcode: cus_postcode
      }
    });
    await newOrder.save();

    const g = GATEWAY();
    // Callback routes are mounted at the app root: /payment/success|fail|cancel|ipn
    const paymentData = {
      store_id: g.storeId,
      tran_id: transactionId,
      success_url: `${BACKEND_URL()}/payment/success?txnId=${transactionId}`,
      fail_url: `${BACKEND_URL()}/payment/fail?txnId=${transactionId}`,
      cancel_url: `${BACKEND_URL()}/payment/cancel?txnId=${transactionId}`,
      amount: dbTotalPrice.toFixed(2),
      currency: "BDT",
      signature_key: g.signatureKey,
      desc: "EcoBazaar Product Purchase",
      cus_name,
      cus_email,
      cus_add1,
      cus_add2: cus_add2 || "N/A",
      cus_city,
      cus_state: cus_state || "N/A",
      cus_postcode,
      cus_country: "Bangladesh",
      cus_phone,
      type: "json"
    };

    const { data } = await axios.post(
      g.apiUrl,
      new URLSearchParams(paymentData).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 20000 }
    );

    let responseData = data;
    if (typeof data === "string") {
      try { responseData = JSON.parse(data); } catch (e) { responseData = null; }
    }

    if (responseData && responseData.payment_url) {
      return res.status(200).json({
        success: true,
        message: "Payment link generated successfully",
        paymentUrl: responseData.payment_url,
        orderId: newOrder._id,
        transactionId
      });
    }

    newOrder.paymentStatus = 'Failed';
    await newOrder.save();
    return res.status(400).json({ success: false, message: "Payment gateway rejected the request", gatewayResponse: responseData });

  } catch (error) {
    console.log("Payment init error:", error.message);
    return res.status(500).json({ success: false, message: "Payment initialization failed" });
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
  order.orderStatus = 'Processing';
  order.gatewayResponse = payload;
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
        order.gatewayResponse = body;
        await order.save();
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
      order.gatewayResponse = req.body;
      await order.save();
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
      await order.save();
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
