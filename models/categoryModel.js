const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true, maxlength: 80 },
    slug: { type: String, trim: true },
    image: { type: String, default: '' },
    description: { type: String, trim: true, default: '', maxlength: 300 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    showOnHome: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ isActive: 1, order: 1 });
module.exports = mongoose.model('Category', schema);
