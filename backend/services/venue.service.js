/** Venues — the rooms events are held in. One venue backs at most one event;
 * that rule is enforced on the event side (event.service.js), and mirrored
 * here so a venue can't be deleted out from under a live event. */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { slugify } from "../utils/slugify.js";
import { requireString } from "../utils/validate.js";
import * as aggregate from "./aggregate.js";
import { invalidateVenueNames } from "./event.service.js";

export async function listVenues() {
  const snap = await getDb().collection("venues").get();
  const rows = snap.docs.map((d) => ({
    id: d.id,
    name: d.data()?.name || "",
    created_at: d.data()?.created_at || "",
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export async function createVenue(body) {
  const name = requireString(body.name, { field: "name", minLength: 2 });
  const venueId = slugify(name);
  if (!venueId) throw new ApiError(400, "Venue name must contain letters or numbers");

  const ref = getDb().collection("venues").doc(venueId);
  if ((await ref.get()).exists) throw new ApiError(409, "A venue with that name already exists");

  const data = { name: name.trim(), created_at: new Date().toISOString() };
  await ref.set(data);
  invalidateVenueNames();
  aggregate.invalidateLoadAll();
  return { id: venueId, ...data };
}

export async function deleteVenue(venueId) {
  const db = getDb();
  const ref = db.collection("venues").doc(venueId);
  if (!(await ref.get()).exists) throw new ApiError(404, "Venue not found");

  // An event pointing at a deleted venue would render as "Unassigned" with no
  // trace of what happened, so the event has to be moved first.
  const holderSnap = await db
    .collection("events")
    .where("venue_id", "==", venueId)
    .limit(1)
    .get();
  if (!holderSnap.empty) {
    const holder = holderSnap.docs[0];
    throw new ApiError(
      409,
      `"${holder.data()?.name || holder.id}" is held at this venue — reassign it first`
    );
  }

  await ref.delete();
  invalidateVenueNames();
  aggregate.invalidateLoadAll();
}
