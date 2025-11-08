const mongoose = require('mongoose');

const affiliateClickSchema = new mongoose.Schema({
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    deviceInfo: {
        type: String
    },
    referrer: {
        type: String
    },
    clickedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const affiliateSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
  affiliateCode: {
    type: String,
    required: false, // Will be generated in pre-save hook
    unique: true,
    uppercase: true,
    trim: true
  },
    totalClicks: {
        type: Number,
        default: 0
    },
    uniqueClicks: {
        type: Number,
        default: 0
    },
    totalPurchases: {
        type: Number,
        default: 0
    },
    totalPurchaseAmount: {
        type: Number,
        default: 0
    },
    clicks: [affiliateClickSchema],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster lookups
affiliateSchema.index({ affiliateCode: 1 });
affiliateSchema.index({ user: 1 });

// Generate unique affiliate code before saving
affiliateSchema.pre('save', async function (next) {
    // Only generate if code doesn't exist and this is a new document
    if (!this.affiliateCode && this.isNew) {
        // Generate a unique code: 8 characters alphanumeric
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            code = '';
            for (let i = 0; i < 8; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            // Check if code already exists
            const AffiliateModel = this.constructor;
            const existing = await AffiliateModel.findOne({ affiliateCode: code });
            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            // Fallback: use timestamp-based code if all attempts fail
            code = `AFF${Date.now().toString(36).toUpperCase().slice(-5)}`;
        }

        this.affiliateCode = code;
    }
    next();
});

const Affiliate = mongoose.model('Affiliate', affiliateSchema);

module.exports = { Affiliate };

