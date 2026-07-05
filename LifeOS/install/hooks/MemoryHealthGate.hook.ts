#!/usr/bin/env bun
/**
 * MemoryHealthGate.hook.ts — Stop-chain hook that runs the autonomic-memory
 * health check on every turn end.
 *
 * Output: written to MEMORY/OBSERVABILITY/memory-health.jsonl by the check
 * itself. This hook just invokes it and surfaces a one-line warning to
 * stderr when overall != ok, so the DA sees the warning at session-end.
 *
 * Non-blocking: the hook NEVER fails the Stop chain — health surfacing is
 * an observability concern, not a gating concern. Worst case: the hook
 * exits 0 with a stderr line. The check itself returns its own exit codes
 * to OBSERVABILITY for the historical record.
 */

import { execFileSync } from "node:child_process";
import { paiPath } from "./lib/paths";

const CHECK = paiPath("TOOLS/MemoryHealthCheck.ts");

try {
  const out = execFileSync("bun", [CHECK], {
    timeout: 5000,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const report = JSON.parse(out);
  if (report.overall === "critical") {
    console.error(`🚨 Memory health: CRITICAL — ${report.counts.critical} blocker(s). Run: bun ~/.claude/LIFEOS/TOOLS/MemoryHealthCheck.ts`);
  } else if (report.overall === "warn") {
    console.error(`⚠️  Memory health: WARN — ${report.counts.warn} finding(s).`);
  }
  // ok: silent
} catch (err: any) {
  // Non-zero exit from MemoryHealthCheck is expected when not healthy.
  // Try to parse stdout from the error object.
  try {
    const stdout = err.stdout?.toString?.() || "";
    if (stdout) {
      const report = JSON.parse(stdout);
      if (report.overall === "critical") {
        console.error(`🚨 Memory health: CRITICAL — ${report.counts.critical} blocker(s). Run: bun ~/.claude/LIFEOS/TOOLS/MemoryHealthCheck.ts`);
      } else if (report.overall === "warn") {
        console.error(`⚠️  Memory health: WARN — ${report.counts.warn} finding(s).`);
      }
    }
  } catch {
    // give up silently — health gate must never block Stop chain
  }
}

process.exit(0);
