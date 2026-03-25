const dotenv = require("dotenv");

dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8080),
  corsOrigin: process.env.CORS_ORIGIN || true,

  jwt: {
    secret: process.env.JWT_SECRET || "dev_only_change_me",
    expiresIn: process.env.JWT_EXPIRES_IN || "8h"
  },

  db: {
    url: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/firstacad"
  },

  aiService: {
    baseUrl: process.env.AI_SERVICE_URL || "http://localhost:8000"
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || "",
    region: process.env.S3_REGION || "us-east-1",
    bucket: process.env.S3_BUCKET || "",
    accessKey: process.env.S3_ACCESS_KEY || "",
    secretKey: process.env.S3_SECRET_KEY || ""
  },

  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
    api_key: process.env.CLOUDINARY_API_KEY || "",
    api_secret: process.env.CLOUDINARY_API_SECRET || ""
  }
};

module.exports = { config, required };

