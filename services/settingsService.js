const Setting = require('../models/settingModel');
const { memo, memoClear } = require('../utils/helpers');

const DEFAULT_BADGES = [
    { icon: 'truck', title: 'Fast delivery', text: 'Across Bangladesh' },
    { icon: 'shield', title: 'Secure payment', text: 'Cash on delivery or online' },
    { icon: 'refresh', title: 'Easy returns', text: 'Hassle-free return policy' },
    { icon: 'headset', title: 'Real support', text: 'We reply on WhatsApp' },
];
// Older databases were created before some sections existed - fill the gaps so every reader can rely on them.
const withDefaults = (doc) => {
    const home = doc.home || {};
    return {
        ...doc,
        home: {
            showCategories: true, showFeatured: true, showNewArrivals: true, showBestSellers: true, showTestimonials: true, showNewsletter: true,
            ...home,
            flash: { enabled: false, title: 'Flash sale', subtitle: '', productIds: [], ...(home.flash || {}) },
            badges: home.badges && home.badges.length ? home.badges : DEFAULT_BADGES,
        },
        seo: { title: '', description: '', ...(doc.seo || {}) },
        theme: { primary: '', ...(doc.theme || {}) },
        reviews: { enabled: true, autoApprove: false, requirePurchase: true, ...(doc.reviews || {}) },
        store: { youtube: '', tiktok: '', ...doc.store },
    };
};
const getSettings = () => memo('settings', 30000, async () => {
    const doc = await Setting.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }).lean();
    return withDefaults(doc);
});
const invalidateSettings = () => memoClear('settings');

const isFreeAllActive = (d, now = new Date()) =>
    !!d.freeAllEnabled && (!d.freeAllStartDate || now >= new Date(d.freeAllStartDate)) && (!d.freeAllEndDate || now <= new Date(d.freeAllEndDate));

// Authoritative delivery charge. inside Dhaka = 80, outside Dhaka = 120 by default (editable in the dashboard).
const computeDelivery = (settings, zone, subtotal) => {
    const d = (settings && settings.delivery) || {};
    const z = zone === 'outside_dhaka' ? 'outside_dhaka' : 'inside_dhaka';
    const base = z === 'outside_dhaka' ? Number(d.outsideDhakaCharge ?? 120) : Number(d.insideDhakaCharge ?? 80);
    let charge = base; let reason = null;
    if (isFreeAllActive(d)) { charge = 0; reason = 'free_all'; }
    else if (d.freeDeliveryEnabled && Number(d.freeDeliveryThreshold) > 0 && subtotal >= Number(d.freeDeliveryThreshold)) { charge = 0; reason = 'free_threshold'; }
    return { zone: z, charge, baseCharge: base, freeReason: reason };
};

const publicSettings = (s) => ({
    store: s.store, notice: s.notice, whatsapp: s.whatsapp,
    home: { ...s.home, flash: { ...(s.home && s.home.flash), productIds: ((s.home && s.home.flash && s.home.flash.productIds) || []).map(String) } },
    seo: s.seo, theme: s.theme, reviews: s.reviews,
    delivery: {
        insideDhakaCharge: s.delivery.insideDhakaCharge, outsideDhakaCharge: s.delivery.outsideDhakaCharge,
        freeDeliveryEnabled: s.delivery.freeDeliveryEnabled, freeDeliveryThreshold: s.delivery.freeDeliveryThreshold,
        freeAllActive: isFreeAllActive(s.delivery), codEnabled: s.delivery.codEnabled, onlineEnabled: s.delivery.onlineEnabled,
    },
});

module.exports = { withDefaults, getSettings, invalidateSettings, computeDelivery, publicSettings, isFreeAllActive };
