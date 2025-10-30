const express = require('express');
const router = express.Router();
const googleAuthController = require('./googleAuth.controller');

// Public routes for Google OAuth
router.get('/initiate', googleAuthController.initiateGoogleAuth);
router.get('/callback', googleAuthController.googleCallback);

module.exports = router;

