const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
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
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  previousUnitCost: {
    type: Number,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  previousStock: {
    type: Number,
    default: 0
  },
  newStock: {
    type: Number,
    required: true
  }
}, { _id: true });

const purchaseSchema = new mongoose.Schema({
  purchaseNumber: {
    type: String,
    unique: true,
    required: true
  },
  items: [purchaseItemSchema],
  totalQuantity: {
    type: Number,
    required: true,
    default: 0
  },
  totalCost: {
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
purchaseSchema.index({ purchaseNumber: 1 });
purchaseSchema.index({ performedBy: 1, createdAt: -1 });
purchaseSchema.index({ createdAt: -1 });

// Generate purchase number before saving
purchaseSchema.pre('save', async function(next) {
  if (!this.purchaseNumber) {
    try {
      const PurchaseModel = this.constructor;
      const count = await PurchaseModel.countDocuments();
      this.purchaseNumber = `PUR-${String(count + 1).padStart(6, '0')}`;
    } catch (error) {
      // Fallback: use timestamp if count fails
      this.purchaseNumber = `PUR-${Date.now().toString().slice(-6)}`;
    }
  }
  next();
});

// Calculate totals before saving
purchaseSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.totalQuantity = this.items.reduce((sum, item) => sum + item.quantity, 0);
    this.totalCost = this.items.reduce((sum, item) => sum + item.totalCost, 0);
  }
  next();
});

const Purchase = mongoose.model('Purchase', purchaseSchema);

module.exports = { Purchase };

