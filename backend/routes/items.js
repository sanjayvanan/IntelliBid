const express = require("express");
const router = express.Router();

const { getItem, getItems, createItem } = require("../controllers/itemsController");
const { upload, processImage } = require("../middleware/upload"); // <- multer + sharp
const requireAuth = require("../middleware/requireAuth");

router.get("/", getItems);
router.get("/:id", getItem);

//for S3 we need this middleware
router.post("/", requireAuth, upload.single("image"), processImage, createItem);

module.exports = router;
