#!/usr/bin/env bun
import './lib/gate';
/**
 * CheckVersion.hook.ts - Check for Claude Code Updates (SessionStart)
 *
 * PURPOSE:
 * Compares the installed Claude Code version against the latest available on npm.
 * If an update is available, displays a notification to stderr. This keeps the
 * system current without interrupting workflow.
 *
 * TRIGGER: SessionStart
 *
 * INPUT:
 * - None (reads version info from CLI and npm)
 *
 * OUTPUT:
 * - stdout: None
 * - stderr: Update notification if newer version available
 * - exit(0): Always (non-blocking)
 *
 * SIDE EFFECTS:
 * - Network request to npm registry (brief)
 * - Spawns two child processes for version checks
 *
 * INTER-HOOK RELATIONSHIPS:
 * - DEPENDS ON: None
 * - COORDINATES WITH: None (fully independent)
 * - MUST RUN BEFORE: None (informational only)
 * - MUST RUN AFTER: None
 *
 * ERROR HANDLING:
 * - Network failures: Silent exit (doesn't block session)
 * - Parse failures: Returns 'unknown', silent exit
 *
 * PERFORMANCE:
 * - Non-blocking: Yes
 * - Typical execution: <500ms
 * - Skipped for subagents: Yes
 */

async function getCurrentVersion(): Promise<string> {
  try {
    const proc = Bun.spawn(['claude', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    const output = await new Response(proc.stdout).text();
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function getLatestVersion(): Promise<string> {
  try {
    const proc = Bun.spawn(['npm', 'view', '@anthropic-ai/claude-code', 'version'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    const output = await new Response(proc.stdout).text();
    return output.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  try {
    // Skip for subagents
    const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
    const isSubagent = claudeProjectDir.includes('/.claude/Agents/') ||
                      process.env.CLAUDE_AGENT_TYPE !== undefined;

    if (isSubagent) {
      process.exit(0);
    }

    const [currentVersion, latestVersion] = await Promise.all([
      getCurrentVersion(),
      getLatestVersion()
    ]);

    if (currentVersion !== 'unknown' && latestVersion !== 'unknown' && currentVersion !== latestVersion) {
      console.error(`💡 Update available: CC ${currentVersion} → ${latestVersion}`);
    }

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();
