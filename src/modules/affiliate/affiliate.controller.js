const { Affiliate } = require('./affiliate.model');
const { User } = require('../user/user.model');
const sendResponse = require('../../utils/sendResponse');

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

