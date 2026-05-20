const express = require('express');
const router = express.Router();
const {
    createProductController,
    getAllProductController,
    singleProductController,
    updateProductController,
    deleteProductController
} = require('../controllers/productController');

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductImage:
 *       type: object
 *       properties:
 *         url:
 *           type: string
 *           example: "https://cloudinary.com"
 *         isMain:
 *           type: boolean
 *           default: false
 *           example: true
 *     
 *     ProductInput:
 *       type: object
 *       required:
 *         - title
 *         - price
 *         - category
 *       properties:
 *         title:
 *           type: string
 *           description: Unique title of the product
 *           example: "Eco-Friendly Bamboo Water Bottle"
 *         description:
 *           type: string
 *           example: "Premium quality reusable bamboo bottle with vacuum insulation."
 *         price:
 *           type: number
 *           example: 25.99
 *         discountPrice:
 *           type: number
 *           example: 19.99
 *         stock:
 *           type: number
 *           default: 0
 *           example: 150
 *         shortDescription:
 *           type: string
 *           example: "100% Organic Bamboo Bottle 500ml."
 *         category:
 *           type: string
 *           example: "Kitchenware"
 *         subCategory:
 *           type: string
 *           example: "Bottles"
 *         tag:
 *           type: array
 *           items:
 *             type: string
 *           example: ["eco", "bamboo", "bottle"]
 *         additionalInfo:
 *           type: string
 *           example: "Weight: 300g, Dimensions: 25x7 cm"
 *         status:
 *           type: string
 *           enum: [pending, active, inactive]
 *           default: pending
 *           example: "active"
 *         images:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductImage'
 * 
 *     ProductResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Product operation successful"
 *         data:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "651c6c5a3d7b42001f3e721a"
 *             title:
 *               type: string
 *               example: "Eco-Friendly Bamboo Water Bottle"
 *             sku:
 *               type: string
 *               example: "1716315840000-2026"
 *             price:
 *               type: number
 *               example: 25.99
 *             category:
 *               type: string
 *               example: "Kitchenware"
 *             status:
 *               type: string
 *               example: "pending"
 *             createdAt:
 *               type: string
 *               format: date-time
 *               example: "2026-05-20T17:15:00.000Z"
 *             updatedAt:
 *               type: string
 *               format: date-time
 *               example: "2026-05-20T17:15:00.000Z"
 */

/**
 * @swagger
 * /api/v1/products/createproduct:
 *   post:
 *     summary: Create a new product catalog entry
 *     description: Registers a unique product item into database. Generates automated timestamp SKU codes matching format "timestamp-YYYY".
 *     tags: [Product Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductResponse'
 *       400:
 *         description: Missing fields input validation error, negative prices, or unique title duplicate collision
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 */
router.post('/createproduct', createProductController);

/**
 * @swagger
 * /api/v1/products/allproduct:
 *   get:
 *     summary: Fetch all products from database catalog
 *     tags: [Product Management]
 *     responses:
 *       200:
 *         description: All products list retrieved successfully
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
 *                   example: "All Products fetched successfully"
 *                 totalProducts:
 *                   type: number
 *                   example: 12
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: No products found inside database collections
 */
router.get('/allproduct', getAllProductController);

/**
 * @swagger
 * /api/v1/products/singleproduct/{id}:
 *   get:
 *     summary: Get profile details of a single product item
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Valid MongoDB Document ObjectId string.
 *         example: "651c6c5a3d7b42001f3e721a"
 *     responses:
 *       200:
 *         description: Target product dataset found successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductResponse'
 *       400:
 *         description: Invalid MongoDB Object ID format
 *       404:
 *         description: Product record document not found
 */
router.get('/singleproduct/:id', singleProductController);

/**
 * @swagger
 * /api/v1/products/updateproduct/{id}:
 *   post:
 *     summary: Update an existing product document attributes
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Valid target product document ObjectId identifier.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *     responses:
 *       200:
 *         description: Product update successfully done
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductResponse'
 *       400:
 *         description: Invalid ID format string or validation rule price error
 *       404:
 *         description: Target product record matrix not found
 */
router.post('/updateproduct/:id', updateProductController);

/**
 * @swagger
 * /api/v1/products/deleteproduct/{id}:
 *   delete:
 *     summary: Permanently delete a product item record from system catalog
 *     tags: [Product Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Target product unique BSON document ID string.
 *     responses:
 *       200:
 *         description: Target item dataset destroyed successfully
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
 *                   example: "Product Delete Successfully Done"
 *       400:
 *         description: Invalid item identifier format error
 *       404:
 *         description: Target product information resource missing
 */
router.delete('/deleteproduct/:id', deleteProductController);

module.exports = router;
