const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createUploader = (folderName) => {
  // Absolute path (independent of the directory the server is started from)
  const dir = path.join(__dirname, '..', 'uploads', folderName);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${unique}-${safe}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => {
      if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
      cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed'));
    },
  });
};

module.exports = createUploader;
