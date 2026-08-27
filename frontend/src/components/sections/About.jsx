import AnimatedContent from "../reactbits/AnimatedContent.jsx";
import SplitText from "../reactbits/SplitText.jsx";
import { fest } from "../../content/fest.js";

export default function About() {
  return (
    <section id="about" className="section">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">About the fest</span>
          <SplitText
            text={`What is ${fest.name} ${fest.year}?`}
            className="section-title"
            delay={30}
            duration={0.7}
            splitType="words"
            from={{ opacity: 0, y: 30 }}
            to={{ opacity: 1, y: 0 }}
            textAlign="center"
          />
        </div>

        <AnimatedContent distance={60} direction="vertical" duration={0.8} delay={0.1}>
          <div className="about-copy">
            {fest.about.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </AnimatedContent>

        <div className="highlight-grid">
          {fest.highlights.map((h, i) => (
            <AnimatedContent key={h.title} distance={50} duration={0.7} delay={0.08 * i}>
              <div className="highlight">
                <span className="highlight-icon">{h.icon}</span>
                <h3>{h.title}</h3>
                <p>{h.text}</p>
              </div>
            </AnimatedContent>
          ))}
        </div>
      </div>
    </section>
  );
}
