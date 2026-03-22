#!/usr/bin/env bun
/**
 * DriftMonRun.hook.ts - Run DriftMon at Session End (SessionEnd)
 *
 * PURPOSE:
 * Runs DriftMon behavioral drift analysis automatically when an Archie session
 * ends. Analyzes all Claude LEARNING files for drift signals (hedging, refusals,
 * softeners, meta-commentary) and writes updated CSV results.
 *
 * TRIGGER: SessionEnd
 *
 * INPUT:
 * - stdin: Hook input JSON (session_id, transcript_path)
 *
 * OUTPUT:
 * - stdout: None
 * - stderr: DriftMon summary
 * - exit(0): Always (non-blocking)
 *
 * SIDE EFFECTS:
 * - Overwrites: /root/driftmon_results.csv
 * - Copies to: Windows path if accessible
 *
 * INTER-HOOK RELATIONSHIPS:
 * - MUST RUN AFTER: WorkCompletionLearning (so new learnings are captured first)
 * - INDEPENDENT OF: Other SessionEnd hooks
 *
 * PERFORMANCE:
 * - Non-blocking (async, fire-and-forget)
 * - Typical execution: 1-3 seconds
 */

import { spawn } from "child_process";

async function main() {
  try {
    const proc = spawn("python3", ["/root/driftmon.py", "--csv"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    });

    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    let stdout = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.on("close", (code: number | null) => {
      if (code === 0) {
        process.stderr.write(`[DriftMon] Analysis complete — results written to /root/driftmon_results.csv\n`);
      } else {
        process.stderr.write(`[DriftMon] Exited with code ${code}: ${stderr.trim()}\n`);
      }
    });

    // Don't block — let it run
    proc.unref();
  } catch (err: any) {
    process.stderr.write(`[DriftMon] Failed to launch: ${err.message}\n`);
  }
}

main();
