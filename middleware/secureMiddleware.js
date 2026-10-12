const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Verifies "Authorization: Bearer <access token>" and loads the live user record.
// Only tokens issued by /login (type === 'access') are accepted, so the
// e-mail verification / password-reset tokens (same secret) can never be used as a session.
const secureMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing or malformed token' });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Token format must be Bearer <token>' });
  }

  try {
    const decoded = jwt.verify(parts[1], process.env.ACCESS_TOKEN_SECRET);
    if (decoded.type !== 'access') {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token type' });
    }
    const user = await User.findById(decoded.id).select('email role isHold');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User no longer exists' });
    }
    if (user.isHold) {
      return res.status(403).json({ success: false, message: 'Your account is on hold. Please contact support.' });
    }
    // role is read from the database, never trusted from the token payload
    req.user = { id: String(user._id), email: user.email, role: user.role };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Unauthorized: Token has expired' });
    }
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token signature' });
  }
};

// Usage: authorizeRoles('admin', 'editor')
const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden: you do not have permission for this action' });
  }
  next();
};

// The :param (default "id") must be the caller's own id, unless the caller is admin.
const selfOrAdmin = (param = 'id') => (req, res, next) => {
  if (req.user.role === 'admin' || req.user.id === String(req.params[param])) return next();
  return res.status(403).json({ success: false, message: 'Forbidden: you can only access your own data' });
};

module.exports = { secureMiddleware, authorizeRoles, selfOrAdmin };
