const fs = require('fs');
const path = require('path');
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');
const removeStoredImage = (url) => {
    try {
        if (!url || /^https?:/i.test(url)) return;
        const rel = String(url).replace(/^\/+/, '').replace(/^uploads\//, '');
        const full = path.resolve(UPLOADS_ROOT, rel);
        if (!full.startsWith(UPLOADS_ROOT + path.sep)) return; 
        fs.unlink(full, (err) => {
            if (err && err.code !== 'ENOENT') console.error('[uploads] could not delete', full, err.message);
        });
    } catch (e) {
        console.error('[uploads] cleanup error', e.message);
    }
};

const removeStoredImages = (images = []) => images.forEach((i) => removeStoredImage(i && i.url));
const removeRequestFiles = (req) => (req.files || []).forEach((f) => f.path && fs.unlink(f.path, () => {}));

module.exports = { removeStoredImage, removeStoredImages, removeRequestFiles };
