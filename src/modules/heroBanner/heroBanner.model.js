const mongoose = require('mongoose');

const heroBannerSchema = new mongoose.Schema({
  image: {
    type: String,
    required: true,
    trim: true
  },
  link: {
    type: String,
    required: false,
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
