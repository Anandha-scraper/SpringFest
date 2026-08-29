#!/usr/bin/env node
/** Populate Firestore with the fest's venues, events and staff.
 *
 * Safe to re-run: every write is keyed by a deterministic document id, so a
 * second run updates rather than duplicates.
 *
 *     npm run seed                          # venues, events, roles
 *     npm run seed -- --registrations 120   # + sample registrations
 *     npm run seed -- --wipe-registrations  # clear the samples again
 *     npm run seed -- --flush               # empty every collection
 *     npm run seed -- --admin               # confirm who has admin access (no writes — see below)
 *
 * The --registrations flag exists so the admin aggregates (per-person
 * rollups, revenue, check-in counts) can be exercised without paying through
 * Razorpay a hundred times. It is deterministic — the same run produces the
 * same numbers, so a screenshot taken today still matches tomorrow.
 *
 * --admin is a read-only check, not a seed step: admin access comes from
 * ADMIN_EMAILS in .env alone (see services/roles.js), resolved before any
 * Firestore read, so it needs nothing written here — it works identically on
 * an empty database and a fully seeded one.
 */
import { settings } from "../src/config.js";
import { getDb } from "../src/services/firebase.js";
import { normalizeEmail } from "../src/services/roles.js";

const NOW = new Date().toISOString();

const VENUES = [
  ["audi", "Main Auditorium"],
  ["cse-lab-1", "CSE Lab 1"],
  ["cse-lab-2", "CSE Lab 2"],
  ["cse-lab-3", "CSE Lab 3"],
  ["seminar-hall-a", "Seminar Hall A"],
  ["seminar-hall-b", "Seminar Hall B"],
  ["open-air", "Open Air Theatre"],
  ["classroom-101", "Classroom 101"],
];

// One venue per event — the API enforces it on write, and the seed respects it.
const EVENTS = [
  { id: "paper-presentation", name: "Paper Presentation", category: "Technical", venue_id: "seminar-hall-a",
    date: "2026-03-14", start_time: "10:00", end_time: "13:00", fee: 200,
    description: "Present original research to a panel of faculty and industry judges." },
  { id: "code-sprint", name: "Code Sprint", category: "Technical", venue_id: "cse-lab-1",
    date: "2026-03-14", start_time: "10:00", end_time: "16:00", fee: 150,
    description: "Timed competitive programming across three rounds." },
  { id: "circuit-debug", name: "Circuit Debugging", category: "Technical", venue_id: "cse-lab-2",
    date: "2026-03-15", start_time: "09:30", end_time: "12:30", fee: 100,
    description: "Find and fix the faults before the clock runs out." },
  { id: "quiz-mania", name: "Quiz Mania", category: "Non-Technical", venue_id: "seminar-hall-b",
    date: "2026-03-15", start_time: "14:00", end_time: "16:00", fee: 0,
    is_team_event: true, team_min: 2, team_max: 2,
    description: "General knowledge and pop culture, in teams of two." },
  { id: "photography", name: "Photo Story", category: "Non-Technical", venue_id: "open-air",
    date: "2026-03-14", start_time: "09:00", end_time: "17:00", fee: 50,
    description: "Tell a story in five frames, shot on campus during the fest." },
  { id: "hackathon-24h", name: "Codeathon 24", category: "Hackathon", venue_id: "cse-lab-3",
    date: "2026-03-14", start_time: "18:00", end_time: "23:59", fee: 500,
    is_team_event: true, team_min: 2, team_max: 4,
    description: "A 24-hour build sprint. Teams of up to four, ship by sunrise." },
  { id: "ai-workshop", name: "Applied AI Workshop", category: "Workshop", venue_id: "audi",
    date: "2026-03-15", start_time: "10:00", end_time: "13:00", fee: 300,
    description: "Hands-on session on building with modern model APIs." },
  { id: "iot-workshop", name: "IoT Starter Workshop", category: "Workshop", venue_id: "classroom-101",
    date: "2026-03-16", start_time: "10:00", end_time: "13:30", fee: 250,
    description: "Wire up sensors and stream readings to a dashboard." },
];

const PEOPLE = [
  { email: "judge.one@example.edu", name: "Dr. Priya Raman", role: "judge", event_ids: ["paper-presentation"] },
  { email: "judge.two@example.edu", name: "Prof. Arun Kumar", role: "judge", event_ids: ["code-sprint", "circuit-debug"] },
  { email: "judge.three@example.edu", name: "Dr. Meera Nair", role: "judge", event_ids: [] },
  { email: "vol.one@example.edu", name: "Karthik S", role: "volunteer", venue_id: "cse-lab-1" },
  { email: "vol.two@example.edu", name: "Divya R", role: "volunteer", venue_id: "seminar-hall-a" },
  { email: "vol.three@example.edu", name: "Nikhil P", role: "volunteer", venue_id: "open-air" },
  { email: "vol.four@example.edu", name: "Anjali M", role: "volunteer", venue_id: "" },
];

async function seedVenues(db) {
  for (const [venueId, name] of VENUES) {
    await db.collection("venues").doc(venueId).set({ name, created_at: NOW }, { merge: true });
  }
  console.log(`venues:  ${VENUES.length}`);
}

async function seedEvents(db) {
  for (const event of EVENTS) {
    const { id, ...rest } = event;
    const data = { is_team_event: false, team_min: 1, team_max: 1, created_at: NOW, updated_at: NOW, ...rest };
    await db.collection("events").doc(id).set(data, { merge: true });
  }
  console.log(`events:  ${EVENTS.length}`);
}

async function seedRoles(db) {
  for (const person of PEOPLE) {
    const key = normalizeEmail(person.email);
    await db.collection("roles").doc(key).set(
      {
        role: person.role,
        name: person.name,
        event_ids: person.event_ids || [],
        venue_id: person.venue_id || "",
        added_by: "seed.js",
        created_at: NOW,
        updated_at: NOW,
      },
      { merge: true }
    );
  }
  console.log(`roles:   ${PEOPLE.length}`);
}

// ── Sample registrations ─────────────────────────────────────

const COLLEGES = ["KSRCE", "PSG Tech", "CIT Coimbatore", "Anna University", "SSN College"];
const FIRST = ["Aditya", "Sneha", "Rahul", "Isha", "Vikram", "Lakshmi", "Rohit", "Nandini",
  "Sanjay", "Pooja", "Arjun", "Kavya", "Manoj", "Deepa", "Surya", "Ritu"];
const LAST = ["Sharma", "Iyer", "Reddy", "Menon", "Gupta", "Pillai", "Krishnan", "Das"];
const TEAM_NAMES = ["Team Nova", "Team Falcon", "Team Vertex", "Team Orbit", "Team Photon",
  "Team Cipher", "Team Quantum", "Team Nimbus", "Team Vortex", "Team Ember"];
const METHODS = ["upi", "card", "netbanking", "wallet"];

/** A deterministic fake participant. The pool is deliberately smaller than
 * the registration count, so some people register for several events —
 * which is exactly what the per-person admin view has to handle. */
function person(n) {
  const first = FIRST[n % FIRST.length];
  const last = LAST[Math.floor(n / FIRST.length) % LAST.length];
  const college = COLLEGES[n % COLLEGES.length];
  const slug = college.toLowerCase().replace(/\s+/g, "");
  return {
    uid: `seed-uid-${String(n).padStart(3, "0")}`,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${n}@${slug}.edu`,
    phone: String(9800000000 + n * 137).slice(0, 10),
    college,
  };
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

async function seedRegistrations(db, count) {
  const peoplePool = Math.floor((FIRST.length * LAST.length) / 4); // 32 distinct people
  const base = new Date(Date.UTC(2026, 1, 10, 9, 0));
  let batch = db.batch();
  let written = 0;

  for (let n = 0; n < count; n++) {
    // Person cycles every `peoplePool`; the event index is offset by which
    // lap we're on, so a repeat visitor always lands on a *different* event.
    // Anything simpler (event = n % 8) would hand the same person the same
    // event twice, which the API's duplicate guard rightly rejects.
    const p = person(n % peoplePool);
    const event = EVENTS[(Math.floor(n / peoplePool) + n) % EVENTS.length];
    // ~5 in 7 pay successfully; the rest are abandoned or failed checkouts.
    const bucket = n % 7;
    const status = bucket < 5 ? "completed" : bucket === 5 ? "failed" : "pending";
    const paid = status === "completed" && event.fee > 0;
    const created = new Date(base.getTime() + (n % 18) * 86400000 + ((n * 37) % 600) * 60000);

    let members = [];
    if (event.is_team_event) {
      const size = event.team_min + (n % (event.team_max - event.team_min + 1));
      members = Array.from({ length: size - 1 }, (_, i) => {
        const { uid, ...rest } = person((n + i + 1) % peoplePool);
        return rest;
      });
    }

    const doc = {
      ...p,
      user_email: p.email,
      event_id: event.id,
      fee: event.fee,
      status,
      checked_in: status === "completed" && n % 3 !== 0,
      team_name: members.length ? TEAM_NAMES[n % TEAM_NAMES.length] : "",
      members,
      team_size: 1 + members.length,
      created_at: created.toISOString(),
      order_id: event.fee > 0 ? `order_seed${pad4(n)}` : "",
      payment_id: paid ? `pay_seed${pad4(n)}` : "",
      payment_method: paid ? METHODS[n % METHODS.length] : "",
      paid_at: paid ? new Date(created.getTime() + 2 * 60000).toISOString() : "",
    };
    if (doc.checked_in) {
      doc.checked_in_at = new Date(created.getTime() + 20 * 86400000).toISOString();
      doc.checked_in_by = "vol.one@example.edu";
    }

    batch.set(db.collection("registrations").doc(`seed-${pad4(n)}`), doc);
    written++;
    // Firestore caps a batch at 500 writes.
    if (written % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  await batch.commit();
  console.log(`registrations: ${count} sample rows (ids seed-0000…)`);
}

async function deleteAll(db, collection) {
  const snap = await db.collection(collection).get();
  let batch = db.batch();
  let pending = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    pending++;
    if (pending % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (pending % 400 !== 0) await batch.commit();
  return snap.docs.length;
}

/** Empty every collection: registrations, events, venues and roles.
 *
 * Admin access is unaffected — the organiser accounts in ADMIN_EMAILS live
 * in backend/.env and were never Firestore documents, so there is always a
 * way back in after a flush. Judges and volunteers ARE stored in `roles` and
 * do get removed; re-run the seed or re-add them from the Add Roles page. */
async function flush(db) {
  for (const collection of ["registrations", "events", "venues", "roles"]) {
    console.log(`${(collection + ":").padEnd(16)} removed ${await deleteAll(db, collection)}`);
  }
}

async function wipeRegistrations(db) {
  // Batched: deleting a few hundred docs one round trip at a time takes
  // minutes, a batch takes seconds.
  const snap = await db.collection("registrations").get();
  const docs = snap.docs.filter((d) => d.id.startsWith("seed-"));
  let batch = db.batch();
  let pending = 0;
  for (const doc of docs) {
    batch.delete(doc.ref);
    pending++;
    if (pending % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (pending % 400 !== 0) await batch.commit();
  console.log(`removed ${docs.length} sample registrations`);
}

/** Admin access needs no Firestore write at all — resolveRoleAndAssignments
 * (services/roles.js) checks ADMIN_EMAILS before ever reading Firestore, so
 * an email listed there is admin on an empty database, same as a fully
 * seeded one. This is a confirmation check, not a seed step — there is
 * nothing to write. */
function checkAdmin() {
  if (!settings.ADMIN_EMAILS.size) {
    console.log("ADMIN_EMAILS is empty in backend/.env — no one has admin access. Set it and re-run.");
    return;
  }
  console.log("Admin access (via ADMIN_EMAILS, no Firestore write needed):");
  for (const email of settings.ADMIN_EMAILS) console.log(`  ${email}`);
  console.log("Each can sign in and add venues/events/roles from the admin UI right now, seeded or not.");
}

async function main() {
  const args = process.argv.slice(2);
  const registrationsIdx = args.indexOf("--registrations");
  const registrations = registrationsIdx >= 0 ? Number(args[registrationsIdx + 1]) : 0;
  const wipeRegistrationsFlag = args.includes("--wipe-registrations");
  const flushFlag = args.includes("--flush");
  const adminFlag = args.includes("--admin");

  if (adminFlag) {
    checkAdmin();
    return;
  }

  const db = getDb();
  if (flushFlag) {
    await flush(db);
    return;
  }
  if (wipeRegistrationsFlag) {
    await wipeRegistrations(db);
    return;
  }

  await seedVenues(db);
  await seedEvents(db);
  await seedRoles(db);
  if (registrations) await seedRegistrations(db, registrations);
  console.log("done.");
}

await main();
process.exit(0);
