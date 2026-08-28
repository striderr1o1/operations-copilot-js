// Single place that knows where the backend lives.
// `?api=http://127.0.0.1:8000` in the URL overrides it for local work, matching
// the behaviour the old static pages had.

import { expireSession, getAccessToken } from "./session.js";

const DEFAULT_API = "https://ai-workspace-operations-copilot-production.up.railway.app/";
//const DEFAULT_API = "http://localhost:8000"

function resolveBase() {
  if (typeof window === "undefined") return DEFAULT_API;
  const fromQuery = new URLSearchParams(window.location.search).get("api");
  const base = fromQuery || import.meta.env.VITE_API_BASE || DEFAULT_API;
  return base.replace(/\/+$/, "");
}

export const API_BASE = resolveBase();

/**
 * Add the bearer token when we have one.
 *
 * `/query-agent`, `/ingestion` and the slot/link endpoints all sit behind the
 * backend's check_session_exists dependency, which reads
 * `Authorization: Bearer <jwt>`.
 * `extra` stays optional because multipart uploads must let the browser set
 * Content-Type itself — it carries the boundary.
 */
function authHeaders(extra) {
  const token = getAccessToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

/** Throw with the backend's `detail` when there is one, else the status code. */
async function unwrap(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A rejected token is dead for every later call too, so drop it here rather
    // than letting each panel discover the same 401 on its own.
    if (res.status === 401) expireSession();
    const detail =
      (data && (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))) ||
      `HTTP ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function apiGet(path) {
  return unwrap(await fetch(`${API_BASE}${path}`, { headers: authHeaders() }));
}

export async function apiPost(path, body) {
  return unwrap(
    await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

export async function apiUpload(path, formData) {
  return unwrap(
    await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    })
  );
}

// ---- auth ----

export const signUp = (email, password) => apiPost("/auth/signup", { email, password });
export const signIn = (email, password) => apiPost("/auth/login", { email, password });

// ---- deployment ----

export const fetchPublicUrl = () => apiGet("/get-url");
export const setPublishStatus = (published) => apiPost("/set-publish", { published });

// ---- ingestion ----

export function ingestPdf(file) {
  const form = new FormData();
  form.append("file", file);
  return apiUpload("/ingestion", form);
}

/**
 * List the documents ingested into the knowledge base — one entry per
 * ingested document (a row in the `ingestions` table), not per chunk.
 * Returns a bare array of `{ ingestion_id, source_name }`; `source_name`
 * may be null.
 */
export const fetchIngestions = () => apiGet("/get-record-count");

/**
 * Delete one ingested document. Same shape as deleteSlot: the row already
 * gives us everything the backend needs, so both fields travel straight
 * through — `sourceName` may be null and is sent as-is.
 */
export const deleteIngestion = (ingestionId, sourceName) =>
  apiPost("/delete-ingested-source", { ingestion_id: ingestionId, source_name: sourceName });

// ---- slots ----

export const fetchSlots = async () => {
  const data = await apiGet("/get-slots-data");
  const slots = (data?.slots ?? []).map(
    ({ slotid, time_start, time_end, occupier_email, status }) => ({
      // the uuid primary key on the slots table — what /delete-slot needs
      slotid,
      time_start,
      time_end,
      occupier_email,
      status,
    })
  );
  return { ...data, slots };
};

/**
 * Create a slot the owner blocked out themselves. Only the two times travel —
 * the backend owns the rest of the row (no occupier, status starts pending).
 * Times are ISO 8601 with an explicit offset, matching the booking tool.
 */
export const addSlot = ({ time_start, time_end }) =>
  apiPost("/add-slot", { time_start, time_end });

/**
 * Remove one slot. The row carries the uuid as `slotid` (the column name),
 * while /delete-slot's SlotDeletion model reads it as `slot_id`.
 */
export const deleteSlot = (slotid) => apiPost("/delete-slot", { slot_id: slotid });

/**
 * POST /query-agent and walk the SSE stream, invoking `onEvent` for each
 * `data:` frame. The backend emits "agent calls", "knowledge base agent",
 * "booking agent" and "final response".
 */
export async function streamQuery(query, onEvent, { signal, id } = {}) {
  const res = await fetch(`${API_BASE}${id ? `/c/query-agent/${id}` : "/query-agent"}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok) {
    // Nothing streams on the error path — the dependency raises before
    // StreamingResponse is ever built — so this body is plain JSON and worth
    // reading for its `detail` instead of reporting a bare status code.
    if (res.status === 401) expireSession();
    const detail = await res
      .json()
      .then((d) => (typeof d?.detail === "string" ? d.detail : null))
      .catch(() => null);
    const err = new Error(detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
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
