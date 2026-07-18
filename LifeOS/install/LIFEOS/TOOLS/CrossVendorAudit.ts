#!/usr/bin/env bun
/**
 * CrossVendorAudit.ts — Forge audit-mode tool (cross-vendor audit; formerly Cato)
 *
 * Bundles ISA + artifacts + tool-activity tail, pipes to
 * codex exec (gpt-5.6-sol, read-only, --ephemeral), with the verdict JSON
 * schema-enforced via codex --output-schema (strict: additionalProperties:false,
 * all props required). Runs a `codex doctor --json` preflight. Parses the JSON
 * response, appends to MEMORY/VERIFICATION/cato-findings.jsonl (filename kept for
 * track-record continuity), emits parsed JSON to stdout.
 *
 * Usage:
 *   bun CrossVendorAudit.ts --slug <slug>
 *
 * Algorithm v3.27 Rule 2a. E4/E5 VERIFY phase only.
 */

import { spawn } from "node:child_process";
import { readFile, writeFile, appendFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { claudeDir } from "./lifeos-root";

const HOME = homedir();
const LIFEOS_DIR = join(claudeDir(), "LIFEOS");
const WORK_DIR = join(LIFEOS_DIR, "MEMORY", "WORK");
const FINDINGS_LOG = join(LIFEOS_DIR, "MEMORY", "VERIFICATION", "cato-findings.jsonl");
const TOOL_ACTIVITY_LOG = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY", "tool-activity.jsonl");
const CODEX_BIN = join(HOME, ".bun", "bin", "codex");

const BUNDLE_TOKEN_CAP = 80_000;
const CHARS_PER_TOKEN = 4; // rough estimate for bundle sizing
const BUNDLE_CHAR_CAP = BUNDLE_TOKEN_CAP * CHARS_PER_TOKEN;
const CODEX_TIMEOUT_MS = 300_000;
const TOOL_ACTIVITY_TAIL_LINES = 200;
const ARTIFACT_PER_FILE_CAP = 30_000 * CHARS_PER_TOKEN;
const VERDICT_SCHEMA_PATH = join(LIFEOS_DIR, "MEMORY", "VERIFICATION", "audit-verdict.schema.json");

// codex --output-schema enforces OpenAI strict structured-output rules: EVERY
// object needs "additionalProperties": false AND every property in "required"
// (optional fields become nullable via a type-union, never omitted). A permissive
// schema returns HTTP 400 invalid_json_schema and the audit silently skips — so
// this is deliberately strict. Mirrors the AuditResponse shape the model emits.
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

const AUDIT_PROMPT = `You are an independent cross-vendor auditor. The Claude-family executor and reviewer have already signed off on this work. Your job is to find what THEY missed — specifically Anthropic-family blind spots they share (format conventions, API contract readings, RLHF preferences, constitutional biases).

Audit this ISA against its ISC criteria. For each criterion:
 1. Is there concrete evidence of completion in the artifacts?
 2. Is the evidence consistent with the stated claim?
 3. Are there failure modes the same-family reviewers would share that are present here?

Signal over noise. If there is nothing to flag, say so explicitly with "findings": []. Do not manufacture concerns. Your credibility depends on surfacing real Anthropic-family blind spots, not on inflating finding counts.

Output ONLY this JSON on one line, no markdown, no prose, no preamble:

{"verdict":"pass|concerns|fail","criticality":"high|medium|low","findings":[{"severity":"critical|warning|info","isc_ref":"ISC-N or null","issue":"...","evidence":"..."}],"blind_spots_surfaced":["..."],"model_used":"gpt-5.6-sol","tokens_used":0}`;

interface Args {
  slug: string;
}

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

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--slug") args.slug = argv[++i];
  }
  if (!args.slug) throw new Error("--slug required");
  return args as Args;
}

async function readISA(slug: string): Promise<string> {
  // Read order: ISA.md (canonical, v4.1.0+) → PRD.md (legacy alias, retired at v4.2.0).
  const dir = join(WORK_DIR, slug);
  const isaPath = join(dir, "ISA.md");
  const legacyPath = join(dir, "PRD.md");
  const path = existsSync(isaPath) ? isaPath : existsSync(legacyPath) ? legacyPath : null;
  if (!path) throw new Error(`ISA not found in ${dir} (tried ISA.md and legacy PRD.md)`);
  return await readFile(path, "utf8");
}

async function readArtifacts(slug: string, isa: string): Promise<string> {
  // Extract file paths referenced in ISA ## Decisions section.
  const decisionsMatch = isa.match(/## Decisions\n([\s\S]*?)(?=\n## |\n---|\n*$)/);
  if (!decisionsMatch) return "(no ## Decisions section found)";

  const decisions = decisionsMatch[1];
  const pathPattern = /`([~/][^\s`]+\.(?:ts|md|json|yaml|yml|tsx|jsx|js|txt))`/g;
  const paths = new Set<string>();
  let match;
  while ((match = pathPattern.exec(decisions))) {
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
    if (content.length > ARTIFACT_PER_FILE_CAP) {
      content = content.slice(0, ARTIFACT_PER_FILE_CAP) + "\n[TRUNCATED]";
    }
    const block = `--- FILE: ${p} ---\n${content}\n`;
    if (totalChars + block.length > BUNDLE_CHAR_CAP / 2) break; // reserve half for other sections
    chunks.push(block);
    totalChars += block.length;
  }
  return chunks.length > 0 ? chunks.join("\n") : "(no readable artifacts found)";
}

async function readToolActivityTail(slug: string): Promise<string> {
  if (!existsSync(TOOL_ACTIVITY_LOG)) return "(tool-activity.jsonl not found)";
  const content = await readFile(TOOL_ACTIVITY_LOG, "utf8");
  const lines = content.trim().split("\n");
  const recent = lines.slice(-500); // look at last 500 lines total
  const filtered = recent.filter((l) => l.includes(slug)).slice(-TOOL_ACTIVITY_TAIL_LINES);
  return filtered.length > 0 ? filtered.join("\n") : "(no tool-activity lines for this slug)";
}

// v6.6.0: extract principal_stated_goal from ISA frontmatter as a leading section
// in every bundle path, so Cato reads the literal anchor before the ISA, artifacts,
// or tool tail. Returns formatted section or empty string when absent.
function extractGoalSection(isa: string): string {
  const frontmatterMatch = isa.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return "";
  const goalLine = frontmatterMatch[1].match(/^principal_stated_goal:\s*"((?:[^"\\]|\\.)*)"/m);
  if (!goalLine || !goalLine[1]) return "";
  return [
    "===== PRINCIPAL STATED GOAL =====",
    "(v6.4.0 literal — evidence anchor, not optimization target. Audit derived content against this.)",
    goalLine[1],
    "",
  ].join("\n");
}

function assembleBundle(isa: string, artifacts: string, toolTail: string): string {
  const goalSection = extractGoalSection(isa);
  let bundle = [
    goalSection,
    "===== ISA =====",
    isa,
    "",
    "===== OUTPUT ARTIFACTS =====",
    artifacts,
    "",
    "===== TOOL ACTIVITY TAIL =====",
    toolTail,
    "",
    "===== AUDIT INSTRUCTIONS =====",
    AUDIT_PROMPT,
  ].filter(s => s !== "").join("\n");

  // If over cap, drop tool-tail first, then trim artifacts.
  if (bundle.length > BUNDLE_CHAR_CAP) {
    bundle = [
      goalSection,
      "===== ISA =====",
      isa,
      "",
      "===== OUTPUT ARTIFACTS =====",
      artifacts,
      "",
      "===== TOOL ACTIVITY TAIL =====",
      "(dropped — bundle size cap)",
      "",
      "===== AUDIT INSTRUCTIONS =====",
      AUDIT_PROMPT,
    ].filter(s => s !== "").join("\n");
  }
  if (bundle.length > BUNDLE_CHAR_CAP) {
    const overshoot = bundle.length - BUNDLE_CHAR_CAP;
    const trimmed = artifacts.slice(0, Math.max(0, artifacts.length - overshoot - 100));
    bundle = [
      goalSection,
      "===== ISA =====",
      isa,
      "",
      "===== OUTPUT ARTIFACTS (trimmed) =====",
      trimmed + "\n[TRUNCATED - bundle size cap]",
      "",
      "===== TOOL ACTIVITY TAIL =====",
      "(dropped — bundle size cap)",
      "",
      "===== AUDIT INSTRUCTIONS =====",
      AUDIT_PROMPT,
    ].filter(s => s !== "").join("\n");
  }
  return bundle;
}

function invokeCodex(bundle: string, schemaPath: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolvePromise) => {
    // Env scrub: codex's auth precedence puts OPENAI_API_KEY / OPENAI_BASE_URL
    // above ~/.codex/auth.json and config.toml, so a stray key in the parent
    // shell silently flips the audit from the user's configured codex auth
    // (e.g. ChatGPT subscription) to direct API billing. Only scrub when a
    // configured auth file exists — users who authenticate codex solely via
    // OPENAI_API_KEY keep working unchanged.
    const env = { ...process.env };
    if (existsSync(join(HOME, ".codex", "auth.json"))) {
      delete env.OPENAI_API_KEY;
      delete env.OPENAI_BASE_URL;
    }
    const proc = spawn(
      CODEX_BIN,
      ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--output-schema", schemaPath, "--model", "gpt-5.6-sol", "-"],
      { stdio: ["pipe", "pipe", "pipe"], env }
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolvePromise({ stdout, stderr: stderr + `\n[TIMEOUT after ${CODEX_TIMEOUT_MS / 1000}s]`, code: 124 });
    }, CODEX_TIMEOUT_MS);

    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ stdout, stderr, code });
    });
    proc.stdin.write(bundle);
    proc.stdin.end();
  });
}

function extractJSON(rawStdout: string): AuditResponse {
  // Codex CLI wraps output with session metadata. Find the JSON object.
  const jsonMatch = rawStdout.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
  if (!jsonMatch) {
    return { verdict: "skipped", reason: "no JSON in codex output" };
  }
  try {
    return JSON.parse(jsonMatch[0]) as AuditResponse;
  } catch (err) {
    return { verdict: "skipped", reason: `parse error: ${(err as Error).message}` };
  }
}

function estimateCost(tokens: number): number {
  // GPT-5 class rough: $0.015/1K combined. Conservative.
  return +(tokens * 0.000015).toFixed(4);
}

async function appendFinding(slug: string, response: AuditResponse, tier: string): Promise<void> {
  await mkdir(join(LIFEOS_DIR, "MEMORY", "VERIFICATION"), { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    slug,
    tier,
    cato_verdict: response.verdict,
    criticality: response.criticality ?? null,
    unique_findings_count: response.findings?.length ?? 0,
    tokens: response.tokens_used ?? 0,
    cost_usd: response.cost_usd_est ?? estimateCost(response.tokens_used ?? 0),
    skipped: response.verdict === "skipped",
    reason: response.reason ?? null,
  });
  await appendFile(FINDINGS_LOG, line + "\n", "utf8");
}

function extractTier(isa: string): string {
  const m = isa.match(/^effort:\s*(\w+)/m);
  return m ? m[1] : "unknown";
}

async function writeVerdictSchema(): Promise<string> {
  await mkdir(join(LIFEOS_DIR, "MEMORY", "VERIFICATION"), { recursive: true });
  await writeFile(VERDICT_SCHEMA_PATH, JSON.stringify(VERDICT_SCHEMA), "utf8");
  return VERDICT_SCHEMA_PATH;
}

// codex 0.137+ preflight. `codex doctor --json` reports overallStatus across the
// install/config/auth/runtime. Fail-OPEN by design: only an explicit overallStatus
// "fail" blocks the audit (a genuinely broken runtime). If doctor itself can't run
// or parse, proceed — the preflight must never become a new failure source. 30s cap.
function codexDoctor(): Promise<{ healthy: boolean; summary: string }> {
  return new Promise((resolvePromise) => {
    const proc = spawn(CODEX_BIN, ["doctor", "--json"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => { proc.kill("SIGTERM"); resolvePromise({ healthy: true, summary: "doctor timed out (proceeding)" }); }, 30_000);
    proc.stdout.on("data", (c) => (out += c.toString()));
    proc.on("close", () => {
      clearTimeout(timer);
      try {
        const status = (JSON.parse(out) as { overallStatus?: string }).overallStatus ?? "unknown";
        resolvePromise({ healthy: status !== "fail", summary: `overallStatus=${status}` });
      } catch {
        resolvePromise({ healthy: true, summary: "doctor unparseable (proceeding)" });
      }
    });
    proc.on("error", () => { clearTimeout(timer); resolvePromise({ healthy: true, summary: "doctor unavailable (proceeding)" }); });
  });
}

async function main() {
  let args: Args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    console.error(JSON.stringify({ verdict: "error", reason: (err as Error).message }));
    process.exit(2);
  }

  if (!existsSync(CODEX_BIN)) {
    const resp = { verdict: "skipped" as const, reason: "codex CLI not installed" };
    await appendFinding(args.slug, resp, "unknown");
    console.log(JSON.stringify(resp));
    process.exit(0);
  }

  const doctor = await codexDoctor();
  if (!doctor.healthy) {
    const resp = { verdict: "skipped" as const, reason: `codex doctor: ${doctor.summary}` };
    await appendFinding(args.slug, resp, "unknown");
    console.log(JSON.stringify(resp));
    process.exit(0);
  }

  let isa: string;
  try {
    isa = await readISA(args.slug);
  } catch (err) {
    const resp = { verdict: "error" as const, reason: (err as Error).message };
    console.log(JSON.stringify(resp));
    process.exit(1);
  }

  const tier = extractTier(isa);
  const [artifacts, toolTail] = await Promise.all([
    readArtifacts(args.slug, isa),
    readToolActivityTail(args.slug),
  ]);
  const bundle = assembleBundle(isa, artifacts, toolTail);

  const schemaPath = await writeVerdictSchema();
  const { stdout, stderr, code } = await invokeCodex(bundle, schemaPath);
  if (code === 124) {
    const resp = { verdict: "skipped" as const, reason: "codex timeout at 120s" };
    await appendFinding(args.slug, resp, tier);
    console.log(JSON.stringify(resp));
    return;
  }
  if (code !== 0) {
    const resp = { verdict: "skipped" as const, reason: `codex exit ${code}: ${stderr.slice(0, 200)}` };
    await appendFinding(args.slug, resp, tier);
    console.log(JSON.stringify(resp));
    return;
  }

  const parsed = extractJSON(stdout);
  if (parsed.tokens_used && !parsed.cost_usd_est) {
    parsed.cost_usd_est = estimateCost(parsed.tokens_used);
  }
  await appendFinding(args.slug, parsed, tier);
  console.log(JSON.stringify(parsed));
}

main().catch(async (err) => {
  console.error(JSON.stringify({ verdict: "error", reason: err.message }));
  process.exit(1);
});
