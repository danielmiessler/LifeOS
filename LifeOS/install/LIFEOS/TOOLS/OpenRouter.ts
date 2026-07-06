#!/usr/bin/env bun
import { displayPath, getClaudeDir } from "./Paths";
/**
 * ============================================================================
 * OPENROUTER — frontier open-model access via the OpenRouter broker
 * ============================================================================
 *
 * PURPOSE:
 * OpenAI-compatible client for OpenRouter (openrouter.ai/api/v1) — one key,
 * the full open-model menu (GLM 5.x, Kimi K2.6, MiniMax, Qwen, Llama, …).
 * Sibling to Inference.ts (Anthropic). LifeOS reaches the capped GLM 5.2
 * route (z-ai/glm-5.2) through this tool; the former `Gene` agent persona was
 * retired 2026-07-02 — the tool + EgressClassGuard hook carry the capability.
 *
 * SECURITY — Tier-2 BROKER egress (the most opaque source in LifeOS):
 * OpenRouter is a US routing layer that forwards your prompt to a DOWNSTREAM
 * provider in a non-deterministic country. Per the LifeOS data-classification
 * doctrine this path is PUBLIC-data-only. Two controls are forced by default
 * here to harden it anyway:
 *   - provider.data_collection = "deny"  → only providers that don't train on / retain data
 *   - provider.allow_fallbacks per --pin → optionally pin to a known provider
 * Reads OPENROUTER_API_KEY from ~/.claude/.env. NO Anthropic credential path.
 *
 * USAGE:
 *   bun OpenRouter.ts [--level low|medium|high|max] [--json] [--timeout <ms>]
 *                     [--model <id>] [--temperature <t>] [--max-tokens <n>]
 *                     [--pin <provider>] [--allow-data-collection]
 *                     <system_prompt> <user_prompt>
 *   bun OpenRouter.ts --list-models [--grep <substr>]
 * ============================================================================
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** GLM 5.2 on OpenRouter — verified 2026-06-18 (resolves to z-ai/glm-5.2-*). */
const DEFAULT_MODEL = "z-ai/glm-5.2";

export type ORLevel = "low" | "medium" | "high" | "max";
const VALID_LEVELS: readonly ORLevel[] = ["low", "medium", "high", "max"] as const;

const LEVEL_CONFIG: Record<ORLevel, { temperature: number; defaultTimeout: number }> = {
  low: { temperature: 0.2, defaultTimeout: 30000 },
  medium: { temperature: 0.5, defaultTimeout: 60000 },
  high: { temperature: 0.7, defaultTimeout: 120000 },
  max: { temperature: 0.8, defaultTimeout: 180000 },
};
const DEFAULT_MAX_TOKENS = 8192;

export function normalizeLevel(level: string | undefined): ORLevel {
  if (!level) return "medium";
  if ((VALID_LEVELS as readonly string[]).includes(level)) return level as ORLevel;
  throw new Error(`[OpenRouter] unknown level '${level}' — use low | medium | high | max`);
}

export interface ORandOptions {
  systemPrompt: string;
  userPrompt: string;
  level?: ORLevel;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  expectJson?: boolean;
  timeout?: number;
  /** Pin to a single downstream provider (e.g. "Friendli"); disables fallbacks. */
  pin?: string;
  /** Default false: force providers that do NOT collect/retain data. */
  allowDataCollection?: boolean;
}

export interface ORResult {
  success: boolean;
  output: string;
  parsed?: unknown;
  error?: string;
  latencyMs: number;
  model: string;
  provider?: string;
  level: ORLevel;
}

function getApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

/** Build the OpenRouter `provider` routing object enforcing the data policy. */
function providerPolicy(opts: ORandOptions): Record<string, unknown> {
  const policy: Record<string, unknown> = {};
  // ZDR-ish hardening: only route to providers that don't collect/retain data.
  if (!opts.allowDataCollection) policy.data_collection = "deny";
  if (opts.pin) {
    policy.order = [opts.pin];
    policy.allow_fallbacks = false;
  }
  return policy;
}

export async function openrouter(options: ORandOptions): Promise<ORResult> {
  const level = normalizeLevel(options.level);
  const config = LEVEL_CONFIG[level];
  const model = options.model ?? DEFAULT_MODEL;
  const temperature = options.temperature ?? config.temperature;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const timeout = options.timeout ?? config.defaultTimeout;
  const startTime = Date.now();

  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, output: "", error: `OPENROUTER_API_KEY not set in environment (${displayPath(getClaudeDir())}/.env)`, latencyMs: 0, model, level };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Title": "LifeOS",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        stream: false,
        provider: providerPolicy(options),
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startTime;
    const bodyText = await res.text();
    if (!res.ok) {
      return { success: false, output: bodyText, error: `OpenRouter ${res.status} ${res.statusText}: ${bodyText.slice(0, 500)}`, latencyMs, model, level };
    }

    let envelope: unknown;
    try { envelope = JSON.parse(bodyText); }
    catch { return { success: false, output: bodyText, error: "Failed to parse OpenRouter JSON envelope", latencyMs, model, level }; }

    const env = envelope as { choices?: Array<{ message?: { content?: unknown } }>; provider?: string; model?: string; error?: unknown };
    if (env.error) {
      return { success: false, output: bodyText, error: `OpenRouter error: ${JSON.stringify(env.error).slice(0, 400)}`, latencyMs, model, level };
    }
    const content = env.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { success: false, output: bodyText, error: "OpenRouter envelope missing choices[0].message.content", latencyMs, model, level };
    }

    const output = content.trim();
    const provider = env.provider;
    const resolvedModel = env.model ?? model;

    if (options.expectJson) {
      const objectMatch = output.match(/\{[\s\S]*\}/);
      const arrayMatch = output.match(/\[[\s\S]*\]/);
      for (const candidate of [objectMatch?.[0], arrayMatch?.[0]]) {
        if (!candidate) continue;
        try { return { success: true, output, parsed: JSON.parse(candidate), latencyMs, model: resolvedModel, provider, level }; }
        catch { /* next */ }
      }
      return { success: false, output, error: "Failed to parse JSON response", latencyMs, model: resolvedModel, provider, level };
    }

    return { success: true, output, latencyMs, model: resolvedModel, provider, level };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const aborted = (err as Error).name === "AbortError";
    return { success: false, output: "", error: aborted ? `Timeout after ${timeout}ms` : (err as Error).message, latencyMs, model, level };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function listModels(grep?: string): Promise<{ success: boolean; models?: string[]; error?: string }> {
  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/models`);
    const bodyText = await res.text();
    if (!res.ok) return { success: false, error: `OpenRouter ${res.status}: ${bodyText.slice(0, 300)}` };
    const data = JSON.parse(bodyText) as { data?: Array<{ id?: string }> };
    let models = (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
    if (grep) models = models.filter((id) => id.toLowerCase().includes(grep.toLowerCase()));
    return { success: true, models: models.sort() };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  let expectJson = false, listOnly = false;
  let timeout: number | undefined, temperature: number | undefined, maxTokens: number | undefined;
  let level: ORLevel = "medium";
  let model: string | undefined, pin: string | undefined, grep: string | undefined;
  let allowDataCollection = false;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") expectJson = true;
    else if (a === "--list-models") listOnly = true;
    else if (a === "--allow-data-collection") allowDataCollection = true;
    else if (a === "--level" && args[i + 1]) level = normalizeLevel(args[++i].toLowerCase());
    else if (a === "--model" && args[i + 1]) model = args[++i];
    else if (a === "--pin" && args[i + 1]) pin = args[++i];
    else if (a === "--grep" && args[i + 1]) grep = args[++i];
    else if (a === "--temperature" && args[i + 1]) temperature = parseFloat(args[++i]);
    else if (a === "--max-tokens" && args[i + 1]) maxTokens = parseInt(args[++i], 10);
    else if (a === "--timeout" && args[i + 1]) timeout = parseInt(args[++i], 10);
    else positional.push(a);
  }

  if (listOnly) {
    const res = await listModels(grep);
    if (res.success) { console.log((res.models ?? []).join("\n")); return; }
    console.error(`Error: ${res.error}`); process.exit(1);
  }

  if (positional.length < 2) {
    console.error("Usage: bun OpenRouter.ts [--level low|medium|high|max] [--json] [--model <id>] [--pin <provider>] [--timeout <ms>] <system_prompt> <user_prompt>");
    console.error("       bun OpenRouter.ts --list-models [--grep <substr>]");
    process.exit(1);
  }

  const [systemPrompt, userPrompt] = positional;
  const result = await openrouter({ systemPrompt, userPrompt, level, model, temperature, maxTokens, expectJson, timeout, pin, allowDataCollection });
  if (result.success) {
    if (expectJson && result.parsed !== undefined) console.log(JSON.stringify(result.parsed));
    else console.log(result.output);
  } else {
    console.error(`Error: ${result.error}`); process.exit(1);
  }
}

if (import.meta.main) main().catch((err) => { console.error(err); process.exit(1); });
