const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    label: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
    isDefault: { type: Boolean, default: false },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String },
    name: { type: String },
    image: { type: String },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    subtotal: { type: Number, required: true },
}, { _id: false });

const trackingSchema = new mongoose.Schema({
    status: { type: String }, // e.g., 'shipped', 'in_transit', 'delivered'
    date: { type: Date },
    note: { type: String },
}, { _id: false });

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        default: 'pending',
    },
    paymentMethod: { type: String }, // e.g., 'cod', 'card', 'bkash', etc.
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
    },
    total: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    orderNotes: { type: String },
    tracking: [trackingSchema],
    coupon: { type: String },
    refundedAmount: { type: Number, default: 0 },
    isGift: { type: Boolean, default: false },
    giftMessage: { type: String },
    adminNotes: { type: String },
}, {
    timestamps: true,
});

orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = { Order };
