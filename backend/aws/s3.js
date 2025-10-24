const { S3Client } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});


try { s3.middlewareStack.remove("flexibleChecksumsMiddleware"); } catch {}

module.exports = s3;
