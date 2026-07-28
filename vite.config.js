import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

// GitHub Pages serves this repo from a subpath, so the production bundle is
// built with base=/operations-copilot-js/. Dev keeps base=/ so local URLs (and
// tests/e2e.mjs) stay at the root.
const REPO = "/operations-copilot-js/";

// Pages has no SPA rewrite: a deep link like /dashboard/chatbot is a real 404
// on its server. Shipping index.html as 404.html means Pages still hands the
// browser the app, and the router then reads the real path and renders it.
function spaFallback(outDir) {
  return {
    name: "gh-pages-spa-fallback",
    apply: "build",
    closeBundle() {
      const dir = resolve(outDir);
      copyFileSync(resolve(dir, "index.html"), resolve(dir, "404.html"));
    },
  };
}

// `command` is "serve" for both dev and preview, so isPreview is what separates
// them: preview serves the built bundle and must mirror the Pages subpath, while
// dev stays at the root (tests/e2e.mjs drives it there).
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? REPO : "/",
  plugins: [react(), spaFallback("dist")],
  // 5173 is on the CORS allowlist hardcoded in the backend's src/main.py (so is
  // 3000 — swap if you prefer it and nothing else is bound there).
  server: { port: 5173, host: true, strictPort: true },
  preview: { port: 5173, host: true, strictPort: true },
}));
