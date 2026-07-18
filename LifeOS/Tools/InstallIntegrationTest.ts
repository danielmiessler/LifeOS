#!/usr/bin/env bun
/**
 * InstallIntegrationTest — end-to-end proof of the custom-LifeOS-home install
 * (LIFEOS_HOME), plus a default-install regression check. Everything runs
 * against a THROWAWAY fake $HOME under mktemp — the real home is never touched,
 * which doubles as the isolation proof.
 *
 * Scenarios:
 *   A. Custom home: full tool chain (DetectEnv → InstallSettings → DeployCore →
 *      InstallHooks → CLAUDE.md overlay → ScaffoldUser → LinkUser →
 *      ActivateImports → DeployComponents statusline) into
 *      `<fakeHome>/lifeos-home`, then asserts: everything landed under the
 *      custom root, the written settings.json (env values, permission globs,
 *      hook commands) contains ZERO `.claude` references, the symlink contract
 *      holds against `<configRoot>/USER-data`, identity imports activated, and
 *      nothing was written to `<fakeHome>/.claude` or `<fakeHome>/.config/LIFEOS`.
 *   B. Self-symlink guard: LIFEOS_CONFIG_DIR pointing at `<configRoot>/LIFEOS`
 *      (the settings.json env value — the ambiguity that used to collapse
 *      dataUserDir onto the live USER dir) must make ScaffoldUser/LinkUser
 *      refuse LOUDLY instead of linking a directory onto itself.
 *   C. Default regression: with NO LIFEOS_HOME the install lands in
 *      `<fakeHome>/.claude` and the settings template ships byte-identical
 *      (`~/.claude` permission globs untouched, `$HOME`-expanded env values).
 *
 * Requires network once for `bun install` (DeployCore's dependency step) unless
 * bun's cache already holds the runtime deps.
 *
 * Usage:
 *   bun InstallIntegrationTest.ts [--keep]
 *   (--keep retains the temp workspace; it is always retained on failure)
 */

import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const toolsDir = import.meta.dir;
const skillRoot = join(toolsDir, "..");

interface Check { scenario: string; name: string; passed: boolean; detail?: string }
const checks: Check[] = [];
function check(scenario: string, name: string, passed: boolean, detail?: string): void {
  checks.push({ scenario, name, passed, detail: passed ? undefined : detail });
}

/** Env for a spawned tool: real PATH etc., fake HOME, LifeOS path vars scrubbed. */
function toolEnv(fakeHome: string, extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  const scrub = new Set(["LIFEOS_HOME", "CLAUDE_CONFIG_DIR", "LIFEOS_CONFIG_DIR", "LIFEOS_DIR", "CLAUDE_PLUGIN_ROOT"]);
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || scrub.has(k)) continue;
    env[k] = v;
  }
  env.HOME = fakeHome;
  Object.assign(env, extra);
  return env;
}

function runTool(tool: string, args: string[], env: Record<string, string>): { code: number; json: Record<string, unknown> | null; raw: string } {
  const proc = Bun.spawnSync(["bun", join(toolsDir, tool), ...args], { env, stdout: "pipe", stderr: "pipe" });
  const out = proc.stdout.toString();
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(out); } catch { /* non-JSON output stays raw */ }
  return { code: proc.exitCode ?? -1, json, raw: out + proc.stderr.toString() };
}

const keep = process.argv.includes("--keep");
const workRoot = mkdtempSync(join(tmpdir(), "lifeos-install-test-"));

// ─── Scenario A: custom home ─────────────────────────────────────────
{
  const S = "A:custom-home";
  const fakeHome = join(workRoot, "home-custom");
  const configRoot = join(fakeHome, "lifeos-home"); // deliberately NO ".claude" in the name → a clean substring assertion below
  const configDir = join(configRoot, "USER-data");
  const env = toolEnv(fakeHome, { LIFEOS_HOME: configRoot });
  const flags = ["--config-root", configRoot]; // belt-and-suspenders on top of LIFEOS_HOME, like the Setup workflow passes

  // DetectEnv resolves the override
  const detect = runTool("DetectEnv.ts", [], env);
  check(S, "DetectEnv reports the custom configRoot", detect.json?.configRoot === configRoot, detect.raw);
  check(S, "DetectEnv reports configDir = <configRoot>/USER-data", detect.json?.configDir === configDir, detect.raw);

  // InstallSettings
  const settingsRun = runTool("InstallSettings.ts", [...flags, "--skill-root", skillRoot, "--apply"], env);
  const settingsPath = join(configRoot, "settings.json");
  check(S, "InstallSettings ok", settingsRun.code === 0 && settingsRun.json?.ok === true, settingsRun.raw);
  check(S, "settings.json written under the custom root", existsSync(settingsPath));

  // DeployCore (skills + runtime + MEMORY scaffold + deps)
  const core = runTool("DeployCore.ts", [...flags, "--skill-root", skillRoot, "--apply"], env);
  check(S, "DeployCore ok", core.code === 0 && core.json?.ok === true, core.raw.slice(0, 2000));
  check(S, "LIFEOS runtime under the custom root", existsSync(join(configRoot, "LIFEOS", "VERSION")) || existsSync(join(configRoot, "LIFEOS")));
  check(S, "skills library under the custom root", existsSync(join(configRoot, "skills")));

  // InstallHooks (merge + script deploy)
  const hooks = runTool("InstallHooks.ts", [...flags, "--skill-root", skillRoot, "--apply"], env);
  check(S, "InstallHooks ok", hooks.code === 0 && hooks.json?.ok === true, hooks.raw);
  check(S, "hook commands retargeted (>0)", typeof hooks.json?.commandsRetargeted === "number" && (hooks.json.commandsRetargeted as number) > 0, hooks.raw);
  check(S, "hook scripts deployed under the custom root", existsSync(join(configRoot, "hooks", "lib", "paths.ts")));

  // The whole settings.json — env values, permission globs, guidance prose, merged
  // hook commands — must now reference ONLY the custom root.
  if (existsSync(settingsPath)) {
    const settingsRaw = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(settingsRaw) as Record<string, any>;
    check(S, "settings.json has ZERO .claude references", !settingsRaw.includes(".claude"),
      `found: ${(settingsRaw.match(/[^"\s]*\.claude[^"\s]*/g) || []).slice(0, 5).join(", ")}`);
    check(S, "env.LIFEOS_DIR points at the custom root", settings.env?.LIFEOS_DIR === join(configRoot, "LIFEOS"), String(settings.env?.LIFEOS_DIR));
    check(S, "env.LIFEOS_CONFIG_DIR points at the user-data home", settings.env?.LIFEOS_CONFIG_DIR === configDir, String(settings.env?.LIFEOS_CONFIG_DIR));
    check(S, "permission globs carry the custom root", JSON.stringify(settings.permissions?.allow ?? []).includes(`Write(${configRoot}/**)`), "no retargeted Write glob found");
    const hookCmds = JSON.stringify(settings.hooks ?? {});
    check(S, "merged hook commands carry the custom root", hookCmds.includes(join(configRoot, "hooks")), hookCmds.slice(0, 500));
  }

  // CLAUDE.md overlay (Setup step 4 does this by hand) + ScaffoldUser + LinkUser + ActivateImports
  cpSync(join(skillRoot, "install", "CLAUDE.template.md"), join(configRoot, "CLAUDE.md"));
  const scaffold = runTool("ScaffoldUser.ts", [...flags, "--config-dir", configDir, "--skill-root", skillRoot, "--apply"], env);
  check(S, "ScaffoldUser ok", scaffold.code === 0 && scaffold.json?.ok === true, scaffold.raw);
  check(S, "USER tree scaffolded into <configRoot>/USER-data", existsSync(join(configDir, "USER", "PROJECTS.md")));

  const link = runTool("LinkUser.ts", [...flags, "--config-dir", configDir, "--apply"], env);
  check(S, "LinkUser ok + contract passed", link.code === 0 && (link.json?.contract as any)?.passed === true, link.raw);
  const liveUser = join(configRoot, "LIFEOS", "USER");
  check(S, "LIFEOS/USER symlink → <configRoot>/USER-data/USER",
    existsSync(liveUser) && lstatSync(liveUser).isSymbolicLink() && readlinkSync(liveUser) === join(configDir, "USER"),
    existsSync(liveUser) ? String(lstatSync(liveUser).isSymbolicLink() && readlinkSync(liveUser)) : "missing");

  const imports = runTool("ActivateImports.ts", [...flags, "--apply"], env);
  const activated = (imports.json?.activated as string[]) ?? [];
  check(S, "ActivateImports activated identity imports (>0)", imports.code === 0 && activated.length > 0, imports.raw);
  check(S, "every activated import resolves under the custom root",
    activated.every((imp) => existsSync(join(configRoot, imp.replace(/^@/, "")))), activated.join(", "));

  // Statusline enhancement wires against the custom root
  const status = runTool("DeployComponents.ts", [...flags, "--skill-root", skillRoot, "--apply", "--components", "statusline"], env);
  check(S, "DeployComponents statusline ok", status.code === 0 && status.json?.ok === true, status.raw.slice(0, 1500));
  if (existsSync(settingsPath)) {
    const cmd = (JSON.parse(readFileSync(settingsPath, "utf-8")) as any).statusLine?.command ?? "";
    check(S, "statusLine command targets the custom root", cmd.includes("lifeos-home/LIFEOS/LIFEOS_StatusLine.sh"), cmd);
  }

  // Isolation: nothing leaked into the default locations of the (fake) home.
  check(S, "no writes to <home>/.claude", !existsSync(join(fakeHome, ".claude")));
  check(S, "no writes to <home>/.config/LIFEOS", !existsSync(join(fakeHome, ".config", "LIFEOS")));

  // ─── Scenario D: Pulse runtime + launchd wiring is custom-home-aware ──
  // DeployCore (above) shipped LIFEOS/PULSE + LIFEOS/TOOLS/lifeos-root.ts into the
  // custom root. The whole runtime layer must resolve the custom root — not ~/.claude.
  // configRoot here is `<fakeHome>/lifeos-home` (NO ".claude" in the name), so a clean
  // "zero .claude" assertion catches any surviving hardcode, exactly like settings.json.
  const SP = "D:pulse-custom-home";
  const lifeosDir = join(configRoot, "LIFEOS");
  const pulseDir = join(lifeosDir, "PULSE");

  check(SP, "canonical resolver lifeos-root.ts deployed under custom root", existsSync(join(lifeosDir, "TOOLS", "lifeos-root.ts")));
  check(SP, "a PULSE module routes through the resolver (codemod shipped)",
    existsSync(join(pulseDir, "modules", "memory.ts")) && readFileSync(join(pulseDir, "modules", "memory.ts"), "utf-8").includes("lifeos-root"),
    "memory.ts does not import lifeos-root");

  const pulsePlistTpl = join(pulseDir, "com.lifeos.pulse.plist");
  if (existsSync(pulsePlistTpl)) {
    const tpl = readFileSync(pulsePlistTpl, "utf-8");
    check(SP, "pulse plist template is __LIFEOS_DIR__-based (no __HOME__/.claude)",
      tpl.includes("__LIFEOS_DIR__") && !tpl.includes("__HOME__/.claude"), tpl.match(/__HOME__\/\.claude\S*/)?.[0] ?? "");
  }

  // `manage.sh render` performs the real substitution (self-locating its own dir) —
  // no launchctl load, so it is safe in CI.
  const manage = join(pulseDir, "manage.sh");
  check(SP, "manage.sh deployed under custom root", existsSync(manage));
  if (existsSync(manage)) {
    const render = Bun.spawnSync(["bash", manage, "render"], { env, stdout: "pipe", stderr: "pipe" });
    const plist = render.stdout.toString();
    check(SP, "rendered pulse plist has ZERO .claude references", plist.length > 0 && !plist.includes(".claude"),
      (plist.match(/\S*\.claude\S*/g) || []).slice(0, 3).join(", ") || render.stderr.toString().slice(0, 300));
    check(SP, "no unresolved __LIFEOS_DIR__ placeholder", plist.length > 0 && !plist.includes("__LIFEOS_DIR__"), plist.slice(0, 200));
    check(SP, "WorkingDirectory targets <configRoot>/LIFEOS/PULSE", plist.includes(`<string>${pulseDir}</string>`), plist.slice(0, 500));
    check(SP, "LIFEOS_DIR env set to <configRoot>/LIFEOS", plist.includes(`<string>${lifeosDir}</string>`), plist.slice(0, 500));
  }

  // ─── Scenario B: self-symlink guard ────────────────────────────────
  const SG = "B:self-symlink-guard";
  // Simulate the installer re-run inside a live session: LIFEOS_CONFIG_DIR
  // carries the settings.json env value `<configRoot>/LIFEOS` (NO --config-dir
  // flag and NO LIFEOS_HOME, so the ambient var is what the tools fall back to).
  const poisoned = toolEnv(fakeHome, { LIFEOS_CONFIG_DIR: join(configRoot, "LIFEOS") });
  const guardLink = runTool("LinkUser.ts", ["--config-root", configRoot, "--apply"], poisoned);
  check(SG, "LinkUser refuses the self-symlink", guardLink.code !== 0 && guardLink.json?.refused === "user-data-separation", guardLink.raw);
  const guardScaffold = runTool("ScaffoldUser.ts", ["--config-root", configRoot, "--skill-root", skillRoot, "--apply"], poisoned);
  check(SG, "ScaffoldUser refuses the self-symlink", guardScaffold.code !== 0 && guardScaffold.json?.refused === "user-data-separation", guardScaffold.raw);
  check(SG, "live USER symlink survived the refused runs",
    lstatSync(liveUser).isSymbolicLink() && readlinkSync(liveUser) === join(configDir, "USER"));
}

// ─── Scenario C: default-install regression (no LIFEOS_HOME) ─────────
{
  const S = "C:default-regression";
  const fakeHome = join(workRoot, "home-default");
  const env = toolEnv(fakeHome);
  const defaultRoot = join(fakeHome, ".claude");

  const detect = runTool("DetectEnv.ts", [], env);
  check(S, "DetectEnv falls back to ~/.claude", detect.json?.configRoot === defaultRoot, detect.raw);
  check(S, "DetectEnv configDir falls back to ~/.config/LIFEOS", detect.json?.configDir === join(fakeHome, ".config", "LIFEOS"), detect.raw);

  const settingsRun = runTool("InstallSettings.ts", ["--skill-root", skillRoot, "--apply"], env);
  const settingsPath = join(defaultRoot, "settings.json");
  check(S, "InstallSettings ok into ~/.claude", settingsRun.code === 0 && existsSync(settingsPath), settingsRun.raw);
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Record<string, any>;
    check(S, "env.LIFEOS_DIR is the expanded default", settings.env?.LIFEOS_DIR === join(defaultRoot, "LIFEOS"), String(settings.env?.LIFEOS_DIR));
    check(S, "template ~/.claude permission globs untouched", JSON.stringify(settings.permissions?.allow ?? []).includes("Write(~/.claude/**)"), "default globs were rewritten — regression!");
    check(S, "no retarget was reported", settingsRun.json?.retargetedStrings === undefined, JSON.stringify(settingsRun.json));
  }

  const hooks = runTool("InstallHooks.ts", ["--skill-root", skillRoot, "--apply"], env);
  check(S, "InstallHooks ok into ~/.claude", hooks.code === 0 && hooks.json?.ok === true, hooks.raw);
  if (existsSync(settingsPath)) {
    const hookCmds = JSON.stringify((JSON.parse(readFileSync(settingsPath, "utf-8")) as any).hooks ?? {});
    check(S, "default hook commands still use $HOME/.claude", hookCmds.includes("$HOME/.claude/hooks/"), hookCmds.slice(0, 300));
  }
}

// ─── Report ──────────────────────────────────────────────────────────
const failed = checks.filter((c) => !c.passed);
const ok = failed.length === 0;
const retain = keep || !ok;
if (!retain) rmSync(workRoot, { recursive: true, force: true });

console.log(JSON.stringify({
  ok,
  passed: checks.length - failed.length,
  failed: failed.length,
  checks: ok ? checks.map(({ scenario, name }) => `${scenario} ✓ ${name}`) : checks,
  workRoot: retain ? workRoot : undefined,
  note: retain && !ok ? "temp workspace retained for inspection" : undefined,
}, null, 2));
process.exit(ok ? 0 : 1);
