import { useState } from "react";

const empty = { name: "", email: "", phone: "", college: "" };

export default function RegistrationForm({ onSubmit, submitting }) {
  const [form, setForm] = useState(empty);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form className="form" onSubmit={submit}>
      <input name="name" placeholder="Full name" value={form.name} onChange={change} required />
      <input name="email" type="email" placeholder="Email" value={form.email} onChange={change} required />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={change} required />
      <input name="college" placeholder="College" value={form.college} onChange={change} />
      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? "Please wait..." : "Proceed"}
      </button>
    </form>
  );
}
