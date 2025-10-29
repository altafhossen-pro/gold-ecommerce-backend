const Ads = require('./ads.model');
const Product = require('../product/product.model');

class AdsService {
    // Create new ad
    static async createAd(adData, createdBy) {
        try {
            // Validate product exists
            const product = await Product.findById(adData.product);
            if (!product) {
                throw new Error('Product not found');
            }

            // Validate expire date
            if (new Date(adData.expireDate) <= new Date()) {
                throw new Error('Expire date must be in the future');
            }

            const ad = new Ads({
                ...adData,
                createdBy
            });

            await ad.save();
            await ad.populate('product', 'title price featuredImage slug');

            return {
                success: true,
                data: ad,
                message: 'Ad created successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Get all ads with filters
    static async getAllAds(filters = {}) {
        try {
            const { page = 1, limit = 10, position, isActive, search } = filters;
            const skip = (page - 1) * limit;

            let query = {};

            if (position) query.position = position;
            if (isActive !== undefined) query.isActive = isActive;
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const ads = await Ads.find(query)
                .populate('product', 'title price featuredImage slug')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Ads.countDocuments(query);

            return {
                success: true,
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
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Get active ads
    static async getActiveAds(position = null) {
        try {
            const ads = await Ads.getActiveAds(position);
            return {
                success: true,
                data: ads
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Get ad by ID
    static async getAdById(id) {
        try {
            const ad = await Ads.findById(id)
                .populate('product', 'title price featuredImage slug')
                .populate('createdBy', 'name email');

            if (!ad) {
                return {
                    success: false,
                    message: 'Ad not found'
                };
            }

            return {
                success: true,
                data: ad
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Update ad
    static async updateAd(id, updateData) {
        try {
            const ad = await Ads.findById(id);
            if (!ad) {
                return {
                    success: false,
                    message: 'Ad not found'
                };
            }

            // Validate product if provided
            if (updateData.product) {
                const product = await Product.findById(updateData.product);
                if (!product) {
                    return {
                        success: false,
                        message: 'Product not found'
                    };
                }
            }

            // Validate expire date if provided
            if (updateData.expireDate && new Date(updateData.expireDate) <= new Date()) {
                return {
                    success: false,
                    message: 'Expire date must be in the future'
                };
            }

            // Update fields
            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    ad[key] = updateData[key];
                }
            });

            await ad.save();
            await ad.populate('product', 'title price featuredImage slug');

            return {
                success: true,
                data: ad,
                message: 'Ad updated successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Delete ad
    static async deleteAd(id) {
        try {
            const ad = await Ads.findByIdAndDelete(id);
            if (!ad) {
                return {
                    success: false,
                    message: 'Ad not found'
                };
            }

            return {
                success: true,
                message: 'Ad deleted successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Toggle ad status
    static async toggleAdStatus(id) {
        try {
            const ad = await Ads.findById(id);
            if (!ad) {
                return {
                    success: false,
                    message: 'Ad not found'
                };
            }

            ad.isActive = !ad.isActive;
            await ad.save();

            return {
                success: true,
                data: ad,
                message: `Ad ${ad.isActive ? 'activated' : 'deactivated'} successfully`
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Track ad click
    static async trackAdClick(id) {
        try {
            const ad = await Ads.findById(id);
            if (!ad) {
                return {
                    success: false,
                    message: 'Ad not found'
                };
            }

            await ad.incrementClickCount();

            return {
                success: true,
                message: 'Click tracked successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Track ad view
    static async trackAdView(id) {
        try {
            const ad = await Ads.findById(id);
            if (!ad) {
                return {
                    success: false,
                    message: 'Ad not found'
                };
            }

            await ad.incrementViewCount();

            return {
                success: true,
                message: 'View tracked successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Get ads statistics
    static async getAdsStats() {
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

            return {
                success: true,
                data: {
                    totalAds,
                    activeAds,
                    expiredAds,
                    totalClicks: totalClicks[0]?.totalClicks || 0,
                    totalViews: totalViews[0]?.totalViews || 0,
                    topAds
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Get ads by position
    static async getAdsByPosition(position) {
        try {
            const ads = await Ads.getActiveAds(position);
            return {
                success: true,
                data: ads
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Clean up expired ads
    static async cleanupExpiredAds() {
        try {
            const result = await Ads.updateMany(
                { 
                    isActive: true, 
                    expireDate: { $lt: new Date() } 
                },
                { isActive: false }
            );

            return {
                success: true,
                message: `${result.modifiedCount} expired ads deactivated`,
                data: { modifiedCount: result.modifiedCount }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = AdsService;
