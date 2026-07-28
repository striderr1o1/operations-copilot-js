import { Link } from "react-router-dom";
import ParticleScene from "../components/ParticleScene.jsx";
import { useReveal } from "../lib/hooks.js";
import "./Hero.css";

const STATS = [
  { value: "24/7", label: "always answering" },
  { value: "<2s", label: "median first reply" },
  { value: "0", label: "logins for your customers" },
];

export default function Hero() {
  const copyRef = useReveal();

  return (
    <section className="hero" id="home">
      <div className="hero-bg" aria-hidden="true">
        <span className="hero-orb hero-orb-a" />
        <span className="hero-orb hero-orb-b" />
        <span className="hero-grid" />
      </div>

      <div className="shell hero-inner">
        <div className="hero-visual">
          <ParticleScene />
        </div>

        <div className="hero-copy reveal" ref={copyRef}>
          <span className="eyebrow">AI front desk · Receptix</span>

          <h1 className="hero-title">
            Your front desk,
            <span className="hero-title-accent"> awake at 3am</span> and never
            on hold.
          </h1>

          <p className="hero-lead">
            Receptix answers every question, books every appointment and hands
            over the ones that need a human — trained on your own documents, not
            on guesswork. Deploy it to a URL, share the link, done.
          </p>

          <ul className="hero-points">
            <li>Ingest your PDFs and it answers from them, with receipts.</li>
            <li>A routing orchestrator picks the right agent for every turn.</li>
            <li>One shareable URL. Your customers never sign up.</li>
          </ul>

          <div className="hero-cta">
            <Link to="/get-started" className="btn btn-primary hero-btn">
              Get started free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <a href="#how-it-works" className="btn btn-ghost hero-btn">
              See it work
            </a>
          </div>

          <dl className="hero-stats">
            {STATS.map((s) => (
              <div className="hero-stat" key={s.label}>
                <dt className="hero-stat-value">{s.value}</dt>
                <dd className="hero-stat-label">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <a className="hero-scroll" href="#how-it-works" aria-label="Scroll to how it works">
        <span className="hero-scroll-line" />
      </a>
    </section>
  );
}
