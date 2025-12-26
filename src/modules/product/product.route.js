const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');
const { checkPermission } = require('../../middlewares/checkPermission');

// Special product lists
router.get('/featured', productController.getFeaturedProducts);
router.get('/discounted', productController.getDiscountedProducts);
router.get('/new-arrivals', productController.getNewArrivals);
router.get('/bestselling', productController.getBestsellingProducts);
router.get('/random', productController.getRandomProducts);
router.get('/product-videos', productController.getProductVideos);
router.get('/search', productController.searchProducts);
router.get('/filters', productController.getAvailableFilters);
router.get('/similar/:productId', productController.getSimilarProducts);

// Stock checking
router.post('/check-stock', productController.checkStockAvailability);

// Public routes
router.get('/', productController.getProducts);
router.get('/slug/:slug', productController.getProductBySlug);
router.get('/:id', productController.getProductById);

// Admin routes with permission checks
// Note: Specific routes (like /admin/list) should come before dynamic routes (like /admin/:id)
router.get('/admin/list', verifyTokenAdmin, checkPermission('product', 'read'), productController.getAdminProducts);
router.get('/admin/:id', verifyTokenAdmin, checkPermission('product', 'read'), productController.getAdminProductById);
router.post('/', verifyTokenAdmin, checkPermission('product', 'create'), productController.createProduct);
router.patch('/:id', verifyTokenAdmin, checkPermission('product', 'update'), productController.updateProduct);
router.delete('/:id', verifyTokenAdmin, checkPermission('product', 'delete'), productController.deleteProduct);

module.exports = router;
