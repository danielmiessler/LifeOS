#!/usr/bin/env bun
/**
 * ArchDecisionHarvest — Harvest architecture decisions from ISA files into LifeosSystemArchitecture.md
 *
 * Commands:
 *   --selftest      Run fixture-backed self-test
 *   --help          Show usage
 *
 * Examples:
 *   bun ArchDecisionHarvest.ts
 *   bun ArchDecisionHarvest.ts --keywords
 *   bun ArchDecisionHarvest.ts --apply --today 2026-06-14
 *   bun ArchDecisionHarvest.ts --selftest
 */

import { parseArgs } from "util";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


// ============================================================================
// Configuration
// ============================================================================

const HOME = process.env.HOME || os.homedir();
const LIFEOS_DIR = process.env.LIFEOS_DIR || path.join(HOME, ".claude", "LIFEOS");
const DEFAULT_WORK_DIR = path.join(LIFEOS_DIR, "MEMORY", "WORK");
const DEFAULT_ARCH_DOC = path.join(LIFEOS_DIR, "DOCUMENTATION", "LifeosSystemArchitecture.md");
const ARCH_DECISIONS_HEADING = "## Architecture Decisions";
const KEYWORD_PATTERN = /state management|JSONL|event-sourc|hook pipeline|schema|protocol|convention|architecture/i;

// This tool intentionally uses synchronous fs operations only; there are no
// async operations that need timeouts.

// ============================================================================
// Types
// ============================================================================

interface CliOptions {
  apply: boolean;
  includeIncomplete: boolean;
  keywords: boolean;
  today?: string;
  docPath: string;
  workDir: string;
}

interface IsaFrontmatter {
  phase?: string;
  updated?: string;
  started?: string;
}

interface IsaDecision {
  slug: string;
  number: number;
  text: string;
  decided: string;
}

interface HarvestResult {
  count: number;
  blocks: string;
  nextContent: string;
}

// ============================================================================
// File discovery
// ============================================================================

function listIsaFiles(workDir: string): string[] {
  if (!fs.existsSync(workDir)) {
    return [];
  }

  const stat = fs.statSync(workDir);
  if (!stat.isDirectory()) {
    throw new Error(`Work scan root is not a directory: ${workDir}`);
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(workDir).sort()) {
    const candidate = path.join(workDir, entry, "ISA.md");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      files.push(candidate);
    } else {
      // Non-ISA work entries are outside this tool's scan contract.
    }
  }
  return files;
}

// ============================================================================
// ISA parsing
// ============================================================================

function parseFrontmatter(content: string): IsaFrontmatter {
  if (!content.startsWith("---\n")) {
    return {};
  }

  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    return {};
  }

  const frontmatter = content.slice(4, end);
  const result: IsaFrontmatter = {};
  for (const line of frontmatter.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.+?)\s*$/);
    if (match) {
      const key = match[1];
      const value = match[2].replace(/^["']|["']$/g, "").trim();
      if (key === "phase") {
        result.phase = value.toLowerCase();
      } else if (key === "updated") {
        result.updated = normalizeDate(value);
      } else if (key === "started") {
        result.started = normalizeDate(value);
      } else {
        // Other frontmatter keys are not trusted by this tool.
      }
    } else {
      // YAML-ish lines outside the simple key/value shape are ignored.
    }
  }

  return result;
}

function normalizeDate(value: string): string | undefined {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  return undefined;
}

function resolveDecisionDate(frontmatter: IsaFrontmatter, today?: string): string {
  if (frontmatter.updated) {
    return frontmatter.updated;
  }
  if (frontmatter.started) {
    return frontmatter.started;
  }
  if (today && normalizeDate(today)) {
    return normalizeDate(today)!;
  }
  return "unknown (ISA missing updated/started)";
}

function isCompleteIsa(frontmatter: IsaFrontmatter): boolean {
  return frontmatter.phase?.trim().toLowerCase() === "complete";
}

function extractDecisionsSection(content: string): string | null {
  const heading = content.match(/^## Decisions\s*$/m);
  if (!heading || heading.index === undefined) {
    return null;
  }

  const bodyStart = content.indexOf("\n", heading.index) + 1;
  if (bodyStart === 0) {
    return "";
  }

  const nextHeading = content.slice(bodyStart).search(/^##\s+/m);
  if (nextHeading === -1) {
    return content.slice(bodyStart);
  }
  return content.slice(bodyStart, bodyStart + nextHeading);
}

function parseDecisionBullets(section: string, slug: string, decided: string): IsaDecision[] {
  const decisions: IsaDecision[] = [];
  let current: { number: number; parts: string[] } | null = null;

  const flush = (): void => {
    if (current) {
      const text = normalizeWhitespace(current.parts.join(" "));
      if (text) {
        decisions.push({ slug, number: current.number, text, decided });
      } else {
        // Empty D bullets are malformed and are ignored with no output.
      }
      current = null;
    } else {
      // No active bullet exists, so there is nothing to flush.
    }
  };

  for (const line of section.split("\n")) {
    const bullet = line.match(/^-\s+D-(\d+):\s*(.*)$/);
    if (bullet) {
      flush();
      current = { number: Number(bullet[1]), parts: [bullet[2].trim()] };
      continue;
    }

    if (!current) {
      // Non-decision text inside ## Decisions is context, not harvest input.
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }

    if (/^-\s+/.test(line)) {
      flush();
      continue;
    }

    current.parts.push(line.trim());
  }

  flush();
  return decisions;
}

function readIsaDecisions(isaPath: string, options: Pick<CliOptions, "includeIncomplete" | "today">): IsaDecision[] {
  const slug = path.basename(path.dirname(isaPath));
  const content = fs.readFileSync(isaPath, "utf-8");
  const frontmatter = parseFrontmatter(content);
  if (!options.includeIncomplete && !isCompleteIsa(frontmatter)) {
    // In-progress ISAs can contain conjectures that later get refuted.
    return [];
  }
  const decided = resolveDecisionDate(frontmatter, options.today);
  const section = extractDecisionsSection(content);
  if (section === null) {
    return [];
  }
  return parseDecisionBullets(section, slug, decided);
}

// ============================================================================
// Decision selection and rendering
// ============================================================================

function qualifiesDecision(text: string, includeKeywords: boolean): boolean {
  if (/^\s*\[arch\]/i.test(text)) {
    return true;
  }
  if (includeKeywords && KEYWORD_PATTERN.test(text)) {
    return true;
  }
  return false;
}

function stripArchTag(text: string): string {
  return normalizeWhitespace(text.replace(/\[arch\]/ig, ""));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function deriveTitle(text: string): string {
  const words = stripArchTag(text).split(/\s+/).filter(Boolean).slice(0, 8);
  const title = words.join(" ").replace(/[.,;:!?]+$/g, "");
  if (title) {
    return title;
  }
  return "Architecture decision";
}

function deriveWhy(text: string): string {
  const normalized = stripArchTag(text);
  const emDash = normalized.match(/\s—\s(.+)$/);
  if (emDash) {
    return normalizeWhitespace(emDash[1]);
  }

  const doubleDash = normalized.match(/\s--\s(.+)$/);
  if (doubleDash) {
    return normalizeWhitespace(doubleDash[1]);
  }

  const spacedDash = normalized.match(/\s-\s(.+)$/);
  if (spacedDash) {
    return normalizeWhitespace(spacedDash[1]);
  }

  const because = normalized.match(/\bbecause\b\s+(.+)$/i);
  if (because) {
    return `because ${normalizeWhitespace(because[1])}`;
  }

  return "(see source ISA)";
}

function deriveReplacement(text: string): string {
  const normalized = stripArchTag(text);
  const replaces = normalized.match(/\breplaces?\b\s+.+/i);
  if (replaces) {
    return truncateReplacementNote(replaces[0]);
  }

  const wasNow = normalized.match(/\bwas\s+.+?\s+now\s+.+/i);
  if (wasNow) {
    return truncateReplacementNote(wasNow[0]);
  }

  const arrow = normalized.match(/.{1,80}?→.{1,80}?/);
  if (arrow) {
    return truncateReplacementNote(arrow[0]);
  }

  return "new";
}

function truncateReplacementNote(note: string): string {
  const normalized = normalizeWhitespace(note);
  const boundary = normalized.search(/\s+because\b|\s+—\s|\s+--\s|\s+-\s|[.;]/i);
  if (boundary === -1) {
    return normalized;
  }
  return normalizeWhitespace(normalized.slice(0, boundary));
}

function renderArchitectureDecision(decision: IsaDecision, sequence: number): string {
  const marker = `<!-- ad-src: ${decision.slug}#D-${decision.number} -->`;
  const decisionText = stripArchTag(decision.text);
  const lines = [
    `### AD-${sequence}: ${deriveTitle(decision.text)}`,
    "",
    `- **Decided:** ${decision.decided}`,
    `- **Decision:** ${decisionText}`,
    `- **Why:** ${deriveWhy(decision.text)}`,
    `- **Replaced:** ${deriveReplacement(decision.text)}`,
    `- **Source:** harvested from ${decision.slug}`,
    marker,
  ];

  return lines.join("\n");
}

// ============================================================================
// Architecture document editing
// ============================================================================

function findArchitectureDecisionInsertionPoint(content: string): number {
  const headingPattern = new RegExp(`^${escapeRegExp(ARCH_DECISIONS_HEADING)}\\s*$`, "m");
  const heading = content.match(headingPattern);
  if (!heading || heading.index === undefined) {
    throw new Error(`Missing "${ARCH_DECISIONS_HEADING}" section in target doc. Add it first; no changes were written.`);
  }

  const afterHeadingLine = content.indexOf("\n", heading.index);
  const scanStart = afterHeadingLine === -1 ? content.length : afterHeadingLine + 1;
  const nextTopLevel = content.slice(scanStart).search(/^##\s+/m);
  if (nextTopLevel === -1) {
    return content.length;
  }
  return scanStart + nextTopLevel;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highestExistingSequence(content: string): number {
  let highest = 0;
  for (const match of content.matchAll(/^### AD-(\d+):/gm)) {
    const sequence = Number(match[1]);
    if (sequence > highest) {
      highest = sequence;
    } else {
      // Lower or duplicate AD numbers do not change the next sequence.
    }
  }
  return highest;
}

function insertBlocks(content: string, insertAt: number, blocks: string): string {
  if (!blocks) {
    return content;
  }

  const before = content.slice(0, insertAt).replace(/\s*$/g, "\n\n");
  const after = content.slice(insertAt).replace(/^\s*/g, "");
  if (after) {
    return `${before}${blocks}\n\n${after}`;
  }
  return `${before}${blocks}\n`;
}

// ============================================================================
// Harvest
// ============================================================================

function collectSelectedDecisions(options: CliOptions): IsaDecision[] {
  const decisions: IsaDecision[] = [];
  for (const isaPath of listIsaFiles(options.workDir)) {
    try {
      const parsed = readIsaDecisions(isaPath, options);
      for (const decision of parsed) {
        if (qualifiesDecision(decision.text, options.keywords)) {
          decisions.push(decision);
        } else {
          // Precision-first default: untagged/non-keyword decisions stay in the ISA.
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read ISA decisions from ${isaPath}: ${message}`);
    }
  }
  return decisions;
}

function buildHarvest(options: CliOptions): HarvestResult {
  if (!fs.existsSync(options.docPath)) {
    throw new Error(`Target architecture doc not found: ${options.docPath}`);
  }

  const content = fs.readFileSync(options.docPath, "utf-8");
  const insertAt = findArchitectureDecisionInsertionPoint(content);
  let sequence = highestExistingSequence(content) + 1;
  const blocks: string[] = [];

  for (const decision of collectSelectedDecisions(options)) {
    const marker = `<!-- ad-src: ${decision.slug}#D-${decision.number} -->`;
    // Source edits do not re-sync because this marker dedupes insert-once by slug#D-n, not content.
    if (content.includes(marker)) {
      continue;
    }

    blocks.push(renderArchitectureDecision(decision, sequence));
    sequence += 1;
  }

  const joinedBlocks = blocks.join("\n\n");
  return {
    count: blocks.length,
    blocks: joinedBlocks,
    nextContent: insertBlocks(content, insertAt, joinedBlocks),
  };
}

function runHarvest(options: CliOptions): string {
  const result = buildHarvest(options);
  if (options.apply) {
    if (result.count > 0) {
      fs.writeFileSync(options.docPath, result.nextContent);
    } else {
      // Idempotent apply with no new entries intentionally leaves file bytes untouched.
    }
    return `Applied ${result.count} architecture decision(s) to ${options.docPath}`;
  }

  const lines: string[] = [];
  if (result.blocks) {
    lines.push(result.blocks);
  } else {
    // Zero selected/new decisions means the dry-run has no blocks to show.
  }
  lines.push(`Count: ${result.count}`);
  lines.push("(dry-run — pass --apply to write)");
  return lines.join("\n");
}

// ============================================================================
// Self-test
// ============================================================================

function writeSelftestFixture(tempDir: string): { workDir: string; docPath: string } {
  const workDir = path.join(tempDir, "MEMORY", "WORK");
  const isaDir = path.join(workDir, "20260614-loop-detector-and-arch-decisions");
  const incompleteIsaDir = path.join(workDir, "20260614-verify-phase-arch-conjecture");
  const docPath = path.join(tempDir, "DOCUMENTATION", "LifeosSystemArchitecture.md");

  fs.mkdirSync(isaDir, { recursive: true });
  fs.mkdirSync(incompleteIsaDir, { recursive: true });
  fs.mkdirSync(path.dirname(docPath), { recursive: true });

  fs.writeFileSync(path.join(isaDir, "ISA.md"), [
    "---",
    "phase: complete",
    "updated: 2026-06-14T12:00:00Z",
    "started: 2026-06-13",
    "---",
    "",
    "# Fixture ISA",
    "",
    "## Decisions",
    "- D-1: [arch] Use hook pipeline events for architecture decisions — keeps docs tied to source runs.",
    "- D-2: Keep a local note without an architecture tag.",
    "- D-9: documented the [arch] tag convention in the format spec.",
    "",
    "## Verify",
    "- fixture",
    "",
  ].join("\n"));

  fs.writeFileSync(path.join(incompleteIsaDir, "ISA.md"), [
    "---",
    "phase: verify",
    "updated: 2026-06-14T13:00:00Z",
    "started: 2026-06-14",
    "---",
    "",
    "# Verify Phase Fixture ISA",
    "",
    "## Decisions",
    "- D-1: [arch] Keep the verify-phase conjecture out of default harvests.",
    "",
  ].join("\n"));

  fs.writeFileSync(docPath, [
    "# LifeOS Architecture",
    "",
    "## Architecture Decisions",
    "",
    "## Next Section",
    "",
    "Body.",
    "",
  ].join("\n"));

  return { workDir, docPath };
}

function writeZeroDecisionFixture(tempDir: string): string {
  const workDir = path.join(tempDir, "ZERO", "WORK");
  const isaDir = path.join(workDir, "20260614-no-arch-decisions");

  fs.mkdirSync(isaDir, { recursive: true });
  fs.writeFileSync(path.join(isaDir, "ISA.md"), [
    "---",
    "updated: 2026-06-14T12:00:00Z",
    "---",
    "",
    "# Zero Decision Fixture ISA",
    "",
    "## Decisions",
    "- D-1: Keep a local implementation note without an architecture tag.",
    "",
  ].join("\n"));

  return workDir;
}

function writeDocWithoutArchitectureDecisions(docPath: string): void {
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, [
    "# LifeOS Architecture",
    "",
    "## Different Section",
    "",
    "Body.",
    "",
  ].join("\n"));
}

interface SelftestProcessResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runSelftestProcess(args: string[]): SelftestProcessResult {
  const scriptPath = path.resolve(process.argv[1]);
  const result = spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf-8" });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function assertSelftest(condition: boolean, label: string): void {
  if (condition) {
    return;
  }
  throw new Error(label);
}

function runSelftest(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pai-arch-decision-harvest-"));
  try {
    const { workDir, docPath } = writeSelftestFixture(tempDir);
    const options: CliOptions = { apply: false, includeIncomplete: false, keywords: false, docPath, workDir };

    const selected = collectSelectedDecisions(options);
    assertSelftest(selected.length === 1 && selected[0].number === 1, "a");
    assertSelftest(!selected.some((decision) => decision.slug === "20260614-verify-phase-arch-conjecture"), "h");
    assertSelftest(!selected.some((decision) => decision.number === 9), "j");

    const selectedWithIncomplete = collectSelectedDecisions({ ...options, includeIncomplete: true });
    assertSelftest(selectedWithIncomplete.some((decision) => decision.slug === "20260614-verify-phase-arch-conjecture"), "i");

    const beforeDryRun = fs.readFileSync(docPath, "utf-8");
    const dryRunOutput = runHarvest(options);
    const afterDryRun = fs.readFileSync(docPath, "utf-8");
    assertSelftest(dryRunOutput.includes("AD-1") && dryRunOutput.includes("hook pipeline events"), "b");
    assertSelftest(!dryRunOutput.includes("local note without an architecture tag"), "b");
    assertSelftest(beforeDryRun === afterDryRun, "b");

    const applyOutput = runHarvest({ ...options, apply: true });
    const afterApply = fs.readFileSync(docPath, "utf-8");
    const markersAfterApply = afterApply.match(/<!-- ad-src: 20260614-loop-detector-and-arch-decisions#D-1 -->/g) || [];
    assertSelftest(applyOutput.includes("Applied 1"), "c");
    assertSelftest(markersAfterApply.length === 1, "c");
    assertSelftest(afterApply.indexOf("### AD-1") < afterApply.indexOf("## Next Section"), "c");

    const secondApplyOutput = runHarvest({ ...options, apply: true });
    const afterSecondApply = fs.readFileSync(docPath, "utf-8");
    const markersAfterSecondApply = afterSecondApply.match(/<!-- ad-src: 20260614-loop-detector-and-arch-decisions#D-1 -->/g) || [];
    assertSelftest(secondApplyOutput.includes("Applied 0"), "d");
    assertSelftest(markersAfterSecondApply.length === 1, "d");
    assertSelftest(afterApply === afterSecondApply, "d");

    const missingSelectedDoc = path.join(tempDir, "DOCUMENTATION", "MissingSelected.md");
    writeDocWithoutArchitectureDecisions(missingSelectedDoc);
    const beforeMissingSelected = fs.readFileSync(missingSelectedDoc, "utf-8");
    const missingSelectedResult = runSelftestProcess([
      "--work-dir",
      workDir,
      "--doc",
      missingSelectedDoc,
      "--apply",
    ]);
    const afterMissingSelected = fs.readFileSync(missingSelectedDoc, "utf-8");
    assertSelftest(missingSelectedResult.status !== 0, "e");
    assertSelftest(missingSelectedResult.stderr.includes(`Missing "${ARCH_DECISIONS_HEADING}" section`), "e");
    assertSelftest(beforeMissingSelected === afterMissingSelected, "e");

    const zeroWorkDir = writeZeroDecisionFixture(tempDir);
    const missingZeroDoc = path.join(tempDir, "DOCUMENTATION", "MissingZero.md");
    writeDocWithoutArchitectureDecisions(missingZeroDoc);
    const beforeMissingZero = fs.readFileSync(missingZeroDoc, "utf-8");
    const missingZeroDryRunResult = runSelftestProcess([
      "--work-dir",
      zeroWorkDir,
      "--doc",
      missingZeroDoc,
    ]);
    const missingZeroApplyResult = runSelftestProcess([
      "--work-dir",
      zeroWorkDir,
      "--doc",
      missingZeroDoc,
      "--apply",
    ]);
    const afterMissingZero = fs.readFileSync(missingZeroDoc, "utf-8");
    assertSelftest(missingZeroDryRunResult.status !== 0, "f");
    assertSelftest(missingZeroApplyResult.status !== 0, "f");
    assertSelftest(missingZeroDryRunResult.stderr.includes(`Missing "${ARCH_DECISIONS_HEADING}" section`), "f");
    assertSelftest(missingZeroApplyResult.stderr.includes(`Missing "${ARCH_DECISIONS_HEADING}" section`), "f");
    assertSelftest(beforeMissingZero === afterMissingZero, "f");

    const replacementText = "[arch] Adopt JSONL event-sourcing for state — replaces the old single-JSON snapshot because concurrent writers corrupted it.";
    const replacementRendered = renderArchitectureDecision({
      slug: "replacement-fixture",
      number: 1,
      text: replacementText,
      decided: "2026-06-14",
    }, 1);
    const replacementDecisionLine = replacementRendered.split("\n").find((line) => line.startsWith("- **Decision:** ")) || "";
    const replacementLine = replacementRendered.split("\n").find((line) => line.startsWith("- **Replaced:** ")) || "";
    const replacementDecisionValue = replacementDecisionLine.replace("- **Decision:** ", "");
    const replacementValue = replacementLine.replace("- **Replaced:** ", "");
    assertSelftest(!/\bbecause\b/i.test(replacementValue), "g");
    assertSelftest(replacementValue.length < replacementDecisionValue.length, "g");
    assertSelftest(replacementValue.includes("single-JSON snapshot"), "g");

    return "SELFTEST: PASS";
  } catch (error) {
    const label = error instanceof Error ? error.message : String(error);
    return `SELFTEST: FAIL ${label}`;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// ============================================================================
// CLI Entry
// ============================================================================

function usage(): string {
  return `Usage: bun ArchDecisionHarvest.ts [flags]

Flags:
  --apply             Write new entries to the architecture doc
  --include-incomplete Harvest from ISAs regardless of phase
  --keywords          Include keyword-selected decisions as well as [arch] decisions
  --today YYYY-MM-DD  Fallback date when an ISA has no updated/started frontmatter
  --doc <path>        Override target architecture doc path
  --work-dir <path>   Override MEMORY/WORK scan root
  --selftest          Run fixture-backed self-test
  --help              Show this help`;
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    apply: { type: "boolean", default: false },
    "include-incomplete": { type: "boolean", default: false },
    keywords: { type: "boolean", default: false },
    today: { type: "string" },
    doc: { type: "string" },
    "work-dir": { type: "string" },
    selftest: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  strict: true,
});

const options: CliOptions = {
  apply: Boolean(values.apply),
  includeIncomplete: Boolean(values["include-incomplete"]),
  keywords: Boolean(values.keywords),
  today: values.today,
  docPath: values.doc || DEFAULT_ARCH_DOC,
  workDir: values["work-dir"] || DEFAULT_WORK_DIR,
};

switch (true) {
  case Boolean(values.help):
    console.log(usage());
    process.exit(0);
  case Boolean(values.selftest): {
    const result = runSelftest();
    console.log(result);
    process.exit(result === "SELFTEST: PASS" ? 0 : 1);
  }
  default:
    try {
      console.log(runHarvest(options));
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ERROR: ${message}`);
      process.exit(1);
    }
}
