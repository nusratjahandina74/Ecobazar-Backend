const Review = require('../models/reviewModel');
const Product = require('../models/productModel');

/** Recompute a product's average rating from its approved reviews. */
const recalcRating = async (productId) => {
    const rows = await Review.find({ product: productId, status: 'approved' }).select('rating').limit(10000).lean();
    const count = rows.length;
    const avg = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    await Product.updateOne({ _id: productId }, { $set: { ratingAvg: avg, ratingCount: count } });
};
module.exports = { recalcRating };
