const express = require('express');
const router = express.Router();
const { secureMiddleware, authorizeRoles } = require('../middleware/secureMiddleware');
const {
    myOrdersController,
    orderByTransactionController,
    allOrdersController,
    updateOrderStatusController
} = require('../controllers/orderController');

// NEW (additive) endpoints — see INTEGRATION_REPORT.md
router.get('/myorders', secureMiddleware, myOrdersController);
router.get('/orderbytransaction/:txnId', secureMiddleware, orderByTransactionController);
router.get('/allorders', secureMiddleware, authorizeRoles('admin'), allOrdersController);
router.post('/updateorderstatus/:id', secureMiddleware, authorizeRoles('admin'), updateOrderStatusController);

module.exports = router;
