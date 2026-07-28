import { useState } from "react";
import { Link } from "react-router-dom";
import { useReveal } from "../lib/hooks.js";
import "./Pricing.css";

// Placeholder commercials — swap for the real plan matrix when billing lands.
const PLANS = [
  {
    id: "basic",
    name: "Basic",
    tagline: "For a single location finding its feet.",
    monthly: 49,
    yearly: 39,
    featured: false,
    features: [
      "1 published front desk",
      "500 conversations / month",
      "200 pages of PDF ingestion",
      "Knowledge base + booking agents",
      "Email support, 48h response",
      "7-day conversation history",
    ],
    missing: ["Evaluation suite", "Custom branding"],
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "For teams running several sites at once.",
    monthly: 149,
    yearly: 119,
    featured: true,
    features: [
      "5 published front desks",
      "5,000 conversations / month",
      "2,000 pages of PDF ingestion",
      "Full evaluation suite + reports",
      "Custom branding on the chat page",
      "Priority support, 4h response",
      "90-day conversation history",
      "Webhook + calendar handoff",
    ],
    missing: [],
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  const headRef = useReveal();

  return (
    <section className="pricing section" id="pricing">
      <div className="shell">
        <header className="pricing-head reveal" ref={headRef}>
          <span className="eyebrow">Pricing</span>
          <h2 className="section-title">Two plans. No per-seat maths.</h2>
          <p className="section-sub">
            Your customers never need an account, so you never pay for one.
            Every plan includes the orchestrator, the knowledge base and the
            hosted chat URL.
          </p>

          <div className="pricing-toggle" role="group" aria-label="Billing period">
            <button
              type="button"
              className={!yearly ? "is-active" : ""}
              onClick={() => setYearly(false)}
              aria-pressed={!yearly}
            >
              Monthly
            </button>
            <button
              type="button"
              className={yearly ? "is-active" : ""}
              onClick={() => setYearly(true)}
              aria-pressed={yearly}
            >
              Yearly
              <span className="pricing-save">−20%</span>
            </button>
          </div>
        </header>

        <div className="pricing-grid">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} yearly={yearly} />
          ))}
        </div>

        <p className="pricing-note center-note">
          All prices in USD, billed to the company. Cancel any time — your data
          is exported, not held hostage.
        </p>
      </div>
    </section>
  );
}

function PlanCard({ plan, yearly }) {
  const ref = useReveal();
  const price = yearly ? plan.yearly : plan.monthly;

  return (
    <article className={`plan card reveal ${plan.featured ? "is-featured" : ""}`} ref={ref}>
      {plan.featured && <span className="plan-badge">Most popular</span>}

      <header className="plan-head">
        <h3 className="plan-name">{plan.name}</h3>
        <p className="plan-tagline">{plan.tagline}</p>
      </header>

      <div className="plan-price">
        <span className="plan-currency">$</span>
        <span className="plan-amount">{price}</span>
        <span className="plan-period">/ month</span>
      </div>
      <p className="plan-billing mono">
        {yearly ? "billed yearly" : "billed monthly"}
      </p>

      <Link
        to="/get-started"
        className={`btn btn-block ${plan.featured ? "btn-primary" : "btn-ghost"}`}
      >
        Start with {plan.name}
      </Link>

      <ul className="plan-features">
        {plan.features.map((f) => (
          <li key={f}>
            <Check />
            {f}
          </li>
        ))}
        {plan.missing.map((f) => (
          <li key={f} className="is-missing">
            <Cross />
            {f}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
