"use client";

import { useCallback, useMemo, useState } from "react";
import "@/styles/pages/admin/shared.css";
import "@/styles/pages/admin/spot.css";

import { Plus, Trash2, Upload } from "lucide-react";

import DetailFields from "@/components/registration/DetailFields.jsx";
import Loader from "@/components/common/Loader.jsx";
import { useToast } from "@/components/ui/toast.jsx";
import { createSpotRegistration, getEvents } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import BulkImport from "@/components/admin/BulkImport.jsx";

const blankPerson = () => ({
  name: "",
  email: "",
  phone: "",
  college: "",
  department: "",
  year: "",
  location: "",
  location_other: "",
});

const digitsOnly = (v) => v.replace(/\D/g, "").slice(0, 10);
const fetchEvents = () => getEvents();

/** One person's fields — identical for the lead and every teammate, so the
 * desk types the same shape each time. */
function PersonFields({ idPrefix, person, onChange, heading, onRemove }) {
  const set = (field, value) =>
    onChange({ ...person, [field]: field === "phone" ? digitsOnly(value) : value });

  return (
    <div className="spot-person">
      <div className="spot-person-head">
        <h4>{heading}</h4>
        {onRemove && (
          <button className="btn btn-sm btn-ghost" type="button" onClick={onRemove}>
            <Trash2 size={14} aria-hidden="true" /> Remove
          </button>
        )}
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${idPrefix}-name`}>Full name</label>
          <input
            id={`${idPrefix}-name`}
            required
            minLength={2}
            value={person.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-email`}>Email</label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            required
            value={person.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-phone`}>Phone</label>
          <input
            id={`${idPrefix}-phone`}
            inputMode="numeric"
            required
            placeholder="10 digits"
            value={person.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <DetailFields
          idPrefix={idPrefix}
          values={person}
          onChange={(f, v) => set(f, v)}
          labelled
        />
      </div>
    </div>
  );
}

export default function SpotRegistration() {
  const { data: events, error: loadError, loading } = useApi(fetchEvents);
  const toast = useToast();

  const [eventId, setEventId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [lead, setLead] = useState(blankPerson);
  const [members, setMembers] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionId, setTransactionId] = useState("");
  const [feeInput, setFeeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const event = useMemo(
    () => (events || []).find((e) => e.id === eventId) || null,
    [events, eventId]
  );
  const teamSize = 1 + members.length;
  const expectedFee = (event?.fee || 0) * teamSize;
  // Blank means "charge the event's price"; a typed value overrides it, which
  // is what the desk needs for a waiver or a part payment.
  const fee = feeInput === "" ? expectedFee : Number(feeInput);

  const reset = () => {
    setTeamName("");
    setLead(blankPerson());
    setMembers([]);
    setTransactionId("");
    setFeeInput("");
    setPaymentMethod("cash");
  };

  const pickEvent = (id) => {
    setEventId(id);
    // Team size and price both depend on the event, so a half-built roster
    // priced against the previous one must not survive the change.
    setMembers([]);
    setTeamName("");
    setFeeInput("");
  };

  const complete = (p) =>
    p.name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(p.email) &&
    p.phone.length === 10 &&
    p.college.trim().length >= 2 &&
    p.department &&
    p.year &&
    p.location &&
    (p.location !== "Other" || p.location_other.trim().length >= 2);

  const canSubmit =
    event &&
    complete(lead) &&
    members.every(complete) &&
    (!event.is_team_event || teamName.trim()) &&
    (paymentMethod !== "online" || transactionId.trim().length >= 4);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        event_id: eventId,
        ...lead,
        team_name: event.is_team_event ? teamName.trim() : "",
        members: event.is_team_event ? members : [],
        payment_method: paymentMethod,
        transaction_id: paymentMethod === "online" ? transactionId.trim() : "",
        ...(feeInput === "" ? {} : { fee: Number(feeInput) }),
      };
      const res = await createSpotRegistration(payload);
      setResult(res);
      reset();
      toast.ok(`Registered — code ${(res.allocation_codes || []).join(", ") || "pending"}`);
    } catch (err) {
      toast.bad(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;
  if (loadError) return <p className="error">{loadError}</p>;

  return (
    <div className="admin spot">
      {result && (
        <section className="admin-panel spot-result">
          <div className="panel-head">
            <h2>Registered</h2>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => setResult(null)}>
              Dismiss
            </button>
          </div>
          <p>
            <strong>{result.event_name}</strong> · {result.team_size} seat
            {result.team_size === 1 ? "" : "s"} · ₹{result.fee}
            {result.fee_overridden && (
              <span className="muted"> (event price ₹{result.expected_fee})</span>
            )}
          </p>
          <div className="spot-codes">
            {(result.allocation_codes || []).length ? (
              result.allocation_codes.map((c) => (
                <span className="alloc-code" key={c}>
                  {c}
                </span>
              ))
            ) : (
              <span className="muted">Code pending — refresh the registrations list.</span>
            )}
          </div>
          <p className="muted">
            Read the code out to them. {result.unclaimed
              ? "They have not signed in yet — the registration attaches to their account the first time they do."
              : "It is already on their account."}
          </p>
        </section>
      )}

      <section className="admin-panel">
        <div className="panel-head">
          <h2>Spot registration</h2>
          <span className="muted">Marked SPOT · code starts SP</span>
        </div>
        <p className="muted panel-note">
          For someone registering in person. Works after registrations have closed, records
          cash or an online reference, and confirms them immediately — no payment screen and
          no approval step. They do not need an account first.
        </p>

        <form className="form spot-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="spot-event">Event</label>
            <select
              id="spot-event"
              required
              value={eventId}
              onChange={(e) => pickEvent(e.target.value)}
            >
              <option value="" disabled>
                Choose an event
              </option>
              {(events || []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — ₹{e.fee || 0}
                  {e.is_team_event ? ` · team of ${e.team_min}–${e.team_max}` : ""}
                </option>
              ))}
            </select>
          </div>

          {event?.is_team_event && (
            <div className="field">
              <label htmlFor="spot-team">Team name</label>
              <input
                id="spot-team"
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
          )}

          {event && (
            <>
              <PersonFields
                idPrefix="spot-lead"
                person={lead}
                onChange={setLead}
                heading={event.is_team_event ? "Team lead" : "Participant"}
              />

              {members.map((m, i) => (
                <PersonFields
                  key={i}
                  idPrefix={`spot-m${i}`}
                  person={m}
                  heading={`Member ${i + 2}`}
                  onChange={(next) =>
                    setMembers((prev) => prev.map((p, j) => (j === i ? next : p)))
                  }
                  onRemove={() => setMembers((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}

              {event.is_team_event && teamSize < (event.team_max ?? 1) && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setMembers((prev) => [...prev, blankPerson()])}
                >
                  <Plus size={15} aria-hidden="true" /> Add a teammate
                </button>
              )}

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="spot-pay">Paid by</label>
                  <select
                    id="spot-pay"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                  </select>
                </div>

                {paymentMethod === "online" && (
                  <div className="field">
                    <label htmlFor="spot-txn">Transaction reference</label>
                    <input
                      id="spot-txn"
                      required
                      minLength={4}
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                    />
                  </div>
                )}

                <div className="field">
                  <label htmlFor="spot-fee">Amount collected</label>
                  <input
                    id="spot-fee"
                    inputMode="numeric"
                    placeholder={String(expectedFee)}
                    value={feeInput}
                    onChange={(e) => setFeeInput(e.target.value.replace(/\D/g, ""))}
                  />
                  <span className="field-hint">
                    Event price is ₹{expectedFee} for {teamSize} seat
                    {teamSize === 1 ? "" : "s"}. Leave blank to charge that
                    {fee !== expectedFee && feeInput !== "" ? "; ₹" + fee + " is recorded as an override" : ""}.
                  </span>
                </div>
              </div>

              <button className="btn" type="submit" disabled={!canSubmit || submitting}>
                {submitting ? "Registering…" : `Register & mint code — ₹${fee}`}
              </button>
            </>
          )}
        </form>
      </section>

      <BulkImport />
    </div>
  );
}
