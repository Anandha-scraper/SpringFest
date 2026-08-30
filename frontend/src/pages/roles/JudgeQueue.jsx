import { useCallback, useEffect, useState } from "react";
import "@/styles/pages/admin/roles.css";
import { ArrowDown, ArrowUp, Plus, Save, X } from "lucide-react";
import {
  getJudgeEvents,
  getJudgeParticipants,
  getJudgeQueue,
  setJudgeQueue,
} from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { useToast } from "@/components/ui/toast.jsx";
import Loader from "@/components/common/Loader.jsx";

const label = (t) => t?.team_name || t?.lead_name || t?.registration_id;

export default function JudgeQueue() {
  const toast = useToast();
  const fetcher = useCallback(getJudgeEvents, []);
  const { data: events, error, loading } = useApi(fetcher);
  const [eventId, setEventId] = useState("");
  const [teams, setTeams] = useState([]);
  const [current, setCurrent] = useState("");
  const [upcoming, setUpcoming] = useState([]);
  const [addId, setAddId] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  useEffect(() => {
    if (events?.length && !eventId) setEventId(events[0].event_id);
  }, [events, eventId]);

  const load = useCallback(() => {
    if (!eventId) return;
    setDetailErr("");
    Promise.all([getJudgeParticipants(eventId), getJudgeQueue(eventId)])
      .then(([p, q]) => {
        setTeams(p.participants || []);
        setCurrent(q.current?.registration_id || "");
        setUpcoming((q.upcoming || []).map((t) => t.registration_id));
      })
      .catch((e) => setDetailErr(e.message));
  }, [eventId]);

  useEffect(load, [load]);

  const byId = Object.fromEntries(teams.map((t) => [t.registration_id, t]));
  const inQueue = new Set([current, ...upcoming].filter(Boolean));
  const available = teams.filter((t) => !inQueue.has(t.registration_id));

  const move = (i, delta) => {
    setUpcoming((list) => {
      const next = [...list];
      const j = i + delta;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      await setJudgeQueue(eventId, { current: current || null, upcoming });
      toast.ok("Queue updated.");
      load();
    } catch (e) {
      toast.bad(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader />;
  if (error) return <p className="error">{error}</p>;
  if (!events?.length) return <p className="empty-state">No events assigned to you yet.</p>;

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>Evaluation queue</h2>
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

      {detailErr && <p className="error">{detailErr}</p>}
      {teams.length === 0 ? (
        <p className="empty-state">No teams have been checked in for this event yet.</p>
      ) : (
        <>
          <label className="field">
            <span className="field-label">Now evaluating</span>
            <select className="input" value={current} onChange={(e) => setCurrent(e.target.value)}>
              <option value="">— nobody on stage —</option>
              {teams.map((t) => (
                <option key={t.registration_id} value={t.registration_id}>
                  {label(t)}
                </option>
              ))}
            </select>
          </label>

          <span className="field-label">Up next</span>
          {upcoming.length === 0 ? (
            <p className="muted">Queue is empty.</p>
          ) : (
            <ol className="assignment-list">
              {upcoming.map((id, i) => (
                <li key={id} className="assignment-chip">
                  <span>{byId[id] ? label(byId[id]) : id}</span>
                  <span className="row-actions">
                    <button type="button" className="icon-btn" onClick={() => move(i, -1)} aria-label="Move up">
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" className="icon-btn" onClick={() => move(i, 1)} aria-label="Move down">
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setUpcoming((l) => l.filter((x) => x !== id))}
                      aria-label="Remove"
                    >
                      <X size={15} />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {available.length > 0 && (
            <div className="criteria-foot">
              <select className="input" value={addId} onChange={(e) => setAddId(e.target.value)}>
                <option value="">Add a team…</option>
                {available.map((t) => (
                  <option key={t.registration_id} value={t.registration_id}>
                    {label(t)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={!addId}
                onClick={() => {
                  setUpcoming((l) => [...l, addId]);
                  setAddId("");
                }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          )}

          <div className="criteria-foot">
            <button type="button" className="btn" disabled={busy} onClick={save}>
              <Save size={15} /> Save queue
            </button>
          </div>
        </>
      )}
    </section>
  );
}
