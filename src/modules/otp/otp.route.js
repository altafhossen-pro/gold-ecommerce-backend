const express = require('express');
const router = express.Router();
const otpController = require('./otp.controller');

// Public routes for OTP
router.post('/send', otpController.sendOTP);
router.post('/verify', otpController.verifyOTP);
router.post('/resend', otpController.resendOTP);

// Debug route (remove in production)
router.get('/status', otpController.getOTPStatus);

module.exports = router;
