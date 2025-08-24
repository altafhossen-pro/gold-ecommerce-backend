const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  label: { type: String }, // e.g., Home, Work
  street: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },
  country: { type: String },
  isDefault: { type: Boolean, default: false },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String },
  addresses: [addressSchema],
  role: {
    type: String,
    enum: ['customer', 'admin', 'seller'],
    default: 'customer',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active',
  },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  lastLogin: { type: Date },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  cart: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variantSku: { type: String },
    quantity: { type: Number, default: 1 },
  }],
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  loyaltyPoints: { type: Number, default: 0 },
}, {
  timestamps: true,
});

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ status: 1 });

const User = mongoose.model('User', userSchema);

module.exports = { User };
