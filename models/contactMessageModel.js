const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 150 },
    phone: { type: String, trim: true, maxlength: 30 },
    subject: { type: String, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    isRead: { type: Boolean, default: false },
    adminNote: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });
schema.index({ isRead: 1, createdAt: -1 });
module.exports = mongoose.model('ContactMessage', schema);
