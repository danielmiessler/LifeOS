#!/usr/bin/env bun
/**
 * ============================================================================
 * THE ALGORITHM CLI — Run the PAI Algorithm in Loop or Interactive mode
 * ============================================================================
 *
 * A unified CLI for executing Algorithm sessions against PRDs.
 *
 * MODES:
 *   loop        — Autonomous iteration via `claude -p` (SDK). Runs until all
 *                 ISC criteria pass or maxIterations reached. No human needed.
 *   interactive — Launches a full interactive `claude` session with PRD context
 *                 loaded as the initial prompt. Human-in-the-loop.
 *
 * DASHBOARD INTEGRATION (v0.5.9):
 *   - Creates a persistent algorithm state entry in MEMORY/STATE/algorithms/
 *   - Syncs criteria status from PRD checkboxes after each iteration (loop mode)
 *   - Registers in session-names.json for dashboard display
 *   - Sends voice notifications at key moments
 *   - Same state store a web interface would read — unified mechanism
 *
 * USAGE:
 *   algorithm -m loop -p <PRD> [-n 128]        Autonomous loop execution
 *   algorithm -m interactive -p <PRD>           Interactive claude session
 *   algorithm new -t <title> [-e <effort>]      Create a new PRD
 *   algorithm status [-p <PRD>]                 Show PRD status
 *   algorithm pause -p <PRD>                    Pause a running loop
 *   algorithm resume -p <PRD>                   Resume a paused loop
 *   algorithm stop -p <PRD>                     Stop a loop
 *
 * EXAMPLES:
 *   algorithm -m loop -p ~/.claude/MEMORY/WORK/auth/PRD-20260207-auth.md
 *   algorithm -m loop -p /path/to/project/.prd/PRD-20260213-feature.md -n 20
 *   algorithm -m interactive -p PRD-20260213-surface
 *   algorithm new -t "Build auth system" -e Extended
 *   algorithm status
 *   algorithm pause -p PRD-20260207-auth
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { resolve, basename, join, dirname } from "path";
import { spawnSync, spawn } from "child_process";
import { randomUUID } from "crypto";

// ─── Paths ───────────────────────────────────────────────────────────────────

const HOME = process.env.HOME || "~";
const BASE_DIR = process.env.PAI_DIR || join(HOME, ".claude");
const ALGORITHMS_DIR = join(BASE_DIR, "MEMORY", "STATE", "algorithms");
const SESSION_NAMES_PATH = join(BASE_DIR, "MEMORY", "STATE", "session-names.json");
const PROJECTS_DIR = process.env.PROJECTS_DIR || join(HOME, "Projects");
const VOICE_URL = "http://localhost:8888/notify";
const VOICE_ID = "fTtv3eikoepIosk8dTZ5";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PRDFrontmatter {
  prd: boolean;
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

// Minimal AlgorithmState shape — matches hooks/lib/algorithm-state.ts
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
  prdPath?: string;
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
  loopPrdId?: string;
  loopPrdPath?: string;
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
  mode?: "loop" | "interactive" | "standard";
}

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

interface ParsedArgs {
  subcommand: string | null;    // status, pause, resume, stop, new, or null (= run)
  mode: string | null;          // loop, interactive
  prdPath: string | null;       // -p value
  maxIterations: number | null; // -n value
  agentCount: number;           // -a value (default 1)
  title: string | null;         // -t value (for 'new' subcommand)
  effortLevel: string | null;   // -e value (for 'new' subcommand)
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = { subcommand: null, mode: null, prdPath: null, maxIterations: null, agentCount: 1, title: null, effortLevel: null };

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
    } else if ((arg === "-p" || arg === "--prd") && i + 1 < args.length) {
      result.prdPath = args[++i];
    } else if ((arg === "-n" || arg === "--max") && i + 1 < args.length) {
      result.maxIterations = parseInt(args[++i], 10);
    } else if ((arg === "-a" || arg === "--agents") && i + 1 < args.length) {
      result.agentCount = parseInt(args[++i], 10);
    } else if ((arg === "-t" || arg === "--title") && i + 1 < args.length) {
      result.title = args[++i];
    } else if ((arg === "-e" || arg === "--effort") && i + 1 < args.length) {
      result.effortLevel = args[++i];
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
\x1b[36mTHE ALGORITHM\x1b[0m — PAI Algorithm Runner (v1.0.0)

Usage:
  algorithm -m <mode> -p <PRD> [-n N] [-a N]   Run the Algorithm against a PRD
  algorithm new -t <title> [-e <effort>] [-p <dir>]  Create a new PRD
  algorithm status [-p <PRD>]                   Show PRD status
  algorithm pause -p <PRD>                      Pause a running loop
  algorithm resume -p <PRD>                     Resume a paused loop
  algorithm stop -p <PRD>                       Stop a loop

Modes:
  loop          Autonomous iteration — no human interaction
  interactive   Full claude session with PRD context loaded

Flags:
  -m, --mode <mode>     Execution mode: loop or interactive
  -p, --prd <path>      PRD file path or PRD ID (or output dir for 'new')
  -n, --max <N>         Max iterations (loop mode only, default: 128)
  -a, --agents <N>      Parallel agents per iteration (1-16, default: 1)
  -t, --title <title>   PRD title (required for 'new')
  -e, --effort <level>  Effort level: Standard, Extended, etc. (default: Standard)
  -h, --help            Show this help

PRD Resolution:
  Full path     ~/.claude/MEMORY/WORK/auth/PRD-20260207-auth.md
  PRD ID        PRD-20260207-auth (searches MEMORY/WORK/ and ~/Projects/*/.prd/)
  Project path  /path/to/project/.prd/PRD-20260213-feature.md

Examples:
  algorithm new -t "Build authentication system" -e Extended
  algorithm new -t "Fix login bug" -p ./project/.prd/
  algorithm -m loop -p PRD-20260213-surface -n 20
  algorithm -m loop -p PRD-20260213-surface -n 20 -a 4     # 4 parallel agents
  algorithm -m interactive -p PRD-20260213-surface
  algorithm status
  algorithm status -p PRD-20260213-surface
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
  writeFileSync(SESSION_NAMES_PATH, JSON.stringify(names, null, 2));
}

function removeSessionName(sessionId: string): void {
  const names = readSessionNames();
  delete names[sessionId];
  writeFileSync(SESSION_NAMES_PATH, JSON.stringify(names, null, 2));
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

// ─── PRD Title Extraction ────────────────────────────────────────────────────

function extractPRDTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled PRD";
}

// ─── PRD Frontmatter Parsing ────────────────────────────────────────────────

function readPRD(path: string): { frontmatter: PRDFrontmatter; content: string; raw: string } {
  const raw = readFileSync(path, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`Invalid PRD format: no frontmatter found in ${path}`);
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
      prd: fm.prd === true,
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
  if (!match) throw new Error(`Invalid PRD format in ${path}`);

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
    type: c.id.startsWith("ISC-A") ? "anti-criterion" as const : "criterion" as const,
    status: c.status === "passing" ? "completed" as const : "pending" as const,
    createdInPhase: "OBSERVE",
  }));
}

function createLoopState(
  sessionId: string,
  prdPath: string,
  prdId: string,
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
    prdPath,
    phaseHistory: [{ phase: "EXECUTE", startedAt: now, criteriaCount: criteriaInfo.total, agentCount: agentCount }],
    loopMode: true,
    loopIteration: 0,
    loopMaxIterations: max,
    loopPrdId: prdId,
    loopPrdPath: prdPath,
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
  state.taskDescription = `Loop: ${state.loopPrdId} [${criteriaInfo.passing}/${criteriaInfo.total} iter ${iteration}]`;
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

function buildIterationPrompt(prdPath: string, iteration: number, maxIterations: number): string {
  let mode = "loop";
  let effortLevel = "Standard";
  let lastPhase = "unknown";
  let failingList = "unknown — read the PRD to identify them";
  let verificationSummary = "unknown";

  try {
    const { frontmatter, content } = readPRD(prdPath);
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
    // If PRD read fails, prompt still works with defaults
  }

  return `You are running inside The Algorithm — autonomous loop iteration.

PRD: ${prdPath}
Iteration: ${iteration} of ${maxIterations}
Mode: ${mode} (autonomous — no human interaction available)
Per-iteration effort level: ${effortLevel}
Last phase reached: ${lastPhase}
Current progress: ${verificationSummary}

Failing criteria:
  ${failingList}

Instructions:
1. Read the PRD. Focus on the IDEAL STATE CRITERIA section.
2. Read the CONTEXT section to understand the problem space and architecture.
3. Read the LOG section to understand what previous iterations accomplished.
4. For each failing criterion, read its Verify: method and execute it.
5. If a criterion has Verify: Custom — SKIP it (requires interactive mode).
6. Update the PRD:
   - Check off criteria that now pass: \`- [ ]\` → \`- [x]\`
   - Update the STATUS table with current progress
   - Update frontmatter: verification_summary, failing_criteria, last_phase, updated
   - Append a LOG entry for this iteration with: phase reached, progress, work done, failing IDs, context for next iteration
   - If ALL non-Custom criteria pass, set frontmatter status to COMPLETE
   - If ONLY Custom criteria remain, set frontmatter status to BLOCKED
7. Be honest. If a criterion fails, leave it unchecked and explain why in the LOG.
8. Focus on making progress — you don't need to solve everything in one iteration.`;
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

  // Extract domain prefix from ISC ID: ISC-TIER-1 → "TIER", ISC-A-1 → "A", ISC-CLI-3 → "CLI"
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
  prdPath: string,
  agentId: number,
  criterion: { id: string; description: string },
  iteration: number,
): string {
  let contextSection = "";
  let keyFiles = "";
  let verifyLine = "";

  try {
    const { content } = readPRD(prdPath);
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

PRD: ${prdPath}
Iteration: ${iteration} | Agent: ${agentId}

CONTEXT (from PRD):
${contextSection || "Read the PRD CONTEXT section for details."}

RULES — READ CAREFULLY:
- You are a WORKER, not the Algorithm. Do NOT run the Algorithm format.
- Do NOT create ISC criteria (TaskCreate). The criteria already exist.
- Do NOT execute voice curls (curl to localhost:8888).
- Do NOT write to the PRD file at all. No updateFrontmatter, no writeFileSync, no Edit/Write on the PRD path. The parent orchestrator handles ALL PRD updates (frontmatter AND checkboxes).
- Do NOT touch other criteria — ONLY yours.

YOUR WORKFLOW:
1. Read the PRD to understand the problem space and key files.
2. Read the specific files relevant to your criterion.
3. Make the MINIMUM changes needed to make your criterion pass.
4. Run the verification method (the Verify: part after the pipe).
5. Print your result clearly: "RESULT: ${criterion.id} PASS" or "RESULT: ${criterion.id} FAIL: <reason>"
6. Do NOT edit the PRD file. The parent reads your stdout and updates the PRD.
7. That's it. Exit when done with your one criterion.`;
}

// ─── Parallel Iteration Runner ──────────────────────────────────────────────

async function runParallelIteration(
  prdPath: string,
  assignments: AgentAssignment[],
  iteration: number,
): Promise<void> {
  const startTime = Date.now();
  const processes = assignments.map(assignment => {
    const criterion = assignment.criteriaDetails[0]; // One criterion per agent
    const prompt = buildWorkerPrompt(prdPath, assignment.agentId, criterion, iteration);
    const proc = Bun.spawn(["claude", "-p", prompt,
      "--allowedTools", "Edit,Write,Bash,Read,Glob,Grep,WebFetch,WebSearch,NotebookEdit",
    ], {
      cwd: dirname(prdPath),
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
    // Also check if agent edited the PRD despite instructions (fallback detection)
  }

  // Parent updates PRD checkboxes sequentially — no concurrent writes
  if (passedIds.length > 0) {
    let prdContent = readFileSync(prdPath, "utf-8");
    for (const id of passedIds) {
      const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      prdContent = prdContent.replace(
        new RegExp(`- \\[ \\] ${escapedId}:`),
        `- [x] ${id}:`
      );
    }
    writeFileSync(prdPath, prdContent);
  }

  // Re-read PRD to get consolidated state after parent updates
  const postPrd = readPRD(prdPath);
  const postCriteria = countCriteria(postPrd.content);

  // Update frontmatter with consolidated results
  updateFrontmatter(prdPath, {
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

function buildInteractivePrompt(prdPath: string): string {
  let title = "PRD";
  let verificationSummary = "unknown";
  let failingList = "Check the PRD for details";

  try {
    const { frontmatter, content } = readPRD(prdPath);
    title = extractPRDTitle(content);
    verificationSummary = frontmatter.verification_summary || "0/0";

    const criteria = countCriteria(content);
    if (criteria.failingIds.length > 0) {
      failingList = criteria.failingIds.join(", ");
    } else {
      failingList = "None — all passing";
    }
  } catch {}

  return `Work on this PRD: ${prdPath}

Title: ${title}
Progress: ${verificationSummary}
Failing: ${failingList}

Read the PRD, understand the IDEAL STATE CRITERIA, and make progress on the failing criteria. Update the PRD as you complete work.`;
}

// ─── Core Loop Mode ─────────────────────────────────────────────────────────

async function runLoop(prdPath: string, maxOverride?: number, agentCount: number = 1): Promise<void> {
  const absPath = resolve(prdPath);
  if (!existsSync(absPath)) {
    console.error(`\x1b[31mError:\x1b[0m PRD not found: ${absPath}`);
    process.exit(1);
  }

  let { frontmatter, content } = readPRD(absPath);
  const max = maxOverride ?? frontmatter.maxIterations;
  const prdTitle = extractPRDTitle(content);
  const effortLevel = frontmatter.effort_level || "Standard";

  // Check preconditions
  if (frontmatter.status === "COMPLETE") {
    console.log(`\x1b[32m\u2713\x1b[0m PRD already COMPLETE: ${frontmatter.id}`);
    return;
  }

  if (frontmatter.loopStatus === "running") {
    console.error(`\x1b[31mError:\x1b[0m Loop already running on ${frontmatter.id}`);
    process.exit(1);
  }

  // ── Dashboard: Create loop session ──
  const loopSessionId = randomUUID();
  const initialCriteria = countCriteria(content);
  const state = createLoopState(loopSessionId, absPath, frontmatter.id, prdTitle, max, initialCriteria, effortLevel, agentCount);

  writeAlgorithmState(state);
  const sessionNameSuffix = agentCount > 1 ? ` (${agentCount} agents)` : "";
  writeSessionName(loopSessionId, `Loop: ${prdTitle}${sessionNameSuffix}`);

  // ── Voice: Loop starting ──
  const agentMsg = agentCount > 1 ? ` ${agentCount} parallel agents.` : "";
  voiceNotify(`Starting loop on ${prdTitle}. ${initialCriteria.total} criteria, ${initialCriteria.passing} already passing.${agentMsg}`);

  // Initialize Loop in PRD
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
  console.log(`\x1b[36m║\x1b[0m  PRD:       ${frontmatter.id.padEnd(53)}\x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  Title:     ${prdTitle.slice(0, 53).padEnd(53)}\x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  Session:   ${loopSessionId.slice(0, 8).padEnd(53)}\x1b[36m║\x1b[0m`);
  const configLine = `Max iterations: ${max}${agentCount > 1 ? ` | Agents: ${agentCount}` : ""}`;
  console.log(`\x1b[36m║\x1b[0m  ${configLine.padEnd(64)}\x1b[36m║\x1b[0m`);
  const progressLine = `Progress: ${initialCriteria.passing}/${initialCriteria.total} ${bar(initialCriteria.passing, initialCriteria.total)}`;
  console.log(`\x1b[36m║\x1b[0m  ${progressLine.padEnd(64)}\x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m╚${"═".repeat(66)}╝\x1b[0m`);
  console.log("");

  // Main loop
  while (true) {
    // Re-read PRD (may have been updated by SDK iteration)
    const prd = readPRD(absPath);
    frontmatter = prd.frontmatter;
    const criteria = countCriteria(prd.content);

    // ── Exit: COMPLETE ──
    if (frontmatter.status === "COMPLETE") {
      updateFrontmatter(absPath, { loopStatus: "completed" });
      finalizeLoopState(state, "completed", criteria);
      writeAlgorithmState(state);
      writeSessionName(loopSessionId, `Loop: ${prdTitle} [COMPLETE]`);
      const totalTime = ((Date.now() - state.algorithmStartedAt) / 1000).toFixed(0);
      voiceNotify(`Loop complete! All ${criteria.total} criteria passing after ${frontmatter.iteration} iterations.`);

      console.log("");
      console.log(`\x1b[32m╔${"═".repeat(66)}╗\x1b[0m`);
      console.log(`\x1b[32m║\x1b[0m  \x1b[1m\x1b[32m✓ THE ALGORITHM — COMPLETE\x1b[0m${" ".repeat(40)}\x1b[32m║\x1b[0m`);
      console.log(`\x1b[32m╠${"═".repeat(66)}╣\x1b[0m`);
      console.log(`\x1b[32m║\x1b[0m  PRD:        ${(frontmatter.id || "").padEnd(52)}\x1b[32m║\x1b[0m`);
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
      writeSessionName(loopSessionId, `Loop: ${prdTitle} [BLOCKED]`);
      voiceNotify(`Loop blocked. ${criteria.passing} of ${criteria.total} passing. Remaining criteria need human review.`);

      console.log("");
      console.log(`\x1b[33m\u26A0 THE ALGORITHM \u2014 BLOCKED\x1b[0m`);
      console.log(`  PRD: ${frontmatter.id}`);
      console.log(`  Criteria: ${criteria.passing}/${criteria.total} passing, ${criteria.failing} need interactive review`);
      return;
    }

    // ── Exit: Max iterations ──
    if (frontmatter.iteration >= max) {
      updateFrontmatter(absPath, { loopStatus: "failed" });
      finalizeLoopState(state, "failed", criteria);
      writeAlgorithmState(state);
      writeSessionName(loopSessionId, `Loop: ${prdTitle} [FAILED]`);
      voiceNotify(`Loop reached max iterations. ${criteria.passing} of ${criteria.total} passing after ${max} iterations.`);

      console.log("");
      console.log(`\x1b[33m\u26A0 THE ALGORITHM \u2014 Max iterations reached (${max})\x1b[0m`);
      console.log(`  PRD: ${frontmatter.id}`);
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
      writeSessionName(loopSessionId, `Loop: ${prdTitle} [PAUSED]`);
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
      writeSessionName(loopSessionId, `Loop: ${prdTitle} [STOPPED]`);
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
    writeSessionName(loopSessionId, `Loop: ${prdTitle} [${criteria.passing}/${criteria.total} iter ${newIteration}]${iterSessionSuffix}`);

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
      const postPrd = readPRD(absPath);
      const postCriteria = countCriteria(postPrd.content);

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
      console.log("");
      Bun.sleepSync(2000);
      continue;
    }

    // ── Sequential path: single agent (existing behavior) ──
    const prompt = buildIterationPrompt(absPath, newIteration, max);

    const result = spawnSync("claude", [
      "-p", prompt,
      "--allowedTools", "Edit,Write,Bash,Read,Glob,Grep,WebFetch,WebSearch,Task,TaskCreate,TaskUpdate,TaskList,NotebookEdit",
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 600_000, // 10 minute timeout per iteration
      cwd: dirname(absPath), // Run from PRD's directory context
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

    // Re-read PRD to get post-iteration criteria state
    const postPrd = readPRD(absPath);
    const postCriteria = countCriteria(postPrd.content);

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

    // Brief pause between iterations
    Bun.sleepSync(2000);
  }
}

// ─── Interactive Mode ────────────────────────────────────────────────────────

function runInteractive(prdPath: string): void {
  const absPath = resolve(prdPath);
  if (!existsSync(absPath)) {
    console.error(`\x1b[31mError:\x1b[0m PRD not found: ${absPath}`);
    process.exit(1);
  }

  const { content } = readPRD(absPath);
  const prdTitle = extractPRDTitle(content);
  const criteria = countCriteria(content);
  const prompt = buildInteractivePrompt(absPath);

  voiceNotify(`Starting interactive session on ${prdTitle}.`);

  console.log(`\x1b[36m\u25CB\x1b[0m THE ALGORITHM (interactive mode) \u2014 ${prdTitle}`);
  console.log(`  PRD: ${absPath}`);
  console.log(`  Progress: ${criteria.passing}/${criteria.total}`);
  console.log(`  Launching claude...\n`);

  // Launch interactive claude session with PRD context
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
      // Re-read PRD to show final state
      try {
        const post = readPRD(absPath);
        const postCriteria = countCriteria(post.content);
        console.log(`\n\x1b[36m\u25CB\x1b[0m Session ended \u2014 ${postCriteria.passing}/${postCriteria.total} criteria passing`);
      } catch {}
    }
    process.exit(code ?? 0);
  });
}

// ─── PRD Creation ───────────────────────────────────────────────────────────

function createNewPRD(title: string, effortLevel: string = "Standard", outputDir?: string): string {
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
  const today = `${y}-${m}-${d}`;
  const id = `PRD-${y}${m}${d}-${slug}`;
  const filename = `${id}.md`;

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

  const prdContent = `---
prd: true
id: ${id}
status: DRAFT
mode: interactive
effort_level: ${effortLevel}
created: ${today}
updated: ${today}
iteration: 0
maxIterations: 128
loopStatus: null
last_phase: null
failing_criteria: []
verification_summary: "0/0"
parent: null
children: []
---

# ${title}

> _To be populated: what this achieves and why it matters._

## STATUS

| What | State |
|------|-------|
| Progress | 0/0 criteria passing |
| Phase | DRAFT |
| Next action | OBSERVE phase — create ISC |
| Blocked by | nothing |

## CONTEXT

### Problem Space
_To be populated during OBSERVE phase._

### Key Files
_To be populated during exploration._

### Constraints
_To be populated during OBSERVE/PLAN._

### Decisions Made
_None yet._

## PLAN

_To be populated during PLAN phase._

## IDEAL STATE CRITERIA (Verification Criteria)

_Criteria will be added during OBSERVE phase via TaskCreate._
_Format: ISC-C{N}: {8-12 word state criterion} | Verify: {method}_

## DECISIONS

_Non-obvious technical decisions logged here during BUILD/EXECUTE._

## LOG

_Session entries appended during LEARN phase._
`;

  const fullPath = join(targetDir, filename);
  writeFileSync(fullPath, prdContent, "utf-8");
  return fullPath;
}

// ─── PRD Discovery ──────────────────────────────────────────────────────────

function findAllPRDs(): string[] {
  const files: string[] = [];

  // 1. Scan MEMORY/WORK directory (session-level and task-level PRDs)
  const workDir = join(BASE_DIR, "MEMORY", "WORK");
  if (existsSync(workDir)) {
    try {
      for (const session of readdirSync(workDir)) {
        const sessionPath = join(workDir, session);
        try {
          // Session-level PRDs
          for (const f of readdirSync(sessionPath)) {
            if (f.startsWith("PRD-") && f.endsWith(".md")) {
              files.push(join(sessionPath, f));
            }
          }
          // Task-level PRDs (WORK/{session}/tasks/{task}/PRD-*.md)
          const tasksDir = join(sessionPath, "tasks");
          if (existsSync(tasksDir)) {
            for (const task of readdirSync(tasksDir)) {
              if (task === "current") continue; // skip symlink
              const taskPath = join(tasksDir, task);
              try {
                for (const f of readdirSync(taskPath)) {
                  if (f.startsWith("PRD-") && f.endsWith(".md")) {
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
        const prdDir = join(PROJECTS_DIR, project, ".prd");
        if (existsSync(prdDir)) {
          try {
            for (const f of readdirSync(prdDir)) {
              if (f.startsWith("PRD-") && f.endsWith(".md")) {
                files.push(join(prdDir, f));
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
    const { frontmatter, content } = readPRD(absPath);
    const criteria = countCriteria(content);
    printPRDStatus(absPath, frontmatter, criteria);
    return;
  }

  const files = findAllPRDs();
  if (files.length === 0) {
    console.log("No PRDs found in MEMORY/WORK/ or project .prd/ directories.");
    return;
  }

  console.log(`\x1b[36mTHE ALGORITHM \u2014 PRD Status\x1b[0m\n`);

  for (const file of files) {
    try {
      const { frontmatter, content } = readPRD(file);
      const criteria = countCriteria(content);
      printPRDStatus(file, frontmatter, criteria);
    } catch {
      // Skip invalid files
    }
  }
}

function printPRDStatus(path: string, fm: PRDFrontmatter, criteria: CriteriaInfo): void {
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

function pauseLoop(prdPath: string): void {
  const absPath = resolve(prdPath);
  const { frontmatter } = readPRD(absPath);
  if (frontmatter.loopStatus !== "running") {
    console.log(`Loop is not running on ${frontmatter.id} (status: ${frontmatter.loopStatus || "idle"})`);
    return;
  }
  updateFrontmatter(absPath, { loopStatus: "paused" });
  voiceNotify(`Loop paused on ${frontmatter.id}.`);
  console.log(`\x1b[33m\u23F8 Paused\x1b[0m Loop on ${frontmatter.id}`);
  console.log(`  Resume with: algorithm resume -p ${absPath}`);
}

async function resumeLoop(prdPath: string): Promise<void> {
  const absPath = resolve(prdPath);
  const { frontmatter } = readPRD(absPath);
  if (frontmatter.loopStatus !== "paused") {
    console.log(`Loop is not paused on ${frontmatter.id} (status: ${frontmatter.loopStatus || "idle"})`);
    return;
  }
  updateFrontmatter(absPath, { loopStatus: "running" });
  voiceNotify(`Resuming loop on ${frontmatter.id}.`);
  console.log(`\x1b[36m\u25B6 Resuming\x1b[0m Loop on ${frontmatter.id}`);
  await runLoop(absPath);
}

function stopLoop(prdPath: string): void {
  const absPath = resolve(prdPath);
  const { frontmatter } = readPRD(absPath);
  updateFrontmatter(absPath, { loopStatus: "stopped" });
  voiceNotify(`Loop stopped on ${frontmatter.id}.`);
  console.log(`\x1b[31m\u25A0 Stopped\x1b[0m Loop on ${frontmatter.id}`);
}

// ─── PRD Path Resolution ────────────────────────────────────────────────────

function resolvePRDPath(input: string): string {
  // If it's already a path, use it
  if (input.includes("/") || input.endsWith(".md")) {
    return resolve(input);
  }

  // Search all known PRD locations
  const allPRDs = findAllPRDs();
  const matches = allPRDs.filter(p => basename(p).includes(input) || p.includes(input));

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    console.error(`Ambiguous PRD reference "${input}". Matches:`);
    for (const m of matches) console.error(`  ${m}`);
    process.exit(1);
  }
  console.error(`PRD not found: ${input}`);
  process.exit(1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const parsed = parseArgs(process.argv);

if (parsed.subcommand) {
  // Subcommand mode: status, pause, resume, stop
  const prdRef = parsed.prdPath;

  switch (parsed.subcommand) {
    case "status":
      showStatus(prdRef ? resolvePRDPath(prdRef) : undefined);
      break;
    case "new": {
      if (!parsed.title) {
        console.error("Usage: algorithm new -t <title> [-e <effort>] [-p <output-dir>]");
        process.exit(1);
      }
      const prdPath = createNewPRD(parsed.title, parsed.effortLevel || "Standard", prdRef || undefined);
      console.log(`\x1b[32m✓\x1b[0m Created PRD: ${prdPath}`);
      console.log(`\n  Run with:  algorithm -m interactive -p ${prdPath}`);
      console.log(`  Or loop:   algorithm -m loop -p ${prdPath} -n 20`);
      break;
    }
    case "pause":
      if (!prdRef) { console.error("Usage: algorithm pause -p <PRD>"); process.exit(1); }
      pauseLoop(resolvePRDPath(prdRef));
      break;
    case "resume":
      if (!prdRef) { console.error("Usage: algorithm resume -p <PRD>"); process.exit(1); }
      await resumeLoop(resolvePRDPath(prdRef));
      break;
    case "stop":
      if (!prdRef) { console.error("Usage: algorithm stop -p <PRD>"); process.exit(1); }
      stopLoop(resolvePRDPath(prdRef));
      break;
  }
} else if (parsed.mode) {
  // Run mode: -m loop or -m interactive
  if (!parsed.prdPath) {
    console.error("Error: -p <PRD> is required when using -m <mode>");
    console.error("Usage: algorithm -m <mode> -p <PRD> [-n N]");
    process.exit(1);
  }

  const resolvedPath = resolvePRDPath(parsed.prdPath);

  switch (parsed.mode) {
    case "loop":
      await runLoop(resolvedPath, parsed.maxIterations ?? undefined, parsed.agentCount);
      break;
    case "interactive":
      runInteractive(resolvedPath);
      break;
    default:
      console.error(`Unknown mode: ${parsed.mode}. Use 'loop' or 'interactive'.`);
      process.exit(1);
  }
} else {
  printHelp();
}
