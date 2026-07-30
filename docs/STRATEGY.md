# Receptix — Product & Go-to-Market Strategy

An analysis of [`Ai-Workspace-Operations-Copilot`](https://github.com/striderr1o1/Ai-Workspace-Operations-Copilot)
(backend) and `operations-copilot-js` (frontend) as of July 2026, and a strategy for
building it into an internationally-sold AI front desk SaaS.

---

## 1. What you have actually built

Read honestly, the backend is a **LangGraph orchestrator with two sub-agents**:

| Layer | State |
|---|---|
| Orchestrator | OpenRouter `gpt-oss-120b`, structured output via `instructor`, hop-capped at 3 |
| KB agent | Groq `gpt-oss-20b` + Pinecone retrieval over ingested PDFs |
| Booking agent | Groq `gpt-oss-20b` + Supabase CRUD over a `rooms` table |
| Auth | Supabase GoTrue, bearer-token verified server-side per request |
| Transport | FastAPI, `/query` sync + `/query-agent` SSE |
| Evals | 60 hand-written orchestrator scenarios, 5 graded categories |
| Frontend | React 19 + Vite, marketing site + dashboard + published chat page |

### The three things that are genuinely good

1. **The evaluation harness is the best asset in the repo.** `evals/orchestrator_dataset.json`
   grades against a *list* of acceptable decisions rather than one golden answer, tests the
   production node directly instead of a copy, and deliberately targets dishonesty modes —
   scenarios 28, 37, 42, 44 check that the agent relays a booking conflict instead of claiming
   success, and says "not found" instead of inventing a policy. Almost no SMB AI-receptionist
   vendor can show a buyer anything like this. **This is your differentiation seed** (see §4).
2. **The auth layer was thought about properly.** `create_auth_client()` returning a throwaway
   client so one user's JWT doesn't become the process-wide identity is a real bug avoided,
   not an accident. `check_session_exists` asks GoTrue rather than decoding the JWT locally,
   so revoked sessions die immediately.
3. **Clean separation.** Routes / services / agents / tools are cleanly split, exceptions are
   typed, the graph is declarative. This will scale as a codebase.

### The central strategic problem: two different products

The repo is an **AI Workspace Operations Copilot** — an *internal* tool where employees ask
about documents and book meeting rooms. The pitch in `CLAUDE.md` is **Receptix, an AI front
desk** — an *external* tool where a business's customers get served.

These have different buyers, different data models, and different failure costs. Room booking
is an employee convenience; a front desk is revenue infrastructure. Your `self_docs/may24.md`
already points at the right one ("clinics and appointments… number setup on twilio") — but the
code hasn't followed.

**Decide, and cut the other.** Everything below assumes you choose front desk.

### The second problem: a front desk answers the phone

Every serious competitor is voice-first over PSTN — Smith.ai, Ruby, Slang.ai (restaurants),
Numa (dealerships), Newo ($25M Series A, Feb 2026, explicitly "SMB front-desk operations").
Receptix today is a **web chat widget**, which is a different and far more crowded category
(Intercom, Crisp, Tidio, plus every no-code builder) with much lower willingness to pay.
SMBs buy an AI receptionist because they are *missing calls*, not because their website
lacks a chat bubble.

Voice is not a "later" feature. It is the category.

---

## 2. Engineering blockers before a second customer exists

These are ordered by severity. Items 1–5 are **cross-tenant data leaks or cost bombs**, and
none of them can ship to a paying customer as-is.

### 2.1 Every user in the system shares one conversation

`src/routes/inference.py` calls `run_inference(inf.query, user)` with no `thread_id`, so the
default in `src/dependencies.py` applies:

```python
def run_inference(query: str, user: dict, thread_id: str = "thread-1"):
```

Every request from every user of every tenant reads and writes LangGraph checkpoint
`thread-1`. Customer A's conversation history is visible to customer B. Fix: derive the thread
id server-side as `f"{org_id}:{conversation_id}"` — never accept it from the client.

### 2.2 The checkpointer is in-memory

`get_checkpointer()` returns `InMemorySaver()`. Conversation state dies on every deploy and is
not shared across workers, so with more than one uvicorn worker the same user gets a different
history depending on which process answers. Move to the Postgres checkpointer against Supabase.

### 2.3 `user_id` is extracted and then discarded

```python
user_id = user["id"]   # dependencies.py — assigned, never used
```

The comment says it's "held for the tools, which will need it to scope their queries per user."
Until it is actually threaded into the tools, **there is no tenant scoping anywhere in the
data path.**

### 2.4 The booking tools are non-functional and unscoped

`src/services/booking_tools.py` queries `supabase.table("")` — an empty table name — in all
three tools. Beyond being broken, when the name is filled in there is no `org_id` filter, and
the README recommends the `service_role` key, which **bypasses Row Level Security**. So tenant
isolation would rest entirely on application code that currently does no filtering. Use the
anon key plus RLS for tenant data paths, and reserve `service_role` for admin jobs.

### 2.5 Pinecone namespaces are client-chosen, and the agent can enumerate all of them

`/ingestion` takes `namespace_name` as a **form field from the caller**, and `get_all_namespaces`
is registered as a tool on the KB agent — it returns *every namespace in the index*, across all
tenants, straight into the agent's context. A prompt-injected or merely curious user can list
other businesses' namespaces and then retrieve from them.

Fix: namespace is `org_{uuid}`, derived server-side from the verified session, never accepted
from input. Delete `get_all_namespaces` from the agent's toolset — scope the agent to its own
tenant's namespace and pass it in the tool binding.

### 2.6 Two endpoints have no authentication at all

`/ingestion` and all five `/eval/*` routes take no `Depends(check_session_exists)`. Anyone on
the internet can upload PDFs into any namespace (burning your embedding budget and poisoning
a tenant's knowledge base), and each `/eval/{category}` POST fires 10–20 LLM calls. A loop
against `/eval/initial-routing` is a free way to spend your OpenRouter balance.

### 2.7 Internal errors are returned to end customers

```python
except Exception as e:
    return {"return_to_user_decision": True,
            "response_to_user": f"An Unexpected Error Occured: {e}"}
```

This is the *customer-facing* string. Stack traces, table names and provider errors will be
shown to a clinic's patients. Log the detail, return a generic apology plus a handoff offer.

### 2.8 Latency and cost per turn are structurally too high for voice

A single user message costs an orchestrator call, a sub-agent call (which is itself an agent
loop with tool calls), then another orchestrator call to summarise — three to six LLM
round-trips, across two providers, with `RetryPolicy(max_attempts=3, initial_interval=5.0,
backoff_factor=2.0)` on every node. On a retry path that's a 35-second worst case.

Voice needs first audio in well under a second. **The multi-agent graph is the wrong shape for
voice.** For the phone path, collapse to a single agent with tools (retrieve, check
availability, book, escalate) and a fast model; keep the graph for asynchronous/complex text
work where a few seconds is acceptable.

### 2.9 Smaller items

- `agent_config.py` uses `openai/gpt-oss-20b` for sub-agents; the README says `qwen/qwen3-32b`.
  Docs have drifted.
- The orchestrator system prompt hand-writes a JSON schema in prose *and* uses
  `instructor` `Mode.JSON_SCHEMA`. The prose version is redundant and will silently conflict
  when the Pydantic model changes. Delete the prose schema; keep the model as the single source.
- `orchestrator_output.tool_calls` is a bare `list` — no validation that entries have `tool`
  and `argument`, which is exactly what `tool_call_node` indexes into.
- `count > 3` conflates "the orchestrator decided to finish" with "we ran out of budget." The
  user gets a summary field that may be empty in the second case.
- No per-tenant usage metering exists, so you cannot price safely or detect an abusive tenant.
- CORS is a hardcoded list in `main.py`; per-tenant published chatbot domains will need it
  to be dynamic.

---

## 3. The competitive landscape (July 2026)

| Segment | Who | Positioning |
|---|---|---|
| Infrastructure | Vapi (~$0.05/min platform), Retell (~$0.07/min), Bland ($499/mo + $0.11/min) | Sell the pipes to builders; all-in real cost lands $0.08–0.15/min |
| US generalist | Smith.ai (~$300/mo for 30 calls, >$1,000 at 100), Ruby (human, since 2003, 15k customers) | Hybrid AI+human, lead intake, premium |
| Verticals | Slang.ai (restaurants), Numa (auto dealerships) | Deep workflow fit, defensible |
| Funded challengers | Newo.ai ($25M Series A, Feb 2026), Wonderful ($34M seed for **non-English** markets) | Voice across phone/SMS/web/WhatsApp |

Three conclusions:

1. **Do not build horizontal.** A generalist English AI receptionist in 2026, built by a small
   team, has no wedge against Smith.ai's brand or Vapi's price.
2. **The infrastructure layer is commoditizing fast.** Your moat cannot be "we have an agent."
   Buy the pipes; build above them.
3. **The margin is enormous and under-exploited.** Smith.ai charges roughly $10/call. A 3-minute
   voice call costs about $0.25–$0.45 all-in. Whoever prices on *outcomes* rather than minutes
   captures that spread.

---

## 4. Differentiation: three wedges, ranked

### Wedge A — One vertical × non-English-native markets (primary)

The funding signal is unambiguous: vertical agents command premium pricing with materially
better retention, and Wonderful raised $34M specifically because non-English markets are
underserved. US incumbents are English-first and US-workflow-first.

Pick **one vertical** whose front desk is phone-driven, where a missed call is a lost booking
with a knowable value, and where IT sophistication is low:

- Dental / physiotherapy / aesthetics clinics — high no-show cost, recurring appointments
- Salons and spas — enormous volume, thin margins, near-zero IT
- Property management / real-estate lettings — high-value inbound, out-of-hours calls

And **one language reality** incumbents handle badly: real code-switching. Not "supports 29
languages" (everyone claims that) but Urdu↔English, Hinglish, Gulf Arabic↔English,
Spanish↔English *within a single utterance*, with correct handling of local name spellings,
local date/time idiom ("day after tomorrow, after Maghrib"), and local number formats. That is
a concrete, demonstrable quality gap you can show in a 60-second demo, and it is the thing a
US-built agent fails at most visibly.

### Wedge B — Provable accuracy as the sales asset (attach to A)

You already have the machinery. Turn it outward:

- Every tenant gets a **live scorecard**: containment rate, escalation rate, grounded-answer
  rate against *their own* knowledge base, and booking-truthfulness (did the agent ever claim
  a booking that did not exist?).
- Publish the methodology. Ship an "it will say *I don't know* rather than invent an answer"
  guarantee, enforced by a grounding check before any KB-derived answer is spoken.
- Regenerate the eval set per tenant from their own transcripts, so quality improves visibly
  after onboarding.

Alone this is a feature. Attached to a regulated-ish vertical (health, legal, property) it is
the thing that closes deals against black-box competitors, and it is the natural extension of
what `evals/` already does.

### Wedge C — White-label channel for local agencies (revenue, not moat)

Marketing agencies and IT resellers in your target geography will sell this for you at 20–30%
margin. Low CAC, fast revenue, and it validates verticals cheaply. But it is commoditized and
gives you no defensibility — treat it as cash flow that funds A and B, not as the strategy.

### What the moat actually is, long-run

Not the agent. It will be: (a) integration depth into the chosen vertical's booking/practice
software, (b) accumulated per-vertical eval and transcript data that makes your agent
measurably better at *that* domain, and (c) the channel relationships in your chosen geography.

---

## 5. Pricing

Current dummy Basic/Standard should become outcome-anchored, not minute-anchored. SMBs cannot
reason about minutes; they can reason about "calls answered" and "appointments booked."

| Plan | Price | Includes | For |
|---|---|---|---|
| Starter | $99/mo | 1 number, ~200 calls, web chat, KB, calendar sync | Single-location, testing |
| Professional | $349/mo | ~800 calls, SMS follow-up, human escalation, accuracy scorecard, integrations | The real plan — most customers |
| Multi-site | $899/mo+ | Multiple locations/numbers, shared KB, roles, API, SLA | Chains, franchises |
| Overage | ~$0.60/call | — | Above plan volume |

Notes:

- **No $29 tier.** It attracts the customers who generate the most support load and the least
  revenue, and at your team size support load is the binding constraint.
- Anchor against the human alternative in the local market, not against Vapi's per-minute rate.
  "A part-time receptionist costs $X/month; this is $349 and never sleeps."
- Price in USD for international, with local-currency display. Charge annually where you can —
  it fixes cash flow and cuts churn.
- Meter from day one (§2.9) or you will discover your worst customer is unprofitable too late.

---

## 6. Selling internationally: the concrete unblocks

- **Payments.** Stripe is not available for direct incorporation in several countries including
  Pakistan. Use a **merchant of record** — Paddle or Lemon Squeezy — which handles global VAT/GST,
  invoicing and chargebacks, and lets you bill US/EU customers regardless of where you sit.
  This is usually the single biggest practical blocker; solve it before writing billing code.
- **Entity and banking.** A US LLC (Stripe Atlas / Firstbase / Clerky) plus Mercury gives you
  a US bank account and credibility on enterprise-ish paperwork. Cheap; worth doing early.
- **Data residency and GDPR.** EU buyers will ask on the first call. You need a DPA, a published
  sub-processor list (OpenRouter, Groq, Pinecone, Supabase, Twilio all count), and ideally EU-region
  Supabase and Pinecone. Add a per-tenant transcript retention setting.
- **US healthcare is gated.** HIPAA requires a BAA, and OpenRouter/Groq will not sign one. If you
  target US clinics, you must move inference to Azure OpenAI or AWS Bedrock, which do. Either
  plan for that migration or start with non-US clinics or non-PHI verticals.
- **Telephony.** Many countries require a local address or ID to provision a local number.
  US/UK/CA numbers provision instantly via Twilio — start there and add regulated markets
  as demand appears.
- **Support hours.** International customers will judge you on response time in their timezone.
  Set and publish a realistic window rather than implying 24/7.

---

## 7. Sequenced plan

### Phase 0 — Make it safe to have a second customer (2–3 weeks)

1. `organizations` table; `org_id` on every tenant row; RLS on; anon key for tenant paths.
2. Thread id = `f"{org_id}:{conversation_id}"`, derived server-side. Postgres checkpointer.
3. Pinecone namespace = `org_{uuid}`, server-derived. Remove `get_all_namespaces` from the
   agent's tools.
4. Auth dependency on `/ingestion` and `/eval/*`; rate-limit both.
5. Fix `booking_tools.py` table names; scope every query by `org_id`.
6. Stop returning exception text to end users.
7. Per-tenant usage counters (LLM tokens, minutes, calls).

### Phase 1 — Become an actual front desk (4–6 weeks)

8. Twilio number + streaming voice on Vapi or Retell. Target p95 first-audio < 1s. Single-agent
   tool-calling path for voice; keep the graph for text.
9. Real calendar integration — Google Calendar and Cal.com, then the booking system your chosen
   vertical actually uses. SMBs will not migrate off their calendar for you. Delete the `rooms` table.
10. **Human escalation and after-call summary.** Warm transfer or "we'll call you back," plus an
    SMS/email summary to the owner after every call. In SMB sales this is the most-requested
    feature and the cheapest trust-builder you can ship.
11. Missed-call text-back — auto-SMS anyone the agent could not handle. Highest-ROI feature per
    line of code in this category.

### Phase 2 — Make it sellable (4 weeks)

12. **Ten-minute onboarding**: paste website URL → scrape → auto-build KB → generate agent
    persona → place a live test call. Time-to-first-value is the real competitive axis for SMB,
    ahead of raw answer quality.
13. Tenant-facing accuracy scorecard built on the eval harness (§4B).
14. Paddle billing, plans, overage, usage dashboard.
15. Published-chat page hardening: per-tenant domains, dynamic CORS, rate limits, abuse controls.

### Phase 3 — Distribution

16. 20 hand-sold customers in one vertical, one city, one language pair. Do onboarding manually
    and watch every call. Do not scale before containment rate is stable above ~70%.
17. Then agency/white-label (§4C), and a public case study with real numbers from step 16.

### Cut list

- The meeting-room booking domain — it is not a front desk.
- The Streamlit UI — the React app supersedes it.
- Multi-agent orchestration on the latency-critical path.
- Any ambition to be industry-agnostic before customer 20.

---

## 8. Metrics that decide whether this works

| Metric | Why | Target to aim at |
|---|---|---|
| Containment rate | % of calls fully handled without a human | > 70% before scaling |
| Booking conversion | Calls that end in a confirmed appointment | The number you sell on |
| Escalation rate | Handoffs to a human | Track by reason, not just count |
| p95 first-response latency | Voice viability | < 1s |
| Grounded-answer rate | Answers traceable to the KB | > 95%, published |
| COGS per call | Margin safety | < $0.50 |
| Time-to-live for a new tenant | Onboarding friction | < 1 day, then < 1 hour |
| Logo churn | Product-market fit | < 3%/mo |

---

## 9. The honest risk

Two risks dominate. First, **the platform layer keeps eating the application layer** — Vapi and
Retell will ship verticalized templates, and anything that is only "an agent with a prompt" gets
absorbed. Second, **solo-founder bandwidth against funded competitors** with $25–34M rounds.

Neither is fatal, but both point the same way: go *narrower* than feels comfortable. One vertical,
one geography, one language pair, twenty customers you know by name, and an integration depth
plus quality-evidence story that a horizontal platform will not bother to replicate. The eval
harness you have already written is the seed of the only durable advantage in the list — build
the company around it rather than treating it as a testing folder.

---

### Sources

- [7 Best AI Receptionists (2026) — CloudTalk](https://www.cloudtalk.io/blog/best-after-hours-ai-virtual-receptionist/)
- [10 Best AI Receptionist Products in 2026 — ALM Corp](https://almcorp.com/blog/best-ai-receptionist-products-2026/)
- [Smith.ai Alternatives 2026 — Layer3 Labs](https://www.layer3labs.io/comparisons/smith-ai-alternatives)
- [Newo Raises $25M to Power SMB Front Desks With Voice AI — Ventureburn](https://ventureburn.com/newo-raises-25m-to-power-smb-front-desks-with-voice-ai/)
- [Newo.ai $25M Series A — Tech Funding News](https://techfundingnews.com/newo-ai-raises-25m-series-a-voice-infrastructure/)
- [Conversational AI Startup Funding 2025–2026 — New Market Pitch](https://newmarketpitch.com/blogs/news/conversational-ai-funding-analysis)
- [Vapi vs Retell vs Bland in 2026: The True Cost Per Minute](https://medium.com/@automation.labs/vapi-vs-retell-vs-bland-in-2026-the-true-cost-per-minute-578f38af3523)
- [AI Voice Agent Cost per Minute (2026)](https://ainora.lt/blog/ai-voice-agent-cost-per-minute-2026)
- [Wonderful raises $34M for non-English-speaking markets](https://markets.financialcontent.com/observernewsonline/article/accwirecq-2025-7-2-wonderful-raises-34-million-seed-round-to-accelerate-enterprise-ai-adoption-in-non-english-speaking-markets)
- [Voice AI in 2026 — AssemblyAI](https://www.assemblyai.com/blog/voice-ai-in-2026-series-1)
