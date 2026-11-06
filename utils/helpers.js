const mongoose = require('mongoose');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isId = (v) => mongoose.Types.ObjectId.isValid(String(v)) && String(v).length === 24;

const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    return { page, limit, skip: (page - 1) * limit };
};
const pageMeta = (total, page, limit) => ({ total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), hasNext: page * limit < total });

const num = (v, fallback) => {
    if (v === undefined || v === null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};
const bool = (v) => v === true || v === 'true' || v === '1' || v === 1 || v === 'on';

// Bangladesh is UTC+6 all year (no DST). All "today / this month" boundaries use it.
const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
const bdStartOfDay = (d = new Date()) => {
    const shifted = new Date(d.getTime() + BD_OFFSET_MS);
    shifted.setUTCHours(0, 0, 0, 0);
    return new Date(shifted.getTime() - BD_OFFSET_MS);
};
const bdStartOfMonth = (d = new Date()) => {
    const shifted = new Date(d.getTime() + BD_OFFSET_MS);
    shifted.setUTCDate(1); shifted.setUTCHours(0, 0, 0, 0);
    return new Date(shifted.getTime() - BD_OFFSET_MS);
};
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const bdDateKey = (d) => new Date(d.getTime() + BD_OFFSET_MS).toISOString().slice(0, 10);

// tiny TTL memo-cache (per process)
const caches = new Map();
const memo = async (key, ttlMs, fn) => {
    const hit = caches.get(key);
    if (hit && hit.exp > Date.now()) return hit.val;
    const val = await fn();
    caches.set(key, { val, exp: Date.now() + ttlMs });
    return val;
};
const memoClear = (prefix = '') => { for (const k of caches.keys()) if (k.startsWith(prefix)) caches.delete(k); };

module.exports = { escapeRegex, isId, parsePagination, pageMeta, num, bool, bdStartOfDay, bdStartOfMonth, addDays, bdDateKey, BD_OFFSET_MS, memo, memoClear };
