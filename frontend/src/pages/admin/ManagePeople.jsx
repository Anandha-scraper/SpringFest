import { useCallback, useEffect, useState } from "react";
import { addPerson, getPeople, removePerson } from "../../api/client.js";
import { ROLES } from "../../content/roles.js";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Admins", value: ROLES.ADMIN },
  { label: "Judges", value: ROLES.JUDGE },
  { label: "Volunteers", value: ROLES.VOLUNTEER },
];

// Participants aren't stored — anyone unlisted is one — so demoting someone is
// Remove, not an assignment. The backend rejects "participant" for the same reason.
const ASSIGNABLE = [ROLES.JUDGE, ROLES.VOLUNTEER, ROLES.ADMIN];

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

export default function ManagePeople() {
  const [filter, setFilter] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES.JUDGE);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setRows(await getPeople(filter));
    } catch (err) {
      setError(err.message);
      setRows([]);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    // Admin grants every existing /api/admin/* endpoint, including the CSV
    // export of all registrant contact details. Worth a beat of friction.
    if (role === ROLES.ADMIN && !window.confirm(
      `Make ${email.trim()} an admin? They will be able to see and export every registration.`
    )) return;
    setBusy(true);
    setError("");
    try {
      await addPerson({ email: email.trim(), role, name: name.trim() });
      setEmail("");
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (person) => {
    setError("");
    try {
      await removePerson(person.email);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>Manage People</h2>
      </div>

      <form className="filter-bar" onSubmit={submit}>
        <input
          className="input"
          type="email"
          required
          placeholder="person@example.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          {ASSIGNABLE.map((r) => (
            <option key={r} value={r}>
              {r[0].toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add person"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={`chip ${filter === f.value ? "active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="spinner" />
      ) : rows.length === 0 ? (
        <p className="empty-state">
          Nobody with this role yet. Anyone not listed here signs in as a participant.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Added by</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.email}>
                  <td>
                    {p.email}
                    {p.seeded && <span className="cell-sub">from .env</span>}
                  </td>
                  <td>{p.name || "—"}</td>
                  <td>
                    <span className={`pill pill-${p.role}`}>{p.role}</span>
                  </td>
                  <td>{p.added_by || "—"}</td>
                  <td>{fmtDate(p.updated_at)}</td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => remove(p)}
                      disabled={p.seeded}
                      title={
                        p.seeded
                          ? "Seeded admins are managed in backend/.env"
                          : "Remove this role"
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
