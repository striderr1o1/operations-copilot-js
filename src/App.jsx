import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { DeploymentProvider } from "./lib/deployment.jsx";
import Home from "./pages/Home.jsx";
import GetStarted from "./pages/GetStarted.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import PublishedChat from "./pages/PublishedChat.jsx";
import NotFound from "./pages/NotFound.jsx";

/** Jump to the top on navigation, except when the URL carries a #hash. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, [pathname, hash]);
  return null;
}

function RequireAuth({ children }) {
  const { isAuthed } = useAuth();
  const location = useLocation();
  if (!isAuthed) {
    return <Navigate to="/get-started" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <DeploymentProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/login" element={<GetStarted mode="login" />} />
          <Route
            path="/dashboard/*"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          {/* What a company shares with its customers — no login required */}
          <Route path="/c/:slug" element={<PublishedChat />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </DeploymentProvider>
    </AuthProvider>
  );
}
