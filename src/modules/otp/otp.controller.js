const { OTP } = require('./otp.model');
const { User } = require('../user/user.model');
const otpService = require('../../services/otpService');
const sendResponse = require('../../utils/sendResponse');
const jwtService = require('../../services/jwtService');
const { sendOTPEmail } = require('../../utils/email');

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

    // For login OTP, we allow both existing users and new users (auto-register)
    // No need to check if user exists - we'll create user during OTP verification if needed

    // Rate limiting: Check OTP requests in the last 1 minute (60 seconds)
    const rateLimitWindow = 60 * 1000; // 1 minute in milliseconds
    const rateLimitCount = 3; // Maximum 3 OTP requests per minute
    const oneMinuteAgo = new Date(Date.now() - rateLimitWindow);

    const recentOTPRequests = await OTP.countDocuments({
      phone,
      createdAt: { $gte: oneMinuteAgo }
    });

    if (recentOTPRequests >= rateLimitCount) {
      return sendResponse({
        res,
        statusCode: 429,
        success: false,
        message: 'Too many OTP requests. Please wait a minute before requesting another.',
      });
    }

    // Check if there's an unused OTP for this phone (still valid)
    const existingOTP = await OTP.findOne({ 
      phone, 
      isUsed: false, 
      expiresAt: { $gt: new Date() } 
    });

    if (existingOTP) {
      // Calculate remaining time for the existing OTP
      const remainingSeconds = Math.ceil((existingOTP.expiresAt - new Date()) / 1000);
      return sendResponse({
        res,
        statusCode: 429,
        success: false,
        message: `OTP already sent. Please wait ${remainingSeconds} seconds before requesting another.`,
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

    // Find the OTP record (check both used and expired)
    const otpRecord = await OTP.findOne({ 
      phone, 
      isUsed: false
    });

    // Check if OTP exists, is expired, or invalid
    if (!otpRecord) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Your entered otp invalid or expired',
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Your entered otp invalid or expired',
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
        message: 'Your entered otp invalid or expired',
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Find user by phone, or create new user if doesn't exist (auto-register)
    let user = await User.findOne({ phone });

    if (!user) {
      // Create new user account automatically (email is optional in model)
      // Generate a random password (user won't need it for phone login)
      const bcrypt = require('bcryptjs');
      const randomPassword = Math.random().toString(36).slice(-12) + Date.now().toString(36);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = new User({
        phone,
        // email is optional, so we don't set it
        password: hashedPassword,
        phoneVerified: true,
        registerType: 'phone', // Track that user registered via phone/OTP
        name: `User_${phone.substring(phone.length - 4)}`, // Default name with last 4 digits
        role: 'customer', // Default role
        status: 'active', // Default status
      });
      await user.save();
    } else {
      // Update existing user's phone verification status and last login
      user.phoneVerified = true;
      user.lastLogin = new Date();
      await user.save();
    }

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

    // Rate limiting: Check OTP requests in the last 1 minute (60 seconds)
    const rateLimitWindow = 60 * 1000; // 1 minute in milliseconds
    const rateLimitCount = 3; // Maximum 3 OTP requests per minute
    const oneMinuteAgo = new Date(Date.now() - rateLimitWindow);

    const recentOTPRequests = await OTP.countDocuments({
      phone,
      createdAt: { $gte: oneMinuteAgo }
    });

    if (recentOTPRequests >= rateLimitCount) {
      return sendResponse({
        res,
        statusCode: 429,
        success: false,
        message: 'Too many OTP requests. Please wait a minute before requesting another.',
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

/**
 * Send OTP to email for registration
 */
exports.sendRegisterOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Email address is required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Invalid email format',
      });
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendResponse({
        res,
        statusCode: 409,
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Rate limiting: Check OTP requests in the last 1 minute
    const rateLimitWindow = 60 * 1000; // 1 minute
    const rateLimitCount = 5; // Maximum 5 OTP requests per minute
    const blockDuration = 5 * 60 * 1000; // Block for 5 minutes
    const oneMinuteAgo = new Date(Date.now() - rateLimitWindow);

    // Get recent OTP requests ordered by creation time
    const recentOTPRequests = await OTP.find({
      email: email.toLowerCase(),
      type: 'registration',
      createdAt: { $gte: oneMinuteAgo }
    }).sort({ createdAt: -1 });

    // If 5 or more requests in last 1 minute, check if user should be blocked
    if (recentOTPRequests.length >= rateLimitCount) {
      const fifthRequestTime = recentOTPRequests[rateLimitCount - 1].createdAt;
      const timeSinceFifthRequest = Date.now() - fifthRequestTime.getTime();
      
      // If less than 5 minutes have passed since the 5th request, block user
      if (timeSinceFifthRequest < blockDuration) {
        const remainingBlockTime = blockDuration - timeSinceFifthRequest;
        const remainingMinutes = Math.ceil(remainingBlockTime / (60 * 1000));
        const remainingSeconds = Math.ceil((remainingBlockTime % (60 * 1000)) / 1000);
        
        let timeMessage = '';
        if (remainingMinutes > 0) {
          timeMessage = `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
          if (remainingSeconds > 0) {
            timeMessage += ` and ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
          }
        } else {
          timeMessage = `${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
        }
        
        return sendResponse({
          res,
          statusCode: 429,
          success: false,
          message: `Too many OTP requests. Please wait ${timeMessage} before requesting another.`,
        });
      }
    }

    // Check if there's an unused OTP for this email (still valid)
    const existingOTP = await OTP.findOne({ 
      email: email.toLowerCase(), 
      isUsed: false, 
      expiresAt: { $gt: new Date() },
      type: 'registration'
    });

    // If existing valid OTP exists, delete it and replace with new one
    if (existingOTP) {
      await OTP.findByIdAndDelete(existingOTP._id);
    }

    // Generate OTP
    const otpCode = otpService.generateOTP();
    const expiresAt = otpService.getOTPExpiryTime();

    // Save OTP to database
    const otpRecord = new OTP({
      email: email.toLowerCase(),
      otp: otpCode,
      expiresAt,
      type: 'registration'
    });

    await otpRecord.save();

    // Send OTP via Email
    try {
      await sendOTPEmail(email.toLowerCase(), otpCode);
    } catch (emailError) {
      // If email sending fails, delete the OTP record
      await OTP.findByIdAndDelete(otpRecord._id);
      console.error('Email sending error:', emailError);
      return sendResponse({
        res,
        statusCode: 500,
        success: false,
        message: 'Failed to send OTP email. Please try again.',
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'OTP sent successfully to your email',
      data: {
        email: email.toLowerCase(),
        expiresIn: otpService.otpExpiryMinutes * 60 // in seconds
      }
    });

  } catch (error) {
    console.error('Send Register OTP error:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

/**
 * Verify email OTP only (without creating account) - for Step 2
 */
exports.verifyRegisterOTPOnly = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Email and OTP are required',
      });
    }

    // Find the OTP record
    const otpRecord = await OTP.findOne({ 
      email: email.toLowerCase(), 
      isUsed: false,
      type: 'registration'
    });

    // Check if OTP exists or expired
    if (!otpRecord) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Your entered otp invalid or expired',
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Your entered otp invalid or expired',
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

    // Verify OTP (without marking as used - we'll do that in Step 3)
    const isValid = otpService.verifyOTP(otp, otpRecord.otp, otpRecord.expiresAt);

    if (!isValid) {
      // Increment attempt count
      otpRecord.attempts += 1;
      await otpRecord.save();

      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Your entered otp invalid or expired',
      });
    }

    // Don't mark as used here - we'll do that in final registration step
    // Just return success so user can proceed to Step 3

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'OTP verified successfully',
    });

  } catch (error) {
    console.error('Verify Register OTP Only error:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};

/**
 * Verify email OTP and create user account
 */
exports.verifyRegisterOTP = async (req, res) => {
  try {
    const { email, otp, name, password, phone } = req.body;

    if (!email || !otp) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Email and OTP are required',
      });
    }

    if (!name || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Name and password are required',
      });
    }

    // Find the OTP record
    const otpRecord = await OTP.findOne({ 
      email: email.toLowerCase(), 
      isUsed: false,
      type: 'registration'
    });

    // Check if OTP exists or expired
    if (!otpRecord) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Your entered otp invalid or expired',
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Your entered otp invalid or expired',
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
        message: 'Your entered otp invalid or expired',
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Check if user already exists (double check)
    const existingUser = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        ...(phone ? [{ phone }] : [])
      ]
    });

    if (existingUser) {
      return sendResponse({
        res,
        statusCode: 409,
        success: false,
        message: 'User with this email or phone already exists',
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user account
    // Only include phone if it's provided (don't set to null to avoid unique index issues)
    const userData = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      registerType: 'email', // Track registration method
      emailVerified: true, // Email is verified via OTP
      role: 'customer',
      status: 'active',
    };

    // Only add phone if it's provided
    if (phone && phone.trim()) {
      userData.phone = phone.trim();
    }

    const user = new User(userData);

    await user.save();

    // Generate JWT token
    const token = jwtService.generateAccessToken(user._id);

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Account created successfully',
      data: { 
        user: userObj, 
        token 
      },
    });

  } catch (error) {
    console.error('Verify Register OTP error:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error',
    });
  }
};
