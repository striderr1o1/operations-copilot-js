import { chromium, devices } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:5173";
const OUT = "/tmp/claude-1000/-home-ranger-Desktop-operations-copilot-js/96b64d07-0270-4954-b6ed-0a13d2b8c618/scratchpad/shots";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const SESSION = JSON.stringify({
  user: { id: "test-user", email: "owner@northside.clinic" },
  session: { access_token: "t", expires_at: Math.floor(Date.now() / 1000) + 86400 },
});

async function newCtx(browser, opts = {}, { published = false } = {}) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(
    ([session, deployment]) => {
      // about:blank has no accessible storage; skip rather than throw
      try {
        localStorage.setItem("receptix.session", session);
        if (deployment) localStorage.setItem("receptix.deployment", deployment);
      } catch {}
    },
    [
      SESSION,
      published
        ? JSON.stringify({
            published: true,
            slug: "acme-clinic",
            namespace: "clinic-docs",
            botName: "Receptix Front Desk",
            greeting: "Hi! I'm the front desk assistant. Ask me anything.",
          })
        : null,
    ]
  );
  ctx.on("page", (p) =>
    p.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`${p.url()} :: ${m.text()}`);
    })
  );
  ctx.on("weberror", (e) => consoleErrors.push(String(e.error())));
  return ctx;
}

/** Fails if the page scrolls sideways — the #1 mobile regression. */
async function noHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return { scroll: d.scrollWidth, client: d.clientWidth };
  });
  check(
    `${label}: no horizontal overflow`,
    overflow.scroll <= overflow.client + 1,
    `scrollWidth=${overflow.scroll} clientWidth=${overflow.client}`
  );
}

// Use the system Chromium — the cached Playwright build doesn't match this
// package version, and downloading another one isn't worth 170 MB.
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });

// ---------------------------------------------------------------- DESKTOP
{
  const ctx = await newCtx(browser, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ---- home ----
  await page.goto(BASE, { waitUntil: "networkidle" });
  check("home: title", (await page.title()).includes("Receptix"));
  check("home: brand visible", await page.getByRole("link", { name: /Receptix/ }).first().isVisible());
  check(
    "home: hero headline",
    await page.getByRole("heading", { level: 1 }).first().isVisible()
  );

  // particle canvas actually drew something
  await page.waitForTimeout(2500);
  const canvasPainted = await page.evaluate(() => {
    const c = document.querySelector(".pscene-canvas");
    if (!c) return { ok: false, reason: "no canvas" };
    const ctx = c.getContext("2d");
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let lit = 0;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 12) lit += 1;
    return { ok: lit > 50, lit, w: c.width, h: c.height };
  });
  check("home: particle canvas renders", canvasPainted.ok, JSON.stringify(canvasPainted));

  await page.screenshot({ path: `${OUT}/desktop-01-hero.png` });
  await noHorizontalScroll(page, "home desktop");

  // ---- nav scroll ----
  await page.getByRole("button", { name: "Pricing" }).click();
  await page.waitForTimeout(900);
  const pricingVisible = await page.locator("#pricing").isVisible();
  check("home: nav scrolls to pricing", pricingVisible);

  // ---- pricing toggle ----
  const basicMonthly = await page.locator(".plan").first().locator(".plan-amount").innerText();
  await page.getByRole("button", { name: /Yearly/ }).click();
  await page.waitForTimeout(300);
  const basicYearly = await page.locator(".plan").first().locator(".plan-amount").innerText();
  check(
    "pricing: yearly toggle changes price",
    basicMonthly === "49" && basicYearly === "39",
    `${basicMonthly} -> ${basicYearly}`
  );
  await page.screenshot({ path: `${OUT}/desktop-02-pricing.png` });

  await page.locator("#how-it-works").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/desktop-03-howitworks.png` });

  await page.locator("#about").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/desktop-04-about.png` });

  // ---- contact validation ----
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Request a walkthrough/ }).click();
  check("contact: blocks empty submit", await page.locator(".contact-error").isVisible());

  await page.fill('input[placeholder="Jamie Rivera"]', "Jamie Rivera");
  await page.fill('input[placeholder="jamie@clinic.com"]', "not-an-email");
  await page.fill("textarea", "We get sixty calls a day about the same six things.");
  await page.getByRole("button", { name: /Request a walkthrough/ }).click();
  check(
    "contact: rejects bad email",
    (await page.locator(".contact-error").innerText()).includes("email")
  );

  await page.fill('input[placeholder="jamie@clinic.com"]', "jamie@clinic.com");
  await page.getByRole("button", { name: /Request a walkthrough/ }).click();
  await page.waitForTimeout(1100);
  check("contact: accepts valid submit", await page.locator(".contact-sent").isVisible());
  await page.screenshot({ path: `${OUT}/desktop-05-contact.png` });

  // ---- get started ----
  await page.goto(`${BASE}/get-started`, { waitUntil: "networkidle" });
  check("signup: confirm field present", await page.locator('input[placeholder="type it again"]').isVisible());
  await page.screenshot({ path: `${OUT}/desktop-06-signup.png` });

  await page.getByRole("tab", { name: "Login" }).click();
  await page.waitForTimeout(450);
  check(
    "auth: toggle hides confirm field",
    !(await page.locator('input[placeholder="type it again"]').isVisible())
  );
  check("auth: title switches", (await page.locator(".gs-title").innerText()).includes("Welcome back"));

  await page.getByRole("tab", { name: "Sign up" }).click();
  await page.waitForTimeout(400);
  check(
    "auth: toggles back to signup",
    await page.locator('input[placeholder="type it again"]').isVisible()
  );

  // client-side validation, no network call
  await page.fill('input[type="email"]', "bad");
  await page.fill('input[placeholder="at least 6 characters"]', "123");
  await page.getByRole("button", { name: "Create account" }).click();
  check("auth: rejects bad email", (await page.locator(".gs-error").innerText()).includes("valid email"));

  await page.fill('input[type="email"]', "owner@clinic.com");
  await page.getByRole("button", { name: "Create account" }).click();
  check(
    "auth: enforces 6-char password",
    (await page.locator(".gs-error").innerText()).includes("6 characters")
  );

  await page.fill('input[placeholder="at least 6 characters"]', "secret123");
  await page.fill('input[placeholder="type it again"]', "different");
  await page.getByRole("button", { name: "Create account" }).click();
  check("auth: catches mismatch", (await page.locator(".gs-error").innerText()).includes("don't match"));

  // password reveal
  await page.locator(".gs-eye").click();
  check(
    "auth: password reveal toggles",
    (await page.locator('input[placeholder="at least 6 characters"]').getAttribute("type")) === "text"
  );
  await noHorizontalScroll(page, "get-started desktop");

  // ---- dashboard ----
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  check("dashboard: redirects to chatbot", page.url().includes("/dashboard/chatbot"));
  check("dashboard: sidebar visible", await page.locator(".db-side").isVisible());
  check("dashboard: user email shown", (await page.locator(".db-user-email").innerText()).includes("owner@"));

  // sidebar/main split should land in the 20-25 / 75-80 band
  const split = await page.evaluate(() => {
    const side = document.querySelector(".db-side").getBoundingClientRect().width;
    return Math.round((side / window.innerWidth) * 100);
  });
  check("dashboard: sidebar is 20-25% wide", split >= 20 && split <= 25, `${split}%`);

  check("dashboard: starts unpublished", (await page.locator(".db-live-state").innerText()) === "Offline");
  await page.screenshot({ path: `${OUT}/desktop-07-dashboard-chatbot.png` });

  // publish toggle
  await page.getByRole("button", { name: "Publish" }).click();
  await page.waitForTimeout(400);
  check("dashboard: publish flips to live", (await page.locator(".db-live-state").innerText()) === "Live");
  check(
    "dashboard: unpublish button appears",
    await page.getByRole("button", { name: "Unpublish" }).isVisible()
  );
  const url = await page.locator(".cb-url-text").innerText();
  check("dashboard: public url shown", url.includes("/c/acme-clinic"), url);
  await page.screenshot({ path: `${OUT}/desktop-08-dashboard-published.png` });

  // persistence across reload
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  check(
    "dashboard: publish state survives reload",
    (await page.locator(".db-live-state").innerText()) === "Live"
  );

  // ingestion
  await page.getByRole("link", { name: /Ingestion/ }).click();
  await page.waitForTimeout(500);
  check("ingestion: page loads", await page.locator(".ing-drop").isVisible());
  check(
    "ingestion: button disabled with no file",
    await page.getByRole("button", { name: "Ingest document" }).isDisabled()
  );

  // reject a non-PDF
  await page.setInputFiles('input[type="file"]', {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await page.waitForTimeout(300);
  check("ingestion: rejects non-PDF", (await page.locator(".ing-error").innerText()).includes("PDF"));

  // accept a PDF, then require a namespace
  await page.setInputFiles('input[type="file"]', {
    name: "clinic-policy.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 test"),
  });
  await page.waitForTimeout(300);
  check(
    "ingestion: accepts PDF",
    (await page.locator(".ing-drop-name").innerText()).includes("clinic-policy.pdf")
  );
  check(
    "ingestion: still disabled without namespace",
    await page.getByRole("button", { name: "Ingest document" }).isDisabled()
  );
  await page.fill('input[placeholder="e.g. clinic-policies"]', "clinic-docs");
  await page.waitForTimeout(250);
  check(
    "ingestion: enabled with file + namespace",
    await page.getByRole("button", { name: "Ingest document" }).isEnabled()
  );
  await page.screenshot({ path: `${OUT}/desktop-09-ingestion.png` });

  // evaluations
  // /eval/dataset is behind check_session_exists and the seeded token is a
  // placeholder, so the real backend would 401 here. Stub the shape it returns
  // (routes/eval.py:55) and let this block test the rendering, which is what it
  // is actually for. The bearer header itself is covered in AUTH HEADER below.
  await ctx.route("**/eval/dataset", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "front-desk-routing",
        layer: "orchestrator",
        version: 3,
        description: "routing decisions",
        categories: [
          { category: "initial_routing", endpoint: "initial-routing", count: 2 },
          { category: "irrelevant", endpoint: "irrelevant", count: 1 },
        ],
        scenarios: [
          { id: "s1", category: "initial_routing", expected: ["knowledge_base_agent"], state: { messages: [{ role: "user", content: "what are your hours?" }] } },
          { id: "s2", category: "initial_routing", expected: ["booking_agent"], state: { messages: [{ role: "user", content: "book me for tuesday" }] } },
          { id: "s3", category: "irrelevant", expected: [], state: { messages: [{ role: "user", content: "who won the cup?" }] } },
        ],
      }),
    })
  );

  await page.getByRole("link", { name: /Evaluations/ }).click();
  await page.waitForTimeout(1200);
  check("evaluations: page loads", await page.locator(".ev-json").isVisible());
  check(
    "evaluations: run disabled until a category is picked",
    await page.getByRole("button", { name: "Run evaluation" }).isDisabled()
  );

  await page
    .waitForFunction(
      () => document.querySelectorAll(".ev-select-wrap select option").length > 1,
      null,
      { timeout: 15000 }
    )
    .catch(() => {});

  const datasetNote = await page.locator(".ev-dataset").innerText();
  const options = await page.locator(".ev-select-wrap select option").count();
  check(
    "evaluations: dataset loaded from backend",
    options > 1,
    `${options - 1} categories · ${datasetNote}`
  );

  if (options > 1) {
    const value = await page.locator(".ev-select-wrap select option").nth(1).getAttribute("value");
    await page.selectOption(".ev-select-wrap select", value);
    await page.waitForTimeout(500);
    const json = await page.locator(".ev-json").innerText();
    check("evaluations: shows scenario json", json.trim().startsWith("["), json.slice(0, 40));
    check(
      "evaluations: run enabled after pick",
      await page.getByRole("button", { name: "Run evaluation" }).isEnabled()
    );
    check(
      "evaluations: shows target endpoint",
      (await page.locator(".ev-block-note").first().innerText()).includes("/eval/")
    );
  }
  await page.screenshot({ path: `${OUT}/desktop-10-evaluations.png`, fullPage: true });
  await noHorizontalScroll(page, "dashboard desktop");

  await ctx.close();
}

// --------------------------------------------------- STREAM HANDLING
// Stubbed SSE, because the real orchestrator's behaviour here is nondeterministic.
{
  const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;
  const call = (tool) => sse({ event: "agent calls", node: "orchestrator", data: [{ tool, argument: ["q"] }] });
  const kb = (text) => sse({ event: "knowledge base agent", data: text });
  const done = (text) => sse({ event: "final response", data: text });
  const noCalls = sse({ event: "agent calls", node: "orchestrator", data: [] });

  const chatWith = async (body) => {
    const ctx = await newCtx(browser, { viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await ctx.route("**/query-agent", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
        body,
      })
    );
    await page.goto(`${BASE}/dashboard/chatbot`, { waitUntil: "networkidle" });
    await page.locator(".cb-suggestions button").first().click();
    await page.waitForFunction(
      () => document.querySelector(".cb-logs-state")?.textContent.trim() === "idle",
      null,
      { timeout: 15000 }
    );
    const reply = (await page.locator(".tr-msg.tr-assistant .tr-body").last().innerText()).trim();
    // textContent, not innerText: the block may be collapsed, and innerText
    // drops content that CSS is hiding.
    const orch = (
      await page.locator(".tr-think").first().locator(".tr-think-content").textContent()
    ).trim();
    await ctx.close();
    return { reply, orch };
  };

  // The backend indexes update['tool_calls'] directly, so an orchestrator that
  // swallowed an exception kills the stream before the final frame. The
  // sub-agent's answer already arrived — serve that rather than an apology.
  const truncated = await chatWith(call("knowledge_base_agent") + kb("We open at 6am."));
  check(
    "stream: falls back to sub-agent answer when the final frame never arrives",
    truncated.reply === "We open at 6am.",
    truncated.reply
  );

  // The orchestrator reruns after its sub-agents return, emitting an empty tool
  // list. That is "nothing left to route", not "I answered this myself".
  const looped = await chatWith(
    call("knowledge_base_agent") + kb("We open at 6am.") + noCalls + done("We open at 6am.")
  );
  check(
    "stream: empty second pass reads as composing, not answering directly",
    looped.orch.includes("composing the reply"),
    looped.orch.replace(/\s+/g, " ")
  );

  // An empty list on the *first* pass really does mean it answered alone.
  const direct = await chatWith(noCalls + done("Sure — we open at 6am."));
  check(
    "stream: empty first pass still reads as answering directly",
    direct.orch.includes("answering directly"),
    direct.orch.replace(/\s+/g, " ")
  );
  check("stream: direct answer delivered", direct.reply === "Sure — we open at 6am.", direct.reply);
}

// ------------------------------------------------------------ AUTH HEADER
// The backend guards /query-agent, /eval/* and /ingestion with
// check_session_exists, which reads `Authorization: Bearer <jwt>`. The token was
// being stored and then never sent, so every dashboard call came back 401.
// newCtx seeds access_token "t".
{
  /** Route `pattern`, capture the request headers, answer with `respond`. */
  const headersFor = async (pattern, respond, drive) => {
    const ctx = await newCtx(browser, { viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    let seen = null;
    await ctx.route(pattern, (route) => {
      seen = route.request().headers();
      return route.fulfill(respond);
    });
    await drive(page);
    await ctx.close();
    return seen || {};
  };

  const chatHeaders = await headersFor(
    "**/query-agent",
    {
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
      body: `data: ${JSON.stringify({ event: "final response", data: "ok" })}\n\n`,
    },
    async (page) => {
      await page.goto(`${BASE}/dashboard/chatbot`, { waitUntil: "networkidle" });
      await page.locator(".cb-suggestions button").first().click();
      await page.waitForFunction(
        () => document.querySelector(".cb-logs-state")?.textContent.trim() === "idle",
        null,
        { timeout: 15000 }
      );
    }
  );
  check(
    "auth: /query-agent sends the bearer token",
    chatHeaders.authorization === "Bearer t",
    chatHeaders.authorization ?? "(no Authorization header)"
  );

  const evalHeaders = await headersFor(
    "**/eval/dataset",
    { status: 200, contentType: "application/json", body: JSON.stringify({ categories: [] }) },
    async (page) => {
      await page.goto(`${BASE}/dashboard/evaluations`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
    }
  );
  check(
    "auth: /eval/dataset sends the bearer token",
    evalHeaders.authorization === "Bearer t",
    evalHeaders.authorization ?? "(no Authorization header)"
  );

  // Uploads must keep the browser's own multipart Content-Type: it carries the
  // boundary, and hand-setting the header would corrupt the body.
  // Match on pathname, not "**/ingestion" — that glob also catches the page URL
  // /dashboard/ingestion and would fulfil the navigation itself with JSON.
  const uploadHeaders = await headersFor(
    (url) => url.pathname === "/ingestion",
    { status: 200, contentType: "application/json", body: JSON.stringify({ chunks: 1 }) },
    async (page) => {
      await page.goto(`${BASE}/dashboard/ingestion`, { waitUntil: "networkidle" });
      await page.setInputFiles('input[type="file"]', {
        name: "handbook.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 test"),
      });
      await page.fill('input[placeholder="e.g. clinic-policies"]', "clinic-docs");
      await page.getByRole("button", { name: "Ingest document" }).click();
      await page.waitForTimeout(800);
    }
  );
  check(
    "auth: /ingestion sends the bearer token",
    uploadHeaders.authorization === "Bearer t",
    uploadHeaders.authorization ?? "(no Authorization header)"
  );
  check(
    "auth: /ingestion keeps the multipart boundary",
    (uploadHeaders["content-type"] || "").startsWith("multipart/form-data; boundary="),
    uploadHeaders["content-type"] ?? "(none)"
  );

  // A token the backend rejects is dead everywhere, so drop it and send the
  // owner back to log in rather than leaving a dashboard that only 401s.
  {
    const ctx = await newCtx(browser, { viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await ctx.route("**/query-agent", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Missing bearer token" }),
      })
    );
    await page.goto(`${BASE}/dashboard/chatbot`, { waitUntil: "networkidle" });
    await page.locator(".cb-suggestions button").first().click();
    await page.waitForURL(/\/get-started|\/login/, { timeout: 15000 }).catch(() => {});
    check(
      "auth: a 401 bounces the owner back to log in",
      /\/get-started|\/login/.test(page.url()),
      page.url()
    );
    check(
      "auth: a 401 clears the stored session",
      (await page.evaluate(() => localStorage.getItem("receptix.session"))) === null
    );
    await ctx.close();
  }
}

// ------------------------------------------------------- PUBLISHED CHAT
{
  const ctx = await newCtx(browser, { viewport: { width: 1440, height: 900 } }, { published: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/c/acme-clinic`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  check("published: window renders", await page.locator(".pc-window").isVisible());
  check("published: greeting shown", (await page.locator(".tr-body").first().innerText()).includes("front desk"));
  check("published: quick replies shown", (await page.locator(".pc-quick button").count()) === 3);
  check(
    "published: no reasoning blocks for customers",
    (await page.locator(".tr-think").count()) === 0
  );
  await page.screenshot({ path: `${OUT}/desktop-11-published.png` });
  await noHorizontalScroll(page, "published desktop");
  await ctx.close();
}

// ------------------------------------------------- PUBLISHED CHAT (offline)
{
  const ctx = await newCtx(browser, { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/c/acme-clinic`, { waitUntil: "networkidle" });
  check("published: offline state when unpublished", await page.locator(".pc-offline-card").isVisible());
  await page.screenshot({ path: `${OUT}/desktop-12-offline.png` });
  await ctx.close();
}

// ------------------------------------------------------------- AUTH GUARD
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  check("guard: dashboard redirects when signed out", page.url().includes("/get-started"));

  await page.goto(`${BASE}/nope`, { waitUntil: "networkidle" });
  check("404: unknown route renders not-found", await page.locator(".nf-title").isVisible());
  await ctx.close();
}

// ----------------------------------------------------------------- MOBILE
{
  const ctx = await newCtx(browser, { ...devices["iPhone 13"] }, { published: true });
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  check("mobile home: burger visible", await page.locator(".nav-burger").isVisible());
  check("mobile home: desktop links hidden", !(await page.locator(".nav-links").isVisible()));
  await page.screenshot({ path: `${OUT}/mobile-01-hero.png` });
  await noHorizontalScroll(page, "home mobile");

  await page.locator(".nav-burger").click();
  await page.waitForTimeout(500);
  check("mobile home: menu sheet opens", await page.locator(".nav-sheet.is-open").isVisible());
  await page.screenshot({ path: `${OUT}/mobile-02-menu.png` });

  await page.getByRole("button", { name: "Pricing" }).last().click();
  await page.waitForTimeout(900);
  check("mobile home: sheet closes on nav", !(await page.locator(".nav-sheet.is-open").isVisible()));
  await page.screenshot({ path: `${OUT}/mobile-03-pricing.png` });
  await noHorizontalScroll(page, "pricing mobile");

  await page.locator("#contact").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/mobile-04-contact.png` });

  await page.goto(`${BASE}/get-started`, { waitUntil: "networkidle" });
  check("mobile auth: aside hidden", !(await page.locator(".gs-aside").isVisible()));
  check("mobile auth: mobile brand shown", await page.locator(".gs-brand-mobile").isVisible());
  await page.screenshot({ path: `${OUT}/mobile-05-signup.png` });
  await noHorizontalScroll(page, "get-started mobile");

  await page.goto(`${BASE}/dashboard/chatbot`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  check("mobile dashboard: topbar visible", await page.locator(".db-topbar").isVisible());
  const sidebarOnScreen = await page.evaluate(() => {
    const r = document.querySelector(".db-side").getBoundingClientRect();
    return r.right > 0;
  });
  check("mobile dashboard: sidebar off-canvas by default", !sidebarOnScreen);
  await page.screenshot({ path: `${OUT}/mobile-06-dashboard.png` });

  await page.locator(".db-burger").click();
  await page.waitForTimeout(600);
  check("mobile dashboard: drawer opens", await page.locator(".db-side.is-open").isVisible());
  await page.screenshot({ path: `${OUT}/mobile-07-drawer.png` });

  await page.getByRole("link", { name: /Evaluations/ }).click();
  await page.waitForTimeout(1200);
  check("mobile dashboard: drawer closes on nav", !(await page.locator(".db-side.is-open").isVisible()));
  check("mobile evaluations: renders", await page.locator(".ev-json").isVisible());
  await page.screenshot({ path: `${OUT}/mobile-08-evaluations.png` });
  await noHorizontalScroll(page, "evaluations mobile");

  await page.goto(`${BASE}/dashboard/ingestion`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/mobile-09-ingestion.png` });
  await noHorizontalScroll(page, "ingestion mobile");

  await page.goto(`${BASE}/c/acme-clinic`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  check("mobile published: window renders", await page.locator(".pc-window").isVisible());
  await page.screenshot({ path: `${OUT}/mobile-10-published.png` });
  await noHorizontalScroll(page, "published mobile");

  // tap targets should clear ~40px
  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll("button, a").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 32) bad.push(`${el.className || el.tagName}:${Math.round(r.height)}px`);
    });
    return bad;
  });
  check("mobile published: tap targets >= 32px", small.length === 0, small.join(", "));

  await ctx.close();
}

// ------------------------------------------------------------- TABLET
{
  const ctx = await newCtx(browser, { ...devices["iPad (gen 7)"] });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/tablet-01-hero.png` });
  await noHorizontalScroll(page, "home tablet");

  await page.goto(`${BASE}/dashboard/chatbot`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/tablet-02-dashboard.png` });
  await noHorizontalScroll(page, "dashboard tablet");
  await ctx.close();
}

await browser.close();

// ---------------------------------------------------------------- SUMMARY
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFAILURES:");
  failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`));
}

const realErrors = consoleErrors.filter(
  (e) => !/favicon|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED.*fonts/i.test(e)
);
console.log(`\nconsole errors: ${realErrors.length}`);
realErrors.slice(0, 15).forEach((e) => console.log(`  ! ${e}`));

process.exit(failed.length ? 1 : 0);
