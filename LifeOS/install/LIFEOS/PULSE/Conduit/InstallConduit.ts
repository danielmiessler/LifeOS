#!/usr/bin/env bun
/**
 * Conduit launchd installer. Registers `com.lifeos.conduit` to run `conduit capture`
 * on a fixed interval — the stable pattern (stateless one-shot polls restarted by
 * launchd, no long-lived daemon). Mirrors InstallWorkSweep / InstallDerivedSync.
 *
 *   bun InstallConduit.ts            install + load
 *   bun InstallConduit.ts --uninstall  unload + remove
 *   bun InstallConduit.ts --status     show launchd state
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { loadConfig } from "./config.ts"
import { DATA_ROOT } from "./paths.ts"
import * as systemd from "../../TOOLS/lib/SystemdUser"
import { installVerb } from "../../TOOLS/lib/InstallVerb"
import { agentPath, writeAgent } from "../../TOOLS/lib/LaunchAgent"

const LABEL = "com.lifeos.conduit"
const PLIST = agentPath(LABEL)
const CONDUIT = join(import.meta.dir, "conduit.ts")
const LOG_DIR = join(DATA_ROOT, "logs")
// The bun on PATH, not process.execPath: under Homebrew execPath resolves to the
// version-pinned Cellar path, which the next `brew upgrade bun` deletes and the
// job dies with it. The PATH entry is a symlink that survives upgrades.
// public PR #2208, @pai-scaffolde
const BUN = Bun.which("bun") ?? process.execPath

/** Escape a string for safe interpolation into a plist XML <string> value. */
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** launchd gives jobs only /usr/bin:/bin:/usr/sbin:/sbin; the capture job spawns gh
 *  and other Homebrew tools, so bake the installer's PATH the way InstallConduitInsight
 *  does (SOC-0060 flagged the capture job as PATH-less, 2026-09-15). */
function launchdPath(): string {
  const base = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"]
  const current = (process.env.PATH ?? "").split(":").filter(Boolean)
  return [...new Set([...current, ...base])].join(":")
}

function plistBody(intervalSec: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(BUN)}</string>
    <string>${escapeXml(CONDUIT)}</string>
    <string>capture</string>
  </array>
  <key>StartInterval</key><integer>${intervalSec}</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>Nice</key><integer>10</integer>
  <key>StandardOutPath</key><string>${escapeXml(join(LOG_DIR, "conduit.out.log"))}</string>
  <key>StandardErrorPath</key><string>${escapeXml(join(LOG_DIR, "conduit.err.log"))}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${escapeXml(launchdPath())}</string>
  </dict>
</dict>
</plist>
`
}

function install(): void {
  mkdirSync(LOG_DIR, { recursive: true })
  const intervalSec = loadConfig().pollIntervalSec
  writeAgent(LABEL, plistBody(intervalSec))
  try {
    execFileSync("launchctl", ["unload", PLIST], { stdio: "ignore" })
  } catch {
    /* not loaded yet */
  }
  execFileSync("launchctl", ["load", PLIST], { stdio: "inherit" })
  console.log(`Installed ${LABEL} → polls every ${intervalSec}s`)
  console.log(`  plist: ${PLIST}`)
  console.log(`  logs:  ${LOG_DIR}`)
}

function uninstall(): void {
  try {
    execFileSync("launchctl", ["unload", PLIST], { stdio: "ignore" })
  } catch {
    /* ignore */
  }
  if (existsSync(PLIST)) rmSync(PLIST)
  console.log(`Uninstalled ${LABEL}`)
}

function status(): void {
  try {
    const out = execFileSync("launchctl", ["list"], { encoding: "utf8" })
    const line = out.split("\n").find((l) => l.includes(LABEL))
    console.log(line ? `loaded: ${line.trim()}` : `${LABEL} not loaded`)
  } catch {
    console.log("launchctl unavailable")
  }
}

/* ── systemd --user backend (Linux only) ────────────────────────────────────
 * Strictly additive: every line above is the launchd path and is unchanged.
 * launchd keeps owning the job on darwin and systemd owns it on linux, so no
 * install ever has two schedulers for one job.
 * Translation rules live in ../../TOOLS/lib/SystemdUser.ts.
 * ported from public PR #1698, @elhoim
 * ------------------------------------------------------------------------- */

async function linuxSpec(): Promise<systemd.UnitSpec> {
  return {
    label: LABEL,
    description: "LifeOS Conduit capture",
    // BUN is already absolute (resolved at the top) — no `which` lookup needed.
    exec: [BUN, CONDUIT, "capture"],
    logPath: join(LOG_DIR, "conduit.out.log"),
    errLogPath: join(LOG_DIR, "conduit.err.log"),
    // Reads the same config key the plist does, so one setting drives both.
    schedule: { kind: "interval", seconds: loadConfig().pollIntervalSec },
  }
}

async function linuxMain(a: string | undefined): Promise<void> {
  const spec = await linuxSpec()
  const log = (m: string) => console.log(`[InstallConduit] ${m}`)
  if (a === "--uninstall") { await systemd.uninstall(spec, log); return }
  if (a === "--status") { if (!(await systemd.status(spec, log))) process.exit(1); return }
  if (!(await systemd.install(spec, log))) process.exit(1)
}

const arg = installVerb(process.argv, "InstallConduit")
if (systemd.hasUserScheduler()) await linuxMain(arg)
else if (arg === "--uninstall") uninstall()
else if (arg === "--status") status()
else install()
