const mongoose = require('mongoose');
const sendError = require('../utils/sendError');
const Product = require('../models/productModel');
const { parsePagination, pageMeta } = require('../utils/helpers');

// Storefront catalog. `?status=active` keeps the payload small; `?page=&limit=` switches to server-side pagination.
const getAllProductController = async (req, res) => {
    try {
        const filter = {};
        if (['active', 'pending', 'inactive'].includes(req.query.status)) filter.status = req.query.status;
        if (req.query.category) filter.category = req.query.category;
        const paged = req.query.page !== undefined || req.query.limit !== undefined;
        let q = Product.find(filter).sort({ createdAt: -1 }).lean();
        let total;
        if (paged) {
            const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 24, maxLimit: 100 });
            q = q.skip(skip).limit(limit);
            total = await Product.countDocuments(filter);
            const data = await q;
            res.set('Cache-Control', 'public, max-age=15');
            return res.status(200).json({ success: true, totalProducts: total, data, pagination: pageMeta(total, page, limit) });
        }
        const data = await q.limit(2000);
        res.set('Cache-Control', 'public, max-age=15');
        if (!data.length) return res.status(404).json({ success: false, message: 'No products found in the database' });
        return res.status(200).json({ success: true, message: 'All Products fetched successfully', totalProducts: data.length, data });
    } catch (error) {
        return sendError(res, error);
    }
};

const singleProductController = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid Product ID format' });
        const data = await Product.findById(id).lean();
        if (!data) return res.status(404).json({ success: false, message: 'Product not found' });
        return res.status(200).json({ success: true, message: 'Product found successfully', data });
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = { getAllProductController, singleProductController };
