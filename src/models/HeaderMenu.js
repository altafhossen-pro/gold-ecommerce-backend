const mongoose = require('mongoose');

const headerMenuSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  url: { type: String },
  icon: { type: String },
  order: { type: Number, default: 0 },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'HeaderMenu', default: null },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

headerMenuSchema.virtual('children', {
  ref: 'HeaderMenu',
  localField: '_id',
  foreignField: 'parent',
  justOne: false,
});

headerMenuSchema.index({ order: 1 });
headerMenuSchema.index({ slug: 1 });

const HeaderMenu = mongoose.model('HeaderMenu', headerMenuSchema);

module.exports = { HeaderMenu };
