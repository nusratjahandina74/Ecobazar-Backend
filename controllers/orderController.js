const sendError = require('../utils/sendError');
const Order = require('../models/orderModel');

const SAFE_FIELDS = '-gatewayResponse -__v';

const myOrdersController = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).select(SAFE_FIELDS + ' -statusHistory').sort({ createdAt: -1 }).limit(100).lean();
    return res.status(200).json({ success: true, message: 'Orders fetched successfully', totalOrders: orders.length, data: orders });
  } catch (error) {
    console.log(error);
    return sendError(res, error);
  }
};
const orderByTransactionController = async (req, res) => {
  try {
    const order = await Order.findOne({ transactionId: req.params.txnId }).select(SAFE_FIELDS);
    if (!order || (!['admin', 'manager', 'staff'].includes(req.user.role) && String(order.user) !== req.user.id)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.status(200).json({ success: true, message: 'Order found', data: order });
  } catch (error) {
    console.log(error);
    return sendError(res, error);
  }
};

module.exports = { myOrdersController, orderByTransactionController };
