const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const verifyTokenAdmin = require('../../../middlewares/verifyTokenAdmin');

// Public admin routes
router.post('/login', userController.adminLogin);

// Protected admin routes (require admin token)
router.use(verifyTokenAdmin);
router.get('/', userController.listUsers);
router.get('/search', userController.searchUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.patch('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.post('/', userController.createUser);

module.exports = router;
