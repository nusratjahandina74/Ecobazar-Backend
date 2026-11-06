const sendError = require('../utils/sendError');
const mongoose = require('mongoose')
const Product = require('../models/productModel')
const Cart = require('../models/cartModel')
const { effectivePrice } = require('../services/orderService')

// price + stock for the chosen variant (or the plain product)
const resolveUnit = (product, variantId) => {
    const hasVariants = product.variants && product.variants.some((v) => v.isActive !== false)
    if (hasVariants) {
        const v = variantId ? product.variants.id(variantId) : null
        if (!v || v.isActive === false) return { error: 'Please choose an available option (size / color) for this product' }
        return { price: effectivePrice({ price: v.price ?? product.price, discountPrice: v.discountPrice }), stock: v.stock, variantId: v._id, label: v.label }
    }
    return { price: effectivePrice(product), stock: product.stock, variantId: undefined }
}
const createCartController = async (req, res) => {
    try {
        let { proId, userId, variantId } = req.body
        if (userId && String(userId) !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "You can only modify your own cart" });
        }
        userId = (req.user.role === 'admin' && userId) ? userId : req.user.id
        if (!proId || !userId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }
        proId = proId.toString().trim();
        userId = userId.toString().trim();
        if (!mongoose.Types.ObjectId.isValid(proId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Product ID or User ID format"
            });
        }
        proId = new mongoose.Types.ObjectId(proId);
        userId = new mongoose.Types.ObjectId(userId);
        const existingProduct = await Product.findById(proId)
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product Not Found'
            })
        }
        if (existingProduct.status !== 'active') {
            return res.status(400).json({ success: false, message: "This product is not available" });
        }
        const unit = resolveUnit(existingProduct, variantId)
        if (unit.error) return res.status(400).json({ success: false, message: unit.error })
        if (unit.stock <= 0) {
            return res.status(400).json({
                success: false,
                message: "This product is currently out of stock"
            });
        }
        const finalPrice = unit.price
        let cartItem = await Cart.findOne({ product: proId, user: userId, variantId: unit.variantId || null });
        if (cartItem) {
            const newQuantity = cartItem.quantity + 1;
            if (newQuantity > unit.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add more. Only ${unit.stock} items left in stock.`
                });
            }
            cartItem.quantity = newQuantity;
            cartItem.price = finalPrice; 
            cartItem.totalPrice = cartItem.quantity * finalPrice;
            await cartItem.save();
            return res.status(200).json({
                success: true,
                message: "Cart quantity updated",
                data: cartItem
            });
        }
        const cart = new Cart({
            product: proId,
            quantity: 1,
            price: finalPrice,
            totalPrice: finalPrice,
            ...(unit.variantId ? { variantId: unit.variantId } : {}),
            user: userId
        })
        await cart.save()
        return res.status(201).json({
            success: true,
            message: "Product added to cart successfully",
            data: cart
        });
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
const increDecreCartController = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        const userId = req.user.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Cart Item ID format"
            });
        }
        const cartItem = await Cart.findOne({ _id: id, user: userId }).populate('product');
        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: "This product does not exist in this user's cart"
            });
        }
        if (type === 'plus') {
            if (!cartItem.product) {
                return res.status(404).json({
                    success: false,
                    message: "Associated product details not found"
                });
            }
            const unit = resolveUnit(cartItem.product, cartItem.variantId)
            if (unit.error) return res.status(400).json({ success: false, message: unit.error })
            const finalPrice = unit.price;
            const nextQuantity = cartItem.quantity + 1;
            cartItem.price = finalPrice;
            if (nextQuantity > unit.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot increase quantity. Maximum stock limit reached (${unit.stock} available).`
                });
            }
            cartItem.quantity = nextQuantity;
            cartItem.totalPrice = cartItem.quantity * finalPrice;
        } else {
            if (cartItem.quantity > 1) {
                cartItem.quantity -= 1;
                const finalPrice = (cartItem.product && cartItem.product.discountPrice && cartItem.product.discountPrice > 0) 
                    ? cartItem.product.discountPrice 
                    : cartItem.price;
                cartItem.price = finalPrice;
                cartItem.totalPrice = cartItem.quantity * finalPrice;
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Quantity cannot be less than 1"
                });
            }
        }
        await cartItem.save();
        return res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            data: cartItem
        });
    }  catch (error) {
        console.log(error);
        return sendError(res, error);
    }
};
const deleteCartController = async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid Cart Item ID format" });
        }
        const filter = req.user.role === 'admin' ? { _id: id } : { _id: id, user: req.user.id }
        const deleteCart = await Cart.findOneAndDelete(filter)
        if (!deleteCart) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found"
            });
        }
        return res.status(200).json({
            success: true,
            message: "Cart Product Deleted Successfully",
            data: deleteCart
        });
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
const getCartController = async (req, res) => {
    try {
        const { id } = req.params
        const getCart = await Cart.find({ user: id }).populate('product')
        if (!getCart || getCart.length === 0) {
            return res.status(200).json({ success: true, message: "Cart is empty", totalPrice: 0, data: [] });
        }
        let totalPrice = 0
        getCart.forEach(item => {
            const currentPrice = item.price || (item.product && item.product.price) || 0;
            if (item.quantity) {
                totalPrice += currentPrice * item.quantity;
            }
        });
        return res.status(200).json({
            success: true,
            message: "Cart fetched successfully",
            totalPrice: totalPrice,
            data: getCart
        });
    } catch (error) {
        console.log(error);
        return sendError(res, error)
    }
}
module.exports = { createCartController, increDecreCartController, deleteCartController, getCartController }