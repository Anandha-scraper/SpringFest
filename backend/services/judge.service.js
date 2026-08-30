/** The judging phase — everything `GET/POST/PUT/DELETE /api/judge/*` does.
 *
 * A judge sees the teams that have been event-checked-in for an event they're
 * assigned to, opens each team's submission, and scores it against the event's
 * `marking_criteria`. Scores live as an `evaluations[]` array on the
 * registration doc — one entry per judge, upserted in a transaction so two
 * judges submitting at once can't clobber each other. `evaluated_at` (which the
 * admin rollups already read) is stamped on the first entry and cleared only
 * when the last is removed.
 *
 * The "now evaluating / up next" queue is two advisory fields on the event doc
 * (`judging_current`, `judging_order`), shared per event, editable by the
 * event's judges only.
 *
 * Live reads throughout (not aggregate.loadAll's 20s cache) — a judge must see
 * a check-in that happened seconds ago. Every write invalidates the cache so
 * the admin rollups catch up.
 */
import { getDb } from "../config/firebase.js";
import { ApiError } from "../utils/ApiError.js";
import { STATUS_COMPLETED } from "../utils/statuses.js";
import { optionalString, parseEvaluationScores } from "../utils/validate.js";
import * as aggregate from "./aggregate.js";
import { everEventCheckedIn } from "./checkin.service.js";
import { ticketHolders } from "./qr.js";

function assertJudgeForEvent(user, eventId) {
  if (user.is_admin) return;
  if (!(user.event_ids || []).includes(eventId)) {
    throw new ApiError(403, "You're not assigned to judge this event.");
  }
}

async function loadEvent(eventId) {
  const doc = await getDb().collection("events").doc(eventId).get();
  if (!doc.exists) throw new ApiError(404, "Event not found");
  return { id: doc.id, ...(doc.data() ?? {}) };
}

const criteriaOf = (event) => (Array.isArray(event.marking_criteria) ? event.marking_criteria : []);
const criteriaTotal = (event) => criteriaOf(event).reduce((s, c) => s + (c.max || 0), 0);

async function eventRegistrations(eventId) {
  const snap = await getDb().collection("registrations").where("event_id", "==", eventId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));
}

/** A team as the judge's list wants it. */
function participantView(row, event, judgeEmail) {
  const holders = ticketHolders(row).map((h, i) => {
    const entry = (row.member_checkins || []).find((c) => c.member_index === i);
    return {
      member_index: i,
      name: h.name || "",
      allocation_code: (row.allocation_codes || [])[i] || "",
      checked_in: Boolean(entry) && !entry.checked_out_at,
      ever_checked_in: Boolean(entry),
    };
  });
  const evaluations = (row.evaluations || []).map((e) => ({
    judge_email: e.judge_email,
    judge_name: e.judge_name || e.judge_email,
    total: e.total || 0,
    note: e.note || "",
    at: e.at || "",
    updated_at: e.updated_at || "",
  }));
  const myEntry = (row.evaluations || []).find((e) => e.judge_email === judgeEmail);

  return {
    registration_id: row.id,
    team_name: row.team_name || "",
    lead_name: row.name || "",
    is_team_event: Boolean(row.team_name) || (row.members || []).length > 0,
    holders,
    submission: {
      has: Boolean(row.submission_path),
      filename: row.submission_filename || "",
      uploaded_at: row.submission_uploaded_at || "",
      // Always the team lead's registration id — that's the upload key.
      registration_id: row.id,
    },
    my_evaluation: myEntry
      ? { scores: myEntry.scores || [], note: myEntry.note || "", total: myEntry.total || 0 }
      : null,
    other_evaluations: evaluations.filter((e) => e.judge_email !== judgeEmail),
  };
}

// ── Reads ────────────────────────────────────────────────────

export async function assignedEvents(user) {
  const db = getDb();
  const eventsSnap = await db.collection("events").get();
  let events = eventsSnap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));
  if (!user.is_admin) {
    const mine = new Set(user.event_ids || []);
    events = events.filter((e) => mine.has(e.id));
  }

  const regsSnap = await db.collection("registrations").get();
  const regs = regsSnap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));

  return events
    .map((event) => {
      const mine = regs.filter((r) => r.event_id === event.id);
      const completed = mine.filter((r) => r.status === STATUS_COMPLETED);
      const checkedIn = completed.filter(everEventCheckedIn);
      return {
        event_id: event.id,
        name: event.name || event.id,
        category: event.category || "",
        venue_id: event.venue_id || "",
        date: event.date || "",
        start_time: event.start_time || "",
        end_time: event.end_time || "",
        marking_criteria: criteriaOf(event),
        criteria_total: criteriaTotal(event),
        registrations: completed.length,
        checked_in: checkedIn.length,
        evaluated_by_me: checkedIn.filter((r) =>
          (r.evaluations || []).some((e) => e.judge_email === user.email)
        ).length,
        judging_current: event.judging_current || "",
      };
    })
    .sort(
      (a, b) =>
        (a.date || "").localeCompare(b.date || "") ||
        (a.start_time || "").localeCompare(b.start_time || "") ||
        a.name.localeCompare(b.name)
    );
}

export async function eventParticipants({ user, eventId }) {
  assertJudgeForEvent(user, eventId);
  const event = await loadEvent(eventId);
  const regs = await eventRegistrations(eventId);

  const participants = regs
    .filter((r) => r.status === STATUS_COMPLETED && everEventCheckedIn(r))
    .map((r) => participantView(r, event, user.email))
    .sort((a, b) => (a.team_name || a.lead_name).localeCompare(b.team_name || b.lead_name));

  return {
    event: {
      event_id: event.id,
      name: event.name || event.id,
      marking_criteria: criteriaOf(event),
      criteria_total: criteriaTotal(event),
    },
    participants,
  };
}

// ── Scoring ──────────────────────────────────────────────────

export async function saveEvaluation({ user, eventId, registrationId, scores, note }) {
  assertJudgeForEvent(user, eventId);
  const event = await loadEvent(eventId);
  const criteria = criteriaOf(event);
  const cleanNote = optionalString(note).trim().slice(0, 2000);
  const { scores: normalized, total } = parseEvaluationScores(scores, criteria);

  const db = getDb();
  const ref = db.collection("registrations").doc(registrationId);
  const now = new Date().toISOString();

  const saved = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new ApiError(404, "Registration not found");
    const row = doc.data() ?? {};
    if ((row.event_id || "") !== eventId) throw new ApiError(400, "That team isn't in this event");
    if (row.status !== STATUS_COMPLETED) throw new ApiError(409, "That registration isn't confirmed");
    if (!everEventCheckedIn(row)) throw new ApiError(409, "That team hasn't been checked in yet");

    const evaluations = [...(row.evaluations || [])];
    const idx = evaluations.findIndex((e) => e.judge_email === user.email);
    const entry = {
      judge_email: user.email,
      judge_name: user.name || user.email,
      scores: normalized,
      total,
      note: cleanNote,
      at: idx >= 0 ? evaluations[idx].at || now : now,
      updated_at: now,
    };
    if (idx >= 0) evaluations[idx] = entry;
    else evaluations.push(entry);

    const patch = { evaluations };
    if (!row.evaluated_at) patch.evaluated_at = now;
    tx.set(ref, patch, { merge: true });
    return entry;
  });

  aggregate.invalidateLoadAll();
  return { registration_id: registrationId, evaluation: saved };
}

export async function deleteEvaluation({ user, eventId, registrationId }) {
  assertJudgeForEvent(user, eventId);

  const db = getDb();
  const ref = db.collection("registrations").doc(registrationId);

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new ApiError(404, "Registration not found");
    const row = doc.data() ?? {};
    if ((row.event_id || "") !== eventId) throw new ApiError(400, "That team isn't in this event");

    const evaluations = (row.evaluations || []).filter((e) => e.judge_email !== user.email);
    const patch = { evaluations };
    if (evaluations.length === 0 && row.evaluated_at) {
      patch.evaluated_at = "";
    }
    tx.set(ref, patch, { merge: true });
  });

  aggregate.invalidateLoadAll();
  return { registration_id: registrationId, removed: true };
}

// ── Queue ────────────────────────────────────────────────────

function resolveQueue(event, regById) {
  const one = (id) => {
    const r = regById.get(id);
    if (!r || r.status !== STATUS_COMPLETED || !everEventCheckedIn(r)) return null;
    return { registration_id: id, team_name: r.team_name || "", lead_name: r.name || "" };
  };
  return {
    current: event.judging_current ? one(event.judging_current) : null,
    upcoming: (event.judging_order || []).map(one).filter(Boolean),
  };
}

export async function getQueue({ user, eventId }) {
  assertJudgeForEvent(user, eventId);
  const event = await loadEvent(eventId);
  const regs = await eventRegistrations(eventId);
  const regById = new Map(regs.map((r) => [r.id, r]));
  return { event_id: eventId, ...resolveQueue(event, regById) };
}

export async function setQueue({ user, eventId, current, upcoming }) {
  assertJudgeForEvent(user, eventId);
  const event = await loadEvent(eventId);
  const regs = await eventRegistrations(eventId);
  const eligible = new Set(
    regs.filter((r) => r.status === STATUS_COMPLETED && everEventCheckedIn(r)).map((r) => r.id)
  );

  const cur = current && eligible.has(current) ? current : "";
  const order = Array.isArray(upcoming) ? [...new Set(upcoming.filter((id) => eligible.has(id)))] : [];

  await getDb().collection("events").doc(eventId).set(
    {
      judging_current: cur,
      judging_order: order,
      judging_updated_at: new Date().toISOString(),
      judging_updated_by: user.email,
    },
    { merge: true }
  );
  aggregate.invalidateLoadAll();

  const regById = new Map(regs.map((r) => [r.id, r]));
  return {
    event_id: eventId,
    ...resolveQueue({ ...event, judging_current: cur, judging_order: order }, regById),
  };
}
