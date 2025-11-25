// controllers/itemsController.js

const itemService = require("../services/itemService");
const { generateItemDescription, embedText, generateListingAnalysis } = require("../services/aiService");
const { getRecommendationsForItem} = require("../services/recommendationService");

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
const getItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4; // Default limit 4 (or 12, whatever you set)
    const searchQuery = req.query.search;

    let items;

    if (searchQuery && searchQuery.trim().length > 0) {
      console.log(`Performing AI Search for: "${searchQuery}", Page: ${page}`);
      // PASS PAGE AND LIMIT HERE
      items = await itemService.searchItems(searchQuery, page, limit);
    } else {
      items = await itemService.getAllActiveItems(page, limit);
    }

    res.json(items);
  } catch (error) {
    console.error("getItems Error:", error);
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
      processedImages: req.processedImages, 
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
      return res.status(404).json({ error: "Item not found" });
    }

    // Security Check: Prevent seller from bidding
    if (item.seller_id === bidderId) {
      return res.status(403).json({ error: "You cannot bid on your own item" });
    }

    // Check if the auction has started
    if (new Date(item.start_time) > new Date()) {
      return res.status(400).json({ error: "Auction has not started yet" });
    }

    // Check if the user is already the highest bidder
    const lastBid = await itemService.getLastBid(itemId);
    if (lastBid && lastBid.bidder_id === bidderId) {
      return res.status(400).json({ error: "You are already the highest bidder" });
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



const getWonItems = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    // Fetch items where winner_id matches user and fetch presigned URLs
    const { rows } = await require("../db/postgres").query(
      `SELECT * FROM items WHERE winner_id = $1 ORDER BY end_time DESC`,
      [userId]
    );
    
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch won items" });
  }
};


// ----------------------
// RAG: Analyze Listing
// ----------------------
const analyzeListing = async (req, res) => {
  try {
    const { name, description, start_price } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: "Name and Description required" });
    }

    // 1. Create Vector from Draft (The "Query")
    const draftText = `${name}. ${description}`;
    const embedding = await embedText(draftText);

    // 2. Retrieve Ground Truth (The "Retrieval")
    const soldItems = await itemService.getSimilarSoldItems(embedding);

    if (soldItems.length === 0) {
      return res.json({ 
        score: 5, 
        price_analysis: "Unknown", 
        estimated_value: "N/A", 
        advice: "No similar sold items found yet. You are the first!" 
      });
    }

    // 3. Generate Insight (The "Generation")
    const analysis = await generateListingAnalysis(
      { name, description, price: start_price }, 
      soldItems
    );

    res.json(analysis);

  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze listing" });
  }
};



const getCategories = async (req, res) => {
  try {
    const categories = await itemService.getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
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
  getWonItems,
  analyzeListing,
  getCategories
};