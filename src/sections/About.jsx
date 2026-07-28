import { useReveal } from "../lib/hooks.js";
import "./About.css";

const PILLARS = [
  {
    title: "Grounded, not improvised",
    body: "Answers come from your ingested documents. If the knowledge base has nothing to say, the orchestrator says so instead of inventing a policy.",
  },
  {
    title: "One loop, many agents",
    body: "Routing, knowledge base and booking are separate agents on a single graph. Any of them can hand straight to another without a round trip through the user.",
  },
  {
    title: "Measured every release",
    body: "A scenario dataset grades the router on routing, follow-ups, empty responses and off-topic questions. Regressions show up as a failing case, not a support ticket.",
  },
];

const FACTS = [
  { k: "Built on", v: "LangGraph + FastAPI" },
  { k: "Retrieval", v: "Pinecone, 1024-dim" },
  { k: "Auth", v: "Supabase" },
  { k: "Deploys to", v: "your own URL" },
];

export default function About() {
  const headRef = useReveal();
  const panelRef = useReveal();

  return (
    <section className="about section" id="about">
      <div className="shell about-inner">
        <div className="about-copy reveal" ref={headRef}>
          <span className="eyebrow">About</span>
          <h2 className="section-title">
            We built the receptionist we kept wishing someone would pick up.
          </h2>
          <p className="section-sub">
            Receptix started as an internal tool for a clinic drowning in
            repeat questions — opening hours, parking, what a visit costs. The
            answers were all sitting in a PDF nobody read. So we gave the PDF a
            voice, gave it the ability to book, and put it behind one link.
          </p>

          <div className="about-pillars">
            {PILLARS.map((p) => (
              <Pillar key={p.title} {...p} />
            ))}
          </div>
        </div>

        <aside className="about-panel reveal" ref={panelRef}>
          <div className="about-panel-glow" aria-hidden="true" />
          <div className="about-card card">
            <p className="about-quote">
              “It answers the eighty questions we used to answer by hand, and
              the two it can’t, it hands to us with the context already
              gathered.”
            </p>
            <div className="about-author">
              <span className="about-avatar" aria-hidden="true">
                RM
              </span>
              <div>
                <p className="about-author-name">Operations lead</p>
                <p className="about-author-role mono">pilot customer, 2025</p>
              </div>
            </div>
          </div>

          <dl className="about-facts">
            {FACTS.map((f) => (
              <div className="about-fact" key={f.k}>
                <dt className="mono">{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  );
}

function Pillar({ title, body }) {
  const ref = useReveal();
  return (
    <article className="about-pillar reveal" ref={ref}>
      <span className="about-pillar-bar" aria-hidden="true" />
      <h3 className="about-pillar-title">{title}</h3>
      <p className="about-pillar-body">{body}</p>
    </article>
  );
}
