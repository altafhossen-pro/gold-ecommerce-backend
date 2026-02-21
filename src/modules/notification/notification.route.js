const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

// Public routes
router.get('/', notificationController.getNotifications);
router.get('/:id', notificationController.getNotificationById);

// Admin routes
router.post('/', verifyTokenAdmin, notificationController.createNotification);
router.put('/:id', verifyTokenAdmin, notificationController.updateNotification);
router.delete('/:id', verifyTokenAdmin, notificationController.deleteNotification);

module.exports = router;
