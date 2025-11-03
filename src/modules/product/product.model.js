const mongoose = require('mongoose');

// Product Images Schema
const productImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  altText: { type: String },
  isPrimary: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
}, { _id: false });

// Product Specifications Schema
const specificationSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
  group: { type: String },
}, { _id: false });

// Variant Attributes Schema (Size, Color, Style etc.)
const variantAttributeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: String, required: true },
  displayValue: { type: String },
  hexCode: { type: String },
  image: { type: String },
}, { _id: false });

// Product Variant Schema
const productVariantSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, index: true },
  barcode: { type: String },
  attributes: [variantAttributeSchema],
  currentPrice: { type: Number, required: true },
  originalPrice: { type: Number },
  costPrice: { type: Number },
  salePrice: { type: Number },
  stockQuantity: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  stockStatus: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'low_stock', 'pre_order'],
    default: 'in_stock',
  },
  weight: { type: Number },
  dimensions: {
    length: { type: Number },
    width: { type: Number },
    height: { type: Number },
  },
  images: [productImageSchema],
  isActive: { type: Boolean, default: true },
  availableFrom: { type: Date },
  availableUntil: { type: Date },
}, { timestamps: true });

// SEO Schema
const seoSchema = new mongoose.Schema({
  metaTitle: { type: String },
  metaDescription: { type: String },
  metaKeywords: [String],
  canonicalUrl: { type: String },
  ogTitle: { type: String },
  ogDescription: { type: String },
  ogImage: { type: String },
}, { _id: false });

// Review Schema
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String },
  comment: { type: String },
  images: [String],
  isVerifiedPurchase: { type: Boolean, default: false },
  helpfulCount: { type: Number, default: 0 },
  isApproved: { type: Boolean, default: false },
}, { timestamps: true });

// Shipping Information Schema
const shippingInfoSchema = new mongoose.Schema({
  weight: { type: Number },
  dimensions: {
    length: { type: Number },
    width: { type: Number },
    height: { type: Number },
  },
  shippingClass: { type: String },
  freeShippingEligible: { type: Boolean, default: false },
  handlingTime: { type: Number, default: 1 },
}, { _id: false });

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  shortDescription: { type: String, maxlength: 500 },
  description: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  brand: { type: String },
  tags: [String],
  productType: {
    type: String,
    enum: ['simple', 'variable', 'grouped', 'digital'],
    default: 'simple',
  },
  // Jewelry specific properties
  isBracelet: { type: Boolean, default: false },
  isRing: { type: Boolean, default: false },
  braceletSizes: [{ type: String }], 
  ringSizes: [{ type: String }], 
  featuredImage: { type: String },
  gallery: [productImageSchema],
  productVideos: { type: [String], default: [] },
  variants: [productVariantSchema],
  basePrice: { type: Number },
  priceRange: {
    min: { type: Number },
    max: { type: Number },
  },
  specifications: [specificationSchema],
  availableAttributes: [{
    name: { type: String, required: true },
    values: [String],
  }],
  totalStock: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'out_of_stock'],
    default: 'draft',
  },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isBestselling: { type: Boolean, default: false },
  isNewArrival: { type: Boolean, default: false },
  shippingInfo: shippingInfoSchema,
  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  ratingBreakdown: {
    five: { type: Number, default: 0 },
    four: { type: Number, default: 0 },
    three: { type: Number, default: 0 },
    two: { type: Number, default: 0 },
    one: { type: Number, default: 0 },
  },
  totalSold: { type: Number, default: 0 },
  additionalInfo: { type: String },
  deliveryInfo: { type: String },
  returnPolicy: { type: String },
  warrantyInfo: { type: String },
  seo: seoSchema,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  slug: { type: String, required: true, unique: true, index: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

productSchema.index({ category: 1 });
productSchema.index({ status: 1, isActive: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ totalSold: -1 });

productSchema.virtual('calculatedPriceRange').get(function () {
  if (this.variants && this.variants.length > 0) {
    const prices = this.variants.map(v => v.currentPrice).filter(p => p > 0);
    if (prices.length > 0) {
      return {
        min: Math.min(...prices),
        max: Math.max(...prices),
      };
    }
  }
  return this.priceRange;
});

productSchema.virtual('calculatedTotalStock').get(function () {
  if (this.variants && this.variants.length > 0) {
    return this.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);
  }
  return this.totalStock || 0;
});

productSchema.pre('save', function (next) {
  if (this.variants && this.variants.length > 0) {
    const prices = this.variants.map(v => v.currentPrice).filter(p => p > 0);
    if (prices.length > 0) {
      this.priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices),
      };
    }
    this.totalStock = this.variants.reduce((total, variant) => total + (variant.stockQuantity || 0), 0);
  }
  next();
});

productSchema.statics.findLowStock = function () {
  return this.find({
    $or: [
      { 'variants.stockQuantity': { $lte: 5 } },
      { totalStock: { $lte: 5 } },
    ],
  });
};

productSchema.methods.getVariantBySku = function (sku) {
  return this.variants.find(variant => variant.sku === sku);
};

productSchema.methods.isInStock = function (variantSku = null) {
  if (variantSku) {
    const variant = this.getVariantBySku(variantSku);
    return variant && variant.stockQuantity > 0;
  }
  return this.calculatedTotalStock > 0;
};

const Product = mongoose.model('Product', productSchema);

module.exports = { Product };
