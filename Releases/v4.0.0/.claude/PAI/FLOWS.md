# Flows

> **PAI 4.0** — This system is under active development. APIs, configuration formats, and features may change without notice.

**Connecting Sources to Pipelines on a Schedule**

Flows are the fifth primitive in the architecture. They connect external sources to pipelines on a cron schedule, orchestrating the complete data-to-action lifecycle.

> **Note:** Personal flow configurations are stored in `USER/FLOWS/`. This document describes the framework.

---

## What Flows Are

Flows orchestrate the connection between **external content sources** and **internal pipelines** on a **schedule**. They are the outermost layer of the execution model.

**The Flow Pattern:**

```
Source ──(schedule)──> Pipeline ──> Destination
```

**Example - RSS Email Digest:**

```
RSS Feed (example.com/feed) ──(*/30 * * * *)──> P_YOUR_PIPELINE ──> your-email@example.com
```

**Primitive Hierarchy:**

| Primitive | Prefix | What It Does | Composes |
|-----------|--------|--------------|----------|
| **Action** | `A_` | Single unit of work (LLM call, API call, shell command) | Nothing |
| **Pipeline** | `P_` | Chains actions in sequence via pipe model | Actions |
| **Flow** | `F_` | Connects source → pipeline → destination on a schedule | Pipelines |

---

## Cloud Architecture (Arbol)

Flows run as **Cloudflare Workers** in the [Arbol project](~/Projects/arbol/). They use Cloudflare's native features for scheduling and composition.

```
┌────────────────────────────────────────────────────────────────┐
│                         ARBOL (Cloudflare)                     │
│                                                                │
│  FLOWS (F_)              PIPELINES (P_)        ACTIONS (A_)   │
│  ───────────             ──────────────         ────────────   │
│  Cron-triggered          Service bindings       Individual     │
│  Workers that            that chain actions      Workers       │
│  fetch sources           in sequence                           │
│                                                                │
│  F_YOUR_FLOW ───────────> P_YOUR_PIPELINE ───> A_YOUR_ACTION   │
│       │                       │                 A_SEND_EMAIL   │
│       │  */30 * * * *         │  internal        │             │
│       │  (every 30 min)       │  service          │  Resend API│
│       │                       │  bindings         │  Anthropic │
│       └── fetches source       └── pipes output    └── does work│
│                                                                │
│  ALL Workers authenticated via shared/auth.ts (Bearer token)   │
└────────────────────────────────────────────────────────────────┘
```

### Cloudflare Features Used

| Feature | Purpose |
|---------|---------|
| **Cron Triggers** | Schedule flow execution (no external scheduler) |
| **Service Bindings** | Zero-hop internal calls between Workers |
| **Secrets** | Store AUTH_TOKEN, API keys securely |
| **Workers** | Serverless execution environment |

---

## Naming Convention

- **Prefix:** `F_` for flows
- **Case:** `UPPER_SNAKE_CASE`
- **Pattern:** `F_SOURCE_PIPELINE` (what feeds into what)
- **Worker name:** `arbol-f-{kebab-case-name}`

**Examples:**

| Flow ID | Worker Name | Source | Pipeline |
|---------|-------------|--------|----------|
| `F_RSS_LABEL_EMAIL` | `arbol-f-rss-label-email` | RSS Feed | P_YOUR_PIPELINE |
| `F_BLOG_LABEL_EMAIL` | `arbol-f-blog-label-email` | Blog RSS | P_YOUR_PIPELINE |

---

## Flow Registry

Local flow definitions are tracked in `~/.claude/PAI/FLOWS/flow-index.json`:

```json
{
  "flows": [
    {
      "id": "flow-your-source-pipeline",
      "name": "Your Flow Name",
      "source": { "type": "rss", "url": "https://example.com/feed" },
      "pipeline": "P_YOUR_PIPELINE",
      "destination": { "type": "email", "address": "your-email@example.com" },
      "schedule": { "intervalMinutes": 30, "enabled": true }
    }
  ]
}
```

Flow state (run history, errors) is tracked in `~/.claude/MEMORY/STATE/flow-state.json`.

---

## How Flows Work

### 1. Cron Trigger

Cloudflare fires the `scheduled()` handler on the configured interval. No external scheduler needed.

```typescript
// wrangler.jsonc
{
  "triggers": {
    "crons": ["*/5 * * * *"]  // Every 5 minutes
  }
}
```

### 2. Source Fetch

The flow Worker fetches content from its configured source. Each flow implements its own source logic (RSS parsing, API calls, etc.).

```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const rssResponse = await fetch("https://hnrss.org/frontpage");
  const xml = await rssResponse.text();
  const items = parseRssItems(xml);
  // ...
}
```

### 3. Pipeline Execution

Each source item is piped through the pipeline Worker via a service binding.

```typescript
const response = await env.P_YOUR_PIPELINE.fetch(
  new Request("https://internal/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      content: `${item.title}\n\n${item.description}`,
      title: item.title,
      to: "your-email@example.com",
      subject: `[Flow] ${item.title}`,
    }),
  })
);
```

### 4. Manual Trigger

Every flow exposes an HTTP handler for manual triggering and health checks:

```bash
# Health check (no auth)
curl https://arbol-f-your-flow.YOUR-SUBDOMAIN.workers.dev/health

# Manual trigger (requires auth)
curl -X POST https://arbol-f-your-flow.YOUR-SUBDOMAIN.workers.dev/trigger \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Flow Execution Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE CRON TRIGGER                   │
│                    (e.g., */5 * * * *)                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Flow Worker: scheduled() handler                            │
│  └─► Fetch source (RSS, API, etc.)                           │
│  └─► Parse items                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  For each item:                                              │
│  └─► Call pipeline via service binding                       │
│      └─► Pipeline chains actions internally                  │
│      └─► Final action delivers to destination                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Log results to flow-state.json                              │
│  └─► Track success/failure, duration, errors                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication

All Arbol Workers use Bearer token authentication via `shared/auth.ts`:

```bash
Authorization: Bearer YOUR_AUTH_TOKEN
```

- **Health endpoints** (`GET /health`) are public — no auth required
- **All other endpoints** require a valid Bearer token
- Tokens are stored as Cloudflare Worker secrets (`AUTH_TOKEN`)
- Flow Workers pass the same `AUTH_TOKEN` to downstream Workers via service bindings

### Secrets by Worker Type

| Secret | Flows | Pipelines | Actions (LLM) | Actions (Custom) |
|--------|-------|-----------|---------------|------------------|
| `AUTH_TOKEN` | Required | Required | Required | Required |
| `ANTHROPIC_API_KEY` | - | - | Required | - |
| `RESEND_API_KEY` | - | - | - | a-send-email only |

---

## Creating a New Flow

### Step 1: Define the Flow

Add an entry to `flow-index.json`:

```json
{
  "id": "flow-your-source-pipeline",
  "name": "Your Flow Name",
  "source": { "type": "rss", "url": "https://example.com/feed" },
  "pipeline": "P_YOUR_PIPELINE",
  "destination": { "type": "email", "address": "you@example.com" },
  "schedule": { "intervalMinutes": 30, "enabled": true }
}
```

### Step 2: Ensure Pipeline Exists

The referenced `P_` pipeline must already be deployed as a Worker.

### Step 3: Create the Worker

Add `~/Projects/arbol/workers/f-your-flow/`:

```
workers/f-your-flow/
├── wrangler.jsonc    # Name, triggers (crons), service bindings
└── src/
    └── index.ts      # scheduled() + fetch() handlers
```

**wrangler.jsonc:**

```jsonc
{
  "name": "arbol-f-your-flow",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-30",
  "compatibility_flags": ["nodejs_compat"],
  "triggers": {
    "crons": ["*/30 * * * *"]
  },
  "services": [
    {
      "binding": "P_YOUR_PIPELINE",
      "service": "arbol-p-your-pipeline"
    }
  ]
}
```

### Step 4: Deploy

```bash
cd ~/Projects/arbol

# Add to deploy.sh ALL_WORKERS array
# Then deploy
bash deploy.sh f-your-flow

# Set secrets
echo "token" | npx wrangler secret put AUTH_TOKEN --name arbol-f-your-flow
```

---

## Cost Considerations

Flows that run frequently with LLM actions can accumulate significant costs.

**Example: RSS Flow at 5-minute intervals**

| Metric | Value |
|--------|-------|
| Items per run | ~30 |
| Runs per day | 288 |
| LLM calls per day | ~8,640 |
| Daily token volume | ~8.6M tokens |
| Estimated daily cost (Haiku) | ~$12-16 |

**Cost mitigation strategies:**

1. **Longer intervals** — 30 min instead of 5 min reduces cost 6x
2. **Deduplication** — Only process new items since last run
3. **Quality filtering** — Skip items that don't meet threshold
4. **Cheaper models** — Use Haiku for labeling, save Sonnet for writing

---

## Deployed Workers

| Worker | URL | Schedule |
|--------|-----|----------|
| `arbol-f-your-flow` | `https://arbol-f-your-flow.YOUR-SUBDOMAIN.workers.dev` | `*/30 * * * *` |

---

## Troubleshooting

### Flow runs but no emails sent

Check `flow-state.json` for errors. Common causes:

- Pipeline action returning malformed output (missing `body` for email)
- AUTH_TOKEN mismatch between Workers
- Resend API key not set on a-send-email Worker

### High costs

Reduce `intervalMinutes` in `flow-index.json` and redeploy the Worker with updated cron.

### Disable a flow

Set `"enabled": false` in `flow-index.json`. Note: This only affects local tracking. To stop the Cloudflare cron, you must either:

1. Remove the cron from `wrangler.jsonc` and redeploy
2. Delete the Worker entirely

---

## Loop Gate

Flows can iterate their pipeline until exit criteria pass. A normal flow calls its pipeline once per source item. A looping flow calls the pipeline repeatedly until the output meets a condition.

**The thermostat analogy:** A normal flow turns the heater on once. A looping flow keeps checking the temperature and runs the heater again until it is warm enough.

### Normal Flow vs Looping Flow

**Normal flow** --- one pipeline call per item:

```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const items = await fetchSource();

  for (const item of items) {
    const result = await env.P_MY_PIPELINE.fetch(
      new Request("https://internal/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.AUTH_TOKEN}`,
        },
        body: JSON.stringify({ content: item.content }),
      })
    );
    await writeToDestination(await result.json());
  }
}
```

**Looping flow** --- iterates pipeline until exit criteria pass:

```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const items = await fetchSource();
  const maxIterations = 5;

  for (const item of items) {
    let result = null;

    for (let i = 0; i < maxIterations; i++) {
      const response = await env.P_MY_PIPELINE.fetch(
        new Request("https://internal/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.AUTH_TOKEN}`,
          },
          body: JSON.stringify({
            content: item.content,
            previousResult: result,
            iteration: i,
          }),
        })
      );

      result = await response.json();

      // Exit criteria: pipeline output meets threshold
      if (result.qualityScore >= 8) {
        break;
      }
    }

    await writeToDestination(result);
  }
}
```

### Key Points

- **Pipelines always run once.** The pipeline has no knowledge of looping. It receives input, chains its actions, and returns output.
- **Flows control iteration.** The for-loop and exit condition live in the Flow worker.
- **`maxIterations` is mandatory.** Without a cap, failing exit criteria create an infinite loop. Default to 3-5 iterations.
- **Exit criteria are simple.** Check a field on the result: a score, a boolean, a status string. Keep it deterministic, not LLM-evaluated.
- **Cost awareness.** Each iteration re-runs the entire pipeline. A looping flow with 5 iterations and 3 LLM actions means 15 LLM calls per item.

---

## Related Documentation

- **Actions:** `~/.claude/PAI/ACTIONS.md` *(planned)*
- **Pipelines:** `~/.claude/PAI/PIPELINES.md`
- **Architecture:** `~/.claude/PAI/PAISYSTEMARCHITECTURE.md`
- **Detailed README:** `~/.claude/PAI/FLOWS/README.md`
- **Source code:** `~/Projects/arbol/`

---

**Last Updated:** 2026-02-22

---

## Changelog

| Date | Change | Author | Related |
|------|--------|--------|---------|
| 2026-02-03 | Created document | {DAIDENTITY.NAME} | PAISYSTEMARCHITECTURE.md, ACTIONS.md, PIPELINES.md |
