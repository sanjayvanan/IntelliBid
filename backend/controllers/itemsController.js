// controllers/itemsController.js

const itemService = require("../services/itemService");
const { generateItemDescription, embedText, generateListingAnalysis } = require("../services/aiService");
const { getRecommendationsForItem} = require("../services/recommendationService");

const redis = require("../db/redis");

const DEFAULT_TTL = 3600; // 1 hour cache
const FEED_TTL = 60;      // 60 seconds for the main feed

// ----------------------
// Generate description
// ----------------------
const generateDescription = async (req, res) => {
  try {
    // Extract attributes from the request
    const { name, category, attributes } = req.body;

    if (!name) {  
      return res.status(400).json({ error: "Item name is required" });
    }

    // Pass them to the service
    const description = await generateItemDescription(name, category, attributes);
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
// Get a single item (With Caching)
// ----------------------
const getItem = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `item:${id}`;

    // 1. Try to fetch from Redis
    const cachedItem = await redis.get(cacheKey);
    if (cachedItem) {
      console.log(`⚡ Cache hit for item ${id}`); 
      return res.json(JSON.parse(cachedItem));
    }

    // 2. If not in cache, fetch from DB
    const item = await itemService.getItemById(id);

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // 3. Save to Redis
    await redis.setEx(cacheKey, DEFAULT_TTL, JSON.stringify(item));

    res.json(item);
  } catch (error) {
    console.error("getItem:", error);
    res.status(400).json({ error: error.message });
  }
};


// ----------------------
// Get all active items (With Caching)
// ----------------------
const getItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12; 
    const searchQuery = req.query.search || "";

    // Unique key for this specific page/search combo
    const cacheKey = `items:feed:${page}:${limit}:${searchQuery.trim().toLowerCase()}`;

    // 1. Try Cache
    const cachedFeed = await redis.get(cacheKey);
    if (cachedFeed) {
      // ✅ ADDED THIS LOG so you can see it working!
      console.log(`⚡ Cache hit for feed: ${cacheKey}`); 
      return res.json(JSON.parse(cachedFeed));
    }

   // fetched from DB
    console.log(`❌ Cache miss for feed: ${cacheKey}`); 

    // 2. Fetch from Service
    let items;
    if (searchQuery && searchQuery.trim().length > 0) {
      items = await itemService.searchItems(searchQuery, page, limit);
    } else {
      items = await itemService.getAllActiveItems(page, limit);
    }

    // 3. Save to Redis (Short TTL for feeds)
    await redis.setEx(cacheKey, FEED_TTL, JSON.stringify(items));

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
    let dynamic_details = req.body.dynamic_details;
    
    // Since we send FormData, objects often come as JSON strings
    if (typeof dynamic_details === 'string') {
        try {
            dynamic_details = JSON.parse(dynamic_details);
        } catch (e) {
            dynamic_details = {};
        }
    }

    const itemData = {
      ...req.body,
      seller_id: req.user._id.toString(),
      processedImages: req.processedImages,
      dynamic_details: dynamic_details 
    };

    const newItem = await itemService.createItem(itemData);
    res.status(201).json(newItem);
  } catch (error) {
    console.error("createItem:", error);
    res.status(400).json({ error: error.message });
  }
};

// ----------------------
// Update bid (With Cache Invalidation)
// ----------------------
// Handles placing or updating a bid on an item (with proxy bidding support)
// ----------------------

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

    // ============================================
    // 🔥 REDIS: INVALIDATE CACHE
    // ============================================
    // Delete the specific item cache so the next fetch gets the new price
    try {
      await redis.del(`item:${itemId}`);
    } catch (redisErr) {
      console.error("Redis Error:", redisErr);
      // We continue even if Redis fails, so the bid isn't blocked
    }

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


const generateAttributes = async (req, res) => {
  try {
    // 1. Extract categoryId here
    const { name, category, categoryId } = req.body; 
    
    if (!name) return res.status(400).json({ error: "Item name is required" });

    // 2. Pass categoryId as the 3rd argument
    const fields = await itemService.getSuggestedAttributes(name, category, categoryId);
    
    res.json(fields);
  } catch (error) {
    console.error("Attribute Generation Error:", error);
    res.status(500).json({ error: "Failed to generate attributes" });
  }
};


const editItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();
    const updates = req.body;

    const updatedItem = await itemService.editItem(id, userId, updates);

    // 🔥 INVALIDATE CACHE
    await redis.del(`item:${id}`);

    res.json(updatedItem);

  } catch (error) {
    console.error("Edit Item Error:", error);
    
    if (error.message.includes("Bids have already been placed") || error.message.includes("authorized")) {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to edit item" });
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
  getCategories,
  generateAttributes,
  editItem
};