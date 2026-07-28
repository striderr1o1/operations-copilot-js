import { useCallback, useRef, useState } from "react";
import { streamQuery } from "./api.js";
import { formatTime } from "./hooks.js";

/**
 * Drives one conversation against /query-agent.
 *
 * The transcript is a flat, ordered list so reasoning blocks stay wherever they
 * happened relative to the messages around them:
 *   { kind: "user" | "assistant" | "thinking", ... }
 *
 * `withThinking: false` (the customer-facing page) keeps the same stream
 * handling but drops the reasoning blocks from the transcript, leaving a plain
 * typing indicator.
 */

let seq = 0;
const nextId = () => `i${(seq += 1)}`;

const AGENT_EVENT = {
  "knowledge base agent": "knowledge_base_agent",
  "booking agent": "booking_agent",
};

export function useAgentChat({ withThinking = true, greeting = "" } = {}) {
  const [items, setItems] = useState(() =>
    greeting
      ? [{ id: nextId(), kind: "assistant", text: greeting, time: formatTime() }]
      : []
  );
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const log = useCallback((text, node = "sys") => {
    setLogs((prev) => [...prev, { id: nextId(), time: formatTime(), node, text }]);
  }, []);

  const patch = useCallback((id, changes) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));
  }, []);

  const push = useCallback((item) => {
    const withId = { id: nextId(), time: formatTime(), ...item };
    setItems((prev) => [...prev, withId]);
    return withId.id;
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setItems(
      greeting
        ? [{ id: nextId(), kind: "assistant", text: greeting, time: formatTime() }]
        : []
    );
    setLogs([]);
    setError("");
    setBusy(false);
  }, [greeting]);

  const send = useCallback(
    async (raw) => {
      const query = raw.trim();
      if (!query || busy) return;

      setBusy(true);
      setError("");
      push({ kind: "user", text: query });
      log(query, "query");

      const controller = new AbortController();
      abortRef.current = controller;

      // Reasoning blocks, keyed by the agent they belong to, so a later event
      // can fill in the block that was opened when routing was announced.
      const blocks = {};
      let orchestratorId = null;

      if (withThinking) {
        orchestratorId = push({
          kind: "thinking",
          label: "orchestrator",
          text: "analyzing…",
          loading: true,
        });
      }

      let answered = false;
      // The backend's stream generator indexes update['tool_calls'] directly, so
      // an orchestrator that swallowed its own exception kills the stream before
      // the final frame. The sub-agent already told us the answer by then — keep
      // it so we can serve that instead of apologising.
      let lastAgentOutput = "";
      // The orchestrator node runs again once its sub-agents return, and that
      // pass carries an empty tool list. Empty means "nothing further to route"
      // then — only an empty list on the *first* pass means it answered alone.
      let routed = false;

      try {
        await streamQuery(
          query,
          (event) => {
            switch (event.event) {
              case "agent calls": {
                const names = Array.isArray(event.data)
                  ? event.data.map((c) => c?.tool || "?")
                  : [];
                const priorRouted = routed;
                routed = routed || names.length > 0;

                if (names.length) {
                  log(`routing: ${names.join(", ")}`, "orch");
                } else {
                  log(priorRouted ? "no further routing" : "answering directly", "orch");
                }
                if (!withThinking) break;

                patch(orchestratorId, {
                  text: names.length
                    ? `routing to ${names.join(", ")}`
                    : priorRouted
                      ? "composing the reply"
                      : "answering directly",
                  loading: true,
                });

                names.forEach((name) => {
                  blocks[name] = push({
                    kind: "thinking",
                    label: name.replace(/_/g, " "),
                    text: "working…",
                    loading: true,
                  });
                  log(`${name.replace(/_/g, " ")} active`, name);
                });
                break;
              }

              case "knowledge base agent":
              case "booking agent": {
                const key = AGENT_EVENT[event.event];
                log(`${key.replace(/_/g, " ")} responded`, key);
                const text = String(event.data ?? "").trim();
                if (text) lastAgentOutput = text;
                if (!withThinking) break;

                const id = blocks[key];
                if (id) patch(id, { text: String(event.data ?? ""), loading: false });
                else
                  push({
                    kind: "thinking",
                    label: key.replace(/_/g, " "),
                    text: String(event.data ?? ""),
                    loading: false,
                  });
                break;
              }

              case "final response": {
                answered = true;
                if (withThinking) {
                  patch(orchestratorId, { loading: false });
                  Object.values(blocks).forEach((id) => patch(id, { loading: false }));
                }
                push({ kind: "assistant", text: String(event.data ?? "") });
                log("delivered", "orch");
                break;
              }

              default:
                break;
            }
          },
          { signal: controller.signal }
        );

        // The stream can close without a final frame if the graph errored out.
        if (!answered) {
          if (withThinking) {
            Object.values(blocks).forEach((id) => patch(id, { loading: false }));
          }
          push({
            kind: "assistant",
            text:
              lastAgentOutput ||
              "I didn't manage to put an answer together for that one. Try rephrasing?",
          });
          log(
            lastAgentOutput
              ? "no final frame — served the sub-agent's answer"
              : "stream ended with no final response",
            lastAgentOutput ? "orch" : "error"
          );
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        const message = err.message || "request failed";
        setError(message);
        if (withThinking && orchestratorId) {
          patch(orchestratorId, { text: `error: ${message}`, loading: false });
        }
        push({ kind: "assistant", text: `Something went wrong: ${message}` });
        log(message, "error");
      } finally {
        if (withThinking) {
          patch(orchestratorId, { loading: false });
        }
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, log, patch, push, withThinking]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, []);

  return { items, logs, busy, error, send, stop, reset, log };
}
