// Usage:  node scripts/create-admin.js you@example.com 'StrongPassword' [admin|manager|staff]
// Creates the account (or promotes an existing one) so you can sign in to the admin dashboard.
require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../models/userModel');

(async () => {
    const [email, password, role = 'admin'] = process.argv.slice(2);
    if (!email || !['admin', 'manager', 'staff'].includes(role)) { console.log("Usage: node scripts/create-admin.js <email> <password> [admin|manager|staff]"); process.exit(1); }
    await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 10000 });
    const e = email.toLowerCase().trim();
    let u = await User.findOne({ email: e }).select('+password');
    if (u) { u.role = role; u.isVerified = true; u.isHold = false; if (password) u.password = await bcrypt.hash(password, 10); await u.save(); console.log(`Updated ${e} -> ${role}`); }
    else {
        if (!password || password.length < 8) { console.log('Password (min 8 chars) is required for a new account'); process.exit(1); }
        await User.create({ email: e, password: await bcrypt.hash(password, 10), role, terms: true, isVerified: true, firstName: 'Admin' });
        console.log(`Created ${role} ${e}`);
    }
    await mongoose.disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });
