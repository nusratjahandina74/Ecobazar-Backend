const express = require('express');
const router = express.Router();
const { 
    createCartController, 
    increDecreCartController, 
    deleteCartController, 
    getCartController
} = require('../controllers/cartController');

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: Shopping Cart Management Endpoints
 */

/**
 * @swagger
 * /api/cart/createcart/{proId}/{userId}:
 *   post:
 *     summary: Add a product to the cart or increase quantity if already exists
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: proId
 *         required: true
 *         schema:
 *           type: string
 *         description: The Product MongoDB ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The User MongoDB ID
 *     responses:
 *       201:
 *         description: Product added to cart successfully
 *       200:
 *         description: Cart quantity updated (product already existed)
 *       404:
 *         description: Product Not Found
 *       500:
 *         description: Internal server error
 */
router.post('/createcart/:proId/:userId', createCartController);

/**
 * @swagger
 * /api/cart/incredecrecart/{id}:
 *   post:
 *     summary: Increase or decrease the quantity of a cart item
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The Cart Item MongoDB ID (_id)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [plus, minus]
 *                 description: Use 'plus' to increase or 'minus' to decrease quantity
 *                 example: plus
 *     responses:
 *       200:
 *         description: Cart updated successfully
 *       400:
 *         description: Quantity cannot be less than 1
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Internal server error
 */
router.post('/incredecrecart/:id', increDecreCartController);

/**
 * @swagger
 * /api/cart/deletecart/{id}:
 *   delete:
 *     summary: Delete a specific item from the cart
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The Cart Item MongoDB ID (_id)
 *     responses:
 *       200:
 *         description: Cart Product Deleted Successfully
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Internal server error
 */
router.delete('/deletecart/:id', deleteCartController);
/**
 * @swagger
 * /api/cart/getcart/{id}:
 *   get:
 *     summary: Get all cart items for a specific user and total price
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The User MongoDB ID
 *     responses:
 *       200:
 *         description: Cart fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Cart fetched successfully
 *                 totalPrice:
 *                   type: number
 *                   example: 2500
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 65cb4f8e1234567890abcdef
 *                       product:
 *                         type: string
 *                         example: 65ca3e7d1234567890abcdef
 *                       quantity:
 *                         type: number
 *                         example: 2
 *                       price:
 *                         type: number
 *                         example: 1250
 *                       user:
 *                         type: string
 *                         example: 65c92d6c1234567890abcdef
 *       404:
 *         description: Cart is empty
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Cart is empty
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */
router.get('/getcart/:id', getCartController);
module.exports = router;