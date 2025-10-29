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
  phone: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true },
  avatar: { type: String },
  address: { type: String },
  addresses: [addressSchema],
  role: {
    type: String,
    enum: ['customer', 'admin', 'seller'],
    default: 'customer',
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned', 'deleted'],
    default: 'active',
    index: true,
  },
  deletedAt: { type: Date },
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

const User = mongoose.model('User', userSchema);

module.exports = { User };
