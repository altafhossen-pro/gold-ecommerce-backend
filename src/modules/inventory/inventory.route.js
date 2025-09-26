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

module.exports = router;
