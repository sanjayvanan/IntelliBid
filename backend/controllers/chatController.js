// backend/controllers/chatController.js
const { chatWithAssistant } = require("../services/aiService");

const handleChat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const reply = await chatWithAssistant(message);
    res.json({ reply });
  } catch (error) {
    console.error("Chat Controller Error:", error);
    res.status(500).json({ error: "Failed to get response" });
  }
};

module.exports = { handleChat };