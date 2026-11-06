// Role -> permission matrix for the admin dashboard. "admin" can do everything.
const PERMISSIONS = {
    admin: ['*'],
    manager: [
        'dashboard:read', 'products:read', 'products:write', 'products:delete',
        'orders:read', 'orders:update', 'orders:courier', 'orders:bulk',
        'customers:read', 'reports:read', 'settings:read', 'banners:write', 'messages:read', 'messages:write',
        'categories:write', 'coupons:write', 'reviews:read', 'reviews:write', 'pages:write', 'subscribers:read',
    ],
    staff: ['dashboard:read', 'products:read', 'orders:read', 'orders:update', 'messages:read'],
    // legacy roles from the first version of the shop
    editor: ['dashboard:read', 'products:read', 'products:write', 'products:delete'],
    vendor: ['dashboard:read', 'products:read', 'products:write'],
    user: [],
};
const DASHBOARD_ROLES = ['admin', 'manager', 'staff', 'editor', 'vendor'];

const can = (role, perm) => {
    const list = PERMISSIONS[role] || [];
    return list.includes('*') || list.includes(perm);
};
const requirePermission = (...perms) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (perms.every((p) => can(req.user.role, p))) return next();
    return res.status(403).json({ success: false, message: 'Forbidden: your role does not allow this action' });
};
module.exports = { PERMISSIONS, DASHBOARD_ROLES, can, requirePermission };
