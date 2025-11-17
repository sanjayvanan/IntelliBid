// services/aiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Main text model for description + (optional) re-ranking
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Embedding model for pgvector
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

/**
 * Generate a short auction description for an item.
 */
const generateItemDescription = async (name, category) => {
  if (!name) {
    throw new Error("Item name is required");
  }

  const prompt = `
You are writing a short auction listing.

Item name: "${name}"
Category: "${category || "general"}"

Write 2–3 sentences:
- First sentence: clearly state what the item is, including brand/model and type (e.g. "Apple Watch Series 10 smartwatch").
- Second sentence: mention 2–3 concrete features or specs (e.g. display size, battery life, health tracking, connectivity, storage).
- Optional third sentence: a short call-to-action like "Auction ends soon, place your bid."

Keep it under 60 words.
Avoid generic hype like "amazing deal" without also mentioning real features.
Return only the description text, no bullet points.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
};

/**
 * Ask AI to choose top 3 recommended IDs from candidate list.
 * (Currently not used, but kept for future LLM re-ranking.)
 *
 * currentItem: { name, description, ... }
 * candidatesList: [{ id, name, description, price }, ...]
 */
const chooseRecommendedIds = async (currentItem, candidatesList) => {
  const prompt = `
    I am viewing this item: "${currentItem.name}" (Description: "${currentItem.description}").

    From this list of items in the same category:
    ${JSON.stringify(candidatesList)}

    Select the top 3 items that a buyer of the first item would most likely be interested in.
    Consider price similarity and complementary features.
    Return ONLY a JSON array of IDs (e.g., [12, 5, 9]).
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();

  // Clean up ```json fences etc.
  text = text.replace(/```json/g, "").replace(/```/g, "").trim();

  const parsed = JSON.parse(text); // may throw; caller should handle
  if (!Array.isArray(parsed)) {
    throw new Error("AI did not return an array of IDs");
  }

  return parsed;
};

/**
 * Generate a numeric embedding vector for a piece of text.
 */
const embedText = async (text) => {
  if (!text || !text.trim()) {
    throw new Error("Text is required for embedding");
  }

  const result = await embeddingModel.embedContent(text);
  const embedding = result.embedding?.values;

  if (!Array.isArray(embedding) || !embedding.length) {
    throw new Error("Empty embedding returned from Gemini");
  }

  return embedding;
};

module.exports = {
  generateItemDescription,
  chooseRecommendedIds,
  embedText,
};
