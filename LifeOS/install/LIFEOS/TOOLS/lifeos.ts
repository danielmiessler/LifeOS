#!/usr/bin/env bun
/**
 * @version 1.7.36
 * lifeos — the LifeOS launcher CLI
 * (Canonical name `lifeos`; alias it to whatever you like — public PR #1631, @elhoim.)
 *
 * Comprehensive CLI for managing Claude Code with dynamic MCP loading,
 * updates, version checking, and profile management.
 *
 * Usage:
 *   lifeos             Launch Claude (default profile)
 *   lifeos -m bd       Launch with Bright Data MCP
 *   lifeos -m bd,ap    Launch with multiple MCPs
 *   lifeos -r / --resume  Resume a session (picker, or pass a session ID)
 *   lifeos --local     Stay in current directory (don't cd to ~/.claude; project CLAUDE.md files load only this way — public issue #2176, @selinium)
 *   lifeos -- <flags...>  Forward everything after -- verbatim to `claude`
 *   lifeos update      Update Claude Code
 *   lifeos version     Show version info
 *   lifeos profiles    List available profiles
 *   lifeos mcp list    List available MCPs
 *   lifeos mcp set <profile>  Set MCP profile
 */

import { spawn, spawnSync } from "bun";
import { existsSync, readFileSync, writeFileSync, readdirSync, symlinkSync, unlinkSync, lstatSync } from "fs";
import { homedir } from "os";
import { join, basename } from "path";
import { PULSE_BASE } from "../PULSE/endpoint";
import { getClaudeDir } from "./Paths"; // public issue #1974 @sabo961, PR #1943 @MarnuLombard

// ============================================================================
// Configuration
// ============================================================================

const CLAUDE_DIR = getClaudeDir();
const MCP_DIR = join(CLAUDE_DIR, "MCPs");
const ACTIVE_MCP = join(CLAUDE_DIR, ".mcp.json");
const BANNER_SCRIPT = join(CLAUDE_DIR, "LIFEOS", "TOOLS", "Banner.ts");
const VOICE_SERVER = `${PULSE_BASE}/notify/personality`;
const WALLPAPER_DIR = join(homedir(), "Projects", "Wallpaper");
// Note: RAW archiving removed - Claude Code handles its own cleanup (30-day retention in projects/)

// MCP shorthand mappings
const MCP_SHORTCUTS: Record<string, string> = {
  bd: "Brightdata-MCP.json",
  brightdata: "Brightdata-MCP.json",
  ap: "Apify-MCP.json",
  apify: "Apify-MCP.json",
  dev: "dev-work.mcp.json",
  sec: "security.mcp.json",
  security: "security.mcp.json",
  research: "research.mcp.json",
  full: "full.mcp.json",
  min: "minimal.mcp.json",
  minimal: "minimal.mcp.json",
  none: "none.mcp.json",
};

// Profile descriptions
const PROFILE_DESCRIPTIONS: Record<string, string> = {
  none: "No MCPs (maximum performance)",
  minimal: "Essential MCPs (content, daemon)",
  "dev-work": "Development tools (Shadcn, Codex, Supabase)",
  security: "Security tools (httpx, naabu)",
  research: "Research tools (Brightdata, Apify)",
  full: "All available MCPs",
};

// ============================================================================
// Utilities
// ============================================================================

function log(message: string, emoji = "") {
  console.log(emoji ? `${emoji} ${message}` : message);
}

// Pin the spawned Claude Code (and every hook it runs) to the config root this
// launcher resolved. Claude Code itself reads only CLAUDE_CONFIG_DIR, so an install
// placed via LIFEOS_SKILLS_DIR (install.sh's only root marker, public issue #1968)
// had the harness on ~/.claude while the tools ran elsewhere. Exported only when that
// signal chose the root: a default install sets nothing, so LIFEOS_DIR keeps
// relocating LIFEOS within it (the resolver ignores LIFEOS_DIR once CLAUDE_CONFIG_DIR
// is present). CLAUDE_PLUGIN_ROOT is deliberately NOT a trigger — that is Claude
// Code's own marker for a plugin loaded INTO an existing config dir, and pointing
// CLAUDE_CONFIG_DIR at the plugin tree would invert it. An explicit CLAUDE_CONFIG_DIR
// always wins. ported from public PR #1943, @MarnuLombard
function pinConfigRoot(env: Record<string, string | undefined>): void {
  if (env.CLAUDE_CONFIG_DIR) return;
  if (process.env.LIFEOS_SKILLS_DIR) env.CLAUDE_CONFIG_DIR = CLAUDE_DIR;
}


// True when the current directory is a git repo's MAIN checkout (not a linked
// worktree) AND the repo uses the .claude/worktrees convention. The main
// checkout has --git-dir == --git-common-dir; a linked worktree's --git-dir
// points into .git/worktrees/<name>, so they differ. Fail-open: anything
// unexpected returns false and the launch proceeds (public PR #1579,
// @asdf8675309).
export function inMainCheckoutWithWorktrees(): boolean {
  try {
    // No --path-format flag → works on any git version; the two paths stay
    // directly comparable (both ".git" in a main checkout, divergent in a
    // linked worktree).
    const r = spawnSync(["git", "rev-parse", "--git-dir", "--git-common-dir"]);
    if (r.exitCode !== 0) return false; // not a git repo
    const [gitDir, commonDir] = r.stdout.toString().trim().split("\n");
    if (!gitDir || gitDir !== commonDir) return false; // linked worktree → fine
    const top = spawnSync(["git", "rev-parse", "--show-toplevel"]).stdout.toString().trim();
    if (top.length === 0) return false;
    // "In use" means the dir actually CONTAINS worktrees. The harness creates
    // an empty .claude/worktrees as a side effect of one-off agent isolation;
    // an empty dir must not lock --local out of the main checkout (caught
    // live on this install while porting).
    const wtDir = join(top, ".claude", "worktrees");
    return existsSync(wtDir) && readdirSync(wtDir).length > 0;
  } catch {
    return false;
  }
}

function error(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

// A Core-only install declines the hooks tree, so ../../hooks/lib/identity may
// not exist on disk. Resolve it lazily and fall back to a nameless, voiceless
// identity when it is absent (public issue #1694, @dissembler21-png). With the
// hooks tree present this resolves exactly as the former static import did.
type IdentityModule = typeof import("../../hooks/lib/identity");
type Identity = ReturnType<IdentityModule["getIdentity"]>;

const FALLBACK_IDENTITY: Identity = {
  name: "LifeOS",
  fullName: "LifeOS",
  displayName: "LifeOS",
  mainDAVoiceID: "",
  color: "#3B82F6",
};

let identityModule: IdentityModule | null | undefined;

async function loadIdentityModule(): Promise<IdentityModule | null> {
  if (identityModule === undefined) {
    try {
      identityModule = await import("../../hooks/lib/identity");
    } catch {
      identityModule = null;
    }
  }
  return identityModule;
}

async function getIdentity(): Promise<Identity> {
  const mod = await loadIdentityModule();
  if (!mod) return FALLBACK_IDENTITY;
  try {
    return mod.getIdentity();
  } catch {
    return FALLBACK_IDENTITY;
  }
}

async function getStartupCatchphrase(): Promise<string> {
  const mod = await loadIdentityModule();
  if (!mod) return `${FALLBACK_IDENTITY.name} here, ready to go.`;
  try {
    return mod.getStartupCatchphrase();
  } catch {
    return `${FALLBACK_IDENTITY.name} here, ready to go.`;
  }
}

async function notifyVoice(message: string) {
  // Fire and forget voice notification using Qwen3-TTS with personality
  const identity = await getIdentity();
  const personality = identity.personality;

  if (!personality?.baseVoice) {
    // Fall back to simple notify if no personality configured
    fetch(`${PULSE_BASE}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, play: true }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
    return;
  }

  fetch(VOICE_SERVER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      personality: {
        name: identity.name.toLowerCase(),
        base_voice: personality.baseVoice,
        enthusiasm: personality.enthusiasm,
        energy: personality.energy,
        expressiveness: personality.expressiveness,
        resilience: personality.resilience,
        composure: personality.composure,
        optimism: personality.optimism,
        warmth: personality.warmth,
        formality: personality.formality,
        directness: personality.directness,
        precision: personality.precision,
        curiosity: personality.curiosity,
        playfulness: personality.playfulness,
      },
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {}); // Silently ignore errors
}

function displayBanner() {
  if (existsSync(BANNER_SCRIPT)) {
    spawnSync(["bun", BANNER_SCRIPT], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  }
}

// The launcher wraps the Claude Code CLI. On machines without it (e.g. an
// OpenCode-driven install, #1448) fail with directions, not a bare ENOENT.
function requireClaudeCli() {
  if (Bun.which("claude")) return;
  console.error("❌ Claude Code CLI not found on PATH — `lifeos` wraps the `claude` binary.");
  console.error("   Either install Claude Code (https://claude.com/claude-code), or launch your");
  console.error("   own harness with its system-prompt flag pointed at LIFEOS/LIFEOS_SYSTEM_PROMPT.md");
  console.error("   (see INSTALL.md § Launch command for the non-Claude-Code launch shape).");
  process.exit(1);
}

function getCurrentVersion(): string | null {
  if (!Bun.which("claude")) return null;
  const result = spawnSync(["claude", "--version"]);
  const output = result.stdout.toString();
  const match = output.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
  return match ? match[1] : null;
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (partsA[i] > partsB[i]) return 1;
    if (partsA[i] < partsB[i]) return -1;
  }
  return 0;
}

async function getLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(
      "https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases/latest",
      { signal: AbortSignal.timeout(30000) }
    );
    const version = (await response.text()).trim();
    if (/^[0-9]+\.[0-9]+\.[0-9]+/.test(version)) {
      return version;
    }
  } catch {
    return null;
  }
  return null;
}

// ============================================================================
// MCP Management
// ============================================================================

function getMcpProfiles(): string[] {
  if (!existsSync(MCP_DIR)) return [];
  return readdirSync(MCP_DIR)
    .filter((f) => f.endsWith(".mcp.json"))
    .map((f) => f.replace(".mcp.json", ""));
}

function getIndividualMcps(): string[] {
  if (!existsSync(MCP_DIR)) return [];
  return readdirSync(MCP_DIR)
    .filter((f) => f.endsWith("-MCP.json"))
    .map((f) => f.replace("-MCP.json", ""));
}

function getCurrentProfile(): string | null {
  if (!existsSync(ACTIVE_MCP)) return null;
  try {
    const stats = lstatSync(ACTIVE_MCP);
    if (stats.isSymbolicLink()) {
      const realpath = Bun.spawnSync(["readlink", ACTIVE_MCP]).stdout.toString().trim();
      return basename(realpath).replace(".mcp.json", "");
    }
    return "custom";
  } catch {
    return null;
  }
}

function mergeMcpConfigs(mcpFiles: string[]): object {
  const merged: Record<string, any> = { mcpServers: {} };

  for (const file of mcpFiles) {
    const filepath = join(MCP_DIR, file);
    if (!existsSync(filepath)) {
      log(`Warning: MCP file not found: ${file}`, "⚠️");
      continue;
    }
    try {
      const config = JSON.parse(readFileSync(filepath, "utf-8"));
      if (config.mcpServers) {
        Object.assign(merged.mcpServers, config.mcpServers);
      }
    } catch (e) {
      log(`Warning: Failed to parse ${file}`, "⚠️");
    }
  }

  return merged;
}

function setMcpProfile(profile: string) {
  const profileFile = join(MCP_DIR, `${profile}.mcp.json`);
  if (!existsSync(profileFile)) {
    error(`Profile '${profile}' not found`);
  }

  // Remove existing
  if (existsSync(ACTIVE_MCP)) {
    unlinkSync(ACTIVE_MCP);
  }

  // Create symlink
  symlinkSync(profileFile, ACTIVE_MCP);
  log(`Switched to '${profile}' profile`, "✅");
  log("Restart Claude Code to apply", "⚠️");
}

function setMcpCustom(mcpNames: string[]) {
  const files: string[] = [];

  for (const name of mcpNames) {
    const file = MCP_SHORTCUTS[name.toLowerCase()];
    if (file && existsSync(join(MCP_DIR, file))) {
      files.push(file);
    } else if (file) {
      // public issue #2156, @tzioup: stop before the write, or .mcp.json is
      // replaced with an empty config and exits 0.
      error(`MCP '${name}' maps to ${file}, which is not in ${MCP_DIR}; .mcp.json left untouched`);
    } else {
      // Try direct file match
      const directFile = `${name}-MCP.json`;
      const profileFile = `${name}.mcp.json`;
      if (existsSync(join(MCP_DIR, directFile))) {
        files.push(directFile);
      } else if (existsSync(join(MCP_DIR, profileFile))) {
        files.push(profileFile);
      } else {
        error(`Unknown MCP: ${name}`);
      }
    }
  }

  const merged = mergeMcpConfigs(files);

  // Remove symlink if exists, write new file
  if (existsSync(ACTIVE_MCP)) {
    unlinkSync(ACTIVE_MCP);
  }
  writeFileSync(ACTIVE_MCP, JSON.stringify(merged, null, 2));

  const serverCount = Object.keys((merged as any).mcpServers || {}).length;
  if (serverCount > 0) {
    log(`Configured ${serverCount} MCP server(s): ${mcpNames.join(", ")}`, "✅");
  }
}

// ============================================================================
// Wallpaper Management
// ============================================================================

function getWallpapers(): string[] {
  if (!existsSync(WALLPAPER_DIR)) return [];
  return readdirSync(WALLPAPER_DIR)
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort();
}

function getWallpaperName(filename: string): string {
  return basename(filename).replace(/\.(png|jpg|jpeg|webp)$/i, "");
}

function findWallpaper(query: string): string | null {
  const wallpapers = getWallpapers();
  const queryLower = query.toLowerCase();

  // Exact match (without extension)
  const exact = wallpapers.find((w) => getWallpaperName(w).toLowerCase() === queryLower);
  if (exact) return exact;

  // Partial match
  const partial = wallpapers.find((w) => getWallpaperName(w).toLowerCase().includes(queryLower));
  if (partial) return partial;

  // Fuzzy: any word match
  const words = queryLower.split(/[-_\s]+/);
  const fuzzy = wallpapers.find((w) => {
    const name = getWallpaperName(w).toLowerCase();
    return words.some((word) => name.includes(word));
  });
  return fuzzy || null;
}

// The AppleScript source is a constant; the path travels as argv item 1, never
// interpolated, so a filename containing quotes cannot inject script.
export function macWallpaperCommand(fullPath: string): string[] {
  return [
    "osascript",
    "-e", "on run argv",
    "-e", 'tell application "System Events" to tell every desktop to set picture to (item 1 of argv)',
    "-e", "end run",
    "--", fullPath,
  ];
}

function setWallpaper(filename: string): boolean {
  if (filename !== basename(filename)) {
    log(`Refusing wallpaper name with path components: ${filename}`, "❌");
    return false;
  }
  const fullPath = join(WALLPAPER_DIR, filename);
  if (!existsSync(fullPath)) {
    log(`Wallpaper not found: ${fullPath}`, "❌");
    return false;
  }

  let success = true;

  // Set Kitty background
  try {
    const kittyResult = spawnSync(["kitty", "@", "set-background-image", fullPath]);
    if (kittyResult.exitCode === 0) {
      log("Kitty background set", "✅");
    } else {
      log("Failed to set Kitty background", "⚠️");
      success = false;
    }
  } catch {
    log("Kitty not available", "⚠️");
  }

  // Set macOS desktop background
  try {
    const macResult = spawnSync(macWallpaperCommand(fullPath));
    if (macResult.exitCode === 0) {
      log("macOS desktop set", "✅");
    } else {
      log("Failed to set macOS desktop", "⚠️");
      success = false;
    }
  } catch {
    log("Could not set macOS desktop", "⚠️");
  }

  return success;
}

/**
 * `k doctor` — the capability check. Doctor.ts and the statusline both advise
 * running "lifeos doctor" on a capability regression, but there was no such
 * subcommand: the only working invocation was the more obscure
 * `bun LIFEOS/TOOLS/Doctor.ts`. Extra args are forwarded verbatim, so
 * `k doctor --network` and `k doctor decline <name>` work too.
 * public PR #1637, @elhoim
 */
function cmdDoctor(args: string[]) {
  const doctor = join(CLAUDE_DIR, "LIFEOS", "TOOLS", "Doctor.ts");
  const result = spawnSync(["bun", doctor, ...args], {
    stdin: "inherit", stdout: "inherit", stderr: "inherit",
  });
  process.exit(result.exitCode ?? 0);
}

function cmdWallpaper(args: string[]) {
  const wallpapers = getWallpapers();

  if (wallpapers.length === 0) {
    error(`No wallpapers found in ${WALLPAPER_DIR}`);
  }

  // No args or --list: show available wallpapers
  if (args.length === 0 || args[0] === "--list" || args[0] === "-l" || args[0] === "list") {
    log("Available wallpapers:", "🖼️");
    console.log();
    wallpapers.forEach((w, i) => {
      console.log(`  ${i + 1}. ${getWallpaperName(w)}`);
    });
    console.log();
    log("Usage: k -w <name>", "💡");
    log("Example: k -w circuit-board", "💡");
    return;
  }

  // Find and set the wallpaper
  const query = args.join(" ");
  const match = findWallpaper(query);

  if (!match) {
    log(`No wallpaper matching "${query}"`, "❌");
    console.log("\nAvailable wallpapers:");
    wallpapers.forEach((w) => console.log(`  - ${getWallpaperName(w)}`));
    process.exit(1);
  }

  const name = getWallpaperName(match);
  log(`Switching to: ${name}`, "🖼️");

  const success = setWallpaper(match);
  if (success) {
    log(`Wallpaper set to ${name}`, "✅");
    void notifyVoice(`Wallpaper changed to ${name}`);
  } else {
    error("Failed to set wallpaper");
  }
}


// ============================================================================
// Commands
// ============================================================================

// public issue #2255, @coygeek: a missing system prompt used to be dropped silently, so the
// session ran without the constitutional layer and nothing said so. An explicit -s path that
// does not exist is a hard error; a missing default warns loudly and continues.
function systemPromptArgs(explicit?: string): string[] {
  const file = explicit ?? join(CLAUDE_DIR, "LIFEOS", "LIFEOS_SYSTEM_PROMPT.md");
  if (existsSync(file)) return ["--append-system-prompt-file", file];
  if (explicit !== undefined) {
    console.error(`lifeos: system prompt not found: ${explicit}`);
    process.exit(1);
  }
  console.error(`lifeos: warning: default system prompt not found (${file}); this session has no LifeOS system prompt`);
  return [];
}

async function cmdLaunch(options: { mcp?: string; resume?: boolean; resumeId?: string; local?: boolean; systemPrompt?: string; passthrough?: string[] }) {
  // CLAUDE.md is now static — no build step needed.
  // Algorithm spec is loaded on-demand when Algorithm mode triggers.
  // (InstantiatePAI.ts is retired — kept for reference only)

  requireClaudeCli();
  displayBanner();
  // LIFEOS_CLAUDE_LAUNCH overrides what actually spawns (default "claude").
  // Set it to a command prefix — e.g. `ollama launch claude --` — to route the
  // launch through a wrapper. Split on spaces: it is a short prefix, not a
  // quoted path; a path form would need argv escaping first.
  const base = process.env.LIFEOS_CLAUDE_LAUNCH?.trim()
    ? process.env.LIFEOS_CLAUDE_LAUNCH.trim().split(/\s+/)
    : ["claude"];
  const args = base;

  // LifeOS System Prompt — constitutional rules appended to Claude Code's system prompt
  // These rules get highest instruction authority (system prompt layer > CLAUDE.md layer)
  args.push(...systemPromptArgs(options.systemPrompt));

  // Handle MCP configuration
  if (options.mcp) {
    const mcpNames = options.mcp.split(",").map((s) => s.trim());
    setMcpCustom(mcpNames);
  }

  // Add flags
  // NOTE: We never pass --dangerously-skip-permissions. Permissions come from
  // the settings.json allow/deny/ask system, full stop. (A comment here used to
  // advertise a --dangerous flag the parser never implemented — public issue
  // #1691, @catchingknives.)
  if (options.resume) {
    args.push("--resume");
    // Forward a specific session ID when given; bare --resume opens the picker.
    if (options.resumeId) {
      args.push(options.resumeId);
    }
  }

  // Guard (public PR #1579, @asdf8675309): --local launches Claude in the
  // CURRENT directory. If that's a repo's main checkout (not a worktree) and
  // the repo uses .claude/worktrees, the whole session would run on whatever
  // stale branch the root is parked on. Refuse unless explicitly overridden.
  if (options.local && process.env.LIFEOS_ALLOW_ROOT !== "1" && inMainCheckoutWithWorktrees()) {
    error(
      "You're in the main checkout root, not a worktree.\n" +
        "   A --local session here runs on whatever branch the root is parked on.\n" +
        "   cd into a worktree first, or set LIFEOS_ALLOW_ROOT=1 to override.",
    );
  }

  // Change to LifeOS directory unless --local flag is set
  if (!options.local) {
    process.chdir(CLAUDE_DIR);
  }

  // Flags this CLI doesn't model (e.g. --fork-session) reach `claude` verbatim
  // after a bare `--`. Without it the parser's default branch swallowed every
  // unrecognized dash-flag silently (public issue #1690, @catchingknives).
  if (options.passthrough?.length) {
    args.push(...options.passthrough);
  }

  // Voice notification, plain text: no emotion marker, so the greeting gets the
  // same delivery as the spoken closer. On v4 a marker becomes a performed audio
  // tag, and "[🎯 focused]" made the greeting sound hyped (2026-09-28).
  // Reads daidentity.startupCatchphrase from settings.json so the user's
  // install-time catchphrase is actually honored. Falls back to the
  // historical "<name> here, ready to go." default when unset.
  void notifyVoice(await getStartupCatchphrase());

  // Launch Claude
  // BILLING: subscription, not API. Strip ANTHROPIC_API_KEY before spawn so the
  // interactive session uses OAuth (`claude /login`) instead of API-key billing.
  // Mirrors the protection in cmdPrompt() — same hazard, same fix.
  const launchEnv = { ...process.env };
  delete launchEnv.ANTHROPIC_API_KEY;
  launchEnv.CLAUDE_CODE_WORKFLOWS = "1";
  pinConfigRoot(launchEnv);
  const proc = spawn(args, {
    stdio: ["inherit", "inherit", "inherit"],
    env: launchEnv,
  });

  // Wait for Claude to exit
  await proc.exited;
}

async function cmdUpdate() {
  log("Checking for updates...", "🔍");

  const current = getCurrentVersion();
  const latest = await getLatestVersion();

  if (!current) {
    error("Could not detect current version");
  }

  console.log(`Current: v${current}`);
  if (latest) {
    console.log(`Latest:  v${latest}`);
  }

  // Skip if already up to date
  if (latest && compareVersions(current, latest) >= 0) {
    log("Already up to date", "✅");
    return;
  }

  log("Updating Claude Code...", "🔄");

  // Step 1: Update Bun
  log("Step 1/2: Updating Bun...", "📦");
  const bunResult = spawnSync(["brew", "upgrade", "bun"]);
  if (bunResult.exitCode !== 0) {
    log("Bun update skipped (may already be latest)", "⚠️");
  } else {
    log("Bun updated", "✅");
  }

  // Step 2: Update Claude Code
  log("Step 2/2: Installing latest Claude Code...", "🤖");
  const claudeResult = spawnSync(["bash", "-c", claudeInstallScript()]);
  if (claudeResult.exitCode !== 0) {
    error("Claude Code installation failed");
  }
  log("Claude Code updated", "✅");

  // Show final version
  const newVersion = getCurrentVersion();
  if (newVersion) {
    console.log(`Now running: v${newVersion}`);
  }
}

// pipefail: a failed curl must not be masked by bash exiting 0 on empty stdin.
export function claudeInstallScript(): string {
  return "set -o pipefail; curl -fsSL https://claude.ai/install.sh | bash";
}

async function cmdVersion() {
  log("Checking versions...", "🔍");

  const current = getCurrentVersion();
  const latest = await getLatestVersion();

  if (!current) {
    error("Could not detect current version");
  }

  console.log(`Current: v${current}`);
  if (latest) {
    console.log(`Latest:  v${latest}`);
    const cmp = compareVersions(current, latest);
    if (cmp >= 0) {
      log("Up to date", "✅");
    } else {
      log("Update available (run 'k update')", "⚠️");
    }
  } else {
    log("Could not fetch latest version", "⚠️");
  }
}

function cmdProfiles() {
  log("Available MCP Profiles:", "📋");
  console.log();

  const current = getCurrentProfile();
  const profiles = getMcpProfiles();

  for (const profile of profiles) {
    const isCurrent = profile === current;
    const desc = PROFILE_DESCRIPTIONS[profile] || "";
    const marker = isCurrent ? "→ " : "  ";
    const badge = isCurrent ? " (active)" : "";
    console.log(`${marker}${profile}${badge}`);
    if (desc) console.log(`    ${desc}`);
  }

  console.log();
  log("Usage: k mcp set <profile>", "💡");
}

function cmdMcpList() {
  log("Available MCPs:", "📋");
  console.log();

  // Individual MCPs
  log("Individual MCPs (use with -m):", "📦");
  const mcps = getIndividualMcps();
  for (const mcp of mcps) {
    const shortcut = Object.entries(MCP_SHORTCUTS)
      .filter(([_, v]) => v === `${mcp}-MCP.json`)
      .map(([k]) => k);
    const shortcuts = shortcut.length > 0 ? ` (${shortcut.join(", ")})` : "";
    console.log(`  ${mcp}${shortcuts}`);
  }

  console.log();
  log("Profiles (use with 'k mcp set'):", "📁");
  const profiles = getMcpProfiles();
  for (const profile of profiles) {
    const desc = PROFILE_DESCRIPTIONS[profile] || "";
    console.log(`  ${profile}${desc ? ` - ${desc}` : ""}`);
  }

  console.log();
  log("Examples:", "💡");
  console.log("  k -m bd          # Bright Data only");
  console.log("  k -m bd,ap       # Bright Data + Apify");
  console.log("  k mcp set research  # Full research profile");
}

async function cmdPrompt(prompt: string) {
  // One-shot prompt execution
  // NOTE: No --dangerously-skip-permissions - rely on settings.json permissions
  // BILLING: subscription, not API. Removed --bare (forces ANTHROPIC_API_KEY),
  // strip the key from inherited env.
  requireClaudeCli();
  const args = ["claude", "-p", prompt];

  // Same constitutional layer as interactive launches — without this, one-shots
  // ran bare Claude Code (CLAUDE.md only, no output format, no security protocol).
  args.push(...systemPromptArgs());

  process.chdir(CLAUDE_DIR);

  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  delete env.ANTHROPIC_API_KEY;
  env.CLAUDE_CODE_WORKFLOWS = "1";
  pinConfigRoot(env);
  const proc = spawn(args, {
    stdio: ["inherit", "inherit", "inherit"],
    env,
  });

  const exitCode = await proc.exited;
  process.exit(exitCode);
}

function cmdHelp() {
  console.log(`
lifeos — LifeOS launcher CLI (v2.2.0)

USAGE:
  lifeos                   Launch Claude (no MCPs, max performance)
  lifeos -m <mcp>          Launch with specific MCP(s)
  lifeos -m bd,ap          Launch with multiple MCPs
  lifeos -r, --resume [id]  Resume a session (interactive picker, or a specific session ID)
  lifeos -s, --system-prompt  System prompt file to append (default: LIFEOS_SYSTEM_PROMPT.md)
  lifeos -l, --local       Stay in current directory (don't cd to ~/.claude)
  lifeos -- <flags...>     Forward everything after -- straight to \`claude\`

COMMANDS:
  lifeos update            Update Claude Code to latest version
  lifeos version, -v       Show version information
  lifeos profiles          List available MCP profiles
  lifeos mcp list          List all available MCPs
  lifeos mcp set <profile>  Set MCP profile permanently
  lifeos prompt "<text>"   One-shot prompt execution
  lifeos -w, --wallpaper   List/switch wallpapers (Kitty + macOS)
  lifeos doctor [args]     Run the capability check (args forwarded to Doctor.ts)
  lifeos help, -h          Show this help

MCP SHORTCUTS:
  bd, brightdata           Bright Data scraping
  ap, apify                Apify automation
  dev                      Development tools
  sec, security            Security tools
  research                 Research tools (BD + Apify)
  full                     All MCPs
  min, minimal             Essential MCPs only
  none                     No MCPs

EXAMPLES:
  lifeos                   Start with current profile
  lifeos -m bd             Start with Bright Data
  lifeos -m bd,ap          Start with multiple MCPs
  lifeos -r                Resume a session (picker), or 'lifeos -r <id>' for a specific one
  lifeos mcp set research  Switch to research profile
  lifeos update            Update Claude Code
  lifeos prompt "What time is it?"  One-shot prompt
  lifeos -w                List available wallpapers
  lifeos -w circuit-board  Switch wallpaper (Kitty + macOS)
  lifeos -r -- --fork-session  Resume, forwarding --fork-session to claude

NOTE:
  Flags this CLI doesn't know are ignored, not rejected. To hand a native
  Claude Code flag to the underlying \`claude\` process, put it after \`--\`.
`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // No args - launch without touching MCP config (use native /mcp commands)
  if (args.length === 0) {
    await cmdLaunch({});
    return;
  }

  // `k` is aliased to `bun <this file>`, and bun CONSUMES a `--` that sits
  // immediately after the script path — verified: `-- --fork-session` arrives as
  // ["--fork-session"], while `-r -- --fork-session` keeps its separator. Only
  // that first one is eaten. So a leading dash-flag we don't model is the tail of
  // a separator the runtime swallowed; forwarding it is what the user asked for,
  // and the default branch below would otherwise silently drop it all over again
  // (public issue #1690, @catchingknives).
  const KNOWN_FLAGS = new Set([
    "-m", "--mcp", "-r", "--resume", "-s", "--system-prompt", "-l", "--local",
    "-v", "--version", "-h", "--help", "-p", "-w", "--wallpaper", "--",
  ]);
  if (args[0].startsWith("-") && !KNOWN_FLAGS.has(args[0])) {
    await cmdLaunch({ passthrough: args });
    return;
  }

  // Parse arguments
  let mcp: string | undefined;
  let resume = false;
  let resumeId: string | undefined;
  let local = false;
  let systemPrompt: string | undefined;
  let command: string | undefined;
  let subCommand: string | undefined;
  let subArg: string | undefined;
  let promptText: string | undefined;
  let wallpaperArgs: string[] = [];
  let doctorArgs: string[] = [];
  let passthrough: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-m":
      case "--mcp":
        const nextArg = args[i + 1];
        // -m with no arg, or -m 0, or -m "" means no MCPs
        if (!nextArg || nextArg.startsWith("-") || nextArg === "0" || nextArg === "") {
          mcp = "none";
          if (nextArg === "0" || nextArg === "") i++;
        } else {
          mcp = args[++i];
        }
        break;
      case "-r":
      case "--resume":
        resume = true;
        // Optional session ID: `k -r <session-id>` resumes that session
        // directly; bare `k -r` opens the interactive picker.
        if (args[i + 1] && !args[i + 1].startsWith("-")) {
          resumeId = args[++i];
        }
        break;
      case "-s":
      case "--system-prompt":
        systemPrompt = args[++i];
        break;
      case "-l":
      case "--local":
        local = true;
        break;
      case "-v":
      case "--version":
      case "version":
        command = "version";
        break;
      case "-h":
      case "--help":
      case "help":
        command = "help";
        break;
      case "update":
        command = "update";
        break;
      case "profiles":
        command = "profiles";
        break;
      case "mcp":
        command = "mcp";
        subCommand = args[++i];
        subArg = args[++i];
        break;
      case "prompt":
      case "-p":
        command = "prompt";
        promptText = args.slice(i + 1).join(" ");
        i = args.length; // Exit loop
        break;
      case "-w":
      case "--wallpaper":
        command = "wallpaper";
        wallpaperArgs = args.slice(i + 1);
        i = args.length; // Exit loop
        break;
      case "doctor":
        command = "doctor";
        doctorArgs = args.slice(i + 1);
        i = args.length; // Exit loop
        break;
      case "--":
        // Everything after a bare `--` is forwarded verbatim to `claude`.
        passthrough = args.slice(i + 1);
        i = args.length; // Exit loop
        break;
      default:
        if (!arg.startsWith("-")) {
          // Might be an unknown command
          error(`Unknown command: ${arg}. Use 'lifeos help' for usage.`);
        }
    }
  }

  // Handle commands
  switch (command) {
    case "version":
      await cmdVersion();
      break;
    case "help":
      cmdHelp();
      break;
    case "update":
      await cmdUpdate();
      break;
    case "profiles":
      cmdProfiles();
      break;
    case "mcp":
      if (subCommand === "list") {
        cmdMcpList();
      } else if (subCommand === "set" && subArg) {
        setMcpProfile(subArg);
      } else {
        error("Usage: k mcp list | k mcp set <profile>");
      }
      break;
    case "prompt":
      if (!promptText) {
        error("Usage: k prompt \"your prompt here\"");
      }
      await cmdPrompt(promptText);
      break;
    case "wallpaper":
      cmdWallpaper(wallpaperArgs);
      break;
    case "doctor":
      cmdDoctor(doctorArgs);
      break;
    default:
      // Launch with options
      await cmdLaunch({ mcp, resume, resumeId, local, systemPrompt, passthrough });
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
