import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Publish state for the tenant's front desk.
 *
 * The backend has no deployment endpoints yet — /query-agent is always live —
 * so the live/unlive switch and the shareable URL are held client-side. When
 * the API grows a deployments route this is the one file that has to change.
 */

const STORAGE_KEY = "receptix.deployment";

const DEFAULTS = {
  published: false,
  slug: "acme-clinic",
  namespace: "",
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deployment));
  }, [deployment]);

  const value = useMemo(() => {
    const update = (patch) => setDeployment((d) => ({ ...d, ...patch }));
    return {
      ...deployment,
      update,
      setPublished: (published) =>
        update({ published, publishedAt: published ? Date.now() : null }),
      // BASE_URL carries its own trailing slash, and is the repo subpath on
      // Pages — without it the shared link would 404 off the site root.
      publicUrl: `${window.location.origin}${import.meta.env.BASE_URL}c/${
        deployment.slug || "front-desk"
      }`,
    };
  }, [deployment]);

  return (
    <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>
  );
}

export function useDeployment() {
  const ctx = useContext(DeploymentContext);
  if (!ctx) throw new Error("useDeployment must be used inside <DeploymentProvider>");
  return ctx;
}
