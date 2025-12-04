// backend/routes/chat.js
const express = require("express");
const router = express.Router();
const { handleChat } = require("../controllers/chatController");
// We don't strictly need auth for a help bot, but you can add it if you want only logged-in users to chat.
// const requireAuth = require("../middleware/requireAuth"); 

router.post("/", handleChat);

module.exports = router;