// routes/items.js
const express = require("express");
const router = express.Router();

const {
  getMyItems,
  getItem,
  getItems,
  createItem,
  updateItem,
  generateDescription,
  getRecommendations,
} = require("../controllers/itemsController");

const { upload, processImage } = require("../middleware/upload");
const requireAuth = require("../middleware/requireAuth");

router.get("/myItems", requireAuth, getMyItems);
router.get("/", getItems);
router.post("/generate-description", requireAuth, generateDescription);
router.get("/recommend/:id", requireAuth, getRecommendations);
router.get("/:id", getItem);
router.patch("/bidup/:id", requireAuth, updateItem);

// for S3 we need this middleware
// Allow up to 5 images
router.post("/", requireAuth, upload.array("images", 5), processImage, createItem);

module.exports = router;
