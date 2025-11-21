// services/aiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

//MAIN MODEL
// Main text model for description + (optional) re-ranking is gemini-2.5-flash
// this is the Main model... flash lite is temp because of the Load in the flash

// const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite"
});



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


/**
 * RAG GENERATION: Analyze a draft listing against real sold data.
 */
const generateListingAnalysis = async (draft, soldItems) => {
  // Format sold items for the prompt
  const marketContext = soldItems.map(item => 
    `- "${item.name}" sold for $${item.current_price}. Desc: ${item.description.substring(0, 100)}...`
  ).join("\n");

  const prompt = `
    You are an expert auction appraiser. 
    
    USER DRAFT LISTING:
    Name: "${draft.name}"
    Price: $${draft.price}
    Description: "${draft.description}"

    REAL MARKET DATA (Similar items that sold recently):
    ${marketContext}

    TASK:
    Analyze the user's draft based *only* on the market data provided.
    
    Return a raw JSON object (no markdown formatting) with these fields:
    1. "score": A number 1-10 rating the quality of their listing.
    2. "price_analysis": A short string assessing their price (e.g. "Too low", "Fair", "Too high").
    3. "estimated_value": A string range (e.g. "$120 - $150") based on the sold items.
    4. "advice": A short, actionable tip to improve the description or title.
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
      
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return null; // Fail gracefully
  }
};


module.exports = {
  generateItemDescription,
  chooseRecommendedIds,
  embedText,
  generateListingAnalysis,
};
