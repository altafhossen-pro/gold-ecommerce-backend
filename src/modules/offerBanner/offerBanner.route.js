const express = require('express');
const router = express.Router();
const {
    getAllOfferBanners,
    getActiveOfferBanner,
    getOfferBannerById,
    createOfferBanner,
    updateOfferBanner,
    deleteOfferBanner,
    toggleBannerStatus
} = require('./offerBanner.controller');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

// Public routes
router.get('/active', getActiveOfferBanner);

// Admin routes
router.get('/', verifyTokenAdmin, getAllOfferBanners);
router.get('/:id', verifyTokenAdmin, getOfferBannerById);
router.post('/', verifyTokenAdmin, createOfferBanner);
router.put('/:id', verifyTokenAdmin, updateOfferBanner);
router.delete('/:id', verifyTokenAdmin, deleteOfferBanner);
router.patch('/:id/toggle', verifyTokenAdmin, toggleBannerStatus);

module.exports = router;