const mongoose = require('mongoose');

const heroBannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  modelImage: {
    type: String,
    required: true,
    trim: true
  },
  backgroundGradient: {
    type: String,
    required: true,
    trim: true
  },
  button1Text: {
    type: String,
    required: true,
    trim: true
  },
  button1Link: {
    type: String,
    required: true,
    trim: true
  },
  button2Text: {
    type: String,
    required: true,
    trim: true
  },
  button2Link: {
    type: String,
    required: true,
    trim: true
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
heroBannerSchema.index({ order: 1, isActive: 1 });

const HeroBanner = mongoose.model('HeroBanner', heroBannerSchema);
module.exports = { HeroBanner };
