> **PAI 3.0 Alpha** --- This system is under active development. APIs, configuration formats, and features may change without notice.

# Arbol System

**Cloudflare Workers Execution Platform**

---

## Overview

Arbol is the cloud execution layer for PAI. It runs on Cloudflare Workers and provides the infrastructure for deploying AI-powered automation as serverless functions at the edge.

Where PAI's local system (the Algorithm, Skills, Memory) operates on the developer's machine, Arbol extends PAI into the cloud. It handles scheduled jobs, API integrations, LLM-powered transformations, and multi-step data pipelines --- all deployed as Cloudflare Workers with global distribution and near-zero cold starts.

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
return {
  ...upstream,        // preserve all prior action output
  myField: result,    // add this action's contribution
};
```

This means the final action in a pipeline has access to every field produced by every preceding action --- not just the immediately previous one.

---

## Two-Tier Worker Model

Arbol uses two types of Cloudflare Workers, selected based on workload requirements:

### V8 Isolate Workers

Lightweight workers for CPU-only work. These run in Cloudflare's V8 isolates with extremely fast cold starts (under 5ms).

**Best for:**
- Parsing and data transformation
- Formatting and templating
- Routing and dispatch logic
- JSON manipulation
- Lightweight validation

**Characteristics:**
- Near-zero cold start
- Very low memory footprint
- No external runtime dependencies
- Limited to CPU-bound operations

### Sandbox Workers

Full-runtime workers for heavier operations that require external API calls or extended processing.

**Best for:**
- LLM calls (Anthropic, OpenAI)
- External API integrations
- Complex data processing
- Operations requiring secrets/bindings

**Characteristics:**
- Heavier cold start than V8 isolates
- Full fetch API and external network access
- Secret bindings for API keys
- Service bindings for inter-worker communication

**Selection rule:** Default to V8 Isolate. Upgrade to Sandbox only when the action requires network calls, secrets, or bindings.

---

## Shared Infrastructure

Three shared modules provide consistent behavior across all Arbol workers:

### `shared/auth.ts`

Bearer token authentication used by all workers. Every worker validates incoming requests against a shared auth token before processing. This ensures that pipeline-to-action calls and external triggers are all authenticated uniformly.

### `shared/anthropic.ts`

Shared Anthropic API client used by all LLM-calling actions. Centralizes model selection, token management, and error handling so individual actions do not duplicate API configuration.

### `shared/action-worker.ts`

Base worker factory that provides consistent action structure. Every action worker is created through this factory, which handles:
- Request parsing and validation
- Authentication (via `shared/auth.ts`)
- Error handling and response formatting
- Consistent input/output contracts

---

## How to Create

### Creating an Action

1. Create an `A_NAME/` directory in the Arbol project.
2. Add an `ACTION.md` file describing the action's purpose, inputs, and outputs.
3. Implement the action logic using `shared/action-worker.ts` as the base.
4. Configure `wrangler.toml` for the worker.
5. Deploy as a Cloudflare Worker: `wrangler deploy`.

**Directory structure:**
```
A_MY_ACTION/
  ACTION.md          # Documentation
  src/
    index.ts         # Worker entry point (uses action-worker factory)
  wrangler.toml      # Cloudflare config
```

### Creating a Pipeline

1. Create a `P_NAME.yaml` file defining the pipeline.
2. Declare the pipeline's `name`, `description`, and ordered `actions` list.
3. Deploy as a Cloudflare Worker with **service bindings** to each action worker in the chain.
4. The pipeline worker calls each action in sequence, passing output forward via the pipe model.

**Pipeline YAML structure:**
```yaml
name: P_MY_PIPELINE
description: Processes items through enrichment and formatting
actions:
  - A_PARSE
  - A_ENRICH
  - A_FORMAT
```

### Creating a Flow

1. Create an `F_NAME/` worker directory.
2. Configure a **cron trigger** in `wrangler.toml` for the desired schedule.
3. Implement the flow logic: fetch from source, invoke pipeline, write to destination.
4. Add service bindings to the pipeline worker(s) the flow uses.

**Flow structure:**
```
F_MY_FLOW/
  src/
    index.ts         # Cron handler: source -> pipeline -> destination
  wrangler.toml      # Cron trigger + service bindings
```

**Cron trigger example:**
```toml
[triggers]
crons = ["0 */6 * * *"]   # Every 6 hours
```

---

## Links

| Document | Path | Description |
|----------|------|-------------|
| Actions | `ACTIONS.md` | Full action documentation: creation, testing, deployment |
| Pipelines | `PIPELINES.md` | Full pipeline documentation: YAML format, composition, binding |
| Flows | `FLOWS.md` | Full flow documentation: scheduling, sources, destinations |
| Source Code | `~/Projects/your-arbol-project/` | Cloudflare Workers source repository |

---

**Last Updated:** 2026-02-14
