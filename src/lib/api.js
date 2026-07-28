// Single place that knows where the backend lives.
// `?api=http://127.0.0.1:8000` in the URL overrides it for local work, matching
// the behaviour the old static pages had.

const DEFAULT_API =
  "https://ai-workspace-operations-copilot-production.up.railway.app";

function resolveBase() {
  if (typeof window === "undefined") return DEFAULT_API;
  const fromQuery = new URLSearchParams(window.location.search).get("api");
  const base = fromQuery || import.meta.env.VITE_API_BASE || DEFAULT_API;
  return base.replace(/\/+$/, "");
}

export const API_BASE = resolveBase();

/** Throw with the backend's `detail` when there is one, else the status code. */
async function unwrap(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      (data && (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))) ||
      `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return data;
}

export async function apiGet(path) {
  return unwrap(await fetch(`${API_BASE}${path}`));
}

export async function apiPost(path, body) {
  return unwrap(
    await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

export async function apiUpload(path, formData) {
  return unwrap(
    await fetch(`${API_BASE}${path}`, { method: "POST", body: formData })
  );
}

// ---- auth ----

export const signUp = (email, password) => apiPost("/auth/signup", { email, password });
export const signIn = (email, password) => apiPost("/auth/login", { email, password });

// ---- evals ----

export const fetchDataset = () => apiGet("/eval/dataset");
export const runEvalCategory = (endpoint) => apiPost(`/eval/${endpoint}`);

// ---- ingestion ----

export function ingestPdf(file, namespace) {
  const form = new FormData();
  form.append("file", file);
  form.append("namespace_name", namespace);
  return apiUpload("/ingestion", form);
}

/**
 * POST /query-agent and walk the SSE stream, invoking `onEvent` for each
 * `data:` frame. The backend emits "agent calls", "knowledge base agent",
 * "booking agent" and "final response".
 */
export async function streamQuery(query, onEvent, { signal } = {}) {
  const res = await fetch(`${API_BASE}/query-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error("streaming is not supported by this browser");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (chunk) => {
    if (!chunk.startsWith("data: ")) return;
    try {
      onEvent(JSON.parse(chunk.slice(6).trim()));
    } catch {
      /* half-written frame — the next read completes it */
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    parts.forEach(flush);
  }

  flush(buffer);
}
