const mongoose = require('mongoose');

const androidBannerSchema = new mongoose.Schema({
    image: {
        type: String,
        required: [true, 'Image is required']
    },
    link: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for active banners
androidBannerSchema.index({ isActive: 1 });

module.exports = mongoose.model('AndroidBanner', androidBannerSchema);
