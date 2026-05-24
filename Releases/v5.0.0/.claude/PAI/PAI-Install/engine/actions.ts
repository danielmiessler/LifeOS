/**
 * PAI Installer v5.0 — Install Actions
 * Pure action functions called by both CLI and web frontends.
 * Each action takes state + event emitter, performs work, returns result.
 */

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, symlinkSync, unlinkSync, chmodSync, lstatSync, cpSync, rmSync, readlinkSync } from "fs";
import { homedir } from "os";
import { join, basename, dirname } from "path";
import type { InstallState, EngineEventHandler, DetectionResult, ExistingUserContentDetection, StepId } from "./types";
import { PAI_VERSION, ALGORITHM_VERSION, DEFAULT_VOICES } from "./types";
import { detectSystem, detectExistingUserContent, scanApiKeys, validateElevenLabsKey } from "./detect";
import { generateSettingsJson } from "./config-gen";

type ChoiceOption = {
  label: string;
  value: string;
  description?: string;
  voiceId?: string;
};

type InputPrompt = (
  id: string,
  prompt: string,
  type: "text" | "password" | "key",
  placeholder?: string,
  daName?: string
) => Promise<string>;

type ChoicePrompt = (
  id: string,
  prompt: string,
  choices: ChoiceOption[],
  daName?: string
) => Promise<string>;

type ChoicePreviewPrompt = (
  id: string,
  prompt: string,
  choices: ChoiceOption[],
  previewText: string,
  daName?: string
) => Promise<string>;

const PLACEHOLDER_LITERALS = new Set([
  "Your name",
  "e.g., Atlas, Nova, Sage",
  "Ready to go",
  "User",
  "PAI",
]);

const USER_MIGRATION_IDENTITY_FILES = [
  "PRINCIPAL_IDENTITY.md",
  "DA_IDENTITY.md",
  "DA_IDENTITY.yaml",
] as const;

const USER_MIGRATION_FULL_ENTRIES = [
  "TELOS",
  "CONTACTS.md",
  "OPINIONS.md",
  "PROJECTS",
  "BUSINESS",
  "FINANCES",
  "HEALTH",
  "WORKINGSTYLE.md",
  "RHETORICALSTYLE.md",
  "AI_WRITING_PATTERNS.md",
  "FEED.md",
  "RESUME.md",
  "OUR_STORY.md",
  "DEFINITIONS.md",
  "CORECONTENT.md",
  "BELIEFS.md",
] as const;

function isPlaceholderValue(value: string): boolean {
  return /^\{.+\}$/.test(value) || /^e\.g\./i.test(value.trim()) || PLACEHOLDER_LITERALS.has(value.trim());
}

function computeBackupPath(home: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return join(home, `.claude.backup-${ts}`);
}

async function emitSectionHeader(
  emit: EngineEventHandler,
  sectionId: string,
  title: string,
  subtitle?: string,
  stepNumber?: number
): Promise<void> {
  await emit({ event: "section_header", sectionId, title, subtitle, stepNumber });
}

function summariseExistingUserContent(content: ExistingUserContentDetection): string {
  const telosParts: string[] = [];
  if (content.telos.mission) telosParts.push("MISSION ✓");
  if (content.telos.goals) {
    const goalsSuffix = content.telos.goalsCount > 0 ? ` (${content.telos.goalsCount} entries)` : "";
    telosParts.push(`GOALS ✓${goalsSuffix}`);
  }
  if (content.telos.activeProblems) telosParts.push("ACTIVE_PROBLEMS ✓");
  if (content.telos.strategy) telosParts.push("STRATEGY ✓");
  if (content.telos.principles) telosParts.push("PRINCIPLES ✓");
  if (content.telos.areas) telosParts.push("AREAS ✓");
  if (content.telos.now) telosParts.push("NOW ✓");

  const identityParts: string[] = [];
  if (content.identity.principalIdentity) identityParts.push("PRINCIPAL_IDENTITY ✓");
  if (content.identity.daIdentity) identityParts.push("DA_IDENTITY ✓");
  if (content.identity.daIdentityYaml) identityParts.push("DA_IDENTITY.yaml ✓");
  if (content.identity.workingStyle) identityParts.push("WORKINGSTYLE ✓");
  if (content.identity.rhetoricalStyle) identityParts.push("RHETORICALSTYLE ✓");
  if (content.identity.aiWritingPatterns) identityParts.push("AI_WRITING_PATTERNS ✓");
  if (content.identity.feed) identityParts.push("FEED ✓");
  if (content.identity.resume) identityParts.push("RESUME ✓");
  if (content.identity.ourStory) identityParts.push("OUR_STORY ✓");
  if (content.identity.definitions) identityParts.push("DEFINITIONS ✓");
  if (content.identity.coreContent) identityParts.push("CORECONTENT ✓");
  if (content.identity.beliefs) identityParts.push("BELIEFS ✓");

  const sections: string[] = [];
  if (telosParts.length > 0) sections.push(`TELOS: ${telosParts.join(", ")}`);
  if (identityParts.length > 0) sections.push(`IDENTITY: ${identityParts.join(", ")}`);
  if (content.contacts.contacts) {
    const contactsSuffix = content.contacts.count > 0 ? ` (${content.contacts.count} entries)` : "";
    sections.push(`CONTACTS: CONTACTS.md ✓${contactsSuffix}`);
  }
  if (content.opinions.opinions) sections.push("OPINIONS: OPINIONS.md ✓");
  if (content.projects.projectsIndex || content.projects.projectsDirectory) {
    const projectBits: string[] = [];
    if (content.projects.projectsIndex) {
      const projectCountSuffix = content.projects.count > 0 ? ` (${content.projects.count} entries)` : "";
      projectBits.push(`PROJECTS.md ✓${projectCountSuffix}`);
    }
    if (content.projects.projectsDirectory) projectBits.push("PROJECTS/ ✓");
    sections.push(`PROJECTS: ${projectBits.join(", ")}`);
  }
  if (content.business.present) sections.push("BUSINESS: present ✓");
  if (content.finances.present) sections.push("FINANCES: present ✓");
  if (content.health.present) sections.push("HEALTH: present ✓");

  return sections.join(" | ");
}

/**
 * Remove duplicate bun PATH entries from shell config.
 * The bun.sh installer appends entries on every run — if install is
 * interrupted and retried, the config file accumulates duplicates.
 * Fixes: https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/954
 */
function deduplicateBunShellEntries(): void {
  const home = homedir();
  const shell = process.env.SHELL || "/bin/zsh";

  let rcFile: string;
  if (shell.includes("fish")) {
    rcFile = join(home, ".config", "fish", "config.fish");
  } else if (shell.includes("bash")) {
    rcFile = join(home, ".bashrc");
  } else {
    rcFile = join(home, ".zshrc");
  }

  if (!existsSync(rcFile)) return;

  try {
    const content = readFileSync(rcFile, "utf-8");

    // Match bun config blocks: "# bun" line followed by export/set lines
    const bunBlockPattern = shell.includes("fish")
      ? /\n?# bun\nset --export BUN_INSTALL "[^"]*"\nset --export PATH \$BUN_INSTALL\/bin \$PATH\n?/g
      : /\n?# bun\nexport BUN_INSTALL="[^"]*"\nexport PATH="?\$BUN_INSTALL\/bin:\$PATH"?\n?/g;

    const matches = content.match(bunBlockPattern);
    if (!matches || matches.length <= 1) return; // 0 or 1 block = nothing to deduplicate

    // Keep the first block, remove all subsequent duplicates
    let deduplicated = content;
    let firstFound = false;
    deduplicated = deduplicated.replace(bunBlockPattern, (match) => {
      if (!firstFound) {
        firstFound = true;
        return match; // Keep the first occurrence
      }
      return ""; // Remove duplicates
    });

    // Clean up any resulting double blank lines
    deduplicated = deduplicated.replace(/\n{3,}/g, "\n\n");

    if (deduplicated !== content) {
      writeFileSync(rcFile, deduplicated, "utf-8");
    }
  } catch {
    // Non-critical — silently ignore errors
  }
}

/**
 * Read an env-style file and extract a key's value. Returns "" if missing.
 */
function readKeyFromFile(envPath: string, keyName: string): string {
  try {
    if (!existsSync(envPath)) return "";
    const content = readFileSync(envPath, "utf-8");
    const match = content.match(new RegExp(`^${keyName}=(.+)$`, "m"));
    return match && match[1].trim() ? match[1].trim() : "";
  } catch {
    return "";
  }
}

/**
 * Check primary key locations only — current process env, ~/.claude/.env,
 * ~/.config/PAI/.env. These are the user's own active install; no permission
 * prompt needed.
 */
function findExistingEnvKey(keyName: string): string {
  const home = homedir();
  const primary = [
    join(home, ".claude", ".env"),
    join(home, ".config", "PAI", ".env"),
  ];
  for (const envPath of primary) {
    const value = readKeyFromFile(envPath, keyName);
    if (value) return value;
  }
  return process.env[keyName] || "";
}

/**
 * List backup .claude* directories that have an .env containing the key.
 * Returns paths only — does NOT read or use the values until the caller
 * gets explicit user permission. Used by setupVoice to ask before scanning.
 */
function findKeyInBackupDirs(keyName: string): { path: string; value: string }[] {
  const home = homedir();
  const found: { path: string; value: string }[] = [];
  try {
    const homeEntries = readdirSync(home);
    for (const entry of homeEntries) {
      if (!entry.startsWith(".claude") || entry === ".claude") continue;
      for (const candidate of [
        join(home, entry, ".env"),
        join(home, entry, ".config", "PAI", ".env"),
      ]) {
        const value = readKeyFromFile(candidate, keyName);
        if (value) found.push({ path: candidate, value });
      }
    }
  } catch {
    // Permission errors on home listing — return what we have
  }
  return found;
}

/**
 * Inventory what existing PAI configuration is present on this machine,
 * WITHOUT importing anything. Read-only check used to decide whether to
 * ask the user permission before proceeding with import.
 *
 * Scope (deliberately narrow — the just-installed `~/.claude/` is excluded):
 *   1. `~/.config/PAI/.env` — PAI's canonical key store. Lives outside
 *      `~/.claude/` so it survives `rm -rf ~/.claude` between installs.
 *      This is where a prior install's key actually persists.
 *   2. ANY directory in `$HOME` whose name starts with `.claude` EXCEPT
 *      `~/.claude/` itself — covers `.claude.bak`, `.claude-bak`,
 *      `.claude.backup.20260101`, `.claude.previous`, `.claude_old`, etc.
 *      Inside each, both `<dir>/.env` AND `<dir>/.config/PAI/.env` are
 *      checked, plus `<dir>/settings.json` for the voice ID.
 *
 * The active `~/.claude/.env` and `~/.claude/settings.json` are NOT
 * inventoried — they're the install we just built, not prior state to ask
 * about importing. Returns a list of human-readable signals — a fresh
 * machine returns []. Any non-empty result triggers the upfront "may I
 * import?" prompt at the top of runVoiceSetup. The user must explicitly
 * opt in before any prior key or voice ID gets pulled into the new install.
 */
function inventoryExistingConfig(): { signals: string[] } {
  const home = homedir();
  const signals: string[] = [];
  // (1) `~/.config/PAI/.env` — outside `~/.claude/`, often holds the prior key.
  const configEnv = join(home, ".config", "PAI", ".env");
  if (readKeyFromFile(configEnv, "ELEVENLABS_API_KEY")) {
    signals.push(`ElevenLabs key in ${configEnv.replace(home, "~")}`);
  }
  // (2) Every `.claude*` directory in $HOME EXCEPT `~/.claude/` itself.
  //     Pattern matches `.claude.bak`, `.claude-bak`, `.claude.backup.20260101`,
  //     `.claude.previous`, `.claude_old`, `.claude20251215`, etc.
  try {
    for (const entry of readdirSync(home)) {
      if (!entry.startsWith(".claude") || entry === ".claude") continue;
      for (const candidate of [join(home, entry, ".env"), join(home, entry, ".config", "PAI", ".env")]) {
        if (readKeyFromFile(candidate, "ELEVENLABS_API_KEY")) {
          signals.push(`ElevenLabs key in ${candidate.replace(home, "~")}`);
        }
      }
      const settingsPath = join(home, entry, "settings.json");
      if (existsSync(settingsPath)) {
        try {
          const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
          const voiceId = settings.daidentity?.voices?.main?.voiceId || settings.daidentity?.voiceId;
          if (voiceId && !/^\{.+\}$/.test(voiceId)) {
            signals.push(`voice ID in ${settingsPath.replace(home, "~")}`);
          }
        } catch { /* malformed settings.json — skip */ }
      }
    }
  } catch { /* permission errors on home listing — return what we have */ }
  return { signals };
}

/**
 * Search existing .claude directories for settings.json voice configuration.
 * Returns { voiceId, aiName, source } if found, or null.
 */
function findExistingVoiceConfig(): { voiceId: string; aiName: string; source: string } | null {
  const home = homedir();
  const candidates: string[] = [];

  // Primary location first
  candidates.push(join(home, ".claude", "settings.json"));

  // Scan all .claude* directories (backups, renamed, etc.)
  try {
    const homeEntries = readdirSync(home);
    for (const entry of homeEntries) {
      if (entry.startsWith(".claude") && entry !== ".claude") {
        candidates.push(join(home, entry, "settings.json"));
      }
    }
  } catch {
    // Ignore permission errors
  }

  for (const settingsPath of candidates) {
    try {
      if (!existsSync(settingsPath)) continue;
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      const voiceId = settings.daidentity?.voices?.main?.voiceId
        || settings.daidentity?.voiceId;
      if (voiceId && !/^\{.+\}$/.test(voiceId)) {
        const dirName = basename(join(settingsPath, ".."));
        return {
          voiceId,
          aiName: settings.daidentity?.name || "",
          source: dirName,
        };
      }
    } catch {
      // Ignore parse errors
    }
  }
  return null;
}

function tryExec(cmd: string, timeout = 30000): string | null {
  try {
    return execSync(cmd, { timeout, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
  } catch {
    return null;
  }
}

// ─── User Context Migration (v2.5/v3.0 → v5.x) ─────────────────
//
// In v2.5–v3.0, user context (ABOUTME.md, TELOS/, CONTACTS.md, etc.)
// lived at skills/PAI/USER/ (or skills/CORE/USER/ in v2.4).
// In v4.0, user context moved to PAI/USER/ and CONTEXT_ROUTING.md
// points there. But the installer never migrated existing files,
// leaving user data stranded at the old path while the new path
// stayed empty. This function copies user files to the canonical
// location and replaces the legacy directory with a symlink so
// both routing systems resolve to the same place.

/**
 * Recursively copy files from src to dst, skipping files that
 * already exist at the destination. Only copies regular files.
 */
function copyMissing(src: string, dst: string): number {
  let copied = 0;
  if (!existsSync(src)) return copied;

  const stat = lstatSync(src);
  if (stat.isFile()) {
    if (!existsSync(dst)) {
      try {
        mkdirSync(dirname(dst), { recursive: true });
        cpSync(src, dst);
        copied++;
      } catch {
        // Skip files that can't be copied (permission errors)
      }
    }
    return copied;
  }

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);

    if (entry.isDirectory()) {
      if (!existsSync(dstPath)) mkdirSync(dstPath, { recursive: true });
      copied += copyMissing(srcPath, dstPath);
    } else if (entry.isFile()) {
      if (!existsSync(dstPath)) {
        try {
          cpSync(srcPath, dstPath);
          copied++;
        } catch {
          // Skip files that can't be copied (permission errors)
        }
      }
    }
  }
  return copied;
}

function shouldOverwriteTemplateDestination(dstPath: string): boolean {
  if (!existsSync(dstPath)) return true;

  try {
    const stat = lstatSync(dstPath);
    if (!stat.isFile()) return false;
    if (stat.size === 0) return true;
    const content = readFileSync(dstPath, "utf-8");
    return (
      content.includes("{PRINCIPAL.NAME}") ||
      content.includes("{DA.NAME}") ||
      content.includes("Your name") ||
      content.includes("e.g., Atlas, Nova, Sage")
    );
  } catch {
    return false;
  }
}

function copyOverwriteTemplates(src: string, dst: string): { copied: number; failed: number } {
  const result = { copied: 0, failed: 0 };
  if (!existsSync(src)) return result;

  try {
    const srcStat = lstatSync(src);
    if (srcStat.isDirectory()) {
      if (!existsSync(dst)) mkdirSync(dst, { recursive: true });
      for (const entry of readdirSync(src, { withFileTypes: true })) {
        const child = copyOverwriteTemplates(join(src, entry.name), join(dst, entry.name));
        result.copied += child.copied;
        result.failed += child.failed;
      }
      return result;
    }

    if (!srcStat.isFile()) return result;
    if (!shouldOverwriteTemplateDestination(dst)) return result;
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst);
    result.copied++;
    return result;
  } catch {
    result.failed++;
    return result;
  }
}

/**
 * Migrate user context from legacy skills/PAI/USER or skills/CORE/USER
 * to the canonical PAI/USER location. Replaces the legacy directory
 * with a symlink so the skill's relative USER/ paths still resolve.
 */
async function migrateUserContext(
  paiDir: string,
  emit: EngineEventHandler
): Promise<void> {
  const newUserDir = join(paiDir, "PAI", "USER");
  if (!existsSync(newUserDir)) return; // PAI/USER/ not set up yet

  const legacyPaths = [
    join(paiDir, "skills", "PAI", "USER"),   // v2.5–v3.0
    join(paiDir, "skills", "CORE", "USER"),  // v2.4 and earlier
  ];

  for (const legacyDir of legacyPaths) {
    if (!existsSync(legacyDir)) continue;

    // Skip if already a symlink (migration already ran)
    try {
      if (lstatSync(legacyDir).isSymbolicLink()) continue;
    } catch {
      continue;
    }

    const label = legacyDir.includes("CORE") ? "skills/CORE/USER" : "skills/PAI/USER";
    await emit({ event: "progress", step: "repository", percent: 70, detail: `Migrating user context from ${label}...` });

    const copied = copyMissing(legacyDir, newUserDir);
    if (copied > 0) {
      await emit({ event: "message", content: `Migrated ${copied} user context files from ${label} to PAI/USER.` });
    }

    // Replace legacy dir with symlink so skill-relative paths still work
    try {
      rmSync(legacyDir, { recursive: true });
      // Symlink target is relative: from skills/PAI/ or skills/CORE/ → ../../PAI/USER
      symlinkSync(join("..", "..", "PAI", "USER"), legacyDir);
      await emit({ event: "message", content: `Replaced ${label} with symlink to PAI/USER.` });
    } catch {
      await emit({ event: "message", content: `Could not replace ${label} with symlink. User files were copied but old directory remains.` });
    }
  }
}

function collectTopLevelExtraMarkdown(userDir: string, alreadyIncluded: Set<string>): string[] {
  if (!existsSync(userDir)) return [];

  try {
    return readdirSync(userDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.endsWith(".md"))
      .filter((name) => !alreadyIncluded.has(name))
      .filter((name) => ![".DS_Store"].includes(name));
  } catch {
    return [];
  }
}

function copyMigrationEntry(
  srcPath: string,
  dstPath: string
): { copied: number; failed: number } {
  const copiedMissing = copyMissing(srcPath, dstPath);
  const overwritten = copyOverwriteTemplates(srcPath, dstPath);
  return {
    copied: copiedMissing + overwritten.copied,
    failed: overwritten.failed,
  };
}

export async function migrateUserContentFromBackup(
  state: InstallState,
  emit: EngineEventHandler
): Promise<void> {
  if (!state.backupPath || state.collected.scanConsent === "no") return;

  const backupUserDir = join(state.backupPath, "PAI", "USER");
  if (!existsSync(backupUserDir)) {
    await emit({ event: "message", content: `No PAI/USER content found in backup at ${state.backupPath}.` });
    return;
  }

  const targetUserDir = join(state.detection?.paiDir || join(homedir(), ".claude"), "PAI", "USER");
  if (!existsSync(targetUserDir)) mkdirSync(targetUserDir, { recursive: true });

  const entries =
    state.collected.scanConsent === "yes-id"
      ? [...USER_MIGRATION_IDENTITY_FILES]
      : (() => {
          const included = new Set<string>([
            ...USER_MIGRATION_IDENTITY_FILES,
            ...USER_MIGRATION_FULL_ENTRIES,
          ]);
          return [
            ...USER_MIGRATION_IDENTITY_FILES,
            ...USER_MIGRATION_FULL_ENTRIES,
            ...collectTopLevelExtraMarkdown(backupUserDir, included),
          ];
        })();

  let totalCopied = 0;
  let totalFailed = 0;

  for (const entry of entries) {
    if (entry === ".git" || entry === "node_modules" || entry === ".DS_Store") continue;
    const srcPath = join(backupUserDir, entry);
    if (!existsSync(srcPath)) continue;

    const dstPath = join(targetUserDir, entry);
    const result = copyMigrationEntry(srcPath, dstPath);
    totalCopied += result.copied;
    totalFailed += result.failed;

    if (result.copied > 0) {
      const label = entry.endsWith(".md") || entry.endsWith(".yaml")
        ? `Migrated ${entry} from backup.`
        : `Migrated ${result.copied} files from ${entry}/.`;
      await emit({ event: "message", content: label });
    } else if (result.failed > 0) {
      await emit({ event: "message", content: `Could not migrate ${entry} from backup.` });
    }
  }

  const failureSuffix = totalFailed > 0 ? ` ${totalFailed} file${totalFailed === 1 ? "" : "s"} could not be copied.` : "";
  await emit({ event: "message", content: `Migrated ${totalCopied} files from backup to fresh install.${failureSuffix}` });
}

function pathLooksLikeExistingClaudeRoot(claudeDir: string): boolean {
  return existsSync(join(claudeDir, "settings.json")) || existsSync(join(claudeDir, "skills"));
}

export async function moveExistingClaudeToBackup(
  state: InstallState,
  emit: EngineEventHandler
): Promise<void> {
  if (!state.backupPath) return;

  const claudeDir = state.detection?.paiDir || join(homedir(), ".claude");
  if (!existsSync(claudeDir) || !pathLooksLikeExistingClaudeRoot(claudeDir)) return;

  try {
    mkdirSync(dirname(state.backupPath), { recursive: true });
    cpSync(claudeDir, state.backupPath, { recursive: true });
    await emit({
      event: "message",
      content: `Copied existing ~/.claude to ${state.backupPath.replace(homedir(), "~")} before installing the fresh tree.`,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await emit({ event: "message", content: `Could not back up ~/.claude before reinstall: ${reason}` });
    throw err instanceof Error ? err : new Error(reason);
  }

  // The installer is executing from ~/.claude/PAI/PAI-Install right now.
  // Never remove ~/.claude wholesale here; instead clear only the parts the
  // fresh install will replace and explicitly preserve PAI/PAI-Install.
  const removableRoots = [
    "skills",
    "hooks",
    "MEMORY",
    "Plans",
    "tasks",
    "settings.json",
    ".env",
    "CLAUDE.md",
  ];

  for (const relPath of removableRoots) {
    const fullPath = join(claudeDir, relPath);
    if (!existsSync(fullPath)) continue;
    try {
      rmSync(fullPath, { recursive: true, force: true });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await emit({ event: "message", content: `Could not clear ${fullPath.replace(homedir(), "~")}: ${reason}` });
    }
  }

  const paiRoot = join(claudeDir, "PAI");
  if (existsSync(paiRoot)) {
    try {
      for (const entry of readdirSync(paiRoot)) {
        if (entry === "PAI-Install") continue;
        rmSync(join(paiRoot, entry), { recursive: true, force: true });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await emit({ event: "message", content: `Could not fully clear ~/.claude/PAI before reinstall: ${reason}` });
    }
  }
}

// ─── Step 1: System Detection ────────────────────────────────────

export async function runSystemDetect(
  state: InstallState,
  emit: EngineEventHandler,
  getChoice?: ChoicePrompt
): Promise<DetectionResult> {
  await emit({ event: "step_start", step: "system-detect" });
  await emitSectionHeader(
    emit,
    "DETECTING-YOUR-SYSTEM",
    "DETECTING YOUR SYSTEM",
    "Reading OS, tools, and prior installs (no writes yet)",
    1
  );
  await emit({ event: "progress", step: "system-detect", percent: 10, detail: "Detecting operating system..." });

  const detection = detectSystem();
  state.detection = detection;

  await emit({ event: "progress", step: "system-detect", percent: 50, detail: "Checking installed tools..." });

  // Determine install type
  if (detection.existing.paiInstalled) {
    state.installType = "upgrade";
    state.backupPath = computeBackupPath(detection.homeDir);
    await emitSectionHeader(
      emit,
      "EXISTING-INSTALLATION-FOUND",
      "EXISTING INSTALLATION FOUND",
      `Will copy ~/.claude → ${state.backupPath.replace(detection.homeDir, "~")} before installing fresh`
    );

    const consent = getChoice
      ? await getChoice(
          "backup-and-scan-consent",
          `Found existing PAI installation (v${detection.existing.paiVersion || "unknown"}). I'll copy ~/.claude to ${state.backupPath.replace(detection.homeDir, "~")} (your old install stays there until you remove it manually), then install a fresh tree.\n\nHow much of the old install should I read for pre-fill and migration?`,
          [
            {
              label: "Yes — full scan and migrate USER content",
              value: "yes-full",
              description: "Reads prior settings, identity, API keys, and PAI/USER content so it can be migrated into the fresh install.",
            },
            {
              label: "Yes — identity/config only",
              value: "yes-id",
              description: "Reads prior settings and API keys, but skips PAI/USER content scanning and migration.",
            },
            {
              label: "No — install fresh without reading it",
              value: "no",
              description: "Leaves the old tree in the backup only. No pre-fill and no content migration.",
            },
          ],
          state.collected.aiName
        )
      : "yes-full";
    state.collected.scanConsent = consent as InstallState["collected"]["scanConsent"];
  } else {
    state.installType = "fresh";
    state.backupPath = undefined;
    state.collected.scanConsent = "yes-full";
    await emit({ event: "message", content: "No existing PAI installation found. Starting fresh install." });
  }

  if (state.collected.scanConsent !== "no") {
    if (detection.existing.paiInstalled) {
      await emitSectionHeader(
        emit,
        "READING-YOUR-EXISTING-CONFIG",
        "READING YOUR EXISTING CONFIG",
        "Using the consented scope to pre-fill the fresh install"
      );
    }

    if (detection.existing.paiInstalled && detection.existing.settingsPath) {
      try {
        const settings = JSON.parse(readFileSync(detection.existing.settingsPath, "utf-8"));
        detection.existing.paiVersion = settings.pai?.version || settings.paiVersion || "unknown";
        if (settings.principal?.name && !isPlaceholderValue(settings.principal.name)) state.collected.principalName = settings.principal.name;
        if (settings.principal?.timezone && !isPlaceholderValue(settings.principal.timezone)) state.collected.timezone = settings.principal.timezone;
        if (settings.daidentity?.name && !isPlaceholderValue(settings.daidentity.name)) {
          state.collected.aiName = settings.daidentity.name;
          detection.existing.daName = settings.daidentity.name;
        }
        if (settings.daidentity?.startupCatchphrase && !isPlaceholderValue(settings.daidentity.startupCatchphrase)) state.collected.catchphrase = settings.daidentity.startupCatchphrase;
        if (settings.env?.PROJECTS_DIR && !isPlaceholderValue(settings.env.PROJECTS_DIR)) state.collected.projectsDir = settings.env.PROJECTS_DIR;
        if (settings.preferences?.temperatureUnit) state.collected.temperatureUnit = settings.preferences.temperatureUnit;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        await emit({ event: "message", content: `Could not read prior settings.json: ${reason}` });
      }
    }

    detection.existing.apiKeys = scanApiKeys(detection.homeDir, detection.configDir);
    detection.existing.elevenLabsKeyFound = !!detection.existing.apiKeys.elevenLabs;
    detection.existing.hasApiKeys = Object.values(detection.existing.apiKeys).some(Boolean);

    if (!state.collected.principalName && detection.principal?.name) {
      state.collected.principalName = detection.principal.name;
    }
    if (!state.collected.elevenLabsKey && detection.existing.apiKeys?.elevenLabs) {
      state.collected.elevenLabsKey = detection.existing.apiKeys.elevenLabs;
    }
    if (!state.collected.timezone && detection.timezone) {
      state.collected.timezone = detection.timezone;
    }

    if (state.collected.scanConsent === "yes-full" && state.backupPath) {
      const liveUserDir = join(detection.paiDir, "PAI", "USER");
      const backupUserDir = join(state.backupPath, "PAI", "USER");
      if (existsSync(liveUserDir)) {
        try {
          mkdirSync(join(state.backupPath, "PAI"), { recursive: true });
          cpSync(liveUserDir, backupUserDir, { recursive: true });
          detection.existingUserContent = detectExistingUserContent(backupUserDir);
          await emit({
            event: "message",
            content: `Found in your backup: ${summariseExistingUserContent(detection.existingUserContent)}. These will be migrated forward to the new install.`,
          });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          await emit({ event: "message", content: `Could not inspect backup user content: ${reason}` });
        }
      }
    }

    const preFills: string[] = [];
    if (state.collected.principalName) preFills.push(`name=${state.collected.principalName}`);
    if (state.collected.aiName) preFills.push(`DA=${state.collected.aiName}`);
    if (detection.principal?.email) preFills.push(`email=${detection.principal.email}`);
    if (state.collected.timezone) preFills.push(`timezone=${state.collected.timezone}`);
    const apiHits: string[] = [];
    if (detection.existing.apiKeys?.elevenLabs) apiHits.push("ElevenLabs");
    if (detection.existing.apiKeys?.anthropic) apiHits.push("Anthropic");
    if (detection.existing.apiKeys?.openai) apiHits.push("OpenAI");
    if (detection.existing.apiKeys?.google) apiHits.push("Google");
    if (detection.existing.apiKeys?.xai) apiHits.push("xAI/Grok");
    if (detection.existing.apiKeys?.perplexity) apiHits.push("Perplexity");
    if (apiHits.length > 0) preFills.push(`keys=${apiHits.join(",")}`);
    if (preFills.length > 0) {
      await emit({
        event: "message",
        content: `Pre-filled (from your consented scan): ${preFills.join(" · ")}.`,
      });
    }
  }

  await emit({ event: "progress", step: "system-detect", percent: 100, detail: "Detection complete" });
  await emit({ event: "step_complete", step: "system-detect" });
  return detection;
}

// ─── Step 2: Prerequisites ───────────────────────────────────────

export async function runPrerequisites(
  state: InstallState,
  emit: EngineEventHandler
): Promise<void> {
  await emit({ event: "step_start", step: "prerequisites" });
  await emitSectionHeader(
    emit,
    "INSTALLING-PREREQUISITES",
    "INSTALLING PREREQUISITES",
    "Making sure Bun, Git, and Claude Code are available",
    2
  );
  const det = state.detection!;

  // Install Git if missing
  if (!det.tools.git.installed) {
    await emit({ event: "progress", step: "prerequisites", percent: 10, detail: "Installing Git..." });

    if (det.os.platform === "darwin") {
      if (det.tools.brew.installed) {
        const result = tryExec("brew install git", 120000);
        if (result !== null) {
          await emit({ event: "message", content: "Git installed via Homebrew." });
        } else {
          await emit({ event: "message", content: "Xcode Command Line Tools should include Git. Run: xcode-select --install" });
        }
      } else {
        await emit({ event: "message", content: "Please install Git: xcode-select --install" });
      }
    } else {
      // Linux
      const pkgMgr = tryExec("which apt-get") ? "apt-get" : tryExec("which yum") ? "yum" : null;
      if (pkgMgr) {
        tryExec(`sudo ${pkgMgr} install -y git`, 120000);
        await emit({ event: "message", content: `Git installed via ${pkgMgr}.` });
      }
    }
  } else {
    await emit({ event: "progress", step: "prerequisites", percent: 20, detail: `Git found: v${det.tools.git.version}` });
  }

  // Check for unzip — required by bun installer but missing on minimal Linux installs
  // Fixes: https://github.com/danielmiessler/Personal_AI_Infrastructure/issues/856
  if (!det.tools.bun.installed && det.os.platform === "linux") {
    const hasUnzip = tryExec("which unzip", 5000);
    if (hasUnzip === null) {
      await emit({ event: "progress", step: "prerequisites", percent: 35, detail: "Installing unzip (required by Bun)..." });

      // Try common package managers
      const installed =
        tryExec("sudo apt-get install -y unzip 2>/dev/null", 30000) !== null ||
        tryExec("sudo dnf install -y unzip 2>/dev/null", 30000) !== null ||
        tryExec("sudo yum install -y unzip 2>/dev/null", 30000) !== null ||
        tryExec("sudo pacman -S --noconfirm unzip 2>/dev/null", 30000) !== null;

      if (installed) {
        await emit({ event: "message", content: "unzip installed successfully." });
      } else {
        await emit({
          event: "message",
          content: "Could not install 'unzip' automatically. Bun requires it.\n   Please install manually: sudo apt install unzip (Debian/Ubuntu) or sudo dnf install unzip (Fedora/RHEL)",
        });
      }
    }
  }

  // Bun should already be installed by bootstrap script, but verify
  if (!det.tools.bun.installed) {
    await emit({ event: "progress", step: "prerequisites", percent: 40, detail: "Installing Bun..." });
    const result = tryExec("curl -fsSL https://bun.sh/install | bash", 60000);
    if (result !== null) {
      // Update PATH
      const bunBin = join(homedir(), ".bun", "bin");
      process.env.PATH = `${bunBin}:${process.env.PATH}`;
      await emit({ event: "message", content: "Bun installed successfully." });
      deduplicateBunShellEntries(); // Fix #954: clean up duplicate entries from retries
    }
  } else {
    await emit({ event: "progress", step: "prerequisites", percent: 50, detail: `Bun found: v${det.tools.bun.version}` });
  }

  // Install Claude Code if missing
  if (!det.tools.claude.installed) {
    await emit({ event: "progress", step: "prerequisites", percent: 70, detail: "Installing Claude Code..." });

    // Try npm first (most common), then bun
    const npmResult = tryExec("npm install -g @anthropic-ai/claude-code", 120000);
    if (npmResult !== null) {
      await emit({ event: "message", content: "Claude Code installed via npm." });
    } else {
      // Try with bun
      const bunResult = tryExec("bun install -g @anthropic-ai/claude-code", 120000);
      if (bunResult !== null) {
        await emit({ event: "message", content: "Claude Code installed via bun." });
      } else {
        await emit({
          event: "message",
          content: "Could not install Claude Code automatically. Please install manually: npm install -g @anthropic-ai/claude-code",
        });
      }
    }
  } else {
    await emit({ event: "progress", step: "prerequisites", percent: 80, detail: `Claude Code found: v${det.tools.claude.version}` });
  }

  await emit({ event: "progress", step: "prerequisites", percent: 100, detail: "All prerequisites ready" });
  await emit({ event: "step_complete", step: "prerequisites" });
}

// ─── Step 3: API Keys (passthrough — key collection moved to Voice Setup) ──

export async function runApiKeys(
  state: InstallState,
  emit: EngineEventHandler,
  _getInput: InputPrompt,
  _getChoice: ChoicePrompt
): Promise<void> {
  // ElevenLabs key collection is now handled in the Voice Setup step
  // This step auto-completes to keep the step numbering consistent
  await emit({ event: "step_start", step: "api-keys" });
  await emitSectionHeader(
    emit,
    "API-KEYS",
    "API KEYS",
    "Voice-related keys are collected later when they are actually needed",
    3
  );
  await emit({ event: "message", content: "API keys will be collected during Voice Setup." });
  await emit({ event: "step_complete", step: "api-keys" });
}

// ─── Step 4: Identity ────────────────────────────────────────────

export async function runIdentity(
  state: InstallState,
  emit: EngineEventHandler,
  getInput: InputPrompt
): Promise<void> {
  await emit({ event: "step_start", step: "identity" });
  await emitSectionHeader(
    emit,
    "YOUR-IDENTITY",
    "YOUR IDENTITY",
    "Confirming the human and DA details that personalize this install",
    4
  );

  // Name — pre-fill the input with first name only (not full name).
  // The placeholder is the value the input shows by default; the frontend
  // renders it into both `value=` (so Enter accepts) and `placeholder=`.
  const fullDetectedName = state.collected.principalName || "";
  const detectedFirstName = fullDetectedName.split(/\s+/)[0] || "";
  const namePrompt = detectedFirstName
    ? `What is your first name? (Press Enter to keep: ${detectedFirstName})`
    : "What is your first name?";
  const name = await getInput(
    "principal-name",
    namePrompt,
    "text",
    detectedFirstName,
    state.collected.aiName
  );
  state.collected.principalName = name.trim() || detectedFirstName || "User";

  // Timezone
  const detectedTz = state.detection?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tz = await getInput(
    "timezone",
    `Detected timezone: ${detectedTz}. Press Enter to confirm or type a different one.`,
    "text",
    detectedTz,
    state.collected.aiName
  );
  state.collected.timezone = tz.trim() || detectedTz;

  // Temperature unit
  const defaultTempUnit = state.collected.temperatureUnit || "fahrenheit";
  const tempUnit = await getInput(
    "temperature-unit",
    `Temperature unit? Type F for Fahrenheit or C for Celsius. (Default: ${defaultTempUnit === "celsius" ? "C" : "F"})`,
    "text",
    defaultTempUnit === "celsius" ? "C" : "F",
    state.collected.aiName
  );
  const trimmedUnit = tempUnit.trim().toLowerCase();
  state.collected.temperatureUnit = (trimmedUnit === "c" || trimmedUnit === "celsius") ? "celsius" : "fahrenheit";

  // AI Name
  const defaultAi = state.collected.aiName || "";
  const aiPrompt = defaultAi
    ? `What would you like to name your AI assistant? (Press Enter to keep: ${defaultAi})`
    : "What would you like to name your AI assistant?";
  const aiName = await getInput(
    "ai-name",
    aiPrompt,
    "text",
    "e.g., Atlas, Nova, Sage",
    state.collected.aiName
  );
  state.collected.aiName = aiName.trim() || defaultAi || "PAI";

  // Catchphrase
  const defaultCatch = state.collected.catchphrase || `${state.collected.aiName} here, ready to go`;
  const catchphrase = await getInput(
    "catchphrase",
    `Startup catchphrase for ${state.collected.aiName}?`,
    "text",
    defaultCatch,
    state.collected.aiName
  );
  state.collected.catchphrase = catchphrase.trim() || defaultCatch;

  // Projects directory (optional)
  const defaultProjects = state.collected.projectsDir || "";
  const projDir = await getInput(
    "projects-dir",
    "Projects directory (optional, press Enter to skip):",
    "text",
    defaultProjects || "~/Projects",
    state.collected.aiName
  );
  if (projDir.trim()) {
    state.collected.projectsDir = projDir.trim().replace(/^~/, homedir());
  }

  await emit({
    event: "message",
    content: `Identity configured: ${state.collected.principalName} with AI assistant ${state.collected.aiName}.`,
    speak: true,
  });
  await emit({ event: "step_complete", step: "identity" });
}

// ─── Step 5: Repository ──────────────────────────────────────────

// ─── Local Bundle Detection & Install ───────────────────────────
//
// install.sh exports PAI_BUNDLE_DIR pointing to its own directory — the
// root of the v5 release bundle. The wizard prefers installing from this
// local bundle over git-cloning the public repo, because the public repo
// may lag the current release. The bundle is the canonical source of
// truth for the version it represents.
//
// Marker files prove the bundle is complete; missing markers fall back
// to git clone so users who run main.ts directly (no bundle) still work.

const BUNDLE_MARKERS = [
  "install.sh",
  "settings.json",
  "hooks/SecurityPipeline.hook.ts",
  "PAI/PAI-Install/main.ts",
];

const BUNDLE_COPY_EXCLUDES = new Set([
  ".git",
  "node_modules",
  "PAI_RELEASES",
  "install-state.json",
  ".DS_Store",
  ".tmp",
  ".quote-cache",
]);

function detectLocalBundle(): string | null {
  const bundleRoot = process.env.PAI_BUNDLE_DIR;
  if (!bundleRoot || !existsSync(bundleRoot)) return null;
  for (const marker of BUNDLE_MARKERS) {
    if (!existsSync(join(bundleRoot, marker))) return null;
  }
  return bundleRoot;
}

function copyBundleTree(
  src: string,
  dst: string,
  stats: { files: number; bytes: number } = { files: 0, bytes: 0 }
): { files: number; bytes: number } {
  if (!existsSync(dst)) mkdirSync(dst, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (BUNDLE_COPY_EXCLUDES.has(entry.name)) continue;

    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);

    if (entry.isDirectory()) {
      copyBundleTree(srcPath, dstPath, stats);
    } else if (entry.isSymbolicLink()) {
      try {
        const target = readlinkSync(srcPath);
        if (existsSync(dstPath)) unlinkSync(dstPath);
        symlinkSync(target, dstPath);
      } catch {
        // skip broken symlinks
      }
    } else if (entry.isFile()) {
      try {
        cpSync(srcPath, dstPath);
        stats.files++;
        stats.bytes += lstatSync(srcPath).size;
      } catch {
        // permission errors are non-fatal
      }
    }
  }
  return stats;
}

async function installFromLocalBundle(
  bundleDir: string,
  targetDir: string,
  emit: EngineEventHandler
): Promise<{ files: number; bytes: number }> {
  await emit({
    event: "progress",
    step: "repository",
    percent: 30,
    detail: `Installing from local v5 bundle...`,
  });
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  const stats = copyBundleTree(bundleDir, targetDir);
  await emit({
    event: "progress",
    step: "repository",
    percent: 90,
    detail: `Copied ${stats.files} files (${(stats.bytes / 1024 / 1024).toFixed(1)} MB).`,
  });
  return stats;
}

export async function runRepository(
  state: InstallState,
  emit: EngineEventHandler
): Promise<void> {
  await emit({ event: "step_start", step: "repository" });
  await emitSectionHeader(
    emit,
    "INSTALLING-THE-PAI-TREE",
    "INSTALLING THE PAI TREE",
    "Laying down a fresh ~/.claude tree and restoring any consented content",
    5
  );
  const paiDir = state.detection?.paiDir || join(homedir(), ".claude");

  await moveExistingClaudeToBackup(state, emit);

  if (!existsSync(paiDir)) {
    mkdirSync(paiDir, { recursive: true });
  }

  // The backup we just created IS a complete v5 bundle (it's a copy of the
  // staging tree this installer shipped with). Use it as the install source
  // — never reach out to GitHub when we already have the tree on disk.
  // Falls through to PAI_BUNDLE_DIR / git-clone only if the backup path is
  // missing markers (e.g. user explicitly skipped backup, or partial copy).
  if (state.backupPath && existsSync(state.backupPath)) {
    const backupHasMarkers = BUNDLE_MARKERS.every((m) =>
      existsSync(join(state.backupPath!, m))
    );
    if (backupHasMarkers) {
      process.env.PAI_BUNDLE_DIR = state.backupPath;
      await emit({
        event: "message",
        content: `Using your backup as the install source — no GitHub clone needed.`,
      });
    }
  }

  const localBundle = detectLocalBundle();
  let bundleInstalled = false;

  if (localBundle) {
    await emit({
      event: "message",
      content: `Local v5 bundle detected at ${localBundle}. Installing from bundle (skipping git clone).`,
    });
    try {
      const stats = await installFromLocalBundle(localBundle, paiDir, emit);
      await emit({
        event: "message",
        content: `Installed ${stats.files} files from local bundle (${(stats.bytes / 1024 / 1024).toFixed(1)} MB).`,
      });
      bundleInstalled = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await emit({
        event: "message",
        content: `Local bundle install failed: ${msg}. Falling back to git clone.`,
      });
    }
  } else if (process.env.PAI_BUNDLE_DIR) {
    await emit({
      event: "message",
      content: `PAI_BUNDLE_DIR set but bundle is incomplete (missing marker files). Falling back to git clone.`,
    });
  }

  if (!bundleInstalled) {
    await emit({ event: "progress", step: "repository", percent: 20, detail: "Cloning PAI repository..." });

    const cloneResult = tryExec(
      `git clone https://github.com/danielmiessler/PAI.git "${paiDir}" 2>&1`,
      120000
    );

    if (cloneResult !== null) {
      await emit({ event: "message", content: "PAI repository cloned successfully." });
    } else {
      await emit({ event: "progress", step: "repository", percent: 50, detail: "Directory exists, trying alternative approach..." });

      const initResult = tryExec(`cd "${paiDir}" && git init && git remote add origin https://github.com/danielmiessler/PAI.git && git fetch origin && git checkout -b main origin/main 2>&1`, 120000);
      if (initResult !== null) {
        await emit({ event: "message", content: "PAI repository initialized and synced." });
      } else {
        await emit({
          event: "message",
          content: "Could not clone PAI repo automatically. You can clone it manually later: git clone https://github.com/danielmiessler/PAI.git ~/.claude",
        });
      }
    }
  }

  // Create required directories regardless of clone result
  const requiredDirs = [
    "MEMORY",
    "MEMORY/STATE",
    "MEMORY/LEARNING",
    "MEMORY/WORK",
    "MEMORY/RELATIONSHIP",
    "MEMORY/VOICE",
    "Plans",
    "hooks",
    "skills",
    "tasks",
  ];

  for (const dir of requiredDirs) {
    const fullPath = join(paiDir, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  }

  if (state.collected.scanConsent !== "no" && state.backupPath) {
    await emitSectionHeader(
      emit,
      "MIGRATING-YOUR-USER-CONTENT",
      "MIGRATING YOUR USER CONTENT",
      "Restoring your TELOS, identity, and personal docs from the backup"
    );
    await migrateUserContentFromBackup(state, emit);
  }

  await migrateUserContext(paiDir, emit);

  await emit({ event: "progress", step: "repository", percent: 100, detail: "Repository ready" });
  await emit({ event: "step_complete", step: "repository" });
}

// ─── Step 6: Configuration ───────────────────────────────────────

export async function runConfiguration(
  state: InstallState,
  emit: EngineEventHandler
): Promise<void> {
  await emit({ event: "step_start", step: "configuration" });
  await emitSectionHeader(
    emit,
    "GENERATING-CONFIGURATION",
    "GENERATING CONFIGURATION",
    "Writing settings, env files, aliases, and identity templates",
    6
  );
  const paiDir = state.detection?.paiDir || join(homedir(), ".claude");
  const configDir = state.detection?.configDir || join(homedir(), ".config", "PAI");

  // Generate settings.json
  await emit({ event: "progress", step: "configuration", percent: 20, detail: "Generating settings.json..." });

  const config = generateSettingsJson({
    principalName: state.collected.principalName || "User",
    timezone: state.collected.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    aiName: state.collected.aiName || "PAI",
    catchphrase: state.collected.catchphrase || "Ready to go",
    projectsDir: state.collected.projectsDir,
    temperatureUnit: state.collected.temperatureUnit,
    voiceType: state.collected.voiceType,
    voiceId: state.collected.customVoiceId,
    paiDir,
    configDir,
  });

  const settingsPath = join(paiDir, "settings.json");

  // The release ships a complete settings.json with hooks, statusLine, spinnerVerbs, etc.
  // We only update user-specific fields — never overwrite the whole file.
  if (existsSync(settingsPath)) {
    try {
      const existing = JSON.parse(readFileSync(settingsPath, "utf-8"));
      // Merge only installer-managed fields; preserve everything else
      existing.env = { ...existing.env, ...config.env };
      existing.principal = { ...existing.principal, ...config.principal };
      existing.daidentity = { ...existing.daidentity, ...config.daidentity };
      existing.pai = { ...existing.pai, ...config.pai };
      // Force-overwrite version fields — these must ALWAYS match the release,
      // never be preserved from the user's existing config (fix for #800)
      existing.pai.version = PAI_VERSION;
      existing.pai.algorithmVersion = ALGORITHM_VERSION;
      existing.preferences = { ...existing.preferences, ...config.preferences };
      // Only set permissions/contextFiles/plansDirectory if not already present
      if (!existing.permissions) existing.permissions = config.permissions;
      if (!existing.contextFiles) existing.contextFiles = config.contextFiles;
      if (!existing.plansDirectory) existing.plansDirectory = config.plansDirectory;
      // Never touch: hooks, statusLine, spinnerVerbs, contextFiles (if present)
      writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
    } catch {
      // Existing file is corrupt — write fresh as fallback
      writeFileSync(settingsPath, JSON.stringify(config, null, 2));
    }
  } else {
    writeFileSync(settingsPath, JSON.stringify(config, null, 2));
  }
  await emit({ event: "message", content: "settings.json generated." });

  // Algorithm LATEST is the single source of truth (v6.2.0+ doctrine).
  // Path is canonical uppercase ALGORITHM (case-sensitive on Linux).
  // Prefer the staged tree's LATEST if it shipped one; otherwise write the
  // ALGORITHM_VERSION fallback. The previous version skipped writing when
  // `latestDir` was missing — that left fresh installs (where the bundle
  // lacked PAI/ALGORITHM/) with no LATEST file at all, and the statusline
  // displayed `ALG: —` forever. Always ensure both directory and a non-empty
  // LATEST exist by the time configuration completes.
  const latestDir = join(paiDir, "PAI", "ALGORITHM");
  const latestPath = join(latestDir, "LATEST");
  let latestExisting = "";
  try { latestExisting = readFileSync(latestPath, "utf-8").trim(); } catch {}
  if (!latestExisting) {
    try {
      mkdirSync(latestDir, { recursive: true });
      writeFileSync(latestPath, `${ALGORITHM_VERSION}\n`);
      await emit({ event: "message", content: `Algorithm LATEST written from constant fallback (${ALGORITHM_VERSION}) — bundle did not ship one.` });
    } catch (err) {
      await emit({ event: "message", content: `WARNING: failed to write Algorithm LATEST: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // Calculate and write initial counts so banner shows real numbers on first launch
  await emit({ event: "progress", step: "configuration", percent: 35, detail: "Calculating system counts..." });
  try {
    const countFiles = (dir: string, ext?: string): number => {
      if (!existsSync(dir)) return 0;
      let count = 0;
      const walk = (d: string) => {
        try {
          for (const entry of readdirSync(d, { withFileTypes: true })) {
            if (entry.isDirectory()) walk(join(d, entry.name));
            else if (!ext || entry.name.endsWith(ext)) count++;
          }
        } catch {}
      };
      walk(dir);
      return count;
    };

    const countDirs = (dir: string, filter?: (name: string) => boolean): number => {
      if (!existsSync(dir)) return 0;
      try {
        return readdirSync(dir, { withFileTypes: true })
          .filter(e => e.isDirectory() && (!filter || filter(e.name))).length;
      } catch { return 0; }
    };

    const skillCount = countDirs(join(paiDir, "skills"), (name) =>
      existsSync(join(paiDir, "skills", name, "SKILL.md")));
    const hookCount = countFiles(join(paiDir, "hooks"), ".ts");
    const signalCount = countFiles(join(paiDir, "MEMORY", "LEARNING"), ".md");
    const fileCount = countFiles(join(paiDir, "skills", "PAI", "USER"));
    // Count workflows by scanning skill Tools directories for .ts files
    let workflowCount = 0;
    const skillsDir = join(paiDir, "skills");
    if (existsSync(skillsDir)) {
      try {
        for (const s of readdirSync(skillsDir, { withFileTypes: true })) {
          if (s.isDirectory()) {
            const toolsDir = join(skillsDir, s.name, "Tools");
            if (existsSync(toolsDir)) {
              workflowCount += countFiles(toolsDir, ".ts");
            }
          }
        }
      } catch {}
    }

    // Write counts to settings.json
    const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    currentSettings.counts = {
      skills: skillCount,
      workflows: workflowCount,
      hooks: hookCount,
      signals: signalCount,
      files: fileCount,
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));
  } catch {
    // Non-fatal — banner will just show 0 until first session ends
  }

  // Render identity into the user-facing markdown.
  // CLAUDE.md ships with `{DA_IDENTITY.NAME}` / `{PRINCIPAL.NAME}` tokens
  // (because the public release can't know either yet) and DA_IDENTITY.md
  // / PRINCIPAL_IDENTITY.md ship as bootstrap defaults. Without this step,
  // the model literalises the curly-brace tokens at runtime and shows
  // `{{DA_NAME}}` in chat instead of the user's actual DA name.
  await emit({ event: "progress", step: "configuration", percent: 42, detail: "Personalising identity files..." });
  const aiName = state.collected.aiName || "PAI";
  const principalName = state.collected.principalName || "User";

  const claudeMdPath = join(paiDir, "CLAUDE.md");
  if (existsSync(claudeMdPath)) {
    try {
      const content = readFileSync(claudeMdPath, "utf-8")
        .replace(/\{DA_IDENTITY\.NAME\}/g, aiName)
        .replace(/\{PRINCIPAL\.NAME\}/g, principalName);
      writeFileSync(claudeMdPath, content);
    } catch {}
  }

  const daIdentityPath = join(paiDir, "PAI", "USER", "DA_IDENTITY.md");
  if (existsSync(daIdentityPath)) {
    try {
      const content = readFileSync(daIdentityPath, "utf-8")
        // Title — lenient match for any DA Identity heading
        .replace(/^# DA Identity — .+$/m, `# DA Identity — ${aiName}`)
        // Body Name/Full Name/Display line — structural match (any current values),
        // not literal "PAI Assistant", so the replace works regardless of which
        // template variant is on disk (fixes the "PAI | PAI | PAI" + "Kergan title"
        // drift case where title got updated but body did not).
        .replace(
          /^- \*\*Name:\*\* [^|\n]+\| \*\*Full Name:\*\* [^|\n]+\| \*\*Display:\*\* [^\n]+$/m,
          `- **Name:** ${aiName} | **Full Name:** ${aiName} | **Display:** ${aiName}`
        )
        // Self-introduction line — match either template variant
        .replace(/I am PAI, (the user's|User's) AI assistant/g, `I am ${aiName}, ${principalName}'s AI assistant`);
      writeFileSync(daIdentityPath, content);
    } catch {}
  }

  const principalIdPath = join(paiDir, "PAI", "USER", "PRINCIPAL_IDENTITY.md");
  if (existsSync(principalIdPath)) {
    try {
      const content = readFileSync(principalIdPath, "utf-8")
        .replace(/^# Principal Identity — .+$/m, `# Principal Identity — ${principalName}`);
      writeFileSync(principalIdPath, content);
    } catch {}
  }

  // Create .env file for API keys
  await emit({ event: "progress", step: "configuration", percent: 50, detail: "Setting up API keys..." });

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const envPath = join(configDir, ".env");
  let envContent = "";

  if (state.collected.elevenLabsKey) {
    envContent += `ELEVENLABS_API_KEY=${state.collected.elevenLabsKey}\n`;
  }

  if (envContent) {
    writeFileSync(envPath, envContent, { mode: 0o600 });
    await emit({ event: "message", content: "API keys saved securely." });
  }

  // Create symlinks so all consumers can find the .env
  // Voice server reads ~/.env, hooks read ~/.claude/.env
  if (existsSync(envPath)) {
    const symlinkPaths = [
      join(paiDir, ".env"),         // ~/.claude/.env
      join(homedir(), ".env"),      // ~/.env (voice server reads this)
    ];
    for (const symlinkPath of symlinkPaths) {
      try {
        // Remove stale symlink or file before creating
        if (existsSync(symlinkPath)) {
          const stat = lstatSync(symlinkPath);
          if (stat.isSymbolicLink()) {
            unlinkSync(symlinkPath);
          } else {
            continue; // Don't overwrite a real file
          }
        }
        symlinkSync(envPath, symlinkPath);
      } catch {
        // Permission error or path conflict
      }
    }
  }

  // Set up shell alias (detect bash/zsh/fish)
  await emit({ event: "progress", step: "configuration", percent: 80, detail: "Setting up shell alias..." });

  const userShell = process.env.SHELL || "/bin/zsh";
  const rcFile = userShell.includes("bash") ? ".bashrc" : userShell.includes("fish") ? ".config/fish/config.fish" : ".zshrc";
  const rcPath = join(homedir(), rcFile);
  const aliasLine = `alias pai='bun ${join(paiDir, "PAI", "TOOLS", "pai.ts")}'`;
  const marker = "# PAI alias";

  if (existsSync(rcPath)) {
    let content = readFileSync(rcPath, "utf-8");
    // Remove any existing pai alias (old CORE or PAI paths, any marker variant)
    content = content.replace(/^#\s*(?:PAI|CORE)\s*alias.*\n.*alias pai=.*\n?/gm, "");
    content = content.replace(/^alias pai=.*\n?/gm, "");
    // Add fresh alias
    content = content.trimEnd() + `\n\n${marker}\n${aliasLine}\n`;
    writeFileSync(rcPath, content);
  } else {
    writeFileSync(rcPath, `${marker}\n${aliasLine}\n`);
  }

  // Fix permissions
  await emit({ event: "progress", step: "configuration", percent: 90, detail: "Setting permissions..." });
  try {
    tryExec(`chmod -R 755 "${paiDir}"`, 10000);
  } catch {
    // Non-fatal
  }

  await emit({ event: "progress", step: "configuration", percent: 100, detail: "Configuration complete" });
  await emit({ event: "step_complete", step: "configuration" });
}

// ─── Voice Server Management ────────────────────────────────────

// PAI 5.0 absorbed the standalone voice server into Pulse on port 31337.
// `PAI/PULSE/VoiceServer/voice.ts` is now an embeddable module that pulse.ts
// loads on startup; there is no separate voice-server process. Health-check
// the voice surface by probing Pulse on /notify.
async function isPulseRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:31337/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "", voice_enabled: false }),
      signal: AbortSignal.timeout(2000),
    });
    // Any non-network response (200/204/4xx) means Pulse is up and routing /notify.
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

// Install Pulse as a launchd agent via the canonical `PULSE/manage.sh install`.
// Manage.sh substitutes __HOME__ in the public plist template, copies it to
// ~/Library/LaunchAgents/com.pai.pulse.plist, and `launchctl load`s it.
async function installPulse(paiDir: string, emit: EngineEventHandler): Promise<boolean> {
  const pulseDir = join(paiDir, "PAI", "PULSE");
  const manageScript = join(pulseDir, "manage.sh");

  if (!existsSync(manageScript)) {
    await emit({ event: "message", content: "Pulse not found in installation. Voice notifications will be unavailable." });
    return false;
  }

  await emit({ event: "progress", step: "voice", percent: 20, detail: "Installing Pulse (voice + dashboard + observability)..." });

  try {
    const installOk = await new Promise<boolean>((resolve) => {
      const child = spawn("bash", [manageScript, "install"], {
        cwd: pulseDir,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const timer = setTimeout(() => { child.kill(); resolve(false); }, 30000);
      child.on("close", (code) => { clearTimeout(timer); resolve(code === 0); });
      child.on("error", () => { clearTimeout(timer); resolve(false); });
    });

    if (!installOk) {
      await emit({ event: "message", content: "Pulse install command failed. Voice notifications will not be available." });
      return false;
    }

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await isPulseRunning()) {
        await emit({ event: "message", content: "Pulse installed and running on port 31337 (voice + dashboard + observability)." });
        return true;
      }
    }
    // Pulse plist installed but never bound :31337. Surface this as an install
    // failure rather than silently reporting success — the user will hit
    // mysterious 'voice not working' / 'pulse not starting' otherwise.
    await emit({ event: "message", content: "Pulse plist installed but port 31337 did not bind within 10s. Check ~/.claude/PAI/PULSE/logs/pulse-stderr.log. Voice and dashboard will not work until this is resolved." });
    return false;
  } catch {
    await emit({ event: "message", content: "Could not install Pulse. Voice notifications will not be available." });
    return false;
  }
}

// Reload Pulse so it re-reads settings.json after a config change. Called at
// the end of voice setup so the user's DA voice pick (written to settings.json
// AFTER Pulse was installed and started) is actually honored at runtime.
//
// Without this, Pulse's `defaultVoiceId` cache is stale: Pulse boots from the
// template settings during initial install, then the wizard rewrites the voice
// section, but Pulse never reloads — so every skill curl that omits voice_id
// hits Pulse's stale cached default instead of the user's chosen DA voice.
// `manage.sh restart` is idempotent: unloads the launchd plist, kills any
// stale `bun pulse.ts`, reloads, waits up to 10s for :31337 to bind.
async function reloadPulse(paiDir: string, emit: EngineEventHandler): Promise<void> {
  const manageScript = join(paiDir, "PAI", "PULSE", "manage.sh");
  if (!existsSync(manageScript)) return;
  const homeLaunchAgent = join(homedir(), "Library", "LaunchAgents", "com.pai.pulse.plist");
  if (!existsSync(homeLaunchAgent)) return;
  await emit({ event: "message", content: "Reloading Pulse to pick up new voice configuration..." });
  await new Promise<void>((resolve) => {
    const child = spawn("bash", [manageScript, "restart"], {
      cwd: dirname(manageScript),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => { child.kill(); resolve(); }, 30000);
    child.on("close", () => { clearTimeout(timer); resolve(); });
    child.on("error", () => { clearTimeout(timer); resolve(); });
  });
}

// Optional menu bar app — separate launchd plist + macOS .app bundle.
async function installPulseMenuBar(paiDir: string, emit: EngineEventHandler): Promise<boolean> {
  const menuBarInstall = join(paiDir, "PAI", "PULSE", "MenuBar", "install.sh");
  if (!existsSync(menuBarInstall)) {
    await emit({ event: "message", content: "Menu bar installer not found — skipping." });
    return false;
  }

  await emit({ event: "progress", step: "voice", percent: 35, detail: "Installing Pulse menu bar app..." });

  try {
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn("bash", [menuBarInstall], {
        cwd: dirname(menuBarInstall),
        stdio: ["ignore", "pipe", "pipe"],
      });
      const timer = setTimeout(() => { child.kill(); resolve(false); }, 120000);
      child.on("close", (code) => { clearTimeout(timer); resolve(code === 0); });
      child.on("error", () => { clearTimeout(timer); resolve(false); });
    });

    if (ok) {
      await emit({ event: "message", content: "Menu bar app installed — look for the Pulse icon in your menu bar." });
      return true;
    }
    await emit({ event: "message", content: "Menu bar install did not complete. You can run it later: bash ~/.claude/PAI/PULSE/MenuBar/install.sh" });
    return false;
  } catch {
    return false;
  }
}

// ─── Step 7: Voice Setup ─────────────────────────────────────────

export async function runVoiceSetup(
  state: InstallState,
  emit: EngineEventHandler,
  getChoice: ChoicePrompt,
  getInput: InputPrompt,
  getChoiceWithPreview?: ChoicePreviewPrompt
): Promise<void> {
  await emit({ event: "step_start", step: "voice" });
  await emitSectionHeader(
    emit,
    "DA-VOICE-SETUP",
    "DA VOICE SETUP",
    "Configuring speech, Pulse, and the DA's default voice",
    7
  );
  const daName = state.collected.aiName;

  // ── Upfront scan permission gate (UNCONDITIONAL) ──
  //
  // The very first prompt of the voice step. Fires regardless of whether
  // anything is found — the user authorizes the scan BEFORE any read
  // happens. This is the point: don't silently touch `~/.config/PAI/.env`,
  // `~/.claude*` backup dirs, or stale settings.json voice configs without
  // the user's explicit OK, even when the read would return nothing.
  //
  // If the user says yes → run `inventoryExistingConfig()` and present
  // findings (per-item confirmation handled below in key + voice picker).
  // If the user says no → never read those locations; go straight to
  // "provide your own key OR skip voice".
  const allowScanChoice = await getChoice(
    "scan-prior-config",
    "Look in backup directories and your prior PAI config for existing ElevenLabs voice IDs and API keys?",
    [
      { label: "Yes — scan and let me confirm anything found", value: "yes", description: "Reads ~/.config/PAI/.env and any ~/.claude.bak / ~/.claude-bak / ~/.claude.backup.* / ~/.claude.previous etc. Per-item confirmation before anything is imported." },
      { label: "No — start completely fresh", value: "no", description: "Skip the scan. I'll either enter a new ElevenLabs key or skip voice entirely." },
    ],
    daName
  );
  const allowImportPriorConfig = allowScanChoice === "yes";

  // Surface the inventory ONLY if the user authorized it.
  if (allowImportPriorConfig) {
    const inventory = inventoryExistingConfig();
    if (inventory.signals.length > 0) {
      await emit({
        event: "message",
        content:
          "Scanning prior config — found:\n  • " +
          inventory.signals.join("\n  • ") +
          "\n\nEach will be presented for individual confirmation below.",
      });
    } else {
      await emit({
        event: "message",
        content: "Scanned prior config — nothing found. Continuing to fresh-key prompt.",
      });
    }
  }

  // ── Collect ElevenLabs key — only reads existing locations if user opted in ──
  if (!state.collected.elevenLabsKey) {
    let elevenLabsKey = "";

    if (allowImportPriorConfig) {
      // Step 1: Check active locations (~/.claude/.env, ~/.config/PAI/.env).
      await emit({ event: "progress", step: "voice", percent: 5, detail: "Checking existing ElevenLabs key locations..." });
      const candidate = findExistingEnvKey("ELEVENLABS_API_KEY");
      if (candidate) {
        const useIt = await getChoice("confirm-active-key", `Found ElevenLabs API key in ~/.claude/.env or ~/.config/PAI/.env. Use it?`, [
          { label: "Yes — validate and use", value: "yes" },
          { label: "No — skip this one", value: "no" },
        ], daName);
        if (useIt === "yes") {
          await emit({ event: "message", content: "Validating key against ElevenLabs API..." });
          const result = await validateElevenLabsKey(candidate);
          if (result.valid) {
            state.collected.elevenLabsKey = candidate;
            elevenLabsKey = candidate;
            await emit({ event: "message", content: "Existing ElevenLabs API key is valid." });
          } else {
            await emit({ event: "message", content: `Key invalid: ${result.error}. Continuing search.` });
          }
        }
      }

      // Step 2: Check backup .claude* directories with per-finding confirmation.
      if (!elevenLabsKey) {
        const backupHits = findKeyInBackupDirs("ELEVENLABS_API_KEY");
        for (const hit of backupHits) {
          const useThis = await getChoice(`confirm-backup-${hit.path}`, `Found ElevenLabs key in ${hit.path.replace(homedir(), "~")}. Use it?`, [
            { label: "Yes — validate and use", value: "yes" },
            { label: "No — skip this one", value: "no" },
          ], daName);
          if (useThis !== "yes") continue;
          await emit({ event: "progress", step: "voice", percent: 10, detail: `Validating key from ${hit.path.replace(homedir(), "~")}...` });
          const result = await validateElevenLabsKey(hit.value);
          if (result.valid) {
            state.collected.elevenLabsKey = hit.value;
            elevenLabsKey = hit.value;
            await emit({ event: "message", content: `Using ElevenLabs key from ${hit.path.replace(homedir(), "~")}.` });
            break;
          } else {
            await emit({ event: "message", content: `Key from ${hit.path.replace(homedir(), "~")} invalid: ${result.error}.` });
          }
        }
      }
    }

    // Step 3: If no key was imported (either declined upfront, or no valid key found,
    // or scanning was permitted but every candidate was skipped/invalid), prompt the user.
    if (!elevenLabsKey) {
      const wantsVoice = await getChoice("voice-enable", "Voice requires an ElevenLabs API key. Get one free at elevenlabs.io — without a key, voice notifications are disabled.", [
        { label: "I have a key — let me enter it", value: "yes" },
        { label: "Skip voice for now", value: "skip", description: "You can add a key later: edit ~/.config/PAI/.env" },
      ], daName);

      if (wantsVoice === "yes") {
        const key = await getInput(
          "elevenlabs-key",
          "Enter your ElevenLabs API key:",
          "key",
          "sk_...",
          daName
        );

        if (key.trim()) {
          await emit({ event: "progress", step: "voice", percent: 15, detail: "Validating ElevenLabs key..." });
          const result = await validateElevenLabsKey(key.trim());
          if (result.valid) {
            state.collected.elevenLabsKey = key.trim();
            await emit({ event: "message", content: "ElevenLabs API key verified." });
          } else {
            await emit({ event: "message", content: `Key validation failed: ${result.error}. Skipping voice setup.` });
          }
        }
      }
    }
  }

  const hasElevenLabsKey = !!state.collected.elevenLabsKey;
  if (!hasElevenLabsKey) {
    await emit({ event: "message", content: "No ElevenLabs key — voice will fall back to macOS text-to-speech. You can add a key later in ~/.claude/.env" });
  }

  const paiDir = state.detection?.paiDir || join(homedir(), ".claude");

  // ── Write ELEVENLABS_API_KEY to ~/.claude/.env BEFORE Pulse starts ──
  // Pulse loads .env at boot. If we install Pulse before writing the key,
  // the daemon comes up without ELEVENLABS_API_KEY in process.env and voice
  // silently falls back to macOS `say` — even after the configuration step
  // writes .env later. The fix: write the key now, then start Pulse.
  if (hasElevenLabsKey) {
    try {
      const envPath = join(paiDir, ".env");
      let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
      if (envContent.includes("ELEVENLABS_API_KEY=")) {
        envContent = envContent.replace(/ELEVENLABS_API_KEY=.*/, `ELEVENLABS_API_KEY=${state.collected.elevenLabsKey}`);
      } else {
        envContent = (envContent.trimEnd() + `\nELEVENLABS_API_KEY=${state.collected.elevenLabsKey}\n`).trimStart();
      }
      writeFileSync(envPath, envContent, { mode: 0o600 });
      await emit({ event: "message", content: "ElevenLabs key written to ~/.claude/.env (Pulse will read it on boot)." });
    } catch (err: any) {
      await emit({ event: "message", content: `Could not write .env: ${err?.message || err}. Voice may fall back to macOS say.` });
    }
  }

  // ── Install Pulse (Y/n) — embeds voice + dashboard + observability ──

  await emit({
    event: "message",
    content:
      "Pulse is the unified PAI runtime: it serves the Life Dashboard at http://localhost:31337, " +
      "handles voice notifications (TTS via ElevenLabs), and runs observability + scheduled jobs. " +
      "Installing it as a launchd agent makes it auto-start on login and stay running across reboots.",
  });

  const installPulseChoice = await getChoice("install-pulse", "Install Pulse as a system launchd service?", [
    { label: "Yes — install Pulse (recommended)", value: "yes", description: "Auto-starts on login. Voice + Dashboard + Observability." },
    { label: "Skip — don't install Pulse now", value: "skip", description: "Voice notifications will not work until you run: bash ~/.claude/PAI/PULSE/manage.sh install" },
  ], daName);

  let voiceServerReady = false;
  if (installPulseChoice === "yes") {
    voiceServerReady = await installPulse(paiDir, emit);
  } else {
    await emit({ event: "message", content: "Pulse skipped. Voice not enabled — install later via: bash ~/.claude/PAI/PULSE/manage.sh install" });
  }

  // ── Optional menu bar app (Y/n) — separate launchd plist + .app bundle ──
  if (voiceServerReady) {
    await emit({
      event: "message",
      content:
        "The Pulse menu bar app shows live status in your macOS menu bar (running indicator, " +
        "quick access to the Life Dashboard, mute/unmute voice). It builds a small .app bundle " +
        "and installs a second launchd plist that auto-starts on login.",
    });
    const installMenuBarChoice = await getChoice("install-menubar", "Install the Pulse menu bar app?", [
      { label: "Yes — install menu bar app", value: "yes", description: "Adds an icon to your menu bar. Auto-starts on login." },
      { label: "Skip — Pulse runs without menu bar", value: "skip", description: "Pulse keeps running. You can install the menu bar later: bash ~/.claude/PAI/PULSE/MenuBar/install.sh" },
    ], daName);

    if (installMenuBarChoice === "yes") {
      await installPulseMenuBar(paiDir, emit);
    } else {
      await emit({ event: "message", content: "Menu bar skipped. Install later: bash ~/.claude/PAI/PULSE/MenuBar/install.sh" });
    }
  }

  // ── Digital Assistant Voice selection ──
  await emit({ event: "progress", step: "voice", percent: 40, detail: "Choosing Digital Assistant voice..." });

  let selectedVoiceId = "";

  // Check for existing voice config from previous installations — gated on
  // the upfront import permission. Without that consent we never read prior
  // settings.json files.
  if (allowImportPriorConfig) {
    const existingVoice = findExistingVoiceConfig();
    if (existingVoice) {
      const sourceLabel = existingVoice.aiName
        ? `${existingVoice.aiName}'s voice (${existingVoice.voiceId.substring(0, 8)}...)`
        : `Voice ID ${existingVoice.voiceId.substring(0, 8)}...`;
      await emit({ event: "message", content: `Found existing voice configuration in ${existingVoice.source}` });

      const useExisting = await getChoice("voice-existing", `Use ${sourceLabel}?`, [
        { label: "Yes, import this voice ID", value: "keep", description: `Voice ID: ${existingVoice.voiceId}` },
        { label: "No, pick a new voice", value: "new", description: "Choose from the 6 built-in voices, enter a custom ID, or skip" },
      ], daName);

      if (useExisting === "keep") {
        selectedVoiceId = existingVoice.voiceId;
        state.collected.voiceType = "custom";
        state.collected.customVoiceId = selectedVoiceId;
      }
    }
  }

  // Voice picker — 6 built-in voices (2 female, 2 male, 2 neutral), plus
  // Custom Voice ID and Skip Voice. Source of truth for IDs is types.ts
  // (DEFAULT_VOICES). If the user has no ElevenLabs key, "Skip" is the
  // honest path — picking a voice without a key just disables voice anyway.
  if (!selectedVoiceId) {
    await emit({ event: "progress", step: "voice", percent: 45, detail: "Pick a voice for your DA..." });

    const hasKey = !!state.collected.elevenLabsKey;
    const previewText = `Hi, I'll be ${state.collected.aiName || "your assistant"}. This is what I sound like.`;
    const pickerChoices = [
      ...DEFAULT_VOICES.map((v) => ({ label: v.label, value: v.id, description: v.description, voiceId: v.voiceId })),
      { label: "Custom Voice ID", value: "custom", description: "Paste your own ElevenLabs voice ID" },
      { label: "Skip — no voice", value: "skip", description: hasKey ? "Voice disabled (key still saved for later use)" : "Voice disabled (no key was provided)" },
    ];
    const voiceType = voiceServerReady && getChoiceWithPreview
      ? await getChoiceWithPreview("voice-type", "Digital Assistant Voice — Pick the voice your DA speaks with:", pickerChoices, previewText, daName)
      : await getChoice("voice-type", "Digital Assistant Voice — Pick the voice your DA speaks with:", pickerChoices, daName);

    if (voiceType === "skip") {
      selectedVoiceId = "";
      state.collected.voiceType = "skip" as any;
    } else if (voiceType === "custom") {
      const customId = await getInput(
        "custom-voice-id",
        "Enter your ElevenLabs Voice ID:\nFind it at: elevenlabs.io/app/voice-library → Your voice → Voice ID",
        "text",
        "e.g., AyCt0WmAXUcPJR11zeeP",
        daName
      );
      selectedVoiceId = customId.trim();
      if (selectedVoiceId) {
        state.collected.voiceType = "custom";
        state.collected.customVoiceId = selectedVoiceId;
      } else {
        await emit({ event: "message", content: "No custom voice ID entered. Voice will be skipped." });
        state.collected.voiceType = "skip" as any;
      }
    } else {
      const found = DEFAULT_VOICES.find((v) => v.id === voiceType);
      if (found) {
        selectedVoiceId = found.voiceId;
        state.collected.voiceType = voiceType as any;
      } else {
        // Defensive fallback — shouldn't happen unless picker IDs drift
        selectedVoiceId = DEFAULT_VOICES[0].voiceId;
        state.collected.voiceType = DEFAULT_VOICES[0].id as any;
      }
    }
  }

  // If we got here without a key AND without skipping voice, we've still
  // selected a voice ID but TTS will fail at runtime. That's acceptable —
  // the user can add a key later and the voice ID is already saved.
  if (!state.collected.elevenLabsKey && selectedVoiceId) {
    await emit({
      event: "message",
      content:
        "Voice ID saved, but voice is disabled until you add an ElevenLabs API key. " +
        "Edit ~/.config/PAI/.env and set ELEVENLABS_API_KEY=sk_...",
    });
  }

  // ── Update settings.json with voice ID ──
  await emit({ event: "progress", step: "voice", percent: 60, detail: "Saving voice configuration..." });
  const settingsPath = join(paiDir, "settings.json");

  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      if (settings.daidentity) {
        settings.daidentity.voiceId = selectedVoiceId;
        settings.daidentity.voices = settings.daidentity.voices || {};
        settings.daidentity.voices.main = {
          voiceId: selectedVoiceId,
          stability: 0.35,
          similarityBoost: 0.80,
          style: 0.90,
          speed: 1.1,
        };
        settings.daidentity.voices.algorithm = {
          voiceId: selectedVoiceId,
          stability: 0.35,
          similarityBoost: 0.80,
          style: 0.90,
          speed: 1.1,
        };
      }
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      await emit({ event: "message", content: "Voice settings saved to settings.json." });
    } catch {
      // Non-fatal
    }
  }

  // ── Save ElevenLabs key to .env (if provided) ──
  if (hasElevenLabsKey) {
    const configDir = state.detection?.configDir || join(homedir(), ".config", "PAI");
    const envPath = join(configDir, ".env");
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

    let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
    if (envContent.includes("ELEVENLABS_API_KEY=")) {
      envContent = envContent.replace(/ELEVENLABS_API_KEY=.*/, `ELEVENLABS_API_KEY=${state.collected.elevenLabsKey}`);
    } else {
      envContent = envContent.trim() + `\nELEVENLABS_API_KEY=${state.collected.elevenLabsKey}\n`;
    }
    writeFileSync(envPath, envContent.trim() + "\n", { mode: 0o600 });

    // Ensure symlinks exist at both ~/.claude/.env and ~/.env
    const symlinkTargets = [
      join(paiDir, ".env"),
      join(homedir(), ".env"),
    ];
    for (const sp of symlinkTargets) {
      try {
        if (existsSync(sp)) {
          if (lstatSync(sp).isSymbolicLink()) unlinkSync(sp);
          else continue;
        }
        symlinkSync(envPath, sp);
      } catch { /* non-fatal */ }
    }
  }

  // ── Test TTS and confirm with user ──
  if (voiceServerReady) {
    let voiceConfirmed = false;
    while (!voiceConfirmed) {
      await emit({ event: "progress", step: "voice", percent: 80, detail: "Testing voice output..." });
      try {
        const aiName = state.collected.aiName || "PAI";
        const userName = state.collected.principalName || "there";
        const testRes = await fetch("http://localhost:31337/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Hello ${userName}, this is ${aiName}. My voice system is online and ready to assist you.`,
            voice_id: selectedVoiceId,
            voice_settings: { stability: 0.35, similarity_boost: 0.80, style: 0.90, speed: 1.1, use_speaker_boost: true },
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (testRes.ok) {
          await emit({ event: "message", content: `Voice test sent — listen for ${aiName} speaking...`, speak: false });

          // Ask user to confirm they heard it and like it
          const confirm = await getChoice("voice-confirm", "Did you hear the voice? Does it sound good?", [
            { label: "Sounds great!", value: "yes" },
            { label: "Pick a different voice", value: "change" },
            { label: "Skip voice for now", value: "skip" },
          ], daName);

          if (confirm === "yes") {
            voiceConfirmed = true;
          } else if (confirm === "skip") {
            voiceConfirmed = true;
          } else {
            // Let them pick again
            const retryChoices = [
              ...DEFAULT_VOICES.map((v) => ({ label: v.label, value: v.id, description: v.description, voiceId: v.voiceId })),
              { label: "Custom Voice ID", value: "custom", description: "Enter your own ElevenLabs voice ID" },
            ];
            const retryPreviewText = `Hi, I'll be ${state.collected.aiName || "your assistant"}. This is what I sound like.`;
            const newVoice = getChoiceWithPreview
              ? await getChoiceWithPreview("voice-type-retry", "Choose a different voice:", retryChoices, retryPreviewText, daName)
              : await getChoice("voice-type-retry", "Choose a different voice:", retryChoices, daName);
            if (newVoice === "custom") {
              const newId = await getInput("custom-voice-id-retry", "Enter your ElevenLabs Voice ID:", "text", "e.g., AyCt0WmAXUcPJR11zeeP", daName);
              selectedVoiceId = newId.trim() || selectedVoiceId;
              state.collected.voiceType = "custom";
              state.collected.customVoiceId = selectedVoiceId;
            } else {
              const found = DEFAULT_VOICES.find((v) => v.id === newVoice);
              selectedVoiceId = found?.voiceId || DEFAULT_VOICES[0].voiceId;
              state.collected.voiceType = newVoice as any;
            }
            // Update settings.json with new choice before re-testing
            try {
              const s = JSON.parse(readFileSync(settingsPath, "utf-8"));
              if (s.daidentity?.voices?.main) s.daidentity.voices.main.voiceId = selectedVoiceId;
              if (s.daidentity?.voices?.algorithm) s.daidentity.voices.algorithm.voiceId = selectedVoiceId;
              writeFileSync(settingsPath, JSON.stringify(s, null, 2));
            } catch { /* non-fatal */ }
          }
        } else {
          await emit({ event: "message", content: "Voice test returned an error. Voice may need manual configuration." });
          voiceConfirmed = true;
        }
      } catch {
        await emit({ event: "message", content: "Voice test timed out. Server may still be initializing." });
        voiceConfirmed = true;
      }
    }
  }

  const voiceLabel = state.collected.voiceType === "custom"
    ? `Custom voice (${selectedVoiceId.substring(0, 8)}...)`
    : state.collected.voiceType || "default";
  await emit({ event: "message", content: `Digital Assistant voice configured: ${voiceLabel}` });

  // Reload Pulse so the voice pick we just wrote to settings.json is actually
  // honored at runtime (Pulse caches defaultVoiceId at init — without this
  // restart, every skill curl that omits voice_id stays on the stale template
  // default until the next manual restart).
  await reloadPulse(paiDir, emit);

  await emit({ event: "step_complete", step: "voice" });
}

// ─── Telegram Setup ───────────────────────────────────────────────
//
// Optional step. If the user wants Pulse's Telegram bot to work, we collect
// the bot token + allowed user/chat ID, validate via Telegram getMe, write
// to ~/.claude/.env, then ask Pulse to restart so it picks up the env vars.
//
// Same key-discovery pattern as the voice step: check primary .env first,
// ask permission before scanning .claude* backup directories, fall back to
// manual entry.

interface TelegramValidation { valid: boolean; username?: string; error?: string }

async function validateTelegramBotToken(token: string): Promise<TelegramValidation> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { valid: false, error: `Telegram API ${res.status}: ${body.slice(0, 120)}` };
    }
    const data = await res.json() as { ok?: boolean; result?: { username?: string }; description?: string };
    if (!data.ok || !data.result) return { valid: false, error: data.description || "Telegram API rejected token" };
    return { valid: true, username: data.result.username };
  } catch (err: any) {
    return { valid: false, error: err?.message || "Network error contacting Telegram" };
  }
}

async function restartPulse(paiDir: string): Promise<boolean> {
  const manage = join(paiDir, "PAI", "PULSE", "manage.sh");
  if (!existsSync(manage)) return false;
  return new Promise<boolean>((resolve) => {
    const child = spawn("bash", [manage, "restart"], { cwd: dirname(manage), stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { child.kill(); resolve(false); }, 15000);
    child.on("close", (code) => { clearTimeout(timer); resolve(code === 0); });
    child.on("error", () => { clearTimeout(timer); resolve(false); });
  });
}

function writeEnvKey(envPath: string, key: string, value: string): void {
  let content = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    content = content.replace(re, `${key}=${value}`);
  } else {
    content = (content.trimEnd() + `\n${key}=${value}\n`).trimStart();
  }
  writeFileSync(envPath, content, { mode: 0o600 });
}

export async function runTelegramSetup(
  state: InstallState,
  emit: EngineEventHandler,
  getChoice: (id: string, prompt: string, choices: { label: string; value: string; description?: string }[]) => Promise<string>,
  getInput: (id: string, prompt: string, type: "text" | "password" | "key", placeholder?: string) => Promise<string>
): Promise<void> {
  await emit({ event: "step_start", step: "telegram" });
  await emitSectionHeader(
    emit,
    "TELEGRAM-OPTIONAL",
    "TELEGRAM (OPTIONAL)",
    "Connecting Pulse to a Telegram bot for chat and notifications",
    8
  );

  await emit({
    event: "message",
    content:
      "Optional: Telegram bot integration. Pulse can run a Telegram bot that lets you " +
      "chat with your DA from your phone and pushes long-task notifications. " +
      "Requires a bot token from @BotFather and your Telegram user/chat ID.",
  });

  const wantsTelegram = await getChoice("telegram-enable", "Set up Telegram now?", [
    { label: "Yes — I have a bot token from BotFather", value: "yes" },
    { label: "Skip — I'll set this up later (or never)", value: "skip", description: "Pulse runs fine without Telegram. Add later via ~/.claude/.env" },
  ]);

  if (wantsTelegram !== "yes") {
    await emit({ event: "message", content: "Skipped Telegram setup. Add later: TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USERS in ~/.claude/.env, then bash ~/.claude/PAI/PULSE/manage.sh restart" });
    skipStep(state, "telegram", "user-skipped");
    return;
  }

  const paiDir = state.detection?.paiDir || join(homedir(), ".claude");

  // ── Step 1: Check primary .env locations (no permission needed) ──
  let token = findExistingEnvKey("TELEGRAM_BOT_TOKEN");
  let validation: TelegramValidation = { valid: false };

  if (token) {
    await emit({ event: "message", content: "Found existing TELEGRAM_BOT_TOKEN. Validating..." });
    validation = await validateTelegramBotToken(token);
    if (!validation.valid) {
      await emit({ event: "message", content: `Existing token invalid: ${validation.error}.` });
      token = "";
    }
  }

  // ── Step 2: Offer to scan backup .claude* dirs (with permission) ──
  if (!token) {
    const backupHits = findKeyInBackupDirs("TELEGRAM_BOT_TOKEN");
    if (backupHits.length > 0) {
      const sources = backupHits.map(h => h.path.replace(homedir(), "~")).join(", ");
      const allow = await getChoice("telegram-scan-backup", `Found Telegram bot tokens in backup directories: ${sources}. Use one of them?`, [
        { label: "Yes — try the backup token(s)", value: "yes", description: "We'll validate each via Telegram getMe and use the first that works." },
        { label: "No — I'll enter a fresh token", value: "no" },
      ]);
      if (allow === "yes") {
        for (const hit of backupHits) {
          await emit({ event: "progress", step: "telegram", percent: 15, detail: `Validating token from ${hit.path.replace(homedir(), "~")}...` });
          const result = await validateTelegramBotToken(hit.value);
          if (result.valid) {
            token = hit.value;
            validation = result;
            await emit({ event: "message", content: `Using Telegram bot token from ${hit.path.replace(homedir(), "~")} (bot @${result.username}).` });
            break;
          } else {
            await emit({ event: "message", content: `Token from ${hit.path.replace(homedir(), "~")} invalid: ${result.error}.` });
          }
        }
      }
    }
  }

  // ── Step 3: Manual entry ──
  if (!token) {
    const entered = await getInput(
      "telegram-bot-token",
      "Paste your Telegram bot token (from @BotFather):",
      "key",
      "1234567890:ABCdefGHI..."
    );
    const trimmed = entered.trim();
    if (!trimmed) {
      await emit({ event: "message", content: "No token entered. Skipping Telegram setup." });
      skipStep(state, "telegram", "no-token-entered");
      return;
    }
    await emit({ event: "progress", step: "telegram", percent: 30, detail: "Validating token via Telegram getMe..." });
    const result = await validateTelegramBotToken(trimmed);
    if (!result.valid) {
      await emit({ event: "message", content: `Token validation failed: ${result.error}. Skipping Telegram setup.` });
      skipStep(state, "telegram", "invalid-token");
      return;
    }
    token = trimmed;
    validation = result;
    await emit({ event: "message", content: `Bot validated: @${result.username}` });
  }

  // ── Step 4: Allowed users / chat ID ──
  // Reuse from primary .env first, fall back to prompt.
  let allowedUsers = findExistingEnvKey("TELEGRAM_ALLOWED_USERS") || findExistingEnvKey("TELEGRAM_PRINCIPAL_CHAT_ID");
  if (!allowedUsers) {
    const entered = await getInput(
      "telegram-allowed-users",
      "Enter your Telegram user ID or chat ID (find it via @userinfobot):",
      "text",
      "123456789"
    );
    allowedUsers = entered.trim();
  }
  if (!allowedUsers) {
    await emit({ event: "message", content: "No allowed user/chat ID provided. Bot will not respond to anyone (unsafe). Skipping." });
    skipStep(state, "telegram", "no-allowed-users");
    return;
  }

  // ── Step 5: Persist to ~/.claude/.env and restart Pulse ──
  state.collected.telegramBotToken = token;
  state.collected.telegramAllowedUsers = allowedUsers;
  state.collected.telegramBotUsername = validation.username;

  try {
    const envPath = join(paiDir, ".env");
    writeEnvKey(envPath, "TELEGRAM_BOT_TOKEN", token);
    writeEnvKey(envPath, "TELEGRAM_ALLOWED_USERS", allowedUsers);
    await emit({ event: "message", content: "Telegram credentials written to ~/.claude/.env." });
  } catch (err: any) {
    await emit({ event: "message", content: `Could not write .env: ${err?.message || err}. Telegram bot will not start.` });
    skipStep(state, "telegram", "env-write-failed");
    return;
  }

  // Pulse may already be running from the voice step; restart so it picks up env.
  await emit({ event: "progress", step: "telegram", percent: 80, detail: "Restarting Pulse to pick up Telegram credentials..." });
  const restarted = await restartPulse(paiDir);
  await emit({
    event: "message",
    content: restarted
      ? `Pulse restarted. Telegram bot @${validation.username} is now polling.`
      : `Pulse not restarted automatically — run: bash ~/.claude/PAI/PULSE/manage.sh restart`,
  });

  await emit({ event: "step_complete", step: "telegram" });
}

// Helper used by runTelegramSetup. Local re-export shim to avoid touching the
// generic skip flow up top — the runners already handle skippedSteps.
function skipStep(state: InstallState, step: StepId, _reason: string): void {
  if (!state.skippedSteps.includes(step)) state.skippedSteps.push(step);
}
