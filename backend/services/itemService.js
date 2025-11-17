// services/itemService.js
const db = require("../db/postgres");
const s3 = require("../aws/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const {
  randomName,
  extractKeyFromUrl,
  generatePresignedUrl,
} = require("../utils/s3Utils");
const { embedText } = require("./aiService");

const BUCKET = process.env.BUCKET_NAME;
const REGION = process.env.BUCKET_REGION;

/**
 * Convert a JS array of numbers into a pgvector literal string.
 * Example: [0.1, 0.2] -> "[0.1,0.2]"
 */
const toPgVectorLiteral = (embeddingArray) => {
  return `[${embeddingArray.join(",")}]`;
};

/**
 * Attaches presigned URLs to an item if it has images.
 * Handles both single string (legacy) and array of strings.
 */
const attachPresignedUrl = async (item) => {
  if (!item?.image_url) return item;

  // Ensure image_url is treated as an array (handles legacy string data vs new array data)
  const urls = Array.isArray(item.image_url) ? item.image_url : [item.image_url];

  // Generate signed URLs for all images
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
    image_url: signedUrls.filter((u) => u !== null), // Return array of signed URLs
  };
};

/**
 * Fetch all items for a specific seller.
 */
const getItemsBySeller = async (sellerId) => {
  const query = `SELECT * FROM items WHERE seller_id = $1`;
  const { rows } = await db.query(query, [sellerId]);
  return Promise.all(rows.map(attachPresignedUrl));
};

/**
 * Fetch a single item and include presigned URLs for its images.
 */
const getItemById = async (id) => {
  const { rows } = await db.query(`SELECT * FROM items WHERE id = $1`, [id]);
  if (!rows.length) return null;

  return attachPresignedUrl(rows[0]);
};

/**
 * Fetch all currently active items (end_time in the future).
 */
const getAllActiveItems = async () => {
  const query = `
    SELECT *
    FROM items
    WHERE status = $1
      AND end_time > NOW()
    ORDER BY end_time ASC
  `;

  const { rows } = await db.query(query, ["active"]);

  return Promise.all(rows.map(attachPresignedUrl));
};

/**
 * Create a new item and upload its images if provided.
 * Also generates and stores a description embedding.
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
    processedImages, // Expecting an array of processed image objects
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
  ];

  // Insert the item first to get the ID
  const insertQuery = `
    INSERT INTO items (
      name,
      description,
      start_price,
      current_price,
      start_time,
      end_time,
      category_id,
      seller_id,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active')
    RETURNING id
  `;

  const { rows } = await db.query(insertQuery, values);
  const itemId = rows[0].id;

  // Generate and store embedding for this item (best-effort)
  try {
    // Use both name + description so embedding has real product meaning
    const textToEmbed = [name, description].filter(Boolean).join(". ");

    if (textToEmbed) {
      const embedding = await embedText(textToEmbed);
      const vecLiteral = toPgVectorLiteral(embedding);

      await db.query(
        `UPDATE items
         SET description_embedding = $2
         WHERE id = $1`,
        [itemId, vecLiteral]
      );
    }
  } catch (err) {
    console.error("Failed to generate/store embedding for item", itemId, err);
    // Do not throw; item creation should still succeed without embedding
  }

  // Upload images if present
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

    // Update DB with the array of URLs
    await db.query(`UPDATE items SET image_url = $1 WHERE id = $2`, [
      uploadedUrls,
      itemId,
    ]);
  }

  // Return final item with signed URLs
  const { rows: finalRows } = await db.query(
    `SELECT * FROM items WHERE id = $1`,
    [itemId]
  );
  return attachPresignedUrl(finalRows[0]);
};

/**
 * Update the item when a bid is placed.
 */
const updateItemBid = async (itemId, bidAmount, bidderId) => {
  const client = await db.connect();
  try {
    const values = [bidAmount, itemId, bidderId];
    await client.query("BEGIN");

    const insertQuery = `INSERT INTO bids(amount, item_id, bidder_id) VALUES($1,$2,$3) RETURNING *`;
    const bidInsert = await client.query(insertQuery, values);

    const updateQuery = `UPDATE items SET current_price = $1 WHERE id = $2 RETURNING *`;
    const itemUpdate = await client.query(updateQuery, [bidAmount, itemId]);

    await client.query("COMMIT");
    console.log(bidInsert.rows[0]);
    console.log(itemUpdate.rows[0]);

    return {
      bid: bidInsert.rows[0],
      item: itemUpdate.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getCandidateItems = async (category_id, excluded_id, limit = 20) => {
  const query = `
    SELECT * FROM items 
    WHERE status = 'active'
      AND end_time > NOW()
      AND category_id = $1
      AND id != $2
    ORDER BY start_time DESC
    LIMIT $3
  `;

  const { rows } = await db.query(query, [category_id, excluded_id, limit]);

  return Promise.all(rows.map(attachPresignedUrl));
};

/**
 * Get similar items using pgvector similarity (NO category filter).
 */
const getSimilarItemsByEmbedding = async (itemId, limit = 20) => {
  const { rows: currentRows } = await db.query(
    `SELECT id, category_id, description_embedding
     FROM items
     WHERE id = $1`,
    [itemId]
  );

  if (!currentRows.length) {
    throw new Error("Item not found");
  }

  const current = currentRows[0];

  if (!current.description_embedding) {
    throw new Error("Current item has no embedding");
  }

  const { rows } = await db.query(
    `
    SELECT *
    FROM items
    WHERE id <> $1
      AND status = 'active'
      AND end_time > NOW()
    ORDER BY description_embedding <-> $2::vector
    LIMIT $3
    `,
    [itemId, current.description_embedding, limit]
  );

  return Promise.all(rows.map(attachPresignedUrl));
};

/**
 * Helper: fetch the current item and candidate items for recommendations.
 */
const getRecommendationBaseData = async (itemId, limit = 20) => {
  const currentItem = await getItemById(itemId);
  if (!currentItem) {
    throw new Error("Item not found");
  }

  let candidates;
  try {
    // primary path: vector similarity (no category constraint)
    candidates = await getSimilarItemsByEmbedding(itemId, limit);
  } catch (err) {
    console.error("Vector-based candidate fetch failed, falling back:", err);
    // fallback: old category-based logic so nothing breaks
    candidates = await getCandidateItems(currentItem.category_id, itemId, limit);
  }

  return { currentItem, candidates };
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
};