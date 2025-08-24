const mongoose = require('mongoose');

const loyaltyHistorySchema = new mongoose.Schema({
  type: { type: String, enum: ['earn', 'redeem', 'adjust'], required: true },
  points: { type: Number, required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  description: { type: String },
  date: { type: Date, default: Date.now },
}, { _id: false });

const loyaltySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  points: { type: Number, default: 0 },
  history: [loyaltyHistorySchema],
}, { timestamps: true });

const Loyalty = mongoose.model('Loyalty', loyaltySchema);
module.exports = { Loyalty };
