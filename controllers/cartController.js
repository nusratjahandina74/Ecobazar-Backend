const Product = require('../models/productModel')
const Cart = require('../models/cartModel')
const createCartController = async (req, res) => {
    try {
        const { proId, userId } = req.params
        const existingProduct = await Product.findById(proId)
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product Not Found'
            })
        }
        let cartItem = await Cart.findOne({ product: proId, user: userId })
        if (cartItem) {
            cartItem.quantity += 1;
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
            price: existingProduct.price,
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
        const { id } = req.params
        const { type } = req.body
        const cartItem = await Cart.findById(id)
        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found"
            })
        }
        if (type === 'plus') {
            cartItem.quantity += 1
        } else {
            if (cartItem.quantity > 1) {
                cartItem.quantity -= 1
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Quantity cannot be less than 1"
                })
            }
        }
        await cartItem.save()
        return res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            data: cartItem
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}
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
        const getCart = await Cart.find({ user: id })
        if (!getCart || getCart.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cart is empty"
            });
        }
        let totalPrice = 0
        getCart.map(item => {
            if (item.price && item.quantity) {
                totalPrice += item.price * item.quantity;
            }
        })
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