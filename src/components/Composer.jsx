import { useRef, useState } from "react";
import "./Composer.css";

/** The message input. Enter sends, Shift+Enter is a newline. */
export default function Composer({
  onSend,
  busy,
  disabled = false,
  placeholder = "Message",
  hint,
}) {
  const [value, setValue] = useState("");
  const areaRef = useRef(null);

  const grow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  };

  const submit = () => {
    const text = value.trim();
    if (!text || busy || disabled) return;
    onSend(text);
    setValue("");
    grow(areaRef.current);
    areaRef.current?.focus();
  };

  return (
    <div className={`cmp ${disabled ? "is-disabled" : ""}`}>
      <div className="cmp-bar">
        <textarea
          ref={areaRef}
          className="cmp-input"
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={disabled ? "Chat is offline" : placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            grow(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          autoComplete="off"
          spellCheck="false"
        />
        <button
          className="cmp-send"
          type="button"
          onClick={submit}
          disabled={busy || disabled || !value.trim()}
          aria-label="Send message"
        >
          {busy ? (
            <span className="cmp-spinner" />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          )}
        </button>
      </div>
      {hint && <p className="cmp-hint mono">{hint}</p>}
    </div>
  );
}
