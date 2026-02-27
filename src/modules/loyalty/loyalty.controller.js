const { Loyalty } = require('./loyalty.model');
const Settings = require('../settings/settings.model');
const sendResponse = require('../../utils/sendResponse');

exports.getLoyalty = async (req, res) => {
  try {
    const { userId } = req.query;

    // Check if the authenticated user is requesting their own data or is an admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return sendResponse({ res, statusCode: 403, success: false, message: 'Forbidden: You cannot access this data' });
    }

    const loyalty = await Loyalty.findOne({ user: userId });

    // Get settings to calculate total value
    let settings = await Settings.findOne();

    // If no settings exist, create default settings
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }

    const coinValue = settings?.loyaltySettings?.coinValue || 1;

    if (!loyalty) {
      return sendResponse({
        res,
        statusCode: 200,
        success: true,
        message: 'Loyalty info fetched',
        data: {
          coins: 0,
          totalValue: 0,
          coinValue: coinValue,
          history: []
        }
      });
    }

    const totalValue = loyalty.coins * coinValue;

    const responseData = {
      coins: loyalty.coins,
      totalValue: totalValue,
      coinValue: coinValue,
      history: loyalty.history
    };

    return sendResponse({ res, statusCode: 200, success: true, message: 'Loyalty info fetched', data: responseData });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.earnPoints = async (req, res) => {
  try {
    const { userId, coins, order, description } = req.body;
    let loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) loyalty = new Loyalty({ user: userId, points: 0, coins: 0, history: [] });

    loyalty.coins += coins || 0;
    loyalty.history.unshift({ type: 'earn', points: 0, coins: coins || 0, order, description });
    await loyalty.save();
    return sendResponse({ res, statusCode: 200, success: true, message: 'Coins earned', data: loyalty });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.redeemPoints = async (req, res) => {
  try {
    const { userId, coins, order, description } = req.body;
    let loyalty = await Loyalty.findOne({ user: userId });

    // Check if user has enough coins
    if (!loyalty) {
      return sendResponse({ res, statusCode: 400, success: false, message: 'No loyalty account found' });
    }

    if (coins && loyalty.coins < coins) {
      return sendResponse({ res, statusCode: 400, success: false, message: 'Not enough coins' });
    }

    // Deduct coins
    if (coins) loyalty.coins -= coins;

    loyalty.history.unshift({
      type: 'redeem',
      points: 0,
      coins: coins || 0,
      order,
      description
    });

    await loyalty.save();
    return sendResponse({ res, statusCode: 200, success: true, message: 'Coins redeemed', data: loyalty });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { userId, limit = 10 } = req.query;

    // Check if the authenticated user is requesting their own data or is an admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return sendResponse({ res, statusCode: 403, success: false, message: 'Forbidden: You cannot access this data' });
    }

    const loyalty = await Loyalty.findOne({ user: userId }).populate('history.order', 'orderId');

    if (!loyalty || !loyalty.history || loyalty.history.length === 0) {
      return sendResponse({ res, statusCode: 200, success: true, message: 'Loyalty history fetched', data: [] });
    }

    // History is already sorted (newest first) since we use unshift()
    // Just limit the results
    const sortedHistory = loyalty.history.slice(0, parseInt(limit));

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Loyalty history fetched',
      data: sortedHistory,
      total: loyalty.history.length,
      showing: sortedHistory.length
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.adjustPoints = async (req, res) => {
  try {
    const { userId, points, coins, description } = req.body;
    let loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) loyalty = new Loyalty({ user: userId, points: 0, coins: 0, history: [] });

    loyalty.points += points || 0;
    loyalty.coins += coins || 0;
    loyalty.history.unshift({ type: 'adjust', points: points || 0, coins: coins || 0, description });
    await loyalty.save();
    return sendResponse({ res, statusCode: 200, success: true, message: 'Points/Coins adjusted', data: loyalty });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

// Earn coins based on order items (called when order is delivered or payment successful)
exports.earnCoinsFromOrder = async (userId, orderId, orderItems, reason = 'order_completed') => {
  try {
    // Get settings
    const settings = await Settings.findOne();
    if (!settings || !settings.loyaltySettings?.isLoyaltyEnabled) {
      return { success: false, message: 'Loyalty system disabled' };
    }

    // Calculate total items
    const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate coins to earn (1 coin per item)
    const coinsToEarn = totalItems * settings.loyaltySettings.coinPerItem;

    if (coinsToEarn <= 0) {
      return { success: false, message: 'No coins to earn' };
    }

    // Get or create loyalty record
    let loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) {
      loyalty = new Loyalty({ user: userId, points: 0, coins: 0, history: [] });
    }

    // Add coins
    loyalty.coins += coinsToEarn;
    loyalty.history.unshift({
      type: 'earn',
      points: 0,
      coins: coinsToEarn,
      order: orderId,
      description: `Earned ${coinsToEarn} coins for ${totalItems} items (${reason})`
    });

    await loyalty.save();

    return {
      success: true,
      message: `Earned ${coinsToEarn} coins`,
      data: { coinsEarned: coinsToEarn, totalCoins: loyalty.coins }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Redeem coins during checkout
exports.redeemCoinsForCheckout = async (req, res) => {
  try {
    const { coinsToRedeem, orderTotal } = req.body;
    const userId = req.user._id;

    // Get settings
    const settings = await Settings.findOne();
    if (!settings || !settings.loyaltySettings?.isLoyaltyEnabled) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Loyalty system is disabled'
      });
    }

    // Validate input
    if (!coinsToRedeem || coinsToRedeem <= 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Invalid coin amount'
      });
    }

    if (!orderTotal || orderTotal <= 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Invalid order total'
      });
    }

    // Calculate coin value
    const coinValue = coinsToRedeem * settings.loyaltySettings.coinValue;

    // No maximum redeem percentage limit - user can pay entire order with coins

    // Get user's loyalty record
    let loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'No loyalty account found'
      });
    }

    // Check if user has enough coins
    if (loyalty.coins < coinsToRedeem) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Not enough coins available'
      });
    }

    // Calculate discount amount
    const discountAmount = Math.round(coinsToRedeem * settings.loyaltySettings.coinValue);
    const finalOrderTotal = orderTotal - discountAmount;

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Coins redemption calculated successfully',
      data: {
        coinsToRedeem,
        coinValue: settings.loyaltySettings.coinValue,
        discountAmount,
        originalTotal: orderTotal,
        finalTotal: finalOrderTotal,
        availableCoins: loyalty.coins
      }
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      success: false,
      message: error.message || 'Server error'
    });
  }
};
