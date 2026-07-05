/**
 * InstallEngine — shared install logic for the LifeOS bare-skill installer.
 *
 * This is a standalone, adapted subset of the legacy installer engine at
 * `PAI/LIFEOS_INSTALL/engine/` (detect.ts + the relevant types), reshaped for the
 * bare-skill context: no web/electron wizard, no separate types module, plus
 * the bare-skill extras the wizard never needed — harness detection (the skill
 * installs into Claude Code / Hermes / Cursor / OpenClaw) and dev-tree refusal
 * (never mutate the author's source repo).
 *
 * All detection here is READ-ONLY and non-destructive. The 7 setup Tools import
 * from this one sibling module (flat 2-level skill structure forbids a lib/ dir).
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// ── Types (inlined — the skill ships without the engine's types.ts) ──

export type Platform = "darwin" | "linux" | "windows";

export interface OsInfo {
  platform: Platform;
  arch: string;
  version: string;
  name: string;
}

export interface ToolInfo {
  installed: boolean;
  version?: string;
  path?: string;
}

export type Harness = "claude-code" | "hermes" | "cursor" | "openclaw" | "unknown";

export interface HarnessInfo {
  name: Harness;
  /** Where this harness loads skills from (absolute), if known. */
  skillsDir?: string;
  /** The config root the harness resolves (e.g. ~/.claude). */
  configRoot?: string;
}

export interface EnvDetection {
  os: OsInfo;
  harness: HarnessInfo;
  /** Has a graphical session (vs headless/SSH) — gates GUI-dependent steps. */
  display: boolean;
  /** Running inside an SSH session. */
  ssh: boolean;
  bun: ToolInfo;
  git: ToolInfo;
  /** A prior LifeOS/PAI install is present (settings.json exists in the config root). */
  existingInstall: boolean;
  /**
   * This IS the author's live source tree — refuse all mutation. Marker: the
   * private maintenance skill (`skills/_LIFEOS`) only exists in the source repo,
   * never in a public install.
   */
  isDevTree: boolean;
  settingsExists: boolean;
  claudeMdExists: boolean;
  homeDir: string;
  configRoot: string;
  timezone: string;
}

// ── Low-level probes (from engine detect.ts, unchanged) ──

function tryExec(cmd: string): string | null {
  try {
    return execSync(cmd, { timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
  } catch {
    return null;
  }
}

export function detectOS(): OsInfo {
  const platform: Platform =
    process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
  const arch = process.arch;
  let version = "";
  let name = "";
  if (platform === "darwin") {
    version = tryExec("sw_vers -productVersion") || "";
    name = `macOS ${version}`.trim();
  } else if (platform === "linux") {
    name = tryExec("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'") || "Linux";
    version = tryExec("uname -r") || "";
  } else {
    name = "Windows";
    version = tryExec("ver") || "";
  }
  return { platform, arch, version, name };
}

export function detectTool(name: string, versionCmd: string): ToolInfo {
  const path = tryExec(`command -v ${name}`);
  if (!path) return { installed: false };
  const out = tryExec(versionCmd);
  const m = out?.match(/(\d+\.\d+[.\d]*)/);
  return { installed: true, version: m?.[1] || out || undefined, path };
}

// ── Harness detection (NEW — bare-skill needs to know where it landed) ──

/**
 * Detect which harness is hosting this install and where it loads skills from.
 * Order: explicit env (CLAUDE_CONFIG_DIR) → Claude Code (~/.claude) →
 * Hermes (~/.hermes) → Cursor (~/.cursor) → OpenClaw (~/.openclaw) → unknown.
 */
export function detectHarness(home: string): HarnessInfo {
  const candidates: Array<{ name: Harness; root: string; skills: string }> = [
    { name: "claude-code", root: process.env.CLAUDE_CONFIG_DIR || join(home, ".claude"), skills: "skills" },
    { name: "hermes", root: join(home, ".hermes"), skills: "skills" },
    { name: "cursor", root: join(home, ".cursor"), skills: "skills" },
    { name: "openclaw", root: join(home, ".openclaw"), skills: "skills" },
  ];
  for (const c of candidates) {
    if (existsSync(c.root)) {
      return { name: c.name, configRoot: c.root, skillsDir: join(c.root, c.skills) };
    }
  }
  // Default assumption when nothing is present yet (a clean machine pre-bootstrap).
  return { name: "claude-code", configRoot: join(home, ".claude"), skillsDir: join(home, ".claude", "skills") };
}

/**
 * Dev-tree refusal marker. The private maintenance skill (`skills/_LIFEOS`) exists
 * ONLY in the author's source repo — never in a public install (release tooling
 * strips all `_ALLCAPS` skills). Its presence means "this is the live source;
 * do not mutate." A `.git` remote check is a secondary signal but `<your-release-skill>` alone
 * is decisive and cheap.
 */
export function detectDevTree(configRoot: string): boolean {
  return existsSync(join(configRoot, "skills", "_LIFEOS"));
}

// ── Composite env detection (the DetectEnv Tool payload) ──

export function detectEnv(): EnvDetection {
  const home = homedir();
  const os = detectOS();
  const harness = detectHarness(home);
  const configRoot = harness.configRoot || join(home, ".claude");
  const settingsPath = join(configRoot, "settings.json");
  const claudeMdPath = join(configRoot, "CLAUDE.md");
  const ssh = !!(process.env.SSH_CONNECTION || process.env.SSH_TTY || process.env.SSH_CLIENT);
  // GUI session: macOS always has one locally; Linux needs DISPLAY/WAYLAND and not pure-SSH.
  const display =
    os.platform === "darwin" ? !ssh : !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY) && !ssh;

  return {
    os,
    harness,
    display,
    ssh,
    bun: detectTool("bun", "bun --version"),
    git: detectTool("git", "git --version"),
    existingInstall: existsSync(settingsPath),
    isDevTree: detectDevTree(configRoot),
    settingsExists: existsSync(settingsPath),
    claudeMdExists: existsSync(claudeMdPath),
    homeDir: home,
    configRoot,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// ── Existing-content + API-key scan (from engine detect.ts, inlined types) ──

export interface ApiKeyScan {
  elevenLabs?: string;
  anthropic?: string;
  openai?: string;
  google?: string;
  xai?: string;
  perplexity?: string;
}

/**
 * Scan shell rc files + config dirs for API-key VALUES. Returns provider → key.
 * Only well-formed assignments are accepted (no `$VAR` indirection, no
 * obvious placeholders). Read-only.
 */
export function scanApiKeys(home: string, configDir: string): ApiKeyScan {
  const candidates = [
    join(home, ".zshenv"),
    join(home, ".zshrc"),
    join(home, ".zprofile"),
    join(home, ".bashrc"),
    join(home, ".bash_profile"),
    join(home, ".profile"),
    join(configDir, ".env"),
    join(configDir, "credentials.env"),
    join(home, ".config", "LIFEOS", ".env"),
  ];
  const patterns: Array<[keyof ApiKeyScan, RegExp]> = [
    ["elevenLabs", /(?:^|\n)\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s#]+)/],
    ["anthropic", /(?:^|\n)\s*(?:export\s+)?ANTHROPIC_API_KEY\s*=\s*["']?([^"'\s#]+)/],
    ["openai", /(?:^|\n)\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*["']?([^"'\s#]+)/],
    ["google", /(?:^|\n)\s*(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_GENAI_API_KEY)\s*=\s*["']?([^"'\s#]+)/],
    ["xai", /(?:^|\n)\s*(?:export\s+)?(?:XAI_API_KEY|GROK_API_KEY)\s*=\s*["']?([^"'\s#]+)/],
    ["perplexity", /(?:^|\n)\s*(?:export\s+)?PERPLEXITY_API_KEY\s*=\s*["']?([^"'\s#]+)/],
  ];
  const placeholder = /^(your-key-here|sk-xxxxxxxx|xxxxx|REPLACE_ME|TODO)/i;
  const found: ApiKeyScan = {};
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    let content: string;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    for (const [provider, regex] of patterns) {
      if (found[provider]) continue;
      const m = content.match(regex);
      if (!m) continue;
      const value = m[1];
      if (value.startsWith("$")) continue;
      if (placeholder.test(value)) continue;
      if (value.length < 12) continue;
      found[provider] = value;
    }
  }
  return found;
}

function fileExists(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}

export interface ExistingUserContent {
  telosPresent: boolean;
  identityPresent: boolean;
  contactsPresent: boolean;
  projectsPresent: boolean;
  /** True if the user config tree already holds real (non-template) content. */
  populated: boolean;
}

/**
 * Read-only scan of a user config tree for already-present content, so setup
 * can branch on "populated tree" vs "fresh scaffold" without overwriting.
 */
export function detectExistingUserContent(paiUserDir: string): ExistingUserContent {
  // Covers both the current single-file schema (TELOS/TELOS.md) and the legacy
  // split layout (TELOS/MISSION.md, TELOS/GOALS.md).
  const telosPresent =
    fileExists(paiUserDir, "TELOS/TELOS.md") ||
    fileExists(paiUserDir, "TELOS/MISSION.md") ||
    fileExists(paiUserDir, "TELOS/GOALS.md");
  const identityPresent =
    fileExists(paiUserDir, "PRINCIPAL/PRINCIPAL_IDENTITY.md") ||
    fileExists(paiUserDir, "PRINCIPAL_IDENTITY.md") ||
    fileExists(paiUserDir, "DIGITAL_ASSISTANT/DA_IDENTITY.md");
  const contactsPresent = fileExists(paiUserDir, "CONTACTS.md");
  const projectsPresent = fileExists(paiUserDir, "PROJECTS.md");
  return {
    telosPresent,
    identityPresent,
    contactsPresent,
    projectsPresent,
    populated: telosPresent || identityPresent,
  };
}

// ── Settings.json hook inspection (read-only; InstallHooks does the writes) ──

export interface SettingsHookScan {
  exists: boolean;
  hookEventCount: number;
  hookEntryCount: number;
}

/**
 * Read-only count of existing hooks in a harness settings.json, so ScanConflicts
 * can report what's already wired before InstallHooks proposes a merge.
 */
export function scanSettingsHooks(settingsPath: string): SettingsHookScan {
  if (!existsSync(settingsPath)) return { exists: false, hookEventCount: 0, hookEntryCount: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return { exists: true, hookEventCount: 0, hookEntryCount: 0 };
  }
  if (typeof parsed !== "object" || parsed === null) return { exists: true, hookEventCount: 0, hookEntryCount: 0 };
  const hooks = (parsed as Record<string, unknown>).hooks;
  if (typeof hooks !== "object" || hooks === null) return { exists: true, hookEventCount: 0, hookEntryCount: 0 };
  const events = Object.keys(hooks as Record<string, unknown>);
  let entries = 0;
  for (const ev of events) {
    const bucket = (hooks as Record<string, unknown>)[ev];
    if (Array.isArray(bucket)) entries += bucket.length;
  }
  return { exists: true, hookEventCount: events.length, hookEntryCount: entries };
}

// ════════════════════════════════════════════════════════════════════
//  Mutating helpers (used by ScaffoldUser / LinkUser / ActivateImports /
//  InstallHooks). Each is purpose-built for the bare-skill installer but
//  follows the proven logic from the legacy engine actions.ts.
// ════════════════════════════════════════════════════════════════════

import { cpSync, lstatSync, mkdirSync, readdirSync, readlinkSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const TEMPLATE_EXTENSIONS = new Set([".md", ".json", ".txt", ".ts", ".toml", ".yaml", ".yml", ".sh"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "LIFEOS_INSTALL", "MEMORY"]);

/**
 * Recursive, existsSync-GUARDED copy. Copies only files/dirs absent at dst —
 * NEVER overwrites a populated target. Returns count + any failures. (Ported
 * from engine actions.ts copyMissing.)
 */
export function copyMissing(src: string, dst: string): { copied: number; failures: string[] } {
  const failures: string[] = [];
  let copied = 0;
  const walk = (s: string, d: string): void => {
    if (!existsSync(s)) return;
    const stat = lstatSync(s);
    if (stat.isFile()) {
      if (!existsSync(d)) {
        try {
          mkdirSync(dirname(d), { recursive: true });
          cpSync(s, d);
          copied++;
        } catch (err) {
          failures.push(`${s} → ${d}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      return;
    }
    for (const entry of readdirSync(s, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const sp = join(s, entry.name);
      const dp = join(d, entry.name);
      if (entry.isDirectory()) {
        if (!existsSync(dp)) mkdirSync(dp, { recursive: true });
        walk(sp, dp);
      } else if (entry.isFile() && !existsSync(dp)) {
        try {
          cpSync(sp, dp);
          copied++;
        } catch (err) {
          failures.push(`${sp} → ${dp}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  };
  walk(src, dst);
  return { copied, failures };
}

export interface TemplateVars {
  [placeholder: string]: string;
}

/**
 * Walk a tree and replace `{{PLACEHOLDER}}` tokens in template-extension files.
 * Atomic per-file (tmp + rename). Skips node_modules/.git/LIFEOS_INSTALL/MEMORY.
 * (Simplified from engine actions.ts substituteTemplates.)
 */
export function substituteTree(rootDir: string, vars: TemplateVars): { scanned: number; modified: number; applied: number } {
  let scanned = 0;
  let modified = 0;
  let applied = 0;
  const entries = Object.entries(vars);
  const processFile = (filePath: string): void => {
    if (!TEMPLATE_EXTENSIONS.has(filePath.slice(filePath.lastIndexOf(".")))) return;
    scanned++;
    const before = readFileSync(filePath, "utf-8");
    let after = before;
    for (const [placeholder, value] of entries) {
      const parts = after.split(placeholder);
      applied += parts.length - 1;
      after = parts.join(value);
    }
    if (after !== before) {
      const tmp = filePath + ".lifeos.tmp";
      writeFileSync(tmp, after);
      renameSync(tmp, filePath);
      modified++;
    }
  };
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const child = join(dir, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) processFile(child);
    }
  };
  if (existsSync(rootDir) && lstatSync(rootDir).isFile()) processFile(rootDir);
  else walk(rootDir);
  return { scanned, modified, applied };
}

/**
 * Establish the system/user separation contract: the live `<configRoot>/LIFEOS/USER`
 * becomes a SYMLINK to `<configDir>/USER` (the private user-data home). Copies any
 * live USER content into the data home first (existsSync-guarded), then replaces
 * the live dir with a symlink. Idempotent — a correct symlink is left untouched.
 * EXDEV (cross-filesystem) rename falls back to cp + rm. (Ported from engine.)
 */
/** Byte-compare two files; treats unreadable as "differs" (conservative). */
function filesDiffer(a: string, b: string): boolean {
  try {
    return !readFileSync(a).equals(readFileSync(b));
  } catch {
    return true;
  }
}

/**
 * Merge `src` into `dst` with LIVE-WINS semantics for the USER migration: a
 * missing dst file is copied; a byte-identical one is skipped; a DIFFERING one
 * is overwritten with src AFTER the displaced dst file is preserved aside as
 * `<file>.replaced-<stamp>`. Lossless in every direction — nothing is removed
 * without a recoverable copy. Symlinked entries are skipped (Dirent semantics).
 */
function mergeTree(src: string, dst: string, stamp: string): { copied: number; overwritten: number; preserved: number; failures: string[] } {
  let copied = 0;
  let overwritten = 0;
  let preserved = 0;
  const failures: string[] = [];
  const walk = (s: string, d: string): void => {
    if (!existsSync(s)) return;
    if (lstatSync(s).isFile()) {
      if (!existsSync(d)) {
        try { mkdirSync(dirname(d), { recursive: true }); cpSync(s, d); copied++; }
        catch (err) { failures.push(`${s} → ${d}: ${err instanceof Error ? err.message : String(err)}`); }
      } else if (filesDiffer(s, d)) {
        try { cpSync(d, `${d}.replaced-${stamp}`); cpSync(s, d); overwritten++; preserved++; }
        catch (err) { failures.push(`${s} → ${d}: ${err instanceof Error ? err.message : String(err)}`); }
      }
      return;
    }
    for (const entry of readdirSync(s, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const sp = join(s, entry.name);
      const dp = join(d, entry.name);
      if (entry.isDirectory()) { if (!existsSync(dp)) mkdirSync(dp, { recursive: true }); walk(sp, dp); }
      else if (entry.isFile()) walk(sp, dp);
    }
  };
  walk(src, dst);
  return { copied, overwritten, preserved, failures };
}

export function setupUserSeparation(
  configRoot: string,
  configDir: string,
): { action: "already-linked" | "linked" | "scaffolded-linked"; target: string; copied: number; overwritten?: number; preserved?: number; backup?: string; error?: string } {
  const liveUserDir = join(configRoot, "LIFEOS", "USER");
  const dataUserDir = join(configDir, "USER");

  // Branch (a): already a correct symlink → no-op.
  if (existsSync(liveUserDir)) {
    const st = lstatSync(liveUserDir);
    if (st.isSymbolicLink()) {
      try {
        if (readlinkSync(liveUserDir) === dataUserDir) return { action: "already-linked", target: dataUserDir, copied: 0 };
      } catch { /* fall through to rebuild */ }
    }
  }

  mkdirSync(dataUserDir, { recursive: true });
  let copied = 0;

  // Branch (b): live USER is a real dir → migrate into the data home LOSSLESSLY,
  // then symlink. We RENAME the live dir aside (never rm) so the user's real tree
  // ALWAYS survives, then merge it into the data home with live-wins so real
  // content beats any template stub ScaffoldUser placed first. The backup is
  // retained and reported; recovery is always possible, including if the symlink
  // step itself fails. This fixes the prior copyMissing-then-rm data-loss path
  // where a divergent dest stub was kept and the user's real file destroyed.
  if (existsSync(liveUserDir) && lstatSync(liveUserDir).isDirectory()) {
    const stamp = String(Date.now());
    const backupDir = `${liveUserDir}.pre-link-backup-${stamp}`;
    try {
      renameSync(liveUserDir, backupDir);
    } catch (err) {
      return { action: "linked", target: dataUserDir, copied: 0, error: `could not move live USER aside before symlink: ${err instanceof Error ? err.message : String(err)}` };
    }
    const merged = mergeTree(backupDir, dataUserDir, stamp);
    copied = merged.copied;
    try {
      mkdirSync(dirname(liveUserDir), { recursive: true });
      symlinkSync(dataUserDir, liveUserDir);
      return { action: "linked", target: dataUserDir, copied, overwritten: merged.overwritten, preserved: merged.preserved, backup: backupDir };
    } catch (err) {
      return { action: "linked", target: dataUserDir, copied, overwritten: merged.overwritten, preserved: merged.preserved, backup: backupDir, error: `symlink creation failed (live USER preserved at ${backupDir}): ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // Branch (c): fresh install — scaffold the data home (if empty) + symlink.
  try {
    mkdirSync(dirname(liveUserDir), { recursive: true });
    symlinkSync(dataUserDir, liveUserDir);
    return { action: "scaffolded-linked", target: dataUserDir, copied };
  } catch (err) {
    return { action: "scaffolded-linked", target: dataUserDir, copied, error: `symlink creation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Validate the symlink contract: `<configRoot>/LIFEOS/USER` is a symlink → `<configDir>/USER`.
 * (Ported from engine validate.ts runSymlinkContractCheck.)
 */
export function checkSymlinkContract(configRoot: string, configDir: string): { passed: boolean; detail: string } {
  const liveUserDir = join(configRoot, "LIFEOS", "USER");
  const expected = join(configDir, "USER");
  if (!existsSync(liveUserDir)) return { passed: false, detail: `missing: ${liveUserDir}` };
  const st = lstatSync(liveUserDir);
  if (!st.isSymbolicLink()) return { passed: false, detail: `${liveUserDir} is not a symlink (system/user separation broken)` };
  let target: string;
  try {
    target = readlinkSync(liveUserDir);
  } catch (err) {
    return { passed: false, detail: `readlink failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (target !== expected) return { passed: false, detail: `symlink points to ${target}, expected ${expected}` };
  return { passed: true, detail: `${liveUserDir} → ${expected}` };
}

// ── Hooks merge (InstallHooks core — the one genuinely-new piece) ──

type HookEntry = { type?: string; command?: string; url?: string; [k: string]: unknown };
type MatcherGroup = { matcher?: string; hooks?: HookEntry[]; [k: string]: unknown };
type HooksMap = Record<string, MatcherGroup[]>;

/**
 * Normalize a hook command for dedup: collapse the harness/PAI path-var forms to
 * a single canonical token and squeeze whitespace, so the same hook expressed as
 * `${LIFEOS_DIR}/x`, `$LIFEOS_DIR/x`, or `~/.claude/x` dedupes to one.
 */
function normalizeCommand(cmd: string): string {
  return cmd
    .replace(/\$\{?LIFEOS_DIR\}?|\$\{?CLAUDE_PROJECT_DIR\}?|\$\{?CLAUDE_PLUGIN_ROOT\}?|~\/\.claude|\$HOME\/\.claude|\$\{HOME\}\/\.claude/g, "§ROOT§")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rewrite the default `~/.claude` config-root spellings inside hook commands to
 * the actually-detected configRoot. The payload's hooks.json ships commands
 * against the default root (`$HOME/.claude/...`); on a multi-profile setup
 * (Claude Code's CLAUDE_CONFIG_DIR) those paths point at a different — usually
 * nonexistent — profile, so every hook errors on startup. No-op when configRoot
 * IS the default, keeping default installs byte-identical. Pure (no I/O).
 */
export function rewriteHooksConfigRoot(hooks: HooksMap, configRoot: string, homeDir: string): HooksMap {
  if (resolve(configRoot) === resolve(join(homeDir, ".claude"))) return hooks;
  const defaultRootPattern = /(\$\{HOME\}|\$HOME|~)\/\.claude(?=\/|\s|$)/g;
  const rewritten: HooksMap = JSON.parse(JSON.stringify(hooks ?? {}));
  for (const groups of Object.values(rewritten)) {
    for (const group of groups) {
      for (const h of group.hooks ?? []) {
        if (typeof h.command === "string") h.command = h.command.replace(defaultRootPattern, configRoot);
      }
    }
  }
  return rewritten;
}

/** Identity key for a hook entry: http → url, else normalized command. */
function hookKey(h: HookEntry): string {
  if (h.type === "http" && h.url) return `http:${h.url}`;
  if (h.command) return `cmd:${normalizeCommand(h.command)}`;
  return `raw:${JSON.stringify(h)}`;
}

/**
 * Additively merge `incoming` hooks into `existing` settings.hooks, per matcher
 * bucket, idempotent by normalized-command (and url for http). NEVER removes or
 * reorders a foreign entry. Returns the merged map + counts. Pure (no I/O).
 */
export function mergeHooks(existing: HooksMap, incoming: HooksMap): { merged: HooksMap; added: number; skipped: number } {
  // Deep-clone existing so we never mutate the caller's object.
  const merged: HooksMap = JSON.parse(JSON.stringify(existing ?? {}));
  let added = 0;
  let skipped = 0;

  for (const [event, incomingGroups] of Object.entries(incoming ?? {})) {
    if (!Array.isArray(merged[event])) merged[event] = [];
    const eventBucket = merged[event];

    for (const inGroup of incomingGroups) {
      const matcher = inGroup.matcher ?? "";
      const inHooks = Array.isArray(inGroup.hooks) ? inGroup.hooks : [];
      // Find a same-matcher group already present.
      let target = eventBucket.find((g) => (g.matcher ?? "") === matcher);
      if (!target) {
        // New matcher bucket — append a fresh group, then fill it (counts each hook as added).
        target = { matcher, hooks: [] };
        eventBucket.push(target);
      }
      if (!Array.isArray(target.hooks)) target.hooks = [];
      const present = new Set(target.hooks.map(hookKey));
      for (const h of inHooks) {
        const key = hookKey(h);
        if (present.has(key)) {
          skipped++;
        } else {
          target.hooks.push(h);
          present.add(key);
          added++;
        }
      }
    }
  }
  return { merged, added, skipped };
}

/**
 * Uncomment the identity `@`-imports in a CLAUDE.md, each guarded by existsSync
 * of its symlink-resolved target under configRoot. Lines shipped as
 * `<!-- @LIFEOS/USER/... -->` are activated to `@LIFEOS/USER/...` only when the target
 * resolves. Returns which imports were activated vs left commented.
 */
export function activateImports(claudeMdPath: string, configRoot: string): { activated: string[]; skipped: string[] } {
  const activated: string[] = [];
  const skipped: string[] = [];
  if (!existsSync(claudeMdPath)) return { activated, skipped };
  const lines = readFileSync(claudeMdPath, "utf-8").split("\n");
  // Two dormant-import conventions: the public CLAUDE.md ships `# @LIFEOS/USER/...`
  // (hash-prefixed so the @ isn't at line-start and Claude Code skips it); the
  // older form is `<!-- @LIFEOS/USER/... -->`. Activation strips the prefix so the
  // import sits at line-start and resolves.
  const commented = /^\s*#\s+(@[\w./-]+)\s*$|^\s*<!--\s*(@[\w./-]+)\s*-->\s*$/;
  const out = lines.map((line) => {
    const m = line.match(commented);
    if (!m) return line;
    const importPath = m[1] || m[2]; // e.g. @LIFEOS/USER/TELOS/PRINCIPAL_TELOS.md
    const rel = importPath.replace(/^@/, "");
    if (existsSync(join(configRoot, rel))) {
      activated.push(importPath);
      return importPath;
    }
    skipped.push(importPath);
    return line;
  });
  if (activated.length > 0) writeFileSync(claudeMdPath, out.join("\n"));
  return { activated, skipped };
}

export { resolve };
