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
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
})
cartSchema.index({ product: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('Cart',cartSchema)