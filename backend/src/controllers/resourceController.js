const { create, list, get, recordInteraction } = require("../services/resourceService");
const { uploadBuffer, signedGetUrl } = require("../services/storageService");

async function createResourceController(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "file is required (multipart/form-data)" } });
    }

    const { Bucket, Key, Url } = await uploadBuffer({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      keyPrefix: `resources/${req.user.id}`,
      originalName: req.file.originalname
    });

    // SRS FIX: FormData sends "null" or "" for empty fields, causing DB integer parsing errors.
    // Sanitize inputs to ensure proper nulls are passed to service/DB.
    const sanitizeId = (val) => (!val || val === "null" || val === "undefined" || val === "" ? null : Number(val));

    const resource = await create(req.user, {
      ...req.body,
      department_id: sanitizeId(req.body.department_id),
      level_id: sanitizeId(req.body.level_id),
      group_id: sanitizeId(req.body.group_id),
      file_key: Key,
      file_url: Url,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size
    });
    return res.status(201).json({ resource });
  } catch (e) {
    return next(e);
  }
}

async function listResourcesController(req, res, next) {
  try {
    const { limit } = req.query || {};
    const resources = await list(req.user, { limit });
    return res.json({ resources });
  } catch (e) {
    return next(e);
  }
}

async function getResourceController(req, res, next) {
  try {
    const resource = await get(req.user, req.params.id);
    // Use stored file_url if it's a public upload URL.
    // Authenticated URLs (legacy) need a freshly signed URL instead.
    const isAuthenticated = resource.file_url && resource.file_url.includes("/authenticated/");
    let accessUrl = (!isAuthenticated && resource.file_url) ? resource.file_url : null;
    if (!accessUrl) {
      try {
        // Extract the resource_type Cloudinary actually used from the stored URL
        // URL pattern: https://res.cloudinary.com/{cloud}/{resource_type}/{type}/...
        let resourceTypeHint;
        if (resource.file_url) {
          const match = resource.file_url.match(/res\.cloudinary\.com\/[^/]+\/([^/]+)\//);
          if (match) resourceTypeHint = match[1]; // "image", "video", or "raw"
        }
        accessUrl = await signedGetUrl({
          key: resource.file_key,
          mimeType: resource.mime_type,
          resourceType: resourceTypeHint,
          expiresInSeconds: 3600
        });
      } catch (_) {
        // signed URL generation failed; client will handle null
      }
    }
    return res.json({ resource: { ...resource, signed_url: accessUrl } });
  } catch (e) {
    return next(e);
  }
}

async function recordResourceViewController(req, res, next) {
  try {
    const { interaction_type = "VIEW" } = req.body || {};
    const result = await recordInteraction(req.user, req.params.id, interaction_type);
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

module.exports = { createResourceController, listResourcesController, getResourceController, recordResourceViewController };

