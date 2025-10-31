const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
    profilePic: { type: String, required: true },
    name: { type: String, required: true },
    designation: { type: String },
    rating: { type: Number, min: 1, max: 5, required: true },
    reviewText: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
}, {
    timestamps: true,
});


const Testimonial = mongoose.model('Testimonial', testimonialSchema);

module.exports = { Testimonial };