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
  getWonItems,
  analyzeListing,
  getCategories
} = require("../controllers/itemsController");


const { upload, processImage } = require("../middleware/upload");
const requireAuth = require("../middleware/requireAuth");

router.get("/myItems", requireAuth, getMyItems);
router.get("/categories", getCategories); 
router.get("/", getItems);
router.get("/won", requireAuth, getWonItems);
router.post("/generate-description", requireAuth, generateDescription);
router.post("/analyze", requireAuth, analyzeListing);
router.get("/recommend/:id", requireAuth, getRecommendations);
router.get("/:id", getItem);
router.patch("/bidup/:id", requireAuth, updateItem);
// for S3 we need this middleware
// Allow up to 5 images
router.post("/", requireAuth, upload.array("images", 5), processImage, createItem);

module.exports = router;
