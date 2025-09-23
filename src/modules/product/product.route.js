const express = require('express');
const router = express.Router();
const productController = require('./product.controller');

// Special product lists
router.get('/featured', productController.getFeaturedProducts);
router.get('/discounted', productController.getDiscountedProducts);
router.get('/new-arrivals', productController.getNewArrivals);
router.get('/bestselling', productController.getBestsellingProducts);
router.get('/search', productController.searchProducts);
router.get('/filters', productController.getAvailableFilters);
router.get('/similar/:productId', productController.getSimilarProducts);

// Stock checking
router.post('/check-stock', productController.checkStockAvailability);

// CRUD
router.post('/', productController.createProduct);
router.get('/', productController.getProducts);
router.get('/slug/:slug', productController.getProductBySlug);
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
