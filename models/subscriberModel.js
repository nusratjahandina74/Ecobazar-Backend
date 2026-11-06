const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 150 },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ createdAt: -1 });
module.exports = mongoose.model('Subscriber', schema);
