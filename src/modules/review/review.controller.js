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

// Get user's reviews
exports.getUserReviews = async (req, res) => {
  try {
    const userId = req.user._id;
    const reviews = await Review.find({ user: userId })
      .populate('product', 'title featuredImage slug')
      .sort({ createdAt: -1 });
    return sendResponse({ res, statusCode: 200, success: true, message: 'User reviews fetched', data: reviews });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

// Get user's reviewable products (from delivered orders)
exports.getUserReviewableProducts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { Order } = require('../order/order.model');

    // Get all delivered orders for the user
    const deliveredOrders = await Order.find({
      user: userId,
      status: 'delivered'
    }).populate('items.product', 'title featuredImage slug');

    // Extract unique products that can be reviewed
    const reviewableProducts = [];
    const reviewedProductIds = new Set();

    // Get already reviewed products
    const existingReviews = await Review.find({ user: userId }).select('product');
    existingReviews.forEach(review => reviewedProductIds.add(review.product.toString()));

    // Process each order's items
    deliveredOrders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product._id.toString();

        // Check if product is not already reviewed
        if (!reviewedProductIds.has(productId)) {
          // Check if this product is not already in reviewableProducts
          const exists = reviewableProducts.some(p => p.product._id.toString() === productId);
          if (!exists) {
            reviewableProducts.push({
              product: item.product,
              orderId: order.orderId,
              orderDate: order.createdAt,
              variant: item.variant,
              quantity: item.quantity,
              price: item.price
            });
          }
        }
      });
    });

    return sendResponse({
      res,
      statusCode: 200,
      success: true,
      message: 'Reviewable products fetched',
      data: reviewableProducts
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, success: false, message: error.message });
  }
};

// Create review with verification
exports.createUserReview = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.body) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Request body is missing'
      });
    }

    const { productId, rating, comment, images } = req.body;

    // Validate required fields
    if (!productId) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Product ID is required'
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Valid rating (1-5) is required'
      });
    }

    if (!comment || comment.trim().length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'Review comment is required'
      });
    }

    // Verify that user has purchased this product (from delivered orders)
    const { Order } = require('../order/order.model');
    const hasPurchased = await Order.findOne({
      user: userId,
      status: 'delivered',
      'items.product': productId
    });

    if (!hasPurchased) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'You can only review products you have purchased and received'
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ user: userId, product: productId });
    if (existingReview) {
      return sendResponse({
        res,
        statusCode: 400,
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    const review = new Review({
      product: productId,
      user: userId,
      rating,
      comment,
      images: images || [],
      isVerifiedPurchase: true
    });

    await review.save();
    await updateProductRating(productId);

    return sendResponse({
      res,
      statusCode: 201,
      success: true,
      message: 'Review created successfully',
      data: review
    });
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
