#!/usr/bin/env bun
/**
 * ============================================================================
 * INFERENCE - Unified inference tool with three run levels + advisor escalation
 * ============================================================================
 *
 * PURPOSE:
 * Single inference tool with configurable speed/capability trade-offs:
 * - Fast: Haiku - quick tasks, simple generation, basic classification
 * - Standard: Sonnet - balanced reasoning, typical analysis
 * - Smart: Opus - deep reasoning, strategic decisions, complex analysis
 * - Advisor: Smart-tier escalation for commitment-boundary review (Algorithm v3.23+ VERIFY doctrine)
 *
 * USAGE:
 *   bun Inference.ts --level fast <system_prompt> <user_prompt>
 *   bun Inference.ts --level standard <system_prompt> <user_prompt>
 *   bun Inference.ts --level smart <system_prompt> <user_prompt>
 *   bun Inference.ts --mode advisor <task> <state> <question>
 *   bun Inference.ts --mode advisor --auto-state <task> <question>   (v3.24 P5)
 *   bun Inference.ts --json --level fast <system_prompt> <user_prompt>
 *
 * OPTIONS:
 *   --level <fast|standard|smart>  Run level (default: standard)
 *   --mode advisor                 Advisor escalation mode — 3 positional args: task, state, question
 *   --auto-state                   v3.24 P5: Auto-synthesize state from current ISA + recent activity (advisor mode only, 2 positional args: task, question)
 *   --json                         Expect and parse JSON response
 *   --timeout <ms>                 Custom timeout (default varies by level)
 *   --no-thinking                  Disable the extended-thinking budget (snap-judgment latency); implied by --level fast
 *
 * DEFAULTS BY LEVEL:
 *   fast:     model=haiku,   timeout=15s,  thinking=off
 *   standard: model=sonnet,  timeout=30s
 *   smart:    model=opus,    timeout=90s
 *   advisor:  model=opus,    timeout=120s
 *
 * BILLING: Uses Claude CLI with subscription (not API key)
 * CACHE: Uses --exclude-dynamic-system-prompt-sections for cross-invocation prompt cache hits
 *
 * ADVISOR PATTERN (v3.24 Verification Doctrine — see PAI/ALGORITHM/v3.24.0.md):
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

export type InferenceLevel = 'fast' | 'standard' | 'smart';

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
  /** Set to `false` to disable the extended-thinking budget for this call (sets
   * MAX_THINKING_TOKENS=0 in the subprocess env). Every `claude --print` call
   * otherwise silently spends a thinking budget — measured ~14.9s vs ~3.2s on a
   * snap-judgment classification payload, with model tier nearly irrelevant.
   * Implicitly disabled for `level: 'fast'`. */
  thinking?: boolean;
}

export interface InferenceResult {
  success: boolean;
  output: string;
  parsed?: unknown;
  error?: string;
  latencyMs: number;
  level: InferenceLevel;
}

// Level configurations
const LEVEL_CONFIG: Record<InferenceLevel, { model: string; defaultTimeout: number }> = {
  fast: { model: 'haiku', defaultTimeout: 15000 },
  standard: { model: 'sonnet', defaultTimeout: 30000 },
  smart: { model: 'opus', defaultTimeout: 90000 },
};

// Advisor-specific defaults (v3.23 VERIFY doctrine).
const ADVISOR_TIMEOUT_MS = 120000;

/**
 * Run inference with configurable level
 */
export async function inference(options: InferenceOptions): Promise<InferenceResult> {
  const level = options.level || 'standard';
  const config = LEVEL_CONFIG[level];
  const startTime = Date.now();
  const timeout = options.timeout || config.defaultTimeout;

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

    // Disable the extended-thinking budget for latency-sensitive calls. Every
    // `claude --print` subprocess otherwise silently spends a thinking budget
    // (measured ~14.9s vs ~3.2s on a snap-judgment classification payload, with
    // model tier nearly irrelevant). `fast` is a snap judgment by definition;
    // other levels opt out explicitly with `thinking: false`.
    if (level === 'fast' || options.thinking === false) {
      env.MAX_THINKING_TOKENS = '0';
    }

    const hasImages = options.imagePaths && options.imagePaths.length > 0;
    const args = [
      '--print',
      '--model', config.model,
      ...(hasImages ? ['--allowedTools', 'Read'] : ['--tools', '']),
      '--output-format', 'text',
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

      if (code !== 0) {
        resolve({
          success: false,
          output: stdout,
          error: stderr || `Process exited with code ${code}`,
          latencyMs,
          level,
        });
        return;
      }

      const output = stdout.trim();

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
  const workDir = path.join(home, ".claude", "PAI", "MEMORY", "WORK");
  const stateFile = path.join(home, ".claude", "PAI", "MEMORY", "STATE", "work.json");

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

  return [
    `ISA: ${activeSlug}`,
    `Source: ${isaPath}`,
    ``,
    `--- ISA CONTENT (verbatim, auto-synthesized from disk — not caller-filtered) ---`,
    truncated,
    `--- END ISA CONTENT ---`,
  ].join("\n");
}

/**
 * Advisor escalation — v3.24 Verification Doctrine.
 *
 * Calls smart tier (Opus) framed as a reviewer. Caller may supply explicit state
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
      level: 'smart',
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
    level: 'smart',
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
  let level: InferenceLevel = 'standard';
  let noThinking = false;
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
      if (['fast', 'standard', 'smart'].includes(requestedLevel)) {
        level = requestedLevel as InferenceLevel;
      } else {
        console.error(`Invalid level: ${args[i + 1]}. Use fast, standard, or smart.`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--no-thinking') {
      noThinking = true;
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
    console.error('Usage: bun Inference.ts [--level fast|standard|smart] [--json] [--timeout <ms>] [--no-thinking] <system_prompt> <user_prompt>');
    process.exit(1);
  }

  const [systemPrompt, userPrompt] = positionalArgs;

  const result = await inference({
    systemPrompt,
    userPrompt,
    level,
    expectJson,
    timeout,
    thinking: noThinking ? false : undefined,
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
