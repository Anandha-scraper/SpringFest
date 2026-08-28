import { useCallback, useState } from "react";
import FormActions from "../../components/admin/FormActions.jsx";
import { ROLES } from "../../content/roles.js";
import { addPerson, getPeople, removePerson } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Judges", value: ROLES.JUDGE },
  { label: "Volunteers", value: ROLES.VOLUNTEER },
  { label: "Admins", value: ROLES.ADMIN },
];

// Participants aren't stored — anyone unlisted is one — so demoting someone is
// Remove, not an assignment. The backend rejects "participant" for the same reason.
const ASSIGNABLE = [ROLES.JUDGE, ROLES.VOLUNTEER, ROLES.ADMIN];

export default function AddRoles() {
  const fetcher = useCallback(() => getPeople(), []);
  const { data, error: loadError, loading, reload } = useApi(fetcher);
  const people = data || [];

  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES.JUDGE);

  const rows = filter ? people.filter((p) => p.role === filter) : people;

  const submit = async (e) => {
    e.preventDefault();
    const key = email.trim().toLowerCase();
    if (!key) return;
    setError("");

    // Admin grants every /api/admin/* endpoint, including the CSV export of
    // every registrant's contact details. Worth a beat of friction.
    if (
      role === ROLES.ADMIN &&
      !window.confirm(
        `Make ${key} an admin? They will be able to see and export every registration.`
      )
    ) return;

    try {
      await addPerson({ email: key, name: name.trim(), role });
      setEmail("");
      setName("");
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (person) => {
    setError("");
    try {
      await removePerson(person.email);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="spinner" />;
  if (loadError) return <p className="error">{loadError}</p>;

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Organiser view</span>
          <h1>Add Roles</h1>
          <p className="muted">
            Add judges and volunteers. Anyone not listed here signs in as a participant.
          </p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="panel-head">
          <h2>Add a person</h2>
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
          <FormActions saveLabel="Add person" />
        </form>

        {error && <p className="error">{error}</p>}
      </section>

      <section className="admin-panel">
        <div className="panel-head">
          <h2>People</h2>
          <span className="muted">{rows.length} listed</span>
        </div>

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

        {!rows.length ? (
          <p className="empty-state">
            Nobody with this role yet. Anyone not listed here signs in as a participant.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.email}>
                    <td>{p.email}</td>
                    <td>{p.name || "—"}</td>
                    <td><span className={`pill pill-${p.role}`}>{p.role}</span></td>
                    <td className="row-actions">
                      {/* Seeded admins live in ADMIN_EMAILS — they're the lockout
                          recovery path, so the API refuses to remove them. */}
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        disabled={p.seeded}
                        title={p.seeded ? "Managed in ADMIN_EMAILS" : undefined}
                        onClick={() => remove(p)}
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
    </div>
  );
}
