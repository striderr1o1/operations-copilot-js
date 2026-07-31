import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onSessionExpired, readSession, writeSession } from "./session.js";

// Session lives in localStorage so a refresh doesn't bounce you back to the
// login page. The backend hands back { user, session } — we keep both. Storage
// itself is session.js's job, because api.js needs the same token and can't
// read React context.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readSession);

  useEffect(() => {
    writeSession(auth);
  }, [auth]);

  const login = useCallback((payload) => setAuth(payload), []);
  const logout = useCallback(() => setAuth(null), []);

  // api.js fires this when the backend 401s a token we thought was good. Without
  // it the dashboard would keep rendering while every request underneath failed.
  useEffect(() => onSessionExpired(() => setAuth(null)), []);

  const value = useMemo(
    () => ({
      user: auth?.user ?? null,
      session: auth?.session ?? null,
      // The access token, not the user record, is what makes the dashboard
      // usable: every panel calls an endpoint behind check_session_exists. A
      // signup awaiting email confirmation returns a user with no session, and
      // letting that through would land them on a dashboard that only 401s.
      isAuthed: Boolean(auth?.session?.access_token),
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
