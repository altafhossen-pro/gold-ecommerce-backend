const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true 
    },
    email: { 
        type: String, 
        required: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phone: { 
        type: String, 
        trim: true 
    },
    subject: { 
        type: String, 
        required: true,
        trim: true 
    },
    message: { 
        type: String, 
        required: true,
        trim: true 
    },
    status: {
        type: String,
        enum: ['new', 'read', 'replied', 'archived'],
        default: 'new'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    repliedAt: {
        type: Date
    },
    adminNotes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
});

// Index for efficient queries
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ isRead: 1 });

const Contact = mongoose.model('Contact', contactSchema);

module.exports = { Contact };

