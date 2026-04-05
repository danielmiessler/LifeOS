#!/usr/bin/env bun
/**
 * pai - Personal AI CLI Tool
 *
 * Comprehensive CLI for managing Claude Code with dynamic MCP loading,
 * updates, version checking, and profile management.
 *
 * Usage:
 *   pai                  Launch Claude (default profile)
 *   pai -m bd            Launch with Bright Data MCP
 *   pai -m bd,ap         Launch with multiple MCPs
 *   pai -r / --resume    Resume last session
 *   pai --local          Stay in current directory (don't cd to ~/.claude)
 *   pai update           Update Claude Code
 *   pai version          Show version info
 *   pai profiles         List available profiles
 *   pai mcp list         List available MCPs
 *   pai mcp set <profile>  Set MCP profile
 */

import { spawn, spawnSync } from "bun";
import { getDAName, getIdentity } from "../../hooks/lib/identity";
import { existsSync, readFileSync, writeFileSync, readdirSync, symlinkSync, unlinkSync, lstatSync } from "fs";
import { homedir } from "os";
import { join, basename } from "path";

// ============================================================================
// Configuration
// ============================================================================

const CLAUDE_DIR = process.env.PAI_DIR || join(homedir(), ".claude");
const MCP_DIR = join(CLAUDE_DIR, "MCPs");
const ACTIVE_MCP = join(CLAUDE_DIR, ".mcp.json");
const BANNER_SCRIPT = join(CLAUDE_DIR, "PAI", "Tools", "Banner.ts");
const VOICE_SERVER = "http://localhost:8888/notify/personality";
const WALLPAPER_DIR = join(homedir(), "Projects", "Wallpaper");
// Note: RAW archiving removed - Claude Code handles its own cleanup (30-day retention in projects/)

// MCP shorthand mappings
const MCP_SHORTCUTS: Record<string, string> = {
  bd: "Brightdata-MCP.json",
  brightdata: "Brightdata-MCP.json",
  ap: "Apify-MCP.json",
  apify: "Apify-MCP.json",
  cu: "ClickUp-MCP.json",
  clickup: "ClickUp-MCP.json",
  chrome: "chrome-enabled.mcp.json",
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
  minimal: "Essential MCPs (content, daemon, Foundry)",
  "chrome-enabled": "Essential + Chrome DevTools",
  "dev-work": "Development tools (Shadcn, Codex, Supabase)",
  security: "Security tools (httpx, naabu)",
  research: "Research tools (Brightdata, Apify, Chrome)",
  clickup: "Official ClickUp MCP (tasks, time tracking, docs)",
  full: "All available MCPs",
};

// ============================================================================
// Utilities
// ============================================================================

function log(message: string, emoji = "") {
  console.log(emoji ? `${emoji} ${message}` : message);
}


function error(message: string) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function notifyVoice(message: string) {
  // Fire and forget voice notification using Qwen3-TTS with personality
  const identity = getIdentity();
  const personality = identity.personality;

  if (!personality?.baseVoice) {
    // Fall back to simple notify if no personality configured
    fetch("http://localhost:8888/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, play: true }),
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
  }).catch(() => {}); // Silently ignore errors
}

function displayBanner() {
  if (existsSync(BANNER_SCRIPT)) {
    spawnSync(["bun", BANNER_SCRIPT], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  }
}

function getCurrentVersion(): string | null {
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
      "https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases/latest"
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
      const target = readFileSync(ACTIVE_MCP, "utf-8");
      // For symlink, we need the real target name
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
    if (file) {
      files.push(file);
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

function setWallpaper(filename: string): boolean {
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
    const script = `tell application "System Events" to tell every desktop to set picture to "${fullPath}"`;
    const macResult = spawnSync(["osascript", "-e", script]);
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
    notifyVoice(`Wallpaper changed to ${name}`);
  } else {
    error("Failed to set wallpaper");
  }
}


// ============================================================================
// Commands
// ============================================================================

async function cmdLaunch(options: { mcp?: string; resume?: boolean; skipPerms?: boolean; local?: boolean }) {
  // CLAUDE.md is now static — no build step needed.
  // Algorithm spec is loaded on-demand when Algorithm mode triggers.
  // (InstantiatePAI.ts is retired — kept for reference only)

  displayBanner();
  const args = ["claude"];

  // Handle MCP configuration
  if (options.mcp) {
    const mcpNames = options.mcp.split(",").map((s) => s.trim());
    setMcpCustom(mcpNames);
  }

  // Add flags
  // NOTE: We no longer use --dangerously-skip-permissions by default.
  // The settings.json permission system (allow/deny/ask) provides proper security.
  // Use --dangerous flag explicitly if you really need to skip all permission checks.
  if (options.resume) {
    args.push("--resume");
  }

  // Change to PAI directory unless --local flag is set
  if (!options.local) {
    process.chdir(CLAUDE_DIR);
  }

  // Voice notification (using focused marker for calmer tone)
  notifyVoice(`[🎯 focused] ${getDAName()} here, ready to go.`);

  // Launch Claude
  const proc = spawn(args, {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env },
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
  const claudeResult = spawnSync(["bash", "-c", "curl -fsSL https://claude.ai/install.sh | bash"]);
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
  const args = ["claude", "-p", prompt];

  process.chdir(CLAUDE_DIR);

  const proc = spawn(args, {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env },
  });

  const exitCode = await proc.exited;
  process.exit(exitCode);
}

function cmdHelp() {
  console.log(`
pai - Personal AI CLI Tool (v2.0.0)

USAGE:
  k                        Launch Claude (no MCPs, max performance)
  k -m <mcp>               Launch with specific MCP(s)
  k -m bd,ap               Launch with multiple MCPs
  k -r, --resume           Resume last session
  k -l, --local            Stay in current directory (don't cd to ~/.claude)

COMMANDS:
  k update                 Update Claude Code to latest version
  k version, -v            Show version information
  k profiles               List available MCP profiles
  k mcp list               List all available MCPs
  k mcp set <profile>      Set MCP profile permanently
  k prompt "<text>"        One-shot prompt execution
  k -w, --wallpaper        List/switch wallpapers (Kitty + macOS)
  k help, -h               Show this help

MCP SHORTCUTS:
  bd, brightdata           Bright Data scraping
  ap, apify                Apify automation
  cu, clickup              Official ClickUp (tasks, time tracking, docs)
  chrome                   Chrome DevTools
  dev                      Development tools
  sec, security            Security tools
  research                 Research tools (BD + Apify + Chrome)
  full                     All MCPs
  min, minimal             Essential MCPs only
  none                     No MCPs

EXAMPLES:
  k                        Start with current profile
  k -m bd                  Start with Bright Data
  k -m bd,ap,chrome        Start with multiple MCPs
  k -r                     Resume last session
  k mcp set research       Switch to research profile
  k update                 Update Claude Code
  k prompt "What time is it?"   One-shot prompt
  k -w                     List available wallpapers
  k -w circuit-board       Switch wallpaper (Kitty + macOS)
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

  // Parse arguments
  let mcp: string | undefined;
  let resume = false;
  let skipPerms = true;
  let local = false;
  let command: string | undefined;
  let subCommand: string | undefined;
  let subArg: string | undefined;
  let promptText: string | undefined;
  let wallpaperArgs: string[] = [];

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
        break;
      case "--safe":
        skipPerms = false;
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
      default:
        if (!arg.startsWith("-")) {
          // Might be an unknown command
          error(`Unknown command: ${arg}. Use 'k help' for usage.`);
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
    default:
      // Launch with options
      await cmdLaunch({ mcp, resume, skipPerms, local });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
