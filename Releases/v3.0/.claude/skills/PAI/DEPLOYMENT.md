> **PAI 3.0 Alpha** — This system is under active development. APIs, configuration formats, and features may change without notice.

# Arbol Deployment Guide

**End-to-End Cloudflare Workers Deployment**

This guide covers everything needed to deploy Arbol's three primitives — Actions, Pipelines, and Flows — as Cloudflare Workers. It starts with local development and walks through production deployment step by step.

---

## Prerequisites

Before deploying, ensure you have the following installed and configured:

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 18+ | Required for Wrangler CLI |
| **npm** | 9+ | Package management |
| **bun** | 1.0+ | Local development runner |
| **Wrangler CLI** | 3.0+ | Cloudflare deployment tool |
| **Cloudflare account** | Free tier works | Worker hosting |
| **Anthropic API key** | — | Required for LLM-powered actions |

### Install Wrangler

```bash
npm install -g wrangler
```

Verify installation:

```bash
wrangler --version
```

---

## Cloudflare Account Setup

### 1. Authenticate with Wrangler

```bash
wrangler login
```

This opens a browser window for OAuth authentication. After granting permissions, Wrangler stores credentials locally.

### 2. Find Your Account ID

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** > **Overview**
3. Your **Account ID** is displayed in the right sidebar
4. Copy it — you will need it for `wrangler.jsonc` configuration

### 3. Create an API Token

1. Go to **My Profile** > **API Tokens**
2. Click **Create Token**
3. Use the **"Edit Cloudflare Workers"** template
4. Set the token scope to your account
5. Click **Continue to summary** > **Create Token**
6. Copy the token immediately — it is only shown once

Store both values securely. They are used in your `.env` file for local development and CI/CD pipelines.

---

## Local Development

Run actions and pipelines locally before deploying to Cloudflare.

### Running a Single Action

```bash
cd ~/.claude/skills/PAI/ACTIONS

# Run an action with JSON input
bun lib/runner.v2.ts run A_EXAMPLE_SUMMARIZE '{"content": "Your text here"}'

# List all available actions
bun lib/runner.v2.ts list
```

### Running a Pipeline

```bash
cd ~/.claude/skills/PAI/ACTIONS

# Run a pipeline (chains multiple actions)
bun lib/pipeline-runner.ts run P_EXAMPLE_SUMMARIZE_AND_FORMAT --content "Your text here"

# List all available pipelines
bun lib/pipeline-runner.ts list
```

### Local vs Cloud

Local and cloud execution use the same action logic. The runner injects local capabilities (filesystem, shell) while Cloudflare Workers inject cloud-compatible versions (fetch, secrets). This means if an action works locally, the logic will work in the cloud — only the environment setup differs.

---

## Environment Setup

### .env File (Local Development Only)

Create a `.env` file in your project root. This file is for **local development only** — never commit it.

**.env.example:**

```
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
CLOUDFLARE_API_TOKEN=your-api-token-here

# LLM Provider (required for LLM actions)
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Worker Authentication
AUTH_TOKEN=generate-a-secure-random-token-here
```

Generate a secure auth token:

```bash
openssl rand -hex 32
```

### Production Secrets

For deployed workers, **never** use `.env` files. Use Wrangler's secret management:

```bash
# Set a secret on a specific worker
echo "your-secret-value" | npx wrangler secret put SECRET_NAME --name arbol-a-example-summarize

# List secrets for a worker
npx wrangler secret list --name arbol-a-example-summarize
```

Secrets are encrypted at rest and injected into the worker's `env` object at runtime.

---

## Deploying an Action as a Cloudflare Worker

Actions are the atomic building blocks. Each action is deployed as an individual Cloudflare Worker.

### Step 1: Create the Project Structure

```
my-arbol-project/
└── workers/
    └── a-example-summarize/
        ├── wrangler.jsonc
        ├── package.json
        └── src/
            └── index.ts
```

### Step 2: Configure wrangler.jsonc

```jsonc
{
  "name": "arbol-a-example-summarize",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "placement": {
    "mode": "smart"
  }
}
```

- **name**: Must follow the naming convention `arbol-a-{kebab-case-name}`
- **compatibility_flags**: `nodejs_compat` is required for the Anthropic SDK
- **placement.mode**: `smart` enables Cloudflare Smart Placement for reduced latency

### Step 3: Configure package.json

```json
{
  "name": "arbol-a-example-summarize",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.0.0",
    "@cloudflare/workers-types": "^4.0.0"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0"
  }
}
```

### Step 4: Implement the Worker (src/index.ts)

```typescript
import Anthropic from "@anthropic-ai/sdk";

interface Env {
  AUTH_TOKEN: string;
  ANTHROPIC_API_KEY: string;
}

interface ArbolRequest {
  content: string;
  [key: string]: unknown;
}

interface ArbolResponse {
  success: boolean;
  action: string;
  duration_ms: number;
  output?: Record<string, unknown>;
  error?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health endpoint — no auth required
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        status: "ok",
        action: "A_EXAMPLE_SUMMARIZE",
        timestamp: new Date().toISOString(),
      });
    }

    // All other endpoints require Bearer token auth
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only accept POST to root
    if (request.method !== "POST" || url.pathname !== "/") {
      return Response.json(
        { success: false, error: "Method not allowed. POST / only." },
        { status: 405 }
      );
    }

    const start = Date.now();

    try {
      const body = (await request.json()) as ArbolRequest;

      if (!body.content) {
        return Response.json(
          { success: false, error: "Missing required field: content" },
          { status: 400 }
        );
      }

      // Separate content from upstream metadata (passthrough pattern)
      const { content, ...upstream } = body;

      // Call Anthropic API
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Summarize the following content in 2-3 concise sentences:\n\n${content}`,
          },
        ],
      });

      const summary =
        message.content[0].type === "text" ? message.content[0].text : "";

      const response: ArbolResponse = {
        success: true,
        action: "A_EXAMPLE_SUMMARIZE",
        duration_ms: Date.now() - start,
        output: {
          ...upstream, // pass upstream metadata through
          summary,
          model: message.model,
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
        },
      };

      return Response.json(response);
    } catch (err) {
      const response: ArbolResponse = {
        success: false,
        action: "A_EXAMPLE_SUMMARIZE",
        duration_ms: Date.now() - start,
        error: err instanceof Error ? err.message : "Unknown error",
      };

      return Response.json(response, { status: 500 });
    }
  },
};
```

**Key patterns in this worker:**

- **Bearer token auth**: Compares `Authorization` header against `env.AUTH_TOKEN`
- **Health endpoint**: `GET /health` returns status without auth (for monitoring)
- **Passthrough pattern**: `const { content, ...upstream } = body` preserves metadata from previous pipeline stages
- **Standard response format**: `{ success, action, duration_ms, output }` — consistent across all Arbol workers

### Step 5: Deploy

```bash
cd workers/a-example-summarize
npm install

# Set production secrets (never commit these!)
echo "your-auth-token" | npx wrangler secret put AUTH_TOKEN
echo "your-anthropic-key" | npx wrangler secret put ANTHROPIC_API_KEY

# Deploy to Cloudflare
npx wrangler deploy
```

### Step 6: Verify Deployment

```bash
# Health check (no auth)
curl https://arbol-a-example-summarize.YOUR-SUBDOMAIN.workers.dev/health

# Test the action (requires auth)
curl -X POST https://arbol-a-example-summarize.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Authorization: Bearer your-auth-token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Your text to summarize"}'
```

Expected health response:

```json
{
  "status": "ok",
  "action": "A_EXAMPLE_SUMMARIZE",
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

Expected action response:

```json
{
  "success": true,
  "action": "A_EXAMPLE_SUMMARIZE",
  "duration_ms": 1423,
  "output": {
    "summary": "The text discusses...",
    "model": "claude-sonnet-4-20250514",
    "input_tokens": 142,
    "output_tokens": 87
  }
}
```

---

## Deploying a Pipeline Worker

Pipelines chain multiple action workers in sequence using the pipe model. A pipeline worker calls action workers via **service bindings** (zero-hop internal calls with no network latency).

### Project Structure

```
workers/
├── a-example-summarize/       # Action 1
│   ├── wrangler.jsonc
│   ├── package.json
│   └── src/index.ts
├── a-example-format/          # Action 2
│   ├── wrangler.jsonc
│   ├── package.json
│   └── src/index.ts
└── p-example/                 # Pipeline (chains Action 1 → Action 2)
    ├── wrangler.jsonc
    ├── package.json
    └── src/index.ts
```

### wrangler.jsonc (Pipeline)

```jsonc
{
  "name": "arbol-p-example",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "services": [
    { "binding": "SUMMARIZE", "service": "arbol-a-example-summarize" },
    { "binding": "FORMAT", "service": "arbol-a-example-format" }
  ]
}
```

- **services**: Declares service bindings to action workers. Each binding provides a `fetch()` method that calls the target worker internally with zero network overhead.
- **binding**: The variable name available in `env` (e.g., `env.SUMMARIZE`)
- **service**: The Wrangler name of the target worker (must already be deployed)

### src/index.ts (Pipeline Worker)

```typescript
interface Env {
  AUTH_TOKEN: string;
  SUMMARIZE: Fetcher;
  FORMAT: Fetcher;
}

interface PipelineResponse {
  success: boolean;
  pipeline: string;
  duration_ms: number;
  stages: string[];
  output?: Record<string, unknown>;
  error?: string;
  failed_stage?: string;
}

async function callAction(
  binding: Fetcher,
  payload: Record<string, unknown>,
  authToken: string
): Promise<Record<string, unknown>> {
  const response = await binding.fetch(
    new Request("https://internal/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    })
  );

  const result = (await response.json()) as {
    success: boolean;
    output?: Record<string, unknown>;
    error?: string;
  };

  if (!result.success) {
    throw new Error(result.error || "Action failed");
  }

  return result.output || {};
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health endpoint
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        status: "ok",
        pipeline: "P_EXAMPLE",
        stages: ["A_EXAMPLE_SUMMARIZE", "A_EXAMPLE_FORMAT"],
        timestamp: new Date().toISOString(),
      });
    }

    // Auth check
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (request.method !== "POST" || url.pathname !== "/") {
      return Response.json(
        { success: false, error: "Method not allowed. POST / only." },
        { status: 405 }
      );
    }

    const start = Date.now();
    const stages: string[] = [];

    try {
      const input = (await request.json()) as Record<string, unknown>;

      // Stage 1: Summarize
      stages.push("A_EXAMPLE_SUMMARIZE");
      const summarized = await callAction(env.SUMMARIZE, input, env.AUTH_TOKEN);

      // Stage 2: Format (receives output from Stage 1 via pipe model)
      stages.push("A_EXAMPLE_FORMAT");
      const formatted = await callAction(
        env.FORMAT,
        summarized,
        env.AUTH_TOKEN
      );

      const response: PipelineResponse = {
        success: true,
        pipeline: "P_EXAMPLE",
        duration_ms: Date.now() - start,
        stages,
        output: formatted,
      };

      return Response.json(response);
    } catch (err) {
      const response: PipelineResponse = {
        success: false,
        pipeline: "P_EXAMPLE",
        duration_ms: Date.now() - start,
        stages,
        error: err instanceof Error ? err.message : "Unknown error",
        failed_stage: stages[stages.length - 1],
      };

      return Response.json(response, { status: 500 });
    }
  },
};
```

**Key patterns in pipeline workers:**

- **Service bindings** (`env.SUMMARIZE`, `env.FORMAT`) provide zero-hop internal fetch to action workers
- **Pipe model**: Output of Stage 1 becomes the input of Stage 2 — data flows sequentially through the chain
- **Stage tracking**: The `stages` array records which actions executed, and `failed_stage` identifies where a failure occurred

### Deploy the Pipeline

```bash
# IMPORTANT: Deploy action workers FIRST — service bindings require the target to exist
cd workers/a-example-summarize && npm install && npx wrangler deploy
cd workers/a-example-format && npm install && npx wrangler deploy

# Then deploy the pipeline worker
cd workers/p-example && npm install

# Set secrets
echo "your-auth-token" | npx wrangler secret put AUTH_TOKEN

# Deploy
npx wrangler deploy

# Test
curl -X POST https://arbol-p-example.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Authorization: Bearer your-auth-token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Your text to process through the pipeline"}'
```

---

## Deploying a Flow with Cron Triggers

Flows are scheduled workers that connect a source (RSS feed, API, webhook) to a pipeline and run on a cron schedule. They use Cloudflare's native **Cron Triggers** — no external scheduler needed.

### wrangler.jsonc (Flow)

```jsonc
{
  "name": "arbol-f-example",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "triggers": {
    "crons": ["0 */6 * * *"]
  },
  "services": [
    { "binding": "PIPELINE", "service": "arbol-p-example" }
  ]
}
```

- **triggers.crons**: An array of cron expressions. Cloudflare fires the `scheduled()` handler at each interval.
- **services**: Service binding to the pipeline worker this flow feeds into.

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
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 */6 * * *` | Every 6 hours |
| `0 9 * * 1-5` | 9 AM UTC, weekdays only |
| `0 0 * * *` | Midnight UTC daily |
| `0 0 1 * *` | First day of each month |

### src/index.ts (Flow Worker)

```typescript
interface Env {
  AUTH_TOKEN: string;
  PIPELINE: Fetcher;
}

interface SourceItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

// Simple RSS parser (production flows may use a library)
function parseRssItems(xml: string): SourceItem[] {
  const items: SourceItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag: string): string => {
      const tagMatch = itemXml.match(
        new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}>([\\s\\S]*?)<\\/${tag}>`)
      );
      return tagMatch ? (tagMatch[1] || tagMatch[2] || "").trim() : "";
    };

    items.push({
      title: getTag("title"),
      link: getTag("link"),
      description: getTag("description"),
      pubDate: getTag("pubDate"),
    });
  }

  return items;
}

async function processItem(
  item: SourceItem,
  env: Env
): Promise<{ success: boolean; title: string; error?: string }> {
  try {
    const response = await env.PIPELINE.fetch(
      new Request("https://internal/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.AUTH_TOKEN}`,
        },
        body: JSON.stringify({
          content: `${item.title}\n\n${item.description}`,
          title: item.title,
          source_url: item.link,
          published_at: item.pubDate,
        }),
      })
    );

    const result = (await response.json()) as { success: boolean; error?: string };
    return { success: result.success, title: item.title, error: result.error };
  } catch (err) {
    return {
      success: false,
      title: item.title,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default {
  // Cron trigger handler — called by Cloudflare on schedule
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`[F_EXAMPLE] Cron fired at ${new Date(event.scheduledTime).toISOString()}`);

    // Step 1: Fetch source
    const rssResponse = await fetch("https://example.com/feed.xml");
    if (!rssResponse.ok) {
      console.error(`[F_EXAMPLE] Source fetch failed: ${rssResponse.status}`);
      return;
    }

    const xml = await rssResponse.text();
    const items = parseRssItems(xml);
    console.log(`[F_EXAMPLE] Found ${items.length} items`);

    // Step 2: Process each item through the pipeline
    const results = await Promise.allSettled(
      items.map((item) => processItem(item, env))
    );

    // Step 3: Log results
    const succeeded = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.length - succeeded;
    console.log(
      `[F_EXAMPLE] Complete: ${succeeded} succeeded, ${failed} failed out of ${items.length}`
    );
  },

  // HTTP handler — for health checks and manual triggers
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health endpoint (no auth)
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        status: "ok",
        flow: "F_EXAMPLE",
        timestamp: new Date().toISOString(),
      });
    }

    // Manual trigger endpoint (requires auth)
    if (url.pathname === "/trigger" && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
        return Response.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      // Run the same logic as the cron handler
      // In production, call a shared function
      return Response.json({
        success: true,
        message: "Manual trigger accepted. Check logs for results.",
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
```

**Key patterns in flow workers:**

- **`scheduled()` handler**: Called by Cloudflare Cron Triggers — this is the main entry point
- **`fetch()` handler**: Provides health checks and manual trigger endpoints
- **Source fetch**: The flow is responsible for fetching its own data source (RSS, API, etc.)
- **Pipeline call via service binding**: Each source item is passed through the pipeline

### Deploy the Flow

```bash
# IMPORTANT: Deploy pipeline and action workers FIRST
cd workers/f-example && npm install

# Set secrets
echo "your-auth-token" | npx wrangler secret put AUTH_TOKEN

# Deploy
npx wrangler deploy

# Verify health
curl https://arbol-f-example.YOUR-SUBDOMAIN.workers.dev/health

# Manual trigger (for testing)
curl -X POST https://arbol-f-example.YOUR-SUBDOMAIN.workers.dev/trigger \
  -H "Authorization: Bearer your-auth-token"
```

After deployment, the cron trigger runs automatically on the configured schedule. View execution logs in the Cloudflare Dashboard under **Workers & Pages** > your worker > **Logs**.

---

## Worker Naming Convention

All Arbol workers follow a consistent naming scheme:

| Primitive | Prefix | Naming Pattern | Example |
|-----------|--------|----------------|---------|
| **Action** | `A_` | `arbol-a-{kebab-case-name}` | `arbol-a-example-summarize` |
| **Pipeline** | `P_` | `arbol-p-{kebab-case-name}` | `arbol-p-example` |
| **Flow** | `F_` | `arbol-f-{kebab-case-name}` | `arbol-f-example` |

**Rules:**

- All worker names start with `arbol-` to namespace them within your Cloudflare account
- The second segment (`a-`, `p-`, `f-`) identifies the primitive type
- The rest uses kebab-case derived from the `UPPER_SNAKE_CASE` action name
- Example: `A_LABEL_AND_RATE` becomes `arbol-a-label-and-rate`

---

## Security Best Practices

### 1. Never Commit Secrets

Add these to `.gitignore`:

```gitignore
.env
.env.*
*.vars
.dev.vars
```

### 2. Use Wrangler Secrets for Production

```bash
# Set a secret
echo "your-secret-value" | npx wrangler secret put SECRET_NAME --name arbol-a-your-action

# Never use --var for sensitive values (those appear in plaintext in the dashboard)
```

### 3. Require Bearer Token Auth

All workers must validate Bearer tokens on every non-health endpoint. The pattern:

```typescript
const authHeader = request.headers.get("Authorization");
if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
  return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
}
```

### 4. Generate Secure Random Tokens

```bash
# Generate a 256-bit random token
openssl rand -hex 32
```

Use a unique `AUTH_TOKEN` per environment (development vs production). Consider using separate tokens per worker in high-security deployments.

### 5. Health Endpoints Are Public

The `/health` endpoint is intentionally unauthenticated for monitoring and uptime checks. It must **never** return secrets, internal state, or sensitive configuration. Only return:

- Worker status (`ok` / `error`)
- Worker name
- Timestamp

---

## Troubleshooting

### Worker Not Found (404)

**Cause:** The worker name in `wrangler.jsonc` does not match the deployed worker name, or the worker has not been deployed yet.

**Fix:**
```bash
# List all deployed workers
npx wrangler deployments list --name arbol-a-example-summarize

# Verify the name in wrangler.jsonc matches exactly
```

### 401 Unauthorized

**Cause:** The `AUTH_TOKEN` secret is not set, or the token in the request does not match.

**Fix:**
```bash
# Verify the secret exists
npx wrangler secret list --name arbol-a-example-summarize

# Re-set the secret if needed
echo "your-auth-token" | npx wrangler secret put AUTH_TOKEN --name arbol-a-example-summarize
```

### Anthropic API Errors

**Cause:** The `ANTHROPIC_API_KEY` secret is not set or is invalid.

**Fix:**
```bash
# Set or update the API key
echo "your-anthropic-key" | npx wrangler secret put ANTHROPIC_API_KEY --name arbol-a-example-summarize
```

Common Anthropic errors:
- `401 authentication_error` — Invalid API key
- `429 rate_limit_error` — Too many requests; implement backoff or reduce frequency
- `529 overloaded_error` — API under heavy load; retry after a delay

### Service Binding Errors

**Cause:** The target worker referenced in a service binding does not exist or has a different name.

**Fix:**
1. Verify the target worker is deployed: `npx wrangler deployments list --name arbol-a-example-summarize`
2. Check `wrangler.jsonc` — the `"service"` value must exactly match the target worker's `"name"`
3. Deploy target workers **before** deploying the worker that binds to them

### Cron Trigger Not Firing

**Cause:** The cron expression is invalid, or the worker's `scheduled()` handler is not exported.

**Fix:**
1. Verify the cron syntax in `wrangler.jsonc` under `triggers.crons`
2. Ensure the default export includes a `scheduled` method
3. Check **Workers & Pages** > your worker > **Triggers** in the Cloudflare Dashboard to confirm the cron is registered
4. View **Logs** in the dashboard to see if the handler executed with errors

### Worker Exceeds CPU Time Limit

**Cause:** Free-tier workers have a 10ms CPU time limit (50ms on paid plan). LLM actions spend most time waiting on network, not CPU, so this rarely triggers. If it does:

**Fix:**
1. Move to a paid Workers plan for higher limits
2. Optimize CPU-intensive operations (JSON parsing, string manipulation)
3. Split heavy actions into smaller units

---

## Deployment Order

When deploying a full Arbol stack, follow this order — each layer depends on the one below it:

```
1. Actions    (no dependencies)
2. Pipelines  (depend on actions via service bindings)
3. Flows      (depend on pipelines via service bindings + cron triggers)
```

**Example full deployment:**

```bash
# Step 1: Deploy all action workers
cd workers/a-example-summarize && npm install && npx wrangler deploy
cd workers/a-example-format && npm install && npx wrangler deploy

# Step 2: Set secrets on action workers
echo "your-auth-token" | npx wrangler secret put AUTH_TOKEN --name arbol-a-example-summarize
echo "your-anthropic-key" | npx wrangler secret put ANTHROPIC_API_KEY --name arbol-a-example-summarize
echo "your-auth-token" | npx wrangler secret put AUTH_TOKEN --name arbol-a-example-format

# Step 3: Deploy pipeline worker
cd workers/p-example && npm install && npx wrangler deploy
echo "your-auth-token" | npx wrangler secret put AUTH_TOKEN --name arbol-p-example

# Step 4: Deploy flow worker
cd workers/f-example && npm install && npx wrangler deploy
echo "your-auth-token" | npx wrangler secret put AUTH_TOKEN --name arbol-f-example

# Step 5: Verify the full stack
curl https://arbol-a-example-summarize.YOUR-SUBDOMAIN.workers.dev/health
curl https://arbol-p-example.YOUR-SUBDOMAIN.workers.dev/health
curl https://arbol-f-example.YOUR-SUBDOMAIN.workers.dev/health
```

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| Actions | `SYSTEM/ACTIONS.md` | Action creation, testing, deployment, capabilities |
| Pipelines | `SYSTEM/PIPELINES.md` | Pipeline YAML format, verification gates, composition |
| Flows | `SYSTEM/FLOWS.md` | Cron scheduling, sources, destinations, cost considerations |
| Arbol Overview | `SYSTEM/ARBOLSYSTEM.md` | Architecture overview, two-tier worker model, shared infrastructure |

---

**Last Updated:** 2026-02-14
