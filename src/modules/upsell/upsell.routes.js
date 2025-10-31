const express = require('express');
const router = express.Router();
const {
  getAllUpsells,
  getUpsellById,
  createUpsell,
  updateUpsell,
  addLinkedProduct,
  removeLinkedProduct,
  updateLinkedProductOrder,
  toggleLinkedProductStatus,
  deleteUpsell,
  getUpsellsByMainProduct,
  getUpsellsByMainProductPublic,
  getUpsellsByLinkedProduct,
  searchProductsForLinking,
  calculateCartDiscounts
} = require('./upsell.controller');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

// Public routes (no authentication required)
// Get upsells by main product (Public)
router.get('/public/main-product/:productId', getUpsellsByMainProductPublic);

// Calculate cart discounts (Public - no auth required)
router.post('/calculate-discount', calculateCartDiscounts);

// Apply admin authentication to all routes below
router.use(verifyTokenAdmin);

// Get all upsells
router.get('/', getAllUpsells);

// Get single upsell by ID
router.get('/:id', getUpsellById);

// Create new upsell
router.post('/', createUpsell);

// Update upsell
router.put('/:id', updateUpsell);

// Delete upsell
router.delete('/:id', deleteUpsell);

// Add linked product to upsell
router.post('/:id/linked-products', addLinkedProduct);

// Remove linked product from upsell
router.delete('/:id/linked-products', removeLinkedProduct);

// Update linked product order
router.put('/:id/linked-products/order', updateLinkedProductOrder);

// Toggle linked product status
router.put('/:id/linked-products/toggle', toggleLinkedProductStatus);

// Get upsells by main product
router.get('/main-product/:productId', getUpsellsByMainProduct);

// Get upsells by linked product
router.get('/linked-product/:productId', getUpsellsByLinkedProduct);

// Search products for linking
router.get('/search/products', searchProductsForLinking);

module.exports = router;
