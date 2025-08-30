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
router.put('/profile', userController.updateProfile);
router.delete('/profile', userController.deleteUser);

module.exports = router;
