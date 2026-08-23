import { useState } from "react";
import { Link } from "react-router-dom";
import Composer from "../../components/Composer.jsx";
import Transcript from "../../components/Transcript.jsx";
import { useAgentChat } from "../../lib/useAgentChat.js";
import { useDeployment } from "../../lib/deployment.jsx";
import "./ChatbotPanel.css";

const SUGGESTIONS = [
  "What are your opening hours?",
  "Book me an appointment for Friday morning",
  "How much does a consultation cost?",
];

export default function ChatbotPanel() {
  const { items, logs, busy, send, reset } = useAgentChat();
  const { published, setPublished, publicUrl, publicSlug, urlLoaded } = useDeployment();
  const [showLogs, setShowLogs] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="panel-page">
      <header className="panel-head">
        <div className="panel-head-text">
          <span className="panel-title">Chatbot</span>
          <span className="panel-sub">
            Talk to the agent exactly as your customers would.
          </span>
        </div>

        <div className="cb-head-actions">
          <button
            className="cb-icon-btn"
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            aria-pressed={showLogs}
            title={showLogs ? "Hide activity log" : "Show activity log"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="14" y2="12" />
              <line x1="4" y1="17" x2="17" y2="17" />
            </svg>
            Logs
          </button>

          <button className="cb-icon-btn" type="button" onClick={reset} title="Clear the transcript">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            Clear
          </button>

          <button
            className={`cb-publish ${published ? "is-live" : ""}`}
            type="button"
            onClick={() => setPublished(!published)}
          >
            <span className="cb-publish-dot" />
            {published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </header>

      {/* Deployment strip — the URL a company hands to its customers */}
      <section className={`cb-deploy ${published ? "is-live" : ""}`}>
        <div className="cb-deploy-state">
          <span className="cb-deploy-badge">{published ? "Live" : "Not published"}</span>
          <p className="cb-deploy-note">
            {published
              ? "Anyone with this link can chat. No login required."
              : "Publish to give your customers a working link."}
          </p>
        </div>

        <div className="cb-url">
          <code className="cb-url-text">
            {urlLoaded ? publicUrl : "Fetching your link…"}
          </code>

          <button
            className="cb-url-btn"
            type="button"
            onClick={copyUrl}
            disabled={!urlLoaded}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <Link
            className={`cb-url-btn cb-url-open ${!urlLoaded ? "is-disabled" : ""}`}
            to={`/c/${publicSlug}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!urlLoaded) e.preventDefault();
            }}
            aria-disabled={!urlLoaded}
          >
            Open
          </Link>
        </div>
      </section>

      <div className="cb-body">
        <div className="cb-chat">
          <Transcript
            items={items}
            busy={busy}
            variant="console"
            empty={
              <div className="cb-empty">
                <span className="cb-empty-mark mono">///</span>
                <p className="cb-empty-title">Multi-agent orchestration</p>
                <p className="cb-empty-sub">
                  Ask something a customer would ask. Reasoning blocks show which
                  agent handled it.
                </p>
                <div className="cb-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            }
          />
          <Composer
            onSend={send}
            busy={busy}
            placeholder="Ask the front desk something…"
            hint="enter to send · shift + enter for a new line"
          />
        </div>

        {showLogs && (
          <aside className="cb-logs">
            <header className="cb-logs-head">
              <span className="mono">activity</span>
              <span className={`cb-logs-state ${busy ? "is-active" : ""}`}>
                {busy ? "running" : "idle"}
              </span>
            </header>
            <div className="cb-logs-body">
              {logs.length === 0 ? (
                <p className="cb-logs-empty mono">no events yet</p>
              ) : (
                logs.map((l) => (
                  <p className="cb-log" key={l.id}>
                    <span className="cb-log-time">{l.time}</span>
                    <span className="cb-log-node">{l.node.toUpperCase()}</span>
                    <span className="cb-log-text">{l.text}</span>
                  </p>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
