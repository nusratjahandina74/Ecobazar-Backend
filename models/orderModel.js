const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    products: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            },
            title: { type: String, required: true },
            price: { type: Number, required: true },
            sku: { type: String },
            quantity: { type: Number, required: true },
            totalPrice: { type: Number, required: true }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'BDT'
    },
    transactionId: {
        type: String,
        required: true,
        unique: true 
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Cancelled'],
        default: 'Pending'
    },
    orderStatus: {
        type: String,
        enum: ['Order Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Order Placed'
    },
    shippingAddress: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        address1: { type: String, required: true },
        address2: { type: String },
        city: { type: String, required: true },
        state: { type: String },
        postcode: { type: String }
    },
    gatewayResponse: {
        type: Object
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
