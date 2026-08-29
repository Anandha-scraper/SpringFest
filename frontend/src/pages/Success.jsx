import { useLocation, Link } from "react-router-dom";
import { fest } from "../content/fest.js";

export default function Success() {
  const { state } = useLocation();
  // Screenshot payments aren't confirmed yet — an organiser still has to
  // check the proof, so promising "you're in" here would be a lie.
  const awaiting = !!state?.awaitingApproval;

  return (
    <div className="container narrow page-pad center">
      <div className="success-mark">{awaiting ? "⏳" : "✅"}</div>
      <h1>{awaiting ? "Payment submitted" : "You're in!"}</h1>
      <p className="muted" style={{ margin: "12px 0 24px" }}>
        {awaiting ? (
          <>
            Your place at {fest.name} {fest.year} is held while an organiser checks your
            payment. You'll see the result — and your entry pass — under My Registrations.
          </>
        ) : (
          <>
            Your registration for {fest.name} {fest.year} is confirmed. Your entry pass is
            ready to download under My Registrations.
          </>
        )}
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
