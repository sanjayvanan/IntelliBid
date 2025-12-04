// services/aiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

//MAIN MODEL
// Main text model for description + (optional) re-ranking is gemini-2.5-flash
// this is the Main model... flash lite is temp because of the Load in the flash

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// const model = genAI.getGenerativeModel({
//   model: "gemini-2.5-flash-lite"
// });



// Embedding model for pgvector
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

/**
 * Generate a short auction description for an item.
 */
const generateItemDescription = async (name, category, attributes = {}) => {
  if (!name) {
    throw new Error("Item name is required");
  }

  // Convert attributes object to a readable string
  // e.g. "Storage: 256GB, Color: Blue"
  const detailsString = Object.entries(attributes)
    .filter(([_, value]) => value && value.trim().length > 0) // Only include filled fields
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  const prompt = `
    You are writing a short, compelling auction listing.

    Item: "${name}"
    Category: "${category || "General"}"
    ${detailsString ? `Key Details: ${detailsString}` : ""}

    Write 2–3 sentences:
    1. Identify the item clearly.
    2. Naturally weave in the Key Details provided above (don't just list them, describe them).
    3. End with a short call to action.

    Keep it under 60 words. No bullet points.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Description Generation Failed:", error);
    return `A great listing for ${name}. Bid now to win!`; // Fallback
  }
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


const generateAttributeSchema = async (name, category) => {
  const prompt = `
    I will give you a product name and category being sold in a secondhand auction.
    Product: "${name}"
    Category: "${category}"

    Return a JSON array of 6 to 10 strings representing specific details a BUYER needs to know about the condition and included items.
    
    IMPORTANT RULES:
    1. Focus on VARIABLE details (Condition, Battery Health, Included Accessories, Defects, Warranty).
    2. IGNORE static specs that are obvious for the model (e.g., do NOT ask for "OS" for an iPhone, do NOT ask for "Resolution" for a TV, do NOT ask for "Fuel Type" for a Tesla).
    3. Examples of GOOD fields:
       - Phone: ["Storage Capacity", "Battery Health %", "Screen Condition", "Body Scratches", "Charger Included?", "iCloud Locked?"]
       - Car: ["Mileage", "Service History", "Tire Condition", "Accident History", "Number of Keys", "Interior Wear"]
       - Laptop: ["Cycle Count", "RAM", "Storage", "Charger Included", "Screen Dead Pixels", "Keyboard Wear"]
    
    OUTPUT FORMAT:
    - Return ONLY the raw JSON array of strings.
    - Do NOT include values.
    - Do NOT include markdown formatting.
    - Do NOT include intro text.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Cleanup
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("AI Attribute Generation Failed:", error);
    return []; 
  }
};

module.exports = {
  generateItemDescription,
  chooseRecommendedIds,
  embedText,
  generateListingAnalysis,
  generateAttributeSchema
};
