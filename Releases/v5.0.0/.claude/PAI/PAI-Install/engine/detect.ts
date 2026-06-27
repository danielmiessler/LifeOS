/**
 * PAI Installer v5.0 — System Detection
 * Detects OS, tools, existing PAI installation, and environment.
 * All detection is read-only and non-destructive.
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { AdapterPathDetection, DetectionResult, ExistingUserContentDetection } from "./types";
import { resolveInstallerAdapterPaths } from "./install-targets";

function tryExec(cmd: string, env?: Record<string, string | undefined>): string | null {
  try {
    return execSync(cmd, {
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : process.env,
    })
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
  versionCmd: string,
  env?: Record<string, string | undefined>,
): { installed: boolean; version?: string; path?: string } {
  const path = tryExec(`command -v ${name}`, env);
  if (!path) return { installed: false };

  const versionOutput = tryExec(versionCmd, env);
  // Extract version number from output
  const versionMatch = versionOutput?.match(/(\d+\.\d+[\.\d]*)/);
  const version = versionMatch?.[1] || versionOutput || undefined;

  return { installed: true, version, path };
}

function detectExisting(
  home: string,
  adapter: AdapterPathDetection,
  _configDir: string
): DetectionResult["existing"] {
  const result: DetectionResult["existing"] = {
    paiInstalled: false,
    hasApiKeys: false,
    elevenLabsKeyFound: false,
    backupPaths: [],
    apiKeys: {},
  };

  const settingsPath = adapter.harness === "codex"
    ? join(adapter.paiDir, "settings.json")
    : join(adapter.harnessHome, "settings.json");
  if (existsSync(settingsPath)) {
    result.paiInstalled = true;
    result.settingsPath = settingsPath;
  }

  // Check for existing PAI skill
  if (
    existsSync(join(adapter.harnessHome, "skills", "PAI", "SKILL.md")) ||
    existsSync(join(adapter.harnessHome, "skills", "PAIUpgrade", "SKILL.md")) ||
    existsSync(join(adapter.paiDir, "ALGORITHM", "LATEST"))
  ) {
    result.paiInstalled = true;
  }

  // Check for backup directories
  const backupPatterns = [
    join(home, ".claude-backup"),
    join(home, ".claude-old"),
    join(home, ".claude-BACKUP"),
    join(home, ".claude.bak"),
  ];
  for (const bp of backupPatterns) {
    if (existsSync(bp)) {
      result.backupPaths.push(bp);
    }
  }
  return result;
}

/**
 * Scan shell rc files and config dirs for API-key VALUES. Returns a map of
 * provider → key. Only well-formed assignments are accepted (no `$VAR`
 * indirection, no obvious placeholders).
 */
export function scanApiKeys(
  home: string,
  configDir: string
): NonNullable<DetectionResult["existing"]["apiKeys"]> {
  const candidates = [
    join(home, ".zshenv"),
    join(home, ".zshrc"),
    join(home, ".zprofile"),
    join(home, ".bashrc"),
    join(home, ".bash_profile"),
    join(home, ".profile"),
    join(configDir, ".env"),
    join(configDir, "credentials.env"),
  ];

  const patterns: Array<[keyof NonNullable<DetectionResult["existing"]["apiKeys"]>, RegExp]> = [
    ["elevenLabs", /(?:^|\n)\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s#]+)/],
    ["anthropic", /(?:^|\n)\s*(?:export\s+)?ANTHROPIC_API_KEY\s*=\s*["']?([^"'\s#]+)/],
    ["openai", /(?:^|\n)\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*["']?([^"'\s#]+)/],
    ["google", /(?:^|\n)\s*(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_GENAI_API_KEY)\s*=\s*["']?([^"'\s#]+)/],
    ["xai", /(?:^|\n)\s*(?:export\s+)?(?:XAI_API_KEY|GROK_API_KEY)\s*=\s*["']?([^"'\s#]+)/],
    ["perplexity", /(?:^|\n)\s*(?:export\s+)?PERPLEXITY_API_KEY\s*=\s*["']?([^"'\s#]+)/],
  ];

  const placeholderHints = /^(your-key-here|sk-xxxxxxxx|xxxxx|REPLACE_ME|TODO)/i;
  const found: NonNullable<DetectionResult["existing"]["apiKeys"]> = {};

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    let content: string;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue; // permission denied, etc.
    }
    for (const [provider, regex] of patterns) {
      if (found[provider]) continue;
      const m = content.match(regex);
      if (!m) continue;
      const value = m[1];
      if (value.startsWith("$")) continue; // `KEY=$OTHER_VAR` indirection
      if (placeholderHints.test(value)) continue;
      if (value.length < 12) continue; // empty / obviously stub
      found[provider] = value;
    }
  }

  return found;
}

/**
 * Try to recover the DA's name from a prior install or any backup tree. Reads
 * `PAI/USER/DA_IDENTITY.md` (or .yaml) and pulls the name from the title line
 * (`# DA Identity — Atlas`) or a `name:` frontmatter / yaml field.
 */
function detectDaName(paiDir: string, backupPaths: string[]): string | undefined {
  const roots = [paiDir, ...backupPaths];
  const relCandidates = [
    "USER/DA_IDENTITY.md",
    "USER/DA_IDENTITY.yaml",
    "USER/DA/IDENTITY.md",
    "PAI/USER/DA_IDENTITY.md",
    "PAI/USER/DA_IDENTITY.yaml",
    "PAI/USER/DA/IDENTITY.md",
  ];

  for (const root of roots) {
    for (const rel of relCandidates) {
      const p = join(root, rel);
      if (!existsSync(p)) continue;
      let content: string;
      try {
        content = readFileSync(p, "utf-8");
      } catch {
        continue;
      }
      // `# DA Identity — Atlas` or `# DA Identity - Atlas`
      const titleMatch = content.match(/^#\s*DA Identity\s*[—–-]\s*([A-Za-z][\w\s'-]+?)\s*$/m);
      if (titleMatch) return titleMatch[1].trim();
      // YAML/frontmatter `name: Atlas`
      const yamlMatch = content.match(/^\s*name:\s*["']?([A-Za-z][\w\s'-]+?)["']?\s*$/m);
      if (yamlMatch) return yamlMatch[1].trim();
    }
  }
  return undefined;
}

function fileExists(root: string, relPath: string): boolean {
  return existsSync(join(root, relPath));
}

function countGoals(goalsPath: string): number {
  if (!existsSync(goalsPath)) return 0;
  try {
    const content = readFileSync(goalsPath, "utf-8");
    const matches = content.match(/^\s*-\s*(?:\*\*G|G)/gm);
    return matches?.length || 0;
  } catch {
    return 0;
  }
}

function countContacts(contactsPath: string): number {
  if (!existsSync(contactsPath)) return 0;
  try {
    const content = readFileSync(contactsPath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^##\s+/.test(line) || /^[-*]\s+/.test(line)).length;
  } catch {
    return 0;
  }
}

function countProjectRows(projectsPath: string): number {
  if (!existsSync(projectsPath)) return 0;
  try {
    const lines = readFileSync(projectsPath, "utf-8").split("\n");
    const separatorIndex = lines.findIndex((line) => /^\s*\|?\s*[-:]+\s*\|/.test(line));
    if (separatorIndex === -1) return 0;
    return lines
      .slice(separatorIndex + 1)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("|") && !/^\|\s*[-:]+\s*\|?$/.test(line))
      .length;
  } catch {
    return 0;
  }
}

export function detectExistingUserContent(paiUserDir: string): ExistingUserContentDetection {
  return {
    telos: {
      mission: fileExists(paiUserDir, "TELOS/MISSION.md"),
      goals: fileExists(paiUserDir, "TELOS/GOALS.md"),
      goalsCount: countGoals(join(paiUserDir, "TELOS", "GOALS.md")),
      activeProblems: fileExists(paiUserDir, "TELOS/ACTIVE_PROBLEMS.md"),
      strategy: fileExists(paiUserDir, "TELOS/STRATEGY.md"),
      principles: fileExists(paiUserDir, "TELOS/PRINCIPLES.md"),
      areas: fileExists(paiUserDir, "TELOS/AREAS.md"),
      now: fileExists(paiUserDir, "TELOS/NOW.md"),
    },
    identity: {
      principalIdentity: fileExists(paiUserDir, "PRINCIPAL_IDENTITY.md"),
      daIdentity: fileExists(paiUserDir, "DA_IDENTITY.md"),
      daIdentityYaml: fileExists(paiUserDir, "DA_IDENTITY.yaml"),
      workingStyle: fileExists(paiUserDir, "WORKINGSTYLE.md"),
      rhetoricalStyle: fileExists(paiUserDir, "RHETORICALSTYLE.md"),
      aiWritingPatterns: fileExists(paiUserDir, "AI_WRITING_PATTERNS.md"),
      feed: fileExists(paiUserDir, "FEED.md"),
      resume: fileExists(paiUserDir, "RESUME.md"),
      ourStory: fileExists(paiUserDir, "OUR_STORY.md"),
      definitions: fileExists(paiUserDir, "DEFINITIONS.md"),
      coreContent: fileExists(paiUserDir, "CORECONTENT.md"),
      beliefs: fileExists(paiUserDir, "BELIEFS.md"),
    },
    contacts: {
      contacts: fileExists(paiUserDir, "CONTACTS.md"),
      count: countContacts(join(paiUserDir, "CONTACTS.md")),
    },
    opinions: {
      opinions: fileExists(paiUserDir, "OPINIONS.md"),
    },
    projects: {
      projectsIndex: fileExists(paiUserDir, "PROJECTS.md"),
      projectsDirectory: fileExists(paiUserDir, "PROJECTS"),
      count: countProjectRows(join(paiUserDir, "PROJECTS.md")),
    },
    business: {
      present: fileExists(paiUserDir, "BUSINESS") || fileExists(paiUserDir, "BUSINESS.md"),
    },
    finances: {
      present: fileExists(paiUserDir, "FINANCES") || fileExists(paiUserDir, "FINANCES.md"),
    },
    health: {
      present: fileExists(paiUserDir, "HEALTH") || fileExists(paiUserDir, "HEALTH.md"),
    },
  };
}

/**
 * Detect the principal's likely name + email from the local machine.
 * Order of preference: git config (most explicit) → macOS RealName → $USER.
 */
function detectPrincipal(): DetectionResult["principal"] {
  const username = process.env.USER || process.env.LOGNAME || "user";

  const gitName = tryExec("git config --global user.name");
  const gitEmail = tryExec("git config --global user.email");

  let realName: string | null = null;
  if (process.platform === "darwin") {
    // dscl returns "RealName:\n First Last" — strip header + leading space
    const dscl = tryExec(`dscl . -read /Users/${username} RealName 2>/dev/null`);
    if (dscl) {
      const m = dscl.match(/RealName:\s*\n?\s*(.+)/);
      if (m) realName = m[1].trim();
    }
    if (!realName) realName = tryExec("id -F 2>/dev/null");
  }

  // Reject obvious placeholders that show up on fresh installs
  const looksReal = (s: string | null | undefined): s is string =>
    !!s && s !== username && s !== "Apple" && s.length > 1;

  const name = looksReal(gitName) ? gitName : looksReal(realName) ? realName : undefined;

  return {
    name,
    email: gitEmail || undefined,
    username,
  };
}

/**
 * macOS-only: read the system speech default voice. Skipped on Linux.
 */
function detectVoice(): DetectionResult["voice"] {
  if (process.platform !== "darwin") return undefined;
  const v = tryExec("defaults read com.apple.speech.synthesis.general.prefs SelectedVoiceName 2>/dev/null");
  if (!v) return undefined;
  return { systemDefault: v };
}

export interface DetectSystemInput {
  env?: Record<string, string | undefined>;
  homeDir?: string;
}

/**
 * Run full system detection. Safe, read-only, non-destructive.
 */
export function detectSystem(input: DetectSystemInput = {}): DetectionResult {
  const env = input.env ?? process.env;
  const home = input.homeDir ?? homedir();
  const adapter = resolveInstallerAdapterPaths({ env, homeDir: home });
  const paiDir = adapter.paiDir;
  const configDir = env.PAI_CONFIG_DIR || paiDir;

  return {
    os: detectOS(),
    shell: detectShell(),
    tools: {
      bun: detectTool("bun", "bun --version", env),
      git: detectTool("git", "git --version", env),
      claude: adapter.harness === "claude"
        ? detectTool("claude", "claude --version 2>&1", env)
        : { installed: false },
      codex: adapter.harness === "codex"
        ? detectTool("codex", "codex --version 2>&1", env)
        : { installed: false },
      node: detectTool("node", "node --version", env),
      brew: {
        installed: tryExec("command -v brew", env) !== null,
        path: tryExec("command -v brew", env) || undefined,
      },
    },
    adapter,
    existing: detectExisting(home, adapter, configDir),
    principal: detectPrincipal(),
    voice: detectVoice(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    homeDir: home,
    paiDir,
    configDir,
  };
}

/**
 * Validate an ElevenLabs API key.
 * Uses /v1/voices endpoint (requires only xi-api-key header, no specific scope)
 * instead of /v1/user (requires user_read permission, which many keys lack).
 * Also handles 401 with missing_permissions as "valid key, limited scope" —
 * TTS works fine with a known voice_id even without voices_read permission.
 */
export async function validateElevenLabsKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) return { valid: true };

    // 401 with missing_permissions means the key IS valid but lacks a specific scope.
    // TTS still works (doesn't need voices_read to use a known voice_id).
    if (res.status === 401) {
      try {
        const body = await res.json();
        if (body?.detail?.status === "missing_permissions") {
          return { valid: true };
        }
      } catch { /* fall through to error */ }
    }

    return { valid: false, error: `HTTP ${res.status}` };
  } catch (e: any) {
    return { valid: false, error: e.message || "Network error" };
  }
}
