require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const dbConfig = require('./config/dbConfig');
const swaggerDocs = require('./config/swaggerConfig');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoute');
const paymentRoutes = require('./routes/paymentRoutes');
const orderRoutes = require('./routes/orderRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { expireStaleOnlineOrders } = require('./services/orderService');
const { isCloud } = require('./utils/storage');

['MONGODB_URL', 'ACCESS_TOKEN_SECRET'].forEach((k) => {
    if (!process.env[k]) console.error(`[config] ${k} is missing in the backend .env file!`);
});
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

// Tell the developer exactly where uploaded images go (the #1 "my pictures disappeared" question).
if (isCloud()) console.log('[uploads] Cloudinary is ON - images are stored permanently in the cloud.');
else if (process.env.NODE_ENV === 'production') console.warn('[uploads] CLOUDINARY_URL is not set -> images go to the local ./uploads folder. That is fine on your PC, but on Render this folder is WIPED on every deploy/restart: add CLOUDINARY_URL in the Render environment.');
else console.log('[uploads] Local disk mode - uploaded images are saved in ' + path.join(__dirname, 'uploads') + '/<products|banners|categories|branding>');

const app = express();
app.set('trust proxy', 1);          // Render / Vercel sit behind a proxy: real client IP for rate limiting
app.disable('x-powered-by');

// CORS_ORIGINS="https://ecobazar-bd.vercel.app,https://ecobazar-admin.vercel.app" (comma separated). Empty = allow all.
const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
app.use(cors(origins.length ? {
    origin: (origin, cb) => (!origin || origins.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin) ? cb(null, true) : cb(null, false)),
    credentials: true,
} : {}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', immutable: true }));

// Health check (Render health-check path / uptime pinger). Works even before the DB is connected.
app.get('/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1, uptime: Math.round(process.uptime()) }));
app.get('/', (req, res) => res.json({ name: 'EcoBazaar API', status: 'running', docs: '/api-docs' }));

dbConfig();

app.use((req, res, next) => {
    if (req.path.startsWith('/uploads') || req.path.startsWith('/api-docs')) return next();
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ success: false, message: 'Database is not connected yet. Please try again in a few seconds.' });
    }
    next();
});
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', productRoutes);
app.use('/', cartRoutes);
app.use('/', paymentRoutes);
app.use('/', orderRoutes);
app.use('/', wishlistRoutes);
app.use('/', adminRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.name === 'MulterError' ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : (err.status || 400);
    if (status >= 500) console.error('[error]', err);
    res.status(status).json({ success: false, message: err.message || 'Request failed' });
});

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
    swaggerDocs(app, port);
});

// Release stock held by online orders that were never paid (every 10 minutes).
setInterval(() => {
    if (mongoose.connection.readyState !== 1) return;
    expireStaleOnlineOrders(45).catch((e) => console.error('[expire-orders]', e.message));
}, 10 * 60 * 1000).unref();

const shutdown = () => server.close(() => mongoose.connection.close(false).finally(() => process.exit(0)));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
