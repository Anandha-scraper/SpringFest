import { Link } from "react-router-dom";
import { fest } from "../../content/fest.js";

export default function CTA() {
  return (
    <section className="cta-band">
      <div className="container center">
        <h2>Ready to join {fest.name} {fest.year}?</h2>
        <p>Registrations close a week before the fest. Sign in with Google and grab your slot.</p>
        <Link to="/#events" className="btn">Register Now →</Link>
      </div>
    </section>
  );
}
