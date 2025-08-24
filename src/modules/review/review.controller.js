const { Review } = require('./review.model');
const { Product } = require('../product/product.model');
const sendResponse = require('../../utils/sendResponse');

exports.createReview = async (req, res) => {
  try {
    const review = new Review(req.body);
    await review.save();
    // Optionally update product's average rating
    await updateProductRating(review.product);
    return sendResponse({ res, statusCode: 201, success: true, message: 'Review created', data: review });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const filter = req.query.product ? { product: req.query.product } : {};
    const reviews = await Review.find(filter).populate('user', 'name');
    return sendResponse({ res, statusCode: 200, success: true, message: 'Reviews fetched', data: reviews });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return sendResponse({ res, statusCode: 404, success: false, message: 'Review not found' });
    return sendResponse({ res, statusCode: 200, success: true, message: 'Review fetched', data: review });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!review) return sendResponse({ res, statusCode: 404, success: false, message: 'Review not found' });
    await updateProductRating(review.product);
    return sendResponse({ res, statusCode: 200, success: true, message: 'Review updated', data: review });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return sendResponse({ res, statusCode: 404, success: false, message: 'Review not found' });
    await updateProductRating(review.product);
    return sendResponse({ res, statusCode: 200, success: true, message: 'Review deleted' });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

async function updateProductRating(productId) {
  const reviews = await Review.find({ product: productId, isApproved: true });
  const averageRating = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) : 0;
  const totalReviews = reviews.length;
  await Product.findByIdAndUpdate(productId, { averageRating, totalReviews });
}
