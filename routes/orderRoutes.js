const express = require('express');
const router = express.Router();
const { secureMiddleware } = require('../middleware/secureMiddleware');
const { requirePermission } = require('../middleware/permissions');
const { myOrdersController, orderByTransactionController } = require('../controllers/orderController');
const O = require('../controllers/admin/orderAdminController');

router.get('/myorders', secureMiddleware, myOrdersController);
router.get('/orderbytransaction/:txnId', secureMiddleware, orderByTransactionController);
// legacy admin endpoints (the new dashboard uses /admin/orders*)
router.get('/allorders', secureMiddleware, requirePermission('orders:read'), O.listOrders);
router.post('/updateorderstatus/:id', secureMiddleware, requirePermission('orders:update'), O.updateStatus);

module.exports = router;
