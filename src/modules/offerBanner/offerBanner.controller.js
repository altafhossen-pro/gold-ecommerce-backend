const sendResponse = require('../../utils/sendResponse');
const OfferBanner = require('./offerBanner.model');

// Get all offer banners (admin)
const getAllOfferBanners = async (req, res) => {
    try {
        const banners = await OfferBanner.find()
            .sort({ createdAt: -1 })
            .select('-__v');

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Offer banners retrieved successfully',
            data: banners
        });
    } catch (error) {
        console.error('Error fetching offer banners:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get active offer banner (frontend)
const getActiveOfferBanner = async (req, res) => {
    try {
        const banner = await OfferBanner.findOne({ 
            isActive: true
        });

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 200,
                success: true,
                data: null,
                message: 'No active offer banner found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Active offer banner retrieved successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error fetching active offer banner:', error);
        return sendResponse(res, 500, false, 'Internal server error');
    }
};

// Get single offer banner by ID
const getOfferBannerById = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await OfferBanner.findById(id).select('-__v');

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Offer banner not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Offer banner retrieved successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error fetching offer banner:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create new offer banner
const createOfferBanner = async (req, res) => {
    try {
        const bannerData = req.body;

        // Clean undefined and null values
        const cleanedData = {};
        Object.keys(bannerData).forEach(key => {
            if (bannerData[key] !== undefined && bannerData[key] !== null) {
                cleanedData[key] = bannerData[key];
            }
        });

        // If this banner is being set as active, deactivate others
        if (cleanedData.isActive) {
            await OfferBanner.updateMany({ isActive: true }, { isActive: false });
        }

        const banner = new OfferBanner(cleanedData);
        await banner.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Offer banner created successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error creating offer banner:', error);
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

// Update offer banner
const updateOfferBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Clean undefined and null values
        const cleanedData = {};
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && updateData[key] !== null) {
                cleanedData[key] = updateData[key];
            }
        });

        // If this banner is being set as active, deactivate others
        if (cleanedData.isActive) {
            await OfferBanner.updateMany(
                { _id: { $ne: id }, isActive: true },
                { isActive: false }
            );
        }

        const banner = await OfferBanner.findByIdAndUpdate(
            id,
            cleanedData,
            { new: true, runValidators: true }
        ).select('-__v');

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Offer banner not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Offer banner updated successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error updating offer banner:', error);
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

// Delete offer banner
const deleteOfferBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await OfferBanner.findByIdAndDelete(id);

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Offer banner not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Offer banner deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting offer banner:', error);
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
        const banner = await OfferBanner.findById(id);

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Offer banner not found'
            });
        }

        // If activating this banner, deactivate others
        if (!banner.isActive) {
            await OfferBanner.updateMany({ _id: { $ne: id }, isActive: true }, { isActive: false });
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
    getAllOfferBanners,
    getActiveOfferBanner,
    getOfferBannerById,
    createOfferBanner,
    updateOfferBanner,
    deleteOfferBanner,
    toggleBannerStatus
};