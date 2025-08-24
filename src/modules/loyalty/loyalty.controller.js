const { Loyalty } = require('./loyalty.model');
const sendResponse = require('../../utils/sendResponse');

exports.getLoyalty = async (req, res) => {
  try {
    const { userId } = req.query;
    const loyalty = await Loyalty.findOne({ user: userId });
    return sendResponse({ res, statusCode: 200, success: true, message: 'Loyalty info fetched', data: loyalty });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.earnPoints = async (req, res) => {
  try {
    const { userId, points, order, description } = req.body;
    let loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) loyalty = new Loyalty({ user: userId, points: 0, history: [] });
    loyalty.points += points;
    loyalty.history.push({ type: 'earn', points, order, description });
    await loyalty.save();
    return sendResponse({ res, statusCode: 200, success: true, message: 'Points earned', data: loyalty });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.redeemPoints = async (req, res) => {
  try {
    const { userId, points, order, description } = req.body;
    let loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty || loyalty.points < points) {
      return sendResponse({ res, statusCode: 400, success: false, message: 'Not enough points' });
    }
    loyalty.points -= points;
    loyalty.history.push({ type: 'redeem', points, order, description });
    await loyalty.save();
    return sendResponse({ res, statusCode: 200, success: true, message: 'Points redeemed', data: loyalty });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { userId } = req.query;
    const loyalty = await Loyalty.findOne({ user: userId });
    return sendResponse({ res, statusCode: 200, success: true, message: 'Loyalty history fetched', data: loyalty ? loyalty.history : [] });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.adjustPoints = async (req, res) => {
  try {
    const { userId, points, description } = req.body;
    let loyalty = await Loyalty.findOne({ user: userId });
    if (!loyalty) loyalty = new Loyalty({ user: userId, points: 0, history: [] });
    loyalty.points += points;
    loyalty.history.push({ type: 'adjust', points, description });
    await loyalty.save();
    return sendResponse({ res, statusCode: 200, success: true, message: 'Points adjusted', data: loyalty });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};
