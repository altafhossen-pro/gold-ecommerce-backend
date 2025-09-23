const { OTP } = require('./otp.model');
const { User } = require('../user/user.model');
const otpService = require('../../services/otpService');
const sendResponse = require('../../utils/sendResponse');
const jwtService = require('../../services/jwtService');

/**
 * Send OTP to phone number
 */
exports.sendOTP = async (req, res) => {
  try {
    const { phone, type = 'login' } = req.body;

    if (!phone) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Phone number is required',
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[+]?[0-9]{10,15}$/;
    if (!phoneRegex.test(phone)) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Invalid phone number format',
      });
    }

    // For login OTP, check if user exists
    if (type === 'login') {
      const user = await User.findOne({ phone });
      if (!user) {
        return sendResponse({
          res,
          statusCode: 404,
          success: false,
          message: 'No account found with this phone number',
        });
      }
    }

    // Check if there's an unused OTP for this phone
    const existingOTP = await OTP.findOne({ 
      phone, 
      isUsed: false, 
      expiresAt: { $gt: new Date() } 
    });

    if (existingOTP) {
      return sendResponse({
        res,
        statusCode: 429,
        success: false,
        message: 'OTP already sent. Please wait before requesting another.',
      });
    }

    // Generate OTP
    const otpCode = otpService.generateOTP();
    const expiresAt = otpService.getOTPExpiryTime();

    // Save OTP to database
    const otpRecord = new OTP({
      phone,
      otp: otpCode,
      expiresAt,
      type
    });

    await otpRecord.save();

    // Send OTP via SMS
    const sent = await otpService.sendOTP(phone, otpCode);

    if (!sent) {
      // If SMS sending fails, delete the OTP record
      await OTP.findByIdAndDelete(otpRecord._id);
      return sendResponse({
        res,
        statusCode: 500,
        success: false,
        message: 'Failed to send OTP. Please try again.',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone,
        expiresIn: otpService.otpExpiryMinutes * 60 // in seconds
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

/**
 * Verify OTP and login
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Phone number and OTP are required',
      });
    }

    // Find the OTP record
    const otpRecord = await OTP.findOne({ 
      phone, 
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // Check attempt limit
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      return sendResponse({
        res,
        statusCode: 429,
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.',
      });
    }

    // Verify OTP
    const isValid = otpService.verifyOTP(otp, otpRecord.otp, otpRecord.expiresAt);

    if (!isValid) {
      // Increment attempt count
      otpRecord.attempts += 1;
      await otpRecord.save();

      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Invalid OTP',
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Find user by phone
    const user = await User.findOne({ phone });

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'User not found',
      });
    }

    // Update user's phone verification status and last login
    user.phoneVerified = true;
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token using service
    const token = jwtService.generateAccessToken(user._id);

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'OTP verified successfully',
      data: { 
        user: userObj, 
        token 
      },
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

/**
 * Resend OTP
 */
exports.resendOTP = async (req, res) => {
  try {
    const { phone, type = 'login' } = req.body;

    if (!phone) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Phone number is required',
      });
    }

    // Delete any existing unused OTPs for this phone
    await OTP.deleteMany({ 
      phone, 
      isUsed: false 
    });

    // Generate new OTP
    const otpCode = otpService.generateOTP();
    const expiresAt = otpService.getOTPExpiryTime();

    // Save new OTP
    const otpRecord = new OTP({
      phone,
      otp: otpCode,
      expiresAt,
      type
    });

    await otpRecord.save();

    // Send OTP
    const sent = await otpService.sendOTP(phone, otpCode);

    if (!sent) {
      await OTP.findByIdAndDelete(otpRecord._id);
      return sendResponse({
        res,
        statusCode: 500,
        success: false,
        message: 'Failed to send OTP. Please try again.',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'OTP resent successfully',
      data: {
        phone,
        expiresIn: otpService.otpExpiryMinutes * 60
      }
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

/**
 * Get OTP status (for debugging/testing)
 */
exports.getOTPStatus = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Phone number is required',
      });
    }

    const otpRecord = await OTP.findOne({ 
      phone, 
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'No active OTP found',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'OTP status retrieved',
      data: {
        phone: otpRecord.phone,
        type: otpRecord.type,
        attempts: otpRecord.attempts,
        maxAttempts: otpRecord.maxAttempts,
        expiresAt: otpRecord.expiresAt,
        isUsed: otpRecord.isUsed,
        // Don't send the actual OTP for security
      }
    });

  } catch (error) {
    console.error('Get OTP status error:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};
