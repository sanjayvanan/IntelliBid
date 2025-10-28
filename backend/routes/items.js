const express = require("express");
const router = express.Router();

const { getMyItems, getItem, getItems, createItem, updateItem } = require("../controllers/itemsController");
const { upload, processImage } = require("../middleware/upload"); // <- multer + sharp
const requireAuth = require("../middleware/requireAuth");

router.get("/myItems", requireAuth, getMyItems);
router.get("/", getItems);
router.get("/:id", getItem);
router.patch('/bidup/:id', requireAuth, updateItem);

//for S3 we need this middleware
router.post("/", requireAuth, upload.single("image"), processImage, createItem);

module.exports = router;
