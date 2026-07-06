const mongoose = require('mongoose')
const Product = require('../models/productModel')
const Cart = require('../models/cartModel')
const createCartController = async (req, res) => {
    try {
        let { proId, userId } = req.body
        if (!proId || !userId) {
            return res.status(400).json({
                success: false,
                message: "Product ID and User ID are required"
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
        if (existingProduct.stock <= 0) {
            return res.status(400).json({
                success: false,
                message: "This product is currently out of stock"
            });
        }
        const finalPrice = (existingProduct.discountPrice && existingProduct.discountPrice > 0) 
            ? existingProduct.discountPrice 
            : existingProduct.price;
        let cartItem = await Cart.findOne({ product: proId, user: userId });
        if (cartItem) {
            const newQuantity = cartItem.quantity + 1;
            if (newQuantity > existingProduct.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add more. Only ${existingProduct.stock} items left in stock.`
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
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const increDecreCartController = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, userId } = req.body;
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
            const finalPrice = (cartItem.product.discountPrice && cartItem.product.discountPrice > 0) 
                ? cartItem.product.discountPrice 
                : cartItem.product.price;
            const nextQuantity = cartItem.quantity + 1;
            cartItem.price = finalPrice;
            cartItem.totalPrice = cartItem.quantity * finalPrice;
            if (nextQuantity > cartItem.product.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot increase quantity. Maximum stock limit reached (${cartItem.product.stock} available).`
                });
            }
            cartItem.quantity = nextQuantity;
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
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
const deleteCartController = async (req, res) => {
    try {
        const { id } = req.params
        const deleteCart = await Cart.findByIdAndDelete(id)
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
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
const getCartController = async (req, res) => {
    try {
        const { id } = req.params
        const getCart = await Cart.find({ user: id }).populate('product')
        if (!getCart || getCart.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cart is empty"
            });
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
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
module.exports = { createCartController, increDecreCartController, deleteCartController, getCartController }