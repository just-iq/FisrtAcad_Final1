const cloudinary = require("cloudinary").v2;
const { config } = require("../config/config");
const { randomUUID } = require("crypto");

// Initialize Cloudinary
if (config.cloudinary.cloud_name && config.cloudinary.api_key && config.cloudinary.api_secret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloud_name,
    api_key: config.cloudinary.api_key,
    api_secret: config.cloudinary.api_secret,
    secure: true
  });
}

function buildObjectKey(prefix, originalName) {
  const safeName = String(originalName || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
    // .replace(/\.[^/.]+$/, ""); // SRS FIX: Keep extension! Cloudinary needs it for raw files/format detection.
  
  // UX FIX: Use folder structure for uniqueness so the final part of the URL is the clean filename.
  // Old: prefix/timestamp_uuid_filename
  // New: prefix/timestamp_uuid/filename
  return `${prefix}/${Date.now()}_${randomUUID()}/${safeName}`;
}

async function uploadBuffer({ buffer, contentType, keyPrefix, originalName }) {
  if (!config.cloudinary.cloud_name) {
    const err = new Error("Cloudinary not configured (missing CLOUDINARY_CLOUD_NAME)");
    err.statusCode = 500;
    err.code = "STORAGE_CONFIG_ERROR";
    throw err;
  }

  // Generate a unique public_id
  const public_id = buildObjectKey(keyPrefix, originalName);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id,
        resource_type: "auto", // auto detect image/video/raw
        type: "upload", // public access via stored URL
        invalidate: true
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          Bucket: config.cloudinary.cloud_name, // Map to "Bucket" for compatibility
          Key: result.public_id, // Map to "Key" for compatibility
          Url: result.secure_url,
          format: result.format
        });
      }
    );

    // Write buffer to stream
    uploadStream.end(buffer);
  });
}

async function signedGetUrl({ key, mimeType, resourceType, expiresInSeconds = 300 }) {
  if (!config.cloudinary.cloud_name) {
    throw new Error("Cloudinary not configured");
  }

  // Use the resource_type extracted from the stored URL if available (most accurate).
  // Fall back to guessing from mimeType.
  let resource_type = resourceType || "image";
  if (!resourceType && mimeType) {
    if (mimeType.startsWith("video/")) resource_type = "video";
    else if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") resource_type = "raw";
  }

  const options = {
    resource_type,
    type: "authenticated",
    secure: true,
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds
  };

  return cloudinary.url(key, options);
}

// Special wrapper to help `signedGetUrl` if we know the mime type?
// Not changing signature -> Minimal risk choice: Use 'image' (default) as many things act like images,
// but for PDFs/Docs 'raw' is safer.
// Let's try to detect from the key if possible, or just default to raw?
// Actually, let's look at `uploadBuffer` - if we use `resource_type: auto`, Cloudinary decides.
// The safe bet for 'files' (assignments) is 'raw' or 'auto'.
// We'll stick to a robust signature generation.

module.exports = { uploadBuffer, signedGetUrl };
