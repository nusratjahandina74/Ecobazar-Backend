const express = require('express');
const router = express.Router();
const { secureMiddleware } = require('../middleware/secureMiddleware');
const {
    getWishlistController,
    addWishlistController,
    removeWishlistController
} = require('../controllers/wishlistController');

router.get('/wishlist', secureMiddleware, getWishlistController);
router.post('/wishlist/:productId', secureMiddleware, addWishlistController);
router.delete('/wishlist/:productId', secureMiddleware, removeWishlistController);

module.exports = router;
