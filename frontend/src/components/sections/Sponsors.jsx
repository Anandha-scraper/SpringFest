import { fest } from "../../content/fest.js";

export default function Sponsors() {
  return (
    <section id="sponsors" className="section section-tint">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Backed by</span>
          <h2>Our Sponsors</h2>
          <p>Replace these placeholders with your partner logos.</p>
        </div>

        {fest.sponsors.map((tier) => (
          <div key={tier.tier} className="sponsor-tier">
            <h4 className="sponsor-tier-name">{tier.tier}</h4>
            <div className={`sponsor-row ${tier.tier === "Title Sponsor" ? "title-tier" : ""}`}>
              {tier.names.map((n) => (
                <div key={n} className="sponsor-logo">{n}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
