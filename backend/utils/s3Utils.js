const crypto = require("crypto");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("../aws/s3");

const BUCKET = process.env.BUCKET_NAME;
const REGION = process.env.BUCKET_REGION;

// Generate a random hex name (good for file keys)
const randomName = (bytes = 16) =>
  crypto.randomBytes(bytes).toString("hex");

// Pull just the S3 object key from a full file URL
const extractKeyFromUrl = (url) => {
  if (!url) return null;

  try {
    const { pathname } = new URL(url);
    // Removes the leading "/" — S3 keys don't need it
    return pathname.slice(1);
  } catch {
    return null;
  }
};

// Create a temporary signed download URL for an S3 object
const generatePresignedUrl = async (key, expiresIn = 3600) => {
  if (!key) return null;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    return await getSignedUrl(s3, command, { expiresIn });
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    return null;
  }
};

module.exports = {
  randomName,
  extractKeyFromUrl,
  generatePresignedUrl,
};
