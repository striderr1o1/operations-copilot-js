import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Session lives in localStorage so a refresh doesn't bounce you back to the
// login page. The backend hands back { user, session } — we keep both.

const STORAGE_KEY = "receptix.session";

const AuthContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // expires_at is a unix timestamp in seconds; drop the session once it's past
    if (parsed?.session?.expires_at && parsed.session.expires_at * 1000 < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStored);

  useEffect(() => {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(STORAGE_KEY);
  }, [auth]);

  const login = useCallback((payload) => setAuth(payload), []);
  const logout = useCallback(() => setAuth(null), []);

  const value = useMemo(
    () => ({
      user: auth?.user ?? null,
      session: auth?.session ?? null,
      // Email confirmation is on server-side, so a fresh signup has a user but
      // no session. Treat "has a user record" as signed in for the dashboard.
      isAuthed: Boolean(auth?.user),
      login,
      logout,
    }),
    [auth, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
