// controllers/itemsController.js

const itemService = require("../services/itemService");
const { generateItemDescription } = require("../services/aiService");
const {
  getRecommendationsForItem,
} = require("../services/recommendationService");

// ----------------------
// Generate description
// ----------------------
const generateDescription = async (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Item name is required" });
    }

    const description = await generateItemDescription(name, category);
    res.json({ description });
  } catch (error) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: "Failed to generate description" });
  }
};

// ----------------------
// Recommendations
// ----------------------
const getRecommendations = async (req, res) => {
  try {
    const { id } = req.params;

    try {
      const recommendations = await getRecommendationsForItem(id);
      return res.json(recommendations);
    } catch (innerError) {
      console.error("Recommendation Error:", innerError);

      // Fallback: no AI, just 3 candidates from same category
      const currentItem = await itemService.getItemById(id);
      if (!currentItem) {
        return res.status(404).json({ error: "Item not found" });
      }

      const fallback = await itemService.getCandidateItems(
        currentItem.category_id,
        id,
        3
      );
      return res.json(fallback);
    }
  } catch (error) {
    console.error("Recommendation Fatal Error:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
};

// ----------------------
// Get all items for logged-in seller
// ----------------------
const getMyItems = async (req, res) => {
  try {
    const sellerId = req.user._id.toString();
    const items = await itemService.getItemsBySeller(sellerId);

    res.json(items);
  } catch (error) {
    console.error("getMyItems:", error);
    res.status(400).json({ error: error.message });
  }
};

// ----------------------
// Get a single item
// ----------------------
const getItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await itemService.getItemById(id);

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(item);
  } catch (error) {
    console.error("getItem:", error);
    res.status(400).json({ error: error.message });
  }
};

// ----------------------
// Get all active items
// ----------------------
const getItems = async (_req, res) => {
  try {
    const items = await itemService.getAllActiveItems();
    res.json(items);
  } catch (error) {
    console.error("getItems:", error);
    res.status(400).json({ error: error.message });
  }
};

// ----------------------
// Create a new item
// ----------------------
const createItem = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      seller_id: req.user._id.toString(),
      processedImage: req.processedImage,
      processedMime: req.processedMime,
    };

    const newItem = await itemService.createItem(itemData);
    res.status(201).json(newItem);
  } catch (error) {
    console.error("createItem:", error);
    res.status(400).json({ error: error.message });
  }
};

// ----------------------
// Update bid
// ----------------------
const updateItem = async (req, res) => {
  try {
    const { id: itemId } = req.params;
    const { bidAmount } = req.body;
    const bidderId = req.user._id.toString();

    if (!bidAmount || !itemId) {
      return res.status(400).json({ error: "Missing Fields" });
    }

    const item = await itemService.getItemById(itemId);
    if (!item) {
      return res.status(400).json({ error: "Item not found" });
    }

    if (bidAmount < item.current_price) {
      return res
        .status(400)
        .json({ error: "Bid must be higher than the current price" });
    }

    if (item?.status !== "active") {
      return res.status(400).json({ error: "Auction is closed" });
    }

    const result = await itemService.updateItemBid(
      itemId,
      bidAmount,
      bidderId
    );

    const io = req.app.get("io");

    io.emit("bid_placed", {
      itemId: itemId,
      current_price: result.item.current_price,
      bidderId: bidderId,
    });

    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ err });
  }
};

module.exports = {
  getMyItems,
  getItem,
  getItems,
  createItem,
  updateItem,
  generateDescription,
  getRecommendations,
};
