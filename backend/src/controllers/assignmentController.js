const { create, list, toggleResubmission, submit, listSubmissions } = require("../services/assignmentService");
const { uploadBuffer, signedGetUrl } = require("../services/storageService");

async function createAssignmentController(req, res, next) {
  try {
    const assignment = await create(req.user, req.body || {});
    return res.status(201).json({ assignment });
  } catch (e) {
    return next(e);
  }
}

async function listAssignmentsController(req, res, next) {
  try {
    const { limit } = req.query || {};
    const assignments = await list(req.user, { limit });
    return res.json({ assignments });
  } catch (e) {
    return next(e);
  }
}

async function toggleResubmissionController(req, res, next) {
  try {
    const { permit_resubmission } = req.body || {};
    const assignment = await toggleResubmission(req.user, req.params.id, permit_resubmission);
    return res.json({ assignment });
  } catch (e) {
    return next(e);
  }
}

async function submitAssignmentController(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "file is required (multipart/form-data)" } });
    }

    const { Key } = await uploadBuffer({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      keyPrefix: `submissions/${req.user.id}/assignment_${req.params.id}`,
      originalName: req.file.originalname
    });

    const submission = await submit(req.user, req.params.id, {
      ...req.body,
      file_key: Key,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size
    });
    return res.status(201).json({ submission });
  } catch (e) {
    return next(e);
  }
}

async function listSubmissionsController(req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    const submissions = await listSubmissions(req.user, req.params.id);
    
    // Generate signed URLs for each submission
    const submissionsWithUrls = await Promise.all(
      submissions.map(async (s) => {
        try {
          // Pass properties for proper mime typing
          const url = await signedGetUrl({ 
            key: s.file_key, 
            mimeType: s.mime_type, 
            expiresInSeconds: 3600 // 1 hour link for marking session
          });
          return { ...s, signed_url: url };
        } catch (err) {
          console.error("DEBUG: Signed URL Gen Error:", err);
          console.error("DEBUG: File info:", { key: s.file_key, mime: s.mime_type });
          return { ...s, signed_url: null, error: "URL generation failed" };
        }
      })
    );
    
    return res.json({ submissions: submissionsWithUrls });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  createAssignmentController,
  listAssignmentsController,
  toggleResubmissionController,
  submitAssignmentController,
  listSubmissionsController
};

