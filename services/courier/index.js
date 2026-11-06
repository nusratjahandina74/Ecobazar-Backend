const steadfast = require('./steadfast');
const pathao = require('./pathao');
const mock = require('./mock');

const PROVIDERS = { steadfast, pathao, manual: mock };

const configured = (name) => (PROVIDERS[name] && PROVIDERS[name].isConfigured ? PROVIDERS[name].isConfigured() : false);

/**
 * Book a parcel. If the provider's API credentials are not in .env the call is served by a
 * clearly-labelled MOCK (provider "mock") so the whole admin flow can be tested end-to-end.
 * Returns { provider, consignmentId, trackingCode, status, raw }
 */
const createParcel = async (providerName, order, settings) => {
    const name = PROVIDERS[providerName] ? providerName : 'steadfast';
    if (!configured(name)) return mock.createParcel(order);
    const result = await PROVIDERS[name].createParcel(order, settings);
    return { provider: name, ...result };
};

const syncStatus = async (order) => {
    const p = order.courier && order.courier.provider;
    if (p === 'steadfast' && configured('steadfast')) return steadfast.getStatus(order.courier.consignmentId);
    if (p === 'pathao' && configured('pathao')) return pathao.getStatus(order.courier.consignmentId);
    return { status: order.courier && order.courier.status ? order.courier.status : 'unknown' };
};

const status = () => ({ steadfast: configured('steadfast'), pathao: configured('pathao') });

module.exports = { createParcel, syncStatus, status };
