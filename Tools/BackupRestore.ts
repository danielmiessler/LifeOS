#!/usr/bin/env bun
/**
 * BackupRestore - Backup, restore, diff, and migrate PAI installations
 *
 * Commands:
 *   backup [--name <label>]                          - Full backup of ~/.claude
 *   diff --release <path>                            - Compare local install against a release
 *   backup --user-only --release <path>              - Back up only user data (not in release)
 *     [--exclude 'path']                             - Exclude specific files from backup
 *   list                                             - List all backups (full and user-only)
 *   restore <backup-name>                            - Restore from a full backup
 *   migrate <backup>                                 - Analyze backup for migration candidates
 *   migrate --auto [--backup <path>]                  - Auto-restore user data after release update
 *
 * Migration Flow:
 *   1. bun BackupRestore.ts backup --name "pre-v4.1"
 *   2. bun BackupRestore.ts diff --release ./Releases/v4.1.0/.claude
 *   3. bun BackupRestore.ts backup --user-only --release ./Releases/v4.1.0/.claude
 *   4. cp -r ./Releases/v4.1.0/.claude ~/
 *   5. bun BackupRestore.ts migrate --auto
 *   6. cd ~/.claude && bash install.sh
 *   7. bun ~/.claude/PAI/Tools/BuildCLAUDE.ts
 *
 * Examples:
 *   bun BackupRestore.ts backup
 *   bun BackupRestore.ts backup --name "before-update"
 *   bun BackupRestore.ts backup --user-only --release ./Releases/v4.1.0/.claude
 *   bun BackupRestore.ts list
 *   bun BackupRestore.ts diff --release ./Releases/v4.1.0/.claude
 *   bun BackupRestore.ts restore claude-backup-20260114-153000
 *   bun BackupRestore.ts migrate claude-backup-20260114-153000
 *   bun BackupRestore.ts migrate --auto
 */

import { existsSync, readdirSync, statSync, readFileSync, cpSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join, basename, relative, dirname } from "path";
import { createHash } from "crypto";

const HOME = homedir();
const CLAUDE_DIR = join(HOME, ".claude");
const BACKUP_PREFIX = "claude-backup-";
const USER_BACKUP_PREFIX = "claude-user-backup-";

// Files not restored during migrate --auto (regenerated automatically)
const MIGRATE_SKIP_RESTORE = new Set(["CLAUDE.md"]);

// Files ignored during diff (OS metadata, not meaningful)
const DIFF_IGNORE = new Set([".DS_Store", "Thumbs.db"]);

// ============================================================================
// Types
// ============================================================================

interface BackupInfo {
  name: string;
  path: string;
  date: Date;
  size: string;
  hasSettings: boolean;
  hasHooks: boolean;
  hasSkills: boolean;
}

interface MigrationCandidate {
  type: "settings" | "hook" | "skill" | "memory";
  path: string;
  description: string;
}

interface DiffResult {
  newFiles: string[];
  unchanged: string[];
  conflicts: string[];
  releaseDir: string;
}

// ============================================================================
// Utilities
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    const files = readdirSync(dirPath, { withFileTypes: true });
    for (const file of files) {
      const filePath = join(dirPath, file.name);
      if (file.isDirectory()) size += getDirSize(filePath);
      else size += statSync(filePath).size;
    }
  } catch {
    // Ignore errors (permission issues, etc.)
  }
  return size;
}

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/** Recursively list all files in a directory, returning paths relative to root. */
function listFiles(dir: string, root?: string): string[] {
  const base = root || dir;
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...listFiles(fullPath, base));
      else if (entry.isFile()) results.push(relative(base, fullPath));
    }
  } catch {
    // Ignore permission errors
  }
  return results;
}

/**
 * Compare a release directory against the local ~/.claude/ installation.
 * Skips PAI/USER/, MEMORY/, PAI-Install/, settings.json from conflict reporting
 * (these are handled separately as always-backup or always-skip).
 */
function diffRelease(releaseDir: string): DiffResult {
  const releaseFiles = listFiles(releaseDir);
  const newFiles: string[] = [];
  const unchanged: string[] = [];
  const conflicts: string[] = [];

  for (const relPath of releaseFiles) {
    if (DIFF_IGNORE.has(basename(relPath))) continue;
    if (relPath.startsWith("PAI/USER/")) continue;
    if (relPath.startsWith("MEMORY/")) continue;
    if (relPath.startsWith("PAI-Install/")) continue;
    if (relPath === "settings.json") continue;

    const localPath = join(CLAUDE_DIR, relPath);
    if (!existsSync(localPath)) {
      newFiles.push(relPath);
    } else if (sha256(localPath) === sha256(join(releaseDir, relPath))) {
      unchanged.push(relPath);
    } else {
      conflicts.push(relPath);
    }
  }

  return { newFiles, unchanged, conflicts, releaseDir };
}

// ============================================================================
// Commands
// ============================================================================

function listBackups(): BackupInfo[] {
  const backups: BackupInfo[] = [];
  try {
    for (const entry of readdirSync(HOME, { withFileTypes: true })) {
      if (entry.isDirectory() && (entry.name.startsWith(BACKUP_PREFIX) || entry.name.startsWith(USER_BACKUP_PREFIX))) {
        const backupPath = join(HOME, entry.name);
        const stats = statSync(backupPath);
        backups.push({
          name: entry.name,
          path: backupPath,
          date: stats.mtime,
          size: formatSize(getDirSize(backupPath)),
          hasSettings: existsSync(join(backupPath, "settings.json")),
          hasHooks: existsSync(join(backupPath, "hooks")),
          hasSkills: existsSync(join(backupPath, "skills")),
        });
      }
    }
  } catch (error) {
    console.error("Error listing backups:", error);
  }
  return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function createBackup(customName?: string): string | null {
  if (!existsSync(CLAUDE_DIR)) {
    console.error("Error: ~/.claude directory does not exist. Nothing to backup.");
    return null;
  }

  const timestamp = formatDate(new Date()).replace("T", "-");
  const backupName = customName ? `${BACKUP_PREFIX}${customName}-${timestamp}` : `${BACKUP_PREFIX}${timestamp}`;
  const backupPath = join(HOME, backupName);

  if (existsSync(backupPath)) {
    console.error(`Error: Backup already exists at ${backupPath}`);
    return null;
  }

  console.log(`Creating backup: ${backupName}`);
  console.log(`Source: ${CLAUDE_DIR}`);
  console.log(`Destination: ${backupPath}`);

  try {
    cpSync(CLAUDE_DIR, backupPath, { recursive: true });
    console.log(`\nBackup complete: ${formatSize(getDirSize(backupPath))}`);
    console.log(`Location: ~/${backupName}`);
    return backupName;
  } catch (error) {
    console.error("Error creating backup:", error);
    return null;
  }
}

function restoreBackup(backupName: string): boolean {
  const backupPath = backupName.startsWith("/")
    ? backupName
    : join(HOME, backupName.startsWith(BACKUP_PREFIX) ? backupName : `${BACKUP_PREFIX}${backupName}`);

  if (!existsSync(backupPath)) {
    console.error(`Error: Backup not found at ${backupPath}`);
    console.log("\nAvailable backups:");
    listBackups().forEach((b) => console.log(`  - ${b.name}`));
    return false;
  }

  // Backup current before restore
  if (existsSync(CLAUDE_DIR)) {
    const preRestoreBackup = createBackup("pre-restore");
    if (!preRestoreBackup) {
      console.error("Failed to create pre-restore backup. Aborting.");
      return false;
    }
    console.log(`\nCurrent installation backed up to: ${preRestoreBackup}`);
    console.log("Removing current installation...");
    rmSync(CLAUDE_DIR, { recursive: true, force: true });
  }

  console.log(`\nRestoring from: ${backupPath}`);
  console.log(`Destination: ${CLAUDE_DIR}`);

  try {
    cpSync(backupPath, CLAUDE_DIR, { recursive: true });
    console.log("\nRestore complete!");
    console.log("Restart your DA session for changes to take effect.");
    return true;
  } catch (error) {
    console.error("Error restoring backup:", error);
    return false;
  }
}

function analyzeMigration(backupName: string): MigrationCandidate[] {
  const backupPath = backupName.startsWith("/")
    ? backupName
    : join(HOME, backupName.startsWith(BACKUP_PREFIX) ? backupName : `${BACKUP_PREFIX}${backupName}`);

  if (!existsSync(backupPath)) {
    console.error(`Error: Backup not found at ${backupPath}`);
    return [];
  }

  const candidates: MigrationCandidate[] = [];

  // Check settings.json
  const settingsPath = join(backupPath, "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      if (settings.daidentity) {
        candidates.push({
          type: "settings",
          path: "settings.json → daidentity",
          description: `DA Identity: ${settings.daidentity.name || "unnamed"} (${settings.daidentity.fullName || ""})`,
        });
      }
      if (settings.principal) {
        candidates.push({
          type: "settings",
          path: "settings.json → principal",
          description: `Principal: ${settings.principal.name || "unnamed"} (${settings.principal.timezone || ""})`,
        });
      }
      if (settings.hooks) {
        candidates.push({
          type: "settings",
          path: "settings.json → hooks",
          description: `${Object.keys(settings.hooks).length} hook event(s) configured`,
        });
      }
    } catch {
      console.warn("Warning: Could not parse settings.json");
    }
  }

  // Check for custom hooks
  const hooksDir = join(backupPath, "hooks");
  if (existsSync(hooksDir)) {
    try {
      for (const hook of readdirSync(hooksDir).filter((f) => f.endsWith(".hook.ts"))) {
        candidates.push({ type: "hook", path: `hooks/${hook}`, description: `Custom hook: ${hook.replace(".hook.ts", "")}` });
      }
    } catch { /* ignore */ }
  }

  // Check for personal skills (_ALLCAPS)
  const skillsDir = join(backupPath, "skills");
  if (existsSync(skillsDir)) {
    try {
      for (const skill of readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith("_")).map((d) => d.name)) {
        candidates.push({ type: "skill", path: `skills/${skill}`, description: `Personal skill: ${skill} (private, not shared)` });
      }
    } catch { /* ignore */ }
  }

  // Check for MEMORY content
  const memoryDir = join(backupPath, "MEMORY");
  if (existsSync(memoryDir)) {
    try {
      const subdirs = readdirSync(memoryDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
      if (subdirs.length > 0) {
        candidates.push({ type: "memory", path: "MEMORY/", description: `Memory directories: ${subdirs.join(", ")}` });
      }
    } catch { /* ignore */ }
  }

  return candidates;
}

/** diff --release <path> — Compare local installation against a release directory. */
function cmdDiff(releaseDir: string): DiffResult {
  if (!existsSync(releaseDir)) { console.error(`Error: Release directory not found: ${releaseDir}`); process.exit(1); }
  if (!existsSync(CLAUDE_DIR)) { console.error("Error: ~/.claude directory does not exist."); process.exit(1); }

  const result = diffRelease(releaseDir);

  console.log();
  console.log("══════════════════════════════════════════════════════");
  console.log(" PAI · Release Diff");
  console.log("══════════════════════════════════════════════════════");
  console.log();
  console.log(`  Release: ${releaseDir}`);
  console.log(`  Local:   ${CLAUDE_DIR}`);
  console.log();
  console.log(`  New files (will be added):         ${result.newFiles.length.toString().padStart(5)}`);
  console.log(`  Unchanged (identical):             ${result.unchanged.length.toString().padStart(5)}`);
  console.log(`  Conflicts (local modified):        ${result.conflicts.length.toString().padStart(5)}`);

  if (result.conflicts.length > 0) {
    const autoHandled = result.conflicts.filter((f) => MIGRATE_SKIP_RESTORE.has(f));
    const userConflicts = result.conflicts.filter((f) => !MIGRATE_SKIP_RESTORE.has(f));

    if (autoHandled.length > 0) {
      console.log();
      console.log("  Auto-regenerated (backed up but not restored):");
      for (const file of autoHandled) console.log(`    ⊘ ${file} (regenerated by BuildCLAUDE.ts)`);
    }
    if (userConflicts.length > 0) {
      console.log();
      console.log("  User conflicts (will be backed up):");
      for (const file of userConflicts) console.log(`    ~ ${file}`);
      console.log();
      console.log("  These files exist locally with different content.");
      console.log("  Use backup --user-only to save them before migration.");
    }
  } else {
    console.log();
    console.log("  No conflicts. Migration is safe to proceed.");
  }

  console.log();
  console.log("══════════════════════════════════════════════════════");
  console.log();
  return result;
}

/** backup --user-only --release <path> — Back up all user data not in the release. */
function createUserOnlyBackup(releaseDir: string, customName?: string, excludeFiles?: string[]): string | null {
  if (!existsSync(releaseDir)) { console.error(`Error: Release directory not found: ${releaseDir}`); return null; }

  const result = diffRelease(releaseDir);
  const fileSet = new Set(result.conflicts);

  // Always include settings.json and CLAUDE.md
  if (existsSync(join(CLAUDE_DIR, "settings.json")) && !fileSet.has("settings.json")) { result.conflicts.push("settings.json"); fileSet.add("settings.json"); }
  if (existsSync(join(CLAUDE_DIR, "CLAUDE.md")) && !fileSet.has("CLAUDE.md")) { result.conflicts.push("CLAUDE.md"); fileSet.add("CLAUDE.md"); }

  // Always include PAI/USER/ and MEMORY/ (entire directories)
  for (const dir of [join(CLAUDE_DIR, "PAI", "USER"), join(CLAUDE_DIR, "MEMORY")]) {
    if (!existsSync(dir)) continue;
    for (const f of listFiles(dir, CLAUDE_DIR)) {
      if (!fileSet.has(f) && !DIFF_IGNORE.has(basename(f))) { result.conflicts.push(f); fileSet.add(f); }
    }
  }

  // Include all local files not in the release (user-generated data)
  const releaseFileSet = new Set(listFiles(releaseDir));
  for (const f of listFiles(CLAUDE_DIR)) {
    if (fileSet.has(f)) continue;
    if (DIFF_IGNORE.has(basename(f))) continue;
    if (f.startsWith("PAI/USER/") || f.startsWith("PAI-Install/")) continue;
    if (releaseFileSet.has(f)) continue;
    result.conflicts.push(f); fileSet.add(f);
  }

  // Apply user-specified excludes
  if (excludeFiles && excludeFiles.length > 0) {
    const excludeSet = new Set(excludeFiles);
    result.conflicts = result.conflicts.filter((f) => !excludeSet.has(f));
  }

  if (result.conflicts.length === 0) {
    console.log("\nNo user data to back up.");
    return null;
  }

  const timestamp = formatDate(new Date()).replace("T", "-");
  const backupName = customName ? `${USER_BACKUP_PREFIX}${customName}-${timestamp}` : `${USER_BACKUP_PREFIX}${timestamp}`;
  const backupPath = join(HOME, backupName);

  if (existsSync(backupPath)) { console.error(`Error: Backup already exists at ${backupPath}`); return null; }

  console.log(`\nBacking up ${result.conflicts.length} file(s)...`);
  mkdirSync(backupPath, { recursive: true });

  let totalSize = 0;
  for (const relPath of result.conflicts) {
    const srcPath = join(CLAUDE_DIR, relPath);
    const dstPath = join(backupPath, relPath);
    mkdirSync(dirname(dstPath), { recursive: true });
    cpSync(srcPath, dstPath);
    totalSize += statSync(srcPath).size;
  }

  writeFileSync(join(backupPath, "backup-manifest.json"), JSON.stringify({
    type: "user-only", timestamp: new Date().toISOString(), releaseDir,
    files: result.conflicts, totalFiles: result.conflicts.length, totalSize,
  }, null, 2));

  console.log();
  console.log("══════════════════════════════════════════════════════");
  console.log(" PAI BACKUP · User-Only");
  console.log("══════════════════════════════════════════════════════");
  console.log();
  console.log(`  Files backed up: ${result.conflicts.length}`);
  console.log(`  Total size:      ${formatSize(totalSize)}`);
  console.log(`  Location:        ~/${backupName}`);
  console.log();
  console.log("  Review the backup directory and remove any files you");
  console.log("  don't want restored after migration.");
  console.log();
  console.log("══════════════════════════════════════════════════════");
  console.log();
  return backupName;
}

/**
 * migrate --auto [--backup <path>]
 * Auto-restore user data from a user-only backup after applying a new release.
 * Restores all files from the backup except CLAUDE.md (regenerated by BuildCLAUDE.ts).
 * Then runs BuildCLAUDE.ts.
 */
async function cmdMigrateAuto(backupPath: string): Promise<void> {
  if (!existsSync(backupPath)) { console.error(`Error: Backup not found: ${backupPath}`); process.exit(1); }
  if (!existsSync(CLAUDE_DIR)) { console.error("Error: ~/.claude directory does not exist. Run cp -r first."); process.exit(1); }

  console.log();
  console.log("══════════════════════════════════════════════════════");
  console.log(" PAI MIGRATE · Auto-Restore User Data");
  console.log("══════════════════════════════════════════════════════");
  console.log();
  console.log(`  Backup:  ${backupPath}`);
  console.log(`  Target:  ${CLAUDE_DIR}`);
  console.log();

  // Read manifest or scan backup directory
  const manifestPath = join(backupPath, "backup-manifest.json");
  let filesToRestore: string[];
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    filesToRestore = manifest.files || [];
  } else {
    filesToRestore = listFiles(backupPath).filter((f) => f !== "backup-manifest.json");
  }

  let restored = 0;
  let skipped = 0;

  for (const relPath of filesToRestore) {
    if (MIGRATE_SKIP_RESTORE.has(relPath)) {
      console.log(`  ⊘ ${relPath} (regenerated by BuildCLAUDE.ts)`);
      skipped++;
      continue;
    }

    const srcPath = join(backupPath, relPath);
    if (!existsSync(srcPath)) continue;

    const dstPath = join(CLAUDE_DIR, relPath);
    mkdirSync(dirname(dstPath), { recursive: true });
    cpSync(srcPath, dstPath);
    console.log(`  ✓ ${relPath}`);
    restored++;
  }

  console.log();
  console.log(`  Restored: ${restored} file(s), Skipped: ${skipped}`);

  // Run BuildCLAUDE.ts
  console.log();
  console.log("  Rebuilding CLAUDE.md...");
  const buildScript = join(CLAUDE_DIR, "PAI", "Tools", "BuildCLAUDE.ts");
  if (existsSync(buildScript)) {
    try {
      const { build } = await import(buildScript);
      const result = build();
      if (result.rebuilt) console.log("  ✓ CLAUDE.md rebuilt.");
      else console.log(`  ✓ ${result.reason || "CLAUDE.md already current."}`);
    } catch {
      console.log(`  ⚠  BuildCLAUDE.ts failed. Run manually: bun "${buildScript}"`);
    }
  } else {
    console.log("  ⚠  BuildCLAUDE.ts not found.");
  }

  console.log();
  console.log("══════════════════════════════════════════════════════");
  console.log(" Migration complete!");
  console.log();
  console.log(" Next steps:");
  console.log("   1. Run install.sh if you need to update identity/voice:");
  console.log("      cd ~/.claude && bash install.sh");
  console.log("   2. Restart Claude Code to pick up changes.");
  console.log("══════════════════════════════════════════════════════");
  console.log();
}

// ============================================================================
// CLI
// ============================================================================

function printUsage(): void {
  console.log(`
PAI Backup & Restore Tool

Usage:
  bun BackupRestore.ts <command> [options]

Commands:
  backup [--name <label>]                          Full backup of ~/.claude
  diff --release <path>                            Compare local install against a release
  backup --user-only --release <path>              Back up only user data (not in release)
    [--exclude 'path'] [--exclude 'path']            Exclude specific files from user-only backup
  list                                             List all backups (full and user-only)
  restore <backup-name>                            Restore from a full backup
  migrate <backup>                                 Analyze backup for migration candidates
  migrate --auto [--backup <path>]                  Auto-restore user data after release update

Examples:
  bun BackupRestore.ts backup
  bun BackupRestore.ts backup --name "before-update"
  bun BackupRestore.ts diff --release ./Releases/v4.1.0/.claude
  bun BackupRestore.ts backup --user-only --release ./Releases/v4.1.0/.claude
  bun BackupRestore.ts backup --user-only --release ./Releases/v4.1.0/.claude --exclude 'PAI/SKILL.md'
  bun BackupRestore.ts list
  bun BackupRestore.ts restore claude-backup-20260114-153000
  bun BackupRestore.ts migrate claude-backup-20260114-153000
  bun BackupRestore.ts migrate --auto

Migration Flow:
  1. bun BackupRestore.ts backup --name "pre-v4.1"
  2. bun BackupRestore.ts diff --release ./Releases/v4.1.0/.claude
  3. bun BackupRestore.ts backup --user-only --release ./Releases/v4.1.0/.claude
  4. cp -r ./Releases/v4.1.0/.claude ~/
  5. bun BackupRestore.ts migrate --auto
  6. cd ~/.claude && bash install.sh
  7. bun ~/.claude/PAI/Tools/BuildCLAUDE.ts

Notes:
  - Backups are stored in ~/ with prefix "${BACKUP_PREFIX}" or "${USER_BACKUP_PREFIX}"
  - Restore always creates a pre-restore backup before overwriting
  - migrate --auto uses the latest user-only backup if --backup is not specified
  - settings.json is restored before install.sh so its merge logic preserves your config
  - CLAUDE.md is not restored (regenerated by BuildCLAUDE.ts)
`);
}

const args = process.argv.slice(2);
const command = args[0];

function getArgValue(flag: string): string {
  const idx = args.indexOf(flag);
  if (idx === -1 || !args[idx + 1]) {
    console.error(`Error: ${flag} <path> is required.`);
    process.exit(1);
  }
  return args[idx + 1];
}

switch (command) {
  case "backup": {
    if (args.includes("--user-only")) {
      const releaseDir = getArgValue("--release");
      let customName: string | undefined;
      const nameIndex = args.indexOf("--name");
      if (nameIndex !== -1 && args[nameIndex + 1]) customName = args[nameIndex + 1];
      const excludeFiles: string[] = [];
      let idx = args.indexOf("--exclude");
      while (idx !== -1) {
        if (args[idx + 1]) excludeFiles.push(args[idx + 1]);
        idx = args.indexOf("--exclude", idx + 1);
      }
      createUserOnlyBackup(releaseDir, customName, excludeFiles);
    } else {
      let customName: string | undefined;
      const nameIndex = args.indexOf("--name");
      if (nameIndex !== -1 && args[nameIndex + 1]) customName = args[nameIndex + 1];
      createBackup(customName);
    }
    break;
  }

  case "restore": {
    const backupName = args[1];
    if (!backupName) {
      console.error("Error: Please specify a backup name to restore.");
      console.log("\nAvailable backups:");
      listBackups().forEach((b) => console.log(`  - ${b.name}`));
      process.exit(1);
    }
    restoreBackup(backupName);
    break;
  }

  case "list": {
    const backups = listBackups();
    if (backups.length === 0) {
      console.log("No backups found.");
      console.log(`\nBackups are stored in ~/ with prefix "${BACKUP_PREFIX}" or "${USER_BACKUP_PREFIX}"`);
    } else {
      console.log("Available backups:\n");
      for (const backup of backups) {
        const isUserOnly = backup.name.startsWith(USER_BACKUP_PREFIX);
        const tag = isUserOnly ? " [user-only]" : "";
        console.log(`${backup.name}${tag}`);
        console.log(`  Date: ${backup.date.toLocaleString()}`);
        console.log(`  Size: ${backup.size}`);
        if (!isUserOnly) {
          console.log(`  Contents: ${[backup.hasSettings ? "settings" : "", backup.hasHooks ? "hooks" : "", backup.hasSkills ? "skills" : ""].filter(Boolean).join(", ") || "empty"}`);
        }
        console.log("");
      }
    }
    break;
  }

  case "migrate": {
    if (args.includes("--auto")) {
      // --backup is optional; if not provided, find the latest user-only backup
      const backupIdx = args.indexOf("--backup");
      let backupPath: string;
      if (backupIdx !== -1 && args[backupIdx + 1]) {
        backupPath = args[backupIdx + 1];
      } else {
        const latest = listBackups().find((b) => b.name.startsWith(USER_BACKUP_PREFIX));
        if (!latest) {
          console.error("Error: No user-only backup found. Run backup --user-only first, or specify --backup <path>.");
          process.exit(1);
        }
        backupPath = latest.path;
        console.log(`Using latest user-only backup: ${latest.name}\n`);
      }
      await cmdMigrateAuto(backupPath);
    } else {
      const backupName = args[1];
      if (!backupName) {
        console.error("Error: Please specify a backup name to analyze.");
        console.log("\nAvailable backups:");
        listBackups().forEach((b) => console.log(`  - ${b.name}`));
        process.exit(1);
      }

      const candidates = analyzeMigration(backupName);
      if (candidates.length === 0) {
        console.log("No migration candidates found in this backup.");
      } else {
        console.log("Migration candidates:\n");
        const byType = {
          settings: candidates.filter((c) => c.type === "settings"),
          hook: candidates.filter((c) => c.type === "hook"),
          skill: candidates.filter((c) => c.type === "skill"),
          memory: candidates.filter((c) => c.type === "memory"),
        };
        if (byType.settings.length > 0) {
          console.log("Settings (can merge into new settings.json):");
          byType.settings.forEach((c) => console.log(`  - ${c.description}`));
          console.log("");
        }
        if (byType.hook.length > 0) {
          console.log("Custom Hooks (copy to new hooks/ directory):");
          byType.hook.forEach((c) => console.log(`  - ${c.path}`));
          console.log("");
        }
        if (byType.skill.length > 0) {
          console.log("Personal Skills (copy to new skills/ directory):");
          byType.skill.forEach((c) => console.log(`  - ${c.path}`));
          console.log("");
        }
        if (byType.memory.length > 0) {
          console.log("Memory Data (can be preserved):");
          byType.memory.forEach((c) => console.log(`  - ${c.description}`));
          console.log("");
        }
        console.log("To migrate these items, use your DA to selectively copy");
        console.log("the desired files from the backup to your new PAI installation.");
      }
    }
    break;
  }

  case "diff": {
    cmdDiff(getArgValue("--release"));
    break;
  }

  default:
    printUsage();
    if (command && command !== "help" && command !== "--help" && command !== "-h") {
      console.error(`\nUnknown command: ${command}`);
      process.exit(1);
    }
}
