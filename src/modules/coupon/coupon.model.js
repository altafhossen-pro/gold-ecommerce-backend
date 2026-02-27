const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  // Basic Information
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },

  // Discount Details
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },

  // Usage Limits
  maxUsage: {
    type: Number,
    default: null, // null means unlimited
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Validity
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },

  // Minimum Order Requirements
  minOrderAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Public Visibility
  isShowOnPublicly: {
    type: Boolean,
    default: false
  },

  // Description
  description: {
    type: String,
    maxlength: 200
  },

  // Admin who created/updated
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better performance
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, endDate: 1 });
couponSchema.index({ createdBy: 1 });

// Virtual for remaining usage
couponSchema.virtual('remainingUsage').get(function () {
  if (this.maxUsage === null) return 'unlimited';
  return Math.max(0, this.maxUsage - this.usedCount);
});

// Virtual for isExpired
couponSchema.virtual('isExpired').get(function () {
  return new Date() > this.endDate;
});

// Virtual for isUsable
couponSchema.virtual('isUsable').get(function () {
  if (!this.isActive) return false;
  if (this.isExpired) return false;
  if (this.maxUsage && this.usedCount >= this.maxUsage) return false;
  return true;
});

// Ensure virtual fields are serialized
couponSchema.set('toJSON', { virtuals: true });
couponSchema.set('toObject', { virtuals: true });

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;