---
version: 1.5.11
---

> **LifeOS 6.0.0** --- This system is under active development. APIs, configuration formats, and features may change without notice.

# Arbol System

> **Private infrastructure — not included in the public LifeOS release.** This document describes cloud infrastructure the maintainer runs privately. No Arbol implementation (workers, flows, actions) ships with the OSS release; it's reference documentation for how the architecture works, and a blueprint if you want to build your own.

> Arbol is the LifeOS running while you sleep. The hill-climb (`LifeOs/LifeOsThesis.md`) doesn't pause when the laptop closes — scheduled flows watch sources, transform signals, and push state changes from the edge, so the OS's picture of current state keeps refreshing without a session open.

**Cloudflare Workers Execution Platform**

The single authoritative document for Arbol --- LifeOS's cloud execution layer. Covers architecture, primitives, deployment, and operations.

---

## Overview

Arbol is the cloud execution layer for LifeOS. It runs on Cloudflare Workers and provides the infrastructure for deploying AI-powered automation as serverless functions at the edge.

Where LifeOS's local system (the Algorithm, Skills, Memory) operates on the developer's machine, Arbol extends LifeOS into the cloud. It handles scheduled jobs, API integrations, LLM-powered transformations, and multi-step data pipelines --- all deployed as Cloudflare Workers with global distribution and near-zero cold starts.

Arbol organizes all cloud work through three composable primitives: **Actions**, **Pipelines**, and **Flows**.

---

## Three-Primitive Hierarchy

Everything in Arbol is built from three primitives that compose upward:

```
Action  --->  Pipeline  --->  Flow
(unit)        (chain)         (scheduled system)
```

| Primitive | Prefix | What It Does | Composes |
|-----------|--------|--------------|----------|
| **Action** | `A_` | Single unit of work (LLM call, API call, shell command) | Nothing |
| **Pipeline** | `P_` | Chains actions in sequence via pipe model | Actions |
| **Flow** | `F_` | Connects source -> pipeline -> destination on a schedule | Pipelines |

**Actions** are the atomic building blocks. Each action does exactly one thing: call an LLM, fetch an API, parse data, format output. Actions are independently deployable as Cloudflare Workers.

**Pipelines** chain actions together using the pipe model (see below). A pipeline declares an ordered list of actions and routes data through them sequentially.

**Flows** are the top-level orchestrators. A flow connects a data source (RSS feed, API endpoint, webhook) to a pipeline and writes the result to a destination (database, API, file). Flows run on cron schedules.

---

## Pipe Model

Arbol pipelines use a Unix-style pipe model: the output of action N becomes the input of action N+1.

```
Source --> Action 1 --> Action 2 --> Action 3 --> Destination
             |              |              |
          transform      enrich        format
```

### Passthrough Pattern

Actions use the passthrough pattern (`...upstream`) to preserve metadata from previous actions while adding their own output. This ensures that context accumulates as data moves through the pipeline rather than being discarded at each step.

```typescript
// Action receives upstream data, adds its own, passes everything forward
const { content, ...upstream } = input;
return {
  ...upstream,        // preserve all prior action output
  myField: result,    // add this action's contribution
};
```

This means the final action in a pipeline has access to every field produced by every preceding action --- not just the immediately previous one.

### Field-Level Data Flow Example

```
A_EXTRACT_TRANSCRIPT          A_LABEL_AND_RATE
┌─────────────────┐          ┌──────────────────┐
│ Input:           │          │ Input:            │
│   url            │  ─────>  │   content         │  (was "transcript")
│                  │          │   video_id        │  (passed through)
│ Output:          │          │   title           │  (passed through)
│   content    ────┤          │                   │
│   video_id   ────┤          │ Output:           │
│   title      ────┤          │   one_sentence_   │
│   source     ────┤          │     summary       │
└─────────────────┘          │   labels          │
                              │   rating          │
                              │   quality_score   │
                              └──────────────────┘
```

---

## Actions

### What Actions Are

Actions are **atomic units of work** --- single-purpose functions that transform input to output. They follow the UNIX philosophy: do one thing well, compose through standard interfaces.

```
JSON Input → Action Logic → JSON Output
```

**Real Examples:**

| Action | Input | Output |
|--------|-------|--------|
| `A_LABEL_AND_RATE` | `{ content, title }` — content must be article text (never bare URLs, min 200 chars). Rejects LLM refusal patterns. | `{ labels, rating, quality_score }` |
| `A_EXTRACT_TRANSCRIPT` | `{ url }` | `{ content, video_id, title }` |
| `A_TRANSCRIBE_AUDIO` | `{ url }` | `{ content, source: "whisper", audio_bytes, truncated }` |
| `A_SEND_EMAIL` | `{ to, subject, body }` | `{ success, message_id }` |

### Action Structure

Each action is a flat directory:

```
A_LABEL_AND_RATE/
├── action.json    # Manifest: name, description, input/output schema, requires
└── action.ts      # Implementation: execute(input, ctx) → output
```

**action.json:**

```json
{
  "name": "A_LABEL_AND_RATE",
  "description": "Label and rate content using Fabric's label_and_rate pattern.",
  "input": {
    "content": { "type": "string", "required": true },
    "title":   { "type": "string" }
  },
  "output": {
    "one_sentence_summary": { "type": "string" },
    "labels":               { "type": "array" },
    "rating":               { "type": "string" },
    "quality_score":        { "type": "integer" }
  },
  "requires": ["llm", "readFile"]
}
```

**action.ts:**

```typescript
import type { ActionContext } from "../lib/types.v2";

export default {
  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const { content, ...upstream } = input;
    // ... do work using ctx.capabilities ...
    return { ...upstream, ...results };
  },
};
```

### Action Categories

| Category | Runtime | Requires | Examples |
|----------|---------|----------|----------|
| **LLM** | V8 Isolate | `llm` | A_LABEL_AND_RATE (refusal-gated), A_WRITE_TWITTER_POST |
| **Shell** | Sandbox (Docker) | `shell` | A_EXTRACT_TRANSCRIPT |
| **Custom** | V8 Isolate | `fetch` + custom keys | A_SEND_EMAIL |

### Capabilities

Actions declare dependencies in `action.json` under `requires`. The runner injects implementations:

| Capability | What It Provides | Used By |
|-----------|-----------------|---------|
| `llm` | AI inference (Anthropic API) | LLM actions |
| `shell` | Shell command execution | Shell actions |
| `readFile` | Read files from filesystem | Actions needing file access |
| `fetch` | HTTP requests | API integration actions |

**Local:** Runner injects real implementations. **Cloud:** Worker factory provides Cloudflare-compatible versions.

### Naming Convention

- **Prefix:** `A_` for actions
- **Case:** `UPPER_SNAKE_CASE`
- **Length:** 2-4 words, verb-first (`WRITE`, `EXTRACT`, `LABEL`, `SEND`)
- **Worker name:** `arbol-a-{kebab-case-name}`

| Action | Worker Name | Type |
|--------|-------------|------|
| `A_LABEL_AND_RATE` | `arbol-a-label-and-rate` | LLM |
| `A_WRITE_TWITTER_POST` | `arbol-a-write-twitter-post` | LLM |
| `A_EXTRACT_TRANSCRIPT` | `arbol-a-extract-transcript` | Sandbox |
| `A_SEND_EMAIL` | `arbol-a-send-email` | Custom |

### Running Actions

**Local:**

```bash
cd "${LIFEOS_DIR}/ARBOL/Actions"
bun lib/runner.v2.ts run A_LABEL_AND_RATE --input '{"content": "Your text here"}'
bun lib/runner.v2.ts list
```

**Cloud (Arbol):**

```bash
curl -X POST https://arbol-a-your-action.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Your text here"}'
```

**Response format:**

```json
{
  "success": true,
  "action": "A_YOUR_ACTION",
  "duration_ms": 1234,
  "output": {
    "result": "...",
    "upstream_field": "preserved from input"
  }
}
```

### Creating a New Action

1. Create directory: `mkdir "${LIFEOS_DIR}/USER/CUSTOMIZATIONS/ARBOL/ACTIONS/A_YOUR_ACTION"`
2. Define manifest (`action.json`) with name, description, input/output schema, requires
3. Implement logic (`action.ts`) using `execute(input, ctx)` pattern
4. Test locally: `bun lib/runner.v2.ts run A_YOUR_ACTION --input '{"content": "test"}'`
5. Deploy to cloud (optional): add Worker under `{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/ARBOL/Workers/a-your-action/`, then `bash deploy.sh a-your-action`

### Action Best Practices

1. **Single Responsibility** --- Each action does ONE thing. If it does two things, split it.
2. **Passthrough Pattern** --- Always `const { content, ...upstream } = input; return { ...upstream, ...myFields };`
3. **Explicit Capabilities** --- Declare everything in `requires`. Don't assume capabilities exist.
4. **Fail Fast** --- Validate inputs immediately. Throw clear errors.
5. **Idempotent Where Possible** --- Same input should produce same output (use temperature 0 for LLM actions).

---

## Pipelines

### What Pipelines Are

Pipelines orchestrate **sequences of Actions** into cohesive workflows. They chain multiple Actions together in sequence using the pipe model (output of action N becomes input of action N+1).

```
Input → Action1 → Action2 → Action3 → Output
         (each action receives upstream output via passthrough)
```

**When to use Actions vs Pipelines:**

| Criteria | Action | Pipeline |
|----------|--------|----------|
| Steps | 1 | 2+ |
| Dependencies | None | Sequential |
| Data model | Single input/output | Passthrough accumulation |
| Reusability | High (composable) | Orchestration layer |

### Pipeline Definition

**YAML Format (Arbol cloud):**

```yaml
name: P_MY_PIPELINE
description: Processes items through enrichment and formatting
actions:
  - A_PARSE
  - A_ENRICH
  - A_FORMAT
```

**PIPELINE.md Format (local):**

Local pipeline definitions live in `{{LIFEOS_DIR}}/ARBOL/Pipelines/[Domain]_[Pipeline-Name]/PIPELINE.md`:

```markdown
# [Pipeline_Name] Pipeline

**Purpose:** [One sentence]
**Domain:** [e.g., Blog, Newsletter, Art, LifeOS]
**Version:** 1.0

## Pipeline Overview

| Step | Action | Purpose |
|------|--------|---------|
| 1 | [Action_Name] | [What this step accomplishes] |
| 2 | [Action_Name] | [What this step accomplishes] |
```

### Pipeline Naming

- **Prefix:** `P_` for pipelines
- **Worker name:** `arbol-p-{kebab-case-name}`
- **Local directory:** `{{LIFEOS_DIR}}/ARBOL/Pipelines/[Domain]_[Pipeline-Name]/PIPELINE.md`

### Running Pipelines

```bash
cd "${LIFEOS_DIR}/ARBOL/Actions"
bun lib/pipeline-runner.ts run P_LABEL_AND_RATE --url "https://youtube.com/watch?v=..."
bun lib/pipeline-runner.ts list
```

### Creating a New Pipeline

1. Identify the workflow: what Actions exist, what needs creating, what data passes between steps
2. Create directory: `mkdir -p "${LIFEOS_DIR}/ARBOL/Pipelines/[Domain]_[Pipeline-Name]"`
3. Define overview table in PIPELINE.md
4. For each step, specify action, input (from upstream), and output fields
5. For cloud deployment, create a Worker with service bindings to each action

### Pipeline Best Practices

1. **Keep Steps Atomic** --- Each step does one thing.
2. **Use Passthrough** --- Always spread `...upstream` so downstream actions have all prior fields.
3. **Document Data Flow** --- For each action, document what it reads and what it adds.
4. **Keep Actions Reusable** --- Actions should not be tightly coupled to a specific pipeline.

**Note:** Pipelines always run once. If iteration is needed, the calling Flow handles it via the Loop Gate pattern.

---

## Flows

### What Flows Are

Flows orchestrate the connection between **external content sources** and **internal pipelines** on a **schedule**. They are the outermost layer of the execution model.

```
Source ──(schedule)──> Pipeline ──> Destination
```

### Cloud Architecture

Flows run as **Cloudflare Workers** using native features for scheduling and composition:

| Feature | Purpose |
|---------|---------|
| **Cron Triggers** | Schedule flow execution (no external scheduler) |
| **Service Bindings** | Zero-hop internal calls between Workers |
| **Secrets** | Store AUTH_TOKEN, API keys securely |
| **Workers** | Serverless execution environment |

### Naming Convention

- **Prefix:** `F_` for flows
- **Pattern:** `F_SOURCE_PIPELINE` (what feeds into what)
- **Worker name:** `arbol-f-{kebab-case-name}`

### Flow Registry


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

### How Flows Work

1. **Cron Trigger** --- Cloudflare fires `scheduled()` handler on configured interval
2. **Source Fetch** --- Flow Worker fetches content from its configured source
3. **Pipeline Execution** --- Each source item piped through pipeline Worker via service binding
4. **Destination** --- Results written to configured destination

**Manual trigger:** Every flow exposes `/health` (public) and `/trigger` (authenticated) HTTP endpoints.

### Creating a New Flow

1. Add entry to `flow-index.json`
2. Ensure referenced pipeline is deployed
3. Create Worker directory with `wrangler.jsonc` (cron triggers + service bindings) and `src/index.ts`
4. Deploy: `bash deploy.sh f-your-flow`

### Cost Considerations

Flows with frequent intervals and LLM actions accumulate costs. Example at 5-minute intervals with 30 items: ~8,640 LLM calls/day.

**Mitigation:** Longer intervals (30 min = 6x reduction), deduplication, quality filtering, cheaper models for labeling.

---

## Loop Gate

Flows can iterate their pipeline until exit criteria pass. A normal flow calls its pipeline once per source item. A looping flow calls the pipeline repeatedly until the output meets a condition.

### How It Works

1. Flow calls the pipeline
2. Flow inspects the pipeline output against exit criteria
3. If criteria pass, the flow proceeds to its destination
4. If criteria fail, the flow re-calls the pipeline with updated input
5. `maxIterations` prevents infinite loops

### Code Pattern

```typescript
// Inside a Flow worker's scheduled() handler
const maxIterations = 5;
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
        content: input,
        previousResult: result,
        iteration: i,
      }),
    })
  );

  result = await response.json();

  if (result.qualityScore >= 8) {
    break;
  }
}

await writeToDestination(result);
```

### Key Rules

- **Pipelines don't loop.** A pipeline runs its action chain once and returns output.
- **Flows control iteration.** The for-loop and exit condition live in the Flow worker.
- **Always set `maxIterations`.** Without a cap, a failing exit condition creates an infinite loop.
- **Exit criteria are simple.** Check a field on the result --- a score, a boolean, a status string.

---

## Queue Composition

Queues connect Flows to Flows, splitting a monolithic scheduled job into a producer-consumer pair. This is not a new primitive --- it is a deployment pattern that composes existing Flows while isolating their subrequest budgets.

### Why Queues

Cloudflare Workers have a 1000-subrequest limit per invocation. Queue composition solves this by splitting work:

- **Producer Flow** (cron-triggered): polls sources and enqueues items
- **Consumer Flow** (queue-triggered): processes one batch at a time

Each worker gets its own 1000-subrequest budget.

### Pattern

```
┌──────────────────────────┐
│ F_PRODUCER  (cron)       │
│  fetch sources           │
│  dedup (KV)              │
│  sendBatch() → queue     │
└────────────┬─────────────┘
             │  Cloudflare Queue
             ▼
┌──────────────────────────┐
│ F_CONSUMER  (queue)      │
│  queue() handler         │
│  extract → rate → write  │
│  message.ack() / retry() │
└──────────────────────────┘
```

### Key Rules

- **Queues connect Flows, not Actions or Pipelines.**
- **sendBatch() max 100 messages.** Chunk larger batches.
- **Dedup on both sides.** Producer deduplicates against KV. Consumer checks D1.
- **Retry is per-message.** `message.retry()` requeues; `message.ack()` removes permanently.
- **Existing example:** `F_FEEDS_POLLER` (producer) + `F_FEEDS_PROCESSOR` (consumer).

---

## Two-Tier Worker Model

Arbol uses two types of Cloudflare Workers, selected based on workload:

### V8 Isolate Workers

Lightweight, near-zero cold start. Best for parsing, transformation, formatting, routing, JSON manipulation.

### Sandbox Workers

Full-runtime workers (Docker via CF Sandbox SDK). Best for LLM calls, external APIs, complex processing, operations requiring secrets/bindings.

**Selection rule:** Default to V8 Isolate. Upgrade to Sandbox only when the action requires network calls, secrets, or bindings.

---

## Execution Modes

The same actions, pipelines, and flows run in either mode without code changes.

| Aspect | Local | Cloud |
|--------|-------|-------|
| Runtime | `bun` via `runner.v2.ts` | Cloudflare Workers |
| Pipe model | Same passthrough pattern | Same passthrough pattern |
| CLI command | `arbol run --local` | `arbol run` |
| Auth | Local bypass or token | Bearer token via `shared/auth.ts` |
| Scheduling | Manual trigger only | Cron triggers |
| Use case | Development, testing | Production |

---

## Shared Infrastructure

Three shared modules provide consistent behavior across all Arbol workers:

### `shared/auth.ts`

Bearer token authentication. Every worker validates incoming requests against `AUTH_TOKEN`.

### `shared/anthropic.ts`

Shared Anthropic API client. Centralizes model selection, token management, error handling.

### `shared/action-worker.ts`

Base worker factory: request parsing, authentication, error handling, consistent input/output contracts.

---

## Authentication

All Arbol Workers require Bearer token authentication:

```
Authorization: Bearer YOUR_AUTH_TOKEN
```

- **Health endpoints** (`GET /health`) are public --- no auth required
- **All other endpoints** require a valid Bearer token
- Tokens stored as Cloudflare Worker secrets (`AUTH_TOKEN`)

### Secrets by Worker Type

| Secret | Flows | Pipelines | Actions (LLM) | Actions (Custom) |
|--------|-------|-----------|---------------|------------------|
| `AUTH_TOKEN` | Required | Required | Required | Required |
| `ANTHROPIC_API_KEY` | - | - | Required | - |
| Custom API keys | - | - | - | Per-action |

---

## Deployment

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 18+ | Required for Wrangler CLI |
| **bun** | 1.0+ | Package management + local dev |
| **Wrangler CLI** | 3.0+ | Cloudflare deployment tool |
| **Cloudflare account** | Free tier works | Worker hosting |
| **Anthropic API key** | --- | Required for LLM actions |

### Cloudflare Account Setup

1. **Authenticate:** `wrangler login`
2. **Account ID:** Workers & Pages > Overview > right sidebar
3. **API Token:** My Profile > API Tokens > "Edit Cloudflare Workers" template

### Code Mode MCP vs Wrangler

| Operation | Tool | Why |
|-----------|------|-----|
| Deploy workers | `bunx wrangler deploy` | Needs local files + wrangler.jsonc |
| Set secrets | `bunx wrangler secret put` | Writes to worker secret store |
| List workers / check status | MCP `execute()` | API query, no local files needed |
| View logs/analytics | MCP `execute()` | API query |

**CRITICAL:** Always `unset CF_API_TOKEN && unset CLOUDFLARE_API_TOKEN` before deploying --- they interfere with wrangler's OAuth auth.

### Worker Naming Convention

| Primitive | Naming Pattern | Example |
|-----------|----------------|---------|
| **Action** | `arbol-a-{kebab-case-name}` | `arbol-a-label-and-rate` |
| **Pipeline** | `arbol-p-{kebab-case-name}` | `arbol-p-example` |
| **Flow** | `arbol-f-{kebab-case-name}` | `arbol-f-example` |

### Deployment Order

Each layer depends on the one below:

```
1. Actions    (no dependencies)
2. Pipelines  (depend on actions via service bindings)
3. Flows      (depend on pipelines via service bindings + cron triggers)
```

### Deploy Script

```bash
cd "${LIFEOS_DIR}/USER/CUSTOMIZATIONS/ARBOL"
bash deploy.sh a-your-action          # Deploy single worker
echo "token" | bunx wrangler secret put AUTH_TOKEN --name arbol-a-your-action
```

### Production Secrets

Use Wrangler's secret management --- never `.env` files for deployed workers:

```bash
echo "your-secret" | bunx wrangler secret put SECRET_NAME --name arbol-a-your-action
```

### Security Best Practices

1. Never commit secrets (`.env`, `.dev.vars` in `.gitignore`)
2. Use Wrangler secrets for production (never `--var` for sensitive values)
3. Require Bearer token auth on all non-health endpoints
4. Generate secure tokens: `openssl rand -hex 32`
5. Health endpoints must never return secrets or internal state

### Cron Syntax Reference

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sun=0)
│ │ │ │ │
* * * * *
```

| Expression | Schedule |
|-----------|----------|
| `*/5 * * * *` | Every 5 minutes |
| `0 */6 * * *` | Every 6 hours |
| `0 9 * * 1-5` | 9 AM UTC, weekdays only |
| `0 0 * * *` | Midnight UTC daily |

---

## Three-Tier RSS Fetch

The feed poller (`F_FEEDS_POLLER`) uses a three-tier fallback to handle sites blocking Cloudflare Worker IPs:

```
Tier 1: Direct fetch ──(403?)──> Tier 2: Jina Reader ──(fail?)──> Tier 3: Self-Hosted Proxy
```

| Tier | Method | Returns | Works For |
|------|--------|---------|-----------|
| **1** | Direct `fetch()` from CF Worker | Raw XML | ~95% of feeds |
| **2** | Jina Reader (`r.jina.ai`) | Markdown → parsed by `parseJinaMarkdown()` | CF-blocked feeds except Reddit |
| **3** | Self-hosted proxy (`proxy.example.com`) | Raw XML via non-CF IP | ALL feeds including Reddit |

**Proxy infrastructure:** a small self-hosted VPS (any commodity ARM or x86 box works) with Caddy auto-TLS, Bun server, and bearer-token auth.

**Circuit breaker:** `error_count >= 50` skips the feed. Resets to 0 on any successful fetch (any tier).

---

## Troubleshooting

### Worker Not Found (404)

Worker name in `wrangler.jsonc` doesn't match deployed name. Verify via MCP: `execute("GET /accounts/{account_id}/workers/scripts/arbol-a-name")`

### 401 Unauthorized

AUTH_TOKEN not set or mismatched. Check: `execute("GET /accounts/{account_id}/workers/scripts/arbol-a-name/secrets")`

### Anthropic API Errors

- `401` --- Invalid API key
- `429` --- Rate limited, implement backoff
- `529` --- API overloaded, retry with delay

### Service Binding Errors

Target worker doesn't exist or name mismatch. Deploy target workers **before** deploying workers that bind to them.

### Cron Trigger Not Firing

Verify cron syntax in `wrangler.jsonc`, ensure `scheduled` method is exported, check Cloudflare Dashboard > Triggers.

### Flow Runs But No Output

Check `flow-state.json` for errors. Common: malformed pipeline output, AUTH_TOKEN mismatch, missing API keys on action workers.

---

## Links

| Document | Path | Description |
|----------|------|-------------|
| Source Code | `{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/ARBOL/` | Cloudflare Workers source repository |
| Cloudflare Skill | `Cloudflare` skill (LifeOS Skill registry) | MCP + wrangler dual-mode operations |
| Architecture | `LifeosSystemArchitecture.md` | LifeOS system architecture |
| System Actions | `{{LIFEOS_DIR}}/ARBOL/Actions/` | Framework actions (examples) |
| System Pipelines | `{{LIFEOS_DIR}}/ARBOL/Pipelines/` | Framework pipelines (examples) |
| System Flows | `{{LIFEOS_DIR}}/ARBOL/Flows/` | Framework flows (examples) |
| Personal Actions | `{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/ARBOL/ACTIONS/` | User-defined actions (override system) |
| Personal Pipelines | `{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/ARBOL/PIPELINES/` | User-defined pipelines (override system) |
| Personal Flows | `{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/ARBOL/FLOWS/` | User-defined flows (override system) |

---

**Last Updated:** 2026-04-20

---

## Changelog

| Date | Change | Author | Related |
|------|--------|--------|---------|
| 2026-04-20 | Consolidated ACTIONS/, FLOWS/, PIPELINES/, ARBOLSYSTEM.md under LIFEOS/ARBOL/ | {{DA_NAME}} | Subsystem unification |
| 2026-04-01 | Consolidated ACTIONS.md, PIPELINES.md, FLOWS.md, DEPLOYMENT.md into this single authoritative doc | {{DA_NAME}} | Architecture reorg |
| 2026-02-25 | Added Queue Composition pattern | {{DA_NAME}} | Feed system |
| 2026-02-22 | Added Loop Gate, aligned with actual Arbol codebase | {{DA_NAME}} | FLOWS.md |
| 2026-02-03 | Initial document creation | {{DA_NAME}} | LifeosSystemArchitecture.md |
