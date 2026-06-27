#!/usr/bin/env bun
/**
 * CrossVendorAudit.ts — Cato's audit tool
 *
 * Bundles ISA + artifacts + tool-activity tail + Advisor verdict, pipes to
 * codex exec (GPT-5.4 read-only), parses JSON response, appends to
 * MEMORY/VERIFICATION/cato-findings.jsonl, emits parsed JSON to stdout.
 *
 * Usage:
 *   bun CrossVendorAudit.ts --slug <slug> --advisor-verdict "<text>"
 *
 * Algorithm v3.27 Rule 2a. E4/E5 VERIFY phase only.
 */

import { spawn } from "node:child_process";
import { readFile, writeFile, readdir, appendFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { getPaiDir } from "./lib/runtime-paths";

const HOME = homedir();
const PAI_DIR = getPaiDir(import.meta.dir);
const WORK_DIR = join(PAI_DIR, "MEMORY", "WORK");
const FINDINGS_LOG = join(PAI_DIR, "MEMORY", "VERIFICATION", "cato-findings.jsonl");
const TOOL_ACTIVITY_LOG = join(PAI_DIR, "MEMORY", "OBSERVABILITY", "tool-activity.jsonl");
const CODEX_BIN = join(HOME, ".bun", "bin", "codex");

const BUNDLE_TOKEN_CAP = 80_000;
const CHARS_PER_TOKEN = 4; // rough estimate for bundle sizing
const BUNDLE_CHAR_CAP = BUNDLE_TOKEN_CAP * CHARS_PER_TOKEN;
const CODEX_TIMEOUT_MS = 120_000;
const TOOL_ACTIVITY_TAIL_LINES = 200;
const ARTIFACT_PER_FILE_CAP = 30_000 * CHARS_PER_TOKEN;

const AUDIT_PROMPT = `You are Cato, an independent cross-vendor auditor. The executor (Claude Sonnet) and reviewer (Claude Opus via the Advisor) have already signed off on this work. Your job is to find what THEY missed — specifically Anthropic-family blind spots they share (format conventions, API contract readings, RLHF preferences, constitutional biases).

Audit this ISA against its ISC criteria. For each criterion:
 1. Is there concrete evidence of completion in the artifacts?
 2. Is the evidence consistent with the stated claim?
 3. Are there failure modes the same-family reviewers would share that are present here?

Signal over noise. If the Advisor was right and there is nothing to flag, say so explicitly with "agrees_with_advisor": "yes" and "findings": []. Do not manufacture concerns. Your credibility depends on surfacing real Anthropic-family blind spots, not on inflating finding counts.

Output ONLY this JSON on one line, no markdown, no prose, no preamble:

{"verdict":"pass|concerns|fail","criticality":"high|medium|low","findings":[{"severity":"critical|warning|info","isc_ref":"ISC-N or null","issue":"...","evidence":"..."}],"blind_spots_surfaced":["..."],"agrees_with_advisor":"yes|no|partial","model_used":"gpt-5.4","tokens_used":0}`;

interface Args {
  slug: string;
  advisorVerdict: string;
}

interface CatoResponse {
  verdict: "pass" | "concerns" | "fail" | "skipped" | "error";
  criticality?: "high" | "medium" | "low";
  findings?: Array<{ severity: string; isc_ref: string | null; issue: string; evidence: string }>;
  blind_spots_surfaced?: string[];
  agrees_with_advisor?: "yes" | "no" | "partial";
  model_used?: string;
  tokens_used?: number;
  cost_usd_est?: number;
  reason?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--slug") args.slug = argv[++i];
    else if (argv[i] === "--advisor-verdict") args.advisorVerdict = argv[++i];
  }
  if (!args.slug) throw new Error("--slug required");
  if (!args.advisorVerdict) args.advisorVerdict = "(not provided)";
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

function assembleBundle(isa: string, artifacts: string, toolTail: string, advisorVerdict: string): string {
  let bundle = [
    "===== ISA =====",
    isa,
    "",
    "===== OUTPUT ARTIFACTS =====",
    artifacts,
    "",
    "===== TOOL ACTIVITY TAIL =====",
    toolTail,
    "",
    "===== ADVISOR VERDICT =====",
    advisorVerdict,
    "",
    "===== AUDIT INSTRUCTIONS =====",
    AUDIT_PROMPT,
  ].join("\n");

  // If over cap, drop tool-tail first, then trim artifacts.
  if (bundle.length > BUNDLE_CHAR_CAP) {
    bundle = [
      "===== ISA =====",
      isa,
      "",
      "===== OUTPUT ARTIFACTS =====",
      artifacts,
      "",
      "===== TOOL ACTIVITY TAIL =====",
      "(dropped — bundle size cap)",
      "",
      "===== ADVISOR VERDICT =====",
      advisorVerdict,
      "",
      "===== AUDIT INSTRUCTIONS =====",
      AUDIT_PROMPT,
    ].join("\n");
  }
  if (bundle.length > BUNDLE_CHAR_CAP) {
    const overshoot = bundle.length - BUNDLE_CHAR_CAP;
    const trimmed = artifacts.slice(0, Math.max(0, artifacts.length - overshoot - 100));
    bundle = [
      "===== ISA =====",
      isa,
      "",
      "===== OUTPUT ARTIFACTS (trimmed) =====",
      trimmed + "\n[TRUNCATED - bundle size cap]",
      "",
      "===== TOOL ACTIVITY TAIL =====",
      "(dropped — bundle size cap)",
      "",
      "===== ADVISOR VERDICT =====",
      advisorVerdict,
      "",
      "===== AUDIT INSTRUCTIONS =====",
      AUDIT_PROMPT,
    ].join("\n");
  }
  return bundle;
}

function invokeCodex(bundle: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolvePromise) => {
    const proc = spawn(
      CODEX_BIN,
      ["exec", "--sandbox", "read-only", "--model", "gpt-5.4", "-"],
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolvePromise({ stdout, stderr: stderr + "\n[TIMEOUT after 120s]", code: 124 });
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

function extractJSON(rawStdout: string): CatoResponse {
  // Codex CLI wraps output with session metadata. Find the JSON object.
  const jsonMatch = rawStdout.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
  if (!jsonMatch) {
    return { verdict: "skipped", reason: "no JSON in codex output" };
  }
  try {
    return JSON.parse(jsonMatch[0]) as CatoResponse;
  } catch (err) {
    return { verdict: "skipped", reason: `parse error: ${(err as Error).message}` };
  }
}

function estimateCost(tokens: number): number {
  // GPT-5 class rough: $0.015/1K combined. Conservative.
  return +(tokens * 0.000015).toFixed(4);
}

async function appendFinding(slug: string, advisorVerdict: string, response: CatoResponse, tier: string): Promise<void> {
  await mkdir(join(PAI_DIR, "MEMORY", "VERIFICATION"), { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    slug,
    tier,
    advisor_verdict: advisorVerdict.slice(0, 200),
    cato_verdict: response.verdict,
    criticality: response.criticality ?? null,
    unique_findings_count: response.findings?.length ?? 0,
    agrees_with_advisor: response.agrees_with_advisor ?? null,
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
    await appendFinding(args.slug, args.advisorVerdict, resp, "unknown");
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
  const bundle = assembleBundle(isa, artifacts, toolTail, args.advisorVerdict);

  const { stdout, stderr, code } = await invokeCodex(bundle);
  if (code === 124) {
    const resp = { verdict: "skipped" as const, reason: "codex timeout at 120s" };
    await appendFinding(args.slug, args.advisorVerdict, resp, tier);
    console.log(JSON.stringify(resp));
    return;
  }
  if (code !== 0) {
    const resp = { verdict: "skipped" as const, reason: `codex exit ${code}: ${stderr.slice(0, 200)}` };
    await appendFinding(args.slug, args.advisorVerdict, resp, tier);
    console.log(JSON.stringify(resp));
    return;
  }

  const parsed = extractJSON(stdout);
  if (parsed.tokens_used && !parsed.cost_usd_est) {
    parsed.cost_usd_est = estimateCost(parsed.tokens_used);
  }
  await appendFinding(args.slug, args.advisorVerdict, parsed, tier);
  console.log(JSON.stringify(parsed));
}

main().catch(async (err) => {
  console.error(JSON.stringify({ verdict: "error", reason: err.message }));
  process.exit(1);
});
