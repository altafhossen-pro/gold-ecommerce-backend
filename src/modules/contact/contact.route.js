const express = require('express');
const router = express.Router();
const contactController = require('./contact.controller');
const verifyToken = require('../../middlewares/verifyToken');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');
const { checkPermission } = require('../../middlewares/checkPermission');

// Public route - submit contact form (must be before /:id route)
router.post('/submit', contactController.submitContact);

// Admin routes - require authentication and admin role
router.get('/', verifyToken, verifyTokenAdmin, checkPermission('order', 'read'), contactController.getAllContacts);
router.get('/:id', verifyToken, verifyTokenAdmin, checkPermission('order', 'read'), contactController.getContactById);
router.patch('/:id/status', verifyToken, verifyTokenAdmin, checkPermission('order', 'update'), contactController.updateContactStatus);
router.delete('/:id', verifyToken, verifyTokenAdmin, checkPermission('order', 'delete'), contactController.deleteContact);

module.exports = router;

