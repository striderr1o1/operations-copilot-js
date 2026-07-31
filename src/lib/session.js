/**
 * The stored login session, owned in one place.
 *
 * Both the React auth context and the plain fetch helpers in api.js need it,
 * and api.js is not a component — it can't reach into context. Keeping the key
 * and the expiry rule here means there is one definition of "logged in" rather
 * than two that can drift apart.
 */

const STORAGE_KEY = "receptix.session";
const EXPIRED_EVENT = "receptix:session-expired";

/** Supabase reports expires_at in unix *seconds*. */
function isExpired(session) {
  return Boolean(session?.expires_at) && session.expires_at * 1000 < Date.now();
}

/** The stored `{ user, session }`, or null if absent, unparseable or expired. */
export function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isExpired(parsed?.session)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(payload) {
  if (payload) localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  else localStorage.removeItem(STORAGE_KEY);
}

/**
 * The JWT for `Authorization: Bearer`, or "" when there is no live session.
 *
 * Read from storage on each call rather than cached at import time: the fetch
 * helpers hold no subscription to the auth context, so a logout — here or in
 * another tab — has to take effect on the very next request.
 */
export function getAccessToken() {
  return readSession()?.session?.access_token || "";
}

/**
 * Drop a session the backend has already rejected, and tell the app.
 *
 * api.js can clear storage on a 401 but can't touch React state, so without the
 * event the UI would keep rendering the dashboard around a dead token until the
 * next reload.
 */
export function expireSession() {
  writeSession(null);
  window.dispatchEvent(new Event(EXPIRED_EVENT));
}

/** Subscribe to expireSession(); returns the unsubscribe function. */
export function onSessionExpired(handler) {
  window.addEventListener(EXPIRED_EVENT, handler);
  return () => window.removeEventListener(EXPIRED_EVENT, handler);
}
