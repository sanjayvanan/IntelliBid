// Services
const itemService = require('../services/itemService');

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
// Update (placeholder)
// ----------------------
const updateItem = async (req, res) => {
  console.log("updateItem endpoint hit — not implemented yet");
  res.status(501).json({ message: "Update item not implemented yet" });
};

module.exports = {
  getMyItems,
  getItem,
  getItems,
  createItem,
  updateItem,
};
