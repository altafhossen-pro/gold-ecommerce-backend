const mongoose = require('mongoose');

const stockTrackingSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  variant: {
    sku: { type: String },
    attributes: [{
      name: { type: String },
      value: { type: String },
      displayValue: { type: String }
    }]
  },
  type: {
    type: String,
    enum: ['add', 'remove'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    maxlength: 500
  },
  reference: {
    type: String, // Order ID, PO number, etc.
    maxlength: 100
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cost: {
    type: Number,
    min: 0
  },
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Indexes for better performance
stockTrackingSchema.index({ product: 1, createdAt: -1 });
stockTrackingSchema.index({ type: 1, createdAt: -1 });
stockTrackingSchema.index({ performedBy: 1, createdAt: -1 });
stockTrackingSchema.index({ 'variant.sku': 1, createdAt: -1 });

// Virtual for formatted date
stockTrackingSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static method to get stock history for a product
stockTrackingSchema.statics.getProductStockHistory = function(productId, variantSku = null, limit = 50) {
  const query = { product: productId };
  if (variantSku) {
    query['variant.sku'] = variantSku;
  }
  
  return this.find(query)
    .populate('performedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get stock summary for a product
stockTrackingSchema.statics.getProductStockSummary = function(productId, variantSku = null, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const query = { 
    product: productId,
    createdAt: { $gte: startDate }
  };
  if (variantSku) {
    query['variant.sku'] = variantSku;
  }
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$type',
        totalQuantity: { $sum: '$quantity' },
        count: { $sum: 1 }
      }
    }
  ]);
};

const StockTracking = mongoose.model('StockTracking', stockTrackingSchema);

module.exports = { StockTracking };
