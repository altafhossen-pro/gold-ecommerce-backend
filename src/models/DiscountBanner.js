const mongoose = require('mongoose');

const discountBannerSchema = new mongoose.Schema({
  title: { type: String, required: true }, // e.g., "Only for first order"
  percentage: { type: Number, required: true }, // e.g., 50
  promoCode: { type: String, required: true },
  image: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, {
  timestamps: true,
});

const DiscountBanner = mongoose.model('DiscountBanner', discountBannerSchema);

module.exports = { DiscountBanner };
