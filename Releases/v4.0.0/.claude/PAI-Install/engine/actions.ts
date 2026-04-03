/**
 * PAI Installer v4.0 — Install Actions
 * Pure action functions called by both CLI and web frontends.
 * Each action takes state + event emitter, performs work, returns result.
 */

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, symlinkSync, unlinkSync, chmodSync, lstatSync } from "fs";
import { homedir } from "os";
import { join, basename } from "path";
import type { InstallState, EngineEventHandler, DetectionResult } from "./types";
import { detectSystem, validateElevenLabsKey } from "./detect";
import { generateSettingsJson } from "./config-gen";

/**
 * Search existing .claude directories and config locations for a given env key.
 * Returns the value if found, or empty string.
 */
function findExistingEnvKey(keyName: string): string {
  const home = homedir();
  const searchPaths: string[] = [];

  // Check ~/.config/PAI/.env
  searchPaths.push(join(home, ".config", "PAI", ".env"));

  // Check ~/.claude/.env
  searchPaths.push(join(home, ".claude", ".env"));

  // Check any .claude* directories in home (old versions, backups)
  try {
    const homeEntries = readdirSync(home);
    for (const entry of homeEntries) {
      if (entry.startsWith(".claude") && entry !== ".claude") {
        searchPaths.push(join(home, entry, ".env"));
        searchPaths.push(join(home, entry, ".config", "PAI", ".env"));
      }
    }
  } catch {
    // Ignore permission errors
  }

  for (const envPath of searchPaths) {
    try {
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, "utf-8");
        const match = content.match(new RegExp(`^${keyName}=(.+)$`, "m"));
        if (match && match[1].trim()) {
          return match[1].trim();
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  // Also check current environment
  return process.env[keyName] || "";
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

// ─── Step 1: System Detection ────────────────────────────────────

export async function runSystemDetect(
  state: InstallState,
  emit: EngineEventHandler
): Promise<DetectionResult> {
  await emit({ event: "step_start", step: "system-detect" });
  await emit({ event: "progress", step: "system-detect", percent: 10, detail: "Detecting operating system..." });

  const detection = detectSystem();
  state.detection = detection;

  await emit({ event: "progress", step: "system-detect", percent: 50, detail: "Checking installed tools..." });

  // Determine install type
  if (detection.existing.paiInstalled) {
    state.installType = "upgrade";
    await emit({
      event: "message",
      content: `Existing PAI installation detected (v${detection.existing.paiVersion || "unknown"}). This will upgrade your installation.`,
    });
  } else {
    state.installType = "fresh";
    await emit({ event: "message", content: "No existing PAI installation found. Starting fresh install." });
  }

  // Pre-fill collected data from existing installation
  // Skip values that are unresolved template placeholders like {PRINCIPAL.NAME}
  const isPlaceholder = (v: string) => /^\{.+\}$/.test(v);

  if (detection.existing.paiInstalled && detection.existing.settingsPath) {
    try {
      const settings = JSON.parse(readFileSync(detection.existing.settingsPath, "utf-8"));
      if (settings.principal?.name && !isPlaceholder(settings.principal.name)) state.collected.principalName = settings.principal.name;
      if (settings.principal?.timezone && !isPlaceholder(settings.principal.timezone)) state.collected.timezone = settings.principal.timezone;
      if (settings.daidentity?.name && !isPlaceholder(settings.daidentity.name)) state.collected.aiName = settings.daidentity.name;
      if (settings.daidentity?.startupCatchphrase && !isPlaceholder(settings.daidentity.startupCatchphrase)) state.collected.catchphrase = settings.daidentity.startupCatchphrase;
      if (settings.env?.PROJECTS_DIR && !isPlaceholder(settings.env.PROJECTS_DIR)) state.collected.projectsDir = settings.env.PROJECTS_DIR;
    } catch {
      // Ignore parse errors
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

  // Bun should already be installed by bootstrap script, but verify
  if (!det.tools.bun.installed) {
    await emit({ event: "progress", step: "prerequisites", percent: 40, detail: "Installing Bun..." });
    const result = tryExec("curl -fsSL https://bun.sh/install | bash", 60000);
    if (result !== null) {
      // Update PATH
      const bunBin = join(homedir(), ".bun", "bin");
      process.env.PATH = `${bunBin}:${process.env.PATH}`;
      await emit({ event: "message", content: "Bun installed successfully." });
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
  _getInput: (id: string, prompt: string, type: "text" | "password" | "key", placeholder?: string) => Promise<string>,
  _getChoice: (id: string, prompt: string, choices: { label: string; value: string }[]) => Promise<string>
): Promise<void> {
  // ElevenLabs key collection is now handled in the Voice Setup step
  // This step auto-completes to keep the step numbering consistent
  await emit({ event: "step_start", step: "api-keys" });
  await emit({ event: "message", content: "API keys will be collected during Voice Setup." });
  await emit({ event: "step_complete", step: "api-keys" });
}

// ─── Step 4: Identity ────────────────────────────────────────────

export async function runIdentity(
  state: InstallState,
  emit: EngineEventHandler,
  getInput: (id: string, prompt: string, type: "text" | "password" | "key", placeholder?: string) => Promise<string>
): Promise<void> {
  await emit({ event: "step_start", step: "identity" });

  // Name
  const defaultName = state.collected.principalName || "";
  const namePrompt = defaultName
    ? `What is your name? (Press Enter to keep: ${defaultName})`
    : "What is your name?";
  const name = await getInput(
    "principal-name",
    namePrompt,
    "text",
    "Your name"
  );
  state.collected.principalName = name.trim() || defaultName || "User";

  // Timezone
  const detectedTz = state.detection?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tz = await getInput(
    "timezone",
    `Detected timezone: ${detectedTz}. Press Enter to confirm or type a different one.`,
    "text",
    detectedTz
  );
  state.collected.timezone = tz.trim() || detectedTz;

  // AI Name
  const defaultAi = state.collected.aiName || "";
  const aiPrompt = defaultAi
    ? `What would you like to name your AI assistant? (Press Enter to keep: ${defaultAi})`
    : "What would you like to name your AI assistant?";
  const aiName = await getInput(
    "ai-name",
    aiPrompt,
    "text",
    "e.g., Atlas, Nova, Sage"
  );
  state.collected.aiName = aiName.trim() || defaultAi || "PAI";

  // Catchphrase
  const defaultCatch = state.collected.catchphrase || `${state.collected.aiName} here, ready to go`;
  const catchphrase = await getInput(
    "catchphrase",
    `Startup catchphrase for ${state.collected.aiName}?`,
    "text",
    defaultCatch
  );
  state.collected.catchphrase = catchphrase.trim() || defaultCatch;

  // Projects directory (optional)
  const defaultProjects = state.collected.projectsDir || "";
  const projDir = await getInput(
    "projects-dir",
    "Projects directory (optional, press Enter to skip):",
    "text",
    defaultProjects || "~/Projects"
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

export async function runRepository(
  state: InstallState,
  emit: EngineEventHandler
): Promise<void> {
  await emit({ event: "step_start", step: "repository" });
  const paiDir = state.detection?.paiDir || join(homedir(), ".claude");

  if (state.installType === "upgrade") {
    await emit({ event: "progress", step: "repository", percent: 20, detail: "Existing installation found, updating..." });

    // Check if it's a git repo
    const isGitRepo = existsSync(join(paiDir, ".git"));
    if (isGitRepo) {
      const pullResult = tryExec(`cd "${paiDir}" && git pull origin main 2>&1`, 60000);
      if (pullResult !== null) {
        await emit({ event: "message", content: "PAI repository updated from GitHub." });
      } else {
        await emit({ event: "message", content: "Could not pull updates. Continuing with existing files." });
      }
    } else {
      await emit({ event: "message", content: "Existing installation is not a git repo. Preserving current files." });
    }
  } else {
    // Fresh install — clone repo
    await emit({ event: "progress", step: "repository", percent: 20, detail: "Cloning PAI repository..." });

    if (!existsSync(paiDir)) {
      mkdirSync(paiDir, { recursive: true });
    }

    const cloneResult = tryExec(
      `git clone https://github.com/danielmiessler/PAI.git "${paiDir}" 2>&1`,
      120000
    );

    if (cloneResult !== null) {
      await emit({ event: "message", content: "PAI repository cloned successfully." });
    } else {
      // If clone fails (dir not empty), try to init and pull
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

  await emit({ event: "progress", step: "repository", percent: 100, detail: "Repository ready" });
  await emit({ event: "step_complete", step: "repository" });
}

// ─── Step 6: Configuration ───────────────────────────────────────

export async function runConfiguration(
  state: InstallState,
  emit: EngineEventHandler
): Promise<void> {
  await emit({ event: "step_start", step: "configuration" });
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

  // Update Algorithm LATEST version file (public repo may be behind)
  const latestPath = join(paiDir, "skills", "PAI", "Components", "Algorithm", "LATEST");
  const latestDir = join(paiDir, "skills", "PAI", "Components", "Algorithm");
  if (existsSync(latestDir)) {
    try { writeFileSync(latestPath, "v3.5.0\n"); } catch {}
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

  // Set up zsh alias
  await emit({ event: "progress", step: "configuration", percent: 80, detail: "Setting up shell alias..." });

  const zshrcPath = join(homedir(), ".zshrc");
  const aliasLine = `alias pai='bun ${join(paiDir, "skills", "PAI", "Tools", "pai.ts")}'`;
  const marker = "# PAI alias";

  if (existsSync(zshrcPath)) {
    let content = readFileSync(zshrcPath, "utf-8");
    // Remove any existing pai alias (old CORE or PAI paths, any marker variant)
    content = content.replace(/^#\s*(?:PAI|CORE)\s*alias.*\n.*alias pai=.*\n?/gm, "");
    content = content.replace(/^alias pai=.*\n?/gm, "");
    // Add fresh alias
    content = content.trimEnd() + `\n\n${marker}\n${aliasLine}\n`;
    writeFileSync(zshrcPath, content);
  } else {
    writeFileSync(zshrcPath, `${marker}\n${aliasLine}\n`);
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

async function isVoiceServerRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:8888/health", { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function stopVoiceServer(emit: EngineEventHandler): Promise<void> {
  if (!(await isVoiceServerRunning())) return;

  await emit({ event: "progress", step: "voice", percent: 15, detail: "Stopping existing voice server..." });

  // Try graceful shutdown via the server's own endpoint
  try {
    await fetch("http://localhost:8888/shutdown", { method: "POST", signal: AbortSignal.timeout(3000) });
  } catch {
    // No shutdown endpoint — kill by port
  }

  // Kill the process LISTENING on port 8888 (not clients connected to it — that would kill us!)
  tryExec(`lsof -ti:8888 -sTCP:LISTEN | xargs kill -9 2>/dev/null`, 5000);

  // Unload existing LaunchAgent if present
  const plistPath = join(homedir(), "Library", "LaunchAgents", "com.pai.voice-server.plist");
  if (existsSync(plistPath)) {
    tryExec(`launchctl unload "${plistPath}" 2>/dev/null`, 5000);
  }

  // Wait for it to actually stop
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (!(await isVoiceServerRunning())) {
      await emit({ event: "message", content: "Existing voice server stopped." });
      return;
    }
  }
}

async function startVoiceServer(paiDir: string, emit: EngineEventHandler): Promise<boolean> {
  const voiceServerDir = join(paiDir, "VoiceServer");
  const stopScript = join(voiceServerDir, "stop.sh");
  const installScript = join(voiceServerDir, "install.sh");
  const startScript = join(voiceServerDir, "start.sh");
  const serverTs = join(voiceServerDir, "server.ts");

  // Check if VoiceServer directory exists
  if (!existsSync(voiceServerDir)) {
    await emit({ event: "message", content: "Voice server not found in installation." });
    return false;
  }

  // Step 1: Stop any existing voice server (old or new)
  await stopVoiceServer(emit);

  // Step 2: Install as LaunchAgent (auto-start on login)
  // CRITICAL: Use async spawn instead of execSync to avoid blocking the event loop.
  // execSync blocks ALL WebSocket connections for the duration of the script.
  await emit({ event: "progress", step: "voice", percent: 20, detail: "Installing voice server service..." });
  if (existsSync(installScript)) {
    try {
      const installOk = await new Promise<boolean>((resolve) => {
        const child = spawn("bash", [installScript], {
          cwd: voiceServerDir,
          stdio: ["pipe", "pipe", "pipe"],
        });
        // Pipe "y\nn" — yes to reinstall, no to menu bar
        child.stdin?.write("y\nn\n");
        child.stdin?.end();
        const timer = setTimeout(() => { child.kill(); resolve(false); }, 30000);
        child.on("close", (code) => { clearTimeout(timer); resolve(code === 0); });
        child.on("error", () => { clearTimeout(timer); resolve(false); });
      });
      if (installOk) {
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (await isVoiceServerRunning()) {
            await emit({ event: "message", content: "Voice server installed and running." });
            return true;
          }
        }
      }
    } catch {
      // Fall through to next step
    }
  }

  // Step 3: Fallback — try start.sh if LaunchAgent install failed
  if (existsSync(startScript)) {
    await emit({ event: "progress", step: "voice", percent: 25, detail: "Starting voice server..." });
    try {
      await new Promise<void>((resolve) => {
        const child = spawn("bash", [startScript], {
          cwd: voiceServerDir,
          stdio: "ignore",
        });
        const timer = setTimeout(() => { child.kill(); resolve(); }, 15000);
        child.on("close", () => { clearTimeout(timer); resolve(); });
        child.on("error", () => { clearTimeout(timer); resolve(); });
      });
    } catch {
      // Fall through
    }
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await isVoiceServerRunning()) {
        await emit({ event: "message", content: "Voice server started." });
        return true;
      }
    }
  }

  // Step 4: Last resort — start server.ts directly in background
  if (existsSync(serverTs)) {
    await emit({ event: "progress", step: "voice", percent: 30, detail: "Starting voice server directly..." });
    try {
      const child = spawn("bun", ["run", serverTs], {
        cwd: voiceServerDir,
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (await isVoiceServerRunning()) {
          await emit({ event: "message", content: "Voice server started directly." });
          return true;
        }
      }
    } catch {
      // Fall through
    }
  }

  await emit({ event: "message", content: "Could not start voice server. Voice will be configured but TTS test skipped." });
  return false;
}

// ─── Step 7: Voice Setup ─────────────────────────────────────────

export async function runVoiceSetup(
  state: InstallState,
  emit: EngineEventHandler,
  getChoice: (id: string, prompt: string, choices: { label: string; value: string; description?: string }[]) => Promise<string>,
  getInput: (id: string, prompt: string, type: "text" | "password" | "key", placeholder?: string) => Promise<string>
): Promise<void> {
  await emit({ event: "step_start", step: "voice" });

  // ── Collect ElevenLabs key if not already found ──
  if (!state.collected.elevenLabsKey) {
    await emit({ event: "progress", step: "voice", percent: 5, detail: "Searching for existing ElevenLabs key..." });
    let elevenLabsKey = findExistingEnvKey("ELEVENLABS_API_KEY");

    if (elevenLabsKey) {
      await emit({ event: "message", content: "Found existing ElevenLabs API key. Validating..." });
      const result = await validateElevenLabsKey(elevenLabsKey);
      if (result.valid) {
        state.collected.elevenLabsKey = elevenLabsKey;
        await emit({ event: "message", content: "Existing ElevenLabs API key is valid." });
      } else {
        await emit({ event: "message", content: `Existing key invalid: ${result.error}.` });
        elevenLabsKey = "";
      }
    }

    if (!elevenLabsKey) {
      const wantsVoice = await getChoice("voice-enable", "Voice requires an ElevenLabs API key. Get one free at elevenlabs.io", [
        { label: "I have a key", value: "yes" },
        { label: "Skip voice for now", value: "skip" },
      ]);

      if (wantsVoice === "yes") {
        const key = await getInput(
          "elevenlabs-key",
          "Enter your ElevenLabs API key:",
          "key",
          "sk_..."
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
    await emit({ event: "message", content: "No ElevenLabs key — voice server will use macOS text-to-speech as fallback. You can add a key later in ~/.config/PAI/.env" });
  }

  // ── Start voice server (works with or without ElevenLabs key) ──
  const paiDir = state.detection?.paiDir || join(homedir(), ".claude");
  await emit({ event: "progress", step: "voice", percent: 25, detail: "Starting voice server..." });
  const voiceServerReady = await startVoiceServer(paiDir, emit);

  // ── Digital Assistant Voice selection ──
  await emit({ event: "progress", step: "voice", percent: 40, detail: "Checking for existing voice configuration..." });

  const voiceIds: Record<string, string> = {
    male: "pNInz6obpgDQGcFmaJgB",
    female: "21m00Tcm4TlvDq8ikWAM",
  };

  let selectedVoiceId: string;

  // Check for existing voice config from previous installations
  const existingVoice = findExistingVoiceConfig();

  if (existingVoice) {
    const sourceLabel = existingVoice.aiName
      ? `${existingVoice.aiName}'s voice (${existingVoice.voiceId.substring(0, 8)}...)`
      : `Voice ID ${existingVoice.voiceId.substring(0, 8)}...`;
    await emit({ event: "message", content: `Found existing voice configuration from ~/${existingVoice.source}` });

    const useExisting = await getChoice("voice-existing", `Your DA was using: ${sourceLabel}. Use the same voice?`, [
      { label: "Yes, keep this voice", value: "keep", description: `Voice ID: ${existingVoice.voiceId}` },
      { label: "No, pick a new voice", value: "new", description: "Choose from presets or enter a custom ID" },
    ]);

    if (useExisting === "keep") {
      selectedVoiceId = existingVoice.voiceId;
      state.collected.voiceType = "custom";
      state.collected.customVoiceId = selectedVoiceId;
    } else {
      // Fall through to voice selection below
      selectedVoiceId = "";
    }
  } else {
    selectedVoiceId = "";
  }

  // Voice selection (if not using existing)
  if (!selectedVoiceId) {
    await emit({ event: "progress", step: "voice", percent: 45, detail: "Choose your Digital Assistant's voice..." });

    const voiceType = await getChoice("voice-type", "Digital Assistant Voice — Choose a voice for your AI assistant:", [
      { label: "Female (Rachel)", value: "female", description: "Warm, articulate female voice" },
      { label: "Male (Adam)", value: "male", description: "Clear, confident male voice" },
      { label: "Custom Voice ID", value: "custom", description: "Enter your own ElevenLabs voice ID" },
    ]);

    if (voiceType === "custom") {
      const customId = await getInput(
        "custom-voice-id",
        "Enter your ElevenLabs Voice ID:\nFind it at: elevenlabs.io/app/voice-library → Your voice → Voice ID",
        "text",
        "e.g., s3TPKV1kjDlVtZbl4Ksh"
      );
      selectedVoiceId = customId.trim() || voiceIds.female;
      state.collected.voiceType = "custom";
      state.collected.customVoiceId = selectedVoiceId;
    } else {
      selectedVoiceId = voiceIds[voiceType] || voiceIds.female;
      state.collected.voiceType = voiceType as any;
    }
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
        const testRes = await fetch("http://localhost:8888/notify", {
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
          ]);

          if (confirm === "yes") {
            voiceConfirmed = true;
          } else if (confirm === "skip") {
            voiceConfirmed = true;
          } else {
            // Let them pick again
            const newVoice = await getChoice("voice-type-retry", "Choose a different voice:", [
              { label: "Female (Rachel)", value: "female", description: "Warm, articulate female voice" },
              { label: "Male (Adam)", value: "male", description: "Clear, confident male voice" },
              { label: "Custom Voice ID", value: "custom", description: "Enter your own ElevenLabs voice ID" },
            ]);
            if (newVoice === "custom") {
              const newId = await getInput("custom-voice-id-retry", "Enter your ElevenLabs Voice ID:", "text", "e.g., s3TPKV1kjDlVtZbl4Ksh");
              selectedVoiceId = newId.trim() || selectedVoiceId;
              state.collected.voiceType = "custom";
              state.collected.customVoiceId = selectedVoiceId;
            } else {
              selectedVoiceId = voiceIds[newVoice] || voiceIds.female;
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
  await emit({ event: "step_complete", step: "voice" });
}
