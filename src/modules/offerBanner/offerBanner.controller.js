const sendResponse = require('../../utils/sendResponse');
const { OfferBanner } = require('./offerBanner.model');

// Get all active offer banners
exports.getActiveBanners = async (req, res) => {
    try {
        const banners = await OfferBanner.getActiveBanners();
        
        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Active offer banners fetched successfully',
            data: banners
        });
    } catch (error) {
        console.error('Error fetching active banners:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Error fetching offer banners',
            data: null
        });
    }
};

// Get all offer banners (admin)
exports.getAllBanners = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        
        // Filter by status
        if (status === 'active') {
            const now = new Date();
            query = {
                isActive: true,
                startDate: { $lte: now },
                endDate: { $gte: now }
            };
        } else if (status === 'inactive') {
            query = { isActive: false };
        } else if (status === 'expired') {
            const now = new Date();
            query = { endDate: { $lt: now } };
        }

        // Search functionality
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { promoCode: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const banners = await OfferBanner.find(query)
            .sort({ priority: 1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');

        const total = await OfferBanner.countDocuments(query);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Offer banners fetched successfully',
            data: banners,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching banners:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Error fetching offer banners',
            data: null
        });
    }
};

// Get single offer banner
exports.getBannerById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const banner = await OfferBanner.findById(id)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Offer banner not found',
                data: null
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Offer banner fetched successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error fetching banner:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Error fetching offer banner',
            data: null
        });
    }
};

// Create new offer banner
exports.createBanner = async (req, res) => {
    try {
        const { title, subtitle, description, promoCode, image, backgroundColor, textColor, promoCodeColor, isRedirect, redirectUrl, startDate, endDate, priority } = req.body;

        // Validation
        if (!title || !promoCode || !image) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Title, promo code, and image are required',
                data: null
            });
        }

        // If redirect is enabled, redirectUrl is required
        if (isRedirect && !redirectUrl) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Redirect URL is required when redirect is enabled',
                data: null
            });
        }

        const bannerData = {
            title,
            subtitle,
            description,
            promoCode: promoCode.toUpperCase(),
            image,
            backgroundColor: backgroundColor || '#fce7f3',
            textColor: textColor || '#000000',
            promoCodeColor: promoCodeColor || '#ec4899',
            isRedirect: isRedirect || false,
            redirectUrl: isRedirect ? redirectUrl : null,
            startDate: startDate || new Date(),
            endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            priority: priority || 1,
            createdBy: req.user?.id
        };

        const banner = new OfferBanner(bannerData);
        await banner.save();

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Offer banner created successfully',
            data: banner
        });
    } catch (error) {
        console.error('Error creating banner:', error);
        
        if (error.code === 11000) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Promo code already exists',
                data: null
            });
        }

        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Error creating offer banner',
            data: null
        });
    }
};

// Update offer banner
exports.updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subtitle, description, promoCode, image, backgroundColor, textColor, promoCodeColor, isRedirect, redirectUrl, startDate, endDate, priority } = req.body;

        // Validation
        if (title && !title.trim()) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Title cannot be empty',
                data: null
            });
        }

        if (promoCode && !promoCode.trim()) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Promo code cannot be empty',
                data: null
            });
        }

        if (image && !image.trim()) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Image URL cannot be empty',
                data: null
            });
        }

        // If redirect is enabled, redirectUrl is required
        if (isRedirect && !redirectUrl) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Redirect URL is required when redirect is enabled',
                data: null
            });
        }

        const updates = {
            ...req.body,
            updatedBy: req.user?.id
        };

        // Convert promo code to uppercase if provided
        if (updates.promoCode) {
            updates.promoCode = updates.promoCode.toUpperCase();
        }

        // Clear redirectUrl if redirect is disabled
        if (updates.isRedirect === false) {
            updates.redirectUrl = null;
        }

        const banner = await OfferBanner.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Offer banner not found',
                data: null
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
        console.error('Error updating banner:', error);
        
        if (error.code === 11000) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Promo code already exists',
                data: null
            });
        }

        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Error updating offer banner',
            data: null
        });
    }
};

// Delete offer banner
exports.deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        
        const banner = await OfferBanner.findByIdAndDelete(id);

        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Offer banner not found',
                data: null
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Offer banner deleted successfully',
            data: null
        });
    } catch (error) {
        console.error('Error deleting banner:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Error deleting offer banner',
            data: null
        });
    }
};

// Toggle banner status
exports.toggleBannerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        const banner = await OfferBanner.findById(id);
        
        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Offer banner not found',
                data: null
            });
        }

        banner.isActive = !banner.isActive;
        banner.updatedBy = req.user?.id;
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
            message: 'Error updating banner status',
            data: null
        });
    }
};

// Track banner click
exports.trackBannerClick = async (req, res) => {
    try {
        const { id } = req.params;
        
        const banner = await OfferBanner.findById(id);
        
        if (!banner) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Offer banner not found',
                data: null
            });
        }

        await banner.incrementClickCount();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Banner click tracked successfully',
            data: { clickCount: banner.clickCount }
        });
    } catch (error) {
        console.error('Error tracking banner click:', error);
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: 'Error tracking banner click',
            data: null
        });
    }
};
