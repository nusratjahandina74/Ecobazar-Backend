const { rateLimit } = require('express-rate-limit')
const dev = process.env.NODE_ENV !== 'production'
const lim = (prod) => (dev ? 1000 : prod)
const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: lim(5),
    message: {
        success: false,
        message: "Too many registration attempts, please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
})
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: lim(10),
    message: {
        success: false,
        message: "Too many login attempts, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
})
const forgetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: lim(5),
    message: {
        success: false,
        message: "Too many login attempts, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
})
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: lim(5),
    message: {
        success: false,
        message: "Too many attempts, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
})
module.exports = { registrationLimiter, loginLimiter, forgetPasswordLimiter, apiLimiter };
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: lim(8),
    message: { success: false, message: 'Too many messages, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 600,
    message: { success: false, message: 'Too many requests, slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});
module.exports.contactLimiter = contactLimiter;
module.exports.adminLimiter = adminLimiter;
