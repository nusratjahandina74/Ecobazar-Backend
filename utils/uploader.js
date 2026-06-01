const multer = require('multer');
const path = require('path');

const createUploader = (folderName) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, `../uploads/${folderName}`);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  });

  return multer({ storage: storage });
};

module.exports = createUploader;