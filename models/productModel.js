const mongoose = require('mongoose');
const { Schema } = mongoose;

const variantSchema = new Schema({
    sku: { type: String, trim: true },
    label: { type: String, trim: true },          // e.g. "Red / XL" (auto-built when empty)
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    price: { type: Number, min: 0 },
    discountPrice: { type: Number, min: 0 },
    stock: { type: Number, min: 0, default: 0 },
    image: { type: String },
    isActive: { type: Boolean, default: true },
}, { _id: true });

const productSchema = new Schema({
    title: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, trim: true, index: true },
    description: { type: String },                 // sanitized rich-text HTML
    shortDescription: { type: String },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0 },
    sku: { type: String, required: true, unique: true, trim: true },
    stock: { type: Number, min: 0, default: 0 },
    brand: { type: String, trim: true },
    unit: { type: String, trim: true },            // kg, piece, litre ...
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, trim: true },
    tag: [{ type: String }],
    additionalInfo: { type: String },
    status: { type: String, enum: ['pending', 'active', 'inactive'], default: 'pending' },
    variants: [variantSchema],
    images: [{ url: { type: String }, isMain: { type: Boolean, default: false } }],
    soldCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
}, { timestamps: true });

// Fast storefront + dashboard listing / filtering
productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ category: 1, subCategory: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ price: 1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index({ 'variants.sku': 1 }, { sparse: true });

module.exports = mongoose.model('Product', productSchema);
