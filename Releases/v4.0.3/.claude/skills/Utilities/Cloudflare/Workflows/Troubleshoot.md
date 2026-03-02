# Troubleshoot Cloudflare Deployment

Diagnose and fix Cloudflare deployment issues using Code Mode MCP for API queries and Browser skill for visual verification.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Troubleshoot workflow in the Cloudflare skill to debug deployment issues"}' \
  > /dev/null 2>&1 &
```

Running the **Troubleshoot** workflow in the **Cloudflare** skill to debug deployment issues...

## When to Use

- Deploying to Cloudflare and something goes wrong
- Website deployment succeeds but site doesn't work
- Wrangler deployment errors occur
- Need to verify deployment is actually working
- Site shows errors after deployment
- Need to check logs from failed deployments

## Troubleshooting Steps

### 1. Check Deployment Status via MCP

Use Code Mode MCP to query deployment state — no manual curl/fetch needed.

**For Workers:**
```
# Find the right endpoint
MCP search("workers deployments")

# List recent deployments
MCP execute("GET /accounts/{account_id}/workers/scripts/{script_name}/deployments")
```

**For Pages:**
```
# Find Pages deployment endpoints
MCP search("pages deployments")

# List recent Pages deployments
MCP execute("GET /accounts/{account_id}/pages/projects/{project_name}/deployments")

# Get specific deployment details
MCP execute("GET /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}")
```

### 2. Fetch Deployment Logs via MCP

```
# Get Pages deployment logs
MCP search("pages deployment logs")
MCP execute("GET /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}/history/logs")
```

**Analyze logs for common patterns:**
- `Cannot find module` — Missing dependency
- `ENOENT: no such file` — Missing file reference
- `Build failed` — Build process error
- `memory` — Memory limit exceeded
- `timeout` — Build timeout

### 3. Check DNS and Routes via MCP

```
# Verify DNS records point correctly
MCP execute("GET /zones/{zone_id}/dns_records")

# Check worker routes
MCP search("worker routes")
MCP execute("GET /zones/{zone_id}/workers/routes")
```

### 4. Visual Verification with Browser

**CRITICAL**: Use Browser skill (Playwright) to ACTUALLY TEST the deployed site. Build success != site works.

1. Navigate to deployment URL
2. Take screenshot for visual confirmation
3. Check console for JavaScript errors
4. Monitor network requests for failures
5. Verify page loads completely

### 5. Apply Fix and Re-deploy

1. Identify root cause from logs/MCP data
2. Fix locally
3. Test locally with `wrangler dev`
4. Re-deploy via wrangler
5. Verify again via MCP + Browser

## Common Issues and Fixes

### Auth Token Interference
**Symptom**: "Authentication error" during deploy
**Fix**: Unset env tokens — they override wrangler OAuth
```bash
(unset CF_API_TOKEN && unset CLOUDFLARE_API_TOKEN && wrangler deploy)
```

### Build Failures
**Symptom**: Build fails during deployment
**Diagnose**: Check logs via MCP
**Fix**: Run `bun run build` locally, fix errors, redeploy

### Missing Dependencies
**Symptom**: "Cannot find module" in logs
**Fix**: Add missing deps to package.json, run `bun install`, commit lockfile

### Resource Loading Failures
**Symptom**: Site loads but resources 404
**Diagnose**: Browser screenshot shows broken layout
**Fix**: Check file paths, ensure files committed, verify _redirects

### JavaScript Errors
**Symptom**: Console errors on deployed site
**Diagnose**: Browser console check
**Fix**: Fix JS errors locally, test, redeploy

### Memory/Timeout Issues
**Symptom**: Build exceeds limits
**Diagnose**: MCP deployment logs show memory/timeout
**Fix**: Reduce build size, optimize dependencies, split bundles

## Workflow Loop

```
Check Status (MCP) → Read Logs (MCP) → Diagnose → Fix Locally → Redeploy (wrangler) → Verify (MCP + Browser) → Done or Loop
```

Maximum 5 iterations. If not resolved, escalate to manual investigation.

## Best Practices

1. **Always test locally first** — `bun run build` before pushing
2. **Use Browser for verification** — Don't trust deployment status alone
3. **Check all error types** — Console, network, and visual
4. **Fix one issue at a time** — Isolate, verify, proceed
5. **MCP for API queries** — Never manual curl to api.cloudflare.com
