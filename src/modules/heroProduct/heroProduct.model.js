const mongoose = require('mongoose');

const heroProductSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  customImage: {
    type: String,
    trim: true,
    default: null // Optional custom image URL
  },
  size: {
    type: String,
    enum: ['large', 'small'],
    required: true,
    default: 'large'
  },
  badge: {
    text: {
      type: String,
      trim: true,
      default: ''
    },
    color: {
      type: String,
      trim: true,
      default: 'bg-pink-500'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
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
  timestamps: true
});

// Index for ordering and active status
heroProductSchema.index({ order: 1, isActive: 1 });

const HeroProduct = mongoose.model('HeroProduct', heroProductSchema);
module.exports = { HeroProduct };
