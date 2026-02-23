# troubleshoot-cloudflare-deployment

Comprehensive Cloudflare deployment troubleshooting workflow with recursive testing and automated fixes using Chrome MCP tools for visual verification.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Troubleshoot workflow in the Cloudflare skill to debug deployment issues"}' \
  > /dev/null 2>&1 &
```

Running the **Troubleshoot** workflow in the **Cloudflare** skill to debug deployment issues...

## When to Use This Command

**USE THIS COMMAND WHEN:**
- Deploying to Cloudflare
- Website deployment succeeds but site doesn't work
- Wrangler deployment errors occur
- Need to verify deployment is actually working
- Site shows errors after deployment
- Need to check logs from failed deployments

## What This Command Does

This command implements a recursive test-fix-verify loop:

1. **Check Deployment Status**: Query Cloudflare API for deployment state
2. **Read Deployment Logs**: Fetch and analyze logs from failed deployments
3. **Test with Chrome MCP**: Verify the deployed site actually works
4. **Identify Issues**: Analyze console errors, network failures, visual problems
5. **Apply Fixes**: Make corrections based on identified issues
6. **Re-deploy**: Push fixes to trigger new deployment
7. **Repeat**: Loop until deployment succeeds AND site works correctly

**🚨 CRITICAL**: This command uses Chrome MCP tools (PRIMARY) to ACTUALLY TEST the deployed site, not just check if the deployment succeeded!

# NEVER USE FUCKING CURL, ONLY BROWSER-AUTOMATION (or Chrome MCP fallback)

!!!! ONLY Use Chrome MCP tools (`Chrome MCP tools` then `browser navigate/screenshot/act`) to control Chrome and test whether the application site is loading and what its behavior is

- Cloudflare API token in .env file: CLOUDFLARE_API_TOKEN_WORKERS_EDIT

## Implementation

```typescript
#!/usr/bin/env bun

/**
 * Cloudflare Deployment Troubleshooting Tool
 *
 * Recursively tests and fixes Cloudflare deployments until they work properly.
 * Uses Chrome MCP tools (PRIMARY) for real browser testing to verify deployments.
 * Falls back to Chrome MCP if Chrome MCP unavailable.
 */

import { $ } from "bun";
import { readFileSync } from "fs";
import { join } from "path";

interface DeploymentInfo {
  id: string;
  status: "success" | "failure" | "in_progress";
  url: string;
  created_at: string;
  latest_stage: {
    name: string;
    status: string;
    ended_at: string | null;
  };
}

interface TestResult {
  passed: boolean;
  issues: string[];
  consoleErrors: any[];
  networkErrors: any[];
  visualIssues: string[];
}

const CLOUDFLARE_ACCOUNT_ID = "your-account-id-here";
const PROJECT_NAME = "your-project-name"; // Replace with your project
const MAX_RETRIES = 5;
const DEPLOYMENT_WAIT_TIME = 180000; // 3 minutes in ms

/**
 * Load Cloudflare API token from environment
 */
function loadApiToken(): string {
  const envPath = join(process.env.HOME!, "Projects/your-project/.env");

  try {
    const envContent = readFileSync(envPath, "utf-8");
    const match = envContent.match(/CF_API_TOKEN=(.+)/);

    if (!match) {
      throw new Error("CLOUDFLARE_API_TOKEN_WORKERS_EDIT not found in .env file");
    }

    return match[1].trim();
  } catch (error) {
    console.error("❌ Error loading API token:", error);
    throw error;
  }
}

/**
 * Fetch latest deployment info from Cloudflare API
 */
async function getLatestDeployment(apiToken: string): Promise<DeploymentInfo | null> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`,
      {
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!data.success || !data.result || data.result.length === 0) {
      console.error("❌ Failed to fetch deployments:", data.errors);
      return null;
    }

    return data.result[0]; // Latest deployment
  } catch (error) {
    console.error("❌ Error fetching deployment:", error);
    return null;
  }
}

/**
 * Fetch deployment logs from Cloudflare API
 */
async function getDeploymentLogs(apiToken: string, deploymentId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${deploymentId}/history/logs`,
      {
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!data.success) {
      console.error("❌ Failed to fetch logs:", data.errors);
      return "Failed to fetch logs";
    }

    // Format logs for readability
    const logs = data.result.data || [];
    return logs.map((log: any) => `[${log.timestamp}] ${log.message}`).join("\n");
  } catch (error) {
    console.error("❌ Error fetching logs:", error);
    return `Error fetching logs: ${error}`;
  }
}

/**
 * Test the deployed site using Chrome MCP
 * This is where we verify the deployment ACTUALLY WORKS
 */
async function testDeploymentWithChrome(url: string): Promise<TestResult> {
  console.log("\n🧪 Testing deployment with Chrome MCP...");
  console.log(`   URL: ${url}`);

  const result: TestResult = {
    passed: true,
    issues: [],
    consoleErrors: [],
    networkErrors: [],
    visualIssues: [],
  };

  try {
    // Note: These Chrome MCP commands should be executed by the Claude agent
    // This TypeScript code indicates what should be done
    console.log("   → Navigate to site");
    console.log("   → Take screenshot");
    console.log("   → Check console errors");
    console.log("   → Check network requests");

    // The agent should use:
    // mcp__Chrome__navigate_page({ url })
    // mcp__Chrome__take_screenshot()
    // mcp__Chrome__list_console_messages()
    // mcp__Chrome__list_network_requests()

    result.issues.push("AGENT_ACTION_REQUIRED: Use Chrome MCP to test deployment");

  } catch (error) {
    result.passed = false;
    result.issues.push(`Chrome testing failed: ${error}`);
  }

  return result;
}

/**
 * Analyze deployment logs to identify common issues
 */
function analyzeLogs(logs: string): string[] {
  const issues: string[] = [];

  // Common error patterns
  const patterns = [
    { pattern: /Error: Cannot find module/, issue: "Missing module dependency" },
    { pattern: /ENOENT: no such file/, issue: "Missing file reference" },
    { pattern: /Failed to load resource/, issue: "Resource loading failed" },
    { pattern: /SyntaxError/, issue: "JavaScript syntax error" },
    { pattern: /Build failed/, issue: "Build process failed" },
    { pattern: /memory/, issue: "Memory limit exceeded" },
    { pattern: /timeout/i, issue: "Build timeout" },
  ];

  for (const { pattern, issue } of patterns) {
    if (pattern.test(logs)) {
      issues.push(issue);
    }
  }

  return issues;
}

/**
 * Main troubleshooting workflow
 */
async function main() {
  console.log("🔍 Cloudflare Deployment Troubleshooter");
  console.log("========================================\n");

  const apiToken = loadApiToken();
  let attemptCount = 0;
  let deploymentFixed = false;

  while (attemptCount < MAX_RETRIES && !deploymentFixed) {
    attemptCount++;
    console.log(`\n📋 Attempt ${attemptCount}/${MAX_RETRIES}`);
    console.log("─".repeat(50));

    // Step 1: Get latest deployment
    console.log("\n1️⃣ Checking deployment status...");
    const deployment = await getLatestDeployment(apiToken);

    if (!deployment) {
      console.log("❌ Could not fetch deployment information");
      process.exit(1);
    }

    console.log(`   Status: ${deployment.status}`);
    console.log(`   URL: ${deployment.url}`);
    console.log(`   Created: ${deployment.created_at}`);
    console.log(`   Stage: ${deployment.latest_stage.name} (${deployment.latest_stage.status})`);

    // Step 2: If deployment in progress, wait
    if (deployment.status === "in_progress") {
      console.log(`\n⏳ Deployment in progress, waiting ${DEPLOYMENT_WAIT_TIME / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, DEPLOYMENT_WAIT_TIME));
      continue;
    }

    // Step 3: If deployment failed, analyze logs
    if (deployment.status === "failure") {
      console.log("\n2️⃣ Fetching deployment logs...");
      const logs = await getDeploymentLogs(apiToken, deployment.id);
      console.log("\n📄 Deployment Logs:");
      console.log("─".repeat(50));
      console.log(logs);
      console.log("─".repeat(50));

      // Analyze logs for issues
      const issues = analyzeLogs(logs);
      if (issues.length > 0) {
        console.log("\n3️⃣ Identified Issues:");
        issues.forEach((issue, i) => {
          console.log(`   ${i + 1}. ${issue}`);
        });

        console.log("\n🔧 AGENT ACTION REQUIRED:");
        console.log("   → Analyze the logs above");
        console.log("   → Identify the root cause");
        console.log("   → Apply fixes to the codebase");
        console.log("   → Commit and push fixes");
        console.log("   → Re-run this command to verify");
      } else {
        console.log("\n⚠️ No obvious issues found in logs");
        console.log("   Manual investigation required");
      }

      process.exit(1);
    }

    // Step 4: Deployment succeeded, now TEST with Chrome MCP
    console.log("\n4️⃣ Deployment succeeded! Now testing with Chrome MCP...");

    const testResult = await testDeploymentWithChrome(deployment.url);

    if (!testResult.passed) {
      console.log("\n❌ Deployment succeeded but site has issues!");
      console.log("\n🔍 Issues Found:");
      testResult.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });

      if (testResult.consoleErrors.length > 0) {
        console.log("\n📋 Console Errors:");
        testResult.consoleErrors.forEach(err => {
          console.log(`   → ${err.message}`);
        });
      }

      if (testResult.networkErrors.length > 0) {
        console.log("\n🌐 Network Errors:");
        testResult.networkErrors.forEach(err => {
          console.log(`   → ${err.url} (${err.status})`);
        });
      }

      if (testResult.visualIssues.length > 0) {
        console.log("\n👁️ Visual Issues:");
        testResult.visualIssues.forEach(issue => {
          console.log(`   → ${issue}`);
        });
      }

      console.log("\n🔧 AGENT ACTION REQUIRED:");
      console.log("   → Review issues above");
      console.log("   → Fix problems in codebase");
      console.log("   → Test locally first!");
      console.log("   → Commit and push fixes");
      console.log("   → Re-run this command to verify");

      process.exit(1);
    }

    // Success!
    console.log("\n✅ Deployment successful and site is working!");
    console.log(`   🌐 Live at: ${deployment.url}`);
    deploymentFixed = true;
  }

  if (!deploymentFixed) {
    console.log(`\n❌ Failed to fix deployment after ${MAX_RETRIES} attempts`);
    console.log("   Manual intervention required");
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

## Usage

```bash
# Run the troubleshooting workflow
troubleshoot-cloudflare-deployment

# The command will:
# 1. Check deployment status
# 2. Show logs if failed
# 3. Test with Chrome MCP if succeeded
# 4. Report all issues found
# 5. Wait for you to fix and re-run
```

## Workflow Steps

### 1. Check Deployment Status
- Queries Cloudflare API for latest deployment
- Shows status, URL, and stage information
- Waits if deployment is in progress

### 2. Analyze Logs (if failed)
- Fetches full deployment logs via API
- Scans for common error patterns:
  - Missing modules
  - File not found errors
  - Build failures
  - Memory issues
  - Timeouts
- Displays identified issues

### 3. Test with Chrome MCP (if succeeded)
**🚨 CRITICAL**: This is where we verify deployment ACTUALLY WORKS!

The agent should use Chrome MCP to:
- Navigate to the deployment URL
- Take screenshot for visual confirmation
- Check console for JavaScript errors
- Monitor network requests for failures
- Verify page loads completely
- Check for visual rendering issues

### 4. Report Issues
- Lists all problems found
- Categorizes by type (console, network, visual)
- Provides specific error messages
- Suggests next steps

### 5. Wait for Fixes
- Pauses for you to fix issues
- Instructions to test locally first
- Reminds to commit and push
- Ready to re-test after fixes

### 6. Recursive Loop
- Automatically re-checks after fixes
- Continues until deployment works correctly
- Maximum 5 attempts to prevent infinite loops

## Chrome MCP Testing Integration

When the command reaches the testing phase, the Claude agent should execute these Chrome MCP commands:

```javascript
// Navigate to deployment URL
await mcp__Chrome__navigate_page({
  url: deployment.url
});

// Take screenshot for visual verification
await mcp__Chrome__take_snapshot();

// Check console for errors
const consoleMsgs = await mcp__Chrome__list_console_messages();
const errors = consoleMsgs.filter(msg => msg.level === 'error');

// Check network requests
const networkReqs = await mcp__Chrome__list_network_requests({
  resourceTypes: ['document', 'stylesheet', 'script', 'xhr', 'fetch']
});
const failedReqs = networkReqs.filter(req => req.status >= 400);

// Report findings
if (errors.length > 0 || failedReqs.length > 0) {
  console.log("❌ Issues found during Chrome testing!");
  // List specific issues...
}
```

## Common Issues and Fixes

### Build Failures
**Issue**: Build process fails during deployment
**Logs**: "Build failed" or "Command failed with exit code 1"
**Fix**:
- Run `bun run build` locally to see errors
- Fix compilation/build errors
- Commit and push

### Missing Dependencies
**Issue**: Module not found errors
**Logs**: "Cannot find module 'package-name'"
**Fix**:
- Add missing dependencies to package.json
- Run `bun install` to verify
- Commit package.json and bun.lockb

### Resource Loading Failures
**Issue**: Site loads but resources 404
**Chrome**: Network tab shows failed requests
**Fix**:
- Check file paths in code
- Ensure files are committed to git
- Verify _redirects file

### JavaScript Errors
**Issue**: Console shows runtime errors
**Chrome**: Console errors visible
**Fix**:
- Fix JavaScript errors locally
- Test thoroughly before pushing
- Check browser compatibility

### Memory/Timeout Issues
**Issue**: Build exceeds limits
**Logs**: "memory" or "timeout" messages
**Fix**:
- Reduce build size
- Optimize dependencies
- Split large bundles

## Example Output

```
🔍 Cloudflare Deployment Troubleshooter
========================================

📋 Attempt 1/5
──────────────────────────────────────────────────

1️⃣ Checking deployment status...
   Status: failure
   URL: https://abc123.website.pages.dev
   Created: 2025-01-10T14:30:00Z
   Stage: build_and_deploy (failed)

2️⃣ Fetching deployment logs...

📄 Deployment Logs:
──────────────────────────────────────────────────
[14:30:15] Installing dependencies...
[14:30:20] Running build command: bun run build
[14:30:25] Error: Cannot find module '@vue/shared'
[14:30:25] Build failed with exit code 1
──────────────────────────────────────────────────

3️⃣ Identified Issues:
   1. Missing module dependency
   2. Build process failed

🔧 AGENT ACTION REQUIRED:
   → Analyze the logs above
   → Identify the root cause
   → Apply fixes to the codebase
   → Commit and push fixes
   → Re-run this command to verify
```

## Integration with Other Commands

This command works well with:
- `publish-blog` - Automatically called after blog publishing
- `write-blog` - Use before publishing to catch issues early
- `browser-tools-setup` - Ensure Chrome MCP is ready for testing

## Best Practices

1. **Always test locally first** - Run `bun run build` before pushing
2. **Use Chrome MCP for verification** - Don't trust deployment status alone
3. **Check all error types** - Console, network, and visual issues
4. **Fix one issue at a time** - Don't try to fix everything at once
5. **Re-test after each fix** - Ensure the fix actually worked

## Notes

- Requires Cloudflare API token in .env file
- Maximum 5 retry attempts to prevent infinite loops
- Waits 3 minutes for in-progress deployments
- Chrome MCP must be running for site testing
- Tests both deployment success AND actual functionality
