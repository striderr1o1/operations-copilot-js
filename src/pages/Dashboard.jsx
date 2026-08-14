import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../lib/auth.jsx";
import { useDeployment } from "../lib/deployment.jsx";
import ChatbotPanel from "./dashboard/ChatbotPanel.jsx";
import IngestionPanel from "./dashboard/IngestionPanel.jsx";
import EvaluationsPanel from "./dashboard/EvaluationsPanel.jsx";
import CheckSlotsPanel from "./dashboard/CheckSlotsPanel.jsx";
import "./Dashboard.css";

// Absolute paths: relative `to` would resolve against the current dashboard
// URL and stack up as /dashboard/chatbot/chatbot.
const NAV = [
  {
    to: "/dashboard/chatbot",
    label: "Chatbot",
    hint: "test the live agent",
    icon: (
      <>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </>
    ),
  },
  {
    to: "/dashboard/ingestion",
    label: "Ingestion",
    hint: "feed it documents",
    icon: (
      <>
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <polyline points="9 14 12 11 15 14" />
      </>
    ),
  },
  {
    to: "/dashboard/evaluations",
    label: "Evaluations",
    hint: "grade the router",
    icon: (
      <>
        <path d="M3 3v18h18" />
        <rect x="7" y="12" width="3" height="6" rx="1" />
        <rect x="12.5" y="8" width="3" height="10" rx="1" />
        <rect x="18" y="4.5" width="3" height="13.5" rx="1" />
      </>
    ),
  },
  {
    to: "/dashboard/check-slots",
    label: "Check Slots",
    hint: "view bookings",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
      </>
    ),
  },
];

export default function Dashboard() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { published } = useDeployment();
  const navigate = useNavigate();
  const location = useLocation();

  // Close the mobile drawer whenever the route changes
  useEffect(() => setOpen(false), [location.pathname]);

  const current = NAV.find((n) => location.pathname.includes(n.to)) || NAV[0];

  const onLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="db">
      <aside className={`db-side ${open ? "is-open" : ""}`}>
        <Link to="/" className="db-brand">
          <Logo size={24} />
          <span>Receptix</span>
        </Link>

        <div className={`db-live ${published ? "is-live" : ""}`}>
          <span className="db-live-dot" />
          <div className="db-live-text">
            <span className="db-live-state">{published ? "Live" : "Offline"}</span>
            <span className="db-live-sub mono">
              {published ? "customers can chat" : "not published yet"}
            </span>
          </div>
        </div>

        <nav className="db-nav" aria-label="Dashboard">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `db-nav-item ${isActive ? "is-active" : ""}`}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
              <span className="db-nav-label">{item.label}</span>
              <span className="db-nav-hint">{item.hint}</span>
            </NavLink>
          ))}
        </nav>

        <div className="db-side-foot">
          <div className="db-user">
            <span className="db-avatar" aria-hidden="true">
              {(user?.email || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="db-user-text">
              <span className="db-user-email" title={user?.email}>
                {user?.email || "signed in"}
              </span>
              <span className="db-user-plan mono">standard plan</span>
            </div>
          </div>
          <button className="db-logout" type="button" onClick={onLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {open && <div className="db-scrim" onClick={() => setOpen(false)} />}

      <div className="db-main">
        <header className="db-topbar">
          <button
            className="db-burger"
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <span />
            <span />
            <span />
          </button>
          <span className="db-topbar-title">{current.label}</span>
          <span className={`db-topbar-live ${published ? "is-live" : ""}`}>
            {published ? "live" : "offline"}
          </span>
        </header>

        <div className="db-content">
          <Routes>
            <Route index element={<Navigate to="/dashboard/chatbot" replace />} />
            <Route path="chatbot" element={<ChatbotPanel />} />
            <Route path="ingestion" element={<IngestionPanel />} />
            <Route path="evaluations" element={<EvaluationsPanel />} />
            <Route path="check-slots" element={<CheckSlotsPanel />} />
            <Route path="*" element={<Navigate to="/dashboard/chatbot" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
