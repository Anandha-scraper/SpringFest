/** The API server: builds the Express app and listens.
 *
 * One origin serves both halves of the site in production — `/api/*` is this
 * app, everything else falls through to the SPA build in `frontend/dist`.
 * See routes/index.js for the full API URL layout.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import compression from "compression";
import cors from "cors";
import express from "express";

import { settings } from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { router as apiRouter } from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The SPA's build output. Present in the App Hosting runtime image (the root
// `npm run build` builds it) and after a local `npm --prefix frontend run
// build`; absent in local dev, where Vite serves the frontend on :5173.
// Resolved from this file rather than the CWD, so it holds wherever the
// process was started from.
const clientDir = path.resolve(__dirname, "../frontend/dist");

export const app = express();

// methods left at cors' default (covers every verb these routes use);
// allowedHeaders left unset so it reflects whatever the browser actually
// requested (Authorization, Content-Type, ...) — the practical equivalent
// of FastAPI's allow_headers=["*"] without hardcoding a header list.
//
// In production the SPA and API share an origin, so CORS is unused there;
// this still matters in local dev (frontend :5173 -> backend :8000).
app.use(cors({ origin: settings.CORS_ORIGINS }));
// Several admin endpoints return large JSON (full registration/participant
// lists) — compress anything worth compressing rather than shipping it raw.
app.use(compression({ threshold: 500 }));
// Multipart routes mount their own parser (middleware/upload.js), so this
// keeps handling every other endpoint untouched.
app.use(express.json());

app.use("/api", apiRouter);

if (existsSync(clientDir)) {
  // Serve the built SPA from the same origin as the API.
  app.use(express.static(clientDir));
  // Client-side routing: any non-API GET that didn't match a static file
  // gets index.html. A plain middleware, not `app.get("*")` — Express 5's
  // path-to-regexp rejects a bare "*" pattern. Unknown /api/* paths fall
  // through to the normal 404.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDir, "index.html"));
  });
} else {
  // No build present (local dev): keep a friendly root response.
  app.get("/", (req, res) => res.json({ status: "ok" }));
}

// Must be registered last — Express 5 forwards a rejected promise from any
// async route handler above straight here, which is why no route in this
// codebase needs a try/catch.
app.use(errorHandler);

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`backend -> http://localhost:${port}`);
});
