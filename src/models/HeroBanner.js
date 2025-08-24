const mongoose = require('mongoose');

const buttonSchema = new mongoose.Schema({
    label: { type: String, required: true },
    url: { type: String, required: true },
    style: { type: String }, // e.g., 'primary', 'secondary' (optional, for frontend styling)
}, { _id: false });

const heroBannerSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    image: { type: String, required: true },
    buttons: {
        type: [buttonSchema],
        validate: [arr => arr.length <= 2, 'Maximum 2 buttons allowed'],
        default: [],
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});

const HeroBanner = mongoose.model('HeroBanner', heroBannerSchema);

module.exports = { HeroBanner };
