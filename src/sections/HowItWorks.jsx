import { useReveal } from "../lib/hooks.js";
import "./HowItWorks.css";

const STEPS = [
  {
    n: "01",
    title: "Feed it your knowledge",
    body: "Drop in PDFs — price lists, policies, service menus. Receptix chunks and embeds them into your own private namespace.",
  },
  {
    n: "02",
    title: "Let the orchestrator route",
    body: "Every message hits a router that decides: answer from the knowledge base, take a booking, or reply directly. Sub-agents can hand to each other mid-turn.",
  },
  {
    n: "03",
    title: "Publish to a URL",
    body: "Flip the switch and your front desk goes live on its own link. Put it on your site, in an email, on a QR code at the door.",
  },
  {
    n: "04",
    title: "Watch it, grade it",
    body: "The evaluation suite replays scenarios against the live router so you can see exactly where it would have got things wrong.",
  },
];

export default function HowItWorks() {
  const headRef = useReveal();
  const videoRef = useReveal();

  return (
    <section className="hiw section" id="how-it-works">
      <div className="shell">
        <header className="hiw-head reveal" ref={headRef}>
          <span className="eyebrow">How it works</span>
          <h2 className="section-title">
            Four steps from a folder of PDFs to a front desk that answers.
          </h2>
          <p className="section-sub">
            No integration project, no phone tree, no scripts to maintain. You
            bring the documents; Receptix brings the conversation.
          </p>
        </header>

        <div className="hiw-layout">
          {/* Space held for the product walkthrough video */}
          <figure className="hiw-video reveal" ref={videoRef}>
            <div className="hiw-video-frame">
              <div className="hiw-video-inner">
                <button className="hiw-play" type="button" aria-label="Play walkthrough (coming soon)">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="8 5 19 12 8 19" />
                  </svg>
                </button>
                <p className="hiw-video-title">Product walkthrough</p>
                <p className="hiw-video-note">video coming soon — 2 min</p>
              </div>
              <span className="hiw-corner tl" />
              <span className="hiw-corner tr" />
              <span className="hiw-corner bl" />
              <span className="hiw-corner br" />
            </div>
            <figcaption className="hiw-video-cap mono">
              receptix / walkthrough.mp4
            </figcaption>
          </figure>

          <ol className="hiw-steps">
            {STEPS.map((step) => (
              <Step key={step.n} {...step} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, body }) {
  const ref = useReveal();
  return (
    <li className="hiw-step reveal" ref={ref}>
      <span className="hiw-step-n mono">{n}</span>
      <div className="hiw-step-text">
        <h3 className="hiw-step-title">{title}</h3>
        <p className="hiw-step-body">{body}</p>
      </div>
    </li>
  );
}
