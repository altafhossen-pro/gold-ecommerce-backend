const crypto = require('crypto');
const { sendOTPSMS } = require('../utils/smsService');

class OTPService {
  constructor() {
    // For testing purposes, we'll use a default OTP
    this.defaultOTP = '123456';
    this.otpExpiryMinutes = 5; // OTP expires in 5 minutes
  }

  /**
   * Generate a random 6-digit OTP
   * @returns {string} 6-digit OTP
   */
  generateOTP() {
    // Always generate random OTP for both development and production
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Send OTP to phone number via SMS
   * @param {string} phone - Phone number
   * @param {string} otp - OTP to send
   * @param {string} brandName - Optional brand name (defaults to env variable or 'Forpink')
   * @returns {Promise<boolean>} Success status
   */
  async sendOTP(phone, otp, brandName = null) {
    try {
      // Send OTP via SMS using the SMS service utility
      const result = await sendOTPSMS(phone, otp, brandName);

      if (result.success) {
        console.log(`OTP sent successfully to ${phone}`);
        return true;
      } else {
        console.error(`Failed to send OTP to ${phone}:`, result.error);
        return false;
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      return false;
    }
  }

  /**
   * Verify OTP
   * @param {string} providedOTP - OTP provided by user
   * @param {string} storedOTP - OTP stored in database
   * @param {Date} otpExpires - OTP expiry time
   * @returns {boolean} Verification result
   */
  verifyOTP(providedOTP, storedOTP, otpExpires) {
    // Check if OTP exists
    if (!storedOTP || !otpExpires) {
      return false;
    }

    // Check if OTP has expired
    if (new Date() > otpExpires) {
      return false;
    }

    // Check if OTP matches
    return providedOTP === storedOTP;
  }

  /**
   * Get OTP expiry time
   * @returns {Date} Expiry time
   */
  getOTPExpiryTime() {
    const now = new Date();
    return new Date(now.getTime() + (this.otpExpiryMinutes * 60 * 1000));
  }

  /**
   * Clear OTP from user data
   * @param {Object} user - User object
   * @returns {Object} User object with cleared OTP
   */
  clearOTP(user) {
    user.otp = undefined;
    user.otpExpires = undefined;
    return user;
  }
}

module.exports = new OTPService();
