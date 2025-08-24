const mongoose = require('mongoose');

// Social Link Schema
const socialLinkSchema = new mongoose.Schema({
  label: { type: String, required: true },
  url: { type: String, required: true },
  icon: { type: String },
}, { _id: false });

// Quick Link & Utility Link Schema
const linkSchema = new mongoose.Schema({
  label: { type: String, required: true },
  url: { type: String, required: true },
  order: { type: Number, default: 0 },
}, { _id: false });

// Contact Item Schema
const contactItemSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
  url: { type: String },
}, { _id: false });

const footerMenuSchema = new mongoose.Schema({
  info: {
    logo: { type: String },
    description: { type: String },
    socialLinks: [socialLinkSchema],
  },
  quickLinks: [linkSchema],
  utilityLinks: [linkSchema],
  contact: {
    title: { type: String, required: true },
    contactItems: [contactItemSchema],
  },
}, {
  timestamps: true,
});

const FooterMenu = mongoose.model('FooterMenu', footerMenuSchema);

module.exports = { FooterMenu };
