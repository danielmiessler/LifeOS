#!/usr/bin/env bun
/**
 * ContextAudit — read-only quality audit for constitutional context files.
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/ContextAudit.ts
 *   bun ~/.claude/LIFEOS/TOOLS/ContextAudit.ts --json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
import { CONTEXT_FRESHNESS_REGISTRY, parseFrontmatter, type ContextFile } from "./TelosFreshness";
import { currentModel } from "./models";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const CLAUDE_DIR = dirname(LIFEOS_DIR);
const AUDIT_PATH = join(
  LIFEOS_DIR,
  "MEMORY",
  "WORK",
  "20260503-230000_freshness-extends-to-constitutional-files",
  "AUDIT.md",
);

type Severity = "critical" | "warn" | "info";

interface Finding {
  severity: Severity;
  kind: string;
  message: string;
  line?: number;
}

interface FileAudit {
  slug: string;
  path: string;
  findings: Finding[];
}

interface SummaryRow {
  file: string;
  critical: number;
  warn: number;
  info: number;
}

interface AuditReport {
  generated_at: string;
  summary: SummaryRow[];
  files: FileAudit[];
}

interface BodyInfo {
  body: string;
  lines: string[];
  startLine: number;
}

function bodyInfo(content: string): BodyInfo {
  const parsed = parseFrontmatter(content);
  if (parsed.rest === content) {
    return { body: content, lines: content.split("\n"), startLine: 1 };
  }

  const frontmatterLines = content.slice(0, content.length - parsed.rest.length).split("\n").length - 1;
  return { body: parsed.rest, lines: parsed.rest.split("\n"), startLine: frontmatterLines + 1 };
}

function lineNumbersForPattern(lines: string[], startLine: number, pattern: RegExp, limit: number): number[] {
  const found: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      found.push(startLine + i);
      if (found.length >= limit) break;
    }
  }
  return found;
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function scanTbd(info: BodyInfo): Finding[] {
  const count = countMatches(info.body, /\bTBD\b/g);
  if (count === 0) return [];
  const lines = lineNumbersForPattern(info.lines, info.startLine, /\bTBD\b/, 5);
  return [{
    severity: "info",
    kind: "TBD",
    message: `${count} occurrences (lines ${lines.join(", ")})`,
    line: lines[0],
  }];
}

function substantiveText(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("<!--") && !line.startsWith(">"))
    .join(" ");
}

function scanEmptySections(entry: ContextFile, info: BodyInfo): Finding[] {
  if (entry.slug === "projects") return [];

  const findings: Finding[] = [];
  for (let i = 0; i < info.lines.length; i++) {
    const heading = info.lines[i].match(/^##\s+(.+?)\s*$/);
    if (!heading) continue;

    const sectionLines: string[] = [];
    for (let j = i + 1; j < Math.min(i + 21, info.lines.length); j++) {
      if (/^##\s+/.test(info.lines[j])) break;
      sectionLines.push(info.lines[j]);
    }

    if (substantiveText(sectionLines).length < 20) {
      findings.push({
        severity: "warn",
        kind: "empty-section",
        message: `## ${heading[1].trim()} has less than 20 chars of substantive content`,
        line: info.startLine + i,
      });
    }
  }
  return findings;
}

function sectionBody(lines: string[], headingName: string): string[] | null {
  const headingRe = new RegExp(`^##\\s+${headingName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  const start = lines.findIndex((line) => headingRe.test(line));
  if (start === -1) return null;

  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

function scanPrincipalTelos(info: BodyInfo): Finding[] {
  const findings: Finding[] = [];
  const headings = ["Missions", "Active Goals (2026)", "Problems Being Solved"];
  for (const heading of headings) {
    const body = sectionBody(info.lines, heading);
    if (body === null) continue;

    const hasBullets = body.some((line) => /^-\s+/.test(line));
    const hasSubstantive = substantiveText(body).length > 0;
    if (!hasBullets && !hasSubstantive) {
      const lineIndex = info.lines.findIndex((line) => line.trim() === `## ${heading}`);
      findings.push({
        severity: "critical",
        kind: "principal-telos-empty",
        message: `## ${heading} section is empty - generator bug (likely LEGACY_FILE_TO_SECTION case mismatch in GenerateTelosSummary.ts)`,
        line: lineIndex === -1 ? undefined : info.startLine + lineIndex,
      });
    }
  }
  return findings;
}

function scanProjectsBudget(info: BodyInfo): Finding[] {
  if (!info.body.includes("~45 lines max")) return [];
  const actual = info.lines.length;
  if (actual <= 45) return [];
  return [{
    severity: "warn",
    kind: "context-budget",
    message: `${actual} lines exceeds declared CONTEXT-BUDGET of ~45 lines`,
    line: info.startLine,
  }];
}

function scanSystemPromptModel(info: BodyInfo): Finding[] {
  // Single source of truth: LIFEOS/TOOLS/models.ts CURRENT.opus. No hardcoded ID —
  // bumping the registry on a model release fixes this check automatically.
  const latest = currentModel("opus");
  if (info.body.includes(latest)) return [];
  return [{
    severity: "info",
    kind: "model-drift",
    message: `latest model ID '${latest}' (from models.ts registry) not found - may have drifted; verify against current model family`,
  }];
}

function normalizeReference(raw: string): string | null {
  const value = raw.trim().replace(/^<|>$/g, "").split("#")[0];
  if (!value || /^https?:\/\//.test(value)) return null;
  if (/[*?[\]{}]/.test(value)) return null;

  if (value.startsWith("LIFEOS/")) return join(CLAUDE_DIR, value);
  if (value.startsWith("~/.claude/LIFEOS/")) return join(HOME, value.slice(2));
  if (value.startsWith(`${HOME}/.claude/LIFEOS/`)) return value;
  return null;
}

function scanCrossRefs(info: BodyInfo): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < info.lines.length; i++) {
    const line = info.lines[i];
    const refs: string[] = [];
    for (const match of line.matchAll(/\]\(([^)]+)\)/g)) {
      refs.push(match[1]);
    }
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      refs.push(match[1]);
    }

    for (const ref of refs) {
      const path = normalizeReference(ref);
      if (path === null) continue;
      const key = `${path}:${info.startLine + i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!existsSync(path)) {
        findings.push({
          severity: "warn",
          kind: "broken cross-ref",
          message: `${ref} (line ${info.startLine + i})`,
          line: info.startLine + i,
        });
      }
    }
  }

  return findings;
}

function scanPlaceholders(info: BodyInfo): Finding[] {
  const patterns: Array<{ label: string; re: RegExp }> = [
    { label: "<your-name>", re: /<your-name>/g },
    { label: "<TBD>", re: /<TBD>/g },
    { label: "<...>", re: /<\.\.\.>/g },
    { label: "(seeded during interview)", re: /\(seeded during interview\)/g },
  ];

  const findings: Finding[] = [];
  for (const pattern of patterns) {
    const count = countMatches(info.body, pattern.re);
    if (count === 0) continue;
    const linePattern = new RegExp(pattern.re.source);
    const lines = lineNumbersForPattern(info.lines, info.startLine, linePattern, 5);
    findings.push({
      severity: "info",
      kind: "placeholder",
      message: `${pattern.label}: ${count} occurrences (lines ${lines.join(", ")})`,
      line: lines[0],
    });
  }
  return findings;
}

function auditFile(entry: ContextFile): FileAudit {
  if (!existsSync(entry.path)) {
    return {
      slug: entry.slug,
      path: entry.path,
      findings: [{
        severity: "critical",
        kind: "missing-file",
        message: `file missing: ${entry.path}`,
      }],
    };
  }

  const content = readFileSync(entry.path, "utf-8");
  const info = bodyInfo(content);
  const findings = [
    ...scanTbd(info),
    ...scanEmptySections(entry, info),
    ...(entry.slug === "principal_telos" ? scanPrincipalTelos(info) : []),
    ...(entry.slug === "projects" ? scanProjectsBudget(info) : []),
    ...(entry.slug === "pai_system_prompt" ? scanSystemPromptModel(info) : []),
    ...scanCrossRefs(info),
    ...scanPlaceholders(info),
  ];

  return { slug: entry.slug, path: entry.path, findings };
}

function countSeverity(findings: Finding[], severity: Severity): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

function buildReport(): AuditReport {
  const files = CONTEXT_FRESHNESS_REGISTRY.map(auditFile);
  const summary = files.map((file) => ({
    file: basename(file.path),
    critical: countSeverity(file.findings, "critical"),
    warn: countSeverity(file.findings, "warn"),
    info: countSeverity(file.findings, "info"),
  }));

  const total = summary.reduce(
    (acc, row) => ({
      file: "**TOTAL**",
      critical: acc.critical + row.critical,
      warn: acc.warn + row.warn,
      info: acc.info + row.info,
    }),
    { file: "**TOTAL**", critical: 0, warn: 0, info: 0 },
  );
  summary.push(total);

  return { generated_at: new Date().toISOString(), summary, files };
}

function displayPath(path: string): string {
  return path.startsWith(HOME) ? path.replace(HOME, "~") : path;
}

function renderMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`# Context Audit - ${report.generated_at}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| file | critical | warn | info |");
  lines.push("|------|---------:|-----:|-----:|");
  for (const row of report.summary) {
    lines.push(`| ${row.file} | ${row.critical} | ${row.warn} | ${row.info} |`);
  }
  lines.push("");
  lines.push("## Per-file findings");

  for (const file of report.files) {
    lines.push("");
    lines.push(`### ${basename(file.path)}  (path: ${displayPath(file.path)})`);
    lines.push("");
    if (file.findings.length === 0) {
      lines.push("- No findings.");
      continue;
    }
    for (const finding of file.findings) {
      const line = finding.line ? ` (line ${finding.line})` : "";
      lines.push(`- **${finding.severity}** ${finding.kind}: ${finding.message}${line}`);
    }
  }

  return lines.join("\n") + "\n";
}

function main(): void {
  const report = buildReport();
  const hasCritical = report.summary.at(-1)?.critical ? report.summary.at(-1)!.critical > 0 : false;

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const markdown = renderMarkdown(report);
    const auditDir = dirname(AUDIT_PATH);
    if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
    writeFileSync(AUDIT_PATH, markdown);
    console.log(`Wrote ${AUDIT_PATH}`);
    console.log("");
    console.log(markdown.split("\n").slice(4, 14).join("\n"));
  }

  if (hasCritical) {
    console.error("Context audit found critical findings");
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
