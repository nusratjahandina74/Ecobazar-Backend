const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 100, default: '' },
    comment: { type: String, trim: true, maxlength: 1500, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    verified: { type: Boolean, default: false },
    adminReply: { type: String, trim: true, maxlength: 800, default: '' },
}, { timestamps: true });
schema.index({ product: 1, user: 1 }, { unique: true });
schema.index({ product: 1, status: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model('Review', schema);
