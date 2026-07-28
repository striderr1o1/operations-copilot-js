import { useRef, useState } from "react";
import { ingestPdf } from "../../lib/api.js";
import { useDeployment } from "../../lib/deployment.jsx";
import { formatTime } from "../../lib/hooks.js";
import "./IngestionPanel.css";

const MAX_MB = 25;

function prettySize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IngestionPanel() {
  const { namespace, update } = useDeployment();
  const [file, setFile] = useState(null);
  const [ns, setNs] = useState(namespace || "");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);

  const ready = Boolean(file) && ns.trim().length > 0 && !busy;

  const pick = (candidate) => {
    setError("");
    if (!candidate) return;
    const isPdf =
      candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setError("Only PDF files can be ingested.");
    if (candidate.size > MAX_MB * 1024 * 1024)
      return setError(`That file is over the ${MAX_MB} MB limit.`);
    setFile(candidate);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const record = (entry) =>
    setHistory((prev) => [{ id: `${Date.now()}`, time: formatTime(), ...entry }, ...prev]);

  async function ingest() {
    if (!ready) return;
    const namespaceName = ns.trim();

    setBusy(true);
    setError("");
    try {
      await ingestPdf(file, namespaceName);
      record({ name: file.name, size: file.size, namespace: namespaceName, ok: true });
      // Remember the namespace so the next upload defaults to the same corpus
      update({ namespace: namespaceName });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      const message = err.message || "ingestion failed";
      setError(message);
      record({
        name: file.name,
        size: file.size,
        namespace: namespaceName,
        ok: false,
        message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-page">
      <header className="panel-head">
        <div className="panel-head-text">
          <span className="panel-title">Ingestion</span>
          <span className="panel-sub">
            Add PDFs to the knowledge base your agent answers from.
          </span>
        </div>
        {namespace && (
          <span className="ing-current mono">
            active namespace · {namespace}
          </span>
        )}
      </header>

      <div className="panel-body">
        <div className="ing-grid">
          <section className="ing-card card">
            <label
              className={`ing-drop ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(e) => pick(e.target.files?.[0])}
              />

              <span className="ing-drop-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                  <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <polyline points="9 14 12 11 15 14" />
                </svg>
              </span>

              {file ? (
                <>
                  <span className="ing-drop-name">{file.name}</span>
                  <span className="ing-drop-hint mono">
                    {prettySize(file.size)} · click to replace
                  </span>
                </>
              ) : (
                <>
                  <span className="ing-drop-name">Drop a PDF here</span>
                  <span className="ing-drop-hint mono">
                    or click to browse · max {MAX_MB} MB
                  </span>
                </>
              )}
            </label>

            <div className="field ing-ns">
              <span className="field-label">Namespace</span>
              <input
                className="field-input"
                value={ns}
                onChange={(e) => setNs(e.target.value)}
                placeholder="e.g. clinic-policies"
                autoComplete="off"
                spellCheck="false"
              />
              <span className="ing-ns-note">
                Documents are isolated per namespace. Retrieval only searches the
                one your agent is pointed at.
              </span>
            </div>

            {error && <p className="ing-error">{error}</p>}

            <button className="btn btn-primary btn-block" type="button" onClick={ingest} disabled={!ready}>
              {busy ? (
                <>
                  <span className="ing-spinner" />
                  Ingesting…
                </>
              ) : (
                "Ingest document"
              )}
            </button>

            {busy && (
              <div className="ing-progress" role="progressbar" aria-label="Ingesting">
                <span />
              </div>
            )}
          </section>

          <section className="ing-side">
            <article className="ing-note card">
              <h3 className="ing-note-title">What happens on ingest</h3>
              <ol className="ing-steps">
                <li>The PDF is parsed and split into overlapping chunks.</li>
                <li>Each chunk is embedded into a 1024-dimension vector.</li>
                <li>Vectors land in your namespace on the vector index.</li>
                <li>The knowledge base agent retrieves from it on the next question.</li>
              </ol>
              <p className="ing-note-warn">
                Ingestion and retrieval share one embedding model — mixing models
                across a namespace makes the vectors incomparable.
              </p>
            </article>

            <article className="ing-history card">
              <h3 className="ing-note-title">This session</h3>
              {history.length === 0 ? (
                <p className="ing-empty mono">nothing ingested yet</p>
              ) : (
                <ul className="ing-list">
                  {history.map((h) => (
                    <li key={h.id} className={h.ok ? "is-ok" : "is-fail"}>
                      <span className="ing-list-dot" />
                      <div className="ing-list-text">
                        <span className="ing-list-name">{h.name}</span>
                        <span className="ing-list-meta mono">
                          {h.namespace} · {prettySize(h.size)} · {h.time}
                        </span>
                        {!h.ok && <span className="ing-list-err">{h.message}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        </div>
      </div>
    </div>
  );
}
