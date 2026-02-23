# PAI Actions

> **PAI 3.0 Alpha** — This system is under active development. APIs, configuration formats, and features may change without notice.

Atomic, composable units of work. Each action does one thing, takes JSON in, returns JSON out.

> This directory contains the action framework (runner, lib, types). Personal actions are in `../USER/ACTIONS/`.

## Architecture

Actions run in two environments with identical behavior:

```
┌─────────────────────────────────────────────────────────┐
│                    PAI ACTIONS                           │
│                                                         │
│  LOCAL                          CLOUD (Arbol)           │
│  ─────                          ──────────────          │
│  bun runner.v2.ts run           POST /                  │
│  A_YOUR_ACTION                  arbol-a-your-action     │
│  --input {...}                  .workers.dev            │
│                                                         │
│  Same action logic.             Each action = 1 Worker. │
│  Capabilities injected          Bearer token auth.      │
│  by runner.                     Secrets via CF config.   │
│                                                         │
│  Pipe model: output of action N becomes input of N+1    │
└─────────────────────────────────────────────────────────┘
```

## Naming Convention

- **Prefix:** `A_` for actions
- **Case:** `UPPER_SNAKE_CASE`
- **Length:** 2-4 words
- **Style:** Verb-first (`WRITE`, `EXTRACT`, `LABEL`)

| Action | Description | Requires |
|--------|-------------|----------|
| `A_YOUR_ACTION` | Your custom action description | llm, readFile |
| `A_EXTRACT_TRANSCRIPT` | Extract YouTube transcript via yt-dlp | shell |
| `A_SEND_EMAIL` | Send email via Resend API | fetch |

## Action Structure

Each action is a flat directory:

```
A_YOUR_ACTION/
├── action.json    # Manifest: name, description, input/output schema, requires
└── action.ts      # Implementation: execute(input, ctx) → output
```

### action.json

```json
{
  "name": "A_YOUR_ACTION",
  "description": "Description of what your action does.",
  "input": {
    "content": { "type": "string", "required": true },
    "title":   { "type": "string" }
  },
  "output": {
    "summary":        { "type": "string" },
    "labels":         { "type": "array" },
    "rating":         { "type": "string" },
    "quality_score":  { "type": "integer" }
  },
  "requires": ["llm"]
}
```

### action.ts

```typescript
import type { ActionContext } from "../lib/types.v2";

export default {
  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const { content, ...upstream } = input;  // separate content from metadata
    // ... do work using ctx.capabilities ...
    return { ...upstream, ...results };       // pass metadata through
  },
};
```

## Pipe Model

Actions compose via piping. The output of one action becomes the input of the next.

```
A_FIRST_ACTION                A_SECOND_ACTION
┌─────────────────┐          ┌──────────────────┐
│ Input:           │          │ Input:            │
│   url            │  ─────>  │   content         │  (was "transcript")
│                  │          │   source_id       │  (passed through)
│ Output:          │          │   title           │  (passed through)
│   content    ────┤          │                   │
│   source_id  ────┤          │ Output:           │
│   title      ────┤          │   summary         │
│   source     ────┤          │   labels          │
└─────────────────┘          │   rating          │
                              │   quality_score   │
                              └──────────────────┘
```

**Key pattern:** Actions use `const { content, ...upstream } = input` and return `{ ...upstream, ...ownFields }` to preserve metadata through the pipe.

## Capabilities

Actions declare what they need in `action.json` under `requires`. The runner injects implementations:

| Capability | What It Provides | Example Use |
|-----------|-----------------|-------------|
| `llm` | AI inference (Anthropic API) | LLM-based actions |
| `shell` | Shell command execution | CLI tool wrappers |
| `readFile` | Read files from filesystem | Pattern-based actions |
| `fetch` | HTTP requests | API integrations |

## Running Locally

```bash
# Run a single action
cd ~/.claude/skills/PAI/ACTIONS
bun lib/runner.v2.ts run A_YOUR_ACTION --input '{"content": "Your text here"}'

# Run via pipeline runner
bun lib/pipeline-runner.ts run P_YOUR_PIPELINE --url "https://example.com/content"
```

## Cloud Deployment (Arbol)

Every action is deployed as a separate Cloudflare Worker under the **Arbol** project.

### Workers

Each action is deployed as a Worker with the pattern `arbol-a-{action-name}`:

| Worker | URL | Type |
|--------|-----|------|
| `arbol-a-your-action` | `https://arbol-a-your-action.YOUR-SUBDOMAIN.workers.dev` | LLM action |
| `arbol-a-send-email` | `https://arbol-a-send-email.YOUR-SUBDOMAIN.workers.dev` | Custom action (Resend API) |

### Authentication

All Workers require Bearer token authentication:

```bash
curl -X POST https://arbol-a-your-action.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Your text here", "title": "Optional title"}'
```

### Response Format

```json
{
  "success": true,
  "action": "A_YOUR_ACTION",
  "duration_ms": 5730,
  "output": {
    "summary": "...",
    "labels": ["topic-a", "topic-b"],
    "rating": "B Tier",
    "quality_score": 62
  }
}
```

### Deploying

```bash
cd ~/Projects/arbol

# Deploy all Workers
bash deploy.sh --all

# Deploy specific Worker
bash deploy.sh a-your-action

# Set secrets (first time)
bash deploy.sh --secrets
```

### Architecture

- **LLM actions** (label, write) — Cloudflare Workers using `createActionWorker` factory, call Anthropic API
- **Shell actions** (extract) — Cloudflare Sandbox SDK, Docker container with yt-dlp
- **Custom actions** (send-email) — Cloudflare Workers with custom logic, no LLM (e.g., Resend API for email)
- **Pipelines** — Workers with service bindings that chain action Workers internally
- **Flows** — Workers with Cron Triggers that orchestrate source → pipeline → destination
- **Shared code** — `shared/auth.ts`, `shared/anthropic.ts`, `shared/action-worker.ts`

### Secrets

| Secret | Required By | Purpose |
|--------|------------|---------|
| `AUTH_TOKEN` | All Workers | Bearer token authentication |
| `ANTHROPIC_API_KEY` | LLM actions | Anthropic API access |
| `RESEND_API_KEY` | `a-send-email` | Resend email API access |

## Creating a New Action

1. Create directory `A_YOUR_ACTION/` with `action.json` and `action.ts`
2. Follow the naming convention: `A_VERB_NOUN`, 2-4 words
3. Declare capabilities in `requires`
4. Use the passthrough pattern: `{ ...upstream, ...yourFields }`
5. To deploy as a Worker, add a directory under `~/Projects/arbol/workers/`

## Legacy Actions

The `feed/` directory contains legacy-format actions (feed/ingest, feed/rate, feed/route, feed/summarize) that predate the A_ naming convention. These will be migrated to `A_FEED_INGEST`, etc.

## See Also

- `../PIPELINES/README.md` — Pipeline definitions that chain actions
- `../FLOWS/README.md` — Flow definitions that connect sources to pipelines on a schedule
- `~/Projects/arbol/` — Cloudflare Workers source (Arbol project)
- `../SKILL.md` — Core PAI documentation
