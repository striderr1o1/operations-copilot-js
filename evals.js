// Evaluations page — reads the scenario dataset from the backend, lets you pick
// a category, and runs that category's grader through /eval/<endpoint>.
// Pass ?api=http://127.0.0.1:8000 to point at a local server.

const API_BASE =
  new URLSearchParams(location.search).get("api") ||
  "https://ai-workspace-operations-copilot-production.up.railway.app/";

const scenarioSelect = document.getElementById("scenarioSelect");
const scenarioJson = document.getElementById("scenarioJson");
const scenarioNote = document.getElementById("scenarioNote");
const datasetNote = document.getElementById("datasetNote");
const selectMeta = document.getElementById("selectMeta");
const playBtn = document.getElementById("playBtn");
const resultsBody = document.getElementById("resultsBody");
const resultsNote = document.getElementById("resultsNote");
const summaryRow = document.getElementById("summaryRow");
const statTotal = document.getElementById("statTotal");
const statPassed = document.getElementById("statPassed");
const statFailed = document.getElementById("statFailed");
const statRate = document.getElementById("statRate");
const statusIndicator = document.getElementById("statusIndicator");
const statusDot = document.getElementById("statusDot");

let categories = [];
let scenariosByCategory = {};
let isRunning = false;
let timerId = null;

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function label(category) {
  return category.replace(/_/g, " ");
}

function setStatus(active, text) {
  statusIndicator.textContent = text || (active ? "running" : "idle");
  statusIndicator.className = active ? "status-text active" : "status-text";
  statusDot.className = active ? "status-dot active" : "status-dot";
}

// ---- Dataset ----

async function loadDataset() {
  try {
    const res = await fetch(`${API_BASE}/eval/dataset`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    categories = data.categories || [];
    scenariosByCategory = {};
    for (const scenario of data.scenarios || []) {
      (scenariosByCategory[scenario.category] ||= []).push(scenario);
    }

    scenarioSelect.innerHTML =
      `<option value="">— select a scenario —</option>` +
      categories
        .map(
          (c) =>
            `<option value="${escapeHtml(c.category)}">${escapeHtml(label(c.category))} (${c.count})</option>`
        )
        .join("");
    scenarioSelect.disabled = false;

    datasetNote.textContent = `${data.name || "dataset"} v${data.version ?? "?"} · ${(data.scenarios || []).length} cases`;
  } catch (err) {
    datasetNote.textContent = "dataset unavailable";
    scenarioJson.textContent = `could not load dataset: ${err.message}`;
    console.error(err);
  }
}

function onScenarioChange() {
  const category = scenarioSelect.value;
  const scenarios = scenariosByCategory[category];

  if (!category || !scenarios) {
    scenarioJson.textContent = "select a scenario to view its cases";
    scenarioNote.textContent = "no scenario selected";
    selectMeta.textContent = "";
    playBtn.disabled = true;
    return;
  }

  scenarioJson.textContent = JSON.stringify(scenarios, null, 2);
  scenarioJson.scrollTop = 0;
  scenarioNote.textContent = `${scenarios.length} cases`;

  const meta = categories.find((c) => c.category === category);
  selectMeta.textContent = meta ? `post /eval/${meta.endpoint}` : "";
  playBtn.disabled = isRunning;
}

// ---- Run ----

function endpointFor(category) {
  const meta = categories.find((c) => c.category === category);
  return meta ? meta.endpoint : category.replace(/_/g, "-");
}

function startTimer() {
  const started = Date.now();
  const tick = () => {
    const secs = Math.floor((Date.now() - started) / 1000);
    const mins = Math.floor(secs / 60);
    resultsNote.textContent = `running · ${mins ? `${mins}m ` : ""}${secs % 60}s`;
  };
  tick();
  timerId = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

async function runEvaluation() {
  const category = scenarioSelect.value;
  if (isRunning || !category) return;

  isRunning = true;
  playBtn.disabled = true;
  playBtn.classList.add("running");
  scenarioSelect.disabled = true;
  setStatus(true);
  summaryRow.hidden = true;
  resultsBody.innerHTML = `<div class="results-empty">
      <span class="empty-mark">///</span>
      <span class="empty-text">grading ${escapeHtml(label(category))}</span>
      <span class="empty-sub">the orchestrator runs every case — this takes a while</span>
    </div>`;
  startTimer();

  try {
    const res = await fetch(`${API_BASE}/eval/${endpointFor(category)}`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
    renderReport(data);
  } catch (err) {
    resultsNote.textContent = "failed";
    resultsBody.innerHTML = `<div class="error-note">evaluation failed: ${escapeHtml(err.message)}</div>`;
    console.error(err);
  } finally {
    stopTimer();
    isRunning = false;
    playBtn.classList.remove("running");
    playBtn.disabled = !scenarioSelect.value;
    scenarioSelect.disabled = false;
    setStatus(false);
  }
}

// ---- Rendering ----

function toolNames(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls.map((c) => (c && c.tool) || "?");
}

function factLine(key, value, { muted = false, clamp = false } = {}) {
  const cls = `fact-value${muted ? " muted" : ""}${clamp ? " clamp" : ""}`;
  return `<div class="fact"><span class="fact-key">${escapeHtml(key)}</span><span class="${cls}">${escapeHtml(value)}</span></div>`;
}

function rawBlock(label, value) {
  return `<details class="raw"><summary>${escapeHtml(label)}</summary><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></details>`;
}

// The graders assert different things per category, so the cell shows the three
// fields any of them can turn on: which agents were queued, whether the run
// stopped, and what the user would have been told.
function renderActual(actual) {
  if (!actual || typeof actual !== "object") {
    return `<div class="facts">${factLine("output", "none", { muted: true })}</div>`;
  }

  const tools = toolNames(actual.tool_calls);
  const hasToolCalls = "tool_calls" in actual;
  const response = (actual.response_to_user || "").trim();

  const facts = [
    factLine(
      "tools",
      hasToolCalls ? (tools.length ? tools.join(", ") : "none") : "missing — orchestrator errored",
      { muted: !hasToolCalls || !tools.length }
    ),
    factLine(
      "return",
      actual.return_to_user_decision === undefined ? "—" : String(actual.return_to_user_decision),
      { muted: actual.return_to_user_decision === undefined }
    ),
    factLine("reply", response || "empty", { muted: !response, clamp: true }),
  ];

  return `<div class="facts">${facts.join("")}</div>${rawBlock("raw output", actual)}`;
}

// Expected is a set of accepted decisions — any one of them passes.
function renderExpected(expected) {
  const decisions = (expected && expected.decisions) || [];
  if (!decisions.length) {
    return `<div class="facts">${factLine("decisions", "none", { muted: true })}</div>`;
  }

  const blocks = decisions.map((d) => {
    const tools = Array.isArray(d.tool_calls) ? d.tool_calls : [];
    return (
      factLine("tools", tools.length ? tools.join(", ") : "none", { muted: !tools.length }) +
      factLine("return", String(d.return_to_user_decision))
    );
  });

  return `<div class="facts">${blocks.join(`<div class="fact-or">or</div>`)}</div>${rawBlock("raw expected", expected)}`;
}

function renderReport(report) {
  const cases = report.cases || [];
  const rate = report.total ? Math.round((report.passed / report.total) * 100) : 0;

  statTotal.textContent = report.total ?? cases.length;
  statPassed.textContent = report.passed ?? 0;
  statFailed.textContent = report.failed ?? 0;
  statRate.textContent = report.total ? `${rate}%` : "—";
  summaryRow.hidden = false;
  resultsNote.textContent = `${label(report.category || "")} · ${report.passed}/${report.total} passed`;

  if (!cases.length) {
    resultsBody.innerHTML = `<div class="results-empty">
        <span class="empty-mark">///</span>
        <span class="empty-text">no cases returned</span>
      </div>`;
    return;
  }

  const rows = cases
    .map(
      (c) => `<tr class="${c.correct ? "row-pass" : "row-fail"}">
        <td class="cell-id">${escapeHtml(String(c.id))}</td>
        <td><span class="verdict ${c.correct ? "pass" : "fail"}">${c.correct ? "match" : "mismatch"}</span></td>
        <td class="cell-query">${escapeHtml(c.query || "—")}</td>
        <td>${renderActual(c.actual)}</td>
        <td>${renderExpected(c.expected)}</td>
      </tr>`
    )
    .join("");

  resultsBody.innerHTML = `<table class="results-table">
      <thead>
        <tr>
          <th class="col-id">#</th>
          <th class="col-verdict">correctness</th>
          <th class="col-query">query</th>
          <th>actual agent output</th>
          <th>expected result</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ---- Events ----

scenarioSelect.addEventListener("change", onScenarioChange);
playBtn.addEventListener("click", runEvaluation);

loadDataset();
