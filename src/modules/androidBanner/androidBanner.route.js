const express = require('express');
const router = express.Router();
const {
    getAllAndroidBanners,
    getActiveAndroidBanners,
    getAndroidBannerById,
    createAndroidBanner,
    updateAndroidBanner,
    deleteAndroidBanner,
    toggleBannerStatus
} = require('./androidBanner.controller');
const verifyTokenAdmin = require('../../middlewares/verifyTokenAdmin');

// Public routes
router.get('/active', getActiveAndroidBanners);

// Admin routes
router.get('/', verifyTokenAdmin, getAllAndroidBanners);
router.get('/:id', verifyTokenAdmin, getAndroidBannerById);
router.post('/', verifyTokenAdmin, createAndroidBanner);
router.put('/:id', verifyTokenAdmin, updateAndroidBanner);
router.delete('/:id', verifyTokenAdmin, deleteAndroidBanner);
router.patch('/:id/toggle', verifyTokenAdmin, toggleBannerStatus);

module.exports = router;
