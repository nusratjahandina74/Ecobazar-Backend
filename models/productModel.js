const mongoose = require('mongoose')
const { Schema } = mongoose
const productSchema = new Schema({
    title: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String
    },
    price: {
        type: Number,
        required: true
    },
    discountPrice: {
        type: Number
    },
    sku: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    stock: {
        type: Number,
        min: 0,
        default: 0
    },
    shortDescription: {
        type: String
    },
    category: {
        type: String,
        required: true
    },
    subCategory: {
        type: String
    },
    tag: [
        {
            type: String
        }
    ],
    additionalInfo: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'inactive'],
        default: 'pending'
    },
    images: [
        {
            url: {
                type: String,
            },
            isMain: {
                type: Boolean,
                default: false
            }
        }
    ]


}, { timestamps: true })
module.exports = mongoose.model('Product', productSchema)