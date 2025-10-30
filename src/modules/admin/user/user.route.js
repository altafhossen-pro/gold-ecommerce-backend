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
// Admins should not create users via admin API; disable the route below
// router.post('/', userController.createUser);

module.exports = router;
