const mongoose = require('mongoose');
const { Schema } = mongoose;

const ORDER_STATUSES = ['Order Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']; // "Order Placed" == Pending
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Cancelled', 'Refunded'];

const orderSchema = new Schema({
    orderNumber: { type: String, index: true },     // e.g. EB-000123
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    products: [{
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variantId: { type: Schema.Types.ObjectId },
        variantLabel: { type: String },
        title: { type: String, required: true },
        price: { type: Number, required: true },
        sku: { type: String },
        image: { type: String },
        quantity: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
    }],
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    couponCode: { type: String },
    couponId: { type: Schema.Types.ObjectId },
    deliveryCharge: { type: Number, default: 0 },
    deliveryZone: { type: String, enum: ['inside_dhaka', 'outside_dhaka'], default: 'inside_dhaka' },
    totalAmount: { type: Number, required: true },  // subtotal - discountAmount + deliveryCharge
    currency: { type: String, default: 'BDT' },
    paymentMethod: { type: String, enum: ['online', 'cod'], default: 'online' },
    transactionId: { type: String, required: true, unique: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
    orderStatus: { type: String, enum: ORDER_STATUSES, default: 'Order Placed' },
    shippingAddress: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        address1: { type: String, required: true },
        address2: { type: String },
        city: { type: String, required: true },
        state: { type: String },
        postcode: { type: String },
    },
    courier: {
        provider: { type: String, enum: ['pathao', 'steadfast', 'manual', 'mock', null], default: null },
        consignmentId: { type: String },
        trackingCode: { type: String },
        status: { type: String },
        sentAt: { type: Date },
        error: { type: String },
    },
    statusHistory: [{
        status: String,
        note: String,
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        _id: false,
    }],
    internalNote: { type: String },
    stockRestored: { type: Boolean, default: false },
    invoicePrintedAt: { type: Date },
    gatewayResponse: { type: Object },
}, { timestamps: true });

// Dashboard tabs (status + newest first) and filters
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ paymentMethod: 1, createdAt: -1 });
orderSchema.index({ deliveryZone: 1, createdAt: -1 });
orderSchema.index({ 'shippingAddress.phone': 1 });
orderSchema.index({ 'courier.consignmentId': 1 }, { sparse: true });
// Analytics: revenue by day only scans non-cancelled orders
orderSchema.index({ createdAt: -1, orderStatus: 1, paymentMethod: 1 });

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
