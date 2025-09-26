const crypto = require('crypto');

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
    // For testing, return default OTP
    // In production, uncomment the line below and remove the return statement
    // return crypto.randomInt(100000, 999999).toString();
    return this.defaultOTP;
  }

  /**
   * Send OTP to phone number
   * @param {string} phone - Phone number
   * @param {string} otp - OTP to send
   * @returns {Promise<boolean>} Success status
   */
  async sendOTP(phone, otp) {
    try {
      // For testing purposes, we'll just log the OTP
      // In production, integrate with SMS service like Twilio, AWS SNS, etc.
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For testing, always return success
      return true;
      
      // Production code example (uncomment when ready):
      /*
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const client = require('twilio')(accountSid, authToken);

      const message = await client.messages.create({
        body: `Your OTP for login is: ${otp}. This OTP is valid for ${this.otpExpiryMinutes} minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });

      return message.sid ? true : false;
      */
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
