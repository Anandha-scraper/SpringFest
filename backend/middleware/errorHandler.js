import { ApiError } from "../utils/ApiError.js";

// Express 5 forwards a rejected promise from an async route handler to this
// automatically — no try/catch wrapper needed in every route.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.status).json({ detail: err.detail });
  }
  // Multer rejects an oversized or malformed upload with its own error class
  // rather than an ApiError. Without this it would read as a server fault
  // instead of "your screenshot is too big", which is a user's problem to fix.
  if (err?.name === "MulterError") {
    const detail =
      err.code === "LIMIT_FILE_SIZE"
        ? "screenshot: file is too large (5 MB maximum)"
        : `screenshot: upload rejected (${err.code})`;
    return res.status(400).json({ detail });
  }
  console.error(err);
  res.status(500).json({ detail: "Internal server error" });
}
