const AuditLog = require('../models/auditLogModel');

// Fire-and-forget: an audit failure must never break the real request.
const audit = (req, action, entity, entityId, summary, meta) => {
    try {
        AuditLog.create({
            actor: req.user && req.user.id, actorEmail: req.user && req.user.email, actorRole: req.user && req.user.role,
            action, entity, entityId: entityId ? String(entityId) : undefined, summary, meta, ip: req.ip,
        }).catch((e) => console.error('[audit]', e.message));
    } catch (e) { console.error('[audit]', e.message); }
};
module.exports = audit;
