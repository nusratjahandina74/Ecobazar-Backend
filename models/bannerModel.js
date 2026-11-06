const mongoose = require('mongoose');
const bannerSchema = new mongoose.Schema({
    title: { type: String, trim: true, default: '' },
    subtitle: { type: String, trim: true, default: '' },
    image: { type: String, required: true },
    link: { type: String, trim: true, default: '' },
    buttonText: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
bannerSchema.index({ isActive: 1, order: 1 });
module.exports = mongoose.model('Banner', bannerSchema);
