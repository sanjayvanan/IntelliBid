const multer = require("multer");
const sharp = require("sharp");

const upload = multer({ storage: multer.memoryStorage() });

async function processImage(req, res, next) {
  try {
    if (!req.file) return next(); // image optional
    req.processedImage = await sharp(req.file.buffer)
      .resize({ width: 300, height: 300, fit: "contain", background: { r:255,g:255,b:255,alpha:0 } })
      .toBuffer();
    req.processedMime = req.file.mimetype;
    req.originalName = req.file.originalname;
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { upload, processImage };
