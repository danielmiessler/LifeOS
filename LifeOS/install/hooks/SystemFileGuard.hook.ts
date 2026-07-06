#!/usr/bin/env bun
/**
 * SystemFileGuard.hook.ts — PreToolUse Write/Edit/MultiEdit gate.
 *
 * Blocks writes of user-identifying patterns (per skills/_LIFEOS/DENY_LIST.txt)
 * into SYSTEM files (anything under ~/.claude/ that is NOT in a containment
 * zone per hooks/lib/containment-zones.ts).
 *
 * Doctrine: "public by construction, not public by scrub." Without this
 * runtime gate, every release pipeline run is the only defense against
 * leak drift; with this gate, contamination is caught at write time when
 * intent is fresh and correction is cheap.
 *
 * EXIT CODES:
 *   0  -> allow (USER zone, out-of-tree, clean SYSTEM write, or fail-safe-open)
 *   2  -> deny (deny-list pattern matched against a SYSTEM file write)
 *
 * FAIL-SAFE-OPEN: any error in the hook's own execution exits 0 with a log
 * entry. A bug in the guard must NEVER block file writes.
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { evaluateWrite, extractNewContent } from "./lib/system-file-guard-core";
import { displayPath, paiPath } from "./lib/paths";

const LOG_PATH = paiPath("MEMORY/OBSERVABILITY/system-file-guard.jsonl");

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    content?: string;
    new_string?: string;
    edits?: Array<{ new_string?: string }>;
  };
}

function readHookInput(): HookInput {
  try {
    return JSON.parse(readFileSync(0, "utf-8")) as HookInput;
  } catch {
    return {};
  }
}

function logEvent(event: Record<string, unknown>): void {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n";
    const dir = dirname(LOG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(LOG_PATH, line);
  } catch {
    // Logging failure must not affect the gate decision.
  }
}

function denyMessage(relPath: string, pattern: string, match: string): string {
  return [
    "",
    "═══════════════════════════════════════════════════════════════════════════",
    "  SystemFileGuard — write BLOCKED.",
    "═══════════════════════════════════════════════════════════════════════════",
    "",
    `  Target:    ${relPath}`,
    `  Pattern:   ${pattern}`,
    `  Matched:   ${match}`,
    "",
    "  This file is in the SYSTEM tree — it must not contain principal-",
    "  identifying tokens, hostnames, contact info, or other deny-list",
    "  patterns. Move the user-specific content to a USER-zone location",
    "  or read it through the LifeosConfig interface:",
    "",
    `    import { loadLifeosConfig, paiUserDir } from '${displayPath(paiPath("TOOLS/LifeosConfig"))}';`,
    "",
    "  Canonical USER zones (any of these can hold the content):",
    "    LIFEOS/USER/PRINCIPAL/        principal identity files",
    "    LIFEOS/USER/DIGITAL_ASSISTANT/  DA identity / voice / personality",
    "    LIFEOS/USER/TELOS/            mission / goals / strategies",
    "    LIFEOS/USER/CONFIG/           settings.user.json, LIFEOS_CONFIG.toml",
    "    LIFEOS/USER/CUSTOMIZATIONS/   personal skills / arbol overrides",
    "    LIFEOS/MEMORY/                work sessions, learnings, observability",
    "",
    "  Doctrine: LIFEOS/DOCUMENTATION/SystemUserBoundary.md",
    "",
    "═══════════════════════════════════════════════════════════════════════════",
    "",
  ].join("\n");
}

function main(): never {
  try {
    const input = readHookInput();
    const filePath = input?.tool_input?.file_path;
    if (!filePath) {
      // No path → harmless, allow.
      process.exit(0);
    }

    const newContent = extractNewContent(input.tool_input);
    const decision = evaluateWrite(filePath, newContent);

    if (!decision.block) {
      // Allow: out-of-tree, USER zone, or clean SYSTEM write.
      process.exit(0);
    }

    // Block: SYSTEM file write with a deny-list match.
    const hit = decision.hits[0]!;
    logEvent({
      action: "block",
      session_id: input.session_id,
      tool_name: input.tool_name,
      file_path: decision.filePath,
      rel_path: decision.relPath,
      classification: decision.classification,
      pattern: hit.pattern,
      match: hit.match,
      match_index: hit.index,
    });
    process.stderr.write(denyMessage(decision.relPath, hit.pattern, hit.match));
    process.exit(2);
  } catch (err) {
    // Fail-safe-open. NEVER block on internal errors.
    logEvent({ action: "fail-safe-open", error: String(err) });
    process.exit(0);
  }
}

main();
