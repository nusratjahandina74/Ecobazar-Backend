const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, default: '' },          // sanitized rich-text HTML
    isActive: { type: Boolean, default: true },
    showInFooter: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
}, { timestamps: true });
module.exports = mongoose.model('Page', schema);
