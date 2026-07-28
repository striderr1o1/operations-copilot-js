import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";
import "./Footer.css";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
      { label: "Dashboard", to: "/dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Get going",
    links: [
      { label: "Sign up", to: "/get-started" },
      { label: "Login", to: "/login" },
    ],
  },
];

export default function Footer() {
  const scrollTo = (e, href) => {
    e.preventDefault();
    document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <Logo size={24} />
            <span>Receptix</span>
          </Link>
          <p className="footer-tag">
            The AI front desk that answers, books and hands over — trained on
            your documents, live on your URL.
          </p>
        </div>

        <nav className="footer-cols" aria-label="Footer">
          {COLUMNS.map((col) => (
            <div className="footer-col" key={col.title}>
              <h3 className="footer-col-title mono">{col.title}</h3>
              <ul>
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to}>{link.label}</Link>
                    ) : (
                      <a href={link.href} onClick={(e) => scrollTo(e, link.href)}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="shell footer-base">
        <p>© {new Date().getFullYear()} Receptix. All rights reserved.</p>
        <p className="mono footer-status">
          <span className="footer-dot" />
          all systems operational
        </p>
      </div>
    </footer>
  );
}
