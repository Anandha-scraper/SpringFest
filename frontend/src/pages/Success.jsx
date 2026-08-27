import { useLocation, Link } from "react-router-dom";
import { fest } from "../content/fest.js";

export default function Success() {
  const { state } = useLocation();

  return (
    <div className="container narrow page-pad center">
      <div className="success-mark">✅</div>
      <h1>You're in!</h1>
      <p className="muted" style={{ margin: "12px 0 24px" }}>
        Your registration for {fest.name} {fest.year} is confirmed. A confirmation
        email is on its way.
      </p>

      {state?.registrationId && (
        <div className="detail-card" style={{ textAlign: "center" }}>
          <span className="stat-card-label">Registration ID</span>
          <code className="reg-id">{state.registrationId}</code>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: 10 }}>
            Save this — you'll need it at the registration desk.
          </p>
        </div>
      )}

      <div className="hero-cta" style={{ marginTop: 32, marginBottom: 0 }}>
        <Link className="btn" to="/my-registrations">My Registrations</Link>
        <Link className="btn btn-ghost" to="/#events">Register for more</Link>
      </div>
    </div>
  );
}
