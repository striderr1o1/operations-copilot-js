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
const RETRY_MS = 4000;

const DEFAULTS = {
  published: false,
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
    // table, not in the browser. Until the backend hands back a real code the
    // dashboard has nothing to show, so keep asking (a fetch failure is often
    // just the session not being ready yet) instead of inventing a slug.
    let alive = true;
    let timer;

    const load = () => {
      fetchPublicUrl()
        .then((data) => {
          if (!alive) return;
          const url = data?.url || "";
          setRemoteUrl(url);
          setDeployment((d) => ({
            ...d,
            published: Boolean(data?.published),
            publishedAt: data?.published ? d.publishedAt ?? Date.now() : null,
          }));
          if (url) setUrlLoaded(true);
          else timer = setTimeout(load, RETRY_MS);
        })
        .catch(() => {
          if (alive) timer = setTimeout(load, RETRY_MS);
        });
    };

    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const value = useMemo(() => {
    const update = (patch) => setDeployment((d) => ({ ...d, ...patch }));
    // the shareable code lives in the backend `links` table and nowhere else —
    // there is no local placeholder, so the dashboard stays in its loading
    // state until the real code arrives rather than showing an invented one
    const code = urlLoaded ? remoteUrl : "";
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
