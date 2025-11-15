const { Affiliate } = require('./affiliate.model');
const { AffiliateTracking } = require('./affiliateTracking.model');
const { User } = require('../user/user.model');
const sendResponse = require('../../utils/sendResponse');
const jwtService = require('../../services/jwtService');

// Create or get affiliate for a user
exports.createOrGetAffiliate = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if affiliate already exists
    let affiliate = await Affiliate.findOne({ user: userId });

    if (!affiliate) {
      // Create new affiliate
      affiliate = new Affiliate({
        user: userId
      });
      await affiliate.save();
    }

    // Populate user data
    await affiliate.populate('user', 'name email phone');

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Affiliate fetched successfully',
      data: affiliate
    });
  } catch (error) {
    console.error('Error creating/getting affiliate:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get affiliate stats
exports.getAffiliateStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const affiliate = await Affiliate.findOne({ user: userId });

    if (!affiliate) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Affiliate not found'
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Affiliate stats fetched successfully',
      data: {
        affiliateCode: affiliate.affiliateCode,
        totalClicks: affiliate.totalClicks,
        uniqueClicks: affiliate.uniqueClicks,
        totalPurchases: affiliate.totalPurchases,
        totalPurchaseAmount: affiliate.totalPurchaseAmount,
        isActive: affiliate.isActive,
        createdAt: affiliate.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting affiliate stats:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Track affiliate click (public endpoint - no auth required)
exports.trackAffiliateClick = async (req, res) => {
  try {
    const { affiliateCode } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referrer = req.headers.referer || req.headers.referrer || '';

    // Find affiliate by code
    const affiliate = await Affiliate.findOne({ affiliateCode: affiliateCode.toUpperCase() });

    if (!affiliate) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Invalid affiliate code'
      });
    }

    if (!affiliate.isActive) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Affiliate is inactive'
      });
    }

    // Extract device info from user agent
    const deviceInfo = userAgent;

    // Check if this is a unique click (same IP + User Agent within last 24 hours = not unique)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentClick = affiliate.clicks.find(click => 
      click.ipAddress === ipAddress &&
      click.userAgent === userAgent &&
      new Date(click.clickedAt) > oneDayAgo
    );

    // Add click
    affiliate.clicks.push({
      ipAddress,
      userAgent,
      deviceInfo,
      referrer,
      clickedAt: new Date()
    });

    // Update counters
    affiliate.totalClicks += 1;
    if (!recentClick) {
      affiliate.uniqueClicks += 1;
    }

    await affiliate.save();

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Click tracked successfully',
      data: {
        affiliateCode: affiliate.affiliateCode,
        isUnique: !recentClick
      }
    });
  } catch (error) {
    console.error('Error tracking affiliate click:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get affiliate by code (for order tracking later)
exports.getAffiliateByCode = async (affiliateCode) => {
  try {
    const affiliate = await Affiliate.findOne({ 
      affiliateCode: affiliateCode.toUpperCase(),
      isActive: true
    });
    return affiliate;
  } catch (error) {
    console.error('Error getting affiliate by code:', error);
    return null;
  }
};

// Update affiliate purchase stats (will be called from order controller later)
exports.updateAffiliatePurchase = async (affiliateCode, purchaseAmount) => {
  try {
    const affiliate = await Affiliate.findOne({ 
      affiliateCode: affiliateCode.toUpperCase() 
    });

    if (affiliate) {
      affiliate.totalPurchases += 1;
      affiliate.totalPurchaseAmount += purchaseAmount;
      await affiliate.save();
    }
  } catch (error) {
    console.error('Error updating affiliate purchase:', error);
  }
};

// Check if user has already used an affiliate code
exports.checkAffiliateCodeUsage = async (req, res) => {
  try {
    const { affiliateCode } = req.params;
    let userId = null;

    // Try to get user from token (optional auth)
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = jwtService.verifyToken(token);
        if (decoded && decoded.userId) {
          const user = await User.findById(decoded.userId).select('-password');
          if (user && user.status === 'active') {
            userId = user._id;
          }
        }
      }
    } catch (error) {
      // Token is invalid or missing - treat as guest user
      // This is fine, we'll continue without userId
    }

    if (!affiliateCode) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Affiliate code is required'
      });
    }

    // If user is not logged in, return error (guest users should be checked separately by phone number)
    if (!userId) {
      return sendResponse({
        res,
        statusCode: 401,
        success: false,
        message: 'Authentication required to check affiliate code usage'
      });
    }

    // Check if affiliate code exists and is active
    const affiliate = await Affiliate.findOne({ 
      affiliateCode: affiliateCode.toUpperCase(),
      isActive: true
    });

    if (!affiliate) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Invalid affiliate code'
      });
    }

    // Check if user is trying to use their own affiliate code
    if (affiliate.user && affiliate.user.toString() === userId.toString()) {
      return sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'You cannot use your own affiliate link',
        data: {
          canUse: false,
          reason: 'own_code',
          message: 'You cannot use your own affiliate link'
        }
      });
    }

    // Check if user has already used this affiliate code
    const existingTracking = await AffiliateTracking.findOne({
      user: userId,
      affiliateCode: affiliateCode.toUpperCase()
    });

    if (existingTracking) {
      return sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'User has already used this affiliate code',
        data: {
          canUse: false,
          reason: 'already_used',
          usedAt: existingTracking.createdAt
        }
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Affiliate code is valid',
      data: {
        canUse: true,
        reason: 'valid'
      }
    });
  } catch (error) {
    console.error('Error checking affiliate code usage:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Check if guest user (by phone number) has already used an affiliate code
exports.checkGuestAffiliateCodeUsage = async (req, res) => {
  try {
    const { affiliateCode, phoneNumber } = req.body;

    if (!affiliateCode) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Affiliate code is required'
      });
    }

    if (!phoneNumber) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Phone number is required'
      });
    }

    // Check if guest user has already used this affiliate code by phone number
    const existingTracking = await AffiliateTracking.findOne({
      mobileNumber: phoneNumber,
      affiliateCode: affiliateCode.toUpperCase()
    });

    if (existingTracking) {
      return sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Guest user has already used this affiliate code',
        data: {
          canUse: false,
          reason: 'already_used',
          usedAt: existingTracking.createdAt
        }
      });
    }

    // Check if affiliate code exists and is active
    const affiliate = await Affiliate.findOne({ 
      affiliateCode: affiliateCode.toUpperCase(),
      isActive: true
    }).populate('user', 'phone');

    if (!affiliate) {
      return sendResponse({
        res,
        statusCode: 404,
        success: false,
        message: 'Invalid affiliate code'
      });
    }

    // Check if guest user is trying to use their own affiliate code (by phone number)
    if (affiliate.user && affiliate.user.phone && phoneNumber && affiliate.user.phone === phoneNumber) {
      return sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'You cannot use your own affiliate link',
        data: {
          canUse: false,
          reason: 'own_code',
          message: 'You cannot use your own affiliate link'
        }
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Affiliate code is valid',
      data: {
        canUse: true,
        reason: 'valid'
      }
    });
  } catch (error) {
    console.error('Error checking guest affiliate code usage:', error);
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};

