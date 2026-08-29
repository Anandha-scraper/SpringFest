/** Mirrors FastAPI's HTTPException(status, detail) — every error response
 * on the wire is `{"detail": "<message>"}`, which client.js on the frontend
 * reads verbatim. That shape must never drift. */
export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

// Express 5 forwards a rejected promise from an async route handler to this
// automatically — no try/catch wrapper needed in every route.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.status).json({ detail: err.detail });
  }
  console.error(err);
  res.status(500).json({ detail: "Internal server error" });
}
