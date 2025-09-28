const mongoose = require('mongoose');

const upsellSchema = new mongoose.Schema({
  mainProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  linkedProducts: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    order: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
upsellSchema.index({ mainProduct: 1, isActive: 1 });
upsellSchema.index({ 'linkedProducts.product': 1 });
upsellSchema.index({ createdAt: -1 });

// Virtual to get active linked products count
upsellSchema.virtual('activeLinkedProductsCount').get(function() {
  return this.linkedProducts.filter(link => link.isActive).length;
});

// Virtual to get total linked products count
upsellSchema.virtual('totalLinkedProductsCount').get(function() {
  return this.linkedProducts.length;
});

// Method to add a linked product
upsellSchema.methods.addLinkedProduct = function(productId, order = 0) {
  // Check if product is already linked
  const existingLink = this.linkedProducts.find(link => 
    link.product.toString() === productId.toString()
  );
  
  if (existingLink) {
    throw new Error('Product is already linked to this main product');
  }
  
  // Add new linked product
  this.linkedProducts.push({
    product: productId,
    order: order,
    isActive: true,
    addedAt: new Date()
  });
  
  return this.save();
};

// Method to remove a linked product
upsellSchema.methods.removeLinkedProduct = function(productId) {
  this.linkedProducts = this.linkedProducts.filter(link => 
    link.product.toString() !== productId.toString()
  );
  
  return this.save();
};

// Method to update linked product order
upsellSchema.methods.updateLinkedProductOrder = function(productId, newOrder) {
  const link = this.linkedProducts.find(link => 
    link.product.toString() === productId.toString()
  );
  
  if (link) {
    link.order = newOrder;
    return this.save();
  }
  
  throw new Error('Linked product not found');
};

// Method to toggle linked product active status
upsellSchema.methods.toggleLinkedProductStatus = function(productId) {
  const link = this.linkedProducts.find(link => 
    link.product.toString() === productId.toString()
  );
  
  if (link) {
    link.isActive = !link.isActive;
    return this.save();
  }
  
  throw new Error('Linked product not found');
};

// Static method to find upsells by main product
upsellSchema.statics.findByMainProduct = function(productId) {
  return this.findOne({ mainProduct: productId, isActive: true })
    .populate('mainProduct', 'title slug featuredImage priceRange')
    .populate('linkedProducts.product', 'title slug featuredImage priceRange status isActive');
};

// Static method to find upsells by linked product
upsellSchema.statics.findByLinkedProduct = function(productId) {
  return this.find({ 
    'linkedProducts.product': productId,
    isActive: true 
  })
    .populate('mainProduct', 'title slug featuredImage priceRange')
    .populate('linkedProducts.product', 'title slug featuredImage priceRange status isActive');
};

// Static method to get all active upsells with pagination
upsellSchema.statics.getActiveUpsells = function(page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  return this.find({ isActive: true })
    .populate('mainProduct', 'title slug featuredImage priceRange status isActive')
    .populate('linkedProducts.product', 'title slug featuredImage priceRange status isActive')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

const Upsell = mongoose.model('Upsell', upsellSchema);

module.exports = { Upsell };
