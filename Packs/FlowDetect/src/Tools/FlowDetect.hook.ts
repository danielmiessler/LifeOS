#!/usr/bin/env bun
/**
 * FlowDetect.hook.ts - Mid-session flow state detection
 *
 * PURPOSE:
 * Periodically analyzes Rob's message patterns in the current session
 * to detect flow states. When deep flow is detected, suggests starting
 * a Garmin session to capture biometric data.
 *
 * TRIGGER: SessionEnd (writes flow score to results)
 *          Also callable mid-session by the AI when message count hits thresholds.
 *
 * INPUT:
 * - stdin: Hook input JSON (session_id, transcript_path)
 *
 * OUTPUT:
 * - stderr: Flow state summary
 * - exit(0): Always (non-blocking)
 *
 * SIDE EFFECTS:
 * - Overwrites: /root/flowdetect_results.csv (via --csv)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - RUNS AFTER: DriftMonRun (both at SessionEnd)
 * - INDEPENDENT OF: Other hooks
 */

import { spawn } from "child_process";

async function main() {
  try {
    // Read stdin for session context
    let input = "";
    for await (const chunk of Bun.stdin.stream()) {
      input += new TextDecoder().decode(chunk);
      break; // Just need the first chunk
    }

    let sessionId = "";
    try {
      const parsed = JSON.parse(input);
      sessionId = parsed.session_id || "";
    } catch {
      // No session context — run CSV update only
    }

    // Always update the CSV baseline
    const csvProc = spawn("python3", ["/root/flowdetect.py", "--csv"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });

    csvProc.on("close", (code: number | null) => {
      if (code === 0) {
        process.stderr.write(`[FlowDetect] CSV updated\n`);
      } else {
        process.stderr.write(`[FlowDetect] CSV update failed (code ${code})\n`);
      }
    });

    csvProc.unref();
  } catch (err: any) {
    process.stderr.write(`[FlowDetect] Failed: ${err.message}\n`);
  }
}

main();
