const { rateLimit } = require('express-rate-limit')
const registrationlimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 2,
    message: {
        success: false,
        message: "Too many registration attempts, please try again after 15 minutes."
    },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
})
const loginlimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: {
        success: false,
        message: "Too many login attempts, please try again later."
    },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
})
const forgetPasswordlimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    message: {
        success: false,
        message: "Too many login attempts, please try again later."
    },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
})
module.exports = { registrationlimiter, loginlimiter, forgetPasswordlimiter };