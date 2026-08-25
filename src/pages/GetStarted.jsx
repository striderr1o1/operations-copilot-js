import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { signIn, signUp } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import "./GetStarted.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BENEFITS = [
  "Publish a front desk to its own URL in minutes",
  "Your customers just open the link — no accounts, no apps",
  "Ingest PDFs and it answers from them, not from thin air",
  "Grade every change against the evaluation suite",
];

export default function GetStarted({ mode: initialMode = "signup" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  // /login and /get-started render the same component; keep them in step
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const isSignup = mode === "signup";

  const toggle = () => {
    setMode(isSignup ? "login" : "signup");
    setError("");
    setNotice("");
    setConfirm("");
  };

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    // matches the backend's Field(min_length=6) so we fail fast instead of on a 422
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (isSignup && password !== confirm) return setError("Passwords don't match.");

    setBusy(true);
    try {
      if (isSignup) {
        const res = await signUp(email, password);
        if (res.requires_email_confirmation) {
          // Supabase has email confirmation on, so there is no session yet —
          // say so instead of dropping them on an empty dashboard.
          setNotice(
            `Almost there. We sent a confirmation link to ${email} — confirm it, then log in.`
          );
          setMode("login");
          setPassword("");
          setConfirm("");
        } else {
          login(res);
          navigate(from, { replace: true });
        }
      } else {
        const res = await signIn(email, password);
        login(res);
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gs">
      <div className="gs-bg" aria-hidden="true">
        <span className="gs-orb gs-orb-a" />
        <span className="gs-orb gs-orb-b" />
      </div>

      <section className="gs-aside">
        <Link to="/" className="gs-brand">
          <Logo size={26} />
          <span>Receptix</span>
        </Link>

        <div className="gs-aside-body">
          <h1 className="gs-aside-title">
            An AI front desk your customers can just&nbsp;
            <span className="gs-accent">walk up to.</span>
          </h1>
          <ul className="gs-benefits">
            {BENEFITS.map((b) => (
              <li key={b}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="gs-aside-foot mono">
          company subscribes → deploy → share the link
        </p>
      </section>

      <section className="gs-panel">
        <div className="gs-card">
          <Link to="/" className="gs-brand gs-brand-mobile">
            <Logo size={22} />
            <span>Receptix</span>
          </Link>

          <div className="gs-switch" role="tablist" aria-label="Account mode">
            <span className={`gs-switch-pill ${isSignup ? "" : "is-right"}`} aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              className={isSignup ? "is-active" : ""}
              onClick={() => !isSignup && toggle()}
            >
              Sign up
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              className={!isSignup ? "is-active" : ""}
              onClick={() => isSignup && toggle()}
            >
              Login
            </button>
          </div>

          <header className="gs-head">
            <h2 className="gs-title">
              {isSignup ? "Create your workspace" : "Welcome back"}
            </h2>
            <p className="gs-sub">
              {isSignup
                ? "One account per company. You'll deploy your front desk from here."
                : "Log in to manage your front desk, documents and bookings."}
            </p>
          </header>

          <form className="gs-form" onSubmit={onSubmit} noValidate>
            <label className="field">
              <span className="field-label">Work email</span>
              <input
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <div className="gs-password">
                <input
                  className="field-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="at least 6 characters"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                />
                <button
                  type="button"
                  className="gs-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>

            {isSignup && (
              <label className="field">
                <span className="field-label">Confirm password</span>
                <input
                  className="field-input"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="type it again"
                  autoComplete="new-password"
                  required
                />
              </label>
            )}

            {error && <p className="gs-alert gs-error">{error}</p>}
            {notice && <p className="gs-alert gs-notice">{notice}</p>}

            <button className="btn btn-primary btn-block gs-submit" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="gs-spinner" />
                  {isSignup ? "Creating…" : "Signing in…"}
                </>
              ) : isSignup ? (
                "Create account"
              ) : (
                "Log in"
              )}
            </button>
          </form>

          <p className="gs-toggle-note">
            {isSignup ? "Already have an account?" : "New to Receptix?"}{" "}
            <button type="button" onClick={toggle}>
              {isSignup ? "Log in instead" : "Create one"}
            </button>
          </p>

          <p className="gs-fineprint">
            Customers of your business never sign up — they just open the link
            you publish.
          </p>
        </div>
      </section>
    </main>
  );
}

function Eye() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
