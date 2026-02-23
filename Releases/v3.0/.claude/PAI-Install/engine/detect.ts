/**
 * PAI Installer v3.0 — System Detection
 * Detects OS, tools, existing PAI installation, and environment.
 * All detection is read-only and non-destructive.
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { DetectionResult } from "./types";

function tryExec(cmd: string): string | null {
  try {
    return execSync(cmd, { timeout: 5000, stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function detectOS(): DetectionResult["os"] {
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch;

  let version = "";
  let name = "";

  if (platform === "darwin") {
    const swVers = tryExec("sw_vers -productVersion");
    version = swVers || "";
    name = `macOS ${version}`;
  } else {
    const release = tryExec("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'");
    name = release || "Linux";
    version = tryExec("uname -r") || "";
  }

  return { platform, arch, version, name };
}

function detectShell(): DetectionResult["shell"] {
  const shellPath = process.env.SHELL || "/bin/sh";
  const shellName = shellPath.split("/").pop() || "sh";
  const version = tryExec(`${shellPath} --version 2>&1 | head -1`) || "";

  return { name: shellName, version, path: shellPath };
}

function detectTool(
  name: string,
  versionCmd: string
): { installed: boolean; version?: string; path?: string } {
  const path = tryExec(`which ${name}`);
  if (!path) return { installed: false };

  const versionOutput = tryExec(versionCmd);
  // Extract version number from output
  const versionMatch = versionOutput?.match(/(\d+\.\d+[\.\d]*)/);
  const version = versionMatch?.[1] || versionOutput || undefined;

  return { installed: true, version, path };
}

function detectExisting(
  home: string,
  paiDir: string,
  configDir: string
): DetectionResult["existing"] {
  const result: DetectionResult["existing"] = {
    paiInstalled: false,
    hasApiKeys: false,
    elevenLabsKeyFound: false,
    backupPaths: [],
  };

  // Check for existing PAI installation
  const settingsPath = join(paiDir, "settings.json");
  if (existsSync(settingsPath)) {
    result.paiInstalled = true;
    result.settingsPath = settingsPath;

    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      result.paiVersion = settings.pai?.version || settings.paiVersion || "unknown";
    } catch {
      result.paiVersion = "unknown";
    }
  }

  // Check for existing PAI skill
  if (existsSync(join(paiDir, "skills", "PAI", "SKILL.md"))) {
    result.paiInstalled = true;
  }

  // Check for API keys in env file
  const envPath = join(configDir, ".env");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      result.elevenLabsKeyFound = envContent.includes("ELEVENLABS_API_KEY=");
      result.hasApiKeys = result.elevenLabsKeyFound;
    } catch {
      // Permission denied or other error
    }
  }

  // Check for backup directories
  const backupPatterns = [
    join(home, ".claude-backup"),
    join(home, ".claude-old"),
    join(home, ".claude-BACKUP"),
  ];
  for (const bp of backupPatterns) {
    if (existsSync(bp)) {
      result.backupPaths.push(bp);
    }
  }

  return result;
}

/**
 * Run full system detection. Safe, read-only, non-destructive.
 */
export function detectSystem(): DetectionResult {
  const home = homedir();
  const paiDir = join(home, ".claude");
  const configDir = process.env.PAI_CONFIG_DIR || join(home, ".config", "PAI");

  return {
    os: detectOS(),
    shell: detectShell(),
    tools: {
      bun: detectTool("bun", "bun --version"),
      git: detectTool("git", "git --version"),
      claude: detectTool("claude", "claude --version 2>&1"),
      node: detectTool("node", "node --version"),
      brew: {
        installed: tryExec("which brew") !== null,
        path: tryExec("which brew") || undefined,
      },
    },
    existing: detectExisting(home, paiDir, configDir),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    homeDir: home,
    paiDir,
    configDir,
  };
}

/**
 * Validate an ElevenLabs API key.
 * Uses /v1/voices endpoint (requires only voices_read permission)
 * instead of /v1/user (requires user_read, which many keys lack).
 * Also handles 401 with missing_permissions as "valid key, limited scope".
 */
export async function validateElevenLabsKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { valid: true };

    // 401 with missing_permissions means the key IS valid but lacks a specific scope
    // This still means TTS will work (TTS doesn't need voices_read to use a known voice_id)
    if (res.status === 401) {
      try {
        const body = await res.json();
        if (body?.detail?.status === "missing_permissions") {
          return { valid: true }; // Key is valid, just limited permissions
        }
      } catch { /* fall through to error */ }
    }

    return { valid: false, error: `HTTP ${res.status}` };
  } catch (e: any) {
    return { valid: false, error: e.message || "Network error" };
  }
}
