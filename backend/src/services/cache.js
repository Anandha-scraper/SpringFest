/** A minimal in-process TTL cache — same shape as services/cache.py, adapted
 * for async loaders (Firestore reads are async in Node, unlike the sync
 * Python client).
 *
 * One process, one Map, performance.now() for expiry. Not a real caching
 * library on purpose: Redis or similar would be over-engineering for "a few
 * hundred registrations" (see CLAUDE.md). The TTL is a safety net; the
 * primary correctness mechanism is the explicit invalidate() calls wired
 * into every write path.
 *
 * The cached entry holds a Promise, not just a resolved value — two calls
 * that land while the first fetch is still in flight share it instead of
 * both hitting Firestore, which the sync Python version didn't need to
 * worry about but a concurrent Node server does.
 */
const store = new Map();

export async function cached(key, ttlSeconds, loader) {
  const hit = store.get(key);
  const now = performance.now();
  if (hit && hit.expiresAt > now) {
    return hit.promise;
  }

  const promise = Promise.resolve().then(loader);
  store.set(key, { expiresAt: now + ttlSeconds * 1000, promise });
  try {
    return await promise;
  } catch (err) {
    // A failed load shouldn't poison the cache for the TTL window.
    store.delete(key);
    throw err;
  }
}

export function invalidate(key) {
  store.delete(key);
}
