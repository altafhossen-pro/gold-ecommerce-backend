const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    url: { type: String },
    icon: { type: String },
    order: { type: Number, default: 0 },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu', default: null },
    isActive: { type: Boolean, default: true },
    position: {
        type: String,
        enum: ['header', 'footer'],
        default: 'header',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Virtual for children menus
menuSchema.virtual('children', {
    ref: 'Menu',
    localField: '_id',
    foreignField: 'parent',
    justOne: false,
});

// Index for ordering and slug
menuSchema.index({ order: 1 });
menuSchema.index({ slug: 1 });

const Menu = mongoose.model('Menu', menuSchema);

module.exports = { Menu };
