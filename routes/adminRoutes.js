const express = require('express');
const router = express.Router();
const { secureMiddleware } = require('../middleware/secureMiddleware');
const { requirePermission: need } = require('../middleware/permissions');
const { adminLimiter, contactLimiter } = require('../middleware/rateLimtMiddleware');
const { createUploader, persistUploads } = require('../utils/storage');
const P = require('../controllers/admin/productAdminController');
const O = require('../controllers/admin/orderAdminController');
const M = require('../controllers/admin/miscAdminController');
const B = require('../controllers/admin/businessAdminController');
const S = require('../controllers/storeController');

const productUpload = createUploader('products', { maxFiles: 5 }).array('photos', 5);
const bannerUpload = createUploader('banners', { maxFiles: 1 }).array('image', 1);
const categoryUpload = createUploader('categories', { maxFiles: 1 }).array('image', 1);
const logoUpload = createUploader('branding', { maxFiles: 1 }).array('logo', 1);

/* ------------------------------ public (storefront) ------------------------------ */
router.get('/public/settings', M.getPublicSettings);
router.get('/public/delivery-quote', M.deliveryQuote);
router.get('/public/banners', M.listBanners);
router.post('/public/contact', contactLimiter, M.submitContact);
router.get('/public/categories', S.publicCategories);
router.get('/public/pages', S.publicPages);
router.get('/public/pages/:slug', S.publicPage);
router.get('/public/testimonials', S.testimonials);
router.post('/public/subscribe', contactLimiter, S.subscribe);
router.post('/public/track', contactLimiter, S.trackOrder);
router.get('/products/:id/reviews', S.listProductReviews);
router.get('/products/:id/review-state', secureMiddleware, S.myReviewState);
router.post('/products/:id/reviews', secureMiddleware, contactLimiter, S.createReview);
router.post('/cart/preview', secureMiddleware, S.cartPreview);

/* ------------------------------ admin dashboard ---------------------------------- */
const admin = express.Router();
admin.use(adminLimiter, secureMiddleware);

admin.get('/me/permissions', M.myPermissions);

// analytics
admin.get('/analytics/overview', need('dashboard:read'), M.overview);
admin.get('/analytics/sales', need('dashboard:read'), M.sales);
admin.get('/analytics/top-products', need('dashboard:read'), M.topProducts);
admin.get('/analytics/recent-orders', need('dashboard:read'), M.recentOrders);

// products
admin.get('/products', need('products:read'), P.listProducts);
admin.get('/products/meta', need('products:read'), P.productMeta);
admin.post('/products/bulk', need('products:write'), P.bulkProducts);
admin.get('/products/:id', need('products:read'), P.getProduct);
admin.post('/products', need('products:write'), productUpload, persistUploads('products'), P.createProduct);
admin.put('/products/:id', need('products:write'), productUpload, persistUploads('products'), P.updateProduct);
admin.patch('/products/:id/quick', need('products:write'), P.quickUpdate);
admin.delete('/products/:id', need('products:delete'), P.deleteProduct);

// orders
admin.get('/orders', need('orders:read'), O.listOrders);
admin.get('/orders/counts', need('orders:read'), O.orderCounts);
admin.get('/orders/invoices', need('orders:read'), O.invoices);
admin.get('/orders/export', need('orders:read'), O.exportCsv);
admin.post('/orders/bulk/status', need('orders:bulk'), O.bulkStatus);
admin.post('/orders/bulk/courier', need('orders:courier'), O.bulkCourier);
admin.get('/orders/:id', need('orders:read'), O.getOrder);
admin.patch('/orders/:id', need('orders:update'), O.updateOrder);
admin.patch('/orders/:id/status', need('orders:update'), O.updateStatus);
admin.post('/orders/:id/courier', need('orders:courier'), O.sendToCourier);
admin.post('/orders/:id/courier/manual', need('orders:courier'), O.manualTracking);
admin.post('/orders/:id/courier/sync', need('orders:courier'), O.syncCourier);

// customers + team (only admins manage roles)
admin.get('/users', need('customers:read'), M.listUsers);
admin.post('/users', need('team:write'), M.createTeamMember);
admin.patch('/users/:id', need('team:write'), M.updateUserAdmin);

// settings, banners, messages, audit
admin.get('/settings', need('settings:read'), M.getAdminSettings);
admin.put('/settings/:section', need('settings:write'), M.updateSettings);
admin.get('/banners', need('banners:write'), M.listBanners);
admin.post('/banners', need('banners:write'), bannerUpload, persistUploads('banners'), M.createBanner);
admin.put('/banners/:id', need('banners:write'), bannerUpload, persistUploads('banners'), M.updateBanner);
admin.delete('/banners/:id', need('banners:write'), M.deleteBanner);
admin.post('/uploads/logo', need('settings:write'), logoUpload, persistUploads('branding'), (req, res) => (req.files && req.files[0] ? res.json({ success: true, url: req.files[0].url }) : res.status(400).json({ success: false, message: 'Logo file is required' })));
admin.get('/messages', need('messages:read'), M.listMessages);
admin.patch('/messages/:id', need('messages:write'), M.updateMessage);
admin.delete('/messages/:id', need('messages:write'), M.deleteMessage);
admin.get('/audit', need('audit:read'), M.listAudit);

// categories, coupons, reviews, pages, subscribers
admin.get('/categories', need('products:read'), B.listCategories);
admin.post('/categories/import', need('categories:write'), B.importCategories);
admin.post('/categories', need('categories:write'), categoryUpload, persistUploads('categories'), B.createCategory);
admin.put('/categories/:id', need('categories:write'), categoryUpload, persistUploads('categories'), B.updateCategory);
admin.delete('/categories/:id', need('categories:write'), B.deleteCategory);
admin.get('/coupons', need('coupons:write'), B.listCoupons);
admin.post('/coupons', need('coupons:write'), B.createCoupon);
admin.put('/coupons/:id', need('coupons:write'), B.updateCoupon);
admin.delete('/coupons/:id', need('coupons:write'), B.deleteCoupon);
admin.get('/reviews', need('reviews:read'), B.listReviews);
admin.patch('/reviews/:id', need('reviews:write'), B.updateReview);
admin.delete('/reviews/:id', need('reviews:write'), B.deleteReview);
admin.get('/pages', need('pages:write'), B.listPages);
admin.get('/pages/:id', need('pages:write'), B.getPage);
admin.post('/pages', need('pages:write'), B.createPage);
admin.put('/pages/:id', need('pages:write'), B.updatePage);
admin.delete('/pages/:id', need('pages:write'), B.deletePage);
admin.get('/subscribers', need('subscribers:read'), B.listSubscribers);
admin.get('/subscribers/export', need('subscribers:read'), B.exportSubscribers);
admin.delete('/subscribers/:id', need('subscribers:read'), B.deleteSubscriber);

router.use('/admin', admin);
module.exports = router;
