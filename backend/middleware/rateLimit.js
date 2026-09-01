/** A minimal in-process sliding-window rate limiter — same posture as
 * services/cache.js: one process, one Map, no Redis. That is a real
 * trade-off here specifically, not just a style choice: App Hosting can run
 * up to `maxInstances` containers, and each one counts independently, so the
 * true ceiling is this limit times however many instances happen to be
 * live. Fine for what this guards — the venue access code isn't defended by
 * volume alone, it's defended by keyspace (10 chars, 32-letter alphabet,
 * ~2^49 possibilities) — this is a throttle on top of that, not the reason
 * brute-forcing fails.
 *
 * Only meaningful with `app.set("trust proxy", 1)` in server.js. Without it,
 * every request behind App Hosting's load balancer reports the same address
 * and every visitor shares one bucket.
 */
const buckets = new Map();

/** `windowMs`/`max`: at most `max` requests per key per rolling `windowMs`.
 * Returns Express middleware; mount it on the specific routes that need it,
 * not app-wide — this exists for one endpoint class (the public venue
 * routes), not as a general request governor. */
export function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();

    let hits = buckets.get(key);
    if (!hits) {
      hits = [];
      buckets.set(key, hits);
    }
    // Drop anything outside the window before counting — a plain sliding
    // window, not a fixed-bucket reset that lets a burst double up right at
    // the boundary.
    while (hits.length && hits[0] <= now - windowMs) hits.shift();

    if (hits.length >= max) {
      const retryAfterMs = windowMs - (now - hits[0]);
      res.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({ detail: "Too many attempts. Try again in a minute." });
    }

    hits.push(now);
    next();
  };
}
