/**
 * PAI Installer v5.0 — Validation
 * Verifies installation completeness after all steps run.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import type { InstallState, ValidationCheck, InstallSummary, EngineEventHandler } from "./types";
import { PAI_VERSION } from "./types";
import { homedir } from "os";
import { getClaudeDir, getPaiDir } from "../../lib/paths";

/**
 * Check if Pulse is running. PAI 5.0 absorbed the standalone voice server
 * into Pulse on port 31337 — Pulse serves /notify for voice + the Life
 * Dashboard + observability. Probe /notify with an empty silent payload.
 * Any 2xx-4xx response means Pulse is up and the route is registered.
 */
async function checkPulseHealth(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:31337/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "", voice_enabled: false }),
      signal: AbortSignal.timeout(2000),
    });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Run the SecurityPipeline.hook.ts as Claude Code would, with a benign Bash
 * payload. The hook MUST exit 0 (allow) and MUST NOT print "patterns file
 * missing — fail-closed". A failure here means PATTERNS.yaml is unreachable
 * to the hook at runtime even if the file appears to exist on disk — the
 * exact bug that left fresh installs unable to run any Bash command.
 *
 * Returns { passed, detail }. `passed=false` is CRITICAL: every Bash call
 * the user makes will be denied until this is fixed.
 */
function checkSecurityHookSmoke(claudeDir: string, paiDir: string): { passed: boolean; detail: string } {
  const hookPath = join(claudeDir, "hooks", "SecurityPipeline.hook.ts");
  if (!existsSync(hookPath)) {
    return { passed: false, detail: "Hook not found at hooks/SecurityPipeline.hook.ts" };
  }
  const patternsPath = join(paiDir, "USER", "SECURITY", "PATTERNS.yaml");
  if (!existsSync(patternsPath)) {
    return { passed: false, detail: `PATTERNS.yaml not found at ${patternsPath} — hook will fail-close on every Bash call` };
  }
  // Synthetic benign payload that should ALWAYS be allowed. Mirrors Claude Code's hook input shape.
  const payload = JSON.stringify({
    session_id: "smoke-test",
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "echo pai-smoke-test" },
  });
  try {
    const res = spawnSync(process.execPath, [hookPath], {
      input: payload,
      encoding: "utf-8",
      timeout: 8000,
      // Match Claude Code: no inherited zshrc, minimal env. HOME and PATH only.
      env: { HOME: homedir(), PATH: process.env.PATH || "" },
    });
    const stderr = (res.stderr || "").toString();
    if (res.status !== 0) {
      return { passed: false, detail: `Hook exited ${res.status}: ${stderr.trim().slice(0, 160) || "no stderr"}` };
    }
    if (/patterns file missing|fail-closed/i.test(stderr)) {
      return { passed: false, detail: `Hook printed fail-closed message: ${stderr.trim().slice(0, 160)}` };
    }
    return { passed: true, detail: "echo allowed; PATTERNS.yaml loaded; no fail-closed message" };
  } catch (err: any) {
    return { passed: false, detail: `Hook execution threw: ${err?.message || String(err)}` };
  }
}

/**
 * Run all validation checks against the current state.
 */
export async function runValidation(state: InstallState, emit?: EngineEventHandler): Promise<ValidationCheck[]> {
  if (emit) {
    await emit({ event: "step_start", step: "validation" });
    await emit({
      event: "section_header",
      sectionId: "FINAL-VALIDATION",
      title: "FINAL VALIDATION",
      subtitle: "Verifying the install before handing control back to you",
      stepNumber: 9,
    });
  }

  const claudeDir = state.detection?.claudeConfigDir || getClaudeDir();
  const paiDir = state.detection?.paiDir || getPaiDir();
  const configDir = state.detection?.configDir || join(homedir(), ".config", "PAI");
  const checks: ValidationCheck[] = [];

  // 1. settings.json exists and is valid JSON
  const settingsPath = join(claudeDir, "settings.json");
  const settingsExists = existsSync(settingsPath);
  let settingsValid = false;
  let settings: any = null;

  if (settingsExists) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      settingsValid = true;
    } catch {
      settingsValid = false;
    }
  }

  checks.push({
    name: "settings.json",
    passed: settingsExists && settingsValid,
    detail: settingsValid
      ? "Valid configuration file"
      : settingsExists
        ? "File exists but invalid JSON"
        : "File not found",
    critical: true,
  });

  // 2. Required settings fields
  if (settings) {
    checks.push({
      name: "Principal name",
      passed: !!settings.principal?.name,
      detail: settings.principal?.name ? `Set to: ${settings.principal.name}` : "Not configured",
      critical: true,
    });

    checks.push({
      name: "AI identity",
      passed: !!settings.daidentity?.name,
      detail: settings.daidentity?.name ? `Set to: ${settings.daidentity.name}` : "Not configured",
      critical: true,
    });

    checks.push({
      name: "PAI version",
      passed: !!settings.pai?.version,
      detail: settings.pai?.version ? `v${settings.pai.version}` : "Not set",
      critical: false,
    });

    checks.push({
      name: "Timezone",
      passed: !!settings.principal?.timezone,
      detail: settings.principal?.timezone || "Not configured",
      critical: false,
    });
  }

  // 3. Directory structure (split: claude-home vs PAI-data dirs)
  const claudeRequiredDirs = [
    { path: "skills", name: "Skills directory", critical: true },
    { path: "hooks", name: "Hooks directory", critical: false },
    { path: "Plans", name: "Plans directory", critical: false },
  ];
  const paiRequiredDirs = [
    { path: "MEMORY", name: "Memory directory", critical: true },
    { path: "MEMORY/STATE", name: "State directory", critical: false },
    { path: "MEMORY/WORK", name: "Work directory", critical: false },
  ];

  for (const dir of claudeRequiredDirs) {
    const fullPath = join(claudeDir, dir.path);
    checks.push({
      name: dir.name,
      passed: existsSync(fullPath),
      detail: existsSync(fullPath) ? "Present" : "Missing",
      critical: dir.critical,
    });
  }
  for (const dir of paiRequiredDirs) {
    const fullPath = join(paiDir, dir.path);
    checks.push({
      name: dir.name,
      passed: existsSync(fullPath),
      detail: existsSync(fullPath) ? "Present" : "Missing",
      critical: dir.critical,
    });
  }

  // 4. PAI skill present
  const skillPath = join(claudeDir, "skills", "PAI", "SKILL.md");
  checks.push({
    name: "PAI core skill",
    passed: existsSync(skillPath),
    detail: existsSync(skillPath) ? "Present" : "Not found — clone PAI repo to enable",
    critical: false,
  });

  // 5. ElevenLabs key stored — check all three possible locations
  const envPaths = [
    join(configDir, ".env"),
    join(claudeDir, ".env"),
    join(homedir(), ".env"),
  ];
  let elevenLabsKeyStored = false;
  let elevenLabsKeyLocation = "";
  for (const ep of envPaths) {
    if (existsSync(ep)) {
      try {
        const envContent = readFileSync(ep, "utf-8");
        if (envContent.includes("ELEVENLABS_API_KEY=") &&
            !envContent.includes("ELEVENLABS_API_KEY=\n")) {
          elevenLabsKeyStored = true;
          elevenLabsKeyLocation = ep;
          break;
        }
      } catch {}
    }
  }

  checks.push({
    name: "ElevenLabs API key",
    passed: elevenLabsKeyStored,
    detail: elevenLabsKeyStored ? `Stored in ${elevenLabsKeyLocation}` : state.collected.elevenLabsKey ? "Collected but not saved" : "Not configured",
    critical: false,
  });

  // 6. DA voice configured in settings (nested under voices.main.voiceId)
  const voiceId = settings?.daidentity?.voices?.main?.voiceId;
  const voiceIdConfigured = !!voiceId;

  checks.push({
    name: "DA voice ID",
    passed: voiceIdConfigured,
    detail: voiceIdConfigured ? `Voice ID: ${voiceId.substring(0, 8)}...` : "Not configured",
    critical: false,
  });

  // 7. Pulse running — embeds voice + dashboard + observability (PAI 5.0)
  const pulseHealthy = await checkPulseHealth();

  checks.push({
    name: "Pulse (voice + dashboard)",
    passed: pulseHealthy,
    detail: pulseHealthy
      ? "Running on localhost:31337"
      : "Not reachable — install via: bash ~/.claude/PAI/PULSE/manage.sh install",
    critical: false,
  });

  // 7b. Pulse launchd plist present (auto-start on login)
  const pulsePlist = join(homedir(), "Library", "LaunchAgents", "com.pai.pulse.plist");
  const pulsePlistInstalled = existsSync(pulsePlist);
  checks.push({
    name: "Pulse launchd agent",
    passed: pulsePlistInstalled,
    detail: pulsePlistInstalled
      ? "Installed at ~/Library/LaunchAgents/com.pai.pulse.plist"
      : "Not installed — Pulse will not auto-start on login",
    critical: false,
  });

  // 8. Zsh alias configured
  const zshrcPath = join(homedir(), ".zshrc");
  let aliasConfigured = false;
  if (existsSync(zshrcPath)) {
    try {
      const zshContent = readFileSync(zshrcPath, "utf-8");
      aliasConfigured = zshContent.includes("# PAI alias") && zshContent.includes("alias pai=");
    } catch {}
  }

  checks.push({
    name: "Shell alias (pai)",
    passed: aliasConfigured,
    detail: aliasConfigured ? "Configured in .zshrc" : "Not found — run: source ~/.zshrc",
    critical: true,
  });

  // 9. SecurityPipeline smoke test — runs the actual hook with a benign Bash
  // payload. Catches the v5.0 fail-closed regression where PATTERNS.yaml was
  // missing from the public template, leaving every fresh install unable to
  // execute Bash commands. CRITICAL — if this fails, the install is broken.
  const securitySmoke = checkSecurityHookSmoke(claudeDir, paiDir);
  checks.push({
    name: "SecurityPipeline hook (smoke test)",
    passed: securitySmoke.passed,
    detail: securitySmoke.detail,
    critical: true,
  });

  return checks;
}

/**
 * Generate install summary from state.
 */
export function generateSummary(state: InstallState): InstallSummary {
  return {
    paiVersion: PAI_VERSION,
    principalName: state.collected.principalName || "User",
    aiName: state.collected.aiName || "PAI",
    timezone: state.collected.timezone || "UTC",
    voiceEnabled: state.completedSteps.includes("voice"),
    voiceMode: state.collected.elevenLabsKey ? "elevenlabs" : state.completedSteps.includes("voice") ? "macos-say" : "none",
    catchphrase: state.collected.catchphrase || "",
    installType: state.installType || "fresh",
    completedSteps: state.completedSteps.length,
    totalSteps: 9,
  };
}
