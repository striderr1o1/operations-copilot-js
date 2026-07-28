import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import "./NotFound.css";

export default function NotFound() {
  return (
    <main className="nf">
      <div className="nf-card">
        <Link to="/" className="nf-brand">
          <Logo size={22} />
          <span>Receptix</span>
        </Link>
        <p className="nf-code mono">404</p>
        <h1 className="nf-title">Nobody's at this desk.</h1>
        <p className="nf-body">
          The page you asked for isn't here. The front desk, however, is always
          in.
        </p>
        <div className="nf-actions">
          <Link to="/" className="btn btn-primary">
            Back home
          </Link>
          <Link to="/dashboard" className="btn btn-ghost">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
