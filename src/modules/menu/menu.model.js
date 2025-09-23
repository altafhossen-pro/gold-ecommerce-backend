const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['header', 'footer'],
    trim: true
  },
  section: {
    type: String,
    required: function() {
      return this.type === 'footer';
    },
    enum: ['quickLinks', 'utilities', 'about', 'contact', 'socialMedia'],
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  href: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  target: {
    type: String,
    enum: ['_self', '_blank'],
    default: '_self'
  },
  icon: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null
  },
  // For contact section
  contactType: {
    type: String,
    enum: ['address', 'phone', 'email', 'callToAction'],
    default: null
  },
  // For social media
  socialPlatform: {
    type: String,
    enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok'],
    default: null
  }
}, {
  timestamps: true
});

// Index for ordering and type
menuSchema.index({ type: 1, order: 1 });
menuSchema.index({ type: 1, section: 1, order: 1 });

const Menu = mongoose.model('Menu', menuSchema);
module.exports = { Menu };
