const express = require('express');
const router = express.Router();
const { 
    registrationController, 
    loginController, 
    forgetPasswordController, 
    resetPasswordController, 
    resendverificationemailcontroller, 
    verifyEmailController 
} = require('../controllers/authController');
const { registrationLimiter, loginLimiter, forgetPasswordLimiter } = require('../middleware/rateLimtMiddleware');

/**
 * @openapi
 * /registration:
 *   post:
 *     summary: New User Registration
 *     description: Create a new account with email, password, and accept terms.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - confirmPassword
 *               - terms
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecretPass123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: SecretPass123
 *               terms:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Registration Successfully Done.
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
 *                   example: Registration Successfully Done
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 651c6c5a3d7b42001f3e721a
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *       400:
 *         description: Passwords do not match or terms not accepted.
 *       409:
 *         description: User already exists with this email.
 *       500:
 *         description: Internal server error.
 */
router.post('/registration', registrationLimiter , registrationController);

/**
 * @openapi
 * /login:
 *   post:
 *     summary: User Login Authentication
 *     description: Authenticate user using email and password credentials.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecretPass123
 *     responses:
 *       200:
 *         description: Login Successfully Done.
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
 *                   example: Login Successfully Done
 *       401:
 *         description: Invalid Credential.
 *       409:
 *         description: User not found.
 *       500:
 *         description: Internal server error.
 */
router.post('/login', loginLimiter, loginController);

/**
 * @openapi
 * /forgetpassword:
 *   post:
 *     summary: Request Forget Password Email Link
 *     description: Generates a 1-day access token and sends a reset link to the email.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Please check your email.
 *       409:
 *         description: Email not found.
 *       500:
 *         description: Internal server error.
 */
router.post('/forgetpassword', forgetPasswordLimiter, forgetPasswordController);

/**
 * @openapi
 * /resetpassword/{token}:
 *   post:
 *     summary: Reset Password using Email Token
 *     description: Verifies the JWT secret token from the parameter and updates the model.
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: 1-day verification token sent via email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: NewSecretPass123
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: NewSecretPass123
 *     responses:
 *       200:
 *         description: Password Updated Successfully.
 *       400:
 *         description: Confirm Password not matched.
 *       401:
 *         description: Invalid or expired token.
 *       500:
 *         description: Internal server error.
 */
router.post('/resetpassword/:token', resetPasswordController);

/**
 * @openapi
 * /resendverificationemail:
 *   post:
 *     summary: Resend Account Verification Email Link
 *     description: Regenerates validation payload and triggers verification workflow.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Verification email sent. Please check your inbox.
 *       500:
 *         description: Internal server error.
 */
router.post('/resendverificationemail', resendverificationemailcontroller);

/**
 * @openapi
 * /verifyemail/{token}:
 *   post:
 *     summary: Verify User Email Account
 *     description: Extract JWT identity context, flag target model as isVerified true.
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Signature token bound to user context profile.
 *     responses:
 *       200:
 *         description: Email verified successfully.
 *       400:
 *         description: User already verified.
 *       401:
 *         description: Unauthorized token manipulation.
 *       500:
 *         description: Internal server error.
 */
router.post('/verifyemail/:token', verifyEmailController);

module.exports = router;
