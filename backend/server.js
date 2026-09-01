/** The API server: builds the Express app and listens.
 *
 * This is the API and nothing else. It used to serve the built Vite SPA from
 * `frontend/dist` as well, so one origin covered both halves of the site; the
 * frontend is a Next.js app on its own App Hosting backend now, and it owns
 * serving its own assets — including the immutable caching for content-hashed
 * bundles that the static block here used to set up by hand. Requests reach
 * this server through that app's /api proxy — see web/app/api/[...path]/route.js.
 *
 * See routes/index.js for the full API URL layout.
 */
import compression from "compression";
import cors from "cors";
import express from "express";

import { settings } from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { router as apiRouter } from "./routes/index.js";

export const app = express();

// Needed for middleware/rateLimit.js's req.ip to mean the actual visitor,
// not the address of whatever sits in front of this container. Requests
// only ever arrive here via web/app/api/[...path]/route.js's server-side
// fetch, which itself sits behind App Hosting's own load balancer — so by
// the time a request reaches Express, X-Forwarded-For already has at least
// the browser's IP on it, appended to by each hop since. `1` trusts exactly
// the nearest hop (this backend's own Cloud Run ingress) and reads the
// address just before it. If the real topology ever adds another hop
// between the two backends, this number is the one thing to revisit — a
// wrong count doesn't create a security hole (the venue code's real defense
// is its keyspace, not request volume; see rateLimit.js's header), it just
// makes the throttle key on the wrong address.
app.set("trust proxy", 1);

// methods left at cors' default (covers every verb these routes use);
// allowedHeaders left unset so it reflects whatever the browser actually
// requested (Authorization, Content-Type, ...) — the practical equivalent
// of FastAPI's allow_headers=["*"] without hardcoding a header list.
//
// The Next.js app calls this server from its own server side, so in production
// a browser never reaches this origin directly and CORS is unused there. It
// still matters in local dev, where Next forwards from :5173.
app.use(cors({ origin: settings.CORS_ORIGINS }));
// Several admin endpoints return large JSON (full registration/participant
// lists) — compress anything worth compressing rather than shipping it raw.
//
// The filter exists for one route: compression buffers, and buffering a
// text/event-stream response means the client receives nothing until the
// stream ends — which for SSE is never. It fails silently and looks like the
// feature simply doesn't work, so the exclusion is explicit rather than
// relying on the Cache-Control: no-transform the endpoint also sets.
app.use(
  compression({
    threshold: 500,
    filter: (req, res) =>
      res.getHeader("Content-Type") !== "text/event-stream" && compression.filter(req, res),
  })
);
// Multipart routes mount their own parser (middleware/upload.js), so this
// keeps handling every other endpoint untouched.
app.use(express.json());

app.use("/api", apiRouter);

// Nothing outside /api is this server's business any more. A bare / is kept as
// a liveness answer for App Hosting's own health checks, which hit the root.
app.get("/", (req, res) => res.json({ status: "ok" }));

// Must be registered last — Express 5 forwards a rejected promise from any
// async route handler above straight here, which is why no route in this
// codebase needs a try/catch.
app.use(errorHandler);

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`backend -> http://localhost:${port}`);
});
