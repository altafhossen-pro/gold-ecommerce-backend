const express = require('express');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');
const menuController = require('./menu.controller');
const router = express.Router();

// Public routes (no authentication required)
router.get('/header', menuController.getHeaderMenus);
router.get('/footer', menuController.getFooterMenus);

// Admin routes (authentication required)
router.post('/header', verifyTokenAdmin, menuController.createHeaderMenu);
router.put('/header/:id', verifyTokenAdmin, menuController.updateHeaderMenu);
router.delete('/header/:id', verifyTokenAdmin, menuController.deleteHeaderMenu);

router.post('/footer', verifyTokenAdmin, menuController.createFooterMenu);
router.put('/footer/:id', verifyTokenAdmin, menuController.updateFooterMenu);
router.delete('/footer/:id', verifyTokenAdmin, menuController.deleteFooterMenu);

// Bulk operations
router.put('/order', verifyTokenAdmin, menuController.updateMenuOrder);

module.exports = router;
