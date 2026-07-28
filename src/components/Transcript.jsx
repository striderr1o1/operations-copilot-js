import { useEffect, useRef, useState } from "react";
import "./Transcript.css";

/**
 * Renders the flat transcript produced by useAgentChat.
 *
 * `variant="console"` is the operator view inside the dashboard — dense, with
 * collapsible reasoning blocks. `variant="bubble"` is what a customer sees on
 * the published page.
 */
export default function Transcript({
  items,
  busy,
  variant = "console",
  empty = null,
  assistantName = "Receptix",
}) {
  const scrollRef = useRef(null);
  const endRef = useRef(null);

  // Follow the tail, but only while the operator is already near the bottom —
  // scrolling up to read something shouldn't yank you back down.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < 220) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, busy]);

  const isEmpty = items.length === 0;

  return (
    <div className={`tr tr-${variant}`} ref={scrollRef}>
      {isEmpty && empty}

      {items.map((item) => {
        if (item.kind === "thinking") return <Thinking key={item.id} item={item} />;
        return (
          <Message key={item.id} item={item} variant={variant} assistantName={assistantName} />
        );
      })}

      {busy && variant === "bubble" && (
        <div className="tr-msg tr-assistant">
          <div className="tr-body tr-typing" aria-label="Assistant is typing">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

function Message({ item, variant, assistantName }) {
  const isUser = item.kind === "user";
  return (
    <div className={`tr-msg ${isUser ? "tr-user" : "tr-assistant"}`}>
      {variant === "console" ? (
        <span className="tr-role mono">{isUser ? "you" : "response"}</span>
      ) : (
        !isUser && <span className="tr-who">{assistantName}</span>
      )}
      <div className="tr-body">{item.text}</div>
      <span className="tr-time mono">{item.time}</span>
    </div>
  );
}

function Thinking({ item }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`tr-think ${open ? "is-open" : ""} ${item.loading ? "is-loading" : ""}`}>
      <button
        type="button"
        className="tr-think-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <svg className="tr-think-arrow" width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <polygon points="6 3 20 12 6 21" />
        </svg>
        <span className="tr-think-label mono">{item.label}</span>
        {item.loading && <span className="tr-think-spinner" />}
      </button>
      <div className="tr-think-content">{item.text}</div>
    </div>
  );
}
