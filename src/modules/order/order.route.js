const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const verifyToken = require('../../middlewares/verifyToken');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');
const { checkPermission } = require('../../middlewares/checkPermission');

router.post('/', verifyToken, orderController.createOrder);
router.post('/guest', orderController.createGuestOrder);
router.post('/manual', verifyToken, verifyTokenAdmin, checkPermission('order', 'create'), orderController.createManualOrder);
router.get('/', verifyToken, orderController.getOrders);
router.get('/user', verifyToken, orderController.getUserOrders);

// Admin routes (should come before dynamic routes like /:id)
router.get('/admin/list', verifyToken, verifyTokenAdmin, checkPermission('order', 'read'), orderController.getAdminOrders);
router.get('/user/:orderId', verifyToken, orderController.getUserOrderById);
router.get('/track/:orderId', orderController.trackOrder);
router.get('/search-by-phone/:phoneNumber', verifyToken, verifyTokenAdmin, orderController.searchOrdersByPhone);
router.get('/get-customer-info/:phoneNumber', orderController.getCustomerInfoByPhone);
router.get('/:id', orderController.getOrderById);
router.patch('/:id', orderController.updateOrder);
router.put('/:id/comprehensive', verifyToken, verifyTokenAdmin, orderController.updateOrderComprehensive);
router.delete('/:id', verifyToken, verifyTokenAdmin, checkPermission('order', 'delete'), orderController.deleteOrder);
router.post('/update-total-sold', orderController.updateTotalSold);
router.post('/:id/add-to-steadfast', verifyToken, verifyTokenAdmin, checkPermission('order', 'update'), orderController.addOrderToSteadfast);

module.exports = router;
