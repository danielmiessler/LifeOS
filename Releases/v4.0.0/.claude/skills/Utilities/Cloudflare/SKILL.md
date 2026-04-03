---
name: Cloudflare
description: Deploy and manage Cloudflare Workers, Pages, and services via Code Mode MCP (API queries) + wrangler (deploys). OAuth auth for wrangler (tokens lack Pages perms). USE WHEN Cloudflare, worker, deploy, Pages, MCP server, wrangler, DNS, KV, R2, D1, Vectorize.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Cloudflare/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Cloudflare skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Cloudflare** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Cloudflare Skill

Deploy and manage Cloudflare Workers, Pages, and services. Uses **two complementary tools**:

- **Code Mode MCP** (primary for API operations) — `search()` + `execute()` for querying workers, managing KV/R2/D1, checking deployments, DNS, analytics. ~1,069 tokens vs 1.17M for traditional MCP.
- **Wrangler** (deploy/dev only) — `wrangler deploy`, `wrangler dev`, `wrangler pages deploy` for deploying from local files.

## Dual-Mode Reference

| Operation | Tool | Why |
|-----------|------|-----|
| Deploy Worker | `wrangler deploy` | Needs local files + wrangler.toml |
| Deploy Pages | `wrangler pages deploy` | Needs dist/ directory |
| Local dev | `wrangler dev` | Local server |
| List Workers | MCP `execute()` | API query, no local files needed |
| Check deployment status | MCP `execute()` | API query |
| Read/write KV | MCP `execute()` | API operation |
| Manage DNS | MCP `execute()` | API operation |
| View logs | MCP `execute()` | API query |
| Inspect R2/D1/Vectorize | MCP `execute()` | API operations |
| View analytics | MCP `execute()` | API query |

## Workflow Routing

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **Cloudflare** skill to ACTION...
```

  - **Create** Worker or MCP server → `Workflows/Create.md`
  - **Troubleshoot** deployment issues → `Workflows/Troubleshoot.md`
  - **Query** Cloudflare state (list workers, check KV, DNS, analytics) → `Workflows/Query.md`

## Code Mode MCP Reference

The Cloudflare Code Mode MCP server (`https://mcp.cloudflare.com/mcp`) exposes the entire Cloudflare API through 2 tools:

### `search()` — Discover endpoints

Find API endpoints by keyword. Use this when you don't know the exact path.

```
// Example: Find all Workers-related endpoints
search("workers scripts")

// Example: Find KV namespace operations
search("KV namespace")

// Example: Find DNS record endpoints
search("DNS records")
```

### `execute()` — Call the API

Execute any Cloudflare API endpoint directly. Handles auth automatically via OAuth.

```
// Example: List all Workers scripts
execute("GET /accounts/{account_id}/workers/scripts")

// Example: Read a KV value
execute("GET /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{key_name}")

// Example: List DNS records
execute("GET /zones/{zone_id}/dns_records")
```

### MCP Auth

Code Mode MCP handles authentication via OAuth — no tokens needed. On first use, it will prompt for Cloudflare login. After that, auth is cached.

## Quick Reference

- **Account ID:** Set via `CF_ACCOUNT_ID` environment variable
- **Worker URL format:** `https://[worker-name].[your-subdomain].workers.dev`

## Deployment Commands

### Workers Deployment
```bash
# Unset tokens that interfere with wrangler login-based auth
(unset CF_API_TOKEN && unset CLOUDFLARE_API_TOKEN && wrangler deploy)
```

### Pages Deployment

**CRITICAL: ALL env tokens lack Pages permissions. MUST unset them to use OAuth:**

```bash
# ALWAYS unset tokens for Pages - OAuth login works, tokens don't
(unset CF_API_TOKEN && unset CLOUDFLARE_API_TOKEN && bunx wrangler pages deploy dist --project-name=PROJECT_NAME --commit-dirty=true)
```

## Critical Notes

- **Workers:** Unset `CF_API_TOKEN` and `CLOUDFLARE_API_TOKEN` before deploying - they interfere with wrangler login-based auth
- **Pages:** UNSET ALL TOKENS - None of the API tokens have Pages permissions. OAuth-based wrangler login is the ONLY method that works.
- **API queries:** Use Code Mode MCP instead of manual `curl` or `fetch()` to `api.cloudflare.com`
- **Wrangler stays for:** deploy, dev, pages deploy, and local config only

## Examples

**Example 1: Deploy a Worker**
```
User: "deploy the MCP server to Cloudflare"
-> Invokes CREATE workflow
-> Unsets env tokens, runs wrangler deploy
-> Verifies via MCP execute() that worker is live
-> "Deployed to https://mcp-server.[subdomain].workers.dev"
```

**Example 2: Query Cloudflare state**
```
User: "list all my workers"
-> Invokes QUERY workflow
-> MCP search("workers scripts") to find endpoint
-> MCP execute("GET /accounts/{id}/workers/scripts")
-> Returns list of all deployed workers
```

**Example 3: Fix deployment error**
```
User: "Cloudflare deploy is failing with auth error"
-> Invokes TROUBLESHOOT workflow
-> MCP execute() to check deployment status and logs
-> Identifies token interference
-> "Fixed - tokens were overriding OAuth. Redeployed successfully."
```

**Example 4: Check DNS records**
```
User: "what DNS records does example.com have?"
-> Invokes QUERY workflow
-> MCP search("DNS records") + execute() to list records
-> Returns full DNS record table
```
