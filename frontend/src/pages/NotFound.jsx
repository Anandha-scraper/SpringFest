import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container narrow page-pad center">
      <span style={{ fontSize: "3rem", display: "block", marginBottom: 12 }}>🌸</span>
      <h1>Page not found</h1>
      <p className="muted" style={{ margin: "12px 0 28px" }}>
        That link doesn't lead anywhere. Let's get you back to the fest.
      </p>
      <Link to="/" className="btn">Back to home</Link>
    </div>
  );
}
