const mongoose = require('mongoose');

const adsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Ad title is required'],
        trim: true,
        maxlength: [100, 'Ad title cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Ad description is required'],
        trim: true,
        maxlength: [500, 'Ad description cannot exceed 500 characters']
    },
    image: {
        type: String,
        required: [true, 'Ad image is required']
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product reference is required']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expireDate: {
        type: Date,
        required: [true, 'Expire date is required'],
        validate: {
            validator: function(value) {
                return value > new Date();
            },
            message: 'Expire date must be in the future'
        }
    },
    position: {
        type: String,
        enum: ['homepage-banner', 'homepage-sidebar', 'product-page', 'category-page', 'search-page'],
        default: 'homepage-banner'
    },
    clickCount: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    },
    priority: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index for better performance
adsSchema.index({ isActive: 1, expireDate: 1 });
adsSchema.index({ position: 1, isActive: 1 });
adsSchema.index({ product: 1 });

// Virtual for checking if ad is expired
adsSchema.virtual('isExpired').get(function() {
    return this.expireDate < new Date();
});

// Method to increment click count
adsSchema.methods.incrementClickCount = function() {
    this.clickCount += 1;
    return this.save();
};

// Method to increment view count
adsSchema.methods.incrementViewCount = function() {
    this.viewCount += 1;
    return this.save();
};

// Static method to get active ads
adsSchema.statics.getActiveAds = function(position = null) {
    const query = {
        isActive: true,
        expireDate: { $gt: new Date() }
    };
    
    if (position) {
        query.position = position;
    }
    
    return this.find(query)
        .populate('product', 'title price featuredImage slug')
        .sort({ priority: -1, createdAt: -1 });
};

// Pre-save middleware to validate expire date
adsSchema.pre('save', function(next) {
    if (this.expireDate <= new Date()) {
        return next(new Error('Expire date must be in the future'));
    }
    next();
});

module.exports = mongoose.model('Ads', adsSchema);
