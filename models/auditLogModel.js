const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorEmail: String,
    actorRole: String,
    action: { type: String, required: true },       // e.g. order.status, product.update
    entity: String,                                  // order | product | user | setting ...
    entityId: String,
    summary: String,
    meta: Object,
    ip: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ createdAt: -1 });
schema.index({ entity: 1, entityId: 1, createdAt: -1 });
// Keep one year of history automatically
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });
module.exports = mongoose.model('AuditLog', schema);
