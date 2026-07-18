#!/usr/bin/env bun
/**
 * ============================================================================
 * INFERENCE - Unified inference tool with four run levels
 * ============================================================================
 *
 * PURPOSE:
 * Single inference tool with configurable speed/capability trade-offs. The
 * four levels mirror the system-wide effort abstraction in models.ts
 * (EFFORT_MODEL) — consumers state INTENT; the mapping resolves the model:
 * - low:    quick tasks, simple generation, basic classification
 * - medium: balanced reasoning, typical analysis
 * - high:   deep reasoning, strategic decisions, complex analysis
 * - max:    keystone decisions — Algorithm E4/E5 dispatch (max=Fable, 2026-07-01; the TheRouter classifier moved to 'high' the same day)
 *
 * USAGE:
 *   bun Inference.ts --level low <system_prompt> <user_prompt>
 *   bun Inference.ts --level medium <system_prompt> <user_prompt>
 *   bun Inference.ts --level high <system_prompt> <user_prompt>
 *   bun Inference.ts --level max <system_prompt> <user_prompt>
 *   bun Inference.ts --json --level low <system_prompt> <user_prompt>
 *
 * OPTIONS:
 *   --level <low|medium|high|max>  Run level (default: medium)
 *                                  These four are the ONLY accepted names.
 *                                  Legacy fast/standard/smart were removed
 *                                  2026-06-10 — unknown names hard-error.
 *   --json                         Expect and parse JSON response
 *   --timeout <ms>                 Custom timeout (default varies by level)
 *
 * DEFAULTS BY LEVEL (models resolve via models.ts EFFORT_MODEL — edit the
 * mapping there on a lineup change; never hardcode model names here):
 *   low:      haiku-tier,  timeout=15s,  effort=high   (effort uniformly high 2026-07-06)
 *   medium:   sonnet-tier, timeout=30s,  effort=high
 *   high:     opus-tier,   timeout=90s,  effort=high
 *   max:      fable-tier,  timeout=120s, effort=high   (ceiling — was xhigh, flattened 2026-07-06)
 *
 * BILLING: Uses Claude CLI with subscription (not API key)
 * CACHE: Uses --exclude-dynamic-system-prompt-sections for cross-invocation prompt cache hits
 *
 */

import { spawn } from "child_process";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/**
 * Resolve the claude binary explicitly. launchd jobs run with a minimal PATH
 * that lacks ~/.local/bin, which made every scheduled caller (amber route,
 * conduit insight) fail silently with ENOENT — 2026-07-10.
 */
export function resolveClaudeBin(): string {  // exported for algorithm.ts (PR #1460, author asdf8675309)
  const fromPath = typeof Bun !== "undefined" ? Bun.which("claude") : null;
  if (fromPath) return fromPath;
  const fallback = join(homedir(), ".local", "bin", "claude");
  return existsSync(fallback) ? fallback : "claude";
}

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
   * ceiling (e.g. a fixed-timeout max caller) omit it, so the fallback inherits
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
  /** The model that ACTUALLY generated the answer, read back from the claude
   * JSON envelope's `modelUsage` map (the key with the most output tokens).
   * undefined when modelUsage is absent (older CLI / error envelopes). This is
   * PROOF of what ran — the requested model is never trusted as the executed one.
   * A `max` call that silently ran Opus instead of Fable is visible here. */
  executedModel?: string;
  /** True when `executedModel`'s family does not match the requested tier
   * (`EFFORT_MODEL[level]`) — a silent downgrade (e.g. max asked Fable, ran
   * Opus). undefined when executedModel is unknown. Logged to
   * MEMORY/OBSERVABILITY/model-verification.jsonl. */
  modelDowngraded?: boolean;
}

import { modelForEffort, pinnedModelForEffort, EFFORT_MODEL, LEVEL_TO_HARNESS_EFFORT, type EffortLevel, type HarnessEffort } from './models';
import { claudeDir } from "./lifeos-root";

// Level configurations — models resolve via models.ts EFFORT_MODEL (the single
// edit point on a lineup change). No model names appear here. `effort` is the
// REASONING-EFFORT axis (the CLI `--effort` flag), resolved through
// models.ts LEVEL_TO_HARNESS_EFFORT — the one source of truth for the model-rung
// → reasoning-effort mapping. Reasoning ceiling is `high` (max also resolves to
// high, 2026-07-06). These are two distinct axes; see THREE LEVEL AXES in models.ts.
const LEVEL_CONFIG: Record<InferenceLevel, { model: string; defaultTimeout: number; effort: HarnessEffort }> = {
  low: { model: modelForEffort('low'), defaultTimeout: 15000, effort: LEVEL_TO_HARNESS_EFFORT.low },
  medium: { model: modelForEffort('medium'), defaultTimeout: 30000, effort: LEVEL_TO_HARNESS_EFFORT.medium },
  high: { model: modelForEffort('high'), defaultTimeout: 90000, effort: LEVEL_TO_HARNESS_EFFORT.high },
  // max powers Algorithm E4/E5 +
  // Core-System dispatch. max is Fable (2026-07-01). The TheRouter classifier
  // moved OFF max to 'high' the same day — it fires on every prompt, so the
  // per-prompt keystone stays on cheap/fast Opus. Pinned ID (not alias): the
  // top-rung CLI alias is unverified from a nested-session-blocked context.
  // inference() adds a max→high fallback below (now fable→opus, a real degrade).
  // Reasoning effort caps at `high` (LEVEL_TO_HARNESS_EFFORT.max resolves to high,
  // 2026-07-06) — LifeOS never emits xhigh/max.
  max: { model: pinnedModelForEffort('max'), defaultTimeout: 120000, effort: LEVEL_TO_HARNESS_EFFORT.max },
};

/** Determine which model actually produced the answer, and whether the requested
 * tier was silently downgraded, from a claude JSON envelope's `modelUsage` map
 * (keyed by executed model id). The integrity primitive behind executed-model
 * verification: the system reports what RAN, not what it requested.
 *
 * How the answer model is identified: Claude Code fires a background haiku pass
 * (conversation title / summary) on every turn that SHARES this envelope and can
 * carry MORE input AND output tokens than a short answer (observed: haiku 528 in
 * / 11 out vs the fable answer 179 in / 13 out). So we FILTER haiku first (unless
 * haiku was requested), then take the highest-OUTPUT model among the rest as the
 * author. Presence alone is not enough — a mid-run fallback (a small fable
 * safety-classifier pass, then opus authoring the answer) leaves BOTH in the
 * envelope, and family-presence would call that "fable ran"; output picks the
 * real author. Returns {} when modelUsage is absent (older CLI / error
 * envelopes) — never guesses. */
export function verifyExecutedModel(modelUsage: unknown, expectedTier: string): { executed?: string; downgraded?: boolean } {
  if (!modelUsage || typeof modelUsage !== 'object') return {};
  const keys = Object.keys(modelUsage as Record<string, unknown>);
  if (keys.length === 0) return {};
  // Background utility model in Claude Code is haiku (title/summary). Filter it so
  // it can't be mistaken for the answer — UNLESS haiku was the requested tier.
  const answerKeys = expectedTier === 'haiku' ? keys : keys.filter((k) => !k.includes('haiku'));
  const pool = answerKeys.length > 0 ? answerKeys : keys; // only-haiku (downgrade-to-haiku) edge
  // The ANSWER model is the highest-OUTPUT model in the pool. A mid-run fallback
  // (small fable classifier pass + opus answer) leaves both, so presence alone
  // would misreport authorship; output identifies who actually answered.
  let executed = pool[0];
  let bestOut = -1;
  for (const k of pool) {
    const u = (modelUsage as Record<string, { outputTokens?: unknown }>)[k];
    const out = u && typeof u.outputTokens === 'number' ? u.outputTokens : 0;
    if (out > bestOut) { bestOut = out; executed = k; }
  }
  const downgraded = executed ? !executed.includes(expectedTier) : undefined;
  return { executed, downgraded };
}

/** Append a model-verification record. The system NEVER claims a model ran
 * without this proof — a `max` (Fable) call that silently executes Opus is the
 * exact drift this catches and makes auditable. Logging must never break inference. */
function logModelVerification(entry: Record<string, unknown>): void {
  try {
    const dir = join(claudeDir(), 'LIFEOS', 'MEMORY', 'OBSERVABILITY');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'model-verification.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch { /* observability must never break inference */ }
}

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
    // Also scrub ANTHROPIC_BASE_URL: a local proxy (e.g. a LiteLLM gateway) would
    // still be targeted after the child loses its credentials above, so every
    // nested call fails auth (401) and retries until timeout. Force real Anthropic API.
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

    const proc = spawn(resolveClaudeBin(), args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // #1158: `claude --print` parses a leading-slash prompt ("/interview") as a
    // CLI slash command → "Unknown command: /X" → downstream JSON-parse failure.
    // Prefix such prompts so they always reach the model as plain text. Guards
    // every caller (router classifier included), not just one call site.
    const stdinPayload = /^\s*\//.test(userPromptWithImages)
      ? `User message: ${userPromptWithImages}`
      : userPromptWithImages;

    // Write prompt via stdin to avoid ARG_MAX limits on large inputs
    proc.stdin.write(stdinPayload);
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

      // EXECUTED-MODEL VERIFICATION (integrity linchpin). Read back which model
      // actually ran from `modelUsage`, compare it to the requested tier, and log
      // any silent downgrade. A `max` call that runs Opus instead of Fable is
      // caught HERE instead of being reported as Fable. Logged for max (Fable
      // audit trail) and for any downgrade at any level.
      const expectedTier = EFFORT_MODEL[level];
      const { executed: executedModel, downgraded: modelDowngraded } = verifyExecutedModel(envelope.modelUsage, expectedTier);
      if (executedModel && (modelDowngraded || level === 'max')) {
        logModelVerification({ level, requested: model, expected_tier: expectedTier, executed: executedModel, downgraded: !!modelDowngraded, latency_ms: latencyMs });
      }

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
              executedModel,
              modelDowngraded,
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
        executedModel,
        modelDowngraded,
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
 * max → top-rung model (classifier + deep skills). Because the
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
  // that re-times-out (the bug the task-intelligence review found: the max-level
  // callers and classifier had no real degraded path). Pick the first distinct lower
  // rung so a top-rung outage degrades to a model that can actually answer.
  const fallbackLevel: EffortLevel =
    EFFORT_MODEL.high !== EFFORT_MODEL.max ? 'high'
    : EFFORT_MODEL.medium !== EFFORT_MODEL.max ? 'medium'
    : 'low';
  console.error(`[Inference] max-level model failed (${first.error}); falling back to ${modelForEffort(fallbackLevel)} (level=${fallbackLevel}, distinct from max)`);
  // The retry uses `fallbackTimeoutMs` when the caller set one — only the
  // TheRouter classifier does, because its hook has a hard ceiling and the max
  // attempt + fallback must fit inside it. Callers without a ceiling omit
  // it, so the fallback inherits the full `timeout` and degrades gracefully.
  const fallbackTimeout = options.fallbackTimeoutMs ?? options.timeout ?? config.defaultTimeout;
  return inferenceAttempt({ ...normalized, timeout: fallbackTimeout }, modelForEffort(fallbackLevel));
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
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') {
      expectJson = true;
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

  // Executed-model verification surfaced to the caller (stderr only — stdout stays
  // the clean answer). Proof of what RAN, so a Fable request that degraded to Opus
  // is never silently reported as Fable.
  if (result.executedModel) {
    console.error(`[model] requested=${level} → executed=${result.executedModel}${result.modelDowngraded ? '  ⚠️ DOWNGRADED from requested tier' : ''}`);
  }

  if (result.success) {
    if (expectJson && result.parsed) {
      console.log(JSON.stringify(result.parsed));
    } else {
      console.log(result.output);
    }
  } else {
    // #1323: on failure (e.g. --json parse miss) the raw model output was
    // silently dropped. Preserve it on stdout so callers can recover it;
    // exit code + stderr still signal the failure.
    if (result.output) {
      console.log(result.output);
    }
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
