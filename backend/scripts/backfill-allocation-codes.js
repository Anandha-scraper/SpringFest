/**
 * Backfill allocation codes for data that predates the feature.
 *
 *   node scripts/backfill-allocation-codes.js         # dry run — prints, exits
 *   node scripts/backfill-allocation-codes.js --yes    # writes
 *
 * Two phases:
 *   1. Assign `allocation_letter` to every event that lacks one, per category,
 *      ordered by (created_at, id) — so A/B/C match creation order.
 *   2. Walk every `completed` registration oldest-first and mint its codes via
 *      the production `mintAllocationCodes()`, which builds `counters/{eventId}`
 *      monotonically in registration order.
 *
 * Re-runnable: phase 1 skips lettered events, phase 2's mint is idempotent.
 * Reads the same backend/.env (FIRESTORE_DATABASE_ID) as the app.
 */
import { settings } from "../config/index.js";
import { getDb } from "../config/firebase.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import {
  CATEGORY_LETTER,
  mintAllocationCodes,
  toLetter,
} from "../services/allocation.service.js";

const CONFIRM = process.argv.includes("--yes");

/** Events grouped by category, each group sorted (created_at, id). */
async function eventsByCategory(db) {
  const snap = await db.collection("events").get();
  const groups = {};
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const cat = data.category || "";
    (groups[cat] ||= []).push({ id: doc.id, ...data });
  }
  for (const list of Object.values(groups)) {
    list.sort(
      (a, b) => (a.created_at || "").localeCompare(b.created_at || "") || a.id.localeCompare(b.id)
    );
  }
  return groups;
}

async function planEventLetters(db) {
  const groups = await eventsByCategory(db);
  const assignments = []; // { id, category, letter }
  for (const [category, list] of Object.entries(groups)) {
    if (!CATEGORY_LETTER[category]) {
      console.log(`  ! skipping category "${category}" — no allocation letter mapped`);
      continue;
    }
    let assigned = list.filter((e) => e.allocation_letter).length;
    for (const event of list) {
      if (event.allocation_letter) continue;
      assignments.push({ id: event.id, category, letter: toLetter(assigned) });
      assigned += 1;
    }
  }
  return assignments;
}

async function completedRegistrationsOldestFirst(db) {
  const snap = await db.collection("registrations").where("status", "==", STATUS_COMPLETED).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .sort(
      (a, b) => (a.created_at || "").localeCompare(b.created_at || "") || a.id.localeCompare(b.id)
    );
}

async function main() {
  const db = getDb();
  console.log(`Backfill target database: ${settings.FIRESTORE_DATABASE_ID}\n`);

  const letterPlan = await planEventLetters(db);
  const regs = await completedRegistrationsOldestFirst(db);
  const needCodes = regs.filter((r) => {
    const holders = 1 + (Array.isArray(r.members) ? r.members.length : 0);
    const have = Array.isArray(r.allocation_codes) ? r.allocation_codes.filter(Boolean).length : 0;
    return have < holders;
  });

  console.log(`Phase 1 — event letters: ${letterPlan.length} to assign`);
  for (const a of letterPlan) console.log(`  ${a.category} / ${a.id} -> ${a.letter}`);
  console.log(`\nPhase 2 — registration codes: ${needCodes.length} of ${regs.length} completed regs missing codes`);

  if (!CONFIRM) {
    console.log("\nDry run — nothing written. Re-run with --yes to apply.");
    return;
  }

  console.log("\nAssigning event letters…");
  // Small collection; one batch is plenty (Firestore caps at 500).
  const batch = db.batch();
  for (const a of letterPlan) {
    batch.set(db.collection("events").doc(a.id), { allocation_letter: a.letter }, { merge: true });
  }
  if (letterPlan.length) await batch.commit();
  console.log(`  ${letterPlan.length} event(s) lettered`);

  console.log("Minting registration codes…");
  let minted = 0;
  for (const reg of needCodes) {
    const codes = await mintAllocationCodes(reg.id);
    if (codes) minted += 1;
    console.log(`  ${reg.id}: ${codes ? codes.join(" ") : "(skipped)"}`);
  }
  console.log(`\nDone. ${minted} registration(s) minted.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("Backfill failed:", err.message);
    process.exit(1);
  }
);
