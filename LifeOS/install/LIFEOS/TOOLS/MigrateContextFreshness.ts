#!/usr/bin/env bun
/**
 * MigrateContextFreshness — adds pai-freshness-v1 frontmatter to constitutional
 * context files without altering substantive body content.
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/MigrateContextFreshness.ts
 *   bun ~/.claude/LIFEOS/TOOLS/MigrateContextFreshness.ts --dry-run
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, join, relative } from "path";
import {
  CONTEXT_FRESHNESS_REGISTRY,
  MARKER_RE,
  readFileFrontmatter,
  type ContextFile,
} from "./TelosFreshness";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const CLAUDE_DIR = dirname(LIFEOS_DIR);
const SEED_ISO = "2026-05-03T23:00:00-07:00";
const BACKUP_TS = "2026-05-03-23-00-00";

interface MigrationResult {
  file: string;
  path: string;
  action: string;
  sha256Match: boolean;
  bytesBefore: number;
  bytesAfter: number;
  preHash: string;
  postHash: string;
  preview: string[];
  error?: string;
}

function strippedContent(content: string): string {
  let stripped = content;
  if (stripped.startsWith("---\n")) {
    const end = stripped.indexOf("\n---\n", 4);
    if (end !== -1) {
      stripped = stripped.slice(end + 5);
    }
  }
  stripped = stripped.replace(new RegExp(MARKER_RE.source, "g"), "");
  stripped = stripped.replace(/^\s+/, "");
  return stripped;
}

function strippedHash(content: string): string {
  return createHash("sha256").update(strippedContent(content)).digest("hex");
}

function pathRelativeToClaude(path: string): string {
  return relative(CLAUDE_DIR, path).split("/").join("/");
}

function generatorFor(entry: ContextFile): string | null {
  if (entry.slug === "principal_telos") return "GenerateTelosSummary.ts";
  if (entry.slug === "architecture_summary") return "ArchitectureSummaryGenerator.ts";
  return null;
}

function insertFreshnessIntoExistingBlock(content: string): { content: string; action: string } {
  const end = content.indexOf("\n---\n", 4);
  if (!content.startsWith("---\n") || end === -1) {
    throw new Error("Malformed frontmatter block");
  }

  const block = content.slice(4, end);
  if (/^last_updated:/m.test(block)) {
    return { content, action: "unchanged" };
  }

  const injected =
    `last_updated: ${SEED_ISO}\n` +
    `last_updated_by: migration\n` +
    `convention: pai-freshness-v1\n`;
  return {
    content: "---\n" + injected + block + "\n---\n" + content.slice(end + 5),
    action: "upgraded-block",
  };
}

function newFrontmatterBlock(entry: ContextFile): string {
  const lines = [
    "---",
    `last_updated: ${SEED_ISO}`,
    "last_updated_by: migration",
    "convention: pai-freshness-v1",
  ];

  if (entry.is_auto_generated && entry.derived_from) {
    const generator = generatorFor(entry);
    if (generator === null) {
      throw new Error(`No generator registered for ${entry.slug}`);
    }
    lines.push(`derived_from: ${pathRelativeToClaude(entry.derived_from)}`);
    lines.push(`generator: LIFEOS/TOOLS/${generator}`);
  }

  lines.push("---");
  return lines.join("\n") + "\n";
}

function migrateContent(entry: ContextFile, content: string): { content: string; action: string } {
  if (content.startsWith("---\n")) {
    return insertFreshnessIntoExistingBlock(content);
  }

  const block = newFrontmatterBlock(entry);
  if (content.startsWith("<!--")) {
    return { content: block + content, action: "new-block" };
  }

  return { content: block + "\n" + content, action: "new-block" };
}

function writeBackup(path: string, content: string): string {
  const backupDir = join(dirname(path), "Backups");
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `${basename(path, ".md")}-${BACKUP_TS}.md`);
  writeFileSync(backupPath, content);
  return backupPath;
}

function previewLines(content: string): string[] {
  return content.split("\n").slice(0, 12);
}

function migrateFile(entry: ContextFile, dryRun: boolean): MigrationResult {
  const file = basename(entry.path);
  if (!existsSync(entry.path)) {
    return {
      file,
      path: entry.path,
      action: "missing",
      sha256Match: false,
      bytesBefore: 0,
      bytesAfter: 0,
      preHash: "",
      postHash: "",
      preview: [],
      error: `MISSING: ${entry.path}`,
    };
  }

  const original = readFileSync(entry.path, "utf-8");
  const preHash = strippedHash(original);

  let next: string;
  let action: string;
  try {
    readFileFrontmatter(entry.path);
    const migrated = migrateContent(entry, original);
    next = migrated.content;
    action = migrated.action;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      file,
      path: entry.path,
      action: "failed",
      sha256Match: false,
      bytesBefore: Buffer.byteLength(original),
      bytesAfter: Buffer.byteLength(original),
      preHash,
      postHash: preHash,
      preview: [],
      error: `${entry.path}: ${message}`,
    };
  }

  const postHash = strippedHash(next);
  const sha256Match = preHash === postHash;
  if (!sha256Match) {
    return {
      file,
      path: entry.path,
      action: "failed",
      sha256Match,
      bytesBefore: Buffer.byteLength(original),
      bytesAfter: Buffer.byteLength(next),
      preHash,
      postHash,
      preview: previewLines(next),
      error: `content hash mismatch for ${entry.path}`,
    };
  }

  if (!dryRun && next !== original) {
    writeBackup(entry.path, original);
    writeFileSync(entry.path, next);
  }

  return {
    file,
    path: entry.path,
    action,
    sha256Match,
    bytesBefore: Buffer.byteLength(original),
    bytesAfter: Buffer.byteLength(next),
    preHash,
    postHash,
    preview: previewLines(next),
  };
}

function printPreview(result: MigrationResult): void {
  console.log(`\n--- ${result.file} (${result.action}) ---`);
  if (result.error) {
    console.log(result.error);
    return;
  }
  for (const line of result.preview) {
    console.log(line);
  }
}

function printSummary(results: MigrationResult[]): void {
  console.log("\nfile                                 | action          | sha256 match | bytes before -> after");
  console.log("-------------------------------------|-----------------|--------------|---------------------");
  for (const result of results) {
    const match = result.sha256Match ? "yes" : "no";
    const bytes = `${result.bytesBefore} -> ${result.bytesAfter}`;
    console.log(`${result.file.padEnd(36)} | ${result.action.padEnd(15)} | ${match.padEnd(12)} | ${bytes}`);
  }
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const targets = CONTEXT_FRESHNESS_REGISTRY.filter((entry) => entry.slug !== "telos");
  const results = targets.map((entry) => migrateFile(entry, dryRun));

  if (dryRun) {
    for (const result of results) {
      printPreview(result);
    }
    console.log("\n(dry-run - no files written)");
  } else {
    for (const result of results) {
      if (result.error) {
        console.error(result.error);
      } else if (result.action === "unchanged") {
        console.log(`UNCHANGED: ${result.path}`);
      } else {
        console.log(`WROTE: ${result.path}`);
      }
      if (!result.error) {
        const status = result.sha256Match ? "match" : "mismatch";
        console.log(`  sha256 ${status}: ${result.preHash} -> ${result.postHash}`);
      }
    }
  }

  printSummary(results);

  const failed = results.some((result) => result.error || !result.sha256Match);
  if (failed) {
    console.error("Migration completed with failures");
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
