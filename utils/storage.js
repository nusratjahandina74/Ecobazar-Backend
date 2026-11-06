const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/*
 * Image storage.
 *  - CLOUDINARY_URL set  -> files are kept in memory and uploaded to Cloudinary (PERMANENT, recommended on Render)
 *  - otherwise           -> files are written to ./uploads (Render's disk is wiped on every deploy/restart!)
 * Either way, after `persistUploads` every req.files[i].url is the URL to store in MongoDB.
 */
const isCloud = () => !!process.env.CLOUDINARY_URL;
let cloudinary = null;
const cloud = () => {
    if (!cloudinary) { cloudinary = require('cloudinary').v2; cloudinary.config({ secure: true }); }
    return cloudinary;
};

const ALLOWED = /^image\/(jpeg|png|webp|gif)$/;
const ROOT = path.join(__dirname, '..', 'uploads');

const createUploader = (folder, { maxFiles = 5 } = {}) => {
    const dir = path.join(ROOT, folder);
    let storage;
    if (isCloud()) {
        storage = multer.memoryStorage();
    } else {
        fs.mkdirSync(dir, { recursive: true });
        storage = multer.diskStorage({
            destination: (req, file, cb) => cb(null, dir),
            filename: (req, file, cb) => {
                const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
                cb(null, `${Date.now()}-${crypto.randomInt(1e9)}-${safe}`);
            },
        });
    }
    return multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024, files: maxFiles },
        fileFilter: (req, file, cb) => (ALLOWED.test(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed'))),
    });
};

const uploadBuffer = (buffer, folder) => new Promise((resolve, reject) => {
    const stream = cloud().uploader.upload_stream(
        { folder: `ecobazar/${folder}`, resource_type: 'image', transformation: [{ width: 1600, height: 1600, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }] },
        (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
});

// Express middleware: normalises req.files / req.file so controllers only look at `.url`
const persistUploads = (folder) => async (req, res, next) => {
    try {
        const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : (req.file ? [req.file] : []);
        if (isCloud()) {
            const results = await Promise.all(files.map((f) => uploadBuffer(f.buffer, folder)));
            files.forEach((f, i) => { f.url = results[i].secure_url; f.buffer = undefined; });
        } else {
            files.forEach((f) => { f.url = `/uploads/${folder}/${f.filename}`; });
        }
        next();
    } catch (e) {
        next(Object.assign(new Error(`Image upload failed: ${e.message}`), { status: 502 }));
    }
};

const removeImage = (url) => {
    try {
        if (!url) return;
        if (/res\.cloudinary\.com/i.test(url)) {
            const m = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url);
            if (m && isCloud()) cloud().uploader.destroy(m[1]).catch((e) => console.error('[cloudinary] delete failed', e.message));
            return;
        }
        if (/^https?:/i.test(url)) return;
        const rel = String(url).replace(/^\/+/, '').replace(/^uploads\//, '');
        const full = path.resolve(ROOT, rel);
        if (!full.startsWith(ROOT + path.sep)) return;
        fs.unlink(full, (err) => { if (err && err.code !== 'ENOENT') console.error('[uploads] delete failed', err.message); });
    } catch (e) { console.error('[uploads] cleanup error', e.message); }
};
const removeImages = (list = []) => list.forEach((i) => removeImage(typeof i === 'string' ? i : i && i.url));
const removeRequestFiles = (req) => {
    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : (req.file ? [req.file] : []);
    files.forEach((f) => f.url && removeImage(f.url));
};

module.exports = { createUploader, persistUploads, removeImage, removeImages, removeRequestFiles, isCloud };
