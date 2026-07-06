#!/usr/bin/env bun
/**
 * ============================================================================
 * INFERENCE - Unified inference tool with four run levels + advisor escalation
 * ============================================================================
 *
 * PURPOSE:
 * Single inference tool with configurable speed/capability trade-offs. The
 * four levels mirror the system-wide effort abstraction in models.ts
 * (EFFORT_MODEL) — consumers state INTENT; the mapping resolves the model:
 * - low:    quick tasks, simple generation, basic classification
 * - medium: balanced reasoning, typical analysis
 * - high:   deep reasoning, strategic decisions, complex analysis
 * - max:    keystone decisions — the Advisor + Algorithm E4/E5 dispatch (max=Fable, 2026-07-01; the TheRouter classifier moved to 'high' the same day)
 * - Advisor: max-level escalation for commitment-boundary review (Algorithm v3.23+ VERIFY doctrine)
 *
 * USAGE:
 *   bun Inference.ts --level low <system_prompt> <user_prompt>
 *   bun Inference.ts --level medium <system_prompt> <user_prompt>
 *   bun Inference.ts --level high <system_prompt> <user_prompt>
 *   bun Inference.ts --level max <system_prompt> <user_prompt>
 *   bun Inference.ts --mode advisor <task> <state> <question>
 *   bun Inference.ts --mode advisor --auto-state <task> <question>   (v3.24 P5)
 *   bun Inference.ts --json --level low <system_prompt> <user_prompt>
 *
 * OPTIONS:
 *   --level <low|medium|high|max>  Run level (default: medium)
 *                                  These four are the ONLY accepted names.
 *                                  Legacy fast/standard/smart were removed
 *                                  2026-06-10 — unknown names hard-error.
 *   --mode advisor                 Advisor escalation mode — 3 positional args: task, state, question
 *   --auto-state                   v3.24 P5: Auto-synthesize state from current ISA + recent activity (advisor mode only, 2 positional args: task, question)
 *   --json                         Expect and parse JSON response
 *   --timeout <ms>                 Custom timeout (default varies by level)
 *
 * DEFAULTS BY LEVEL (models resolve via models.ts EFFORT_MODEL — edit the
 * mapping there on a lineup change; never hardcode model names here):
 *   low:      haiku-tier,  timeout=15s,  effort=low
 *   medium:   sonnet-tier, timeout=30s,  effort=medium
 *   high:     opus-tier,   timeout=90s,  effort=high
 *   max:      fable-tier,  timeout=120s, effort=xhigh
 *   advisor:  max level,   timeout=120s
 *
 * BILLING: Uses Claude CLI with subscription (not API key)
 * CACHE: Uses --exclude-dynamic-system-prompt-sections for cross-invocation prompt cache hits
 *
 * ADVISOR PATTERN (v3.24 Verification Doctrine — see LIFEOS/ALGORITHM/v3.24.0.md):
 *   The advisor() function implements the Sonnet→Opus escalation checkpoint rule
 *   from R Amjad's Anthropic Advisor tool writeup. Call at commitment boundaries:
 *   - Before committing to an approach
 *   - When stuck or diverging
 *   - Once after a durable deliverable, before declaring done
 *   Skip for short reactive tasks (measured: <4 min AND <2 files — v3.24 P2).
 *   On Extended+ ISAs, phase:complete transition = MANDATORY advisor call (v3.24 P4).
 *
 *   Unlike Anthropic's native Advisor which receives the full CC session, this
 *   function takes explicit (task, state, question) parameters. The caller may
 *   supply state manually OR set autoSynthesize: true to have the helper read
 *   the current ISA + recent activity automatically (v3.24 P5 — closes the
 *   state-gaming escape hatch where the caller cherry-picks what the reviewer sees).
 *
 *   Conflict-surfacing rule: if empirical results contradict advisor output,
 *   re-call advisor with the conflict surfaced — do NOT silently switch. Max 2
 *   re-calls on the same conflict; after that, escalate to user (v3.24 P1).
 *
 * ============================================================================
 */

import { spawn } from "child_process";

/** The four run levels — mirrors models.ts EffortLevel. */
export type InferenceLevel = 'low' | 'medium' | 'high' | 'max';

const VALID_LEVELS: readonly InferenceLevel[] = ['low', 'medium', 'high', 'max'] as const;

/** Validate a level name. Throws on anything outside the four canonical
 * names — including the pre-2026-06-10 legacy names (fast/standard/smart),
 * which were removed the same day they were aliased, per principal directive.
 * Fail-loud beats a silent wrong-model default. */
export function normalizeLevel(level: string | undefined): InferenceLevel {
  if (!level) return 'medium';
  if ((VALID_LEVELS as readonly string[]).includes(level)) return level as InferenceLevel;
  throw new Error(`[Inference] unknown level '${level}' — use low | medium | high | max (legacy fast/standard/smart names were removed 2026-06-10)`);
}

export interface InferenceOptions {
  systemPrompt: string;
  userPrompt: string;
  level?: InferenceLevel;
  expectJson?: boolean;
  timeout?: number;
  /** Optional image file paths. When provided, Read tool is enabled and paths
   * are prepended to the user prompt as @-references so Claude reads them as
   * image attachments. Routes through subscription like all other inference. */
  imagePaths?: string[];
  /** Optional cap (ms) for the max→high fallback attempt. Bounds the fallback
   * for a max-level caller under a hook ceiling (the fable attempt + opus
   * fallback must fit inside it). The TheRouter classifier FORMERLY set this;
   * it now runs at `high` directly (2026-07-01), so no caller sets it today —
   * retained for any future hook-bound max caller. Callers WITHOUT a hook
   * ceiling (e.g. the advisor, timeout 120s) omit it, so the fallback inherits
   * the full `timeout` and degrades gracefully instead of a too-tight retry. */
  fallbackTimeoutMs?: number;
}

export interface InferenceResult {
  success: boolean;
  output: string;
  parsed?: unknown;
  error?: string;
  latencyMs: number;
  level: InferenceLevel;
}

import { modelForEffort, pinnedModelForEffort, EFFORT_MODEL, LEVEL_TO_HARNESS_EFFORT, type EffortLevel, type HarnessEffort } from './models';

// Level configurations — models resolve via models.ts EFFORT_MODEL (the single
// edit point on a lineup change). No model names appear here. `effort` is the
// REASONING-EFFORT axis (the CLI `--effort` flag), resolved through
// models.ts LEVEL_TO_HARNESS_EFFORT — the one source of truth for the model-rung
// → reasoning-effort crossover (note max→xhigh). These are two distinct axes;
// see the THREE LEVEL AXES block in models.ts.
const LEVEL_CONFIG: Record<InferenceLevel, { model: string; defaultTimeout: number; effort: HarnessEffort }> = {
  low: { model: modelForEffort('low'), defaultTimeout: 15000, effort: LEVEL_TO_HARNESS_EFFORT.low },
  medium: { model: modelForEffort('medium'), defaultTimeout: 30000, effort: LEVEL_TO_HARNESS_EFFORT.medium },
  high: { model: modelForEffort('high'), defaultTimeout: 90000, effort: LEVEL_TO_HARNESS_EFFORT.high },
  // max powers the advisor (commitment-boundary review) AND Algorithm E4/E5 +
  // Core-System dispatch. max is Fable (2026-07-01). The TheRouter classifier
  // moved OFF max to 'high' the same day — it fires on every prompt, so the
  // per-prompt keystone stays on cheap/fast Opus. Pinned ID (not alias): the
  // top-rung CLI alias is unverified from a nested-session-blocked context.
  // inference() adds a max→high fallback below (now fable→opus, a real degrade).
  // Reasoning effort caps at xhigh (LEVEL_TO_HARNESS_EFFORT.max), not harness
  // `max` — by design.
  max: { model: pinnedModelForEffort('max'), defaultTimeout: 120000, effort: LEVEL_TO_HARNESS_EFFORT.max },
};

// Advisor-specific defaults (v3.23 VERIFY doctrine).
const ADVISOR_TIMEOUT_MS = 120000;

/**
 * Run inference with configurable level
 */
async function inferenceAttempt(options: InferenceOptions, modelOverride?: string): Promise<InferenceResult> {
  const level = normalizeLevel(options.level);
  const config = LEVEL_CONFIG[level];
  const startTime = Date.now();
  const timeout = options.timeout || config.defaultTimeout;
  const model = modelOverride ?? config.model;

  return new Promise((resolve) => {
    // Unset CLAUDECODE so nested `claude` invocations don't trigger the
    // nested-session guard (hooks run inside Claude Code's environment).
    const env = { ...process.env };
    delete env.CLAUDECODE;

    // BILLING: Always use subscription. Anthropic's credential precedence chain
    // (https://code.claude.com/docs/en/authentication#authentication-precedence)
    // puts BOTH ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN above CLAUDE_CODE_OAUTH_TOKEN,
    // so either one in env will silently override OAuth. Bun auto-loads ~/.claude/.env
    // into child processes, and some MCP/plugin setups export ANTHROPIC_AUTH_TOKEN —
    // either path leaks subscription work onto API-key billing. Scrub both.
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    // Also scrub ANTHROPIC_BASE_URL: if it points at a local proxy (e.g. a
    // LiteLLM gateway used for cost tracking/observability), the child process
    // would still target that proxy after losing its credentials above,
    // causing every nested call to fail auth (401) and retry until timeout.
    // Force nested subscription calls straight to Anthropic's real API.
    delete env.ANTHROPIC_BASE_URL;

    const hasImages = options.imagePaths && options.imagePaths.length > 0;
    const args = [
      '--print',
      '--model', model,
      '--effort', config.effort,  // Opus 4.8 respects effort strictly; tune intelligence vs. token spend per level
      ...(hasImages ? ['--allowedTools', 'Read'] : ['--tools', '']),
      '--output-format', 'json',
      '--exclude-dynamic-system-prompt-sections',  // v3.23 C2: cache-friendly prompt prefix (claude-code v2.1.98+)
      '--setting-sources', '',
      '--system-prompt', options.systemPrompt,
    ];

    const userPromptWithImages = hasImages
      ? `${options.imagePaths!.map((p) => `@${p}`).join('\n')}\n\n${options.userPrompt}`
      : options.userPrompt;

    let stdout = '';
    let stderr = '';

    const proc = spawn('claude', args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Write prompt via stdin to avoid ARG_MAX limits on large inputs
    proc.stdin.write(userPromptWithImages);
    proc.stdin.end();

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle timeout
    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        success: false,
        output: '',
        error: `Timeout after ${timeout}ms`,
        latencyMs: Date.now() - startTime,
        level,
      });
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      const rawEnvelope = stdout.trim();

      if (code !== 0 && !rawEnvelope) {
        resolve({
          success: false,
          output: stdout,
          error: stderr || `Process exited with code ${code}`,
          latencyMs,
          level,
        });
        return;
      }

      let parsedEnvelope: unknown;
      try {
        parsedEnvelope = JSON.parse(rawEnvelope);
      } catch {
        resolve({
          success: false,
          output: stdout,
          error: "Failed to parse claude JSON envelope",
          latencyMs,
          level,
        });
        return;
      }

      if (typeof parsedEnvelope !== 'object' || parsedEnvelope === null) {
        resolve({
          success: false,
          output: stdout,
          error: 'Failed to parse claude --output-format json envelope (parsed envelope was not an object)',
          latencyMs,
          level,
        });
        return;
      }

      const envelope = parsedEnvelope as Record<string, unknown>;
      const stopReason = envelope.stop_reason;
      const resultText = typeof envelope.result === 'string' ? envelope.result : undefined;

      // 2026-06 Fable contract: refusals arrive as HTTP-200 JSON with stop_reason:"refusal".
      if (stopReason === 'refusal') {
        resolve({
          success: false,
          output: resultText ?? '',
          error: `refusal: claude JSON envelope stop_reason=${String(stopReason)}`,
          latencyMs,
          level,
        });
        return;
      }

      if (envelope.is_error === true) {
        resolve({
          success: false,
          output: resultText ?? '',
          error: `api error: claude JSON envelope is_error=true api_error_status=${String(envelope.api_error_status)}`,
          latencyMs,
          level,
        });
        return;
      }

      if (resultText === undefined) {
        resolve({
          success: false,
          output: stdout,
          error: 'Claude JSON envelope missing result field',
          latencyMs,
          level,
        });
        return;
      }

      if (code !== 0) {
        resolve({
          success: false,
          output: resultText,
          error: stderr || `Process exited with code ${code}`,
          latencyMs,
          level,
        });
        return;
      }

      const output = resultText.trim();

      // Parse JSON if requested
      if (options.expectJson) {
        // Try both object and array matches — use whichever parses successfully.
        // The greedy object regex /\{[\s\S]*\}/ can capture invalid substrings
        // when the LLM wraps a JSON array inside markdown or explanatory text
        // that happens to contain braces. By trying both candidates and
        // validating with JSON.parse, we handle arrays and objects reliably.
        const objectMatch = output.match(/\{[\s\S]*\}/);
        const arrayMatch = output.match(/\[[\s\S]*\]/);

        for (const candidate of [objectMatch?.[0], arrayMatch?.[0]]) {
          if (!candidate) continue;
          try {
            const parsed = JSON.parse(candidate);
            resolve({
              success: true,
              output,
              parsed,
              latencyMs,
              level,
            });
            return;
          } catch { /* try next candidate */ }
        }
        resolve({
          success: false,
          output,
          error: 'Failed to parse JSON response',
          latencyMs,
          level,
        });
        return;
      }

      resolve({
        success: true,
        output,
        latencyMs,
        level,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        output: '',
        error: err.message,
        latencyMs: Date.now() - startTime,
        level,
      });
    });
  });
}

/**
 * Run inference with configurable level.
 *
 * max → top-rung model (classifier + advisor + deep skills). Because the
 * classifier is the highest-leverage decision in LifeOS, a max-model failure must
 * NOT hard-break it: this wrapper retries once on the `high` model when the
 * max attempt fails, so a top-rung outage degrades one rung rather than to a
 * fail-safe-E3-on-everything state. The retry only fires for level max; all
 * other levels are a single attempt (unchanged behavior). A fired fallback
 * logs to stderr so a silent "always falling back" state is visible in
 * observability.
 */
export async function inference(options: InferenceOptions): Promise<InferenceResult> {
  const level = normalizeLevel(options.level);
  const config = LEVEL_CONFIG[level];
  // Validate once here; inferenceAttempt re-validation is then a no-op.
  const normalized: InferenceOptions = { ...options, level };
  const first = await inferenceAttempt(normalized);
  if (first.success || level !== 'max') return first;
  // The fallback only buys resilience if it resolves to a DIFFERENT model than
  // the one that just failed. Compare at the TIER level (EFFORT_MODEL), not the
  // model string — `config.model` is a pinned ID ("claude-opus-4-8") while
  // modelForEffort returns an alias ("opus"), so a string compare would miss the
  // collision. Under a lineup where max and high share a tier (today both →
  // opus), retrying 'high' would hit the same failing model — a no-op fallback
  // that re-times-out (the bug the task-intelligence review found: the advisor
  // and classifier had no real degraded path). Pick the first distinct lower
  // rung so a top-rung outage degrades to a model that can actually answer.
  const fallbackLevel: EffortLevel =
    EFFORT_MODEL.high !== EFFORT_MODEL.max ? 'high'
    : EFFORT_MODEL.medium !== EFFORT_MODEL.max ? 'medium'
    : 'low';
  console.error(`[Inference] max-level model failed (${first.error}); falling back to ${modelForEffort(fallbackLevel)} (level=${fallbackLevel}, distinct from max)`);
  // The retry uses `fallbackTimeoutMs` when the caller set one — only the
  // TheRouter classifier does, because its hook has a hard ceiling and the max
  // attempt + fallback must fit inside it. Callers without a ceiling (advisor) omit
  // it, so the fallback inherits the full `timeout` and degrades gracefully.
  const fallbackTimeout = options.fallbackTimeoutMs ?? options.timeout ?? config.defaultTimeout;
  return inferenceAttempt({ ...normalized, timeout: fallbackTimeout }, modelForEffort(fallbackLevel));
}

/**
 * Synthesize advisor state from the current ISA + recent activity (v3.24 P5).
 *
 * Closes the state-gaming Flaw identified by RedTeam review of v3.23 doctrine:
 * when the caller writes the state string manually, the same cognitive model
 * that might have missed the problem decides what the reviewer sees. Auto-synthesis
 * reads the ISA directly so the reviewer gets the unfiltered state.
 *
 * Reads:
 * - Current ISA content (resolved from MEMORY/STATE/work.json active session, or
 *   the most recently-updated ISA in MEMORY/WORK/)
 * - Recent session activity if available
 *
 * Returns a state string suitable for passing to advisor().
 */
export async function synthesizeAdvisorState(): Promise<string> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const workDir = path.join(home, ".claude", "LIFEOS", "MEMORY", "WORK");
  const stateFile = path.join(home, ".claude", "LIFEOS", "MEMORY", "STATE", "work.json");

  // Try to read active session from work.json
  let activeSlug: string | undefined;
  try {
    const stateRaw = await fs.readFile(stateFile, "utf-8");
    const state = JSON.parse(stateRaw);
    activeSlug = state?.active || state?.current || state?.activeSession;
  } catch {
    // work.json may not exist — fall back to most recent ISA
  }

  // Fall back: find most recently updated ISA in WORK/
  if (!activeSlug) {
    try {
      const entries = await fs.readdir(workDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      if (dirs.length === 0) {
        return "No active ISA found. Advisor state unavailable.";
      }
      // Sort by mtime
      const statted = await Promise.all(
        dirs.map(async (d) => {
          const s = await fs.stat(path.join(workDir, d));
          return { name: d, mtime: s.mtimeMs };
        }),
      );
      statted.sort((a, b) => b.mtime - a.mtime);
      activeSlug = statted[0].name;
    } catch (err) {
      return `Unable to locate active ISA: ${(err as Error).message}`;
    }
  }

  // Read ISA content
  const isaPath = path.join(workDir, activeSlug, "ISA.md");
  let prdContent: string;
  try {
    prdContent = await fs.readFile(isaPath, "utf-8");
  } catch (err) {
    return `Active session ${activeSlug} has no ISA.md: ${(err as Error).message}`;
  }

  // Truncate to a reasonable size for advisor context (first 300 lines, ~8KB)
  const MAX_LINES = 300;
  const lines = prdContent.split("\n");
  const truncated = lines.length > MAX_LINES
    ? lines.slice(0, MAX_LINES).join("\n") + `\n\n[... ISA truncated at ${MAX_LINES} lines of ${lines.length} total ...]`
    : prdContent;

  // v6.6.0: surface principal_stated_goal as a leading block above the ISA blob,
  // so the advisor reads the literal anchor before any derived content.
  // Parse YAML frontmatter (delimited by the first two `---` lines).
  let goalBlock = "";
  const frontmatterMatch = prdContent.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    const goalLine = fm.match(/^principal_stated_goal:\s*"((?:[^"\\]|\\.)*)"/m);
    if (goalLine && goalLine[1]) {
      goalBlock = [
        `--- PRINCIPAL STATED GOAL (v6.4.0 literal — evidence anchor, not optimization target) ---`,
        goalLine[1],
        `--- END PRINCIPAL STATED GOAL ---`,
        ``,
      ].join("\n");
    }
  }

  return [
    `ISA: ${activeSlug}`,
    `Source: ${isaPath}`,
    ``,
    goalBlock,
    `--- ISA CONTENT (verbatim, auto-synthesized from disk — not caller-filtered) ---`,
    truncated,
    `--- END ISA CONTENT ---`,
  ].filter(line => line !== "").join("\n");
}

/**
 * Advisor escalation — v3.24 Verification Doctrine.
 *
 * Calls the max level framed as a reviewer. Caller may supply explicit state
 * OR set autoSynthesize: true to have the helper read the current ISA automatically
 * (v3.24 P5 — closes state-gaming escape hatch).
 *
 * @param task          What the executor is trying to accomplish
 * @param state         Current relevant state (omit when autoSynthesize is true)
 * @param question      Specific question or decision point the executor faces
 * @param autoSynthesize If true, ignore `state` and read current ISA via synthesizeAdvisorState()
 * @param timeout       Override timeout in ms (default 120000)
 * @returns Structured advisory response
 *
 * Usage:
 *   import { advisor } from "./Inference";
 *
 *   // Manual state
 *   const review = await advisor({
 *     task: "Ship Algorithm v3.24.0",
 *     state: "Edited 8 files; ISC 28/30 passing; Inference.ts typecheck clean.",
 *     question: "Any gaps before declaring done?",
 *   });
 *
 *   // Auto-synthesized state (v3.24 P5 — recommended for commitment boundaries)
 *   const review = await advisor({
 *     task: "Ship Algorithm v3.24.0",
 *     question: "Any gaps before declaring done?",
 *     autoSynthesize: true,
 *   });
 *
 * Rules (from Algorithm v3.24.0 VERIFY doctrine):
 * - Call at commitment boundaries: before approach, when stuck, before declaring done
 * - Skip for MEASURED short reactive tasks (<4 min wall-clock AND <2 files)
 * - Extended+ ISA phase:complete = mandatory advisor call (P4)
 * - On conflict with empirical: re-call surfacing conflict, max 2 re-calls, then escalate (P1)
 */
export interface AdvisorOptions {
  task: string;
  state?: string;
  question: string;
  autoSynthesize?: boolean;
  timeout?: number;
}

export async function advisor(options: AdvisorOptions): Promise<InferenceResult> {
  const systemPrompt = [
    "You are an advisor model invoked at a commitment boundary by an executor model.",
    "Review the executor's task, state, and specific question.",
    "Be direct. Flag risks the executor may have missed.",
    "If you see a fatal flaw, say so. If the approach is sound, confirm and say why.",
    "Your output will be weighed against empirical test results — a passing test does NOT invalidate your review.",
  ].join(" ");

  // Resolve state: either auto-synthesized from ISA or caller-supplied.
  let resolvedState: string;
  if (options.autoSynthesize) {
    resolvedState = await synthesizeAdvisorState();
  } else if (options.state !== undefined) {
    resolvedState = options.state;
  } else {
    return {
      success: false,
      output: "",
      error: "advisor() requires either state or autoSynthesize: true",
      latencyMs: 0,
      level: 'max',
    };
  }

  const userPrompt = [
    `TASK: ${options.task}`,
    ``,
    `STATE:`,
    resolvedState,
    ``,
    `QUESTION: ${options.question}`,
    ``,
    `Advisory response:`,
  ].join("\n");

  return inference({
    systemPrompt,
    userPrompt,
    level: 'max',
    timeout: options.timeout ?? ADVISOR_TIMEOUT_MS,
  });
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let expectJson = false;
  let timeout: number | undefined;
  let level: InferenceLevel = 'medium';
  let mode: 'inference' | 'advisor' = 'inference';
  let autoState = false;  // v3.24 P5
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') {
      expectJson = true;
    } else if (args[i] === '--auto-state') {
      autoState = true;
    } else if (args[i] === '--mode' && args[i + 1]) {
      const requestedMode = args[i + 1].toLowerCase();
      if (requestedMode === 'advisor' || requestedMode === 'inference') {
        mode = requestedMode;
      } else {
        console.error(`Invalid mode: ${args[i + 1]}. Use inference or advisor.`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--level' && args[i + 1]) {
      const requestedLevel = args[i + 1].toLowerCase();
      if (['low', 'medium', 'high', 'max'].includes(requestedLevel)) {
        level = requestedLevel as InferenceLevel;
      } else {
        console.error(`Invalid level: ${args[i + 1]}. Use low, medium, high, or max. (Legacy fast/standard/smart were removed 2026-06-10.)`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1], 10);
      i++;
    } else {
      positionalArgs.push(args[i]);
    }
  }

  // Advisor mode: normally task/state/question (3 args), or with --auto-state task/question (2 args)
  if (mode === 'advisor') {
    if (autoState) {
      if (positionalArgs.length < 2) {
        console.error('Usage: bun Inference.ts --mode advisor --auto-state [--json] [--timeout <ms>] <task> <question>');
        process.exit(1);
      }
      const [task, question] = positionalArgs;
      const advisoryResult = await advisor({ task, question, autoSynthesize: true, timeout });
      if (advisoryResult.success) {
        console.log(advisoryResult.output);
      } else {
        console.error(`Advisor error: ${advisoryResult.error}`);
        process.exit(1);
      }
      return;
    }
    if (positionalArgs.length < 3) {
      console.error('Usage: bun Inference.ts --mode advisor [--json] [--timeout <ms>] <task> <state> <question>');
      console.error('       bun Inference.ts --mode advisor --auto-state [--json] [--timeout <ms>] <task> <question>');
      process.exit(1);
    }
    const [task, state, question] = positionalArgs;
    const advisoryResult = await advisor({ task, state, question, timeout });
    if (advisoryResult.success) {
      console.log(advisoryResult.output);
    } else {
      console.error(`Advisor error: ${advisoryResult.error}`);
      process.exit(1);
    }
    return;
  }

  if (positionalArgs.length < 2) {
    console.error('Usage: bun Inference.ts [--level low|medium|high|max] [--json] [--timeout <ms>] <system_prompt> <user_prompt>');
    process.exit(1);
  }

  const [systemPrompt, userPrompt] = positionalArgs;

  const result = await inference({
    systemPrompt,
    userPrompt,
    level,
    expectJson,
    timeout,
  });

  if (result.success) {
    if (expectJson && result.parsed) {
      console.log(JSON.stringify(result.parsed));
    } else {
      console.log(result.output);
    }
  } else {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
