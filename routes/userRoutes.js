const express = require('express');
const router = express.Router();
const { 
    getAllUsersController, 
    singleUserDataController, 
    updateUserController, 
    deleteUserController 
} = require('../controllers/userController'); 
/**
 * @openapi
 * /allusers:
 *   get:
 *     summary: Get all registered users list
 *     description: Database-er sob user list array format-e niye ashe.
 *     tags: [User Management]
 *     responses:
 *       200:
 *         description: Successfully fetched all user profiles.
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
 *                   example: All Profile
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Profile not found.
 *       500:
 *         description: Internal server error.
 */
router.get('/allusers', getAllUsersController);

/**
 * @openapi
 * /singleuser/{id}:
 *   get:
 *     summary: Get profile information for a single user
 *     description: Param space theke id niye nirdisto user record fetch kore.
 *     tags: [User Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB document Object ID string.
 *     responses:
 *       200:
 *         description: Profile document data returned.
 *       404:
 *         description: Profile not found.
 *       500:
 *         description: Internal server error.
 */
router.get('/singleuser/:id', singleUserDataController);

/**
 * @openapi
 * /updateuser/{id}:
 *   post:
 *     summary: Update profile and billing addresses data
 *     description: User profile payload update kore ebong updated object-ti return kore.
 *     tags: [User Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Target user document Object ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phoneNumber:
 *                 type: string
 *                 example: "01700000000"
 *               profile:
 *                 type: string
 *                 example: "image_url_string"
 *               role:
 *                 type: string
 *                 enum: [admin, user, editor, vendor]
 *                 example: user
 *               isHold:
 *                 type: boolean
 *                 example: false
 *               billingAdress:
 *                 type: object
 *                 properties:
 *                   firstName:
 *                     type: string
 *                     example: John
 *                   LastName:
 *                     type: string
 *                     example: Doe
 *                   email:
 *                     type: string
 *                     example: john@example.com
 *                   companyName:
 *                     type: string
 *                     example: Tech Firm
 *                   street:
 *                     type: string
 *                     example: 123 Main St
 *                   state:
 *                     type: string
 *                     example: Dhaka
 *                   zipCOde:
 *                     type: string
 *                     example: "1215"
 *                   phoneNumber:
 *                     type: string
 *                     example: "01700000000"
 *                   country:
 *                     type: string
 *                     example: Bangladesh
 *     responses:
 *       200:
 *         description: Profile Update Successfully Done.
 *       404:
 *         description: Profile not found.
 *       500:
 *         description: Internal server error.
 */
router.post('/updateuser/:id', updateUserController);

/**
 * @openapi
 * /deleteuser/{id}:
 *   delete:
 *     summary: Permanently delete a user account from database
 *     description: MongoDB system theke target record document delete kore dey.
 *     tags: [User Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Target user unique Object ID string.
 *     responses:
 *       200:
 *         description: Profile Delete Successfully Done.
 *       404:
 *         description: Profile not found.
 *       500:
 *         description: Internal server error.
 */
router.delete('/deleteuser/:id', deleteUserController);

module.exports = router;
