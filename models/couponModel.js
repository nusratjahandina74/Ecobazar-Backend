const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
    description: { type: String, trim: true, default: '', maxlength: 200 },
    type: { type: String, enum: ['percent', 'fixed', 'free_delivery'], required: true },
    value: { type: Number, default: 0, min: 0 },            // % or BDT (ignored for free_delivery)
    maxDiscount: { type: Number, default: 0, min: 0 },      // cap for percent coupons, 0 = no cap
    minOrder: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, default: 0, min: 0 },       // total redemptions, 0 = unlimited
    perUserLimit: { type: Number, default: 0, min: 0 },     // per customer, 0 = unlimited
    usedCount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ isActive: 1, expiresAt: 1 });
module.exports = mongoose.model('Coupon', schema);
