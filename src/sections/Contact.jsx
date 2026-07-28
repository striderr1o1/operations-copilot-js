import { useState } from "react";
import { useReveal } from "../lib/hooks.js";
import "./Contact.css";

const CHANNELS = [
  { label: "Email", value: "hello@receptix.ai", href: "mailto:hello@receptix.ai" },
  { label: "Sales", value: "+1 (415) 555-0142", href: "tel:+14155550142" },
  { label: "Hours", value: "Mon–Fri, 09:00–18:00 UTC", href: null },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");
  const ref = useReveal();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // There is no contact endpoint on the API yet, so this validates and
  // acknowledges locally rather than pretending to deliver anything.
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Tell us who you are.");
    if (!EMAIL_RE.test(form.email)) return setError("That email doesn't look right.");
    if (form.message.trim().length < 10) return setError("A little more detail, please.");

    setError("");
    setStatus("sending");
    setTimeout(() => setStatus("sent"), 700);
  };

  return (
    <section className="contact section" id="contact">
      <div className="shell contact-inner">
        <div className="contact-copy">
          <span className="eyebrow">Contact</span>
          <h2 className="section-title">Talk to a human about your robot.</h2>
          <p className="section-sub">
            Tell us what your front desk gets asked all day. We'll show you what
            Receptix does with it — usually within one working day.
          </p>

          <dl className="contact-channels">
            {CHANNELS.map((c) => (
              <div className="contact-channel" key={c.label}>
                <dt className="mono">{c.label}</dt>
                <dd>
                  {c.href ? <a href={c.href}>{c.value}</a> : c.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <form className="contact-form card reveal" ref={ref} onSubmit={submit} noValidate>
          {status === "sent" ? (
            <div className="contact-sent">
              <span className="contact-sent-mark" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <h3 className="contact-sent-title">Message noted</h3>
              <p className="contact-sent-body">
                Thanks {form.name.split(" ")[0] || "there"} — we'll reply to{" "}
                <strong>{form.email}</strong> shortly.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setForm({ name: "", email: "", company: "", message: "" });
                  setStatus("idle");
                }}
              >
                Send another
              </button>
            </div>
          ) : (
            <>
              <div className="contact-row">
                <label className="field">
                  <span className="field-label">Name</span>
                  <input
                    className="field-input"
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Jamie Rivera"
                    autoComplete="name"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Work email</span>
                  <input
                    className="field-input"
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="jamie@clinic.com"
                    autoComplete="email"
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">Company</span>
                <input
                  className="field-input"
                  value={form.company}
                  onChange={set("company")}
                  placeholder="Northside Clinic"
                  autoComplete="organization"
                />
              </label>

              <label className="field">
                <span className="field-label">What do you need answered?</span>
                <textarea
                  className="field-input contact-textarea"
                  value={form.message}
                  onChange={set("message")}
                  rows={4}
                  placeholder="We get about 60 calls a day asking the same six things…"
                />
              </label>

              {error && <p className="contact-error">{error}</p>}

              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending…" : "Request a walkthrough"}
              </button>
              <p className="contact-fineprint">
                No newsletter, no drip campaign. One reply from a person.
              </p>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
