const express = require('express');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');
const heroProductController = require('./heroProduct.controller');
const router = express.Router();

// Public routes (no authentication required)
router.get('/', heroProductController.getHeroProducts);

// Admin routes (authentication required)
router.get('/admin', verifyTokenAdmin, heroProductController.getAllHeroProducts);
router.post('/', verifyTokenAdmin, heroProductController.createHeroProduct);
router.put('/:id', verifyTokenAdmin, heroProductController.updateHeroProduct);
router.delete('/:id', verifyTokenAdmin, heroProductController.deleteHeroProduct);
router.put('/order/update', verifyTokenAdmin, heroProductController.updateProductOrder);

module.exports = router;
