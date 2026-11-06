// Dummy courier used when real credentials are not configured (development / demo).
module.exports = {
    isConfigured: () => true,
    createParcel: async (order) => {
        const id = `MOCK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
        return { provider: 'mock', consignmentId: id, trackingCode: id, status: 'in_review', raw: { mock: true, orderNumber: order.orderNumber } };
    },
};
