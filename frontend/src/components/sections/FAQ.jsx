import { useState } from "react";
import { fest } from "../../content/fest.js";

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="section">
      <div className="container narrow">
        <div className="section-head">
          <span className="eyebrow">Good to know</span>
          <h2>Frequently Asked</h2>
        </div>

        <div className="faq-list">
          {fest.faqs.map((f, i) => (
            <div key={f.q} className={`faq-item ${open === i ? "open" : ""}`}>
              <button
                className="faq-q"
                onClick={() => setOpen(open === i ? -1 : i)}
                aria-expanded={open === i}
              >
                <span>{f.q}</span>
                <span className="faq-toggle" aria-hidden="true">+</span>
              </button>
              <div className="faq-a">
                <p>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
