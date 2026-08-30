/**
 * One-off data reset. Wipes every fest collection and the payment/submission
 * storage objects, keeping only admin role records (and the ADMIN_EMAILS env,
 * which lives outside Firestore and is never touched).
 *
 *   node scripts/flush.js          # dry run — prints the target and exits
 *   node scripts/flush.js --yes    # actually deletes
 *
 * Hits exactly the database and bucket the app uses: it reads the same
 * backend/.env (FIRESTORE_DATABASE_ID, STORAGE_BUCKET) through src/config.js.
 * Irreversible.
 */
import { settings } from "../src/config.js";
import { getDb, getStorage } from "../src/services/firebase.js";

const CONFIRM = process.argv.includes("--yes");
const FULL_WIPE_COLLECTIONS = ["events", "registrations", "venues"];
const STORAGE_PREFIXES = ["payment-proofs/", "payment-qr/", "submissions/"];

async function deleteQuery(query, label) {
  let removed = 0;
  // Firestore caps a batch at 500 writes; 400 leaves headroom.
  for (;;) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = getDb().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    removed += snap.size;
    if (snap.size < 400) break;
  }
  console.log(`  ${label}: ${removed} deleted`);
  return removed;
}

async function flushFirestore() {
  const db = getDb();
  for (const name of FULL_WIPE_COLLECTIONS) {
    await deleteQuery(db.collection(name), name);
  }

  // roles: keep admins, drop everyone else.
  const roles = await db.collection("roles").get();
  let keptAdmins = 0;
  let batch = db.batch();
  let pending = 0;
  for (const doc of roles.docs) {
    if ((doc.data()?.role ?? "") === "admin") {
      keptAdmins += 1;
      continue;
    }
    batch.delete(doc.ref);
    if (++pending === 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();
  console.log(`  roles: ${roles.size - keptAdmins} deleted, ${keptAdmins} admin(s) kept`);

  // settings/app: removing it makes getAppSettings() fall back to DEFAULTS
  // (gateway mode, registration open, no UPI/QR, unlocked) — the fresh state.
  await db.collection("settings").doc("app").delete();
  console.log("  settings/app: reset to defaults");
}

async function flushStorage() {
  if (!settings.STORAGE_BUCKET) {
    console.log("  (STORAGE_BUCKET not set — skipping storage)");
    return;
  }
  const bucket = getStorage().bucket(settings.STORAGE_BUCKET);
  for (const prefix of STORAGE_PREFIXES) {
    await bucket.deleteFiles({ prefix, force: true });
    console.log(`  ${prefix}*: cleared`);
  }
}

async function main() {
  console.log("Flush target:");
  console.log(`  database : ${settings.FIRESTORE_DATABASE_ID}`);
  console.log(`  bucket   : ${settings.STORAGE_BUCKET || "(none)"}`);
  console.log(`  admins   : ${[...settings.ADMIN_EMAILS].join(", ") || "(none in ADMIN_EMAILS)"}`);

  if (!CONFIRM) {
    console.log("\nDry run — nothing deleted. Re-run with --yes to wipe.");
    return;
  }

  console.log("\nWiping Firestore…");
  await flushFirestore();
  console.log("Wiping Cloud Storage…");
  await flushStorage();
  console.log("\nDone. Admins keep access; everything else is gone.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("Flush failed:", err.message);
    process.exit(1);
  },
);
