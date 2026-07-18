#!/usr/bin/env bun
/**
 * GrokAudit.ts — Grok cross-vendor audit voice (xAI lineage)
 *
 * Third training distribution next to Claude (the executor) and GPT-5.6 Sol
 * (Forge). Bundles ISA + artifacts and sends ONE stateless
 * chat-completion to the xAI OpenAI-compatible API (api.x.ai/v1, grok-4.5).
 *
 * READ-ONLY BY CONSTRUCTION (invariant, do not weaken): this tool reads files
 * to build the bundle, POSTs, parses, logs, prints. It never executes, applies,
 * or writes model output anywhere except the findings log and stdout. There is
 * no tool loop and no actuator — that absence IS the sandbox guarantee.
 *
 * Verdict JSON matches the Forge audit contract (CrossVendorAudit.ts) so the
 * DA consumes both identically. Findings append to grok-findings.jsonl —
 * earn-the-slot metric: ≥3 unique findings per 10 runs or the slot gets cut
 * (same bar Forge's audit slot holds).
 *
 * Runs at E4/E5 VERIFY (and after the Forge audit when that
 * fires). On Forge-BUILT slugs — where the Forge audit is skipped by the
 * builder≠auditor invariant — this is the sole cross-vendor voice.
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/GrokAudit.ts --slug <slug>
 *
 * Environment:
 *   GROK_API_KEY (or XAI_API_KEY) in ~/.claude/.env (required)
 *
 * Exit codes: 0 ok (incl. skipped-for-cause), 1 hard error, 2 bad args
 *
 * @author LifeOS System
 * @version 1.0.0
 */

import { readFile, appendFile, mkdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { claudeDir } from "./lifeos-root";

const HOME = homedir();
const LIFEOS_DIR = join(claudeDir(), "LIFEOS");
const WORK_DIR = join(LIFEOS_DIR, "MEMORY", "WORK");
const FINDINGS_LOG = join(LIFEOS_DIR, "MEMORY", "VERIFICATION", "grok-findings.jsonl");
const API_URL = "https://api.x.ai/v1/chat/completions";
const MODEL = "grok-4.5";

const BUNDLE_TOKEN_CAP = 80_000;
const CHARS_PER_TOKEN = 4;
const BUNDLE_CHAR_CAP = BUNDLE_TOKEN_CAP * CHARS_PER_TOKEN;
const ARTIFACT_PER_FILE_CAP = 30_000 * CHARS_PER_TOKEN;
const TIMEOUT_MS = 180_000;
// grok-4.5 list price: $2/M input, $6/M output (docs.x.ai, verified 2026-07-08)
const COST_PER_INPUT_TOKEN = 2 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 6 / 1_000_000;

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "criticality", "findings", "blind_spots_surfaced", "model_used", "tokens_used"],
  properties: {
    verdict: { type: "string", enum: ["pass", "concerns", "fail"] },
    criticality: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "isc_ref", "issue", "evidence"],
        properties: {
          severity: { type: "string", enum: ["critical", "warning", "info"] },
          isc_ref: { type: ["string", "null"] },
          issue: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
    blind_spots_surfaced: { type: "array", items: { type: "string" } },
    model_used: { type: "string" },
    tokens_used: { type: "integer" },
  },
} as const;

const AUDIT_PROMPT = `You are an independent cross-vendor auditor running on xAI Grok. The executor and reviewer are Anthropic Claude models, and (when it ran) a second auditor was OpenAI GPT-5.6 Sol. Your job is to find what THEY missed — blind spots shared across their training distributions: format conventions read as "correct", shared API-contract misreadings, completeness-claim bias ("good enough"), overconfidence on ambiguous criteria.

Audit this ISA against its ISC criteria. For each criterion:
 1. Is there concrete evidence of completion in the artifacts?
 2. Is the evidence consistent with the stated claim?
 3. Are there failure modes the other-family reviewers would share that are present here?

Signal over noise. If there is nothing to flag, say so explicitly with "findings": []. Do not manufacture concerns — your slot in this system is retained only if your findings are real.

Output ONLY this JSON, no markdown, no prose:

{"verdict":"pass|concerns|fail","criticality":"high|medium|low","findings":[{"severity":"critical|warning|info","isc_ref":"ISC-N or null","issue":"...","evidence":"..."}],"blind_spots_surfaced":["..."],"model_used":"grok-4.5","tokens_used":0}`;

interface Args { slug: string }

interface AuditResponse {
  verdict: "pass" | "concerns" | "fail" | "skipped" | "error";
  criticality?: "high" | "medium" | "low";
  findings?: Array<{ severity: string; isc_ref: string | null; issue: string; evidence: string }>;
  blind_spots_surfaced?: string[];
  model_used?: string;
  tokens_used?: number;
  cost_usd_est?: number;
  reason?: string;
}

function loadEnv(): Record<string, string> {
  const envPath = process.env.LIFEOS_CONFIG_DIR
    ? join(process.env.LIFEOS_CONFIG_DIR, ".env")
    : join(claudeDir(), ".env");
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* fall back to process.env */ }
  return env;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--slug") args.slug = argv[++i];
  }
  if (!args.slug) throw new Error("--slug required");
  return args as Args;
}

async function readISA(slug: string): Promise<string> {
  const dir = join(WORK_DIR, slug);
  const isaPath = join(dir, "ISA.md");
  const legacyPath = join(dir, "PRD.md");
  const path = existsSync(isaPath) ? isaPath : existsSync(legacyPath) ? legacyPath : null;
  if (!path) throw new Error(`ISA not found in ${dir} (tried ISA.md and legacy PRD.md)`);
  return await readFile(path, "utf8");
}

async function readArtifacts(isa: string): Promise<string> {
  const decisionsMatch = isa.match(/## Decisions\n([\s\S]*?)(?=\n## |\n---|\n*$)/);
  if (!decisionsMatch) return "(no ## Decisions section found)";
  const pathPattern = /`([~/][^\s`]+\.(?:ts|md|json|yaml|yml|tsx|jsx|js|txt))`/g;
  const paths = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pathPattern.exec(decisionsMatch[1]))) {
    let p = match[1];
    if (p.startsWith("~/")) p = join(HOME, p.slice(2));
    paths.add(resolve(p));
  }
  if (paths.size === 0) return "(no file references found in ## Decisions)";

  const chunks: string[] = [];
  let totalChars = 0;
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const stats = await stat(p);
    if (!stats.isFile()) continue;
    let content = await readFile(p, "utf8");
    if (content.length > ARTIFACT_PER_FILE_CAP) content = content.slice(0, ARTIFACT_PER_FILE_CAP) + "\n[TRUNCATED]";
    const block = `--- FILE: ${p} ---\n${content}\n`;
    if (totalChars + block.length > BUNDLE_CHAR_CAP / 2) break;
    chunks.push(block);
    totalChars += block.length;
  }
  return chunks.length > 0 ? chunks.join("\n") : "(no readable artifacts found)";
}

function extractGoalSection(isa: string): string {
  const fm = isa.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return "";
  const goal = fm[1].match(/^principal_stated_goal:\s*"((?:[^"\\]|\\.)*)"/m);
  if (!goal || !goal[1]) return "";
  return ["===== PRINCIPAL STATED GOAL =====", "(literal — evidence anchor, not optimization target)", goal[1], ""].join("\n");
}

function assembleBundle(isa: string, artifacts: string): string {
  const sections = (arts: string) => [
    extractGoalSection(isa),
    "===== ISA =====", isa, "",
    "===== OUTPUT ARTIFACTS =====", arts,
  ].filter((s) => s !== "").join("\n");
  let bundle = sections(artifacts);
  if (bundle.length > BUNDLE_CHAR_CAP) {
    const overshoot = bundle.length - BUNDLE_CHAR_CAP;
    bundle = sections(artifacts.slice(0, Math.max(0, artifacts.length - overshoot - 100)) + "\n[TRUNCATED - bundle size cap]");
  }
  return bundle;
}

async function invokeGrok(apiKey: string, bundle: string): Promise<{ parsed: AuditResponse; inputTokens: number; outputTokens: number }> {
  const messages = [
    { role: "system", content: AUDIT_PROMPT },
    { role: "user", content: bundle },
  ];
  // First attempt: schema-enforced structured output. Fallback: plain request,
  // prompt-guided JSON (some OpenAI-compatible endpoints reject json_schema).
  const attempts: Array<Record<string, unknown>> = [
    { model: MODEL, messages, response_format: { type: "json_schema", json_schema: { name: "audit_verdict", strict: true, schema: VERDICT_SCHEMA } } },
    { model: MODEL, messages },
  ];

  let lastErr = "";
  for (const body of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await res.json()) as any;
      if (!res.ok || data.error) {
        lastErr = typeof data.error === "string" ? data.error : data.error?.message || `HTTP ${res.status}`;
        continue; // try the next attempt shape
      }
      const text: string = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
      if (!jsonMatch) { lastErr = "no JSON in Grok output"; continue; }
      const parsed = JSON.parse(jsonMatch[0]) as AuditResponse;
      return {
        parsed,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      lastErr = (err as Error).name === "AbortError" ? `timeout after ${TIMEOUT_MS / 1000}s` : (err as Error).message;
    } finally {
      clearTimeout(timer);
    }
  }
  return { parsed: { verdict: "skipped", reason: `xAI API: ${lastErr}` }, inputTokens: 0, outputTokens: 0 };
}

function extractTier(isa: string): string {
  const m = isa.match(/^effort:\s*(\w+)/m);
  return m ? m[1] : "unknown";
}

async function appendFinding(slug: string, response: AuditResponse, tier: string, costUsd: number): Promise<void> {
  await mkdir(join(LIFEOS_DIR, "MEMORY", "VERIFICATION"), { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    slug,
    tier,
    grok_verdict: response.verdict,
    criticality: response.criticality ?? null,
    unique_findings_count: response.findings?.length ?? 0,
    tokens: response.tokens_used ?? 0,
    cost_usd: costUsd,
    skipped: response.verdict === "skipped",
    reason: response.reason ?? null,
  });
  await appendFile(FINDINGS_LOG, line + "\n", "utf8");
}

async function main() {
  let args: Args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    console.error(JSON.stringify({ verdict: "error", reason: (err as Error).message }));
    process.exit(2);
  }

  const env = loadEnv();
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY || env.GROK_API_KEY || env.XAI_API_KEY;
  if (!apiKey) {
    const resp: AuditResponse = { verdict: "skipped", reason: "GROK_API_KEY / XAI_API_KEY not set" };
    await appendFinding(args.slug, resp, "unknown", 0);
    console.log(JSON.stringify(resp));
    process.exit(0);
  }

  let isa: string;
  try {
    isa = await readISA(args.slug);
  } catch (err) {
    console.log(JSON.stringify({ verdict: "error", reason: (err as Error).message }));
    process.exit(1);
  }

  const tier = extractTier(isa);
  const artifacts = await readArtifacts(isa);
  const bundle = assembleBundle(isa, artifacts);

  const { parsed, inputTokens, outputTokens } = await invokeGrok(apiKey, bundle);
  const costUsd = +(inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN).toFixed(4);
  parsed.tokens_used = parsed.tokens_used || inputTokens + outputTokens;
  parsed.cost_usd_est = costUsd;
  if (!parsed.model_used) parsed.model_used = MODEL;

  await appendFinding(args.slug, parsed, tier, costUsd);
  console.log(JSON.stringify(parsed));
}

main().catch((err) => {
  console.error(JSON.stringify({ verdict: "error", reason: err.message }));
  process.exit(1);
});
