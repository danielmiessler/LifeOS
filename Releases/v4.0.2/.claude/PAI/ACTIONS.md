# Actions

> **PAI 4.0** — This system is under active development. APIs, configuration formats, and features may change without notice.

**Atomic, Composable Units of Work**

Actions are the third primitive in the architecture. Each action does one thing, takes JSON in, returns JSON out. Actions are the building blocks that Pipelines chain and Flows orchestrate.

---

## What Actions Are

Actions are **atomic units of work** — single-purpose functions that transform input to output. They follow the UNIX philosophy: do one thing well, compose through standard interfaces.

**The Action Pattern:**

```
JSON Input → Action Logic → JSON Output
```

**Real Examples:**

| Action | Input | Output |
|--------|-------|--------|
| `A_LABEL_AND_RATE` | `{ content, title }` | `{ labels, rating, quality_score }` |
| `A_EXTRACT_TRANSCRIPT` | `{ url }` | `{ content, video_id, title }` |
| `A_SEND_EMAIL` | `{ to, subject, body }` | `{ success, message_id }` |

**Primitive Hierarchy:**

| Primitive | Prefix | What It Does | Composes |
|-----------|--------|--------------|----------|
| **Action** | `A_` | Single unit of work (LLM call, API call, shell command) | Nothing |
| **Pipeline** | `P_` | Chains actions in sequence via pipe model | Actions |
| **Flow** | `F_` | Connects source → pipeline → destination on a schedule | Pipelines |

---

## Cloud Architecture (Arbol)

Actions run in two environments with identical behavior:

```
┌─────────────────────────────────────────────────────────┐
│                    PAI ACTIONS                           │
│                                                         │
│  LOCAL                          CLOUD (Arbol)           │
│  ─────                          ──────────────          │
│  bun runner.v2.ts run           POST /                  │
│  A_LABEL_AND_RATE               arbol-a-label-and-rate  │
│  --input {...}                  .workers.dev            │
│                                                         │
│  Same action logic.             Each action = 1 Worker. │
│  Capabilities injected          Bearer token auth.      │
│  by runner.                     Secrets via CF config.  │
│                                                         │
│  Pipe model: output of action N becomes input of N+1   │
└─────────────────────────────────────────────────────────┘
```

### Two-Tier Worker Model

| Type | Environment | Use Case | Example |
|------|-------------|----------|---------|
| **V8 Isolate** | Cloudflare Workers | LLM actions, API calls | A_LABEL_AND_RATE |
| **Sandbox** | Docker via CF Sandbox SDK | Shell commands, system tools | A_EXTRACT_TRANSCRIPT |

---

## Naming Convention

- **Prefix:** `A_` for actions
- **Case:** `UPPER_SNAKE_CASE`
- **Length:** 2-4 words
- **Style:** Verb-first (`WRITE`, `EXTRACT`, `LABEL`, `SEND`)
- **Worker name:** `arbol-a-{kebab-case-name}`

**Examples:**

| Action | Worker Name | Type |
|--------|-------------|------|
| `A_LABEL_AND_RATE` | `arbol-a-label-and-rate` | LLM |
| `A_WRITE_TWITTER_POST` | `arbol-a-write-twitter-post` | LLM |
| `A_EXTRACT_TRANSCRIPT` | `arbol-a-extract-transcript` | Sandbox |
| `A_SEND_EMAIL` | `arbol-a-send-email` | Custom |

---

## Action Structure

Each action is a flat directory under `~/.claude/PAI/ACTIONS/`:

```
A_LABEL_AND_RATE/
├── action.json    # Manifest: name, description, input/output schema, requires
└── action.ts      # Implementation: execute(input, ctx) → output
```

### action.json

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

---

## Pipe Model

Actions compose via piping. The output of one action becomes the input of the next.

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

**Key pattern:** Actions use `const { content, ...upstream } = input` and return `{ ...upstream, ...ownFields }` to preserve metadata through the pipe.

---

## Capabilities

Actions declare what they need in `action.json` under `requires`. The runner injects implementations:

| Capability | What It Provides | Used By |
|-----------|-----------------|---------|
| `llm` | AI inference (Anthropic API) | LLM actions |
| `shell` | Shell command execution | Shell actions |
| `readFile` | Read files from filesystem | Actions needing file access |
| `fetch` | HTTP requests | API integration actions |

### Capability Injection

**Local:** Runner injects real implementations
**Cloud:** Worker factory provides Cloudflare-compatible versions

```typescript
// Local - runner.v2.ts
const capabilities = {
  llm: createAnthropicLLM(apiKey),
  shell: createShellExecutor(),
  readFile: fs.readFile,
};

// Cloud - action-worker.ts
const capabilities = {
  llm: createCloudflareAnthropicLLM(env.ANTHROPIC_API_KEY),
  // shell not available in V8 isolates
};
```

---

## Running Actions

### Local Execution

```bash
cd ~/.claude/PAI/ACTIONS

# Run a single action
bun lib/runner.v2.ts run A_LABEL_AND_RATE --input '{"content": "Your text here"}'

# Run via pipeline runner (chains actions)
bun lib/pipeline-runner.ts run P_LABEL_AND_RATE --url "https://youtube.com/watch?v=..."
```

### Cloud Execution (Arbol)

```bash
# Direct API call to a deployed action worker
curl -X POST https://arbol-a-your-action.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Your text here"}'
```

### Response Format

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

---

## Authentication

All Arbol Workers require Bearer token authentication:

```bash
Authorization: Bearer YOUR_AUTH_TOKEN
```

- **Health endpoints** (`GET /health`) are public — no auth required
- **All other endpoints** require a valid Bearer token
- Tokens stored as Cloudflare Worker secrets (`AUTH_TOKEN`)

### Secrets by Action Type

| Secret | LLM Actions | Shell Actions | Custom Actions |
|--------|-------------|---------------|----------------|
| `AUTH_TOKEN` | Required | Required | Required |
| `ANTHROPIC_API_KEY` | Required | - | - |
| Custom API keys | - | - | Per-action |

---

## Creating a New Action

### Step 1: Create Directory

```bash
# Personal actions go in USER/ACTIONS/
mkdir ~/.claude/PAI/USER/ACTIONS/A_YOUR_ACTION
```

### Step 2: Define Manifest (action.json)

```json
{
  "name": "A_YOUR_ACTION",
  "description": "What this action does.",
  "input": {
    "content": { "type": "string", "required": true }
  },
  "output": {
    "result": { "type": "string" }
  },
  "requires": ["llm"]
}
```

### Step 3: Implement Logic (action.ts)

```typescript
import type { ActionContext } from "../lib/types.v2";

interface Input {
  content: string;
  [key: string]: unknown;
}

interface Output {
  result: string;
  [key: string]: unknown;
}

export default {
  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const { content, ...upstream } = input;

    const llm = ctx.capabilities.llm;
    if (!llm) throw new Error("LLM capability required");

    const result = await llm(content, { tier: "fast" });

    return {
      ...upstream,
      result: result.text,
    };
  },
};
```

### Step 4: Test Locally

```bash
bun lib/runner.v2.ts run A_YOUR_ACTION --input '{"content": "test"}'
```

### Step 5: Deploy to Cloud (Optional)

Add `~/Projects/arbol/workers/a-your-action/`:

```
workers/a-your-action/
├── wrangler.jsonc
└── src/
    └── index.ts
```

Deploy:

```bash
cd ~/Projects/arbol
bash deploy.sh a-your-action
echo "token" | npx wrangler secret put AUTH_TOKEN --name arbol-a-your-action
```

---

## Action Categories

### LLM Actions

Use AI for content generation/analysis. Run in V8 isolates. Require `llm` capability.

### Shell Actions

Execute system commands. Run in Sandbox (Docker). Require `shell` capability.

### Custom Actions

External API integrations. Run in V8 isolates. May require `fetch` and custom API keys.

Personal actions are stored in `USER/ACTIONS/`. System/example actions are in `ACTIONS/`.

---

## Best Practices

### 1. Single Responsibility

Each action does ONE thing. If it does two things, split it.

### 2. Passthrough Pattern

Always pass upstream metadata through:

```typescript
const { content, ...upstream } = input;
return { ...upstream, ...myFields };
```

### 3. Explicit Capabilities

Declare everything in `requires`. Don't assume capabilities exist.

### 4. Fail Fast

Validate inputs immediately. Throw clear errors.

```typescript
if (!input.content) throw new Error("Missing required input: content");
```

### 5. Idempotent Where Possible

Same input should produce same output (for LLM actions, use temperature 0).

---

## Related Documentation

- **Pipelines:** `~/.claude/PAI/PIPELINES.md`
- **Flows:** `~/.claude/PAI/FLOWS.md`
- **Architecture:** `~/.claude/PAI/PAISYSTEMARCHITECTURE.md`
- **Personal Actions:** `~/.claude/PAI/USER/ACTIONS/`
- **Source code:** `~/Projects/arbol/`

---

**Last Updated:** 2026-02-14

---

## Changelog

| Date | Change | Author | Related |
|------|--------|--------|---------|
| 2026-02-03 | Created document | {DAIDENTITY.NAME} | PAISYSTEMARCHITECTURE.md, PIPELINES.md, FLOWS.md |
