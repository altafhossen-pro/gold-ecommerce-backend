const mongoose = require('mongoose');

const offerBannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    subtitle: {
        type: String,
        required: [true, 'Subtitle is required'],
        trim: true,
        maxlength: [200, 'Subtitle cannot exceed 200 characters']
    },
    image: {
        type: String,
        required: [true, 'Image is required']
    },
    type: {
        type: String,
        enum: ['offer', 'promo'],
        required: true,
        default: 'offer'
    },
    buttonText: {
        type: String,
        trim: true,
        maxlength: [50, 'Button text cannot exceed 50 characters']
    },
    buttonLink: {
        type: String,
        trim: true
    },
    discountPercentage: {
        type: Number,
        min: [0, 'Discount percentage cannot be negative'],
        max: [100, 'Discount percentage cannot exceed 100']
    },
    discountText: {
        type: String,
        trim: true,
        maxlength: [50, 'Discount text cannot exceed 50 characters']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for active banners
offerBannerSchema.index({ isActive: 1 });

// Ensure only one active banner at a time
offerBannerSchema.pre('save', async function(next) {
    if (this.isActive) {
        // Deactivate all other banners
        await this.constructor.updateMany(
            { _id: { $ne: this._id }, isActive: true },
            { isActive: false }
        );
    }
    next();
});

module.exports = mongoose.model('OfferBanner', offerBannerSchema);