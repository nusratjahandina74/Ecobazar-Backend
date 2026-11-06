const mongoose = require('mongoose');
const { Schema } = mongoose;

// Single document ("main") that holds every client-editable store setting.
const settingSchema = new Schema({
    key: { type: String, default: 'main', unique: true },
    store: {
        name: { type: String, default: 'EcoBazaar' },
        tagline: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        address: { type: String, default: '' },
        logo: { type: String, default: '' },
        returnPolicy: { type: String, default: '' },
        facebook: { type: String, default: '' },
        instagram: { type: String, default: '' },
        youtube: { type: String, default: '' },
        tiktok: { type: String, default: '' },
    },
    delivery: {
        insideDhakaCharge: { type: Number, default: 80, min: 0 },
        outsideDhakaCharge: { type: Number, default: 120, min: 0 },
        freeDeliveryEnabled: { type: Boolean, default: false },
        freeDeliveryThreshold: { type: Number, default: 0, min: 0 },
        freeAllEnabled: { type: Boolean, default: false },
        freeAllStartDate: { type: Date },
        freeAllEndDate: { type: Date },
        codEnabled: { type: Boolean, default: true },
        onlineEnabled: { type: Boolean, default: true },
    },
    notice: { text: { type: String, default: '' }, isActive: { type: Boolean, default: false } },
    whatsapp: { phone: { type: String, default: '' }, isActive: { type: Boolean, default: false } },
    courier: {
        defaultProvider: { type: String, enum: ['steadfast', 'pathao', 'manual'], default: 'steadfast' },
        pathaoStoreId: { type: String, default: '' },
    },
    home: {
        showCategories: { type: Boolean, default: true },
        showFeatured: { type: Boolean, default: true },
        showNewArrivals: { type: Boolean, default: true },
        showBestSellers: { type: Boolean, default: true },
        showTestimonials: { type: Boolean, default: true },
        showNewsletter: { type: Boolean, default: true },
        flash: {
            enabled: { type: Boolean, default: false },
            title: { type: String, default: 'Flash sale' },
            subtitle: { type: String, default: '' },
            endsAt: { type: Date },
            productIds: [{ type: Schema.Types.ObjectId }],
        },
        badges: [{ title: String, text: String, icon: String, _id: false }],
    },
    seo: { title: { type: String, default: '' }, description: { type: String, default: '' } },
    theme: { primary: { type: String, default: '' } },
    reviews: { enabled: { type: Boolean, default: true }, autoApprove: { type: Boolean, default: false }, requirePurchase: { type: Boolean, default: true } },
    inventory: { lowStockThreshold: { type: Number, default: 5, min: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
