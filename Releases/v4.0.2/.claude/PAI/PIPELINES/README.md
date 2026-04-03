# PAI Pipelines

> **PAI 4.0** — This system is under active development. APIs, configuration formats, and features may change without notice.

Pipelines chain actions together. A pipeline is just a list of actions executed in order using the **pipe model** — the output of each action becomes the input of the next.

> This directory contains pipeline documentation. Personal pipeline YAMLs are in `../USER/PIPELINES/`.

## Naming Convention

- **Prefix:** `P_` for pipelines
- **Case:** `UPPER_SNAKE_CASE`
- **Length:** 2-4 words

| Pipeline | Actions | Description |
|----------|---------|-------------|
| `P_YOUR_PIPELINE` | A_FIRST_ACTION → A_SECOND_ACTION | Chain actions in sequence |
| `P_PROCESS_AND_NOTIFY` | A_PROCESS_DATA → A_SEND_EMAIL | Process content, then notify via email |

## Pipeline Format

A pipeline YAML has three fields:

```yaml
name: P_YOUR_PIPELINE
description: What this pipeline does in one sentence

actions:
  - A_FIRST_ACTION
  - A_SECOND_ACTION
```

That's it. No template interpolation, no conditional routing, no output mapping. Actions pipe directly.

## Pipe Model

```
Input → Action 1 → Action 2 → ... → Action N → Output
         │                              │
         └── output becomes ────────────┘
              next input
```

- Each action receives the **full output** of the previous action as its input
- The pipeline's final output is the **last action's output** only
- Actions use the passthrough pattern (`...upstream`) to preserve metadata through the pipe

## Running Locally

```bash
cd ~/.claude/PAI/ACTIONS
bun lib/pipeline-runner.ts run P_YOUR_PIPELINE --input '{"content": "Your text here"}'
```

## Cloud Deployment (Arbol)

Pipelines are deployed as Cloudflare Workers that use **service bindings** to call action Workers internally — zero network hops, zero latency penalty.

### How It Works

```
Client                    Pipeline Worker              Action Workers
  │                       (arbol-p-your-pipeline)
  │  POST / {input}       ┌──────────────────┐
  │ ─────────────────────>│  1. Validate auth │
  │                       │  2. Parse input   │
  │                       │  3. Call actions:  │
  │                       │     ┌─────────────┤
  │                       │     │ service     ─┼──> arbol-a-first-action
  │                       │     │ binding      │        (returns processed data)
  │                       │     ├─────────────┤
  │                       │     │ pipe output ─┼──> arbol-a-second-action
  │                       │     │ as input     │        (returns final output)
  │                       │     └─────────────┤
  │                       │  4. Return result  │
  │ <─────────────────────└──────────────────┘
  │  {success, output}
```

### Workers

Each pipeline is deployed as a Worker with the pattern `arbol-p-{pipeline-name}`:

| Worker | URL | Service Bindings |
|--------|-----|-----------------|
| `arbol-p-your-pipeline` | `https://arbol-p-your-pipeline.YOUR-SUBDOMAIN.workers.dev` | A_FIRST_ACTION, A_SECOND_ACTION |

### Usage

```bash
curl -X POST https://arbol-p-your-pipeline.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Your text here"}'
```

### Response Format

```json
{
  "success": true,
  "pipeline": "P_YOUR_PIPELINE",
  "total_duration_ms": 12500,
  "steps": [
    { "action": "A_FIRST_ACTION", "duration_ms": 8200 },
    { "action": "A_SECOND_ACTION", "duration_ms": 4300 }
  ],
  "output": {
    "content": "...",
    "summary": "...",
    "labels": ["..."],
    "rating": "B Tier",
    "quality_score": 55
  }
}
```

### Deploying

```bash
cd ~/Projects/arbol
bash deploy.sh p-your-pipeline
```

## Creating a New Pipeline

### 1. Define the YAML

Create `P_YOUR_PIPELINE.yaml` in this directory:

```yaml
name: P_YOUR_PIPELINE
description: What this pipeline does in one sentence

actions:
  - A_FIRST_ACTION
  - A_SECOND_ACTION
  - A_THIRD_ACTION
```

### 2. Ensure Actions Exist

All referenced actions must exist as `A_` directories under `../ACTIONS/`. Each action must have its own `ACTION.md` and implementation.

### 3. Test Locally

```bash
cd ~/.claude/PAI/ACTIONS
bun lib/pipeline-runner.ts run P_YOUR_PIPELINE --input '{"key": "value"}'
```

### 4. Deploy to Arbol (Cloud)

Create a Worker under `~/Projects/arbol/workers/p-your-pipeline/`:
- Add service bindings to each action Worker in `wrangler.toml`
- Import `shared/auth.ts` for Bearer token authentication
- Deploy with `bash deploy.sh p-your-pipeline`

## Legacy Pipelines

Files matching `*.pipeline.yaml` are from the old format (template interpolation, output mapping). These reference actions that may not exist in the new `A_` format. They are retained for reference but should not be used.

## See Also

- `../ACTIONS/README.md` — Action definitions and structure
- `../FLOWS/README.md` — Flow definitions that connect sources to pipelines on a schedule
- `~/Projects/arbol/` — Cloudflare Workers source (Arbol project)
