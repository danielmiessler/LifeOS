#!/usr/bin/env bun
/**
 * CarrierProbe.ts — end-to-end probe of the Agent-dispatch carrier reality.
 *
 * THE FACT UNDER TEST (canonical home: models.ts § CARRIER REALITY +
 * DISPATCH_EXECUTES_FABLE): does an Agent dispatch with model "fable" execute
 * genuine Fable? The Fable-carrier safety rule, the statusline's dispatch-rung
 * mapping, and Algorithm §Spend all rest on this fact staying current. Harness
 * updates flip it silently (it flipped 2026-07-12, caught by this tool's first
 * run); this turns "re-probe periodically" into infrastructure.
 *
 * HOW: spawns a cheap haiku `claude --print` session instructed to dispatch
 * ONE subagent with model "fable", then reads the child session's subagent
 * transcripts (projects/<slug>/<session>/subagents/agent-*.jsonl) and extracts
 * the assistant messages' `message.model` — the same evidence class the manual
 * 2026-07-07/-11/-12 probes used. A subagent's self-report is NOT evidence;
 * the transcript is.
 *
 * VERDICTS (recorded to MEMORY/STATE/carrier-probe.json, appended to
 * MEMORY/OBSERVABILITY/model-verification.jsonl):
 *   HOLDS        observation matches DISPATCH_EXECUTES_FABLE           exit 0
 *   FLIPPED      observation CONTRADICTS it — update models.ts + consumers  exit 1
 *   INCONCLUSIVE no subagent transcript found (dispatch didn't happen) exit 2
 *
 * USAGE:
 *   bun LIFEOS/TOOLS/CarrierProbe.ts            # live probe (spends one tiny run)
 *   bun LIFEOS/TOOLS/CarrierProbe.ts --check    # freshness gate only, no spend:
 *                                               # exit 1 if stale (>30d), flipped,
 *                                               # or never run — /ic calls this
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { DISPATCH_EXECUTES_FABLE } from "./models";
import { claudeDir } from "./lifeos-root";

const CLAUDE_DIR = join(claudeDir());
const STATE_FILE = join(CLAUDE_DIR, "LIFEOS", "MEMORY", "STATE", "carrier-probe.json");
const OBS_FILE = join(CLAUDE_DIR, "LIFEOS", "MEMORY", "OBSERVABILITY", "model-verification.jsonl");
const MAX_AGE_DAYS = 30;
const TIMEOUT_MS = 240_000;

type Verdict = "HOLDS" | "FLIPPED" | "INCONCLUSIVE";

interface ProbeState {
  ts: string;
  verdict: Verdict;
  sidechainModels: string[];
  envelopeModels: string[];
  sessionId?: string;
  note: string;
}

function readState(): ProbeState | null {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as ProbeState;
  } catch {
    return null;
  }
}

/** --check: freshness gate, zero spend. Designed for /ic. */
function check(): number {
  const s = readState();
  if (!s) {
    console.error(`CarrierProbe: NEVER RUN — run \`bun LIFEOS/TOOLS/CarrierProbe.ts\` to establish the fact`);
    return 1;
  }
  const ageDays = (Date.now() - Date.parse(s.ts)) / 86_400_000;
  if (s.verdict === "FLIPPED") {
    console.error(`CarrierProbe: FLIPPED at ${s.ts} — observation contradicts models.ts DISPATCH_EXECUTES_FABLE; update the constant and its consumers, then re-probe`);
    return 1;
  }
  if (s.verdict === "INCONCLUSIVE") {
    console.error(`CarrierProbe: last run ${s.ts} was INCONCLUSIVE (${s.note}) — re-run the probe`);
    return 1;
  }
  if (ageDays > MAX_AGE_DAYS) {
    console.error(`CarrierProbe: STALE — last probe ${s.ts} (${Math.floor(ageDays)}d > ${MAX_AGE_DAYS}d); re-run \`bun LIFEOS/TOOLS/CarrierProbe.ts\``);
    return 1;
  }
  console.log(`CarrierProbe: HOLDS (probed ${s.ts}, ${Math.floor(ageDays)}d ago; sidechain ran ${s.sidechainModels.join(", ") || "?"})`);
  return 0;
}

function resolveClaudeBin(): string {
  const local = join(homedir(), ".local", "bin", "claude");
  return existsSync(local) ? local : "claude";
}

/** Run the child claude session; return its JSON envelope. Mirrors the
 * Inference.ts subprocess recipe exactly (billing + nested-session handling). */
function runChild(): Promise<{ envelope: Record<string, unknown> | null; raw: string }> {
  return new Promise((resolve) => {
    const env = { ...process.env } as Record<string, string | undefined>;
    // Nested-session guard: hooks run inside Claude Code's environment.
    delete env.CLAUDECODE;
    // BILLING: subscription via OAuth — both keys outrank the OAuth token in
    // Anthropic's precedence chain, and bun auto-loads ~/.claude/.env. Scrub.
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.ANTHROPIC_BASE_URL;

    const prompt =
      'Use your agent-dispatch tool (named Agent or Task) exactly once: ' +
      'subagent_type "general-purpose", model "fable", prompt "Reply with the single word OK." ' +
      "After it returns, reply with the single word DONE.";

    const args = [
      "--print",
      "--model", "haiku", // cheap driver; the DISPATCH is what's under test
      "--allowedTools", "Task,Agent",
      "--output-format", "json",
      "--setting-sources", "", // no hooks: keeps agent-starts.json/statusline clean of synthetic entries
      "--system-prompt", "You are a test driver. Follow the instruction literally.",
    ];

    let stdout = "";
    let stderr = "";
    const proc = spawn(resolveClaudeBin(), args, {
      env: env as NodeJS.ProcessEnv,
      cwd: CLAUDE_DIR, // pins the transcript to the -Users-…--claude project dir
      stdio: ["pipe", "pipe", "pipe"],
    });
    const timer = setTimeout(() => proc.kill("SIGKILL"), TIMEOUT_MS);
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", () => {
      clearTimeout(timer);
      try {
        resolve({ envelope: JSON.parse(stdout), raw: stdout });
      } catch {
        resolve({ envelope: null, raw: stdout || stderr });
      }
    });
    proc.stdin.end(prompt);
  });
}

/** Extract executing models from the child session's subagent transcripts
 * (projects/<slug>/<session>/subagents/agent-*.jsonl) — the evidence class the
 * manual probes established. Assistant-message `message.model` is what RAN. */
function sidechainModels(sessionId: string): string[] {
  const slug = CLAUDE_DIR.replace(/[/.]/g, "-");
  const dir = join(CLAUDE_DIR, "projects", slug, sessionId, "subagents");
  if (!existsSync(dir)) return [];
  const models = new Set<string>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
    for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (e.type === "assistant" && e.message?.model) models.add(e.message.model as string);
      } catch { /* skip malformed lines */ }
    }
  }
  return [...models];
}

function record(state: ProbeState): void {
  mkdirSync(join(STATE_FILE, ".."), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
  try {
    mkdirSync(join(OBS_FILE, ".."), { recursive: true });
    appendFileSync(OBS_FILE, JSON.stringify({ level: "carrier-probe", ...state }) + "\n");
  } catch { /* observability must never break the probe */ }
}

async function probe(): Promise<number> {
  console.error("CarrierProbe: spawning haiku driver session (dispatches one model:fable subagent)…");
  const { envelope, raw } = await runChild();
  const ts = new Date().toISOString();
  if (!envelope) {
    record({ ts, verdict: "INCONCLUSIVE", sidechainModels: [], envelopeModels: [], note: `no JSON envelope: ${raw.slice(0, 200)}` });
    console.error("CarrierProbe: INCONCLUSIVE — child produced no JSON envelope");
    return 2;
  }
  const sessionId = (envelope.session_id as string) ?? "";
  const envelopeModels = Object.keys((envelope.modelUsage as Record<string, unknown>) ?? {});
  const sidechain = sidechainModels(sessionId);
  let verdict: Verdict;
  let note: string;
  const ranFable = sidechain.some((m) => /fable/i.test(m));
  if (sidechain.length === 0) {
    verdict = "INCONCLUSIVE";
    note = `no subagent transcript in session dir (result: ${String(envelope.result).slice(0, 80)})`;
  } else if (ranFable === DISPATCH_EXECUTES_FABLE) {
    verdict = "HOLDS";
    note = `model:fable dispatch executed ${sidechain.join(", ")} — matches DISPATCH_EXECUTES_FABLE=${DISPATCH_EXECUTES_FABLE}`;
  } else {
    verdict = "FLIPPED";
    note = `model:fable dispatch executed ${sidechain.join(", ")} — CONTRADICTS DISPATCH_EXECUTES_FABLE=${DISPATCH_EXECUTES_FABLE}; update models.ts (constant + CARRIER REALITY), then statusline mapping + OPERATIONAL_RULES line + Algorithm §Spend`;
  }
  record({ ts, verdict, sidechainModels: sidechain, envelopeModels, sessionId, note });
  const out = verdict === "HOLDS" ? console.log : console.error;
  out(`CarrierProbe: ${verdict} — ${note}`);
  out(`  sidechain: [${sidechain.join(", ")}]  envelope: [${envelopeModels.join(", ")}]`);
  return verdict === "HOLDS" ? 0 : verdict === "FLIPPED" ? 1 : 2;
}

if (import.meta.main) {
  const exitCode = process.argv.includes("--check") ? check() : await probe();
  process.exit(exitCode);
}
