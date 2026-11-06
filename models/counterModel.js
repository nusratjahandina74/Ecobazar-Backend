const mongoose = require('mongoose');
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);

// Atomic, gap-free-enough sequence (used for human friendly order numbers)
Counter.next = async (name) => {
    const doc = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true });
    return doc.seq;
};
module.exports = Counter;
