const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    required: true, 
    index: true 
  },
  otp: { 
    type: String, 
    required: true 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: { expireAfterSeconds: 0 } // Auto-delete after expiry
  },
  isUsed: { 
    type: Boolean, 
    default: false 
  },
  attempts: { 
    type: Number, 
    default: 0 
  },
  maxAttempts: { 
    type: Number, 
    default: 3 
  },
  type: {
    type: String,
    enum: ['login', 'registration', 'password_reset'],
    default: 'login'
  }
}, {
  timestamps: true
});

// Index for efficient queries
otpSchema.index({ phone: 1, isUsed: 1 });
otpSchema.index({ expiresAt: 1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = { OTP };
