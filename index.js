require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const dbConfig = require('./config/dbConfig');
const swaggerDocs = require('./config/swaggerConfig');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoute');
const paymentRoutes = require('./routes/paymentRoutes');
const orderRoutes = require('./routes/orderRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');

['MONGODB_URL', 'ACCESS_TOKEN_SECRET'].forEach((k) => {
    if (!process.env[k]) console.error(`[config] ${k} is missing in the backend .env file!`);
});
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

const mongoose = require('mongoose');
const app = express();

app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

dbConfig();

app.use((req, res, next) => {
    if (req.path.startsWith('/uploads')) return next();
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ success: false, message: 'Database is not connected yet. Check MONGODB_URL / internet and the backend console.' });
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

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.name === 'MulterError' ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : (err.status || 400);
    res.status(status).json({ success: false, message: err.message || 'Request failed' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server Running on port ${port}`);
    swaggerDocs(app, port);
});
