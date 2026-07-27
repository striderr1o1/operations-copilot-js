const API_BASE = "https://ai-workspace-operations-copilot-production.up.railway.app/";

const chatMessages = document.getElementById("chatMessages");
const queryInput = document.getElementById("queryInput");
const sendBtn = document.getElementById("sendBtn");
const logsContent = document.getElementById("logsContent");
const statusIndicator = document.getElementById("statusIndicator");
const statusDot = document.getElementById("statusDot");
const pdfInput = document.getElementById('pdfInput');
let isStreaming = false;



function getTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function scrollChat() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(t) {
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML;
}

// Logs

function addLog(text, node = "") {
  const e = document.createElement("span");
  e.className = "log-entry";
  e.innerHTML = `<span class="log-time">${getTime()}</span> <span class="log-node">${(node || "sys").toUpperCase()}</span> ${escapeHtml(text)}\n`;
  logsContent.appendChild(e);
  const p = logsContent.parentElement;
  p.scrollTop = p.scrollHeight;
}

// Chat

function clearEmpty() {
  const e = chatMessages.querySelector(".empty-state");
  if (e) e.remove();
}

function addMessage(role, text) {
  clearEmpty();
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.innerHTML = `
    <div class="msg-role">${role === "user" ? "you" : "response"}</div>
    <div class="msg-body">${escapeHtml(text)}</div>
    <div class="msg-time">${getTime()}</div>
  `;
  chatMessages.appendChild(el);
  scrollChat();
  return el;
}

function addThinkingBlock(label, content, loading) {
  clearEmpty();
  const block = document.createElement("div");
  block.className = "thinking-block";

  const spinner = loading ? `<span class="thinking-spinner"></span>` : "";
  block.innerHTML = `
    <div class="thinking-toggle">
      <span class="thinking-arrow">&#9654;</span>
      <span class="thinking-label">${escapeHtml(label)}</span>
      ${spinner}
    </div>
    <div class="thinking-content">${escapeHtml(content)}</div>
  `;

  block.querySelector(".thinking-toggle").addEventListener("click", () => {
    block.classList.toggle("open");
  });

  chatMessages.appendChild(block);
  scrollChat();
  return block;
}

function updateThinkingBlock(block, content, done) {
  if (!block) return;
  const c = block.querySelector(".thinking-content");
  if (c) c.textContent = content;
  if (done) {
    const s = block.querySelector(".thinking-spinner");
    if (s) s.remove();
  }
}

function setStatus(active) {
  statusIndicator.textContent = active ? "running" : "idle";
  statusIndicator.className = active ? "status-text active" : "status-text";
  statusDot.className = active ? "status-dot active" : "status-dot";
}

// SSE

async function sendQuery(query) {
  if (isStreaming || !query.trim()) return;

  isStreaming = true;
  queryInput.disabled = true;
  sendBtn.disabled = true;
  setStatus(true);

  addMessage("user", query);
  addLog(query, "query");

  const orchBlock = addThinkingBlock("orchestrator", "analyzing...", true);

  try {
    const res = await fetch(`${API_BASE}/query-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const agentBlocks = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        try {
          handleEvent(JSON.parse(part.slice(6).trim()), orchBlock, agentBlocks);
        } catch (_) { }
      }
    }

    if (buffer.startsWith("data: ")) {
      try {
        handleEvent(JSON.parse(buffer.slice(6).trim()), orchBlock, agentBlocks);
      } catch (_) { }
    }

  } catch (err) {
    updateThinkingBlock(orchBlock, `error: ${err.message}`, true);
    addMessage("assistant", `Something went wrong: ${err.message}`);
    addLog(err.message, "error");
  } finally {
    setStatus(false);
    isStreaming = false;
    queryInput.disabled = false;
    sendBtn.disabled = false;
    queryInput.focus();
  }
}

function handleEvent(event, orchBlock, agentBlocks) {
  switch (event.event) {
    case "agent calls": {
      const calls = event.data;
      const names = Array.isArray(calls) ? calls.map(c => c.tool || "?") : [];
      updateThinkingBlock(orchBlock, `routing: ${names.join(", ")}`, true);
      addLog(`routing: ${names.join(", ")}`, "orch");

      names.forEach(name => {
        const label = name.replace(/_/g, " ");
        agentBlocks[name] = addThinkingBlock(label, "working...", true);
        addLog(`${label} active`, name);
      });
      break;
    }

    case "knowledge base agent": {
      updateThinkingBlock(agentBlocks["knowledge_base_agent"], event.data, true);
      addLog("kb responded", "kb");
      break;
    }

    case "booking agent": {
      updateThinkingBlock(agentBlocks["booking_agent"], event.data, true);
      addLog("bk responded", "bk");
      break;
    }

    case "final response": {
      updateThinkingBlock(orchBlock, orchBlock?.querySelector(".thinking-content")?.textContent || "", true);
      Object.values(agentBlocks).forEach(b =>
        updateThinkingBlock(b, b?.querySelector(".thinking-content")?.textContent || "", true)
      );

      addMessage("assistant", event.data);
      addLog("delivered", "orch");
      break;
    }
  }
}

// Events

sendBtn.addEventListener("click", () => {
  const q = queryInput.value.trim();
  queryInput.value = "";
  sendQuery(q);
});

queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const q = queryInput.value.trim();
    queryInput.value = "";
    sendQuery(q);
  }
});

// Ingestion — PDF upload

const uploadZone = document.getElementById("uploadZone");
const namespaceInput = document.getElementById("namespaceInput");
const ingestBtn = document.getElementById("ingestBtn");
const uploadHint = uploadZone.querySelector(".upload-hint");

let selectedFile = null;

// Button is enabled only when a PDF is picked AND a namespace is provided.
function refreshIngestState() {
  const ready = selectedFile && namespaceInput.value.trim().length > 0;
  ingestBtn.disabled = !ready;
}

pdfInput.addEventListener("change", () => {
  selectedFile = pdfInput.files[0] || null;
  uploadHint.textContent = selectedFile ? selectedFile.name : "drop file or click to browse";
  refreshIngestState();
});

namespaceInput.addEventListener("input", refreshIngestState);

ingestBtn.addEventListener("click", () => {
  const namespace = namespaceInput.value.trim();

  if (!selectedFile) {
    addLog("no file selected", "ingest");
    return;
  }
  if (!namespace) {
    addLog("namespace required", "ingest");
    namespaceInput.focus();
    return;
  }

  const formData = new FormData();
  formData.append("file", selectedFile);
  formData.append("namespace_name", namespace);

  ingestBtn.disabled = true;
  ingestBtn.classList.add("loading");
  ingestBtn.querySelector(".ingest-btn-label").textContent = "ingesting";
  addLog(`ingesting ${selectedFile.name} -> ${namespace}`, "ingest");

  fetch(`${API_BASE}/ingestion`, { method: "POST", body: formData })
    .then(async (res) => {
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      addLog(`ingested ${selectedFile.name}`, "ingest");
      console.log("ingested:", res.status, data);
    })
    .catch((err) => {
      addLog(`ingest failed: ${err.message}`, "error");
      console.error(err);
    })
    .finally(() => {
      ingestBtn.classList.remove("loading");
      ingestBtn.querySelector(".ingest-btn-label").textContent = "ingest";
      selectedFile = null;
      pdfInput.value = "";
      uploadHint.textContent = "drop file or click to browse";
      refreshIngestState();
    });
});

addLog("ready");

