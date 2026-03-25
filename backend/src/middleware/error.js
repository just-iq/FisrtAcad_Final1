function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const code = err.code || (status === 500 ? "INTERNAL_ERROR" : "BAD_REQUEST");
  const message = err.message || "Unexpected error";

  // eslint-disable-next-line no-console
  console.error(`[${req.requestId}]`, err);

  res.status(status).json({ error: { code, message, requestId: req.requestId } });
}

module.exports = { errorHandler, notFoundHandler };

