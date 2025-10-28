const crypto = require("crypto");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3 = require("../aws/s3");
const db = require("../db/postgres");

const BUCKET = process.env.BUCKET_NAME;
const REGION = process.env.BUCKET_REGION;

const randomName = (bytes = 16) => crypto.randomBytes(bytes).toString("hex");

// Extract S3 key from full URL
const extractKeyFromUrl = (url) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading '/'
  } catch (error) {
    return null;
  }
};

// Generate presigned URL for S3 object
const generatePresignedUrl = async (key, expiresIn = 3600) => {
  if (!key) return null;
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    const url = await getSignedUrl(s3, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return null;
  }
};

async function getItem(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query("SELECT * FROM items WHERE id = $1", [id]);
    if (!rows.length) return res.status(404).json({ error: "Item not found" });
    
    const item = rows[0];
    
    // Generate presigned URL if image_url exists
    if (item.image_url) {
      const key = extractKeyFromUrl(item.image_url);
      const presignedUrl = await generatePresignedUrl(key);
      item.image_url = presignedUrl || item.image_url;
    }
    
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function getItems(_req, res) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM items WHERE status = $1 ORDER BY end_time ASC",
      ["active"]
    );
    
    // Generate presigned URLs for all items with images
    const itemsWithPresignedUrls = await Promise.all(
      rows.map(async (item) => {
        if (item.image_url) {
          const key = extractKeyFromUrl(item.image_url);
          const presignedUrl = await generatePresignedUrl(key);
          return {
            ...item,
            image_url: presignedUrl || item.image_url,
          };
        }
        return item;
      })
    );
    
    res.json(itemsWithPresignedUrls);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function createItem(req, res) {
  const { name, description, start_price, current_price, start_time, end_time, category_id } = req.body;
  const seller_id = req.user._id.toString();

  try {
    // 1) create row
    const ins = `
      INSERT INTO items(name, description, start_price, current_price, start_time, end_time, category_id, seller_id, status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active')
      RETURNING id
    `;
    const vals = [
      name,
      description,
      start_price,
      current_price ?? start_price,
      start_time ?? new Date(),
      end_time,
      category_id,
      seller_id,
    ];
    const { rows } = await db.query(ins, vals);
    const itemId = rows[0].id;

    // 2) upload image if present
    if (req.processedImage && req.file) {
      const key = `${randomName()}.jpg`;
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: req.processedImage,
        ContentType: req.processedMime,
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { itemId: String(itemId) },
      }));
      const image_url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
      await db.query("UPDATE items SET image_url = $1 WHERE id = $2", [image_url, itemId]);
    }

    // 3) return row with presigned URL if image exists
    const { rows: finalRows } = await db.query("SELECT * FROM items WHERE id = $1", [itemId]);
    const item = finalRows[0];
    
    // Generate presigned URL if image_url exists
    if (item.image_url) {
      const key = extractKeyFromUrl(item.image_url);
      const presignedUrl = await generatePresignedUrl(key);
      item.image_url = presignedUrl || item.image_url;
    }
    
    res.status(201).json(item);
  } catch (error) {
    console.error("CreateItem Error:", error);
    res.status(400).json({ error: error.message });
  }
}

module.exports = { getItem, getItems, createItem };
