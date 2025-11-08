const mongoose = require('mongoose');

const stockAdjustmentItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    sku: { type: String },
    attributes: [{
      name: { type: String },
      value: { type: String },
      displayValue: { type: String }
    }]
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  previousStock: {
    type: Number,
    default: 0
  },
  newStock: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'damaged',
      'expired',
      'lost',
      'theft',
      'returned',
      'defective',
      'waste',
      'other'
    ]
  },
  notes: {
    type: String,
    maxlength: 500
  }
}, { _id: true });

const stockAdjustmentSchema = new mongoose.Schema({
  adjustmentNumber: {
    type: String,
    unique: true,
    required: true
  },
  items: [stockAdjustmentItemSchema],
  totalQuantity: {
    type: Number,
    required: true,
    default: 0
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Indexes
stockAdjustmentSchema.index({ adjustmentNumber: 1 });
stockAdjustmentSchema.index({ performedBy: 1, createdAt: -1 });
stockAdjustmentSchema.index({ createdAt: -1 });

// Generate adjustment number before saving
stockAdjustmentSchema.pre('save', async function(next) {
  if (!this.adjustmentNumber) {
    try {
      const StockAdjustmentModel = this.constructor;
      const count = await StockAdjustmentModel.countDocuments();
      this.adjustmentNumber = `ADJ-${String(count + 1).padStart(6, '0')}`;
    } catch (error) {
      // Fallback: use timestamp if count fails
      this.adjustmentNumber = `ADJ-${Date.now().toString().slice(-6)}`;
    }
  }
  next();
});

// Calculate totals before saving
stockAdjustmentSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.totalQuantity = this.items.reduce((sum, item) => sum + item.quantity, 0);
  }
  next();
});

const StockAdjustment = mongoose.model('StockAdjustment', stockAdjustmentSchema);

module.exports = { StockAdjustment };

