require("dotenv").config(); // Load environment variables
const { Pool } = require("pg");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 1. Setup Database Connection
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: { rejectUnauthorized: false }
});

// 2. Setup Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// Helper: Sleep to avoid hitting API rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log("🚀 Starting embedding migration...");

    // Fetch all items that need updating
    const res = await client.query("SELECT id, name, description FROM items");
    const items = res.rows;
    
    console.log(`found ${items.length} items to re-embed.`);

    for (const [index, item] of items.entries()) {
      const textToEmbed = [item.name, item.description].filter(Boolean).join(". ");
      
      if (!textToEmbed) {
        console.log(`⚠️ Skipping item ${item.id} (No text)`);
        continue;
      }

      try {
        // Generate new embedding (Force 768 dimensions to match your DB)
        const result = await model.embedContent({
          content: { parts: [{ text: textToEmbed }] },
          outputDimensionality: 768 
        });

        const embedding = result.embedding.values;
        const vectorLiteral = `[${embedding.join(",")}]`;

        // Update the database
        await client.query(
          "UPDATE items SET description_embedding = $1 WHERE id = $2",
          [vectorLiteral, item.id]
        );

        console.log(`✅ [${index + 1}/${items.length}] Updated: ${item.name.substring(0, 20)}...`);

        // Sleep for 200ms to prevent "429 Too Many Requests" errors
        await sleep(200); 

      } catch (err) {
        console.error(`❌ Failed to update item ${item.id}:`, err.message);
      }
    }

    console.log("🎉 Migration complete!");

  } catch (err) {
    console.error("Migration fatal error:", err);
  } finally {
    client.release();
    pool.end(); // Close DB connection
  }
}

migrate();