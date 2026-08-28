import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";

export default function RegistrationForm({ onSubmit, submitting, fee = 0 }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", college: "" });

  // Prefill from the Google account — the user can still edit these.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.displayName || "",
      email: f.email || user.email || "",
    }));
  }, [user]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

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
