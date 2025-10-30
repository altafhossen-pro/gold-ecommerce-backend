const express = require('express');
const router = express.Router();
const otpController = require('./otp.controller');

// Public routes for OTP (Phone-based)
router.post('/send', otpController.sendOTP);
router.post('/verify', otpController.verifyOTP);
router.post('/resend', otpController.resendOTP);

// Public routes for Email Registration OTP
router.post('/register/send', otpController.sendRegisterOTP);
router.post('/register/verify-only', otpController.verifyRegisterOTPOnly); // Step 2: Verify only
router.post('/register/verify', otpController.verifyRegisterOTP); // Step 3: Verify and create account

// Debug route (remove in production)
router.get('/status', otpController.getOTPStatus);

module.exports = router;
