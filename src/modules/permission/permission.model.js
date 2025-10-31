const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  module: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  action: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ['product', 'order', 'user', 'category', 'coupon', 'settings', 'content', 'analytics', 'system','admin','ads'],
    required: true,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound unique index to prevent duplicate permissions
permissionSchema.index({ module: 1, action: 1 }, { unique: true });

// Virtual for formatted permission string (e.g., "product.create")
permissionSchema.virtual('permissionString').get(function() {
  return `${this.module}.${this.action}`;
});

permissionSchema.set('toJSON', { virtuals: true });
permissionSchema.set('toObject', { virtuals: true });

const Permission = mongoose.model('Permission', permissionSchema);

module.exports = { Permission };

