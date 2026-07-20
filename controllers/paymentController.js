const axios = require("axios");
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');

const paymentController = async (req, res) => {
  const {
    userId, cus_name, cus_email,
    cus_add1, cus_add2, cus_city, cus_state,
    cus_postcode, cus_phone
  } = req.body;

  try {
    const cart = await Cart.find({ user: userId }).populate('product');

    if (!cart || cart.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let dbTotalPrice = 0;
    let pro = [];
    cart.forEach(item => {
      if (item.totalPrice) {
        dbTotalPrice += Number(item.totalPrice);
      } else if (item.product && item.product.price) {
        dbTotalPrice += Number(item.product.price) * Number(item.quantity);
      }

      if (item.product) {
        pro.push({
          productId: item.product._id,
          title: item.product.title,
          price: item.product.price,
          sku: item.product.sku,
          quantity: item.quantity,
          totalPrice: item.totalPrice || (item.product.price * item.quantity)
        });
      }
    });

    const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = new Order({
      user: userId,
      products: pro,
      totalAmount: dbTotalPrice,
      transactionId: transactionId,
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
    const BASE_URL = process.env.BACKEND_URL || "http://localhost:5000";

    const paymentData = {
      store_id: "aamarpaytest",
      tran_id: transactionId,
      success_url: `${BASE_URL}/api/v1/payment/success?txnId=${transactionId}`,
      fail_url: `${BASE_URL}/api/v1/payment/fail?txnId=${transactionId}`,
      cancel_url: `${BASE_URL}/api/v1/payment/cancel?txnId=${transactionId}`,
      amount: dbTotalPrice.toString(),
      currency: "BDT",
      signature_key: "dbb74894e82415a2f7ff0ec3a97e4183",
      desc: "E-commerce Product Purchase",
      cus_name: cus_name,
      cus_email: cus_email,
      cus_add1: cus_add1,
      cus_add2: cus_add2 || "N/A",
      cus_city: cus_city,
      cus_state: cus_state || "N/A",
      cus_postcode: cus_postcode,
      cus_country: "Bangladesh",
      cus_phone: cus_phone,
      type: "json"
    };

    const { data } = await axios.post(
      "https://aamarpay.com",
      new URLSearchParams(paymentData).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    let responseData = data;
    if (typeof data === "string") {
        try { responseData = JSON.parse(data); } catch (e) {
            res.setHeader("Content-Type", "text/html");
            return res.status(200).send(data);
        }
    }

    if (responseData && responseData.payment_url) {
        return res.status(200).json({
          success: true,
          message: "Payment link generated successfully",
          paymentUrl: responseData.payment_url, 
          orderId: newOrder._id,
          transactionId: transactionId
        });
    }

    return res.status(400).json({ success: false, message: "Gateway error", gatewayResponse: responseData });

  } catch (error) {
    return res.status(500).json({ message: "Payment Failed", error: error.message });
  }
};
const paymentSuccessController = async (req, res) => {
    try {
        const transactionId = req.query.txnId || req.body.mer_txnid;
        const order = await Order.findOne({ transactionId });

        if (!order) return res.status(404).send("<h3>Order not found!</h3>");

        if (order.paymentStatus === 'Paid') {
            return res.redirect(`http://localhost:3000/payment-success?txnId=${transactionId}`);
        }

        order.paymentStatus = 'Paid';
        order.orderStatus = 'Processing';
        order.gatewayResponse = req.body;  
        await order.save();
        
        await Cart.deleteMany({ user: order.user });
        
        return res.redirect(`http://localhost:3000/payment-success?txnId=${transactionId}`);
    } catch (error) {
        return res.status(500).send(`<h3>Error: ${error.message}</h3>`);
    }
};
const paymentFailController = async (req, res) => {
    try {
        const transactionId = req.query.txnId || req.body.mer_txnid;
        const order = await Order.findOne({ transactionId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found!" });
        }
        order.paymentStatus = 'Failed';
        order.gatewayResponse = req.body;
        await order.save();
        return res.status(200).json({
            success: true,
            message: "Payment failed flow executed successfully. Order updated to Failed.",
            transactionId,
            paymentStatus: order.paymentStatus
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
const paymentCancelController = async (req, res) => {
    try {
        const transactionId = req.query.txnId || req.body.mer_txnid;
        const order = await Order.findOne({ transactionId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found!" });
        }
        order.paymentStatus = 'Cancelled';
        order.orderStatus = 'Cancelled';
        order.gatewayResponse = req.body;
        await order.save();
        return res.status(200).json({
            success: true,
            message: "Payment cancelled by user. Order status updated to Cancelled.",
            transactionId,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
const paymentIPNController = async (req, res) => {
    try {
        const { mer_txnid, pay_status, amount } = req.body;
        const order = await Order.findOne({ transactionId: mer_txnid });

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.paymentStatus !== 'Paid' && pay_status === 'Successful' && Number(amount) === order.totalAmount) {
            order.paymentStatus = 'Paid';
            order.orderStatus = 'Processing';
            order.gatewayResponse = req.body;
            await order.save();
            await Cart.deleteMany({ user: order.user });
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
