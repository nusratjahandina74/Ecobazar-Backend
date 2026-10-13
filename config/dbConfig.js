const mongoose = require('mongoose');

const connect = async () => mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 10000 });

const syncIndexes = async () => {
    for (const name of ['User', 'Product', 'Cart', 'Order', 'Wishlist']) {
        try { await mongoose.model(name).syncIndexes(); }
        catch (e) { console.error(`[db] syncIndexes(${name}) skipped:`, e.message); }
    }
};

const dbConfig = async () => {
    if (!process.env.MONGODB_URL) {
        console.error('[db] MONGODB_URL is missing in .env - the API cannot work without it.');
        return;
    }
    try {
        await connect();
    } catch (error) {
        if (/querySrv|ECONNREFUSED|ENOTFOUND/i.test(error.message)) {
            try {
                require('node:dns').setServers(['1.1.1.1', '8.8.8.8']);
                console.log('[db] SRV lookup failed, retrying with public DNS (1.1.1.1, 8.8.8.8)...');
                await connect();
            } catch (e2) {
                console.error(`Database Connection Error: ${e2.message}`);
                return;
            }
        } else {
            console.error(`Database Connection Error: ${error.message}`);
            return;
        }
    }
    console.log('Database Connected');
    syncIndexes();
};

module.exports = dbConfig;
