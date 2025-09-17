const express = require('express');
const router = express.Router();
const reviewController = require('./review.controller');
const verifyToken = require('../../middlewares/verifyToken');

// Public routes
router.get('/', reviewController.getReviews);
router.get('/:id', reviewController.getReviewById);

// Protected routes (require authentication)
router.post('/', verifyToken, reviewController.createUserReview);
router.get('/user/reviews', verifyToken, reviewController.getUserReviews);
router.get('/user/reviewable-products', verifyToken, reviewController.getUserReviewableProducts);
router.put('/:id', verifyToken, reviewController.updateReview);
router.delete('/:id', verifyToken, reviewController.deleteReview);

module.exports = router;
