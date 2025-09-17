const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const verifyToken = require('../../middlewares/verifyToken');

router.post('/', orderController.createOrder);
router.get('/', verifyToken, orderController.getOrders);
router.get('/user', verifyToken, orderController.getUserOrders);
router.get('/user/:orderId', verifyToken, orderController.getUserOrderById);
router.get('/:id', orderController.getOrderById);
router.patch('/:id', orderController.updateOrder);
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
