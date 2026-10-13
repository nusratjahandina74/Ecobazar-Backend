const sendError = require('../utils/sendError');
const mongoose = require('mongoose');
const Order = require('../models/orderModel');

const ORDER_STATUSES = ['Order Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const SAFE_FIELDS = '-gatewayResponse -__v';

const myOrdersController = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).select(SAFE_FIELDS).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'Orders fetched successfully', totalOrders: orders.length, data: orders });
  } catch (error) {
    console.log(error);
    return sendError(res, error);
  }
};
const orderByTransactionController = async (req, res) => {
  try {
    const order = await Order.findOne({ transactionId: req.params.txnId }).select(SAFE_FIELDS);
    if (!order || (req.user.role !== 'admin' && String(order.user) !== req.user.id)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.status(200).json({ success: true, message: 'Order found', data: order });
  } catch (error) {
    console.log(error);
    return sendError(res, error);
  }
};

const allOrdersController = async (req, res) => {
  try {
    const orders = await Order.find({}).select(SAFE_FIELDS).populate('user', 'email firstName lastName').sort({ createdAt: -1 });
    return res.status(200).json({ success: true, message: 'All orders fetched successfully', totalOrders: orders.length, data: orders });
  } catch (error) {
    console.log(error);
    return sendError(res, error);
  }
};

const updateOrderStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Order ID format' });
    }
    if (!ORDER_STATUSES.includes(orderStatus)) {
      return res.status(400).json({ success: false, message: `orderStatus must be one of: ${ORDER_STATUSES.join(', ')}` });
    }
    const order = await Order.findByIdAndUpdate(id, { orderStatus }, { new: true }).select(SAFE_FIELDS);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    return res.status(200).json({ success: true, message: 'Order status updated', data: order });
  } catch (error) {
    console.log(error);
    return sendError(res, error);
  }
};

module.exports = { myOrdersController, orderByTransactionController, allOrdersController, updateOrderStatusController };
