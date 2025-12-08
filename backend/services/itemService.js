// services/itemService.js
const db = require("../db/postgres");
const s3 = require("../aws/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const {
  randomName,
  extractKeyFromUrl,
  generatePresignedUrl,
} = require("../utils/s3Utils");
const { embedText, generateAttributeSchema } = require("./aiService");

const BUCKET = process.env.BUCKET_NAME;
const REGION = process.env.BUCKET_REGION;

/**
 * Convert a JS array of numbers into a pgvector literal string.
 */
const toPgVectorLiteral = (embeddingArray) => {
  return `[${embeddingArray.join(",")}]`;
};

/**
 * Attaches presigned URLs to an item if it has images.
 */
const attachPresignedUrl = async (item) => {
  if (!item?.image_url) return item;

  const urls = Array.isArray(item.image_url) ? item.image_url : [item.image_url];

  const signedUrls = await Promise.all(
    urls.map(async (url) => {
      if (!url) return null;
      const key = extractKeyFromUrl(url);
      const signed = await generatePresignedUrl(key);
      return signed || url;
    })
  );

  return {
    ...item,
    image_url: signedUrls.filter((u) => u !== null),
  };
};

/**
 * Fetch all items for a specific seller with category name.
 */
const getItemsBySeller = async (sellerId) => {
  const query = `
    SELECT items.*, categories.name AS category_name
    FROM items
    LEFT JOIN categories ON items.category_id = categories.id
    WHERE items.seller_id = $1 AND items.status = 'active'
  `;
  const { rows } = await db.query(query, [sellerId]);
  return Promise.all(rows.map(attachPresignedUrl));
};

/**
 * Fetch a single item with category name and include presigned URLs for its images..
 */
const getItemById = async (id) => {
  const query = `
    SELECT items.*, categories.name AS category_name 
    FROM items
    LEFT JOIN categories ON items.category_id = categories.id
    WHERE items.id = $1
  `;
  const { rows } = await db.query(query, [id]);
  if (!rows.length) return null;

  return attachPresignedUrl(rows[0]);
};

/**
 * Fetch all currently active items with category name.
 */
const getAllActiveItems = async (page = 1, limit = 12) => {
  const offset = (page - 1) * limit;

  const query = `
    SELECT items.*, categories.name AS category_name
    FROM items
    LEFT JOIN categories ON items.category_id = categories.id
    WHERE items.status = $1
      AND items.end_time > NOW()
    ORDER BY items.end_time ASC
    LIMIT $2 OFFSET $3
  `;

  const { rows } = await db.query(query, ["active", limit, offset]);

  return Promise.all(rows.map(attachPresignedUrl));
};

/**
 * Create a new item.
 */
const createItem = async (item) => {
  const {
    name,
    description,
    start_price,
    current_price,
    start_time,
    end_time,
    category_id,
    seller_id,
    processedImages,
    dynamic_details
  } = item;

  const values = [
    name,
    description,
    start_price,
    current_price ?? start_price,
    start_time ?? new Date(),
    end_time,
    category_id,
    seller_id,
    dynamic_details || {}
  ];

  const insertQuery = `
    INSERT INTO items (
      name, description, start_price, current_price,
      start_time, end_time, category_id, seller_id, status, dynamic_details
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active', $9)
    RETURNING id
  `;

  const { rows } = await db.query(insertQuery, values);
  const itemId = rows[0].id;

  // Generate Embedding
  try {
    const textToEmbed = [name, description].filter(Boolean).join(". ");
    if (textToEmbed) {
      const embedding = await embedText(textToEmbed);
      const vecLiteral = toPgVectorLiteral(embedding);
      await db.query(
        `UPDATE items SET description_embedding = $2 WHERE id = $1`,
        [itemId, vecLiteral]
      );
    }
  } catch (err) {
    console.error("Failed to generate/store embedding for item", itemId, err);
  }

  // Upload Images
  if (processedImages && processedImages.length > 0) {
    const uploadPromises = processedImages.map(async (img) => {
      const key = `${randomName()}.jpg`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: img.buffer,
          ContentType: img.mimetype,
          CacheControl: "public, max-age=31536000, immutable",
          Metadata: { itemId: String(itemId) },
        })
      );
      return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
    });

    const uploadedUrls = await Promise.all(uploadPromises);
    await db.query(`UPDATE items SET image_url = $1 WHERE id = $2`, [
      uploadedUrls,
      itemId,
    ]);
  }

  // Return final item with category name
  const { rows: finalRows } = await db.query(
    `SELECT items.*, categories.name AS category_name
     FROM items
     LEFT JOIN categories ON items.category_id = categories.id
     WHERE items.id = $1`,
    [itemId]
  );
  return attachPresignedUrl(finalRows[0]);
};

/**
 * Update item bid.
 */
// Handles writing a bid to the DB and updating the item’s current state.
// This runs inside a single transaction so nothing is half-updated.
const updateItemBid = async (
  itemId,
  bidAmount,
  winningBidderId, // The user who ends up as the actual highest bidder after logic resolves
  proxyMaxBid,     // That user’s hidden maximum bid value
  initiatorId      // The user who clicked “Bid” (may or may not be the winner)
) => {
  const client = await db.connect();

  try {
    // Start the transaction — either everything succeeds, or nothing applies.
    await client.query("BEGIN");

    // 1. Record the visible bid attempt.
    //    We store the initiator as the bidder because they were the one who triggered the action,
    //    even if an auto-proxy system outbids them immediately.
    const insertQuery = `
      INSERT INTO bids (amount, item_id, bidder_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const bidInsert = await client.query(insertQuery, [
      bidAmount,
      itemId,
      initiatorId
    ]);

    // 2. Update the item’s current price and proxy settings.
    //    winningBidderId = user who ends up being the effective highest bidder.
    const updateQuery = `
      UPDATE items
      SET 
        current_price   = $1,
        proxy_max_bid   = $3,
        proxy_bidder_id = $4
      WHERE id = $2
      RETURNING *
    `;

    await client.query(updateQuery, [
      bidAmount,      // $1 — new visible current price
      itemId,         // $2 — which item is being updated
      proxyMaxBid,    // $3 — winner’s secret max
      winningBidderId // $4 — winner’s user ID
    ]);

    // 3. Grab the fully updated item (including category name)
    const fullItemQuery = `
      SELECT items.*, categories.name AS category_name
      FROM items
      LEFT JOIN categories ON items.category_id = categories.id
      WHERE items.id = $1
    `;
    const itemResult = await client.query(fullItemQuery, [itemId]);

    // Everything succeeded — finalize the transaction.
    await client.query("COMMIT");

    return {
      bid: bidInsert.rows[0],
      item: itemResult.rows[0],
    };
  } catch (error) {
    // If anything breaks, undo all writes.
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};


const getCandidateItems = async (category_id, excluded_id, limit = 20) => {
  const query = `
    SELECT items.*, categories.name AS category_name
    FROM items
    LEFT JOIN categories ON items.category_id = categories.id
    WHERE items.status = 'active'
      AND items.end_time > NOW()
      AND items.category_id = $1
      AND items.id != $2
    ORDER BY items.start_time DESC
    LIMIT $3
  `;
  const { rows } = await db.query(query, [category_id, excluded_id, limit]);
  return Promise.all(rows.map(attachPresignedUrl));
};

//  Now accepts the embedding string/array directly, not the itemId
const getSimilarItemsByEmbedding = async (itemId, embeddingVector, limit = 20) => {
  if (!embeddingVector) return []; // Safety check: if no vector, return empty immediately

  // Ensure vector is formatted as a string for pgvector query
  const vectorLiteral = Array.isArray(embeddingVector) 
    ? toPgVectorLiteral(embeddingVector) 
    : embeddingVector;

  const { rows } = await db.query(
    `
    SELECT items.*, categories.name AS category_name
    FROM items
    LEFT JOIN categories ON items.category_id = categories.id
    WHERE items.id <> $1
      AND items.status = 'active'
      AND items.end_time > NOW()
    ORDER BY items.description_embedding <-> $2::vector
    LIMIT $3
    `,
    [itemId, vectorLiteral, limit]
  );

  return Promise.all(rows.map(attachPresignedUrl));
};

const getRecommendationBaseData = async (itemId, limit = 20) => {
  // 1. Fetch the item once
  const currentItem = await getItemById(itemId);
  if (!currentItem) throw new Error("Item not found");

  let candidates = [];

  // 2. Try Vector Search first
  try {
    if (currentItem.description_embedding) {
      // Pass the embedding we already have! No need to fetch item again.
      candidates = await getSimilarItemsByEmbedding(
        itemId, 
        currentItem.description_embedding, 
        limit
      );
    }
  } catch (err) {
    console.error("Vector fetch failed, falling back to category:", err.message);
  }

  // 3. Fallback: If Vector Search returned nothing (or failed), use Category Search
  if (!candidates || candidates.length === 0) {
    // console.log("Using Category Fallback for recommendations");
    candidates = await getCandidateItems(currentItem.category_id, itemId, limit);
  }

  return { currentItem, candidates };
};


const searchItems = async (queryText, page = 1, limit = 12) => {
  const offset = (page - 1) * limit;

  // 1. Convert the user's search query into a vector
  const embedding = await embedText(queryText);
  const vectorLiteral = `[${embedding.join(",")}]`;

  // 2. Perform Vector Search in Postgres with LIMIT and OFFSET
  const sql = `
    SELECT items.*, categories.name AS category_name
    FROM items
    LEFT JOIN categories ON items.category_id = categories.id
    WHERE items.status = 'active' 
      AND items.end_time > NOW()
    ORDER BY items.description_embedding <-> $1
    LIMIT $2 OFFSET $3;
  `;

  const { rows } = await db.query(sql, [vectorLiteral, limit, offset]);
  
  return Promise.all(rows.map(attachPresignedUrl));
};

/**
 * RAG RETRIEVAL: Find similar items that have successfully sold.
 * Used to ground the AI analysis in real market data.
 */
const getSimilarSoldItems = async (descriptionVector, limit = 5) => {
  const vectorLiteral = `[${descriptionVector.join(",")}]`;

  const query = `
    SELECT name, description, current_price, end_time, image_url
    FROM items
    WHERE status = 'ended' 
      AND winner_id IS NOT NULL
    ORDER BY description_embedding <-> $1
    LIMIT $2
  `;

  const { rows } = await db.query(query, [vectorLiteral, limit]);
  return rows;
};


const getAllCategories = async () => {
  const { rows } = await db.query("SELECT id, name FROM categories ORDER BY name ASC");
  return rows;
};

const getLastBid = async (itemId) => {
  const query = `SELECT * FROM bids WHERE item_id = $1 ORDER BY amount DESC LIMIT 1`;
  const { rows } = await db.query(query, [itemId]);
  return rows[0]; // Returns undefined if no bids exist
};


const processBidTransaction = async (
  itemId,
  newPrice,
  newLeaderId,
  newProxyMax,
  bidsToInsert // Array of { bidder_id, amount }
) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // 1. Insert Bid History Rows
    // We loop through bidsToInsert (usually 1 or 2 rows)
    for (const bid of bidsToInsert) {
        await client.query(
            `INSERT INTO bids(amount, item_id, bidder_id, created_at) VALUES($1, $2, $3, NOW())`,
            [bid.amount, itemId, bid.bidder_id]
        );
    }

    // 2. Update Item State
    const updateQuery = `
      UPDATE items 
      SET 
        current_price = $1, 
        proxy_max_bid = $2, 
        proxy_bidder_id = $3
      WHERE id = $4 
      RETURNING *
    `;
    
    // Ensure numbers are formatted for Numeric/Decimal columns
    await client.query(updateQuery, [
        newPrice.toFixed(2),
        newProxyMax.toFixed(2),
        newLeaderId,
        itemId
    ]);
    
    // 3. Fetch full updated item for response
    const fullItemQuery = `
      SELECT items.*, categories.name AS category_name
      FROM items
      LEFT JOIN categories ON items.category_id = categories.id
      WHERE items.id = $1
    `;
    const itemResult = await client.query(fullItemQuery, [itemId]);

    await client.query("COMMIT");

    return {
      item: itemResult.rows[0],
      // We return the last bid inserted as "latest_bid" for reference
      last_bid_amount: bidsToInsert.length > 0 ? bidsToInsert[bidsToInsert.length - 1].amount : newPrice
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};






// --- Helper: Calculate String Similarity (Levenshtein Distance) --- for getSuggestedAttributes
const getSimilarityScore = (str1, str2) => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) { track[0][i] = i; }
  for (let j = 0; j <= s2.length; j += 1) { track[j][0] = j; }

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  const distance = track[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return (1 - distance / maxLength); // Returns 0.0 to 1.0
};





/**
 * Smart Attribute Suggestion
 * 1. Checks DB for similar items (Vector Search)
 * 2. If found, reuses their dynamic_details schema (keys)
 * 3. If not, asks AI to generate new keys
 */
const getSuggestedAttributes = async (name, categoryName, categoryId) => {
  try {
    const embedding = await embedText(name);
    const vectorLiteral = toPgVectorLiteral(embedding);

    console.log(`[Smart Attributes] Input: "${name}" | CatID: ${categoryId}`);

    // Query: Nearest neighbor IN THE SAME CATEGORY
    const query = `
      SELECT name, dynamic_details, description_embedding <-> $1 as distance
      FROM items 
      WHERE dynamic_details IS NOT NULL 
        AND dynamic_details::text != '{}'
        AND category_id = $2
      ORDER BY description_embedding <-> $1 ASC
      LIMIT 1
    `;

    const { rows } = await db.query(query, [vectorLiteral, categoryId]);

    if (rows.length > 0) {
      const candidate = rows[0];
      const nameSimilarity = getSimilarityScore(name, candidate.name);
      
      console.log(`[Smart Attributes] Neighbor found: "${candidate.name}"`);
      console.log(`[Smart Attributes] Dist: ${candidate.distance.toFixed(3)} | NameSim: ${nameSimilarity.toFixed(3)}`);

      // 40% Name Similarity Check
      if (nameSimilarity > 0.4) {
         console.log(`[Smart Attributes] Match found! Reusing DB schema.`);
         return Object.keys(candidate.dynamic_details);
      } else {
         console.log(`[Smart Attributes] Match rejected (Names too different).`);
      }
    } else {
      console.log(`[Smart Attributes] No existing items found in Category ${categoryId}.`);
    }

    // Fallback
    console.log(`[Smart Attributes] Asking AI for "${name}" schema.`);
    return await generateAttributeSchema(name, categoryName);

  } catch (error) {
    console.error("Smart Attribute Error:", error);
    return await generateAttributeSchema(name, categoryName);
  }
};



//edit the item
const editItem = async (itemId, userId, updates) => {
  // 1. Check if item exists and belongs to user
  const { rows: items } = await db.query(`SELECT * FROM items WHERE id = $1`, [itemId]);
  if (items.length === 0) throw new Error("Item not found");
  
  const item = items[0];
  if (item.seller_id !== userId) {
    throw new Error("You are not authorized to edit this item");
  }

  // 2. CRITICAL: Check for existing bids
  const { rows: bids } = await db.query(`SELECT 1 FROM bids WHERE item_id = $1 LIMIT 1`, [itemId]);
  
  if (bids.length > 0) {
    throw new Error("Cannot edit listing: Bids have already been placed. The listing is locked to ensure fairness.");
  }

  // 3. GENERATE NEW VECTOR (If name/description changed)
  let vectorLiteral = null;
  
  // Check if we need to update the embedding
  if (updates.name || updates.description) {
      try {
          // Use new values if provided, otherwise fallback to existing DB values
          const finalName = updates.name || item.name;
          const finalDesc = updates.description || item.description;
          
          const textToEmbed = [finalName, finalDesc].filter(Boolean).join(". ");
          
          if (textToEmbed) {
              const embedding = await embedText(textToEmbed);
              vectorLiteral = toPgVectorLiteral(embedding);
          }
      } catch (err) {
          console.error("Failed to update embedding during edit:", err);
          // We continue the update even if AI fails, to not block the user
      }
  }

  // 4. Perform Update
  const { name, description, dynamic_details, category_id } = updates;
  
  const updateQuery = `
    UPDATE items 
    SET 
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      dynamic_details = COALESCE($3, dynamic_details),
      category_id = COALESCE($4, category_id),
      description_embedding = COALESCE($6, description_embedding) -- Update vector if we have a new one
    WHERE id = $5
    RETURNING *
  `;

  const { rows: updated } = await db.query(updateQuery, [
    name, 
    description, 
    dynamic_details, 
    category_id,
    itemId,
    vectorLiteral
  ]);

  return updated[0];
};


module.exports = {
  getItemsBySeller,
  getItemById,
  getAllActiveItems,
  createItem,
  updateItemBid,
  getCandidateItems,
  getRecommendationBaseData,
  getSimilarItemsByEmbedding,
  searchItems,
  getSimilarSoldItems,
  getAllCategories,
  getLastBid,
  processBidTransaction,
  getSuggestedAttributes,
  editItem,
};