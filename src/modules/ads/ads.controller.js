const Ads = require('./ads.model');
const Product = require('../product/product.model');
const { sendResponse } = require('../../utils/sendResponse');

// Create new ad
exports.createAd = async (req, res) => {
    try {
        const { title, description, image, product, expireDate, position, priority } = req.body;
        const createdBy = req.user.id;

        // Validate product exists
        const productExists = await Product.findById(product);
        if (!productExists) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Product not found'
            });
        }

        // Validate expire date
        if (new Date(expireDate) <= new Date()) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Expire date must be in the future'
            });
        }

        const ad = new Ads({
            title,
            description,
            image,
            product,
            expireDate,
            position,
            priority,
            createdBy
        });

        await ad.save();

        // Populate product details
        await ad.populate('product', 'title price featuredImage slug');

        return sendResponse({
            res,
            statusCode: 201,
            success: true,
            message: 'Ad created successfully',
            data: ad
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};

// Get all ads (Admin)
exports.getAllAds = async (req, res) => {
    try {
        const { page = 1, limit = 10, position, isActive, search } = req.query;
        const skip = (page - 1) * limit;

        let filter = {};

        // Filter by position
        if (position) {
            filter.position = position;
        }

        // Filter by active status
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        // Search functionality
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const ads = await Ads.find(filter)
            .populate('product', 'title price featuredImage slug')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Ads.countDocuments(filter);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Ads fetched successfully',
            data: {
                ads,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalAds: total,
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};

// Get active ads (Public)
exports.getActiveAds = async (req, res) => {
    try {
        const { position } = req.query;

        const ads = await Ads.getActiveAds(position);

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Active ads fetched successfully',
            data: ads
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};

// Get single ad
exports.getAdById = async (req, res) => {
    try {
        const { id } = req.params;

        const ad = await Ads.findById(id)
            .populate('product', 'title price featuredImage slug')
            .populate('createdBy', 'name email');

        if (!ad) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Ad not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Ad fetched successfully',
            data: ad
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};

// Update ad
exports.updateAd = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, image, product, expireDate, position, priority, isActive } = req.body;

        const ad = await Ads.findById(id);
        if (!ad) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Ad not found'
            });
        }

        // Validate product if provided
        if (product) {
            const productExists = await Product.findById(product);
            if (!productExists) {
                return sendResponse({
                    res,
                    statusCode: 400,
                    success: false,
                    message: 'Product not found'
                });
            }
        }

        // Validate expire date if provided
        if (expireDate && new Date(expireDate) <= new Date()) {
            return sendResponse({
                res,
                statusCode: 400,
                success: false,
                message: 'Expire date must be in the future'
            });
        }

        // Update fields
        if (title) ad.title = title;
        if (description) ad.description = description;
        if (image) ad.image = image;
        if (product) ad.product = product;
        if (expireDate) ad.expireDate = expireDate;
        if (position) ad.position = position;
        if (priority) ad.priority = priority;
        if (isActive !== undefined) ad.isActive = isActive;

        await ad.save();

        // Populate product details
        await ad.populate('product', 'title price featuredImage slug');

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Ad updated successfully',
            data: ad
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};

// Delete ad
exports.deleteAd = async (req, res) => {
    try {
        const { id } = req.params;

        const ad = await Ads.findByIdAndDelete(id);
        if (!ad) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Ad not found'
            });
        }

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Ad deleted successfully'
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};

// Toggle ad status
exports.toggleAdStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const ad = await Ads.findById(id);
        if (!ad) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Ad not found'
            });
        }

        ad.isActive = !ad.isActive;
        await ad.save();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: `Ad ${ad.isActive ? 'activated' : 'deactivated'} successfully`,
            data: ad
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};

// Track ad click
exports.trackAdClick = async (req, res) => {
    try {
        const { id } = req.params;

        const ad = await Ads.findById(id);
        if (!ad) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Ad not found'
            });
        }

        await ad.incrementClickCount();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Click tracked successfully'
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};

// Track ad view
exports.trackAdView = async (req, res) => {
    try {
        const { id } = req.params;

        const ad = await Ads.findById(id);
        if (!ad) {
            return sendResponse({
                res,
                statusCode: 404,
                success: false,
                message: 'Ad not found'
            });
        }

        await ad.incrementViewCount();

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'View tracked successfully'
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};

// Get ads statistics
exports.getAdsStats = async (req, res) => {
    try {
        const totalAds = await Ads.countDocuments();
        const activeAds = await Ads.countDocuments({ isActive: true });
        const expiredAds = await Ads.countDocuments({ 
            isActive: true, 
            expireDate: { $lt: new Date() } 
        });

        const totalClicks = await Ads.aggregate([
            { $group: { _id: null, totalClicks: { $sum: '$clickCount' } } }
        ]);

        const totalViews = await Ads.aggregate([
            { $group: { _id: null, totalViews: { $sum: '$viewCount' } } }
        ]);

        const topAds = await Ads.find({ isActive: true })
            .populate('product', 'title price')
            .sort({ clickCount: -1 })
            .limit(5)
            .select('title clickCount viewCount product');

        return sendResponse({
            res,
            statusCode: 200,
            success: true,
            message: 'Ads statistics fetched successfully',
            data: {
                totalAds,
                activeAds,
                expiredAds,
                totalClicks: totalClicks[0]?.totalClicks || 0,
                totalViews: totalViews[0]?.totalViews || 0,
                topAds
            }
        });
    } catch (error) {
        return sendResponse({
            res,
            statusCode: 500,
            success: false,
            message: error.message
        });
    }
};
