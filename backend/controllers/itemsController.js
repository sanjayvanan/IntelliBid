const crypto = require("crypto");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("../aws/s3");
const db = require("../db/postgres");

const BUCKET = process.env.BUCKET_NAME;
const REGION = process.env.BUCKET_REGION;

const randomName = (bytes = 16) => crypto.randomBytes(bytes).toString("hex");

async function getItem(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await db.query("SELECT * FROM items WHERE id = $1", [id]);
    if (!rows.length) return res.status(404).json({ error: "Item not found" });
    res.json(rows[0]);
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
    res.json(rows);
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

    // 3) return row
    const { rows: finalRows } = await db.query("SELECT * FROM items WHERE id = $1", [itemId]);
    res.status(201).json(finalRows[0]);
  } catch (error) {
    console.error("CreateItem Error:", error);
    res.status(400).json({ error: error.message });
  }
}

module.exports = { getItem, getItems, createItem };
