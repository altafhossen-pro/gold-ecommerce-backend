const express = require('express');
const router = express.Router();
const {
    getAllTestimonials,
    getTestimonialById,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    toggleTestimonialStatus,
    getActiveTestimonials
} = require('./testimonial.controller');
const verifyToken = require('../../middlewares/verifyToken');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

// Public routes
router.get('/active', getActiveTestimonials);

// Admin routes (protected)
router.get('/', verifyTokenAdmin, getAllTestimonials);
router.get('/:id', verifyToken, verifyTokenAdmin, getTestimonialById);
router.post('/', verifyToken, verifyTokenAdmin, createTestimonial);
router.put('/:id', verifyToken, verifyTokenAdmin, updateTestimonial);
router.delete('/:id', verifyToken, verifyTokenAdmin, deleteTestimonial);
router.patch('/:id/toggle-status', verifyToken, verifyTokenAdmin, toggleTestimonialStatus);

module.exports = router;
