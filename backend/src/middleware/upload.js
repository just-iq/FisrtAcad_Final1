const multer = require("multer");

// Memory storage keeps API stateless; files are immediately pushed to S3.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB default; tune as needed
});

module.exports = { upload };

