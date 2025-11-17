const multer = require("multer");
const sharp = require("sharp");

const upload = multer({ storage: multer.memoryStorage() });

const processImage = async (req, res, next) => {
  try {
    // If no files were uploaded, skip
    if (!req.files || req.files.length === 0) return next();

    // Process all files in parallel
    req.processedImages = await Promise.all(
      req.files.map(async (file) => {
        const buffer = await sharp(file.buffer)
          .resize({
            width: 800, // Increased resolution for gallery
            height: 800,
            fit: "contain",
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .toBuffer();

        return {
          buffer,
          mimetype: file.mimetype,
          originalName: file.originalname,
        };
      })
    );

    next();
  } catch (e) {
    next(e);
  }
};

module.exports = { upload, processImage };