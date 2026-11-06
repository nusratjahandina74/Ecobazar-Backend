const express = require('express');
const router = express.Router();
const { 
    paymentController, 
    paymentSuccessController, 
    paymentFailController, 
    paymentCancelController,
    paymentIPNController
} = require('../controllers/paymentController');
const { secureMiddleware } = require('../middleware/secureMiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     ShippingAddress:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - phone
 *         - address1
 *         - city
 *         - postcode
 *       properties:
 *         name:
 *           type: string
 *           example: Nusrat Jahan
 *         email:
 *           type: string
 *           example: nusrat@example.com
 *         phone:
 *           type: string
 *           example: "01712345678"
 *         address1:
 *           type: string
 *           example: House 12, Road 5
 *         address2:
 *           type: string
 *           example: Dhanmondi
 *         city:
 *           type: string
 *           example: Dhaka
 *         state:
 *           type: string
 *           example: Dhaka
 *         postcode:
 *           type: string
 *           example: "1209"
 *     
 *     PaymentInitiateInput:
 *       type: object
 *       required:
 *         - userId
 *         - cus_name
 *         - cus_email
 *         - cus_add1
 *         - cus_city
 *         - cus_postcode
 *         - cus_phone
 *       properties:
 *         userId:
 *           type: string
 *           example: 6a00a417e546ae90593e7ea0
 *         cus_name:
 *           type: string
 *           example: Nusrat Jahan
 *         cus_email:
 *           type: string
 *           example: nusrat@example.com
 *         cus_add1:
 *           type: string
 *           example: House 12, Road 5
 *         cus_add2:
 *           type: string
 *           example: Dhanmondi
 *         cus_city:
 *           type: string
 *           example: Dhaka
 *         cus_state:
 *           type: string
 *           example: Dhaka
 *         postcode:
 *           type: string
 *           example: "1209"
 *         cus_phone:
 *           type: string
 *           example: "01712345678"
 */

/**
 * @swagger
 * /api/v1/payment:
 *   post:
 *     summary: Initiate secure aamarPay payment window
 *     description: Validates cart item prices from database securely and generates payment URL. Front-end amount is omitted to prevent cyber fraud.
 *     tags: [Payment Gateway]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentInitiateInput'
 *     responses:
 *       200:
 *         description: Successfully generated sandbox/production web payment link.
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
 *                   example: Payment link generated successfully
 *                 paymentUrl:
 *                   type: string
 *                   example: https://aamarpay.com
 *                 orderId:
 *                   type: string
 *                   example: 60c72b2f9b1d8b0015f84f12
 *                 transactionId:
 *                   type: string
 *                   example: TXN-171923456789-1234
 *       400:
 *         description: Cart empty or internal validation mismatch.
 *       500:
 *         description: Server error or gateway outage.
 */
router.post('/payment', secureMiddleware, paymentController);

/**
 * @swagger
 * /api/v1/payment/success:
 *   post:
 *     summary: Webhook webhook hook for successful payments
 *     description: Executed automatically by aamarPay upon client-side credit card/MFS execution completion.
 *     tags: [Payment Gateway]
 *     parameters:
 *       - in: query
 *         name: txnId
 *         schema:
 *           type: string
 *         description: Query string backup transaction identifier
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               mer_txnid:
 *                 type: string
 *                 example: TXN-171923456789-1234
 *               pay_status:
 *                 type: string
 *                 example: Successful
 *               amount:
 *                 type: string
 *                 example: "546.00"
 *     responses:
 *       200:
 *         description: State engine processing finalized. Order updated and shopping cart dropped.
 *       302:
 *         description: Direct application redirect to absolute standard single-page app landing point.
 */
router.post('/payment/success', paymentSuccessController);
router.get('/payment/success', paymentSuccessController);

/**
 * @swagger
 * /api/v1/payment/fail:
 *   post:
 *     summary: Callback handler for invalid card transactions or failure flows
 *     tags: [Payment Gateway]
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               mer_txnid:
 *                 type: string
 *                 example: TXN-171923456789-1234
 *               pay_status:
 *                 type: string
 *                 example: Failed
 *     responses:
 *       200:
 *         description: Database synchronized. Status recorded as failed.
 */
router.post('/payment/fail', paymentFailController);
router.get('/payment/fail', paymentFailController);

/**
 * @swagger
 * /api/v1/payment/cancel:
 *   post:
 *     summary: Graceful drop routing triggered if user cancels out manually from browser
 *     tags: [Payment Gateway]
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               mer_txnid:
 *                 type: string
 *                 example: TXN-171923456789-1234
 *     responses:
 *       200:
 *         description: Order context safe dropped. Return validation successful.
 */
router.post('/payment/cancel', paymentCancelController);
router.get('/payment/cancel', paymentCancelController);

/**
 * @swagger
 * /api/v1/payment/ipn:
 *   post:
 *     summary: Secure Instant Payment Notification (Asynchronous Server-to-Server Verification)
 *     description: Fallback webhook protecting checkout transactions in case customer web viewport drops midway.
 *     tags: [Payment Gateway]
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - mer_txnid
 *               - pay_status
 *               - amount
 *             properties:
 *               mer_txnid:
 *                 type: string
 *                 example: TXN-171923456789-1234
 *               pay_status:
 *                 type: string
 *                 example: Successful
 *               amount:
 *                 type: string
 *                 example: "546.00"
 *     responses:
 *       200:
 *         description: Processing accepted. State fully audited.
 */
router.post('/payment/ipn', paymentIPNController);

module.exports = router;
