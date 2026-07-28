import { Link, useParams } from "react-router-dom";
import Composer from "../components/Composer.jsx";
import Transcript from "../components/Transcript.jsx";
import Logo from "../components/Logo.jsx";
import { useAgentChat } from "../lib/useAgentChat.js";
import { useDeployment } from "../lib/deployment.jsx";
import "./PublishedChat.css";

const QUICK = [
  "What are your opening hours?",
  "Where are you located?",
  "I'd like to book an appointment",
];

export default function PublishedChat() {
  const { slug } = useParams();
  const { published, botName, greeting } = useDeployment();
  // Customers never sign in — the reasoning blocks stay in the operator view.
  const { items, busy, send } = useAgentChat({ withThinking: false, greeting });

  if (!published) return <Offline slug={slug} />;

  const showQuick = items.length <= 1 && !busy;

  return (
    <main className="pc">
      <div className="pc-bg" aria-hidden="true">
        <span className="pc-orb pc-orb-a" />
        <span className="pc-orb pc-orb-b" />
      </div>

      <section className="pc-window">
        <header className="pc-head">
          <span className="pc-avatar">
            <Logo size={20} />
          </span>
          <div className="pc-head-text">
            <span className="pc-name">{botName}</span>
            <span className="pc-status">
              <span className="pc-status-dot" />
              online · replies in seconds
            </span>
          </div>
          <span className="pc-slug mono">/{slug}</span>
        </header>

        <Transcript items={items} busy={busy} variant="bubble" assistantName={botName} />

        {showQuick && (
          <div className="pc-quick">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        <Composer
          onSend={send}
          busy={busy}
          placeholder="Type your question…"
          hint="powered by Receptix"
        />
      </section>
    </main>
  );
}

function Offline({ slug }) {
  return (
    <main className="pc pc-offline">
      <div className="pc-bg" aria-hidden="true">
        <span className="pc-orb pc-orb-a" />
      </div>
      <div className="pc-offline-card">
        <span className="pc-offline-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <line x1="12" y1="16.5" x2="12" y2="16.5" />
          </svg>
        </span>
        <h1 className="pc-offline-title">This front desk is offline</h1>
        <p className="pc-offline-body">
          <span className="mono">/{slug}</span> hasn't been published yet. If
          this is your workspace, publish it from the dashboard and the link
          starts working immediately.
        </p>
        <div className="pc-offline-actions">
          <Link to="/dashboard/chatbot" className="btn btn-primary">
            Open dashboard
          </Link>
          <Link to="/" className="btn btn-ghost">
            About Receptix
          </Link>
        </div>
      </div>
    </main>
  );
}
