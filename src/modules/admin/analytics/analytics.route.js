const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');

// Dashboard analytics routes
router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/sales', analyticsController.getSalesAnalytics);
router.get('/products', analyticsController.getProductAnalytics);
router.get('/customers', analyticsController.getCustomerAnalytics);

module.exports = router;
