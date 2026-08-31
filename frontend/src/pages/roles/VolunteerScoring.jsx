import { useCallback, useEffect, useMemo, useState } from "react";
import "@/styles/pages/admin/roles.css";
import { FileText, Save, Trash2 } from "lucide-react";
import {
  deleteEvaluation,
  getVolunteerEvents,
  getVolunteerParticipants,
  getVolunteerQueue,
  saveEvaluation,
  volunteerSubmissionObjectUrl,
} from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { useHeldLoading } from "@/hooks/useHeldLoading.js";
import { useToast } from "@/components/ui/toast.jsx";
import Loader from "@/components/common/Loader.jsx";
import JudgingQueueView from "@/components/roles/JudgingQueueView.jsx";

function blankScores(criteria, existing) {
  const from = new Map((existing?.scores || []).map((s) => [s.label, s.value]));
  const out = {};
  for (const c of criteria) out[c.label] = from.has(c.label) ? String(from.get(c.label)) : "";
  return out;
}

function TeamCard({ team, criteria, criteriaTotal, onSaved }) {
  const toast = useToast();
  const [scores, setScores] = useState(() => blankScores(criteria, team.my_evaluation));
  const [note, setNote] = useState(team.my_evaluation?.note || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScores(blankScores(criteria, team.my_evaluation));
    setNote(team.my_evaluation?.note || "");
  }, [team.registration_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const running = criteria.reduce((s, c) => s + (Number(scores[c.label]) || 0), 0);
  const filled = criteria.every((c) => scores[c.label] !== "" && !Number.isNaN(Number(scores[c.label])));

  const openFile = async () => {
    try {
      const url = await volunteerSubmissionObjectUrl(team.registration_id);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.bad(e.message);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveEvaluation(team.eventId, {
        registrationId: team.registration_id,
        scores: criteria.map((c) => ({ label: c.label, value: Number(scores[c.label]) })),
        note,
      });
      toast.ok("Score saved.");
      onSaved();
    } catch (e) {
      toast.bad(e.message);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await deleteEvaluation(team.eventId, team.registration_id);
      toast.ok("Score cleared.");
      onSaved();
    } catch (e) {
      toast.bad(e.message);
    } finally {
      setBusy(false);
    }
  };

  const others = team.other_evaluations || [];

  const scored = Boolean(team.my_evaluation) || others.length > 0;

  return (
    <li
      /* Dimmed once anyone has scored it — a glance-able "done" over a long
         list. Never disabled: re-scoring and corrections must stay possible. */
      className={`admin-panel${scored ? " is-evaluated" : ""}`}
      style={{ padding: "1rem" }}
    >
      <div className="panel-head">
        <h3 style={{ margin: 0 }}>
          {team.team_name || team.lead_name}
          {team.holders?.[0]?.allocation_code && (
            <span className="checkin-row__code" style={{ marginLeft: 8 }}>
              {team.holders.map((h) => h.allocation_code).filter(Boolean).join(", ")}
            </span>
          )}
        </h3>
        {team.submission.has ? (
          <button type="button" className="btn btn-sm btn-ghost" onClick={openFile}>
            <FileText size={15} aria-hidden="true" /> Open submission
          </button>
        ) : (
          <span className="muted">No file uploaded</span>
        )}
      </div>

      <div className="criteria-editor">
        {criteria.map((c) => (
          <label className="criteria-row" key={c.label}>
            <span>
              {c.label} <span className="muted">/ {c.max}</span>
            </span>
            <input
              className="input"
              type="number"
              min="0"
              max={c.max}
              value={scores[c.label]}
              onChange={(e) => setScores((s) => ({ ...s, [c.label]: e.target.value }))}
            />
          </label>
        ))}
        <p className="criteria-total">
          Total <strong>{running}</strong> / {criteriaTotal}
        </p>
      </div>

      <label className="field">
        <span className="field-label">Remark (optional)</span>
        <textarea
          className="input"
          rows={2}
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="criteria-foot">
        <button type="button" className="btn btn-sm" disabled={busy || !filled} onClick={save}>
          <Save size={14} aria-hidden="true" /> {team.my_evaluation ? "Update score" : "Save score"}
        </button>
        {team.my_evaluation && (
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={clear}>
            <Trash2 size={14} aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      {others.length > 0 && (
        <ul className="muted" style={{ marginTop: ".5rem", fontSize: ".85rem" }}>
          {others.map((e) => (
            <li key={e.judge_email}>
              {e.judge_name}: <strong>{e.total}</strong>
              {e.note ? ` — "${e.note}"` : ""}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function VolunteerScoring() {
  const fetcher = useCallback(getVolunteerEvents, []);
  const { data: events, error, loading } = useApi(fetcher);
  const [eventId, setEventId] = useState("");
  const [detail, setDetail] = useState(null);
  const [queue, setQueue] = useState(null);
  const [detailErr, setDetailErr] = useState("");
  const detailLoading = useHeldLoading(!detail && !detailErr);

  useEffect(() => {
    if (events?.length && !eventId) setEventId(events[0].event_id);
  }, [events, eventId]);

  const reloadDetail = useCallback(() => {
    if (!eventId) return;
    setDetailErr("");
    Promise.all([getVolunteerParticipants(eventId), getVolunteerQueue(eventId)])
      .then(([p, q]) => {
        setDetail(p);
        setQueue(q);
      })
      .catch((e) => setDetailErr(e.message));
  }, [eventId]);

  useEffect(() => {
    setDetail(null);
    reloadDetail();
  }, [reloadDetail]);

  const criteria = detail?.event?.marking_criteria || [];
  const teams = useMemo(
    () => (detail?.participants || []).map((t) => ({ ...t, eventId })),
    [detail, eventId]
  );

  if (loading) return <Loader />;
  if (error) return <p className="error">{error}</p>;
  if (!events?.length)
    return (
      <p className="empty-state">
        No event is assigned to you yet — an organiser allocates you a venue in Manage Roles.
      </p>
    );

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>Scoring</h2>
        {events.length > 1 && (
          <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((ev) => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {queue && (
        <div className="notice" style={{ marginBottom: "1rem" }}>
          <JudgingQueueView current={queue.current} upcoming={queue.upcoming} />
        </div>
      )}

      {detailErr && <p className="error">{detailErr}</p>}
      {detailLoading || !detail ? (
        !detailErr && <Loader />
      ) : !criteria.length ? (
        <p className="empty-state">
          This event has no scoring criteria yet — ask an organiser to add them.
        </p>
      ) : teams.length === 0 ? (
        <p className="empty-state">No teams have been checked in for this event yet.</p>
      ) : (
        <ul className="checkin-row-list" style={{ display: "grid", gap: "1rem" }}>
          {teams.map((t) => (
            <TeamCard
              key={t.registration_id}
              team={t}
              criteria={criteria}
              criteriaTotal={detail.event.criteria_total}
              onSaved={reloadDetail}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
