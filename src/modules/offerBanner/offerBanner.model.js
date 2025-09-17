const mongoose = require('mongoose');

const offerBannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    subtitle: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    promoCode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        index: true
    },
    image: {
        type: String,
        required: true
    },
    backgroundColor: {
        type: String,
        default: '#fce7f3' // Light pink default
    },
    textColor: {
        type: String,
        default: '#000000'
    },
    promoCodeColor: {
        type: String,
        default: '#ec4899' // Pink default
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isRedirect: {
        type: Boolean,
        default: false
    },
    redirectUrl: {
        type: String,
        trim: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    priority: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
    },
    clickCount: {
        type: Number,
        default: 0
    },
    targetAudience: {
        type: String,
        enum: ['all', 'new_customers', 'existing_customers', 'vip_customers'],
        default: 'all'
    },
    conditions: {
        minOrderAmount: {
            type: Number,
            default: 0
        },
        maxDiscountAmount: {
            type: Number
        },
        applicableCategories: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category'
        }],
        applicableProducts: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        }]
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
offerBannerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
offerBannerSchema.index({ priority: 1 });

// Virtual for checking if banner is currently active
offerBannerSchema.virtual('isCurrentlyActive').get(function() {
    const now = new Date();
    return this.isActive && 
           this.startDate <= now && 
           this.endDate >= now;
});

// Virtual for days remaining
offerBannerSchema.virtual('daysRemaining').get(function() {
    const now = new Date();
    const endDate = new Date(this.endDate);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
});

// Pre-save middleware to validate dates
offerBannerSchema.pre('save', function(next) {
    if (this.startDate >= this.endDate) {
        return next(new Error('Start date must be before end date'));
    }
    next();
});

// Static method to get active banners
offerBannerSchema.statics.getActiveBanners = function() {
    const now = new Date();
    return this.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
    }).sort({ priority: 1, createdAt: -1 });
};

// Instance method to increment click count
offerBannerSchema.methods.incrementClickCount = function() {
    this.clickCount += 1;
    return this.save();
};

const OfferBanner = mongoose.model('OfferBanner', offerBannerSchema);

module.exports = { OfferBanner };
