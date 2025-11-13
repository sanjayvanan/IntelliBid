const db = require("../db/postgres");
const s3 = require("../aws/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { randomName, extractKeyFromUrl, generatePresignedUrl } = require("../utils/s3Utils");

const BUCKET = process.env.BUCKET_NAME;
const REGION = process.env.BUCKET_REGION;

/**
 * Attaches a presigned URL to an item if it has an image.
 */
const attachPresignedUrl = async (item) => {
  if (!item?.image_url) return item;

  const key = extractKeyFromUrl(item.image_url);
  const url = await generatePresignedUrl(key);

  return {
    ...item,
    image_url: url || item.image_url,
  };
};

/**
 * Fetch all items for a specific seller.
 */
const getItemsBySeller = async (sellerId) => {
  const query = `SELECT * FROM items WHERE seller_id = $1`;
  const { rows } = await db.query(query, [sellerId]);
  return rows;
};

/**
 * Fetch a single item and include a presigned URL for its image.
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
 * Create a new item and upload its image if provided.
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
    processedImage,
    processedMime,
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

  const insertQuery = `
    INSERT INTO items (name, description, start_price, current_price, start_time, end_time, category_id, seller_id, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active')
    RETURNING id
  `;

  const { rows } = await db.query(insertQuery, values);
  const itemId = rows[0].id;

  // Upload image if present
  if (processedImage) {
    const key = `${randomName()}.jpg`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: processedImage,
        ContentType: processedMime,
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { itemId: String(itemId) },
      })
    );

    const imageUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
    await db.query(`UPDATE items SET image_url = $1 WHERE id = $2`, [imageUrl, itemId]);
  }

  // Return final item with signed URL
  const { rows: finalRows } = await db.query(`SELECT * FROM items WHERE id = $1`, [itemId]);
  return attachPresignedUrl(finalRows[0]);
};





//update the Items(Placing the BID)
const updateItemBid = async (itemId, bidAmount, bidderId) => {
  const client = await db.connect(); 
  try {
     const values = [
      bidAmount,
      itemId,
      bidderId
    ]
    await client.query('BEGIN');

    const insertQuery = `INSERT INTO bids(amount, item_id, bidder_id) VALUES($1,$2,$3)`;
    const bidInsert = await client.query(insertQuery, values);

    const updateQuery = `Update items SET current_price = $1 WHERE id = $2`;
    const itemUpdate = await client.query(updateQuery, [bidAmount, itemId]);

    await client.query("COMMIT");
    console.log(bidInsert.rows[0]);
    console.log(itemUpdate.rows[0]);
    
    
    return {
      bid: bidInsert.rows[0],
      item: itemUpdate.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
  }
  finally {
  client.release();
}

   
  

};

module.exports = {
  getItemsBySeller,
  getItemById,
  getAllActiveItems,
  createItem,
  updateItemBid
};
