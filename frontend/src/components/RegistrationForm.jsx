import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";

const blankMember = () => ({ name: "", email: "", phone: "" });

/**
 * The signed-in user is the lead: their details are this form's top fields,
 * and for a team event they add their teammates below. One submission, one
 * payment — teammates never sign in themselves.
 */
export default function RegistrationForm({ onSubmit, submitting, fee = 0, event = {} }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", college: "" });
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState([]);

  const isTeam = !!event.is_team_event;
  const teamMin = event.team_min || 1;
  const teamMax = event.team_max || 1;

  // Prefill from the Google account — the user can still edit these.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.displayName || "",
      email: f.email || user.email || "",
    }));
  }, [user]);

  // Open with the minimum viable team, so the smallest legal entry is one click.
  useEffect(() => {
    if (isTeam) setMembers(Array.from({ length: Math.max(0, teamMin - 1) }, blankMember));
  }, [isTeam, teamMin]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const changeMember = (i, field, value) =>
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));

  const submit = (e) => {
    e.preventDefault();
    onSubmit(isTeam ? { ...form, team_name: teamName.trim(), members } : form);
  };

  const size = 1 + members.length;

  return (
    <form className="form" onSubmit={submit}>
      <label htmlFor="rf-name">Full name</label>
      <input id="rf-name" name="name" placeholder="Your full name"
        value={form.name} onChange={change} required minLength={2} />

      <label htmlFor="rf-email">Email</label>
      <input id="rf-email" name="email" type="email" placeholder="you@example.com"
        value={form.email} onChange={change} required />

      <label htmlFor="rf-phone">Phone</label>
      <input id="rf-phone" name="phone" type="tel" placeholder="10-digit mobile number"
        value={form.phone} onChange={change} required minLength={8} maxLength={15} />

      <label htmlFor="rf-college">College</label>
      <input id="rf-college" name="college" placeholder="Your college name"
        value={form.college} onChange={change} />

      {isTeam && (
        <>
          <label htmlFor="rf-team">Team name</label>
          <input id="rf-team" placeholder="Your team's name" required
            value={teamName} onChange={(e) => setTeamName(e.target.value)} />

          <p className="muted" style={{ fontSize: "0.85rem", margin: "6px 0 0" }}>
            Teams of {teamMin}–{teamMax}, you included. You're registering and paying for
            everyone — currently {size} member{size === 1 ? "" : "s"}.
          </p>

          {members.map((m, i) => (
            <div className="team-member" key={i}>
              <div className="team-member-head">
                <strong>Member {i + 2}</strong>
                {size > teamMin && (
                  <button type="button" className="icon-btn"
                    aria-label={`Remove member ${i + 2}`}
                    onClick={() => setMembers((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              <input placeholder="Full name" required minLength={2}
                value={m.name} onChange={(e) => changeMember(i, "name", e.target.value)} />
              <input type="email" placeholder="Email" required
                value={m.email} onChange={(e) => changeMember(i, "email", e.target.value)} />
              <input type="tel" placeholder="Phone" required minLength={8} maxLength={15}
                value={m.phone} onChange={(e) => changeMember(i, "phone", e.target.value)} />
            </div>
          ))}

          {size < teamMax && (
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setMembers((prev) => [...prev, blankMember()])}>
              <UserPlus size={15} aria-hidden="true" /> Add a teammate
            </button>
          )}
        </>
      )}

      <button className="btn" type="submit" disabled={submitting}>
        {submitting
          ? "Please wait…"
          : fee > 0
            ? `Pay ₹${fee} & Register`
            : "Confirm Registration"}
      </button>
    </form>
  );
}
