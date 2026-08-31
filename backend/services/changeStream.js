/** "Something changed" — the push half of the app.
 *
 * Every screen here is a snapshot taken when it loaded. During the fest that is
 * wrong in an obvious way: a volunteer checks someone in and the admin staring
 * at the attendance list sees nothing until they refresh. This module is what
 * closes that gap, and it is deliberately the smallest thing that can.
 *
 * WHY FIRESTORE LISTENERS AND NOT AN EMIT-ON-WRITE HOOK
 *
 * The obvious design — have each service call `notify()` after it writes — is
 * wrong here, and quietly so. App Hosting runs up to `maxInstances` containers;
 * a check-in handled by instance A would notify only the browsers connected to
 * instance A, and the admin connected to instance B would sit there watching a
 * stale page while everything looked healthy. Firestore's own `onSnapshot`
 * fires on *every* instance regardless of which one did the write, so the
 * database is the fan-out point rather than any one process.
 *
 * WHAT IS ON THE WIRE
 *
 * A resource name and a timestamp. No document data, ever. That is what keeps
 * this endpoint free of authorisation questions: knowing that "registrations
 * changed" tells you nothing you could not learn by refreshing, and clients go
 * and refetch through the same endpoints that already scope data to their role.
 *
 * THE CACHE ORDERING MATTERS
 *
 * `aggregate.loadAll()` caches for 20 seconds. If a nudge went out before that
 * cache were dropped, every client would refetch and be handed the stale copy —
 * the feature would appear to work and deliver nothing. Invalidate, then notify.
 */
import { getDb } from "../config/firebase.js";
import * as aggregate from "./aggregate.js";

/** Collections worth watching, and the resource name each maps to. Anything a
 * dashboard displays; deliberately not `counters` (an implementation detail of
 * allocation codes, written in the same transaction as the registration that
 * triggers it, so it would only ever produce a duplicate nudge). */
const WATCHED = {
  registrations: "registrations",
  events: "events",
  fest_checkins: "registrations", // the door is part of the attendance picture
  venues: "events",
  roles: "people",
  settings: "settings",
};

const subscribers = new Set();
let listeners = null;

function broadcast(resource) {
  // Order matters — see the module header.
  aggregate.invalidateLoadAll();
  const payload = JSON.stringify({ resource, at: new Date().toISOString() });
  for (const send of subscribers) {
    try {
      send(payload);
    } catch {
      // A dead connection is not this loop's problem; the response's own
      // "close" handler unsubscribes it.
    }
  }
}

/** Attach one listener per watched collection.
 *
 * Started lazily on the first subscriber rather than at import: the CLI scripts
 * (flush, backfill, judges-to-volunteers) import these services too, and none of
 * them should open six streaming listeners and then never exit. Once started
 * they stay — during a fest there is always someone connected, and tearing
 * listeners up and down would cost more than it saves. */
function ensureListening() {
  if (listeners) return;
  const db = getDb();
  listeners = Object.entries(WATCHED).map(([collection, resource]) => {
    // onSnapshot delivers the entire current contents immediately. That first
    // one is the state the client already has, so it is skipped — otherwise
    // every boot would broadcast six nudges and every dashboard would refetch
    // for no reason.
    let primed = false;
    return db.collection(collection).onSnapshot(
      () => {
        if (!primed) {
          primed = true;
          return;
        }
        broadcast(resource);
      },
      (err) => {
        // A broken listener must not take the API down with it. The stream
        // degrades to "nothing ever updates", which is exactly where the app
        // was before this existed.
        console.error(`changeStream: ${collection} listener failed:`, err?.message || err);
      }
    );
  });
}

/** Register a sender and get back the function that removes it. */
export function subscribe(send) {
  ensureListening();
  subscribers.add(send);
  return () => subscribers.delete(send);
}

export function subscriberCount() {
  return subscribers.size;
}
