const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    label: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
    isDefault: { type: Boolean, default: false },
    // Address IDs for structured address handling
    divisionId: { type: String },
    districtId: { type: String },
    upazilaId: { type: String },
    areaId: { type: String },
    // Address names for display
    division: { type: String },
    district: { type: String },
    upazila: { type: String },
    area: { type: String }
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String },
    name: { type: String },
    image: { type: String },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    // Add variant information for admin
    variant: {
        size: { type: String },
        color: { type: String },
        colorHexCode: { type: String },
        sku: { type: String },
        stockQuantity: { type: Number },
        stockStatus: { type: String }
    }
}, { _id: false });

const trackingSchema = new mongoose.Schema({
    status: { type: String }, // e.g., 'shipped', 'in_transit', 'delivered'
    date: { type: Date },
    note: { type: String },
}, { _id: false });

const orderUpdateHistorySchema = new mongoose.Schema({
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updateType: { type: String, required: true }, // 'status_change', 'item_update', 'address_change', 'price_change', etc.
    
    // All changes stored in this array (single or multiple)
    changes: [{
        field: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
        updateType: { type: String }
    }],
    
    reason: { type: String }, // Reason for update
    timestamp: { type: Date, default: Date.now },
    notes: { type: String } // Additional notes about the update
}, { _id: true });

const orderSchema = new mongoose.Schema({
    orderId: { type: String, unique: true, index: true }, 
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Made optional for guest orders
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
    upsellDiscount: { type: Number, default: 0 },
    loyaltyDiscount: { type: Number, default: 0 },
    loyaltyPointsUsed: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    orderNotes: { type: String },
    tracking: [trackingSchema],
    // Status timestamps for tracking
    statusTimestamps: {
        pending: { type: Date, default: Date.now },
        confirmed: { type: Date },
        processing: { type: Date },
        shipped: { type: Date },
        delivered: { type: Date },
        cancelled: { type: Date },
        returned: { type: Date }
    },
    coupon: { type: String },
    couponDiscount: { type: Number, default: 0 },
    refundedAmount: { type: Number, default: 0 },
    isGift: { type: Boolean, default: false },
    giftMessage: { type: String },
    adminNotes: { type: String },
    orderType: {
        type: String,
        enum: ['auto', 'manual'],
        default: 'auto'
    },
    orderSource: {
        type: String,
        enum: ['website', 'facebook', 'whatsapp', 'phone', 'email', 'walk-in', 'instagram', 'manual', 'other'],
        default: 'website'
    },
    isGuestOrder: { type: Boolean, default: false }, // To distinguish guest orders
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For manual orders
    // Guest order customer information (for checkout guest orders)
    guestInfo: {
        name: { type: String },
        phone: { type: String, index: true }, // Index for faster search
        address: { type: String },
        email: { type: String }
    },
    // Manual order customer information (for easy search by phone)
    manualOrderInfo: {
        name: { type: String },
        phone: { type: String, index: true }, // Index for faster search
        address: { type: String },
        email: { type: String }
    },
    // Return quantities for partial returns
    returnQuantities: [{
        itemIndex: { type: Number, required: true },
        quantity: { type: Number, required: true },
        returnedAt: { type: Date, default: Date.now }
    }],
    updateHistory: [orderUpdateHistorySchema], // Track all order updates
    isDeleted: { type: Boolean, default: false }, // Soft delete flag
    deletedAt: { type: Date }, // When the order was deleted
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who deleted the order
}, {
    timestamps: true,
});

orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ isGuestOrder: 1 });
orderSchema.index({ isDeleted: 1 });

// Function to generate 6-digit order ID
const generateOrderId = async () => {
    let orderId;
    let isUnique = false;
    
    while (!isUnique) {
        // Generate 6-digit number
        orderId = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Check if it already exists
        const existingOrder = await mongoose.model('Order').findOne({ orderId });
        if (!existingOrder) {
            isUnique = true;
        }
    }
    
    return orderId;
};

// Pre-save middleware to generate orderId
orderSchema.pre('save', async function(next) {
    // Always generate orderId if it doesn't exist
    if (!this.orderId) {
        this.orderId = await generateOrderId();
    }
    next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = { Order, generateOrderId };
