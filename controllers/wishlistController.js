const mongoose = require('mongoose')
const Wishlist = require('../models/wishlistModel')
const Product = require('../models/productModel')
const sendError = require('../utils/sendError')
const getWishlistController = async (req, res) => {
    try {
        const rows = await Wishlist.find({ user: req.user.id }).populate('product').sort({ createdAt: -1 })
        const data = rows.filter((r) => r.product).map((r) => ({ _id: r._id, product: r.product, addedAt: r.createdAt }))
        return res.status(200).json({ success: true, message: 'Wishlist fetched successfully', total: data.length, data })
    } catch (error) {
        return sendError(res, error)
    }
}

const addWishlistController = async (req, res) => {
    try {
        const { productId } = req.params
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid Product ID format' })
        }
        const product = await Product.findById(productId)
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' })
        }
        const existing = await Wishlist.findOne({ user: req.user.id, product: productId })
        if (existing) {
            return res.status(200).json({ success: true, message: 'Already in wishlist', data: existing })
        }
        try {
            const item = await new Wishlist({ user: req.user.id, product: productId }).save()
            return res.status(201).json({ success: true, message: 'Added to wishlist', data: item })
        } catch (e) {
            if (e && e.code === 11000) { // double click / race: it is already there
                return res.status(200).json({ success: true, message: 'Already in wishlist' })
            }
            throw e
        }
    } catch (error) {
        return sendError(res, error)
    }
}

const removeWishlistController = async (req, res) => {
    try {
        const { productId } = req.params
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid Product ID format' })
        }
        await Wishlist.deleteMany({ user: req.user.id, product: productId })
        return res.status(200).json({ success: true, message: 'Removed from wishlist' })
    } catch (error) {
        return sendError(res, error)
    }
}

module.exports = { getWishlistController, addWishlistController, removeWishlistController }
