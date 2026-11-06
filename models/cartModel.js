const mongoose = require('mongoose')
const {Schema} = mongoose
const cartSchema = new Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        min: 1,
        required: true
    },
    totalPrice: {
        type: Number, 
        required: true 
    },
    price: { 
        type: Number, 
        required: true 
    }, 
    variantId: { type: mongoose.Schema.Types.ObjectId },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
})
cartSchema.index({ user: 1, product: 1, variantId: 1 }, { unique: true });
cartSchema.index({ user: 1 });
module.exports = mongoose.model('Cart',cartSchema)