// routes/items.js
const rateLimit = require("express-rate-limit");
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
  getCategories,
  generateAttributes  
} = require("../controllers/itemsController");

// Allow only 10 AI requests every 30 minutes per IP
const aiLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 10, // Limit to 10 requests
  message: { error: "You have used your AI quota. Please write the description manually or try again in 30 minutes." }
});


const { upload, processImage } = require("../middleware/upload");
const requireAuth = require("../middleware/requireAuth");

router.get("/myItems", requireAuth, getMyItems);
router.get("/categories", getCategories); 
router.get("/", getItems);
router.get("/won", requireAuth, getWonItems);
router.post("/generate-description", requireAuth, aiLimiter, generateDescription);
router.post("/generate-attributes", requireAuth, aiLimiter, generateAttributes);
router.post("/analyze", requireAuth, aiLimiter, analyzeListing);
router.get("/recommend/:id", requireAuth, getRecommendations);
router.get("/:id", getItem);
router.patch("/bidup/:id", requireAuth, updateItem);
// for S3 we need this middleware
// Allow up to 5 images
router.post("/", requireAuth, upload.array("images", 5), processImage, createItem);

module.exports = router;
