/**
 * Convert leftover `judge` role documents into `volunteer` documents.
 *
 *   node scripts/judges-to-volunteers.js          # dry run — prints, exits
 *   node scripts/judges-to-volunteers.js --yes    # writes
 *
 * The judge role was folded into volunteer: whoever staffs a venue now both
 * checks people in and scores them. Judges were assigned a list of *events*
 * (`event_ids`); volunteers are assigned a single *venue* (`venue_id`). This
 * script bridges that:
 *
 *   role: "judge"  ->  role: "volunteer"
 *   event_ids      ->  venue_id, taken from the first assigned event's venue
 *   event_ids      ->  legacy_event_ids, kept for audit and read by nothing
 *
 * Where the mapping is not unambiguous it REPORTS rather than guesses. A judge
 * assigned two events cannot become one volunteer covering two rooms, and
 * picking one silently would quietly strip them of the other. Those rows are
 * still converted to `volunteer` (so they aren't left holding a role the app no
 * longer honours — auth/roles.js now reads an unknown role as `participant`),
 * but their `venue_id` is left for an admin to set in Manage Roles.
 *
 * Re-runnable: rows already on `volunteer` are skipped. Reads the same
 * backend/.env (FIRESTORE_DATABASE_ID) as the app.
 */
import { getDb } from "../config/firebase.js";
import { COLLECTION } from "../auth/roles.js";

const CONFIRM = process.argv.includes("--yes");

async function loadEvents(db) {
  const snap = await db.collection("events").get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...(d.data() ?? {}) }]));
}

async function loadVenueNames(db) {
  const snap = await db.collection("venues").get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()?.name ?? d.id]));
}

/** What this row should become, plus why an admin might need to look at it. */
function planFor(row, events) {
  const eventIds = Array.isArray(row.event_ids) ? row.event_ids.filter(Boolean) : [];
  const assigned = eventIds.map((id) => events[id]).filter(Boolean);
  const withVenue = assigned.filter((e) => e.venue_id);

  if (eventIds.length === 0) {
    return { venueId: "", note: "no events were assigned — set a venue in Manage Roles" };
  }
  if (assigned.length === 0) {
    return { venueId: "", note: `assigned event(s) no longer exist: ${eventIds.join(", ")}` };
  }
  if (withVenue.length === 0) {
    return { venueId: "", note: `assigned event(s) have no venue: ${assigned.map((e) => e.name || e.id).join(", ")}` };
  }
  if (withVenue.length > 1) {
    const [first, ...rest] = withVenue;
    return {
      venueId: first.venue_id,
      note:
        `covered ${withVenue.length} events — kept "${first.name || first.id}", ` +
        `dropped ${rest.map((e) => `"${e.name || e.id}"`).join(", ")}; reassign if wrong`,
    };
  }
  return { venueId: withVenue[0].venue_id, note: "" };
}

async function main() {
  const db = getDb();
  const [snap, events, venueNames] = await Promise.all([
    db.collection(COLLECTION).get(),
    loadEvents(db),
    loadVenueNames(db),
  ]);

  const judges = snap.docs
    .map((d) => ({ email: d.id, ...(d.data() ?? {}) }))
    .filter((r) => r.role === "judge");

  if (!judges.length) {
    console.log("No `judge` role documents found — nothing to migrate.");
    return;
  }

  const plans = judges.map((row) => ({ row, ...planFor(row, events) }));

  console.log(`${judges.length} judge record(s) to convert:\n`);
  for (const { row, venueId, note } of plans) {
    const where = venueId ? `venue "${venueNames[venueId] || venueId}"` : "NO VENUE";
    console.log(`  ${row.email}  ->  volunteer, ${where}`);
    if (note) console.log(`      ! ${note}`);
  }

  const needsAttention = plans.filter((p) => p.note);
  if (needsAttention.length) {
    console.log(
      `\n${needsAttention.length} record(s) need an admin to finish in Manage Roles (marked ! above).`
    );
  }

  if (!CONFIRM) {
    console.log("\nDry run — nothing written. Re-run with --yes to apply.");
    return;
  }

  console.log("\nWriting…");
  // One batch: the roles collection is tiny (Firestore caps a batch at 500).
  const batch = db.batch();
  for (const { row, venueId } of plans) {
    const payload = {
      role: "volunteer",
      updated_at: new Date().toISOString(),
      // Provenance for anyone reading the doc later wondering where the
      // venue came from. The app never reads either field.
      migrated_from_judge_at: new Date().toISOString(),
      legacy_event_ids: Array.isArray(row.event_ids) ? row.event_ids : [],
    };
    // Don't write an empty venue over one someone already set by hand.
    if (venueId) payload.venue_id = venueId;
    batch.set(db.collection(COLLECTION).doc(row.email), payload, { merge: true });
  }
  await batch.commit();

  console.log(`Done. ${plans.length} record(s) converted to volunteer.`);
  if (needsAttention.length) {
    console.log(`${needsAttention.length} still need a venue assigned — see the ! lines above.`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
);
