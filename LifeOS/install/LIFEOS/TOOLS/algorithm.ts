#!/usr/bin/env bun
/**
 * ============================================================================
 * THE ALGORITHM CLI — Run the LifeOS Algorithm in Loop or Interactive mode
 * ============================================================================
 *
 * A unified CLI for executing Algorithm sessions against ISAs.
 *
 * MODES:
 *   loop        — Autonomous iteration via `claude -p` (SDK). Runs until all
 *                 ISC criteria pass or maxIterations reached. No human needed.
 *   interactive — Launches a full interactive `claude` session with ISA context
 *                 loaded as the initial prompt. Human-in-the-loop.
 *   ideate      — Evolutionary ideation with tunable parameters. Launches an
 *                 interactive session with parameter configuration controlling
 *                 creativity vs. focus. Supports --preset, --focus, --param flags.
 *                 See ~/.claude/LIFEOS/ALGORITHM/ideate-loop.md for the protocol.
 *   optimize    — Autonomous hill-climbing against a measurable metric. Launches
 *                 an interactive session with /optimize context loaded. The agent
 *                 runs an autonomous experiment loop (modify → measure → keep/discard).
 *                 See ~/.claude/LIFEOS/ALGORITHM/optimize-loop.md for the protocol.
 *
 * DASHBOARD INTEGRATION (v0.5.9):
 *   - Creates a persistent algorithm state entry in MEMORY/STATE/algorithms/
 *   - Syncs criteria status from ISA checkboxes after each iteration (loop mode)
 *   - Registers in session-names.json for dashboard display
 *   - Sends voice notifications at key moments
 *   - Same state store a web interface would read — unified mechanism
 *
 * USAGE:
 *   algorithm -m loop -p <ISA> [-n 128]        Autonomous loop execution
 *   algorithm -m interactive -p <ISA>           Interactive claude session
 *   algorithm -m ideate -p <ISA> [--preset X]   Evolutionary ideation session
 *   algorithm new -t <title> [-e <effort>]      Create a new ISA
 *   algorithm status [-p <ISA>]                 Show ISA status
 *   algorithm pause -p <ISA>                    Pause a running loop
 *   algorithm resume -p <ISA>                   Resume a paused loop
 *   algorithm stop -p <ISA>                     Stop a loop
 *
 * EXAMPLES:
 *   algorithm -m loop -p ~/.claude/LIFEOS/MEMORY/WORK/auth/ISA-20260207-auth.md
 *   algorithm -m loop -p /path/to/project/.prd/ISA-20260213-feature.md -n 20
 *   algorithm -m interactive -p ISA-20260213-surface
 *   algorithm new -t "Build auth system" -e Extended
 *   algorithm status
 *   algorithm pause -p ISA-20260207-auth
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, appendFileSync, renameSync } from "fs";
import { resolve, basename, join, dirname } from "path";
import { spawnSync, spawn } from "child_process";
import { randomUUID } from "crypto";
import { generateISATemplate } from "../../../.claude/hooks/lib/isa-template";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


// ─── Paths ───────────────────────────────────────────────────────────────────

const HOME = process.env.HOME || "~";
const BASE_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude");
const ALGORITHMS_DIR = join(BASE_DIR, "MEMORY", "STATE", "algorithms");
const SESSION_NAMES_PATH = join(BASE_DIR, "MEMORY", "STATE", "session-names.json");
const PROJECTS_DIR = process.env.PROJECTS_DIR || join(HOME, "Projects");
const VOICE_URL = "http://localhost:31337/notify";
const VOICE_ID = "fTtv3eikoepIosk8dTZ5";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ISAFrontmatter {
  isa: boolean;
  id: string;
  status: string;
  mode: string;
  effort_level: string;
  iteration: number;
  maxIterations: number;
  loopStatus: string | null;
  last_phase: string | null;
  failing_criteria: string[];
  verification_summary: string;
  [key: string]: unknown;
}

interface CriteriaInfo {
  total: number;
  passing: number;
  failing: number;
  failingIds: string[];
  criteria: Array<{ id: string; description: string; status: "passing" | "failing" }>;
}

// Minimal AlgorithmState shape — standalone type for loop mode
interface LoopAlgorithmState {
  active: boolean;
  sessionId: string;
  taskDescription: string;
  currentPhase: string;
  phaseStartedAt: number;
  algorithmStartedAt: number;
  sla: string;
  effortLevel?: string;
  criteria: Array<{
    id: string;
    description: string;
    type: "criterion" | "anti-criterion";
    status: "pending" | "in_progress" | "completed" | "failed";
    createdInPhase: string;
  }>;
  agents: Array<{
    name: string;
    agentType: string;
    status: string;
    task?: string;
    criteriaIds?: string[];
    phase?: string;
  }>;
  capabilities: string[];
  isaPath?: string;
  phaseHistory: Array<{
    phase: string;
    startedAt: number;
    completedAt?: number;
    criteriaCount: number;
    agentCount: number;
  }>;
  completedAt?: number;
  summary?: string;
  // Loop-specific fields
  loopMode?: boolean;
  loopIteration?: number;
  loopMaxIterations?: number;
  loopIsaId?: string;
  loopIsaPath?: string;
  loopHistory?: Array<{
    iteration: number;
    startedAt: number;
    completedAt: number;
    criteriaPassing: number;
    criteriaTotal: number;
    sdkSessionId?: string;
  }>;
  // Parallel agent fields
  parallelAgents?: number;
  mode?: "loop" | "interactive" | "ideate" | "standard";
  // Algorithm parameter configuration
  algorithmConfig?: {
    preset: string | null;
    focus: number | null;
    params: Record<string, number | string>;
    mode: string;
  };
}

// ─── Parameter System ────────────────────────────────────────────────────────

const IDEATE_DEFAULTS: Record<string, number> = {
  problemConnection: 0.5,
  selectionPressure: 0.5,
  domainDiversity: 0.5,
  phaseBalance: 0.5,
  ideaVolume: 12,
  mutationRate: 0.4,
  generativeTemperature: 0.5,
  maxCycles: 3,
  contextCarryover: 0.6,
  parallelAgents: 1,
};

const OPTIMIZE_DEFAULTS: Record<string, number> = {
  stepSize: 0.3,
  regressionTolerance: 0.1,
  earlyStopPatience: 3,
  maxIterations: 10,
};

const FOCUS_MAPPING: Record<string, { at0: number; at1: number }> = {
  problemConnection:      { at0: 0.05, at1: 0.95 },
  selectionPressure:      { at0: 0.10, at1: 0.90 },
  domainDiversity:        { at0: 0.90, at1: 0.10 },
  phaseBalance:           { at0: 0.15, at1: 0.85 },
  ideaVolume:             { at0: 40,   at1: 5    },
  mutationRate:           { at0: 0.80, at1: 0.10 },
  generativeTemperature:  { at0: 0.90, at1: 0.10 },
  contextCarryover:       { at0: 0.30, at1: 0.80 },
};

interface PresetDef {
  focus?: number;
  overrides: Record<string, number>;
}

const PRESETS: Record<string, PresetDef> = {
  // Ideation presets
  dream:                { focus: 0.05, overrides: { maxCycles: 5, parallelAgents: 2 } },
  explore:              { focus: 0.25, overrides: { maxCycles: 4 } },
  balanced:             { focus: 0.50, overrides: {} },
  directed:             { focus: 0.75, overrides: { maxCycles: 3 } },
  surgical:             { focus: 0.95, overrides: { maxCycles: 2, ideaVolume: 4 } },
  "wild-but-picky":     { focus: 0.15, overrides: { selectionPressure: 0.85, maxCycles: 5 } },
  "focused-but-diverse": { focus: 0.70, overrides: { domainDiversity: 0.85 } },
  // Optimize presets
  cautious:             { overrides: { stepSize: 0.15, regressionTolerance: 0.0, earlyStopPatience: 5, maxIterations: 20 } },
  "standard-optimize":  { overrides: { stepSize: 0.3, regressionTolerance: 0.1, earlyStopPatience: 3, maxIterations: 10 } },
  aggressive:           { overrides: { stepSize: 0.7, regressionTolerance: 0.5, earlyStopPatience: 2, maxIterations: 15 } },
};

function resolveParameters(
  mode: string,
  preset: string | null,
  focus: number | null,
  paramOverrides: Record<string, string>,
): Record<string, number | string> {
  // Layer 0: Mode defaults
  const params: Record<string, number | string> = { ...(mode === "optimize" ? OPTIMIZE_DEFAULTS : IDEATE_DEFAULTS) };

  // Layer 1: Focus mapping (ideate only) — linear interpolation
  const effectiveFocus = preset && PRESETS[preset]?.focus != null ? PRESETS[preset].focus! : focus;
  if (effectiveFocus != null && mode !== "optimize") {
    for (const [key, mapping] of Object.entries(FOCUS_MAPPING)) {
      params[key] = mapping.at0 + (mapping.at1 - mapping.at0) * effectiveFocus;
    }
  }

  // Layer 2: Preset overrides
  if (preset) {
    const presetDef = PRESETS[preset];
    if (!presetDef) {
      console.error(`\x1b[31mError:\x1b[0m Unknown preset: ${preset}`);
      console.error(`Available presets: ${Object.keys(PRESETS).join(", ")}`);
      process.exit(1);
    }
    for (const [key, val] of Object.entries(presetDef.overrides)) {
      params[key] = val;
    }
  }

  // Layer 3: Individual --param overrides (highest precedence)
  for (const [key, val] of Object.entries(paramOverrides)) {
    const num = parseFloat(val);
    params[key] = isNaN(num) ? val : num;
  }

  return params;
}

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

interface ParsedArgs {
  subcommand: string | null;    // status, pause, resume, stop, new, or null (= run)
  mode: string | null;          // loop, interactive, ideate, optimize
  isaPath: string | null;       // -p value
  maxIterations: number | null; // -n value
  agentCount: number;           // -a value (default 1)
  title: string | null;         // -t value (for 'new' subcommand)
  effortLevel: string | null;   // -e value (for 'new' subcommand)
  preset: string | null;        // --preset value
  focus: number | null;         // --focus value (0.0-1.0)
  paramOverrides: Record<string, string>; // --param key=value (repeatable)
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = { subcommand: null, mode: null, isaPath: null, maxIterations: null, agentCount: 1, title: null, effortLevel: null, preset: null, focus: null, paramOverrides: {} };

  // Check for subcommand (first arg that isn't a flag)
  const subcommands = ["status", "pause", "resume", "stop", "new"];
  if (args.length > 0 && subcommands.includes(args[0])) {
    result.subcommand = args[0];
  }

  // Parse flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "-m" || arg === "--mode") && i + 1 < args.length) {
      result.mode = args[++i];
    } else if ((arg === "-p" || arg === "--isa" || arg === "--prd") && i + 1 < args.length) {
      result.isaPath = args[++i];
    } else if ((arg === "-n" || arg === "--max") && i + 1 < args.length) {
      result.maxIterations = parseInt(args[++i], 10);
    } else if ((arg === "-a" || arg === "--agents") && i + 1 < args.length) {
      result.agentCount = parseInt(args[++i], 10);
    } else if ((arg === "-t" || arg === "--title") && i + 1 < args.length) {
      result.title = args[++i];
    } else if ((arg === "-e" || arg === "--effort") && i + 1 < args.length) {
      result.effortLevel = args[++i];
    } else if (arg === "--preset" && i + 1 < args.length) {
      result.preset = args[++i];
    } else if (arg === "--focus" && i + 1 < args.length) {
      const val = parseFloat(args[++i]);
      if (isNaN(val) || val < 0.0 || val > 1.0) {
        console.error(`\x1b[31mError:\x1b[0m --focus must be a number between 0.0 and 1.0, got: ${args[i]}`);
        process.exit(1);
      }
      result.focus = val;
    } else if (arg === "--param" && i + 1 < args.length) {
      const kv = args[++i];
      const eqIdx = kv.indexOf("=");
      if (eqIdx === -1) {
        console.error(`\x1b[31mError:\x1b[0m --param requires key=value format, got: ${kv}`);
        process.exit(1);
      }
      result.paramOverrides[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
    } else if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  // Validate agent count
  if (result.agentCount < 1 || result.agentCount > 16 || isNaN(result.agentCount)) {
    console.error(`\x1b[31mError:\x1b[0m Invalid agent count: ${result.agentCount}. Must be between 1 and 16.`);
    process.exit(1);
  }

  return result;
}

function printHelp(): void {
  console.log(`
\x1b[36mTHE ALGORITHM\x1b[0m — LifeOS Algorithm Runner (v1.1.0)

Usage:
  algorithm -m <mode> -p <ISA> [-n N] [-a N]   Run the Algorithm against a ISA
  algorithm new -t <title> [-e <effort>] [-p <dir>]  Create a new ISA
  algorithm status [-p <ISA>]                   Show ISA status
  algorithm pause -p <ISA>                      Pause a running loop
  algorithm resume -p <ISA>                     Resume a paused loop
  algorithm stop -p <ISA>                       Stop a loop

Modes:
  loop          Autonomous iteration — no human interaction
  interactive   Full claude session with ISA context loaded
  ideate        Evolutionary ideation with tunable parameters
  optimize      Autonomous metric optimization (Karpathy autoresearch pattern)

Flags:
  -m, --mode <mode>     Execution mode: loop, interactive, ideate, or optimize
  -p, --prd <path>      ISA file path or ISA ID (or output dir for 'new')
  -n, --max <N>         Max iterations (loop mode only, default: 128)
  -a, --agents <N>      Parallel agents per iteration (1-16, default: 1)
  -t, --title <title>   ISA title (required for 'new')
  -e, --effort <level>  Effort level: Standard, Extended, etc. (default: Standard)
  -h, --help            Show this help

Parameter Flags (ideate/optimize modes):
  --preset <name>       Named parameter preset (see below)
  --focus <0.0-1.0>     Composite focus dial — 0.0=dream, 1.0=laser (ideate only)
  --param <key=value>   Individual parameter override (repeatable)

  Precedence: --param > --preset > --focus > mode defaults

Ideate Presets:
  dream                 Pure creative exploration, maximum wildness (focus=0.05)
  explore               Broad exploration with gentle guidance (focus=0.25)
  balanced              Equal generation and evaluation (focus=0.50)
  directed              Problem-focused, moderately strict (focus=0.75)
  surgical              Maximum analytical focus, direct solutions (focus=0.95)
  wild-but-picky        Dream wildly, select ruthlessly (focus=0.15)
  focused-but-diverse   Stay on-problem, diverse source domains (focus=0.70)

Optimize Presets:
  cautious              Small steps, no regression — for production
  standard-optimize     Default moderate optimization
  aggressive            Large steps, accepts regression — for prototypes

ISA Resolution:
  Full path     ~/.claude/LIFEOS/MEMORY/WORK/auth/ISA-20260207-auth.md
  ISA ID        ISA-20260207-auth (searches MEMORY/WORK/ and ~/Projects/*/.prd/)
  Project path  /path/to/project/.prd/ISA-20260213-feature.md

Examples:
  algorithm new -t "Build authentication system" -e Extended
  algorithm new -t "Fix login bug" -p ./project/.prd/
  algorithm -m loop -p ISA-20260213-surface -n 20
  algorithm -m loop -p ISA-20260213-surface -n 20 -a 4     # 4 parallel agents
  algorithm -m interactive -p ISA-20260213-surface
  algorithm -m ideate -p ISA-20260213-surface --preset dream
  algorithm -m ideate -p ISA-20260213-surface --focus 0.2
  algorithm -m ideate -p ISA-20260213-surface --focus 0.2 --param selectionPressure=0.9
  algorithm -m optimize -p ISA-20260213-surface --preset aggressive
  algorithm -m optimize -p ISA-20260213-surface --param stepSize=0.8 --param regressionTolerance=0.3
  algorithm status
  algorithm status -p ISA-20260213-surface
`);
}

// ─── Algorithm State Integration ─────────────────────────────────────────────

function ensureAlgorithmsDir(): void {
  if (!existsSync(ALGORITHMS_DIR)) mkdirSync(ALGORITHMS_DIR, { recursive: true });
}

function readAlgorithmState(sessionId: string): LoopAlgorithmState | null {
  try {
    const file = join(ALGORITHMS_DIR, `${sessionId}.json`);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function writeAlgorithmState(state: LoopAlgorithmState): void {
  ensureAlgorithmsDir();
  state.effortLevel = state.sla;
  writeFileSync(join(ALGORITHMS_DIR, `${state.sessionId}.json`), JSON.stringify(state, null, 2));
}

// ─── Session Names ───────────────────────────────────────────────────────────

function readSessionNames(): Record<string, string> {
  try {
    if (existsSync(SESSION_NAMES_PATH)) {
      return JSON.parse(readFileSync(SESSION_NAMES_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

function writeSessionName(sessionId: string, name: string): void {
  const names = readSessionNames();
  names[sessionId] = name;
  const tmp = `${SESSION_NAMES_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(names, null, 2), "utf8");
  renameSync(tmp, SESSION_NAMES_PATH);
}

function removeSessionName(sessionId: string): void {
  const names = readSessionNames();
  delete names[sessionId];
  const tmp = `${SESSION_NAMES_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(names, null, 2), "utf8");
  renameSync(tmp, SESSION_NAMES_PATH);
}

// ─── Voice Notifications ─────────────────────────────────────────────────────

function voiceNotify(message: string): void {
  try {
    fetch(VOICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, voice_id: VOICE_ID }),
    }).catch(() => {});
  } catch {}
}

// ─── ISA Title Extraction ────────────────────────────────────────────────────

function extractISATitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled ISA";
}

// ─── ISA Frontmatter Parsing ────────────────────────────────────────────────

function readISA(path: string): { frontmatter: ISAFrontmatter; content: string; raw: string } {
  const raw = readFileSync(path, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`Invalid ISA format: no frontmatter found in ${path}`);
  }

  const yamlBlock = match[1];
  const content = match[2];

  // Simple YAML parsing — no heavy dependencies
  const fm: Record<string, unknown> = {};
  for (const line of yamlBlock.split("\n")) {
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const [, key, val] = kvMatch;
      if (val === "null" || val === "") fm[key] = null;
      else if (val === "true") fm[key] = true;
      else if (val === "false") fm[key] = false;
      else if (val === "[]") fm[key] = [];
      else if (/^\[.*\]$/.test(val)) {
        fm[key] = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      }
      else if (/^\d+$/.test(val)) fm[key] = parseInt(val, 10);
      else fm[key] = val.replace(/^["']|["']$/g, "");
    }
  }

  return {
    frontmatter: {
      isa: fm.isa === true || fm.prd === true,
      id: (fm.id as string) || "unknown",
      status: (fm.status as string) || "DRAFT",
      mode: (fm.mode as string) || "interactive",
      effort_level: (fm.effort_level as string) || (fm.sla_tier as string) || "Standard",
      iteration: (fm.iteration as number) || 0,
      maxIterations: (fm.maxIterations as number) || 128,
      loopStatus: (fm.loopStatus as string) || null,
      last_phase: (fm.last_phase as string) || null,
      failing_criteria: Array.isArray(fm.failing_criteria) ? fm.failing_criteria as string[] : [],
      verification_summary: (fm.verification_summary as string) || "0/0",
      ...fm,
    },
    content,
    raw,
  };
}

function updateFrontmatter(path: string, updates: Record<string, unknown>): void {
  const raw = readFileSync(path, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`Invalid ISA format in ${path}`);

  let yamlBlock = match[1];
  const content = match[2];

  for (const [key, value] of Object.entries(updates)) {
    const strVal = value === null ? "null" : String(value);
    const regex = new RegExp(`^(${key}):.*$`, "m");
    if (regex.test(yamlBlock)) {
      yamlBlock = yamlBlock.replace(regex, `${key}: ${strVal}`);
    } else {
      yamlBlock += `\n${key}: ${strVal}`;
    }
  }

  writeFileSync(path, `---\n${yamlBlock}\n---\n${content}`);
}

// ─── Criteria Counting & Parsing ─────────────────────────────────────────────

function countCriteria(content: string): CriteriaInfo {
  const criteria: CriteriaInfo["criteria"] = [];

  // Parse all checked criteria
  const checkedMatches = content.matchAll(/- \[x\] (ISC-[A-Za-z0-9-]+):\s*(.+?)(?:\s*\|\s*Verify:.*)?$/gm);
  for (const m of checkedMatches) {
    criteria.push({ id: m[1], description: m[2].trim(), status: "passing" });
  }

  // Parse all unchecked criteria
  const uncheckedMatches = content.matchAll(/- \[ \] (ISC-[A-Za-z0-9-]+):\s*(.+?)(?:\s*\|\s*Verify:.*)?$/gm);
  for (const m of uncheckedMatches) {
    criteria.push({ id: m[1], description: m[2].trim(), status: "failing" });
  }

  // Fallback to legacy format
  if (criteria.length === 0) {
    const legacyChecked = content.matchAll(/- \[x\] ([CA]\d+):\s*(.+)$/gm);
    for (const m of legacyChecked) criteria.push({ id: m[1], description: m[2].trim(), status: "passing" });
    const legacyUnchecked = content.matchAll(/- \[ \] ([CA]\d+):\s*(.+)$/gm);
    for (const m of legacyUnchecked) criteria.push({ id: m[1], description: m[2].trim(), status: "failing" });
  }

  const passing = criteria.filter(c => c.status === "passing").length;
  const failing = criteria.filter(c => c.status === "failing").length;
  const failingIds = criteria.filter(c => c.status === "failing").map(c => c.id);

  return { total: criteria.length, passing, failing, failingIds, criteria };
}

// ─── Dashboard State Sync ────────────────────────────────────────────────────

function syncCriteriaToState(state: LoopAlgorithmState, criteriaInfo: CriteriaInfo): void {
  state.criteria = criteriaInfo.criteria.map(c => ({
    id: c.id,
    description: c.description,
    // Algorithm v5.5.0+: anti-criteria are detected by `Anti:` prose prefix on the description.
    // Backward-compat: legacy ISAs (v5.3.0–v5.4.0) used `ISC-A-N` numbering; the `id.includes('-A-')`
    // fallback keeps those classified correctly. Domain-prefixed IDs like `ISC-CLI-3` are unaffected.
    type: (/^Anti:\s/i.test(c.description) || c.id.includes("-A-"))
      ? "anti-criterion" as const
      : "criterion" as const,
    status: c.status === "passing" ? "completed" as const : "pending" as const,
    createdInPhase: "OBSERVE",
  }));
}

function createLoopState(
  sessionId: string,
  isaPath: string,
  isaId: string,
  title: string,
  max: number,
  criteriaInfo: CriteriaInfo,
  effortLevel: string = "Standard",
  agentCount: number = 1,
): LoopAlgorithmState {
  const now = Date.now();
  const state: LoopAlgorithmState = {
    active: true,
    sessionId,
    taskDescription: `Loop: ${title}`,
    currentPhase: "EXECUTE",
    phaseStartedAt: now,
    algorithmStartedAt: now,
    sla: effortLevel as any,
    criteria: [],
    agents: [],
    capabilities: ["Task Tool", "SDK", "Loop Runner"],
    isaPath,
    phaseHistory: [{ phase: "EXECUTE", startedAt: now, criteriaCount: criteriaInfo.total, agentCount: agentCount }],
    loopMode: true,
    loopIteration: 0,
    loopMaxIterations: max,
    loopIsaId: isaId,
    loopIsaPath: isaPath,
    loopHistory: [],
    parallelAgents: agentCount,
    mode: "loop",
  };
  syncCriteriaToState(state, criteriaInfo);
  return state;
}

function updateLoopStateForIteration(
  state: LoopAlgorithmState,
  iteration: number,
  criteriaInfo: CriteriaInfo,
): void {
  state.active = true;
  state.loopIteration = iteration;
  state.currentPhase = "EXECUTE";
  state.phaseStartedAt = Date.now();
  state.taskDescription = `Loop: ${state.loopIsaId} [${criteriaInfo.passing}/${criteriaInfo.total} iter ${iteration}]`;
  syncCriteriaToState(state, criteriaInfo);
}

function finalizeLoopState(
  state: LoopAlgorithmState,
  outcome: "completed" | "failed" | "blocked" | "paused" | "stopped",
  criteriaInfo: CriteriaInfo,
): void {
  state.active = false;
  state.completedAt = Date.now();
  state.currentPhase = outcome === "completed" ? "COMPLETE" : "VERIFY";
  state.summary = `${outcome}: ${criteriaInfo.passing}/${criteriaInfo.total} criteria in ${state.loopIteration} iterations`;
  syncCriteriaToState(state, criteriaInfo);

  // Close last phase history entry
  if (state.phaseHistory.length > 0) {
    const last = state.phaseHistory[state.phaseHistory.length - 1];
    if (!last.completedAt) last.completedAt = Date.now();
  }
}

// ─── Iteration Prompt (Loop Mode) ────────────────────────────────────────────

function buildIterationPrompt(isaPath: string, iteration: number, maxIterations: number): string {
  let mode = "loop";
  let effortLevel = "Standard";
  let lastPhase = "unknown";
  let failingList = "unknown — read the ISA to identify them";
  let verificationSummary = "unknown";

  try {
    const { frontmatter, content } = readISA(isaPath);
    mode = frontmatter.mode || "loop";
    effortLevel = frontmatter.effort_level || "Standard";
    lastPhase = frontmatter.last_phase || "unknown";
    verificationSummary = frontmatter.verification_summary || "0/0";

    const criteria = countCriteria(content);
    if (criteria.failingIds.length > 0) {
      const failingDetails: string[] = [];
      for (const id of criteria.failingIds) {
        const lineMatch = content.match(new RegExp(`- \\[ \\] ${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:.*`));
        if (lineMatch) {
          failingDetails.push(lineMatch[0].replace(/^- \[ \] /, ""));
        } else {
          failingDetails.push(id);
        }
      }
      failingList = failingDetails.join("\n  ");
    }
  } catch {
    // If ISA read fails, prompt still works with defaults
  }

  return `You are running inside The Algorithm — autonomous loop iteration.

ISA: ${isaPath}
Iteration: ${iteration} of ${maxIterations}
Mode: ${mode} (autonomous — no human interaction available)
Per-iteration effort level: ${effortLevel}
Last phase reached: ${lastPhase}
Current progress: ${verificationSummary}

Failing criteria:
  ${failingList}

Instructions:
1. Read the ISA. Focus on the IDEAL STATE CRITERIA section.
2. Read the CONTEXT section to understand the problem space and architecture.
3. Read the CHANGELOG section to understand what previous iterations accomplished.
4. Focus on 1-3 failing criteria with the highest priority (CRITICAL+AUTO first, then HIGH+AUTO, then GUIDED).
   Skip criteria marked MANUAL — they require interactive mode.
5. For each targeted criterion, read its Verify: method and execute it.
6. If a criterion has Verify: Custom — SKIP it (requires interactive mode).
7. After making changes, RE-VERIFY ALL criteria (not just the ones you worked on) to catch regressions.
8. Update the ISA:
   - Check off criteria that now pass: \`- [ ]\` → \`- [x]\`
   - Uncheck any criteria that regressed: \`- [x]\` → \`- [ ]\`
   - Update the STATUS table with current progress
   - Update frontmatter: verification_summary, failing_criteria, last_phase, updated
   - Append a CHANGELOG entry for this iteration:
     ### Iteration {N} — {date}
     - **Phase reached:** VERIFY
     - **Criteria delta:** +{added} / ~{modified} | {passing}/{total} passing
     - **Work done:** {1-3 bullet summary}
     - **Still failing:** [{ISC IDs}]
     - **Regression detected:** {Yes: which | No}
     - **Context for next iteration:** {what next agent needs}
   - If ALL non-Custom/non-MANUAL criteria pass, set frontmatter status to COMPLETE
   - If ONLY Custom/MANUAL criteria remain, set frontmatter status to BLOCKED
9. Be honest. If a criterion fails, leave it unchecked and explain why in the CHANGELOG.
10. Focus on SAFE INCREMENTS — make 1-3 criteria pass, verify everything, move on.`;
}

// ─── Domain-Aware Criteria Partitioning ──────────────────────────────────────

interface AgentAssignment {
  agentId: number;
  criteriaIds: string[];
  criteriaDetails: Array<{ id: string; description: string }>;
}

function partitionCriteria(criteriaInfo: CriteriaInfo, agentCount: number): AgentAssignment[] {
  const failing = criteriaInfo.criteria.filter(c => c.status === "failing");
  if (failing.length === 0) return [];

  // Extract domain prefix from ISC ID: ISC-TIER-1 → "TIER", ISC-CLI-3 → "CLI", ISC-7 → no domain
  function getDomain(id: string): string {
    // Match ISC-{DOMAIN}-{N} pattern — domain is everything between first ISC- and last -N
    const match = id.match(/^ISC-(.+)-\d+$/);
    return match ? match[1] : id;
  }

  // Group failing criteria by domain prefix
  const domainGroups = new Map<string, Array<{ id: string; description: string }>>();
  for (const c of failing) {
    const domain = getDomain(c.id);
    if (!domainGroups.has(domain)) domainGroups.set(domain, []);
    domainGroups.get(domain)!.push({ id: c.id, description: c.description });
  }

  // Sort domain groups by size (largest first) for greedy load-balancing
  const sortedDomains = [...domainGroups.entries()].sort((a, b) => b[1].length - a[1].length);

  // Cap agents at number of domain groups (each domain stays together)
  const effectiveAgentCount = Math.min(agentCount, sortedDomains.length);
  const agents: AgentAssignment[] = [];
  for (let i = 0; i < effectiveAgentCount; i++) {
    agents.push({ agentId: i + 1, criteriaIds: [], criteriaDetails: [] });
  }

  // Greedy load-balancing: assign each domain group to the agent with fewest criteria
  for (const [, groupCriteria] of sortedDomains) {
    // Find agent with the fewest criteria assigned
    let minAgent = agents[0];
    for (const agent of agents) {
      if (agent.criteriaIds.length < minAgent.criteriaIds.length) {
        minAgent = agent;
      }
    }
    for (const c of groupCriteria) {
      minAgent.criteriaIds.push(c.id);
      minAgent.criteriaDetails.push(c);
    }
  }

  // Filter out agents with no criteria assigned (shouldn't happen, but safety)
  return agents.filter(a => a.criteriaIds.length > 0);
}

// ─── Parallel Agent Prompt ──────────────────────────────────────────────────

function buildWorkerPrompt(
  isaPath: string,
  agentId: number,
  criterion: { id: string; description: string },
  iteration: number,
): string {
  let contextSection = "";
  let keyFiles = "";
  let verifyLine = "";

  try {
    const { content } = readISA(isaPath);
    // Extract CONTEXT section
    const ctxMatch = content.match(/## CONTEXT\n([\s\S]*?)(?=\n## (?!CONTEXT))/);
    if (ctxMatch) contextSection = ctxMatch[1].trim();
    // Extract the full criterion line with verification method
    const critLine = content.match(new RegExp(`- \\[ \\] ${criterion.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:.*`));
    if (critLine) verifyLine = critLine[0].replace(/^- \[ \] /, "");
  } catch {}

  return `You are a loop worker — a focused executor. Your ONLY job is to make ONE criterion pass.

YOUR CRITERION:
  ${verifyLine || `${criterion.id}: ${criterion.description}`}

ISA: ${isaPath}
Iteration: ${iteration} | Agent: ${agentId}

CONTEXT (from ISA):
${contextSection || "Read the ISA CONTEXT section for details."}

RULES — READ CAREFULLY:
- You are a WORKER, not the Algorithm. Do NOT run the Algorithm format.
- Do NOT create ISC criteria (TaskCreate). The criteria already exist.
- Do NOT execute voice curls (curl to localhost:31337).
- Do NOT write to the ISA file at all. No updateFrontmatter, no writeFileSync, no Edit/Write on the ISA path. The parent orchestrator handles ALL ISA updates (frontmatter AND checkboxes).
- Do NOT touch other criteria — ONLY yours.

YOUR WORKFLOW:
1. Read the ISA to understand the problem space and key files.
2. Read the specific files relevant to your criterion.
3. Make the MINIMUM changes needed to make your criterion pass.
4. Run the verification method (the Verify: part after the pipe).
5. After your fix, also verify ALL OTHER criteria in the ISA to catch regressions from your change.
   For each criterion, run its Verify: method and report the result.
6. Print your primary result: "RESULT: ${criterion.id} PASS" or "RESULT: ${criterion.id} FAIL: <reason>"
   Then print regression check results: "REGRESSION_CHECK: ISC-XX PASS" or "REGRESSION_CHECK: ISC-XX FAIL"
7. Do NOT edit the ISA file. The parent reads your stdout and updates the ISA.
8. That's it. Exit when done.`;
}

// ─── Parallel Iteration Runner ──────────────────────────────────────────────

async function runParallelIteration(
  isaPath: string,
  assignments: AgentAssignment[],
  iteration: number,
): Promise<void> {
  const startTime = Date.now();
  // BILLING: subscription, not API. Remove --bare (forces ANTHROPIC_API_KEY),
  // strip the key from inherited env (bun auto-loads .env).
  const workerEnv: Record<string, string> = { ...process.env } as Record<string, string>;
  delete workerEnv.ANTHROPIC_API_KEY;
  const processes = assignments.map(assignment => {
    const criterion = assignment.criteriaDetails[0]; // One criterion per agent
    const prompt = buildWorkerPrompt(isaPath, assignment.agentId, criterion, iteration);
    const proc = Bun.spawn(["claude", "-p", prompt,
      "--allowedTools", "Edit,Write,Bash,Read,Glob,Grep,WebFetch,WebSearch,NotebookEdit",
    ], {
      cwd: dirname(isaPath),
      env: workerEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    return { assignment, proc };
  });

  // Wait for all agents to complete
  const results = await Promise.all(
    processes.map(async ({ assignment, proc }) => {
      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      return { assignment, exitCode, stdout, stderr };
    })
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\x1b[90m  ⏱ Agents finished in ${elapsed}s\x1b[0m`);
  console.log("");

  // Parse agent stdout for RESULT lines — agents report pass/fail via stdout only
  const passedIds: string[] = [];
  for (const { assignment, stdout } of results) {
    const cId = assignment.criteriaIds[0];
    // Look for "RESULT: ISC-xxx PASS" in agent output
    if (stdout.includes(`RESULT: ${cId} PASS`) || stdout.includes(`${cId} PASS`)) {
      passedIds.push(cId);
    }
    // Also check if agent edited the ISA despite instructions (fallback detection)
  }

  // Parent updates ISA checkboxes sequentially — no concurrent writes
  if (passedIds.length > 0) {
    let isaContent = readFileSync(isaPath, "utf-8");
    for (const id of passedIds) {
      const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      isaContent = isaContent.replace(
        new RegExp(`- \\[ \\] ${escapedId}:`),
        `- [x] ${id}:`
      );
    }
    writeFileSync(isaPath, isaContent);
  }

  // Re-read ISA to get consolidated state after parent updates
  const postIsa = readISA(isaPath);
  const postCriteria = countCriteria(postIsa.content);

  // Update frontmatter with consolidated results
  updateFrontmatter(isaPath, {
    verification_summary: `"${postCriteria.passing}/${postCriteria.total}"`,
    failing_criteria: postCriteria.failingIds.length > 0
      ? `[${postCriteria.failingIds.join(", ")}]`
      : "[]",
    last_phase: "VERIFY",
    updated: new Date().toISOString().split("T")[0],
  });

  // ── Per-agent results ──
  console.log(`  \x1b[1mAgent Results:\x1b[0m`);
  for (const { assignment, exitCode } of results) {
    const cId = assignment.criteriaIds[0];
    const detail = assignment.criteriaDetails[0];
    const desc = detail.description.length > 40 ? detail.description.slice(0, 37) + "..." : detail.description;
    const criterion = postCriteria.criteria.find(c => c.id === cId);
    const passed = criterion?.status === "passing";
    if (exitCode !== 0) {
      console.log(`  \x1b[31m  Agent ${assignment.agentId} ✗ CRASHED\x1b[0m  ${cId}: ${desc}`);
    } else if (passed) {
      console.log(`  \x1b[32m  Agent ${assignment.agentId} ✓ PASS\x1b[0m    ${cId}: ${desc}`);
    } else {
      console.log(`  \x1b[33m  Agent ${assignment.agentId} ✗ FAIL\x1b[0m    ${cId}: ${desc}`);
    }
  }
  console.log("");

  // ── Full criteria scoreboard ──
  console.log(`  \x1b[90m── Criteria Scoreboard ──────────────────────────────────────\x1b[0m`);
  for (const c of postCriteria.criteria) {
    const icon = c.status === "passing" ? "\x1b[32m✓\x1b[0m" : "\x1b[90m·\x1b[0m";
    const idPad = c.id.padEnd(14);
    const desc = c.description.length > 50 ? c.description.slice(0, 47) + "..." : c.description;
    console.log(`  ${icon} ${idPad} ${desc}`);
  }
  const pct = postCriteria.total > 0 ? Math.round((postCriteria.passing / postCriteria.total) * 100) : 0;
  console.log(`  \x1b[90m── ${postCriteria.passing}/${postCriteria.total} passing (${pct}%) ────────────────────────────────────\x1b[0m`);
  console.log("");
}

// ─── Interactive Prompt ──────────────────────────────────────────────────────

function buildInteractivePrompt(isaPath: string): string {
  let title = "ISA";
  let verificationSummary = "unknown";
  let failingList = "Check the ISA for details";

  try {
    const { frontmatter, content } = readISA(isaPath);
    title = extractISATitle(content);
    verificationSummary = frontmatter.verification_summary || "0/0";

    const criteria = countCriteria(content);
    if (criteria.failingIds.length > 0) {
      failingList = criteria.failingIds.join(", ");
    } else {
      failingList = "None — all passing";
    }
  } catch {}

  return `Work on this ISA: ${isaPath}

Title: ${title}
Progress: ${verificationSummary}
Failing: ${failingList}

Read the ISA, understand the IDEAL STATE CRITERIA, and make progress on the failing criteria. Update the ISA as you complete work.`;
}

// ─── Ideate Prompt ───────────────────────────────────────────────────────────

function buildIdeatePrompt(
  isaPath: string,
  resolvedParams: Record<string, number | string>,
  preset: string | null,
  focus: number | null,
): string {
  let title = "ISA";
  try {
    const { content } = readISA(isaPath);
    title = extractISATitle(content);
  } catch {}

  const paramLines = Object.entries(resolvedParams)
    .map(([k, v]) => `  ${k}: ${typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(2)) : v}`)
    .join("\n");

  const configSummary = [
    preset ? `Preset: ${preset}` : null,
    focus != null ? `Focus: ${focus}` : null,
  ].filter(Boolean).join(" | ");

  return `Work on this ISA using the Ideate mode: ${isaPath}

Title: ${title}
Mode: ideate
${configSummary ? configSummary + "\n" : ""}
Algorithm Parameters (resolved):
${paramLines}

Read the ISA, then run the ideation algorithm with these parameters controlling your behavior.
The parameters above define how creative vs. focused your ideation should be, how aggressively to
select, and how much to mutate between cycles. Follow the ideate-loop protocol.`;
}

// ─── CHANGELOG Append ────────────────────────────────────────────────────────

function appendISAChangelog(
  isaPath: string,
  iteration: number,
  preCriteria: CriteriaInfo,
  postCriteria: CriteriaInfo,
  elapsedMs: number,
): void {
  try {
    let content = readFileSync(isaPath, "utf-8");
    const changelogMarker = "## CHANGELOG";
    const changelogIdx = content.indexOf(changelogMarker);
    if (changelogIdx === -1) return; // No CHANGELOG section

    const gained = postCriteria.passing - preCriteria.passing;
    const lost = Math.max(0, preCriteria.passing - postCriteria.passing + gained); // regressions
    const regressions = preCriteria.criteria
      .filter(c => c.status === "passing")
      .filter(c => {
        const post = postCriteria.criteria.find(p => p.id === c.id);
        return post && post.status === "failing";
      })
      .map(c => c.id);

    const stillFailing = postCriteria.failingIds;
    const elapsedSec = Math.round(elapsedMs / 1000);
    const now = new Date().toISOString().split("T")[0];

    const entry = `
### Iteration ${iteration} — ${now}
- **Phase reached:** VERIFY
- **Criteria delta:** ${preCriteria.passing}/${preCriteria.total} → ${postCriteria.passing}/${postCriteria.total} (${gained >= 0 ? "+" : ""}${gained})
- **Duration:** ${elapsedSec}s
- **Still failing:** ${stillFailing.length > 0 ? stillFailing.join(", ") : "None"}
- **Regressions:** ${regressions.length > 0 ? regressions.join(", ") : "None"}
`;

    // Insert after the CHANGELOG header line (and its description line if present)
    const afterHeader = content.indexOf("\n", changelogIdx + changelogMarker.length);
    if (afterHeader === -1) return;

    // Skip the description line if it starts with underscore (template placeholder)
    let insertPoint = afterHeader + 1;
    const nextLine = content.substring(insertPoint, content.indexOf("\n", insertPoint));
    if (nextLine.trim().startsWith("_")) {
      // Replace placeholder with first entry
      const endOfPlaceholder = content.indexOf("\n", insertPoint);
      content = content.substring(0, insertPoint) + entry + content.substring(endOfPlaceholder + 1);
    } else {
      // Append after header
      content = content.substring(0, insertPoint) + entry + content.substring(insertPoint);
    }

    writeFileSync(isaPath, content, "utf-8");
  } catch {
    // Silent — CHANGELOG is best-effort
  }
}

/**
 * Plateau detection: checks if the last N iterations had zero progress.
 * Returns true if plateaued (should exit BLOCKED).
 */
function detectPlateau(loopHistory: Array<{ criteriaPassing: number }>, window: number = 3): boolean {
  if (loopHistory.length < window) return false;
  const recent = loopHistory.slice(-window);
  const baseline = recent[0].criteriaPassing;
  return recent.every(h => h.criteriaPassing === baseline);
}

// ─── Core Loop Mode ─────────────────────────────────────────────────────────

async function runLoop(isaPath: string, maxOverride?: number, agentCount: number = 1): Promise<void> {
  const absPath = resolve(isaPath);
  if (!existsSync(absPath)) {
    console.error(`\x1b[31mError:\x1b[0m ISA not found: ${absPath}`);
    process.exit(1);
  }

  let { frontmatter, content } = readISA(absPath);
  const max = maxOverride ?? frontmatter.maxIterations;
  const isaTitle = extractISATitle(content);
  const effortLevel = frontmatter.effort_level || "Standard";

  // Check preconditions
  if (frontmatter.status === "COMPLETE") {
    console.log(`\x1b[32m\u2713\x1b[0m ISA already COMPLETE: ${frontmatter.id}`);
    return;
  }

  if (frontmatter.loopStatus === "running") {
    console.error(`\x1b[31mError:\x1b[0m Loop already running on ${frontmatter.id}`);
    process.exit(1);
  }

  // ── Dashboard: Create loop session ──
  const loopSessionId = randomUUID();
  const initialCriteria = countCriteria(content);
  const state = createLoopState(loopSessionId, absPath, frontmatter.id, isaTitle, max, initialCriteria, effortLevel, agentCount);

  writeAlgorithmState(state);
  const sessionNameSuffix = agentCount > 1 ? ` (${agentCount} agents)` : "";
  writeSessionName(loopSessionId, `Loop: ${isaTitle}${sessionNameSuffix}`);

  // ── Voice: Loop starting ──
  const agentMsg = agentCount > 1 ? ` ${agentCount} parallel agents.` : "";
  voiceNotify(`Starting loop on ${isaTitle}. ${initialCriteria.total} criteria, ${initialCriteria.passing} already passing.${agentMsg}`);

  // Initialize Loop in ISA
  updateFrontmatter(absPath, {
    loopStatus: "running",
    maxIterations: max,
  });

  const bar = (p: number, t: number, w: number = 20) => {
    const pct = t > 0 ? p / t : 0;
    const filled = Math.round(pct * w);
    return `${"█".repeat(filled)}${"░".repeat(w - filled)} ${Math.round(pct * 100)}%`;
  };

  console.log("");
  console.log(`\x1b[36m╔${"═".repeat(66)}╗\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  \x1b[1mTHE ALGORITHM\x1b[0m — Loop Mode${" ".repeat(40)}\x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m╠${"═".repeat(66)}╣\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  ISA:       ${frontmatter.id.padEnd(53)}\x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  Title:     ${isaTitle.slice(0, 53).padEnd(53)}\x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  Session:   ${loopSessionId.slice(0, 8).padEnd(53)}\x1b[36m║\x1b[0m`);
  const configLine = `Max iterations: ${max}${agentCount > 1 ? ` | Agents: ${agentCount}` : ""}`;
  console.log(`\x1b[36m║\x1b[0m  ${configLine.padEnd(64)}\x1b[36m║\x1b[0m`);
  const progressLine = `Progress: ${initialCriteria.passing}/${initialCriteria.total} ${bar(initialCriteria.passing, initialCriteria.total)}`;
  console.log(`\x1b[36m║\x1b[0m  ${progressLine.padEnd(64)}\x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m╚${"═".repeat(66)}╝\x1b[0m`);
  console.log("");

  // Main loop
  while (true) {
    // Re-read ISA (may have been updated by SDK iteration)
    const isa = readISA(absPath);
    frontmatter = isa.frontmatter;
    const criteria = countCriteria(isa.content);

    // ── Exit: COMPLETE ──
    if (frontmatter.status === "COMPLETE") {
      updateFrontmatter(absPath, { loopStatus: "completed" });
      finalizeLoopState(state, "completed", criteria);
      writeAlgorithmState(state);
      writeSessionName(loopSessionId, `Loop: ${isaTitle} [COMPLETE]`);
      const totalTime = ((Date.now() - state.algorithmStartedAt) / 1000).toFixed(0);
      voiceNotify(`Loop complete! All ${criteria.total} criteria passing after ${frontmatter.iteration} iterations.`);

      console.log("");
      console.log(`\x1b[32m╔${"═".repeat(66)}╗\x1b[0m`);
      console.log(`\x1b[32m║\x1b[0m  \x1b[1m\x1b[32m✓ THE ALGORITHM — COMPLETE\x1b[0m${" ".repeat(40)}\x1b[32m║\x1b[0m`);
      console.log(`\x1b[32m╠${"═".repeat(66)}╣\x1b[0m`);
      console.log(`\x1b[32m║\x1b[0m  ISA:        ${(frontmatter.id || "").padEnd(52)}\x1b[32m║\x1b[0m`);
      console.log(`\x1b[32m║\x1b[0m  Iterations: ${String(frontmatter.iteration).padEnd(52)}\x1b[32m║\x1b[0m`);
      console.log(`\x1b[32m║\x1b[0m  Criteria:   ${`${criteria.passing}/${criteria.total} ${bar(criteria.passing, criteria.total)}`.padEnd(52)}\x1b[32m║\x1b[0m`);
      console.log(`\x1b[32m║\x1b[0m  Time:       ${`${totalTime}s`.padEnd(52)}\x1b[32m║\x1b[0m`);
      console.log(`\x1b[32m╚${"═".repeat(66)}╝\x1b[0m`);
      return;
    }

    // ── Exit: BLOCKED ──
    if (frontmatter.status === "BLOCKED") {
      updateFrontmatter(absPath, { loopStatus: "completed" });
      finalizeLoopState(state, "blocked", criteria);
      writeAlgorithmState(state);
      writeSessionName(loopSessionId, `Loop: ${isaTitle} [BLOCKED]`);
      voiceNotify(`Loop blocked. ${criteria.passing} of ${criteria.total} passing. Remaining criteria need human review.`);

      console.log("");
      console.log(`\x1b[33m\u26A0 THE ALGORITHM \u2014 BLOCKED\x1b[0m`);
      console.log(`  ISA: ${frontmatter.id}`);
      console.log(`  Criteria: ${criteria.passing}/${criteria.total} passing, ${criteria.failing} need interactive review`);
      return;
    }

    // ── Exit: Max iterations ──
    if (frontmatter.iteration >= max) {
      updateFrontmatter(absPath, { loopStatus: "failed" });
      finalizeLoopState(state, "failed", criteria);
      writeAlgorithmState(state);
      writeSessionName(loopSessionId, `Loop: ${isaTitle} [FAILED]`);
      voiceNotify(`Loop reached max iterations. ${criteria.passing} of ${criteria.total} passing after ${max} iterations.`);

      console.log("");
      console.log(`\x1b[33m\u26A0 THE ALGORITHM \u2014 Max iterations reached (${max})\x1b[0m`);
      console.log(`  ISA: ${frontmatter.id}`);
      console.log(`  Criteria: ${criteria.passing}/${criteria.total} passing`);
      return;
    }

    // ── Exit: Paused externally ──
    if (frontmatter.loopStatus === "paused") {
      finalizeLoopState(state, "paused", criteria);
      // Keep active=true for paused so dashboard shows it's resumable
      state.active = true;
      state.currentPhase = "PLAN";
      delete state.completedAt;
      writeAlgorithmState(state);
      writeSessionName(loopSessionId, `Loop: ${isaTitle} [PAUSED]`);
      voiceNotify(`Loop paused at ${criteria.passing} of ${criteria.total} criteria.`);

      console.log("");
      console.log(`\x1b[33m\u23F8 THE ALGORITHM \u2014 Paused\x1b[0m`);
      console.log(`  Resume with: algorithm resume -p ${absPath}`);
      return;
    }

    // ── Exit: Stopped externally ──
    if (frontmatter.loopStatus === "stopped") {
      finalizeLoopState(state, "stopped", criteria);
      writeAlgorithmState(state);
      writeSessionName(loopSessionId, `Loop: ${isaTitle} [STOPPED]`);
      voiceNotify(`Loop stopped.`);

      console.log("");
      console.log(`\x1b[31m\u25A0 THE ALGORITHM \u2014 Stopped\x1b[0m`);
      return;
    }

    // ── Run iteration ──
    const newIteration = frontmatter.iteration + 1;
    const iterStartTime = Date.now();

    updateFrontmatter(absPath, { iteration: newIteration, updated: new Date().toISOString().split("T")[0] });

    // Dashboard: Update state for this iteration
    updateLoopStateForIteration(state, newIteration, criteria);

    // Populate agents array in state when parallel
    if (agentCount > 1) {
      const assignments = partitionCriteria(criteria, agentCount);
      state.agents = assignments.map(a => ({
        name: `agent-${a.agentId}`,
        agentType: "loop-worker",
        status: "active",
        task: `Criteria: ${a.criteriaIds.join(", ")}`,
        criteriaIds: a.criteriaIds,
        phase: "EXECUTE",
      }));
    }

    writeAlgorithmState(state);
    const iterSessionSuffix = agentCount > 1 ? ` (${agentCount} agents)` : "";
    writeSessionName(loopSessionId, `Loop: ${isaTitle} [${criteria.passing}/${criteria.total} iter ${newIteration}]${iterSessionSuffix}`);

    console.log(`\x1b[36m━━━ Iteration ${newIteration}/${max} ${"━".repeat(Math.max(0, 50 - String(newIteration).length - String(max).length))}\x1b[0m`);
    console.log(`  Progress: ${criteria.passing}/${criteria.total} ${bar(criteria.passing, criteria.total)} | Failing: ${criteria.failing}`);
    if (agentCount > 1) {
      const effectiveAgents = Math.min(agentCount, criteria.failing);
      console.log(`  Agents this round: ${effectiveAgents}${effectiveAgents < agentCount ? ` (capped — only ${criteria.failing} failing)` : ""}`);
    }
    console.log("");

    // ── Parallel path: multiple agents ──
    if (agentCount > 1 && criteria.failing > 1) {
      const assignments = partitionCriteria(criteria, agentCount);

      // Show per-agent assignment with full criterion description
      for (const a of assignments) {
        const detail = a.criteriaDetails[0];
        const desc = detail.description.length > 50 ? detail.description.slice(0, 47) + "..." : detail.description;
        console.log(`  \x1b[33mAgent ${a.agentId}\x1b[0m → ${detail.id}: ${desc}`);
      }
      console.log("");
      console.log(`  \x1b[90m⏳ ${assignments.length} agents working...\x1b[0m`);

      // Run parallel iteration (async)
      await runParallelIteration(absPath, assignments, newIteration);

      const iterEndTime = Date.now();
      const postIsa = readISA(absPath);
      const postCriteria = countCriteria(postIsa.content);

      // Record iteration in loop history
      if (!state.loopHistory) state.loopHistory = [];
      state.loopHistory.push({
        iteration: newIteration,
        startedAt: iterStartTime,
        completedAt: iterEndTime,
        criteriaPassing: postCriteria.passing,
        criteriaTotal: postCriteria.total,
      });

      // Dashboard: Sync updated criteria
      syncCriteriaToState(state, postCriteria);
      state.loopIteration = newIteration;
      state.agents = []; // Clear agents after completion
      writeAlgorithmState(state);

      const gained = postCriteria.passing - criteria.passing;
      const iterElapsed = ((iterEndTime - iterStartTime) / 1000).toFixed(0);
      if (gained > 0) {
        voiceNotify(`Iteration ${newIteration} complete. ${postCriteria.passing} of ${postCriteria.total} passing. Gained ${gained}.`);
      } else {
        voiceNotify(`Iteration ${newIteration} complete. ${postCriteria.passing} of ${postCriteria.total}. No new criteria passed.`);
      }

      const pct = postCriteria.total > 0 ? Math.round((postCriteria.passing / postCriteria.total) * 100) : 0;
      console.log(`  \x1b[1mIteration ${newIteration} Summary:\x1b[0m \x1b[32m+${gained}\x1b[0m | ${postCriteria.passing}/${postCriteria.total} passing (${pct}%) | ${iterElapsed}s`);
      if (postCriteria.passing >= postCriteria.total) {
        updateFrontmatter(absPath, { status: "COMPLETE" });
      }

      // Append CHANGELOG entry to ISA
      appendISAChangelog(absPath, newIteration, criteria, postCriteria, iterEndTime - iterStartTime);

      // Plateau detection: if last 3 iterations had zero progress, exit BLOCKED
      if (state.loopHistory && detectPlateau(state.loopHistory, 3)) {
        console.log(`\x1b[33m  Plateau detected — no progress in last 3 iterations\x1b[0m`);
        updateFrontmatter(absPath, { status: "BLOCKED", loopStatus: "completed" });
      }

      console.log("");
      Bun.sleepSync(2000);
      continue;
    }

    // ── Sequential path: single agent (existing behavior) ──
    const prompt = buildIterationPrompt(absPath, newIteration, max);

    const result = spawnSync("claude", [
      "-p", "--bare", prompt,
      "--allowedTools", "Edit,Write,Bash,Read,Glob,Grep,WebFetch,WebSearch,Task,TaskCreate,TaskUpdate,TaskList,NotebookEdit",
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 600_000, // 10 minute timeout per iteration
      cwd: dirname(absPath), // Run from ISA's directory context
    });

    const iterEndTime = Date.now();

    if (result.error) {
      console.error(`\x1b[31m  Error in iteration ${newIteration}:\x1b[0m ${result.error.message}`);
      if (!state.loopHistory) state.loopHistory = [];
      state.loopHistory.push({
        iteration: newIteration,
        startedAt: iterStartTime,
        completedAt: iterEndTime,
        criteriaPassing: criteria.passing,
        criteriaTotal: criteria.total,
      });
      writeAlgorithmState(state);
      continue;
    }

    if (result.status !== 0) {
      const stderr = result.stderr?.toString().trim();
      console.error(`\x1b[31m  claude -p exited with status ${result.status}\x1b[0m`);
      if (stderr) console.error(`  ${stderr.slice(0, 200)}`);
      if (!state.loopHistory) state.loopHistory = [];
      state.loopHistory.push({
        iteration: newIteration,
        startedAt: iterStartTime,
        completedAt: iterEndTime,
        criteriaPassing: criteria.passing,
        criteriaTotal: criteria.total,
      });
      writeAlgorithmState(state);
      continue;
    }

    // Re-read ISA to get post-iteration criteria state
    const postIsa = readISA(absPath);
    const postCriteria = countCriteria(postIsa.content);

    // Record iteration in loop history
    if (!state.loopHistory) state.loopHistory = [];
    state.loopHistory.push({
      iteration: newIteration,
      startedAt: iterStartTime,
      completedAt: iterEndTime,
      criteriaPassing: postCriteria.passing,
      criteriaTotal: postCriteria.total,
    });

    // Dashboard: Sync updated criteria
    syncCriteriaToState(state, postCriteria);
    state.loopIteration = newIteration;
    writeAlgorithmState(state);

    // Voice: Progress update
    const gained = postCriteria.passing - criteria.passing;
    if (gained > 0) {
      voiceNotify(`Iteration ${newIteration} complete. ${postCriteria.passing} of ${postCriteria.total} passing. Gained ${gained}.`);
    } else {
      voiceNotify(`Iteration ${newIteration} complete. ${postCriteria.passing} of ${postCriteria.total}. No new criteria passed.`);
    }

    // Log output summary
    const stdout = result.stdout?.toString().trim() || "";
    if (stdout) {
      const summary = stdout.slice(0, 200).replace(/\n/g, " ");
      console.log(`\x1b[90m  Output: ${summary}${stdout.length > 200 ? "..." : ""}\x1b[0m`);
    }

    console.log(`  \x1b[32m+${gained}\x1b[0m criteria \u2014 now ${postCriteria.passing}/${postCriteria.total} passing`);

    // Append CHANGELOG entry to ISA
    appendISAChangelog(absPath, newIteration, criteria, postCriteria, iterEndTime - iterStartTime);

    // Plateau detection: if last 3 iterations had zero progress, exit BLOCKED
    if (state.loopHistory && detectPlateau(state.loopHistory, 3)) {
      console.log(`\x1b[33m  Plateau detected — no progress in last 3 iterations\x1b[0m`);
      updateFrontmatter(absPath, { status: "BLOCKED", loopStatus: "completed" });
    }

    // Brief pause between iterations
    Bun.sleepSync(2000);
  }
}

// ─── Interactive Mode ────────────────────────────────────────────────────────

function runInteractive(isaPath: string): void {
  const absPath = resolve(isaPath);
  if (!existsSync(absPath)) {
    console.error(`\x1b[31mError:\x1b[0m ISA not found: ${absPath}`);
    process.exit(1);
  }

  const { content } = readISA(absPath);
  const isaTitle = extractISATitle(content);
  const criteria = countCriteria(content);
  const prompt = buildInteractivePrompt(absPath);

  voiceNotify(`Starting interactive session on ${isaTitle}.`);

  console.log(`\x1b[36m\u25CB\x1b[0m THE ALGORITHM (interactive mode) \u2014 ${isaTitle}`);
  console.log(`  ISA: ${absPath}`);
  console.log(`  Progress: ${criteria.passing}/${criteria.total}`);
  console.log(`  Launching claude...\n`);

  // Launch interactive claude session with ISA context
  const child = spawn("claude", [
    prompt,
    "--allowedTools", "Edit,Write,Bash,Read,Glob,Grep,WebFetch,WebSearch,Task,TaskCreate,TaskUpdate,TaskList,NotebookEdit",
  ], {
    stdio: "inherit",
    cwd: dirname(absPath),
    env: { ...process.env, CLAUDECODE: undefined },
  });

  child.on("exit", (code) => {
    if (code === 0) {
      // Re-read ISA to show final state
      try {
        const post = readISA(absPath);
        const postCriteria = countCriteria(post.content);
        console.log(`\n\x1b[36m\u25CB\x1b[0m Session ended \u2014 ${postCriteria.passing}/${postCriteria.total} criteria passing`);
      } catch {}
    }
    process.exit(code ?? 0);
  });
}

// ─── Ideate Mode ─────────────────────────────────────────────────────────────

function runIdeate(
  isaPath: string,
  preset: string | null,
  focus: number | null,
  paramOverrides: Record<string, string>,
): void {
  const absPath = resolve(isaPath);
  if (!existsSync(absPath)) {
    console.error(`\x1b[31mError:\x1b[0m ISA not found: ${absPath}`);
    process.exit(1);
  }

  const resolvedParams = resolveParameters("ideate", preset, focus, paramOverrides);
  const { content } = readISA(absPath);
  const isaTitle = extractISATitle(content);
  const prompt = buildIdeatePrompt(absPath, resolvedParams, preset, focus);

  // Write algorithm_config to ISA frontmatter
  const userOverrides = Object.keys(paramOverrides);
  updateFrontmatter(absPath, {
    mode: "ideate",
  });

  const configSummary = [
    preset ? `preset=${preset}` : null,
    focus != null ? `focus=${focus}` : null,
    userOverrides.length > 0 ? `overrides=${userOverrides.join(",")}` : null,
  ].filter(Boolean).join(" ");

  voiceNotify(`Starting ideation on ${isaTitle}. ${configSummary || "Default parameters."}`);

  console.log(`\x1b[35m\u25CB\x1b[0m THE ALGORITHM (ideate mode) \u2014 ${isaTitle}`);
  console.log(`  ISA: ${absPath}`);
  if (preset) console.log(`  Preset: ${preset}`);
  if (focus != null) console.log(`  Focus: ${focus}`);
  console.log(`  Parameters:`);
  for (const [k, v] of Object.entries(resolvedParams)) {
    console.log(`    ${k}: ${typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(2)) : v}`);
  }
  console.log(`  Launching claude...\n`);

  // Launch interactive claude session with ideate context
  const child = spawn("claude", [
    prompt,
    "--allowedTools", "Edit,Write,Bash,Read,Glob,Grep,WebFetch,WebSearch,Task,TaskCreate,TaskUpdate,TaskList,NotebookEdit",
  ], {
    stdio: "inherit",
    cwd: dirname(absPath),
    env: { ...process.env, CLAUDECODE: undefined },
  });

  child.on("exit", (code) => {
    if (code === 0) {
      try {
        const post = readISA(absPath);
        const postCriteria = countCriteria(post.content);
        console.log(`\n\x1b[35m\u25CB\x1b[0m Ideation ended \u2014 ${postCriteria.passing}/${postCriteria.total} criteria passing`);
      } catch {}
    }
    process.exit(code ?? 0);
  });
}

// ─── ISA Creation ───────────────────────────────────────────────────────────

function createNewISA(title: string, effortLevel: string = "Standard", outputDir?: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 40)
    .replace(/-$/, "") || "task";

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const filename = `ISA-${y}${m}${d}-${slug}.md`;

  // Determine output directory
  let targetDir: string;
  if (outputDir) {
    targetDir = resolve(outputDir);
  } else {
    // Default: create in MEMORY/WORK session directory
    const sessionSlug = `${y}${m}${d}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}_${slug}`;
    targetDir = join(BASE_DIR, "MEMORY", "WORK", sessionSlug);
  }
  mkdirSync(targetDir, { recursive: true });

  // Use shared ISA v2.0 template
  const isaContent = generateISATemplate({
    title,
    slug,
    effortLevel,
    mode: "interactive",
  });

  const fullPath = join(targetDir, filename);
  writeFileSync(fullPath, isaContent, "utf-8");
  return fullPath;
}

// ─── ISA Discovery ──────────────────────────────────────────────────────────

function findAllISAs(): string[] {
  const files: string[] = [];

  // 1. Scan MEMORY/WORK directory (flat ISA.md + legacy task-level ISAs)
  const workDir = join(BASE_DIR, "MEMORY", "WORK");
  if (existsSync(workDir)) {
    try {
      for (const session of readdirSync(workDir)) {
        const sessionPath = join(workDir, session);
        try {
          // Flat format: ISA.md at root (new)
          const flatIsa = join(sessionPath, "ISA.md");
          if (existsSync(flatIsa)) {
            files.push(flatIsa);
          }
          // Session-level ISA-*.md (transitional)
          for (const f of readdirSync(sessionPath)) {
            if (f.startsWith("ISA-") && f.endsWith(".md")) {
              files.push(join(sessionPath, f));
            }
          }
          // Legacy: Task-level ISAs (WORK/{session}/tasks/{task}/ISA-*.md)
          const tasksDir = join(sessionPath, "tasks");
          if (existsSync(tasksDir)) {
            for (const task of readdirSync(tasksDir)) {
              if (task === "current") continue; // skip symlink
              const taskPath = join(tasksDir, task);
              try {
                for (const f of readdirSync(taskPath)) {
                  if (f.startsWith("ISA-") && f.endsWith(".md")) {
                    files.push(join(taskPath, f));
                  }
                }
              } catch { /* not a directory */ }
            }
          }
        } catch { /* not a directory */ }
      }
    } catch {}
  }

  // 2. Scan project .prd/ directories
  if (existsSync(PROJECTS_DIR)) {
    try {
      for (const project of readdirSync(PROJECTS_DIR)) {
        const isaDir = join(PROJECTS_DIR, project, ".prd");
        if (existsSync(isaDir)) {
          try {
            for (const f of readdirSync(isaDir)) {
              if (f.startsWith("ISA-") && f.endsWith(".md")) {
                files.push(join(isaDir, f));
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  return files;
}

// ─── Status Command ─────────────────────────────────────────────────────────

function showStatus(specificPath?: string): void {
  if (specificPath) {
    const absPath = resolve(specificPath);
    const { frontmatter, content } = readISA(absPath);
    const criteria = countCriteria(content);
    printISAStatus(absPath, frontmatter, criteria);
    return;
  }

  const files = findAllISAs();
  if (files.length === 0) {
    console.log("No ISAs found in MEMORY/WORK/ or project .prd/ directories.");
    return;
  }

  console.log(`\x1b[36mTHE ALGORITHM \u2014 ISA Status\x1b[0m\n`);

  for (const file of files) {
    try {
      const { frontmatter, content } = readISA(file);
      const criteria = countCriteria(content);
      printISAStatus(file, frontmatter, criteria);
    } catch {
      // Skip invalid files
    }
  }
}

function printISAStatus(path: string, fm: ISAFrontmatter, criteria: CriteriaInfo): void {
  const statusIcon =
    fm.status === "COMPLETE" ? "\x1b[32m\u2713\x1b[0m" :
    fm.status === "BLOCKED" ? "\x1b[33m\u26A0\x1b[0m" :
    fm.loopStatus === "running" ? "\x1b[36m\u27F3\x1b[0m" :
    fm.loopStatus === "paused" ? "\x1b[33m\u23F8\x1b[0m" :
    fm.loopStatus === "failed" ? "\x1b[31m\u2717\x1b[0m" :
    "\x1b[90m\u25CB\x1b[0m";

  const progressBar = buildProgressBar(criteria.passing, criteria.total);

  console.log(`${statusIcon} ${fm.id}`);
  console.log(`  Status: ${fm.status} | Loop: ${fm.loopStatus || "idle"} | Iteration: ${fm.iteration}/${fm.maxIterations}`);
  console.log(`  Criteria: ${progressBar} ${criteria.passing}/${criteria.total}`);
  console.log(`  Path: ${path}`);
  console.log("");
}

function buildProgressBar(passing: number, total: number): string {
  if (total === 0) return "[\x1b[90m----------\x1b[0m]";
  const width = 10;
  const filled = Math.round((passing / total) * width);
  const empty = width - filled;
  return `[\x1b[32m${"█".repeat(filled)}\x1b[90m${"░".repeat(empty)}\x1b[0m]`;
}

// ─── Pause / Resume / Stop ──────────────────────────────────────────────────

function pauseLoop(isaPath: string): void {
  const absPath = resolve(isaPath);
  const { frontmatter } = readISA(absPath);
  if (frontmatter.loopStatus !== "running") {
    console.log(`Loop is not running on ${frontmatter.id} (status: ${frontmatter.loopStatus || "idle"})`);
    return;
  }
  updateFrontmatter(absPath, { loopStatus: "paused" });
  voiceNotify(`Loop paused on ${frontmatter.id}.`);
  console.log(`\x1b[33m\u23F8 Paused\x1b[0m Loop on ${frontmatter.id}`);
  console.log(`  Resume with: algorithm resume -p ${absPath}`);
}

async function resumeLoop(isaPath: string): Promise<void> {
  const absPath = resolve(isaPath);
  const { frontmatter } = readISA(absPath);
  if (frontmatter.loopStatus !== "paused") {
    console.log(`Loop is not paused on ${frontmatter.id} (status: ${frontmatter.loopStatus || "idle"})`);
    return;
  }
  updateFrontmatter(absPath, { loopStatus: "running" });
  voiceNotify(`Resuming loop on ${frontmatter.id}.`);
  console.log(`\x1b[36m\u25B6 Resuming\x1b[0m Loop on ${frontmatter.id}`);
  await runLoop(absPath);
}

function stopLoop(isaPath: string): void {
  const absPath = resolve(isaPath);
  const { frontmatter } = readISA(absPath);
  updateFrontmatter(absPath, { loopStatus: "stopped" });
  voiceNotify(`Loop stopped on ${frontmatter.id}.`);
  console.log(`\x1b[31m\u25A0 Stopped\x1b[0m Loop on ${frontmatter.id}`);
}

// ─── ISA Path Resolution ────────────────────────────────────────────────────

function resolveISAPath(input: string): string {
  // If it's already a path, use it
  if (input.includes("/") || input.endsWith(".md")) {
    return resolve(input);
  }

  // Search all known ISA locations
  const allISAs = findAllISAs();
  const matches = allISAs.filter(p => basename(p).includes(input) || p.includes(input));

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    console.error(`Ambiguous ISA reference "${input}". Matches:`);
    for (const m of matches) console.error(`  ${m}`);
    process.exit(1);
  }
  console.error(`ISA not found: ${input}`);
  process.exit(1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const parsed = parseArgs(process.argv);

if (parsed.subcommand) {
  // Subcommand mode: status, pause, resume, stop
  const isaRef = parsed.isaPath;

  switch (parsed.subcommand) {
    case "status":
      showStatus(isaRef ? resolveISAPath(isaRef) : undefined);
      break;
    case "new": {
      if (!parsed.title) {
        console.error("Usage: algorithm new -t <title> [-e <effort>] [-p <output-dir>]");
        process.exit(1);
      }
      const isaPath = createNewISA(parsed.title, parsed.effortLevel || "Standard", isaRef || undefined);
      console.log(`\x1b[32m✓\x1b[0m Created ISA: ${isaPath}`);
      console.log(`\n  Run with:  algorithm -m interactive -p ${isaPath}`);
      console.log(`  Or loop:   algorithm -m loop -p ${isaPath} -n 20`);
      break;
    }
    case "pause":
      if (!isaRef) { console.error("Usage: algorithm pause -p <ISA>"); process.exit(1); }
      pauseLoop(resolveISAPath(isaRef));
      break;
    case "resume":
      if (!isaRef) { console.error("Usage: algorithm resume -p <ISA>"); process.exit(1); }
      await resumeLoop(resolveISAPath(isaRef));
      break;
    case "stop":
      if (!isaRef) { console.error("Usage: algorithm stop -p <ISA>"); process.exit(1); }
      stopLoop(resolveISAPath(isaRef));
      break;
  }
} else if (parsed.mode) {
  // Run mode: -m loop or -m interactive
  if (!parsed.isaPath) {
    console.error("Error: -p <ISA> is required when using -m <mode>");
    console.error("Usage: algorithm -m <mode> -p <ISA> [-n N]");
    process.exit(1);
  }

  const resolvedPath = resolveISAPath(parsed.isaPath);

  switch (parsed.mode) {
    case "loop":
      await runLoop(resolvedPath, parsed.maxIterations ?? undefined, parsed.agentCount);
      break;
    case "interactive":
      runInteractive(resolvedPath);
      break;
    case "ideate":
      runIdeate(resolvedPath, parsed.preset, parsed.focus, parsed.paramOverrides);
      break;
    case "optimize":
      runInteractive(resolvedPath);  // optimize launches interactive with /optimize context
      break;
    default:
      console.error(`Unknown mode: ${parsed.mode}. Use 'loop', 'interactive', 'ideate', or 'optimize'.`);
      process.exit(1);
  }
} else {
  printHelp();
}
