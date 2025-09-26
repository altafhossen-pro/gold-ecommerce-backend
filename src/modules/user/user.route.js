const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const verifyToken = require('../../middlewares/verifyToken'); // Uncomment and use for protected routes

// Public routes
router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Protected routes (assume auth middleware sets req.userId)
router.use(verifyToken);
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.put('/change-password', userController.changePassword);
router.delete('/profile', userController.deleteUser);

// Admin routes moved to separate admin/user module

module.exports = router;