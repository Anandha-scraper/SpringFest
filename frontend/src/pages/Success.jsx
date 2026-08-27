import { useLocation, Link } from "react-router-dom";

export default function Success() {
  const { state } = useLocation();
  return (
    <main className="container narrow center">
      <h1>Registration Confirmed ✅</h1>
      {state?.registrationId && (
        <p>
          Your registration ID: <strong>{state.registrationId}</strong>
        </p>
      )}
      <p>A confirmation will be sent to your email.</p>
      <Link className="btn" to="/">
        Back to events
      </Link>
    </main>
  );
}
