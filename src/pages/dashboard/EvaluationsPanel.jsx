import { useEffect, useMemo, useState } from "react";
import { fetchDataset, runEvalCategory } from "../../lib/api.js";
import { formatElapsed, useElapsed } from "../../lib/hooks.js";
import "./EvaluationsPanel.css";

// Port of the standalone evaluations page: pick a category, inspect the
// scenarios it will run, then POST /eval/<endpoint> and render the report.

const label = (category = "") => category.replace(/_/g, " ");

export default function EvaluationsPanel() {
  const [dataset, setDataset] = useState(null);
  const [datasetError, setDatasetError] = useState("");
  const [category, setCategory] = useState("");
  const [report, setReport] = useState(null);
  const [runError, setRunError] = useState("");
  const [running, setRunning] = useState(false);
  const { elapsed, start, stop } = useElapsed();

  useEffect(() => {
    let alive = true;
    fetchDataset()
      .then((data) => alive && setDataset(data))
      .catch((err) => alive && setDatasetError(err.message || "dataset unavailable"));
    return () => {
      alive = false;
    };
  }, []);

  const categories = dataset?.categories ?? [];

  const scenarios = useMemo(() => {
    if (!dataset || !category) return [];
    return (dataset.scenarios || []).filter((s) => s.category === category);
  }, [dataset, category]);

  const meta = categories.find((c) => c.category === category);

  async function run() {
    if (!category || running) return;
    const endpoint = meta?.endpoint || category.replace(/_/g, "-");

    setRunning(true);
    setRunError("");
    setReport(null);
    start();
    try {
      setReport(await runEvalCategory(endpoint));
    } catch (err) {
      setRunError(err.message || "evaluation failed");
    } finally {
      stop();
      setRunning(false);
    }
  }

  return (
    <div className="panel-page">
      <header className="panel-head">
        <div className="panel-head-text">
          <span className="panel-title">Evaluations</span>
          <span className="panel-sub">
            Replay scenarios against the live orchestrator and grade the routing.
          </span>
        </div>
        <span className="ev-dataset mono">
          {datasetError
            ? "dataset unavailable"
            : dataset
              ? `${dataset.name || "dataset"} v${dataset.version ?? "?"} · ${
                  (dataset.scenarios || []).length
                } cases`
              : "loading dataset…"}
        </span>
      </header>

      <div className="panel-body">
        {/* scenario picker */}
        <section className="ev-block card">
          <div className="ev-block-head">
            <span className="ev-block-title">Scenario</span>
            <span className="ev-block-note mono">
              {meta ? `post /eval/${meta.endpoint}` : "pick a category"}
            </span>
          </div>

          <div className="ev-select-row">
            <div className="ev-select-wrap">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!dataset || running}
                aria-label="Evaluation category"
              >
                <option value="">— select a scenario —</option>
                {categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {label(c.category)} ({c.count})
                  </option>
                ))}
              </select>
              <svg className="ev-select-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            <button
              className={`ev-play ${running ? "is-running" : ""}`}
              type="button"
              onClick={run}
              disabled={!category || running}
              title="Run evaluation"
              aria-label="Run evaluation"
            >
              {running ? (
                <span className="ev-play-spinner" />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="7 4 20 12 7 20" />
                </svg>
              )}
              <span className="ev-play-label">{running ? "Running" : "Run"}</span>
            </button>
          </div>

          {datasetError && <p className="ev-error">could not load dataset: {datasetError}</p>}
        </section>

        {/* dataset preview */}
        <section className="ev-block card">
          <div className="ev-block-head">
            <span className="ev-block-title">Dataset</span>
            <span className="ev-block-note mono">
              {scenarios.length ? `${scenarios.length} cases` : "no scenario selected"}
            </span>
          </div>
          <pre className="ev-json">
            {scenarios.length
              ? JSON.stringify(scenarios, null, 2)
              : "select a scenario to view its cases"}
          </pre>
        </section>

        {/* results */}
        <section className="ev-block card">
          <div className="ev-block-head">
            <span className="ev-block-title">Results</span>
            <span className="ev-block-note mono">
              {running
                ? `running · ${formatElapsed(elapsed)}`
                : runError
                  ? "failed"
                  : report
                    ? `${label(report.category)} · ${report.passed}/${report.total} passed`
                    : "not run yet"}
            </span>
          </div>

          {report && <Summary report={report} />}

          <div className="ev-results">
            {running ? (
              <Placeholder
                title={`grading ${label(category)}`}
                sub="the orchestrator runs every case — this takes a while"
              />
            ) : runError ? (
              <p className="ev-error">evaluation failed: {runError}</p>
            ) : !report ? (
              <Placeholder title="no run yet" sub="pick a scenario and hit run" />
            ) : report.cases?.length ? (
              <ResultsTable cases={report.cases} />
            ) : (
              <Placeholder title="no cases returned" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Placeholder({ title, sub }) {
  return (
    <div className="ev-placeholder">
      <span className="ev-placeholder-mark mono">///</span>
      <span className="ev-placeholder-title">{title}</span>
      {sub && <span className="ev-placeholder-sub">{sub}</span>}
    </div>
  );
}

function Summary({ report }) {
  const rate = report.total ? Math.round((report.passed / report.total) * 100) : 0;
  const stats = [
    { label: "total", value: report.total ?? 0 },
    { label: "passed", value: report.passed ?? 0, tone: "pass" },
    { label: "failed", value: report.failed ?? 0, tone: "fail" },
    { label: "pass rate", value: report.total ? `${rate}%` : "—" },
  ];

  return (
    <div className="ev-summary">
      {stats.map((s) => (
        <div className={`ev-stat ${s.tone || ""}`} key={s.label}>
          <span className="ev-stat-value">{s.value}</span>
          <span className="ev-stat-label">{s.label}</span>
        </div>
      ))}
      <div className="ev-rate-bar" aria-hidden="true">
        <span style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

function ResultsTable({ cases }) {
  return (
    <div className="ev-table-wrap">
      <table className="ev-table">
        <thead>
          <tr>
            <th className="ev-col-id">#</th>
            <th className="ev-col-verdict">correctness</th>
            <th className="ev-col-query">query</th>
            <th>actual agent output</th>
            <th>expected result</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className={c.correct ? "is-pass" : "is-fail"}>
              <td className="ev-cell-id mono">{String(c.id)}</td>
              <td>
                <span className={`ev-verdict ${c.correct ? "pass" : "fail"}`}>
                  {c.correct ? "match" : "mismatch"}
                </span>
              </td>
              <td className="ev-cell-query">{c.query || "—"}</td>
              <td>
                <Actual actual={c.actual} />
              </td>
              <td>
                <Expected expected={c.expected} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fact({ label: key, value, muted, clamp }) {
  return (
    <div className="ev-fact">
      <span className="ev-fact-key">{key}</span>
      <span className={`ev-fact-value ${muted ? "is-muted" : ""} ${clamp ? "is-clamped" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Raw({ label: title, value }) {
  return (
    <details className="ev-raw">
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

const toolNames = (calls) =>
  Array.isArray(calls) ? calls.map((c) => (c && c.tool) || "?") : [];

/**
 * The graders assert different things per category, so this shows the three
 * fields any of them can turn on: which agents were queued, whether the run
 * stopped, and what the user would have been told.
 *
 * A missing `tool_calls` key is meaningful — the orchestrator swallows its own
 * exceptions and returns only a decision plus an error string, so the absence
 * of the key is how a crash is distinguished from a clean "give up".
 */
function Actual({ actual }) {
  if (!actual || typeof actual !== "object") {
    return (
      <div className="ev-facts">
        <Fact label="output" value="none" muted />
      </div>
    );
  }

  const tools = toolNames(actual.tool_calls);
  const hasToolCalls = "tool_calls" in actual;
  const response = (actual.response_to_user || "").trim();

  return (
    <>
      <div className="ev-facts">
        <Fact
          label="tools"
          value={
            hasToolCalls
              ? tools.length
                ? tools.join(", ")
                : "none"
              : "missing — orchestrator errored"
          }
          muted={!hasToolCalls || !tools.length}
        />
        <Fact
          label="return"
          value={
            actual.return_to_user_decision === undefined
              ? "—"
              : String(actual.return_to_user_decision)
          }
          muted={actual.return_to_user_decision === undefined}
        />
        <Fact label="reply" value={response || "empty"} muted={!response} clamp />
      </div>
      <Raw label="raw output" value={actual} />
    </>
  );
}

/** Expected is a set of accepted decisions — any one of them passes. */
function Expected({ expected }) {
  const decisions = expected?.decisions || [];

  if (!decisions.length) {
    return (
      <div className="ev-facts">
        <Fact label="decisions" value="none" muted />
      </div>
    );
  }

  return (
    <>
      <div className="ev-facts">
        {decisions.map((d, i) => (
          <div key={i}>
            {i > 0 && <div className="ev-fact-or">or</div>}
            <Fact
              label="tools"
              value={
                Array.isArray(d.tool_calls) && d.tool_calls.length
                  ? d.tool_calls.join(", ")
                  : "none"
              }
              muted={!Array.isArray(d.tool_calls) || !d.tool_calls.length}
            />
            <Fact label="return" value={String(d.return_to_user_decision)} />
          </div>
        ))}
      </div>
      <Raw label="raw expected" value={expected} />
    </>
  );
}
