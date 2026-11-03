#!/usr/bin/env bun
/**
 * @version 1.9.4
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
 * - max:    keystone decisions — hardest Algorithm dispatch (max=Fable, 2026-07-01)
 *
 * USAGE:
 *   bun Inference.ts --level low <system_prompt> <user_prompt>
 *   bun Inference.ts --level medium <system_prompt> <user_prompt>
 *   bun Inference.ts --level high <system_prompt> <user_prompt>
 *   bun Inference.ts --level max <system_prompt> <user_prompt>
 *   bun Inference.ts --json --level low <system_prompt> <user_prompt>
 *
 * SCOPE: a STANDALONE inference utility — reach for it whenever you would otherwise wire
 * your own `claude` subprocess (hooks, services, scripts, batch calls). It is NOT part of
 * intelligence selection for the Algorithm, second looks, or agent dispatch; those ride
 * native routing (tier aliases on dispatch, /model). A second look is a non-forked dispatch
 * pattern, never a subprocess — do not add an advisor mode here.
 *
 * OPTIONS:
 *   --level <low|medium|high|max>  Run level (default: medium)
 *                                  These four are the ONLY accepted names;
 *                                  any other name hard-errors.
 *   --json                         Expect and parse JSON response
 *   --timeout <ms>                 Custom timeout (default varies by level)
 *   --vendor <openai|anthropic|anthropic-api>  Vendor override (see VENDOR below)
 *   --no-fallback                              Fail instead of falling back to another vendor (allowVendorFallback:false); use it where each answer must come from the vendor named
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

import { spawn, spawnSync } from "child_process";
import { appendFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join, resolve as resolvePath } from "path";
import { homedir, tmpdir } from "os";
import { randomUUID } from "crypto";
import { modelForEffort, pinnedModelForEffort, parseClaudeId, EFFORT_MODEL, UNIFORM_HARNESS_EFFORT, CROSS_VENDOR, OPENAI_LANE_EFFORT, anthropicApiLane, type EffortLevel, type HarnessEffort } from './models';
import { DEFAULT_MAX_TOKENS, KEY_NAME, emptyUsage, addUsage, loadAnthropicApiKey, postMessages, recordAnthropicUsage, refusalError, textOf } from './AnthropicApi';
import { recordModelUse } from "./lib/ModelUse";
import { lifeosPath, getEnvPath } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { readFileSync } from "fs";

/**
 * VENDOR (1.8.0, 2026-09-07 — OPERATIONAL_PREFERENCES § Model selection: unattended and helper
 * inference off the Anthropic subscription). `openai` runs every level (Luna, Sol, Astra) through `codex exec` on the
 * ChatGPT subscription and never touches an API key (2026-10-12, SUBSCRIPTION_ONLY_LEVELS).
 * `anthropic` is the claude CLI on the subscription, unchanged. `anthropic-api` (1.9.0, 2026-10-07, HAI-5) is
 * the Anthropic Messages API, pay per token on ANTHROPIC_API_KEY_LIFEOS: low → CURRENT.haiku, medium →
 * CURRENT.sonnet (models.ts anthropicApiLane); high and max fail. It never falls back to the subscription,
 * whatever the config's `fallback` says. Resolution order:
 * options.vendor / --vendor → LIFEOS_INFERENCE_VENDOR → LIFEOS/USER/CONFIG/inference-vendor.json
 * `default` → anthropic. That file's `fallback` names the vendor tried when the default fails.
 */
export type InferenceVendor = 'openai' | 'anthropic' | 'anthropic-api';
const VENDORS: readonly InferenceVendor[] = ['openai', 'anthropic', 'anthropic-api'];
type VendorConfig = { default: InferenceVendor; fallback?: InferenceVendor; byLevel?: Partial<Record<EffortLevel, InferenceVendor>> };
let vendorConfig: VendorConfig | null = null;
export function loadVendorConfig(): VendorConfig {
  if (vendorConfig) return vendorConfig;
  try {
    const j = JSON.parse(readFileSync(lifeosPath('USER', 'CONFIG', 'inference-vendor.json'), 'utf8'));
    const byLevel: Partial<Record<EffortLevel, InferenceVendor>> = {};
    for (const [l, v] of Object.entries(j.byLevel ?? {})) if (VENDORS.includes(v as InferenceVendor)) byLevel[l as EffortLevel] = v as InferenceVendor;
    vendorConfig = { default: VENDORS.includes(j.default) ? j.default : 'anthropic', fallback: VENDORS.includes(j.fallback) ? j.fallback : undefined, byLevel };
  } catch { vendorConfig = { default: 'anthropic' }; }
  return vendorConfig;
}
/** Vendor for a call: explicit, then LIFEOS_INFERENCE_VENDOR, then the config's per-level pick, then its default. */
export function resolveVendor(explicit?: string, level?: EffortLevel): InferenceVendor {
  const cfg = loadVendorConfig();
  const v = explicit ?? process.env.LIFEOS_INFERENCE_VENDOR ?? (level ? cfg.byLevel?.[level] : undefined) ?? cfg.default;
  if (!VENDORS.includes(v as InferenceVendor)) throw new Error(`[Inference] unknown vendor '${v}' — use ${VENDORS.join(' | ')}`);
  return v as InferenceVendor;
}
export function openAiModelForLevel(level: EffortLevel): string {
  const key = { low: 'openaiLow', medium: 'openaiMedium', high: 'openaiHigh', max: 'openaiMax' }[level];
  const id = CROSS_VENDOR[key];
  if (!id) throw new Error(`[Inference] models.ts CROSS_VENDOR.${key} missing`);
  return id;
}
/** The OpenAI model a call runs on: an explicit OpenAI model id when the caller pinned one (a replay's control arm,
 *  a calibration chain), else the lane model for the level. An explicit model is honored, never silently dropped. */
export function openAiModelFor(model: string | undefined, level: EffortLevel): string {
  return model && /^(?:gpt|o\d|codex|chatgpt)/i.test(model) ? model : openAiModelForLevel(level);
}
export function loadOpenAiKey(): string | undefined {
  try { return readFileSync(getEnvPath(), 'utf8').match(/^OPENAI_API_KEY_OPTIN=["']?([^"'\n]+)/m)?.[1]; } catch { return undefined; }
}

/**
 * Resolve the claude binary explicitly. launchd jobs run with a minimal PATH
 * that lacks ~/.local/bin, which made every scheduled caller (amber route,
 * conduit insight) fail silently with ENOENT.
 */
export function resolveClaudeBin(): string {  // exported for algorithm.ts (PR #1460, author asdf8675309)
  const fromPath = typeof Bun !== "undefined" ? Bun.which("claude") : null;
  if (fromPath) return fromPath;
  const fallback = join(homedir(), ".local", "bin", "claude");
  return existsSync(fallback) ? fallback : "claude";
}

/**
 * Byte threshold above which the system prompt rides a 0600 temp file instead
 * of argv. Windows launches `claude.cmd` through cmd.exe, whose WHOLE command
 * line caps at 8191 characters, so the Linux-sized 100 KB threshold never fires
 * there and every real system prompt dies with "command line is too long"
 * (contributor evidence: 6000 passes, 9000 fails). darwin/linux keep 100_000,
 * byte-identical to before. public issue #2003, @aveneri
 */
export function systemPromptSpillBytes(platform: NodeJS.Platform = process.platform): number {
  return platform === 'win32' ? 6_000 : 100_000;
}

/**
 * Shape-tolerant parse of `claude --output-format json` stdout.
 *
 * The envelope is not always the whole of stdout: MCP servers and plugins log
 * to stdout ahead of it, and some CLI builds emit a JSON ARRAY of stream events
 * whose last `type:"result"` element is the envelope. `--strict-mcp-config`
 * removes the usual source of the noise; this parse is the backstop so a stray
 * line can never turn a successful call into "Failed to parse claude JSON
 * envelope" (public issue #1994, @spec-vova; public PR #1976, @Drizzt321).
 *
 * Order: whole stdout → last parseable line, scanning from the end. An array
 * at either step resolves to its last `type:"result"` element (else its last
 * object). Returns null when nothing parses to an object.
 */
export function parseClaudeEnvelope(stdout: string): Record<string, unknown> | null {
  const asObject = (v: unknown): Record<string, unknown> | null => {
    if (Array.isArray(v)) {
      const objs = v.filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null);
      const result = [...objs].reverse().find((e) => e.type === 'result');
      return result ?? objs[objs.length - 1] ?? null;
    }
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
  };
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try { return asObject(JSON.parse(trimmed)); } catch { /* fall through to line scan */ }
  const lines = trimmed.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || (line[0] !== '{' && line[0] !== '[')) continue;
    try {
      const parsed = asObject(JSON.parse(line));
      if (parsed) return parsed;
    } catch { /* not this line */ }
  }
  return null;
}

/**
 * One-way switch: `--exclude-dynamic-system-prompt-sections` exists from
 * claude-code v2.1.98; an older CLI rejects the whole invocation with
 * "error: unknown option". On that exact stderr the attempt is retried once
 * without the flag and the switch stays off for the rest of the process, so
 * the retry cannot recur and no version probe is needed. Never widened to any
 * other unknown option — a typo elsewhere must still fail loud.
 * public issue #2004, @aveneri
 */
let excludeDynamicSectionsSupported = true;
const EXCLUDE_DYNAMIC_FLAG = '--exclude-dynamic-system-prompt-sections';

/** The run levels — IS models.ts EffortLevel, not a copy of it. Declaring the
 * names twice is what let the 2026-06-10 rename break callers silently: a
 * consumer typed against a stale copy still type-checked (public PR #1648,
 * @elhoim). Aliasing binds this surface to the single source of truth, so a
 * level renamed in models.ts breaks stale call sites at the type level. */
export type InferenceLevel = EffortLevel;

/** Derived from EFFORT_MODEL's keys — the runtime validator follows the same
 * source of truth as the type, so the two can never disagree.
 *
 * Sorted ascending rather than left in object-key order: this list is the
 * user-facing error text, and deriving it flipped the message to
 * "max | high | medium | low", breaking the contract test that pins the
 * ascending form. Derivation is the win; key order is an implementation
 * detail that must not leak into the message. */
const LEVEL_ORDER: readonly string[] = ['low', 'medium', 'high', 'max'];
const VALID_LEVELS: readonly InferenceLevel[] = (Object.keys(EFFORT_MODEL) as InferenceLevel[])
  .slice()
  .sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));

/** Validate a level name. Throws on anything outside the four canonical names — aliasing an
 * unknown name to a default is how a caller silently gets the wrong model, so fail loud. */
export function normalizeLevel(level: string | undefined): InferenceLevel {
  if (!level) return 'medium';
  if ((VALID_LEVELS as readonly string[]).includes(level)) return level as InferenceLevel;
  throw new Error(`[Inference] unknown level '${level}' — use ${VALID_LEVELS.join(' | ')} (legacy fast/standard/smart names were removed 2026-06-10)`);
}

export interface InferenceOptions {
  systemPrompt: string;
  userPrompt: string;
  level?: InferenceLevel;
  expectJson?: boolean;
  timeout?: number;
  /** Optional image file paths. PNG, JPEG, GIF and WebP up to INLINE_IMAGE_MAX_BYTES are attached as
   * inline image blocks (stream-json input), so the model always sees them; any other file falls back to
   * an @-reference with the Read tool enabled (see claudePromptInput). Routes through subscription. */
  imagePaths?: string[];
  /** Optional cap (ms) for the max→high fallback attempt. Set it when a max-level caller
   * runs under a hook ceiling, so the top-rung attempt plus its fallback both fit inside
   * that budget. No caller sets it today; it exists for the next hook-bound max caller.
   * Callers WITHOUT a ceiling omit it, letting the fallback inherit the full `timeout` and
   * degrade gracefully instead of failing on a too-tight retry. */
  fallbackTimeoutMs?: number;
  /** Optional reasoning-effort override for this call (default: UNIFORM_HARNESS_EFFORT). Classification-shaped
   * batch work runs fine at `low`; the default stays `high` so no existing caller changes behaviour. */
  effort?: HarnessEffort;
  /** Vendor override for this call (default: resolveVendor()). */
  vendor?: InferenceVendor;
  /** Explicit Claude model id for the anthropic lane, overriding the level's tier (the eval subject, the carrier, via LIFEOS/ROUTER/EvalRoute.ts). The level still sets timeout and effort. */
  model?: string;
  /** Set false where a caller requires a specific vendor and must fail rather than silently switch. */
  allowVendorFallback?: boolean;
  /** Bound transient retry work for latency-sensitive callers. Defaults to three attempts. */
  maxAttempts?: number;
  /** JSON Schema for `expectJson` on the anthropic-api lane: sent as output_config.format so the answer is schema-valid JSON. Without it the text is parsed. Ignored by the other lanes. */
  jsonSchema?: Record<string, unknown>;
  /** OpenAI `service_tier`. `flex` halves the token price for jobs nobody is waiting on; a 400 naming service_tier drops the tier once and retries at default price (OPERATIONAL_PREFERENCES § Model selection). Ignored on the anthropic lane. */
  serviceTier?: "flex";
  /** Set false for calls whose transcript nobody reads (Tex thread compactions): the claude CLI lane then passes
   * `--no-session-persistence`, so the call writes no Claude Code transcript (Tex ISA ISC-236). Omitted, the CLI
   * keeps its own default. Ignored by the other lanes, which never write a transcript. */
  persistSession?: boolean;
  /** Cancels the call. A call aborted before it starts never runs; a running claude or codex child is killed and the call
   * fails with `aborted`, and no fallback attempt follows. The pay-per-token API lanes are only checked before they start. */
  signal?: AbortSignal;
}

/** Tokens a vendor reported for one call. Input counts cache reads and writes as well as fresh tokens. */
export interface InferenceUsage {
  input_tokens: number; output_tokens: number;
  /** The thinking share of output_tokens (`usage.output_tokens_details.thinking_tokens`), present only when the envelope reports it; never added on top of output_tokens, which already counts thinking. */
  reasoning_tokens?: number;
}

/** Token totals from a claude CLI JSON envelope: its `usage` block, else the sum of `modelUsage`. Undefined when neither carries numbers. */
export function claudeEnvelopeUsage(envelope: Record<string, unknown>): InferenceUsage | undefined {
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const u = envelope.usage as Record<string, unknown> | undefined;
  if (u && typeof u === 'object' && (typeof u.input_tokens === 'number' || typeof u.output_tokens === 'number')) {
    const thinking = (u.output_tokens_details as Record<string, unknown> | undefined)?.thinking_tokens;
    return { input_tokens: n(u.input_tokens) + n(u.cache_creation_input_tokens) + n(u.cache_read_input_tokens), output_tokens: n(u.output_tokens), ...(typeof thinking === 'number' && Number.isFinite(thinking) && thinking >= 0 ? { reasoning_tokens: thinking } : {}) };
  }
  const per = envelope.modelUsage as Record<string, Record<string, unknown>> | undefined;
  if (!per || typeof per !== 'object') return undefined;
  const rows = Object.values(per).filter((r) => r && typeof r === 'object' && (typeof r.inputTokens === 'number' || typeof r.outputTokens === 'number'));
  if (!rows.length) return undefined;
  return rows.reduce<InferenceUsage>((acc, r) => ({ input_tokens: acc.input_tokens + n(r.inputTokens) + n(r.cacheReadInputTokens) + n(r.cacheCreationInputTokens), output_tokens: acc.output_tokens + n(r.outputTokens) }), { input_tokens: 0, output_tokens: 0 });
}

const ABORTED = 'aborted';

export interface InferenceResult {
  success: boolean;
  output: string;
  parsed?: unknown;
  error?: string;
  latencyMs: number;
  level: InferenceLevel;
  /** Which vendor produced the answer (openai | anthropic | anthropic-api). */
  vendor?: InferenceVendor;
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
  /** Tokens the vendor reported (claude CLI envelope). Absent when the lane reports none (codex exec): never a guessed zero. */
  usage?: InferenceUsage;
}

// Level configurations — models resolve via models.ts EFFORT_MODEL (the single
// edit point on a lineup change). No model names appear here. `effort` is the
// REASONING-EFFORT axis (the CLI `--effort` flag), resolved through
// models.ts UNIFORM_HARNESS_EFFORT — the one source of truth for the model-rung
// → reasoning-effort mapping. Reasoning ceiling is `high` (max also resolves to
// high, 2026-07-06). These are two distinct axes; see THREE LEVEL AXES in models.ts.
const LEVEL_CONFIG: Record<InferenceLevel, { model: string; defaultTimeout: number; effort: HarnessEffort }> = {
  // Low is Haiku on the subscription, not the EFFORT_MODEL low rung (2026-10-12).
  low: { model: 'haiku', defaultTimeout: 15000, effort: UNIFORM_HARNESS_EFFORT },
  medium: { model: modelForEffort('medium'), defaultTimeout: 30000, effort: UNIFORM_HARNESS_EFFORT },
  high: { model: modelForEffort('high'), defaultTimeout: 90000, effort: UNIFORM_HARNESS_EFFORT },
  // `max` uses a PINNED id, not an alias: the top-rung CLI alias cannot be verified from a
  // nested-session-blocked context, so resolve it explicitly. inference() adds a max→high
  // fallback below, which is a real degrade because the two rungs are distinct models.
  //
  // Every `effort` field reads UNIFORM_HARNESS_EFFORT DIRECTLY — it is a scalar, not a
  // per-level record. Indexing it (`.low`, `.max`) yields undefined, which spawns
  // `--effort undefined` on every call and silently drops the effort setting rather than
  // failing. tsc catches that shape; keep this file inside `bun run test` so something does.
  max: { model: pinnedModelForEffort('max'), defaultTimeout: 120000, effort: UNIFORM_HARNESS_EFFORT },
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
    const dir = lifeosPath('MEMORY', 'OBSERVABILITY');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'model-verification.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch { /* observability must never break inference */ }
}

/**
 * Image input for the claude CLI. An `@path` mention in a `--print` stdin prompt is NOT expanded into an
 * attachment: the model sees the path as text and reaches the pixels only if it chooses to call Read. At
 * low effort it sometimes skips that call and answers blind (a stream-json capture showed 1 of 3 identical spawns with no Read call and no image block, answering
 * IMAGE_UNAVAILABLE). So every image the Messages API accepts inline goes in as a base64 image block
 * through `--input-format stream-json`, attached on every call with no tool step. Only a file the API
 * cannot take inline (an unrecognised format such as HEIC, or over the inline byte cap) keeps the Read
 * path, where the CLI's Read tool converts and downsizes it.
 */
export type InlineImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
/** Raw-byte cap for an inline image: its base64 form must stay under the Messages API's 5 MB image limit. */
export const INLINE_IMAGE_MAX_BYTES = 3_750_000;
export interface InlineImage { path: string; media_type: InlineImageMediaType; data: string }
export interface ImageInputPlan { inline: InlineImage[]; viaRead: string[] }

/** The image format from its magic bytes, or null when it is not one the API takes inline. */
export function sniffImageMediaType(bytes: Uint8Array): InlineImageMediaType | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, k) => bytes[i + k] === b);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  return null;
}

/** Split image paths into inline attachments and Read-path fallbacks. Throws when a file cannot be read. */
export function planImageInput(paths: string[], read: (p: string) => Uint8Array = (p) => readFileSync(p)): ImageInputPlan {
  const plan: ImageInputPlan = { inline: [], viaRead: [] };
  for (const p of paths) {
    const bytes = read(p);
    const media = sniffImageMediaType(bytes);
    if (media && bytes.length > 0 && bytes.length <= INLINE_IMAGE_MAX_BYTES) {
      plan.inline.push({ path: p, media_type: media, data: Buffer.from(bytes).toString('base64') });
    } else {
      plan.viaRead.push(p);
    }
  }
  return plan;
}

/** One stream-json user message: the inline images first, then the prompt text. */
export function streamJsonUserMessage(images: InlineImage[], text: string): string {
  const content = [
    ...images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })),
    { type: 'text', text },
  ];
  return JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n';
}

/**
 * The CLI arguments and stdin payload for one claude spawn's prompt and images. Pure, so the image
 * attachment contract is testable without spawning the CLI.
 */
export function claudePromptInput(userPrompt: string, plan: ImageInputPlan | null): { args: string[]; stdin: string } {
  const viaRead = plan?.viaRead ?? [];
  const inline = plan?.inline ?? [];
  const text0 = viaRead.length ? `${viaRead.map((p) => `@${p}`).join('\n')}\n\n${userPrompt}` : userPrompt;
  // #1158: `claude --print` parses a leading-slash prompt ("/interview") as a CLI slash command →
  // "Unknown command: /X" → downstream JSON-parse failure. Prefix such prompts so they reach the model as text.
  const text = /^\s*\//.test(text0) ? `User message: ${text0}` : text0;
  const args = [
    // Read only when a file must go through it; otherwise no tools at all.
    ...(viaRead.length ? ['--allowedTools', 'Read'] : ['--tools', '']),
    // Headless Read reaches only the cwd and granted dirs; an image anywhere else
    // silently fails to attach and the model answers blind (motion-pilot F9, 2026-10-04).
    ...[...new Set(viaRead.map((p) => dirname(resolvePath(p))))].flatMap((d) => ['--add-dir', d]),
    // stream-json input needs stream-json output, and print-mode stream-json output needs --verbose;
    // parseClaudeEnvelope takes the trailing `type:"result"` line, which carries the same envelope fields.
    ...(inline.length ? ['--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'] : ['--output-format', 'json']),
  ];
  return { args, stdin: inline.length ? streamJsonUserMessage(inline, text) : text };
}

/**
 * Run inference with configurable level
 */
async function inferenceAttempt(options: InferenceOptions, modelOverride?: string): Promise<InferenceResult> {
  const level = normalizeLevel(options.level);
  const config = LEVEL_CONFIG[level];
  const startTime = Date.now();
  const timeout = options.timeout || config.defaultTimeout;
  const model = modelOverride ?? options.model ?? config.model;

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
    // either path leaks subscription work onto API-key billing. Scrub both, but
    // only when the default Anthropic API is the target: a configured
    // ANTHROPIC_BASE_URL is the principal's explicit carrier (local LLM proxy,
    // gateway), no Anthropic billing is reachable from it, and scrubbing would
    // strand the child on api.anthropic.com with no credentials — every nested
    // call 401s and retries until timeout (2026-11-03 local-LLM install, memory
    // reviewer parse-failed on api_error_status=401).
    if (!env.ANTHROPIC_BASE_URL) {
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;
    }
    // Headless subprocess: never the desktop voice channel, even when spawned
    // from a terminal session whose TERM the child would inherit. Explicit
    // channels (imessage, ...) pass through. (2026-08-14 scheduled voice leak.)
    // `desktop` collapses too: the parent may carry the desktop channel from a
    // terminal session, and a headless child must never inherit voice
    // (public issue #1975, @emarcelcom).
    env.LIFEOS_NOTIFICATION_CHANNEL = !env.LIFEOS_NOTIFICATION_CHANNEL || env.LIFEOS_NOTIFICATION_CHANNEL === 'desktop'
      ? 'headless'
      : env.LIFEOS_NOTIFICATION_CHANNEL;
    // ANTHROPIC_BASE_URL is kept when set: the billing scrub above only runs
    // against the default Anthropic API, where a stray key could bill per-token.
    // The CLI finds its subscription login in the macOS Keychain by USER. A workflow step or launchd job may hand the
    // child only PATH and HOME, and then every call answers "Not logged in" (a scheduled judge call
    // can fail this way on its first run).
    // os.userInfo() reports "unknown" when USER is unset under bun, so ask the system for the uid's name.
    if (!env.USER) env.USER = spawnSync("id", ["-un"], { encoding: "utf8" }).stdout.trim() || undefined;

    let imagePlan: ImageInputPlan | null = null;
    if (options.imagePaths && options.imagePaths.length > 0) {
      try {
        imagePlan = planImageInput(options.imagePaths);
      } catch (e) {
        // A missing or unreadable image must fail the call, never reach the model as a blind prompt.
        resolve({ success: false, output: '', error: `image unreadable: ${e instanceof Error ? e.message : String(e)}`, latencyMs: Date.now() - startTime, level });
        return;
      }
    }
    const promptInput = claudePromptInput(options.userPrompt, imagePlan);

    // Large system prompts must not ride argv (public issue #1534, @christauff):
    // Linux's per-arg MAX_ARG_STRLEN (~128 KiB) kills the exec with E2BIG, and
    // macOS has no per-arg cap so the bug only bites Linux installs. Route big
    // prompts through a 0600 temp file + --system-prompt-file (verified
    // supported by the installed claude CLI). Byte length, not char count —
    // the kernel limit is bytes.
    let systemPromptFile: string | null = null;
    let systemPromptArgs = ['--system-prompt', options.systemPrompt];
    if (Buffer.byteLength(options.systemPrompt, 'utf8') > systemPromptSpillBytes()) {  // public issue #2003, @aveneri
      systemPromptFile = join(tmpdir(), `lifeos-sysprompt-${randomUUID()}.md`);
      writeFileSync(systemPromptFile, options.systemPrompt, { mode: 0o600 });
      systemPromptArgs = ['--system-prompt-file', systemPromptFile];
    }
    const cleanupSystemPromptFile = () => {
      if (systemPromptFile) {
        try { unlinkSync(systemPromptFile); } catch { /* already gone */ }
        systemPromptFile = null;
      }
    };

    const args = [
      '--print',
      '--model', model,
      '--effort', options.effort ?? config.effort,  // per-call override (additive, 2026-08-31); default stays the uniform level
      ...promptInput.args,
      // v3.23 C2: cache-friendly prompt prefix (claude-code v2.1.98+); dropped
      // for the rest of the process once an older CLI rejects it (public issue #2004, @aveneri)
      ...(excludeDynamicSectionsSupported ? [EXCLUDE_DYNAMIC_FLAG] : []),
      '--safe-mode', // public PR #2120, @pai-scaffolde: replace --setting-sources '' with --safe-mode
      // No --mcp-config is ever passed here, so strict mode loads NO MCP servers:
      // the user's servers were starting inside every inference child, logging
      // to stdout ahead of the JSON envelope and breaking the parse (public issue #1994, @spec-vova)
      '--strict-mcp-config',
      // Pin verbose off so a user-level `verbose:true` cannot switch the envelope
      // to the streamed-array shape (public PR #1976, @Drizzt321)
      '--settings', '{"verbose":false}',
      ...(options.persistSession === false ? ['--no-session-persistence'] : []),
      ...systemPromptArgs,
    ];

    let stdout = '';
    let stderr = '';

    // public issue #2057 (@cammcd) is NOT ported: a shell:true spawn of claude.cmd would
    // put the system prompt (an argv item) through cmd.exe. Needs a shell-free path.
    const claudeBin = resolveClaudeBin();
    const proc = spawn(claudeBin, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Write prompt via stdin to avoid ARG_MAX limits on large inputs. The #1158
    // leading-slash guard lives in claudePromptInput so it covers every caller.
    proc.stdin.write(promptInput.stdin);
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
      cleanupSystemPromptFile();
      resolve({
        success: false,
        output: '',
        error: `Timeout after ${timeout}ms`,
        latencyMs: Date.now() - startTime,
        level,
      });
    }, timeout);

    // The caller's cancellation kills the child at once; the close handler below then does nothing.
    const onAbort = () => {
      clearTimeout(timeoutId);
      proc.kill('SIGTERM');
      cleanupSystemPromptFile();
      resolve({ success: false, output: '', error: ABORTED, latencyMs: Date.now() - startTime, level });
    };
    if (options.signal?.aborted) onAbort(); else options.signal?.addEventListener('abort', onAbort, { once: true });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', onAbort);
      cleanupSystemPromptFile();
      if (options.signal?.aborted) return;
      const latencyMs = Date.now() - startTime;

      const rawEnvelope = stdout.trim();

      // Older CLI rejected the cache flag: flip the one-way switch and retry this
      // attempt once without it (public issue #2004, @aveneri). Scoped to THIS
      // flag's name so any other unknown option still fails loud below.
      if (code !== 0 && excludeDynamicSectionsSupported && /unknown option/i.test(stderr) && stderr.includes(EXCLUDE_DYNAMIC_FLAG)) {
        excludeDynamicSectionsSupported = false;
        console.error(`[Inference] installed claude CLI rejects ${EXCLUDE_DYNAMIC_FLAG}; retrying once without it (claude-code < 2.1.98)`);
        resolve(inferenceAttempt(options, modelOverride));
        return;
      }

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

      // Shape-tolerant: stray stdout lines or a stream-event array no longer
      // fail the call (public issue #1994, @spec-vova; public PR #1976, @Drizzt321)
      const envelope = parseClaudeEnvelope(rawEnvelope);
      if (!envelope) {
        resolve({
          success: false,
          output: stdout,
          error: "Failed to parse claude JSON envelope",
          latencyMs,
          level,
        });
        return;
      }
      const stopReason = envelope.stop_reason;
      const resultText = typeof envelope.result === 'string' ? envelope.result : undefined;

      // EXECUTED-MODEL VERIFICATION (integrity linchpin). Read back which model
      // actually ran from `modelUsage`, compare it to the requested tier, and log
      // any silent downgrade. A `max` call that runs Opus instead of Fable is
      // caught HERE instead of being reported as Fable. Logged for max (Fable
      // audit trail) and for any downgrade at any level.
      const expectedTier = (!modelOverride && options.model ? parseClaudeId(options.model)?.tier : null) ?? EFFORT_MODEL[level];
      const { executed: executedModel, downgraded: modelDowngraded } = verifyExecutedModel(envelope.modelUsage, expectedTier);
      const usage = claudeEnvelopeUsage(envelope);
      // The ladder lights the model that answered; the subprocess transcript is not this session's, so nothing double counts.
      if (executedModel) recordModelUse(executedModel, Number((envelope.modelUsage as Record<string, { outputTokens?: number }> | undefined)?.[executedModel]?.outputTokens ?? 0));
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
        for (const candidate of jsonCandidates(output)) {
          if (!candidate) continue;
          try {
            const parsed = JSON.parse(candidate);
            resolve({
              success: true,
              output,
              parsed,
              executedModel,
              modelDowngraded,
              ...(usage ? { usage } : {}),
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
          // The tokens were spent even though the answer did not parse; callers that sum cost need them.
          ...(usage ? { usage } : {}),
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
        ...(usage ? { usage } : {}),
        latencyMs,
        level,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', onAbort);
      cleanupSystemPromptFile();
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
/**
 * The outermost {…} and […] spans, the one that opens first tried first. Trying
 * the object first turned a one-item array `[{…}]` into its bare element, so
 * callers expecting an array (the lifelog idea sweep) failed on any one-idea day.
 */
function jsonCandidates(output: string): string[] {
  const obj = output.match(/\{[\s\S]*\}/);
  const arr = output.match(/\[[\s\S]*\]/);
  return [obj, arr]
    .filter((m): m is RegExpMatchArray => m !== null)
    .sort((x, y) => (x.index ?? 0) - (y.index ?? 0))
    .map((m) => m[0]);
}

/** Extract the JSON object/array a model wrapped in prose; null when neither parses. */
function parseLooseJson(output: string): unknown {
  for (const candidate of jsonCandidates(output)) {
    if (!candidate) continue;
    try { return JSON.parse(candidate); } catch { /* try next */ }
  }
  return null;
}

/** Every OpenAI level runs through codex on the ChatGPT subscription; LifeOS holds no OpenAI API key (2026-10-12). */
export const SUBSCRIPTION_ONLY_LEVELS: ReadonlySet<EffortLevel> = new Set<EffortLevel>(["low", "medium", "high", "max"]);

/** The `codex exec` argv for one subscription call: read-only, no tools needed, answer written to `finalFile`. */
export function codexInferenceArgv(codex: string, model: string, finalFile: string, cwd: string, images: string[] = [], effort?: string): string[] {
  return [codex, "exec", "--model", model, ...(effort ? ["-c", `model_reasoning_effort=${effort}`] : []), "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--cd", cwd, "-o", finalFile, ...images.flatMap((i) => ["-i", i]), "-"];
}

/**
 * Whether a codex auth.json is a ChatGPT subscription login. `codex login --with-api-key` writes the same file with
 * an API key and no tokens, and codex then bills the API, so the file existing proves nothing. An `auth_mode`, when
 * present, must be a ChatGPT mode; without one, the file must hold ChatGPT tokens and no API key.
 */
export function codexSubscriptionAuth(text: string): { ok: true } | { ok: false; error: string } {
  let j: Record<string, unknown>;
  try { j = JSON.parse(text) as Record<string, unknown>; } catch { return { ok: false, error: "~/.codex/auth.json is not valid JSON" }; }
  const tokens = j.tokens as Record<string, unknown> | null | undefined;
  const hasTokens = !!tokens && typeof tokens === "object" && typeof tokens.access_token === "string" && tokens.access_token.length > 0;
  const mode = typeof j.auth_mode === "string" ? j.auth_mode : undefined;
  const hasKey = typeof j.OPENAI_API_KEY === "string" && j.OPENAI_API_KEY.length > 0;
  if (mode !== undefined ? /^chatgpt/i.test(mode) && hasTokens : hasTokens && !hasKey) return { ok: true };
  return { ok: false, error: "~/.codex/auth.json is not a ChatGPT subscription login (API-key auth); run `codex login` with ChatGPT; an API key is never used" };
}

/**
 * One `codex exec` turn on the ChatGPT subscription: an isolated codex home holding only the login, every
 * OpenAI API key stripped from the child, images attached with -i. No subscription login means an error,
 * never a fallback onto an API key. Shared by the high/max Inference lanes and the OpenAI vision judge.
 */
export async function runCodexOnSubscription(prompt: string, model: string, timeoutMs: number, images: string[] = [], effort?: string, signal?: AbortSignal): Promise<{ ok: true; output: string } | { ok: false; error: string }> {
  if (signal?.aborted) return { ok: false, error: ABORTED };
  const codex = Bun.which("codex") ?? join(homedir(), ".bun", "bin", "codex");
  if (!existsSync(codex)) return { ok: false, error: "codex CLI not found" };
  const auth = join(homedir(), ".codex", "auth.json");
  if (!existsSync(auth)) return { ok: false, error: "no ChatGPT subscription login (~/.codex/auth.json); an API key is never used" };
  const login = codexSubscriptionAuth(readFileSync(auth, "utf8"));
  if (!login.ok) return login;
  const { symlinkSync, rmSync } = await import("fs");
  const home = join(homedir(), ".cache", "lifeos-codex-homes", `inference-${process.pid}-${randomUUID().slice(0, 8)}`);
  const work = join(home, "work");
  mkdirSync(work, { recursive: true, mode: 0o700 });
  try {
    await Bun.write(join(home, "config.toml"), "");
    symlinkSync(auth, join(home, "auth.json"));
    const finalFile = join(home, "final.txt");
    const env: Record<string, string | undefined> = { ...process.env, CODEX_HOME: home };
    for (const k of Object.keys(env)) if (k.startsWith("OPENAI_API_KEY") || k === "OPENAI_BASE_URL") delete env[k];
    const proc = Bun.spawn(codexInferenceArgv(codex, model, finalFile, work, images.map((i) => resolvePath(i)), effort), { stdin: new Blob([prompt]), stdout: "ignore", stderr: "pipe", env });
    const timer = setTimeout(() => proc.kill(), timeoutMs);
    const onAbort = () => proc.kill();
    signal?.addEventListener("abort", onAbort, { once: true });
    const code = await proc.exited;
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    if (signal?.aborted) return { ok: false, error: ABORTED };
    const output = existsSync(finalFile) ? readFileSync(finalFile, "utf8").trim() : "";
    if (code !== 0 || !output) return { ok: false, error: code !== 0 ? `exit ${code}: ${(await new Response(proc.stderr).text()).trim().slice(-300)}` : "empty answer" };
    return { ok: true, output };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

/**
 * High and max run Sol and Astra through `codex exec` on the ChatGPT subscription, never the pay-per-token API
 * (the API lane once billed for models the subscription already covers). No
 * subscription login means a failed call, never a fallback onto an API key.
 */
async function openAiCodexAttempt(options: InferenceOptions, level: EffortLevel, model: string, timeout: number): Promise<InferenceResult> {
  const startTime = Date.now();
  if (options.imagePaths && options.imagePaths.length > 0) return { success: false, output: "", error: "openai-codex: does not take imagePaths", latencyMs: 0, level, vendor: "openai" };
  const prompt = `${options.systemPrompt}\n\n---\n\n${options.userPrompt}${options.expectJson ? "\n\nRespond with JSON only — no prose, no code fences." : ""}`;
  const r = await runCodexOnSubscription(prompt, model, timeout, [], OPENAI_LANE_EFFORT[level], options.signal);
  const latencyMs = Date.now() - startTime;
  if (!r.ok) return { success: false, output: "", error: `openai-codex: ${r.error}`, latencyMs, level, vendor: "openai" };
  if (options.expectJson) {
    const parsed = parseLooseJson(r.output);
    return parsed === null ? { success: false, output: r.output, error: "Failed to parse JSON response", latencyMs, level, vendor: "openai", executedModel: model } : { success: true, output: r.output, parsed, latencyMs, level, vendor: "openai", executedModel: model };
  }
  return { success: true, output: r.output, latencyMs, level, vendor: "openai", executedModel: model };
}

/** The slowest a codex turn's default deadline may be set: `codex exec` spends seconds starting before it answers. */
export const CODEX_DEFAULT_FLOOR_MS = 60_000;

/**
 * The deadline for one codex turn. A caller's explicit timeout is a deadline and is kept exactly, however
 * short; only the level default is raised to CODEX_DEFAULT_FLOOR_MS (review round 3: `Math.max(timeout,
 * 60_000)` let a 5-second caller wait a full minute on a stalled child).
 */
export function codexTimeoutMs(explicitMs: number | undefined, level: EffortLevel): number {
  if (explicitMs && explicitMs > 0) return explicitMs;
  return Math.max(LEVEL_CONFIG[level].defaultTimeout * 2, CODEX_DEFAULT_FLOOR_MS);
}

/** OpenAI lane: one Responses API call, no tools. Images are not supported here (anthropic lane handles them). */
async function openAiAttempt(options: InferenceOptions): Promise<InferenceResult> {
  const level = normalizeLevel(options.level);
  const startTime = Date.now();
  const timeout = options.timeout || LEVEL_CONFIG[level].defaultTimeout * 2;
  const model = openAiModelFor(options.model, level);
  if (SUBSCRIPTION_ONLY_LEVELS.has(level)) return openAiCodexAttempt(options, level, model, codexTimeoutMs(options.timeout, level));
  const key = loadOpenAiKey();
  if (!key) return { success: false, output: '', error: 'OPENAI_API_KEY_OPTIN missing from .env', latencyMs: 0, level, vendor: 'openai' };
  if (options.imagePaths && options.imagePaths.length > 0) return { success: false, output: '', error: 'openai lane does not take imagePaths', latencyMs: 0, level, vendor: 'openai' };
  const instructions = options.expectJson ? `${options.systemPrompt}\n\nRespond with JSON only — no prose, no code fences.` : options.systemPrompt;
  let last = '';
  let tier = options.serviceTier;
  const maxAttempts = Math.max(1, Math.min(3, Math.floor(options.maxAttempts ?? 3)));
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(timeout),
        // json_object mode requires the word "json" in an input message, not only in instructions.
        body: JSON.stringify({ model, instructions, input: [{ role: 'user', content: options.expectJson ? `${options.userPrompt}\n\n(Answer as JSON.)` : options.userPrompt }], store: false, ...(tier ? { service_tier: tier } : {}), ...(OPENAI_LANE_EFFORT[level] ? { reasoning: { effort: OPENAI_LANE_EFFORT[level] } } : {}), ...(options.expectJson ? { text: { format: { type: 'json_object' } } } : {}) }),
      });
    } catch (e) { last = String(e); await Bun.sleep(1500 * (attempt + 1)); continue; }
    const j = await res.json().catch(() => ({})) as any;
    const text: string = typeof j.output_text === 'string' ? j.output_text : (j.output ?? []).filter((x: any) => x.type === 'message').flatMap((m: any) => (m.content ?? []).map((c: any) => c.text ?? '')).join('\n');
    if (res.ok && !j.error && text) {
      const output = text.trim();
      const latencyMs = Date.now() - startTime;
      try { appendFileSync(join(lifeosPath('MEMORY', 'OBSERVABILITY'), 'openai-usage.jsonl'), JSON.stringify({ ts: new Date().toISOString(), vendor: 'openai', model, job: 'inference', level, input: j.usage?.input_tokens ?? 0, output: j.usage?.output_tokens ?? 0, cached: j.usage?.input_tokens_details?.cached_tokens ?? 0, reasoning: j.usage?.output_tokens_details?.reasoning_tokens ?? 0, calls: 1 }) + '\n'); } catch { /* observability never breaks inference */ }
      recordModelUse(j.model ?? model, Number(j.usage?.output_tokens ?? 0));
      if (options.expectJson) {
        const parsed = parseLooseJson(output);
        return parsed === null ? { success: false, output, error: 'Failed to parse JSON response', latencyMs, level, vendor: 'openai', executedModel: j.model ?? model } : { success: true, output, parsed, latencyMs, level, vendor: 'openai', executedModel: j.model ?? model };
      }
      return { success: true, output, latencyMs, level, vendor: 'openai', executedModel: j.model ?? model };
    }
    last = j.error?.message ?? `HTTP ${res.status}`;
    if (tier && res.status === 400 && /service_tier/i.test(String(last))) { tier = undefined; continue; } // model rejects flex: retry once at default price, never onto the fallback vendor
    if (res.status === 400 || res.status === 401 || res.status === 403) break; // not retryable
    await Bun.sleep(1500 * (attempt + 1));
  }
  return { success: false, output: '', error: `openai: ${last.slice(0, 300)}`, latencyMs: Date.now() - startTime, level, vendor: 'openai' };
}

/**
 * anthropic-api lane: one Messages API call, no tools, pay per token. Haiku 5.5 / Sonnet 5.5 rules:
 * no sampling params, no prefill (the last message is the user's), effort in output_config, text read
 * by block type because thinking blocks come first, refusal is an error. Never the subscription.
 */
async function anthropicApiAttempt(options: InferenceOptions): Promise<InferenceResult> {
  const level = normalizeLevel(options.level);
  const fail = (error: string, latencyMs = 0, output = ''): InferenceResult => ({ success: false, output, error, latencyMs, level, vendor: 'anthropic-api' });
  let lane: { model: string; effort: HarnessEffort };
  try { lane = anthropicApiLane(level); } catch (e) { return fail(`[Inference] ${(e as Error).message}`); }
  if (options.model) return fail('anthropic-api serves its lane models only; an explicit model override belongs to the anthropic lane');
  if (options.imagePaths && options.imagePaths.length > 0) return fail('anthropic-api lane does not take imagePaths');
  const key = loadAnthropicApiKey();
  if (!key) return fail(`${KEY_NAME} missing (env or .env); anthropic-api never falls back to the subscription`);
  const startTime = Date.now();
  const timeout = options.timeout || LEVEL_CONFIG[level].defaultTimeout * 2;
  const json = !!options.expectJson;
  const system = json && !options.jsonSchema ? `${options.systemPrompt}\n\nRespond with JSON only — no prose, no code fences.` : options.systemPrompt;
  const outputConfig: Record<string, unknown> = { effort: options.effort ?? lane.effort };
  if (json && options.jsonSchema) outputConfig.format = { type: 'json_schema', schema: options.jsonSchema };
  const body = { model: lane.model, max_tokens: DEFAULT_MAX_TOKENS, system, messages: [{ role: 'user', content: options.userPrompt }], output_config: outputConfig };
  const r = await postMessages(key, body, { timeoutMs: timeout, maxAttempts: options.maxAttempts });
  const latencyMs = Date.now() - startTime;
  if (!r.ok) return fail(`anthropic-api: ${r.error}`, latencyMs);
  const usage = emptyUsage();
  addUsage(usage, r.body.usage);
  recordAnthropicUsage(lane.model, 'inference', level, usage);
  recordModelUse(r.body.model || lane.model, Number(r.body.usage?.output_tokens ?? 0));
  const output = textOf(r.body.content);
  const executedModel = r.body.model || lane.model;
  const refusal = refusalError(r.body);
  if (refusal) return { ...fail(refusal, latencyMs, output), executedModel };
  if (r.body.stop_reason === 'max_tokens') return { ...fail(`max_tokens ${DEFAULT_MAX_TOKENS} reached before the answer finished`, latencyMs, output), executedModel };
  if (r.body.stop_reason !== 'end_turn' && r.body.stop_reason !== 'stop_sequence') return { ...fail(`unexpected stop_reason ${String(r.body.stop_reason)}`, latencyMs, output), executedModel };
  if (!output) return { ...fail('response carried no text block', latencyMs), executedModel };
  if (json) {
    let parsed: unknown = null;
    try { parsed = JSON.parse(output); } catch { parsed = parseLooseJson(output); }
    if (parsed === null) return { ...fail('Failed to parse JSON response', latencyMs, output), executedModel };
    return { success: true, output, parsed, latencyMs, level, vendor: 'anthropic-api', executedModel };
  }
  return { success: true, output, latencyMs, level, vendor: 'anthropic-api', executedModel };
}

// Liveness-lane kill switch (20260908-universal-eval-reeval ISC-42). The deploy
// liveness runner sets this for every liveness row; a probe body that reaches
// inference from there is a contract violation and must fail loudly rather
// than spend. Key stripping cannot do this alone: the Anthropic lane runs the
// claude CLI on OAuth, which no env key controls.
export const INFERENCE_DISABLED_FLAG = 'LIFEOS_INFERENCE_DISABLED';
export function inferenceDisabledBy(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = env[INFERENCE_DISABLED_FLAG];
  return v && v !== '0' && v.toLowerCase() !== 'false' ? v : null;
}

export async function inference(options: InferenceOptions): Promise<InferenceResult> {
  const disabled = inferenceDisabledBy();
  if (disabled) {
    return { success: false, output: "", latencyMs: 0, level: normalizeLevel(options.level), error: `inference disabled in this context (${INFERENCE_DISABLED_FLAG}=${disabled}); a ${disabled} probe must be deterministic`, vendor: resolveVendor(options.vendor) };
  }
  const level = normalizeLevel(options.level);
  const vendor = resolveVendor(options.vendor, level);
  if (options.signal?.aborted) return { success: false, output: "", latencyMs: 0, level, error: ABORTED, vendor };
  // Pay-per-token by design: no fallback, least of all onto the subscription.
  if (vendor === 'anthropic-api') return anthropicApiAttempt({ ...options, level });
  if (vendor === 'openai') {
    const r = await openAiAttempt({ ...options, level });
    const fb = loadVendorConfig().fallback;
    if (r.success || options.signal?.aborted || options.allowVendorFallback === false || fb !== 'anthropic') return r;
    console.error(`[Inference] openai lane failed (${r.error}); falling back to anthropic`);
    const a = await inferenceAnthropic({ ...options, level });
    return { ...a, vendor: 'anthropic' };
  }
  const a = await inferenceAnthropic({ ...options, level });
  return { ...a, vendor: 'anthropic' };
}

async function inferenceAnthropic(options: InferenceOptions): Promise<InferenceResult> {
  const level = normalizeLevel(options.level);
  const config = LEVEL_CONFIG[level];
  // Validate once here; inferenceAttempt re-validation is then a no-op.
  const normalized: InferenceOptions = { ...options, level };
  const first = await inferenceAttempt(normalized);
  if (first.success || level !== 'max' || options.signal?.aborted) return first;
  // The fallback only buys resilience if it resolves to a DIFFERENT model than
  // the one that just failed. Compare at the TIER level (EFFORT_MODEL), not the
  // model string — `config.model` may be a pinned ID while
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
  // The retry uses `fallbackTimeoutMs` when the caller set one — the pattern
  // exists for hook callers with a hard wall-clock ceiling, where the max attempt
  // plus fallback must both fit inside it. Callers without a ceiling omit
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
  let vendor: string | undefined;
  let noFallback = false;
  const imagePaths: string[] = [];
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') {
      expectJson = true;
    } else if (args[i] === '--no-fallback') {
      noFallback = true;
    } else if (args[i] === '--vendor' && args[i + 1]) {
      vendor = args[i + 1];
      i++;
    } else if (args[i] === '--level' && args[i + 1]) {
      const requestedLevel = args[i + 1].toLowerCase();
      if ((VALID_LEVELS as readonly string[]).includes(requestedLevel)) {
        level = requestedLevel as InferenceLevel;
      } else {
        console.error(`Invalid level: ${args[i + 1]}. Use ${VALID_LEVELS.join(', ')}. (Legacy fast/standard/smart were removed 2026-06-10.)`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--image' && args[i + 1]) {
      imagePaths.push(args[i + 1]);
      i++;
    } else {
      positionalArgs.push(args[i]);
    }
  }

  if (positionalArgs.length < 2) {
    console.error('Usage: bun Inference.ts [--level low|medium|high|max] [--vendor openai|anthropic|anthropic-api] [--no-fallback] [--json] [--timeout <ms>] [--image <path>]... <system_prompt> <user_prompt>');
    process.exit(1);
  }

  const [systemPrompt, userPrompt] = positionalArgs;

  const result = await inference({
    systemPrompt,
    userPrompt,
    level,
    expectJson,
    timeout,
    vendor: vendor as InferenceVendor | undefined,
    ...(noFallback ? { allowVendorFallback: false } : {}),
    ...(imagePaths.length ? { imagePaths } : {}),
  });

  // Executed-model verification surfaced to the caller (stderr only — stdout stays
  // the clean answer). Proof of what RAN, so a Fable request that degraded to Opus
  // is never silently reported as Fable.
  if (result.executedModel) {
    console.error(`[model] vendor=${result.vendor ?? '?'} requested=${level} → executed=${result.executedModel}${result.modelDowngraded ? '  ⚠️ DOWNGRADED from requested tier' : ''}`);
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
  // An unexpected failure is a failed run: log why and exit non-zero, never 0 (S089).
  main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
