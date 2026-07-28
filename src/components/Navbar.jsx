import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useActiveSection, useScrolled } from "../lib/hooks.js";
import { useAuth } from "../lib/auth.jsx";
import Logo from "./Logo.jsx";
import "./Navbar.css";

const LINKS = [
  { id: "home", label: "Home" },
  { id: "how-it-works", label: "How it works" },
  { id: "pricing", label: "Pricing" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
];

const SECTION_IDS = LINKS.map((l) => l.id);

export default function Navbar() {
  const scrolled = useScrolled(24);
  const active = useActiveSection(SECTION_IDS);
  const [open, setOpen] = useState(false);
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  // Lock the page behind the mobile sheet so it can't scroll underneath
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (id) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <header className={`nav ${scrolled ? "nav-solid" : ""}`}>
        <div className="nav-inner">
          <Link to="/" className="nav-brand" onClick={() => setOpen(false)}>
            <Logo />
            <span className="nav-brand-name">Receptix</span>
          </Link>

          <nav className="nav-links" aria-label="Primary">
            {LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                className={`nav-link ${active === link.id ? "is-active" : ""}`}
                onClick={() => go(link.id)}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="nav-actions">
            {isAuthed ? (
              <button
                className="btn btn-primary nav-cta"
                onClick={() => navigate("/dashboard")}
                type="button"
              >
                Dashboard
              </button>
            ) : (
              <>
                <Link to="/get-started" className="btn btn-primary nav-cta">
                  Get started
                </Link>
                <Link to="/login" className="nav-login">
                  Login
                </Link>
              </>
            )}
          </div>

          <button
            className={`nav-burger ${open ? "is-open" : ""}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div className={`nav-sheet ${open ? "is-open" : ""}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        <nav className="nav-sheet-links">
          {LINKS.map((link) => (
            <button key={link.id} type="button" onClick={() => go(link.id)}>
              {link.label}
            </button>
          ))}
        </nav>
        <div className="nav-sheet-actions">
          {isAuthed ? (
            <Link to="/dashboard" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/get-started" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
                Get started
              </Link>
              <Link to="/login" className="btn btn-ghost btn-block" onClick={() => setOpen(false)}>
                Login
              </Link>
            </>
          )}
        </div>
      </div>

      {open && <div className="nav-scrim" onClick={() => setOpen(false)} />}
    </>
  );
}
