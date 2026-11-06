const Page = require('../models/pageModel');
const { getSettings } = require('./settingsService');

const defaults = (name) => [
    { slug: 'about-us', title: 'About us', order: 1, content: `<h2>Welcome to ${name}</h2><p>We are a Bangladeshi online shop focused on fresh, honest products delivered to your door. Tell your customers who you are, what you sell and why they can trust you. You can edit this page from the dashboard (Pages).</p>` },
    { slug: 'privacy-policy', title: 'Privacy policy', order: 2, content: `<h2>Privacy policy</h2><p>${name} collects only the information needed to process your orders: name, phone number, email and delivery address. We never sell your data. Payments by card or mobile banking are handled by our payment partner. Edit this text from the dashboard.</p>` },
    { slug: 'terms-and-conditions', title: 'Terms & conditions', order: 3, content: `<h2>Terms &amp; conditions</h2><p>By placing an order with ${name} you agree to provide correct delivery details and to be reachable by phone for delivery. Prices and stock may change without notice. Edit this text from the dashboard.</p>` },
    { slug: 'return-policy', title: 'Return & refund policy', order: 4, content: `<h2>Return &amp; refund policy</h2><p>If you receive a damaged or wrong item, contact us within 24 hours of delivery with a photo. We will replace the item or refund you. Edit this text from the dashboard.</p>` },
    { slug: 'faq', title: 'FAQ', order: 5, content: `<h2>Frequently asked questions</h2><h3>How long does delivery take?</h3><p>Inside Dhaka usually 1-2 days, outside Dhaka 3-5 days.</p><h3>Can I pay cash on delivery?</h3><p>Yes, cash on delivery is available.</p><h3>How can I track my order?</h3><p>Use the Track order page with your order number and phone number.</p>` },
];

/** First run: give a new shop ready-made pages so the footer is never empty. */
const ensureDefaultPages = async () => {
    if (await Page.estimatedDocumentCount() > 0) return;
    const s = await getSettings();
    try { await Page.insertMany(defaults((s.store && s.store.name) || 'our shop')); } catch (e) { if (e.code !== 11000) throw e; }
};
module.exports = { ensureDefaultPages };
