import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchPublicUrl, setPublishStatus } from "./api.js";

/**
 * Publish state for the tenant's front desk.
 *
 * The live/unlive switch is held client-side, but the shareable URL comes from
 * the backend's /get-url endpoint (the `links` table) so the dashboard and the
 * database agree on what customers are handed.
 */

const STORAGE_KEY = "receptix.deployment";

const DEFAULTS = {
  published: false,
  slug: "acme-clinic",
  botName: "Receptix Front Desk",
  greeting: "Hi! I'm the front desk assistant. Ask me anything — hours, services, or booking a visit.",
  publishedAt: null,
};

const DeploymentContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function DeploymentProvider({ children }) {
  const [deployment, setDeployment] = useState(readStored);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [urlLoaded, setUrlLoaded] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deployment));
  }, [deployment]);

  useEffect(() => {
    // the shareable link and the live state live in the backend `links`
    // table, not in the browser; a fetch failure (e.g. no session yet)
    // leaves the stored values in place
    fetchPublicUrl()
      .then((data) => {
        setRemoteUrl(data?.url || "");
        setDeployment((d) => ({
          ...d,
          published: Boolean(data?.published),
          publishedAt: data?.published ? d.publishedAt ?? Date.now() : null,
        }));
      })
      .catch(() => {})
      .finally(() => setUrlLoaded(true));
  }, []);

  const value = useMemo(() => {
    const update = (patch) => setDeployment((d) => ({ ...d, ...patch }));
    // the shareable code lives in the backend `links` table; the local slug
    // is only a cached fallback, and only once the real fetch has settled —
    // otherwise the dashboard flashes a stale/placeholder slug before the
    // real one arrives
    const code = urlLoaded ? remoteUrl || deployment.slug || "front-desk" : "";
    return {
      ...deployment,
      update,
      // the backend owns the live state: flip locally and tell /set-publish
      setPublished: (published) => {
        update({ published, publishedAt: published ? Date.now() : null });
        setPublishStatus(published).catch(() => {});
      },
      urlLoaded,
      publicSlug: code,
      // BASE_URL carries its own trailing slash, and is the repo subpath on
      // Pages — without it the shared link would 404 off the site root.
      publicUrl: code
        ? `${window.location.origin}${import.meta.env.BASE_URL}c/${code}`
        : "",
    };
  }, [deployment, remoteUrl, urlLoaded]);

  return (
    <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>
  );
}

export function useDeployment() {
  const ctx = useContext(DeploymentContext);
  if (!ctx) throw new Error("useDeployment must be used inside <DeploymentProvider>");
  return ctx;
}
