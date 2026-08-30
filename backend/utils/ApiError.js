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
