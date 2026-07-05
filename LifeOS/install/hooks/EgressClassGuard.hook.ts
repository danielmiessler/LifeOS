#!/usr/bin/env bun
/**
 * EgressClassGuard.hook.ts — PreToolUse Bash gate for the LifeOS data-class
 * routing matrix (LIFEOS/DOCUMENTATION/Security/DataClassification.md).
 *
 * Blocks Tier-2 inference Bash calls (OpenRouter.ts) whose payload
 * is classified ABOVE the route's data-class ceiling — e.g. a secret or a
 * LIFEOS/USER/** (CONFIDENTIAL) reference handed to the GLM/OpenRouter route
 * (broker, GLM, ceiling INTERNAL). Gates at Bash, so it catches BOTH direct
 * calls AND any subagent's own internal OpenRouter.ts calls (subagent tool calls pass through PreToolUse).
 *
 * EXIT CODES: 0 -> allow · 2 -> deny.
 *
 * FAIL-CLOSED (egress safety, the OPPOSITE of SystemFileGuard): if the command
 * is a confirmed Tier-2 inference call and classification errors, BLOCK. For
 * everything else (non-Tier-2, unparseable input), allow — the gate must never
 * block unrelated Bash.
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { evaluateEgress } from "./lib/egress-class-core";
import { paiPath } from "./lib/paths";

const LOG_PATH = paiPath("MEMORY/OBSERVABILITY/egress-decisions.jsonl");

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: { command?: string };
}

function logEvent(event: Record<string, unknown>): void {
  try {
    const dir = dirname(LOG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
  } catch { /* logging must not affect the decision */ }
}

function denyMessage(d: { route?: { source?: string; model?: string }; ceiling?: string; payloadClass?: string; reason?: string }): string {
  return [
    "",
    "═══════════════════════════════════════════════════════════════════════════",
    "  EgressClassGuard — Tier-2 inference call BLOCKED.",
    "═══════════════════════════════════════════════════════════════════════════",
    "",
    `  Source:    ${d.route?.source} (${d.route?.model})`,
    `  Ceiling:   ${d.ceiling}  (max data class this route may process)`,
    `  Payload:   classified ${d.payloadClass}`,
    `  Reason:    ${d.reason}`,
    "",
    "  LifeOS data-class routing matrix (DataClassification.md):",
    "    RESTRICTED / CONFIDENTIAL  → Anthropic (Native) or OpenAI (Forge) only.",
    "    INTERNAL                   → also GLM via OpenRouter (pinned to a US+ZDR provider).",
    "    PUBLIC                     → any source incl. GLM/OpenRouter.",
    "    Chinese-origin models (GLM/Kimi/MiniMax) cap at INTERNAL.",
    "",
    "  Fix: route this to Native/Forge, OR strip the sensitive content, OR",
    "  if it is genuinely PUBLIC/INTERNAL, remove the secret/USER-path reference.",
    "",
    "═══════════════════════════════════════════════════════════════════════════",
    "",
  ].join("\n");
}

function main(): never {
  let input: HookInput;
  try {
    input = JSON.parse(readFileSync(0, "utf-8")) as HookInput;
  } catch {
    process.exit(0); // can't parse → not our concern
  }

  const cmd = input?.tool_input?.command;
  if (typeof cmd !== "string" || !cmd) process.exit(0);

  try {
    const decision = evaluateEgress(cmd);
    if (!decision.route) process.exit(0); // not a Tier-2 inference call

    if (decision.block) {
      logEvent({
        action: "block", session_id: input.session_id,
        source: decision.route.source, model: decision.route.model,
        ceiling: decision.ceiling, payload_class: decision.payloadClass, reason: decision.reason,
      });
      process.stderr.write(denyMessage(decision));
      process.exit(2);
    }

    logEvent({
      action: "allow", session_id: input.session_id,
      source: decision.route.source, model: decision.route.model,
      ceiling: decision.ceiling, payload_class: decision.payloadClass,
    });
    process.exit(0);
  } catch (err) {
    // Error during evaluation. If it LOOKS like a Tier-2 call, fail CLOSED.
    if (/\bOpenRouter\.ts\b|\bCerberus\.ts\b/.test(cmd)) {
      logEvent({ action: "fail-closed", error: String(err) });
      process.stderr.write("\n  EgressClassGuard: classification error on a Tier-2 call — BLOCKED (fail-closed).\n");
      process.exit(2);
    }
    logEvent({ action: "fail-open", error: String(err) });
    process.exit(0);
  }
}

main();
