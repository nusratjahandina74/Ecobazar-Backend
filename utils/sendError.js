// One place that turns any thrown error into a useful JSON response (and logs the real cause).
const isProd = process.env.NODE_ENV === 'production';

const sendError = (res, error, fallback = 'Internal server error') => {
    console.error('[API ERROR]', error && error.stack ? error.stack : error);
    if (res.headersSent) return;

    const msg = String((error && error.message) || '');
    let status = 500;
    let message = fallback;

    if (error && error.code === 11000) {
        const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'value';
        status = 409;
        message = field === 'email' ? 'User already exists with this email.'
            : field === 'phoneNumber' ? 'This phone number is already in use.'
            : field === 'title' ? 'Product title already exists'
            : `Duplicate value for "${field}".`;
    } else if (error && error.name === 'ValidationError') {
        status = 400;
        message = Object.values(error.errors || {})[0]?.message || 'Validation failed';
    } else if (error && error.name === 'CastError') {
        status = 400;
        message = `Invalid ${error.path || 'id'} format`;
    } else if (/secretOrPrivateKey|secret or public key/i.test(msg)) {
        message = 'Server configuration error: ACCESS_TOKEN_SECRET is missing in the backend .env file.';
    } else if (/buffering timed out|ServerSelection|MongoNetwork|ECONNREFUSED|ENOTFOUND|querySrv/i.test(msg) || (error && /Mongo(Server)?(Selection|Network)/.test(error.name || ''))) {
        status = 503;
        message = 'Database is not reachable. Check MONGODB_URL, your internet / Atlas IP whitelist, and the backend console.';
    } else if (!isProd && msg) {
        message = `${fallback}: ${msg}`; // helps while developing; hidden when NODE_ENV=production
    }

    return res.status(status).json({ success: false, message });
};

module.exports = sendError;
