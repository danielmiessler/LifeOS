/**
 * InstallEngine — shared install logic for the LifeOS bare-skill installer.
 *
 * This is a standalone install engine, reshaped for the bare-skill context
 * from the now-retired pre-6.x GUI installer engine (detect logic + types):
 * no web/electron wizard, no separate types module, plus
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

export type Harness = "claude-code" | "opencode" | "hermes" | "cursor" | "openclaw" | "unknown";

export interface HarnessInfo {
  name: Harness;
  /** Where this harness loads skills from (absolute), if known. */
  skillsDir?: string;
  /** The config root the harness resolves (e.g. ~/.claude). */
  configRoot?: string;
  /**
   * "detected" = the harness binary was found on PATH; "assumed" = inferred
   * from a config dir alone, or the clean-machine default. The Setup workflow
   * must confirm an "assumed" harness with the user before branching (#1448 —
   * a leftover ~/.claude dir sent an OpenCode install down the Claude Code path).
   */
  confidence: "detected" | "assumed";
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
  /** Private user-data home (`<configDir>/USER` is the symlink target). */
  configDir: string;
  timezone: string;
}

// ── Root resolution (single source of truth for every setup Tool) ──

/** Expand a LEADING $HOME / ${HOME} / ~ path segment. Mid-string refs are left alone. */
export function expandHomePrefix(value: string, home: string): string {
  if (!home) return value;
  if (value === "$HOME" || value === "${HOME}" || value === "~") return home;
  if (value.startsWith("$HOME/")) return home + value.slice("$HOME".length);
  if (value.startsWith("${HOME}/")) return home + value.slice("${HOME}".length);
  if (value.startsWith("~/")) return home + value.slice(1);
  return value;
}

/**
 * Resolve the LifeOS config root (where LIFEOS/, settings.json, hooks/,
 * CLAUDE.md land). Priority: explicit --config-root flag > LIFEOS_HOME (the
 * dedicated LifeOS custom-home override — relocates ONLY LifeOS, not the
 * harness's whole config dir) > CLAUDE_CONFIG_DIR (the harness's own override)
 * > ~/.claude. Every setup Tool resolves its root through this one function so
 * no Tool can drift to a different default (the "defensive fallbacks" lesson).
 */
export function resolveConfigRoot(flagValue?: string): string {
  const home = process.env.HOME || homedir();
  const raw = flagValue || process.env.LIFEOS_HOME || process.env.CLAUDE_CONFIG_DIR || join(home, ".claude");
  return expandHomePrefix(raw, home);
}

/**
 * Resolve the private user-data home (configDir; `<configDir>/USER` is the
 * symlink target of `<configRoot>/LIFEOS/USER`). Priority: explicit
 * --config-dir flag > custom-home default `<configRoot>/USER-data` when
 * LIFEOS_HOME is set (two LifeOS instances must NEVER share one USER tree —
 * isolation is the point of a custom home) > LIFEOS_CONFIG_DIR > ~/.config/LIFEOS.
 */
export function resolveConfigDir(configRoot: string, flagValue?: string): string {
  const home = process.env.HOME || homedir();
  if (flagValue) return expandHomePrefix(flagValue, home);
  if (process.env.LIFEOS_HOME) return join(configRoot, "USER-data");
  const envDir = process.env.LIFEOS_CONFIG_DIR;
  if (envDir) return expandHomePrefix(envDir, home);
  return join(home, ".config", "LIFEOS");
}

/**
 * Guard the system/user separation contract BEFORE any linking: the data home
 * `<configDir>/USER` must never resolve to the live `<configRoot>/LIFEOS/USER`
 * itself — LinkUser would symlink the dir onto itself and destroy the contract.
 * This is reachable today: settings.json ships `LIFEOS_CONFIG_DIR` pointing at
 * `<configRoot>/LIFEOS` (its env-block meaning), while the installers read the
 * same var as the private data home — an installer re-run inside a live session
 * inherits the env value and collapses the two. Fail LOUD instead.
 */
export function checkUserDataSeparation(configRoot: string, configDir: string): { ok: boolean; detail: string } {
  const liveUserDir = resolve(join(configRoot, "LIFEOS", "USER"));
  const dataUserDir = resolve(join(configDir, "USER"));
  if (liveUserDir === dataUserDir) {
    return {
      ok: false,
      detail:
        `user-data home ${dataUserDir} IS the live <configRoot>/LIFEOS/USER — refusing to symlink a directory onto itself. ` +
        `Likely cause: LIFEOS_CONFIG_DIR in the environment points at <configRoot>/LIFEOS (the settings.json env value) ` +
        `instead of the private data home. Pass an explicit --config-dir outside <configRoot>/LIFEOS.`,
    };
  }
  return { ok: true, detail: `${dataUserDir} is distinct from the live USER dir` };
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
 * Signal strength (#1448): config dir + harness binary on PATH beats config dir
 * alone beats binary alone — a leftover ~/.claude dir on a machine without the
 * claude CLI must not out-rank a live OpenCode install. Anything short of a
 * binary match is reported as confidence "assumed", never as fact.
 */
export function detectHarness(home: string): HarnessInfo {
  const candidates: Array<{ name: Harness; root: string; skills: string; bin: string }> = [
    { name: "claude-code", root: process.env.CLAUDE_CONFIG_DIR || join(home, ".claude"), skills: "skills", bin: "claude" },
    { name: "opencode", root: process.env.OPENCODE_CONFIG_DIR || join(home, ".config", "opencode"), skills: "skills", bin: "opencode" },
    { name: "hermes", root: join(home, ".hermes"), skills: "skills", bin: "hermes" },
    { name: "cursor", root: join(home, ".cursor"), skills: "skills", bin: "cursor" },
    { name: "openclaw", root: join(home, ".openclaw"), skills: "skills", bin: "openclaw" },
  ];
  const hasBin = (c: (typeof candidates)[number]) => !!tryExec(`command -v ${c.bin}`);
  const info = (c: (typeof candidates)[number], confidence: HarnessInfo["confidence"]): HarnessInfo => ({
    name: c.name,
    configRoot: c.root,
    skillsDir: join(c.root, c.skills),
    confidence,
  });
  for (const c of candidates) {
    if (existsSync(c.root) && hasBin(c)) return info(c, "detected");
  }
  for (const c of candidates) {
    if (existsSync(c.root)) return info(c, "assumed");
  }
  for (const c of candidates) {
    if (hasBin(c)) return info(c, "detected");
  }
  // Default assumption when nothing is present yet (a clean machine pre-bootstrap).
  return { name: "claude-code", configRoot: join(home, ".claude"), skillsDir: join(home, ".claude", "skills"), confidence: "assumed" };
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
  // LIFEOS_HOME relocates the LifeOS install root (and with it the skills dir)
  // without touching which harness was detected — the harness stays whatever it
  // is; only WHERE LifeOS lives moves.
  if (process.env.LIFEOS_HOME) {
    const overrideRoot = expandHomePrefix(process.env.LIFEOS_HOME, home);
    harness.configRoot = overrideRoot;
    harness.skillsDir = join(overrideRoot, "skills");
  }
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
    configDir: resolveConfigDir(configRoot),
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
const SKIP_DIRS = new Set(["node_modules", ".git", "MEMORY"]);

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

  // Guard: never link a dir onto itself (see checkUserDataSeparation).
  const separation = checkUserDataSeparation(configRoot, configDir);
  if (!separation.ok) {
    return { action: "linked", target: dataUserDir, copied: 0, error: separation.detail };
  }

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
 * `${LIFEOS_DIR}/x`, `$CLAUDE_PROJECT_DIR/x`, or `~/.claude/x` dedupes to one.
 */
function normalizeCommand(cmd: string): string {
  return cmd
    .replace(/\$\{?LIFEOS_DIR\}?|\$\{?CLAUDE_PROJECT_DIR\}?|\$\{?CLAUDE_PLUGIN_ROOT\}?|~\/\.claude|\$HOME\/\.claude|\$\{HOME\}\/\.claude/g, "§ROOT§")
    .replace(/\s+/g, " ")
    .trim();
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
