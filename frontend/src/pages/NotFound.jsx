import { Link } from "react-router-dom";
import "@/styles/pages/not-found.css";

export default function NotFound() {
  return (
    <div className="container narrow page-pad center not-found">
      <span className="not-found__mark" aria-hidden="true">🌸</span>
      <h1>Page not found</h1>
      <p className="muted not-found__lead">
        That link doesn't lead anywhere. Let's get you back to the fest.
      </p>
      <Link to="/" className="btn">Back to home</Link>
    </div>
  );
}
