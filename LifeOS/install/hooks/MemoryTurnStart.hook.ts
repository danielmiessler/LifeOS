#!/usr/bin/env bun
/**
 * @version 1.0.0
 * MemoryTurnStart.hook.ts — the ONE UserPromptSubmit memory hook.
 *
 * Consolidation (2026-07-11, hooks BPE pass): merges the three per-prompt
 * memory spawns into one process. Each sub-hook file remains the owner of its
 * logic and stays runnable standalone; this hook imports their exported run()
 * and concatenates output. Order matches the old registration order:
 *
 *   1. MemoryReviewTrigger.run()  — cadence tick (state only, no output)
 *   2. LoadMemory.run()           — <pai-memory> hot-layer injection
 *   3. MemoryDeltaSurface.run()   — <pai-memory-health>? + <pai-memory-delta>
 *
 * Subagent skip: checked ONCE here (the sub-hooks' own shims keep their checks
 * for standalone runs). Failure mode: any sub-hook error is caught inside its
 * run() (stderr + null); this wrapper never blocks a prompt. Always exit 0.
 */

// tickCadence removed 2026-07-11: MemoryReviewFire (Stop) owns the whole
// cadence now — counting, decision, and firing in one place.
import { run as loadMemory } from "./LoadMemory.hook";
import { run as deltaSurface } from "./MemoryDeltaSurface.hook";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve as pathResolve } from "node:path";
import { homedir } from "node:os";
import { getClaudeDir } from "./lib/paths";

// ── Hot-layer injection gate (2026-07-11, context-window cleanup #1) ─────────
// The <pai-memory> block is ~1.5K tokens; injecting it EVERY prompt duplicated
// it dozens of times per session. Policy: inject on a session's FIRST prompt,
// whenever the memory files' content actually CHANGED, or after REFRESH_TURNS
// prompts without an injection (compaction backstop — a post-compact window
// must re-see memory within a bounded number of turns). The 🧠 delta line and
// the cadence tick remain every-turn: the visible contract is unchanged.
const CLAUDE_ROOT = pathResolve(getClaudeDir());
const STATE_DIR = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/STATE/memory-inject");
const PRINCIPAL_MEMORY = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
const DA_MEMORY = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md");
const REFRESH_TURNS = 20;

interface InjectState { lastHash: string; turnsSinceInject: number; }

function memoryHash(): string {
  const h = createHash("sha256");
  for (const p of [PRINCIPAL_MEMORY, DA_MEMORY]) {
    try { if (existsSync(p)) h.update(readFileSync(p, "utf8")); } catch {}
  }
  return h.digest("hex").slice(0, 16);
}

function shouldInject(sessionId: string): boolean {
  const statePath = pathResolve(STATE_DIR, `${sessionId.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);
  const hash = memoryHash();
  let state: InjectState | null = null;
  try { if (existsSync(statePath)) state = JSON.parse(readFileSync(statePath, "utf8")); } catch {}

  const inject = !state || state.lastHash !== hash || state.turnsSinceInject >= REFRESH_TURNS;
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(statePath, JSON.stringify({
      lastHash: hash,
      turnsSinceInject: inject ? 0 : (state!.turnsSinceInject + 1),
    }), "utf8");
  } catch { /* best-effort — on state failure we fall back to injecting */ }
  return inject;
}

function isSubagent(): boolean {
  return Boolean(
    process.env.CLAUDE_CODE_SUBAGENT_NAME ||
    process.env.CLAUDE_CODE_SUBAGENT_TYPE ||
    process.env.CLAUDE_AGENT_SDK === "1",
  );
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    const timer = setTimeout(() => resolve(data), 1500);
    process.stdin.on("data", (c) => { data += c.toString(); });
    process.stdin.on("end", () => { clearTimeout(timer); resolve(data); });
    process.stdin.on("error", () => { clearTimeout(timer); resolve(data); });
  });
}

if (isSubagent()) process.exit(0);

(async () => {
  let sessionId = "unknown";
  try { sessionId = JSON.parse(await readStdin()).session_id || "unknown"; } catch {}

  if (shouldInject(sessionId)) {
    const memory = loadMemory();
    if (memory) process.stdout.write(memory);
  }
  const delta = deltaSurface();
  if (delta) process.stdout.write(delta);
  process.exit(0);
})().catch(() => process.exit(0));
