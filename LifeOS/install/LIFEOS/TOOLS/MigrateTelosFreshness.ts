#!/usr/bin/env bun
/**
 * MigrateTelosFreshness — one-shot migration that adds the freshness convention
 * to TELOS.md without altering any existing content.
 *
 *   1. Backup TELOS.md to TELOS/Backups/TELOS-YYYYMMDD-HHMMSS.md
 *   2. Add YAML frontmatter at top: last_updated, last_updated_by
 *   3. Insert <!-- updated: SEED_DATE by:migration --> immediately after every H2
 *   4. Verify substantive content unchanged via sha256 of stripped content
 *
 * SEED_DATE defaults to 2026-05-01 (the unified-TELOS consolidation date — the
 * honest "when was this last touched in its current form" answer). Sections
 * mature naturally from there.
 *
 * Idempotent: running twice is safe but skips already-migrated sections.
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/MigrateTelosFreshness.ts            # apply
 *   bun ~/.claude/LIFEOS/TOOLS/MigrateTelosFreshness.ts --dry-run  # show diff
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const TELOS_PATH = join(LIFEOS_DIR, "USER", "TELOS", "TELOS.md");
const BACKUP_DIR = join(LIFEOS_DIR, "USER", "TELOS", "Backups");

const SEED_DATE = "2026-05-01";
const SEED_ISO = "2026-05-01T00:00:00-07:00";
const MARKER_RE = /<!--\s*updated:\s*\d{4}-\d{2}-\d{2}/;

function strippedHash(s: string): string {
  // Strip frontmatter + every freshness marker before hashing — so the hash
  // captures substantive content only. Normalize leading whitespace so the
  // optional blank line between frontmatter and body doesn't shift the hash.
  let stripped = s.startsWith("---\n")
    ? s.slice(s.indexOf("\n---\n", 4) + 5)
    : s;
  stripped = stripped.replace(/<!--\s*updated:[^>]*-->\n?/g, "");
  stripped = stripped.replace(/^\s+/, "");
  return createHash("sha256").update(stripped).digest("hex");
}

function migrate(dryRun: boolean): void {
  if (!existsSync(TELOS_PATH)) {
    console.error(`TELOS not found: ${TELOS_PATH}`);
    process.exit(1);
  }

  const original = readFileSync(TELOS_PATH, "utf-8");
  const originalHash = strippedHash(original);

  // ─── Backup ───
  if (!dryRun) {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const backupPath = join(BACKUP_DIR, `TELOS-${ts}.md`);
    copyFileSync(TELOS_PATH, backupPath);
    console.log(`Backup: ${backupPath.replace(HOME, "~")}`);
  }

  let content = original;

  // ─── Add YAML frontmatter ───
  if (!content.startsWith("---\n")) {
    const frontmatter =
      `---\n` +
      `last_updated: ${SEED_ISO}\n` +
      `last_updated_by: migration\n` +
      `convention: telos-freshness-v1\n` +
      `---\n\n`;
    content = frontmatter + content;
    console.log(`+ frontmatter (last_updated: ${SEED_ISO})`);
  } else {
    console.log(`= frontmatter already present`);
  }

  // ─── Insert per-section markers ───
  const lines = content.split("\n");
  const out: string[] = [];
  let added = 0;
  let skipped = 0;
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const m = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!m) continue;

    // Look ahead 3 lines for an existing marker.
    const existing = lines
      .slice(i + 1, Math.min(i + 4, lines.length))
      .some((l) => MARKER_RE.test(l));
    if (existing) {
      skipped++;
      continue;
    }

    out.push(`<!-- updated: ${SEED_DATE} by:migration -->`);
    added++;
  }
  content = out.join("\n");
  console.log(`+ ${added} per-section markers (${skipped} already present)`);

  // ─── Verify content unchanged ───
  const newHash = strippedHash(content);
  if (newHash !== originalHash) {
    console.error(`✗ content hash mismatch — migration aborted`);
    console.error(`  before: ${originalHash}`);
    console.error(`  after:  ${newHash}`);
    process.exit(2);
  }
  console.log(`✓ stripped content sha256 unchanged: ${originalHash.slice(0, 12)}…`);

  if (dryRun) {
    console.log("\n(dry-run — no files written)");
    return;
  }

  writeFileSync(TELOS_PATH, content);
  console.log(`✅ Wrote ${TELOS_PATH.replace(HOME, "~")}`);
}

const dryRun = process.argv.includes("--dry-run");
migrate(dryRun);
