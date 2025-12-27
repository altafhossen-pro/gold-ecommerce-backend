const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const verifyTokenAdmin = require('../../../middlewares/verifyTokenAdmin');
const { checkPermission } = require('../../../middlewares/checkPermission');

// Public admin routes
router.post('/login', userController.adminLogin);

// Protected admin routes (require admin token)
router.use(verifyTokenAdmin);
router.get('/', checkPermission('user', 'read'), userController.listUsers);
router.get('/search', checkPermission('user', 'read'), userController.searchUsers);
router.get('/:id', checkPermission('user', 'read'), userController.getUserById);
router.put('/:id', checkPermission('user', 'update'), userController.updateUser);
router.patch('/:id', checkPermission('user', 'update'), userController.updateUser);
router.delete('/:id', checkPermission('user', 'delete'), userController.deleteUser);
// Create staff (Super Admin only - permission check done in controller)
router.post('/staff', verifyTokenAdmin, userController.createStaff);

module.exports = router;
