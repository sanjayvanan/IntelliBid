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
// Handles placing or updating a bid on an item (with proxy bidding support)
const updateItem = async (req, res) => {
  const BID_INCREMENT = 1.00; // Smallest amount needed to outbid someone

  try {
    const { id: itemId } = req.params;
    const { bidAmount: rawBidAmount } = req.body;
    const bidderId = req.user._id.toString();

    // --- Basic input checks ---
    const userMaxBid = parseFloat(rawBidAmount);
    if (!userMaxBid || !itemId) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // --- Fetch the item from the database ---
    const item = await itemService.getItemById(itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found." });
    }

    // Parse stored values safely
    const currentPrice = parseFloat(item.current_price);
    const currentLeaderId = item.proxy_bidder_id; // Current winning bidder
    const currentLeaderMax = parseFloat(item.proxy_max_bid || currentPrice); // Their max proxy amount

    // --- Auction status checks ---
    if (item.status !== "active") {
      return res.status(400).json({ error: "This auction is closed." });
    }
    if (item.seller_id === bidderId) {
      return res.status(403).json({ error: "You can't bid on your own listing." });
    }
    if (new Date(item.start_time) > new Date()) {
      return res.status(400).json({ error: "This auction hasn't started yet." });
    }

    // Make sure a challenger is bidding above the minimum required step
    if (bidderId !== currentLeaderId && userMaxBid < currentPrice + BID_INCREMENT) {
      return res.status(400).json({
        error: `Your bid must be at least $${(currentPrice + BID_INCREMENT).toFixed(2)}.`
      });
    }

    // Prepare updated values
    let newPrice = currentPrice;
    let newLeaderId = currentLeaderId;
    let newProxyMax = currentLeaderMax;
    let bidsToRecord = [];
    let message = "";

    // ==========================
    //   PROXY BIDDING LOGIC
    // ==========================

    // A) First ever bid on this item
    if (!currentLeaderId) {
      // Start at the listed price (or the current price if already set)
      newPrice = Math.max(item.start_price, currentPrice);

      newLeaderId = bidderId;
      newProxyMax = userMaxBid;

      bidsToRecord.push({ bidder_id: bidderId, amount: newPrice });
      message = `You're now the highest bidder at $${newPrice.toFixed(2)}!`;
    }

    // B) User is already the leader and wants to raise their proxy max
    else if (bidderId === currentLeaderId) {
      if (userMaxBid > currentLeaderMax) {
        newProxyMax = userMaxBid;
        message = `Your maximum bid has been updated to $${userMaxBid.toFixed(2)}.`;
      } else {
        return res.status(400).json({
          error: "Your new max must be higher than your previous max."
        });
      }
    }

    // C) Challenger bids, but leader's proxy auto-defends
    else if (userMaxBid <= currentLeaderMax) {
      // Auto-bid just high enough to beat the challenger (but not past leader's max)
      const autoDefendPrice = Math.min(userMaxBid + BID_INCREMENT, currentLeaderMax);

      newPrice = autoDefendPrice;
      newLeaderId = currentLeaderId;
      newProxyMax = currentLeaderMax;

      // Log both the challenger’s attempt and the system’s auto-bid
      bidsToRecord.push({ bidder_id: bidderId, amount: userMaxBid });
      bidsToRecord.push({ bidder_id: currentLeaderId, amount: autoDefendPrice });

      message = `You’ve been outbid. Current price is $${newPrice.toFixed(2)}.`;
    }

    // D) Challenger outbids the leader’s max proxy
    else {
      // Raise price just enough to beat the old max (but not to challenger’s max unless needed)
      const priceToWin = Math.min(currentLeaderMax + BID_INCREMENT, userMaxBid);

      newPrice = priceToWin;
      newLeaderId = bidderId;
      newProxyMax = userMaxBid;

      // Optionally log the old leader reaching their max
      if (currentLeaderMax > currentPrice) {
        bidsToRecord.push({ bidder_id: currentLeaderId, amount: currentLeaderMax });
      }

      // Log the winning bid (visible amount)
      bidsToRecord.push({ bidder_id: bidderId, amount: newPrice });

      message = `Congrats! You're now the highest bidder at $${newPrice.toFixed(2)}.`;
    }

    // --- Save everything in one transaction ---
    const result = await itemService.processBidTransaction(
      itemId,
      newPrice,
      newLeaderId,
      newProxyMax,
      bidsToRecord
    );

    // --- Notify real-time subscribers ---
    const io = req.app.get("io");
    io.emit("bid_placed", {
      itemId,
      current_price: result.item.current_price,
      bidderId: newLeaderId,
    });

    return res.json({ ...result, message });

  } catch (err) {
    console.error("Bid Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error." });
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