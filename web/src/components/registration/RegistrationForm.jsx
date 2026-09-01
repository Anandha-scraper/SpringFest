"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/auth/AuthContext.jsx";
import DetailFields from "@/components/registration/DetailFields.jsx";

const blankMember = () => ({
  name: "", email: "", phone: "", college: "", department: "", year: "", location: "", location_other: "",
});

const blankLead = () => ({
  name: "", email: "", phone: "", college: "", department: "", year: "", location: "", location_other: "",
});

const digitsOnly = (v) => v.replace(/\D/g, "").slice(0, 10);

/**
 * The signed-in user is the lead: their details are this form's top fields,
 * and for a team event they add their teammates below. One submission, one
 * payment — teammates never sign in themselves.
 *
 * `initialValues` prefills the form when resuming a saved draft (same shape
 * `onSubmit` produces: lead fields + team_name + members[]).
 */
export default function RegistrationForm({
  onSubmit,
  onSaveDraft,
  submitting,
  fee = 0,
  event = {},
  initialValues = null,
}) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({ ...blankLead(), ...initialValues }));
  const [teamName, setTeamName] = useState(initialValues?.team_name || "");
  const [members, setMembers] = useState(() =>
    (initialValues?.members || []).map((m) => ({ ...blankMember(), ...m }))
  );

  const isTeam = !!event.is_team_event;
  const teamMin = event.team_min || 1;
  const teamMax = event.team_max || 1;

  // Prefill from the Google account — the user can still edit these. Skipped
  // once a draft has already supplied a name/email, so resuming doesn't
  // clobber what was saved.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.displayName || "",
      email: f.email || user.email || "",
    }));
  }, [user]);

  // Open with the minimum viable team, so the smallest legal entry is one
  // click — but only when there's no draft already supplying members.
  useEffect(() => {
    if (isTeam && !initialValues?.members?.length) {
      setMembers(Array.from({ length: Math.max(0, teamMin - 1) }, blankMember));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeam, teamMin]);

  const changeMember = (i, field, value) =>
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));

  // For a team event, one person is shown at a time so the card doesn't grow
  // with team size. `viewing` indexes the roster [lead, ...members] — 0 is you.
  const [viewing, setViewing] = useState(0);
  useEffect(() => {
    setViewing((v) => Math.max(0, Math.min(v, members.length)));
  }, [members.length]);

  const [teamError, setTeamError] = useState("");

  const addMember = () => {
    setMembers((prev) => [...prev, blankMember()]);
    setViewing(members.length + 1); // jump to the new teammate
  };
  const removeMember = (memberIdx) => {
    setMembers((prev) => prev.filter((_, idx) => idx !== memberIdx));
    setViewing(Math.max(0, memberIdx)); // the clamp effect finishes the job
  };

  const personComplete = (p) =>
    p.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) &&
    p.phone.length === 10 &&
    p.college.trim().length >= 2 &&
    !!p.department &&
    !!p.year &&
    !!p.location &&
    (p.location !== "Other" || p.location_other.trim().length >= 2);

  const payload = () => (isTeam ? { ...form, team_name: teamName.trim(), members } : form);

  const submit = (e) => {
    e.preventDefault();
    if (isTeam) {
      const bad = [form, ...members].findIndex((p) => !personComplete(p));
      if (bad !== -1) {
        setViewing(bad);
        setTeamError(
          bad === 0
            ? "Fill in all of your own details before registering."
            : `Fill in all of Member ${bad + 1}'s details before registering.`
        );
        return;
      }
    }
    setTeamError("");
    onSubmit(payload());
  };

  const saveDraft = () => onSaveDraft(payload());

  const size = 1 + members.length;
  const total = fee * size;

  // Name / email / phone row + academic block for one person, bound either to
  // the lead (`form`) or to members[idx-1].
  const personFields = (person, isLead, idx) => {
    const pfx = isLead ? "rf" : `rf-m${idx - 1}`;
    const set = (field, value) => {
      const v = field === "phone" ? digitsOnly(value) : value;
      if (isLead) setForm((f) => ({ ...f, [field]: v }));
      else changeMember(idx - 1, field, v);
    };
    return (
      <>
        <div className="field-row field-row--3">
          <div className="field">
            <label htmlFor={`${pfx}-name`}>Full name</label>
            <input id={`${pfx}-name`} placeholder="Full name" required minLength={2}
              value={person.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${pfx}-email`}>Email</label>
            <input id={`${pfx}-email`} type="email" placeholder="you@example.com" required
              value={person.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${pfx}-phone`}>Phone</label>
            {/* The +91 is decoration, never part of the value: digitsOnly()
                would strip the "+" and the server's requirePhone() accepts
                only ten bare digits, so a prefix that leaked into state would
                be a hard 400. */}
            <div className="phone-input">
              <span className="phone-input__prefix" aria-hidden="true">+91</span>
              <input id={`${pfx}-phone`} type="tel" inputMode="numeric" pattern="[0-9]{10}"
                maxLength={10} placeholder="10-digit mobile number" required
                value={person.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="field-row field-row--2">
          <DetailFields idPrefix={pfx} values={person} onChange={set} labelled />
        </div>
      </>
    );
  };

  return (
    <form className="form register-form" onSubmit={submit}>
      {!isTeam ? (
        personFields(form, true, 0)
      ) : (
        <>
          <div className="field field--wide">
            <label htmlFor="rf-team">Team name</label>
            <input id="rf-team" placeholder="Your team's name" required
              value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          </div>

          <div className="team-member field--wide">
            <div className="team-pager">
              <button type="button" className="icon-btn" disabled={viewing === 0}
                aria-label="Previous person" onClick={() => setViewing(viewing - 1)}>
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <strong>
                {viewing === 0 ? "You" : `Member ${viewing + 1}`} · {viewing + 1} of {size}
              </strong>
              <button type="button" className="icon-btn" disabled={viewing >= size - 1}
                aria-label="Next person" onClick={() => setViewing(viewing + 1)}>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              {viewing > 0 && size > teamMin && (
                <button type="button" className="icon-btn team-pager__remove"
                  aria-label={`Remove member ${viewing + 1}`}
                  onClick={() => removeMember(viewing - 1)}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            {viewing === 0
              ? personFields(form, true, 0)
              : personFields(members[viewing - 1], false, viewing)}
          </div>

          <p className="muted register-form__hint">
            Teams of {teamMin}–{teamMax}, you included — {size} member{size === 1 ? "" : "s"} so far
            {fee > 0 && ` · ₹${fee} × ${size} = ₹${total}`}.
          </p>

          {teamError && <p className="error">{teamError}</p>}

          {size < teamMax && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={addMember}>
              <UserPlus size={15} aria-hidden="true" /> Add a teammate
            </button>
          )}
        </>
      )}

      <div className="form-actions-row">
        <button className="btn" type="submit" disabled={submitting}>
          {submitting
            ? "Please wait…"
            : total > 0
              ? `Pay ₹${total} & Register`
              : "Confirm Registration"}
        </button>
        {onSaveDraft && (
          <button className="btn btn-ghost" type="button" disabled={submitting} onClick={saveDraft}>
            Save as draft
          </button>
        )}
      </div>
    </form>
  );
}
