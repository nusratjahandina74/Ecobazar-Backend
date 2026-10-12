const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

// Delete one stored image file. Accepts the url saved in the DB ("/uploads/products/<file>",
// or legacy "uploads/<file>"). Never leaves the uploads folder; a missing file is not an error.
const removeStoredImage = (url) => {
    try {
        if (!url || /^https?:/i.test(url)) return;
        const rel = String(url).replace(/^\/+/, '').replace(/^uploads\//, '');
        const full = path.resolve(UPLOADS_ROOT, rel);
        if (!full.startsWith(UPLOADS_ROOT + path.sep)) return; // path-traversal guard
        fs.unlink(full, (err) => {
            if (err && err.code !== 'ENOENT') console.error('[uploads] could not delete', full, err.message);
        });
    } catch (e) {
        console.error('[uploads] cleanup error', e.message);
    }
};

const removeStoredImages = (images = []) => images.forEach((i) => removeStoredImage(i && i.url));

// Files multer already saved for THIS request (used when the request is rejected afterwards).
const removeRequestFiles = (req) => (req.files || []).forEach((f) => f.path && fs.unlink(f.path, () => {}));

module.exports = { removeStoredImage, removeStoredImages, removeRequestFiles };
