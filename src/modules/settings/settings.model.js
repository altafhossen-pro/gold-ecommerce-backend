const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Loyalty Points Settings
  coinPerItem: { 
    type: Number, 
    default: 1,
    min: 0,
    max: 100
  },
  coinValue: { 
    type: Number, 
    default: 1, // 1 coin = 1 ৳
    min: 0.1,
    max: 100
  },
  isLoyaltyEnabled: { 
    type: Boolean, 
    default: true 
  },
  
  // Coin Earning Rules
  earnOnDelivery: { 
    type: Boolean, 
    default: true // Earn coins when order is delivered (COD)
  },
  earnOnPaymentSuccess: { 
    type: Boolean, 
    default: true // Earn coins when payment is successful
  },
  
  // Minimum Settings (no maximum limit - user can pay entire order)
  minRedeemAmount: { 
    type: Number, 
    default: 1 // Minimum ৳1 to redeem
  },
  
  // General Settings
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // Admin who last updated
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, {
  timestamps: true,
});

// Ensure only one settings document exists
settingsSchema.index({}, { unique: true });

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
