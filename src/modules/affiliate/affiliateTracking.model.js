const mongoose = require('mongoose');

const affiliateTrackingSchema = new mongoose.Schema({
    // User who used the affiliate code (logged in user) - optional for guest orders
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true
    },
    // Mobile number (for guest users who don't have account)
    mobileNumber: {
        type: String,
        required: false,
        index: true
    },
    // Affiliate code that was used
    affiliateCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        index: true
    },
    // Order placed using this affiliate code
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    // Referrer (affiliate owner - who owns the code)
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Order total at checkout time
    orderTotal: {
        type: Number,
        default: 0
    },
    // Discount received by purchaser
    affiliateDiscount: {
        type: Number,
        default: 0
    },
    // Status tracking
    purchaserPointsAwarded: {
        type: Boolean,
        default: false
    },
    purchaserPointsAwardedAt: {
        type: Date
    },
    referrerPointsAwarded: {
        type: Boolean,
        default: false
    },
    referrerPointsAwardedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for faster queries
affiliateTrackingSchema.index({ user: 1, createdAt: -1 });
affiliateTrackingSchema.index({ referrer: 1, createdAt: -1 });
affiliateTrackingSchema.index({ order: 1 });
affiliateTrackingSchema.index({ affiliateCode: 1 });

const AffiliateTracking = mongoose.model('AffiliateTracking', affiliateTrackingSchema);

module.exports = { AffiliateTracking };

