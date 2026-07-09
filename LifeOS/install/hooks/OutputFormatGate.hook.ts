#!/usr/bin/env bun
/**
 * OutputFormatGate.hook.ts — enforce LifeOS mode-banner presence on every assistant response.
 *
 * PURPOSE:
 * Block-back any assistant response that doesn't carry one of the three canonical
 * mode banners (NATIVE / ALGORITHM / MINIMAL). Closes the 28+ logged format-drift
 * failures cited in `MEMORY/LEARNING/SIGNALS/feedback_output-format-compliance.md`
 * by promoting `LIFEOS_SYSTEM_PROMPT.md § Output Format` from doctrine to structural
 * enforcement.
 *
 * TRIGGER: Stop
 *
 * MECHANISM:
 *   - Read input.last_assistant_message (CC v2.1.47+; transcript-parse fallback)
 *   - Honor input.stop_hook_active — if true, this is a recovery turn after a prior
 *     block; do not block again (prevents infinite loops per Anthropic hook API)
 *   - On miss, emit {"decision":"block","reason":"..."} so Claude continues the turn
 *     with corrective feedback baked in
 *   - Always append observability JSONL so misses are auditable regardless of decision
 *
 * BACKWARDS-COMPAT:
 *   - Empty / undefined last_assistant_message → no-op (continue:true)
 *   - Code blocks with banner-shaped substrings are guarded by multiline ^ anchor
 */

import { readHookInput } from "./lib/hook-io";
import { collectCurrentResponseText } from "../LIFEOS/TOOLS/TranscriptParser";
import { scanAiSpeak } from "./lib/ai-speak-patterns";
import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const OBS_PATH = join(
  process.env.LIFEOS_DIR || join(process.env.HOME!, ".claude", "LIFEOS"),
  "MEMORY",
  "OBSERVABILITY",
  "format-gate.jsonl",
);

// Multiline-anchored unicode banners — see LIFEOS_SYSTEM_PROMPT.md § Mode Templates.
// The U+2550 (═) box-drawing chars are the doctrine literal; do not soften.
// The Algorithm SUMMARY-block prefix is included as an alternate ALGORITHM-mode
// signal — Algorithm runs that continue across multiple turns don't re-emit the
// entry banner but ALWAYS close with the mandatory `━━━ 📃 SUMMARY ━━━` block
// (per Algorithm v6.6.0 § FINAL OUTPUT FORMAT). One of either entry-banner or
// SUMMARY-prefix must be present.
const BANNER_PATTERNS: RegExp[] = [
  /^════\s*LifeOS\s*\|\s*NATIVE MODE\s*═{10,}/m,
  /^♻︎\s*Entering the PAI ALGORITHM…/m,
  /^━{3,}\s*📃\s*SUMMARY\s*━{3,}/m,
  /^═{3,5}\s*LifeOS\s*═{20,}/m,
];

// F2: 🧠 MEMORY line presence check — OBSERVABILITY ONLY.
// As of 2026-06-11 the 🧠 MEMORY line is ALWAYS-ON and hook-fed:
// MemoryDeltaSurface.hook.ts injects a <pai-memory-delta> block on every
// primary-session prompt (delta form when curation wrote, heartbeat+freshness
// form otherwise) and the model echoes it verbatim. Enforcement stays "log" —
// blocking on absence was the 2026-05-28 failure mode (model-self-computed
// lines), and the hook can legitimately be absent (subagents, hook errors).
// Telemetry here is how we notice the line going missing systemically.
// Banner indices: 0=NATIVE, 1=ALGORITHM-entry, 2=ALGORITHM-SUMMARY, 3=MINIMAL.
const HEARTBEAT_REGEX = /^[🧠🚨][^\n]{0,3}MEMORY:/m;
const HEARTBEAT_ENFORCEMENT: "log" | "block" = "log";
const HEARTBEAT_SCOPED_BANNERS = new Set([0, 1, 2]); // NATIVE + both ALGORITHM banners

// F3: clear-language gate — block responses that drift back into AI register.
// Operationalizes DA_IDENTITY § Hard Bans. scanAiSpeak strips code/quotes first so
// discussing the ban list never trips it. Scoring: each banned word = 1, each
// contrastive construction = 3 (the #1 tell, blocks on its own). Block at >= 3.
// The top-of-main stop_hook_active guard already prevents a rewrite loop.
// NON-BLOCKING as of 2026-06-20 ({{PRINCIPAL_NAME}} directive): see banner-miss block below.
// A blocking Stop hook re-emits the whole response = duplicate output. Log only.
const AISPEAK_ENFORCEMENT: "log" | "block" = "log";
const AISPEAK_BLOCK_THRESHOLD = 3;

interface FormatGateRecord {
  ts: string;
  session_id: string;
  decision: "pass" | "block" | "skip-recovery" | "heartbeat-missing" | "aispeak-block" | "aispeak-flag";
  matched_banner_index: number | null;
  message_length: number;
  stop_hook_active: boolean;
  heartbeat_present?: boolean;
  heartbeat_enforcement?: "log" | "block" | "skip";
  aispeak_score?: number;
  aispeak_word_hits?: string[];
  aispeak_contrastive_hits?: number;
}

function appendObs(record: FormatGateRecord): void {
  try {
    mkdirSync(dirname(OBS_PATH), { recursive: true });
    appendFileSync(OBS_PATH, JSON.stringify(record) + "\n", "utf-8");
  } catch (err) {
    console.error("[OutputFormatGate] obs write failed:", err);
  }
}

async function main(): Promise<void> {
  const input = await readHookInput();
  if (!input) {
    process.exit(0);
  }

  // Honor stop_hook_active — if this hook already blocked once, the recovery turn
  // is in flight. Blocking again would deadlock the session.
  if (input.stop_hook_active === true) {
    appendObs({
      ts: new Date().toISOString(),
      session_id: input.session_id ?? "unknown",
      decision: "skip-recovery",
      matched_banner_index: null,
      message_length: (input.last_assistant_message ?? "").length,
      stop_hook_active: true,
    });
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  // Banner enforcement must inspect the FULL current turn, not just the last
  // text block. When a turn ends with text after tool_use → tool_result loops,
  // `input.last_assistant_message` (and `parseLastAssistantMessage`) yield only
  // the trailing block — missing the opening banner. `collectCurrentResponseText`
  // joins every assistant text block since the last human prompt, so the regex
  // matches the banner regardless of where in the turn it appears.
  let message: string | undefined;
  if (input.transcript_path) {
    try {
      // Match parseTranscriptFromInput's settle delay so the final text block
      // has flushed before we read.
      await new Promise((resolve) => setTimeout(resolve, 150));
      const raw = readFileSync(input.transcript_path, "utf-8");
      message = collectCurrentResponseText(raw);
    } catch {
      // transcript unreadable — fall back to native field, then no-op
    }
  }
  if (!message) message = input.last_assistant_message;

  if (!message || message.trim().length === 0) {
    process.exit(0);
  }

  const matchedIndex = BANNER_PATTERNS.findIndex((re) => re.test(message!));
  const sessionId = input.session_id ?? "unknown";

  if (matchedIndex === -1) {
    // NON-BLOCKING (2026-06-20, {{PRINCIPAL_NAME}} directive). A Stop hook that returns
    // decision:block CANNOT replace the already-emitted response — the Claude Code
    // hook API has no "replace", so the harness keeps the rejected text on screen
    // AND appends a corrected turn. The user sees the SAME output twice. That
    // duplicate-output spam is far worse than a missing cosmetic banner. So we log
    // the miss for telemetry and let the turn end. Banner compliance is carried by
    // LIFEOS_SYSTEM_PROMPT.md § Output Format + the non-blocking DriftReminder nudge.
    appendObs({
      ts: new Date().toISOString(),
      session_id: sessionId,
      decision: "block",
      matched_banner_index: null,
      message_length: message.length,
      stop_hook_active: false,
    });
    process.exit(0);
  }

  // F3 — clear-language gate. Banner is present; now check the prose didn't drift
  // back into AI register. Block on a real cluster (score >= threshold), flag-log
  // a single stray hit so we can tune from real data.
  const aispeak = scanAiSpeak(message);
  if (AISPEAK_ENFORCEMENT === "block" && aispeak.score >= AISPEAK_BLOCK_THRESHOLD) {
    const detail = [
      aispeak.contrastiveHits > 0
        ? `${aispeak.contrastiveHits} contrastive "Not X, it's Y" construction(s)`
        : null,
      aispeak.wordHits.length > 0 ? `banned words: ${aispeak.wordHits.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    appendObs({
      ts: new Date().toISOString(),
      session_id: sessionId,
      decision: "aispeak-block",
      matched_banner_index: matchedIndex,
      message_length: message.length,
      stop_hook_active: false,
      aispeak_score: aispeak.score,
      aispeak_word_hits: aispeak.wordHits,
      aispeak_contrastive_hits: aispeak.contrastiveHits,
    });
    console.log(
      JSON.stringify({
        decision: "block",
        reason:
          "Clear-language violation: response drifted into AI register (" +
          detail +
          "). Rewrite in plain Paul Graham language per DA_IDENTITY § Hard Bans — short Anglo-Saxon words, " +
          "lead with the point, no banned vocabulary, no contrastive 'Not X, it's Y' tic.",
      }),
    );
    process.exit(0);
  }
  if (aispeak.score > 0) {
    // Sub-threshold drift — record for tuning, do not block.
    appendObs({
      ts: new Date().toISOString(),
      session_id: sessionId,
      decision: "aispeak-flag",
      matched_banner_index: matchedIndex,
      message_length: message.length,
      stop_hook_active: false,
      aispeak_score: aispeak.score,
      aispeak_word_hits: aispeak.wordHits,
      aispeak_contrastive_hits: aispeak.contrastiveHits,
    });
  }

  // F2 — heartbeat presence check (visual-freshness ISA, ISC-11–21)
  const heartbeatScoped = HEARTBEAT_SCOPED_BANNERS.has(matchedIndex);
  const heartbeatPresent = heartbeatScoped ? HEARTBEAT_REGEX.test(message) : true;
  const heartbeatEnforcement: "log" | "block" | "skip" =
    !heartbeatScoped ? "skip" : heartbeatPresent ? "skip" : HEARTBEAT_ENFORCEMENT;

  if (heartbeatEnforcement === "block") {
    appendObs({
      ts: new Date().toISOString(),
      session_id: sessionId,
      decision: "block",
      matched_banner_index: matchedIndex,
      message_length: message.length,
      stop_hook_active: false,
      heartbeat_present: false,
      heartbeat_enforcement: "block",
    });
    console.log(
      JSON.stringify({
        decision: "block",
        reason:
          "Format violation: response missing 🧠 MEMORY heartbeat line. " +
          "Every NATIVE/ALGORITHM turn MUST surface a `🧠 MEMORY:` line as the FIRST item inside 📃 CONTENT (NATIVE) or SUMMARY CONTENT (ALGORITHM). " +
          "See LIFEOS_SYSTEM_PROMPT.md § 🧠 MEMORY indicator. Rewrite this turn with the heartbeat line.",
      }),
    );
    process.exit(0);
  }

  appendObs({
    ts: new Date().toISOString(),
    session_id: sessionId,
    decision: heartbeatEnforcement === "log" ? "heartbeat-missing" : "pass",
    matched_banner_index: matchedIndex,
    message_length: message.length,
    stop_hook_active: false,
    heartbeat_present: heartbeatPresent,
    heartbeat_enforcement: heartbeatEnforcement,
  });
  process.exit(0);
}

main().catch((err) => {
  console.error("[OutputFormatGate] fatal:", err);
  process.exit(0);
});
