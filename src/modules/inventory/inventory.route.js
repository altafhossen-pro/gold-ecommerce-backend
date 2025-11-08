const express = require('express');
const router = express.Router();
const inventoryController = require('./inventory.controller');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

router.use(verifyTokenAdmin);

// Inventory overview and management
router.get('/', inventoryController.getInventory);
router.get('/low-stock', inventoryController.getLowStockProducts);

// Stock operations
router.post('/update-stock', inventoryController.updateStock);
router.post('/bulk-update-stock', inventoryController.bulkUpdateStock);

// Stock history and analytics
router.get('/stock-history/:productId', inventoryController.getStockHistory);
router.get('/stock-summary/:productId', inventoryController.getStockSummary);
router.get('/analytics', inventoryController.getStockAnalytics);

// Purchase management
router.post('/purchases', inventoryController.createPurchase);
router.get('/purchases', inventoryController.getPurchases);
router.get('/purchases/:id', inventoryController.getPurchaseById);

// Stock adjustment management
router.post('/stock-adjustments', inventoryController.createStockAdjustment);
router.get('/stock-adjustments', inventoryController.getStockAdjustments);
router.get('/stock-adjustments/:id', inventoryController.getStockAdjustmentById);

// Product stock history
router.get('/product-stock-history/:productId', inventoryController.getProductStockHistory);

module.exports = router;
