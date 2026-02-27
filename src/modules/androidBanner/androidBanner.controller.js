const sendResponse = require('../../utils/sendResponse');
const AndroidBanner = require('./androidBanner.model');

// Get all android banners (admin)
const getAllAndroidBanners = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const banners = await AndroidBanner.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v');

        const total = await AndroidBanner.countDocuments();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Android banners retrieved successfully',
            data: {
                banners,
                pagination: {
                    totalItems: total,
                    currentPage: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching android banners:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get active android banners (public/android app)
const getActiveAndroidBanners = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const banners = await AndroidBanner.find({ isActive: true })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v');

        const total = await AndroidBanner.countDocuments({ isActive: true });

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Active android banners retrieved successfully',
            data: {
                banners,
                pagination: {
                    totalItems: total,
                    currentPage: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching active android banners:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get single android banner by ID
const getAndroidBannerById = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await AndroidBanner.findById(id).select('-__v');

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Android banner not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Android banner retrieved successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error fetching android banner:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create new android banner
const createAndroidBanner = async (req, res) => {
    try {
        const bannerData = req.body;
        const banner = new AndroidBanner(bannerData);
        await banner.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Android banner created successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error creating android banner:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Validation error',
                data: errors
            });
        }
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update android banner
const updateAndroidBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const banner = await AndroidBanner.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select('-__v');

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Android banner not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Android banner updated successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error updating android banner:', error);
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Validation error',
                data: errors
            });
        }
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete android banner
const deleteAndroidBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await AndroidBanner.findByIdAndDelete(id);

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Android banner not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Android banner deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting android banner:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Toggle banner active status
const toggleBannerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await AndroidBanner.findById(id);

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Android banner not found'
            });
        }

        banner.isActive = !banner.isActive;
        await banner.save();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: `Banner ${banner.isActive ? 'activated' : 'deactivated'} successfully`,
            data: banner
        });
    } catch (error) {
        console.error('Error toggling banner status:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getAllAndroidBanners,
    getActiveAndroidBanners,
    getAndroidBannerById,
    createAndroidBanner,
    updateAndroidBanner,
    deleteAndroidBanner,
    toggleBannerStatus
};
