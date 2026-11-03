#!/usr/bin/env bun
/**
 * Conduit INSIGHT launchd installer. Registers `com.lifeos.conduit.insight` to run
 * `BuildInsight.ts` HOURLY — the cheap-inference content-type read. Separate from the
 * 120s capture job (`com.lifeos.conduit`) on purpose: a slow/failed hourly inference
 * never stalls capture, and the two cadences are tuned independently. Mirrors
 * InstallConduit.ts exactly.
 *
 *   bun InstallConduitInsight.ts             install + load (runs hourly)
 *   bun InstallConduitInsight.ts --uninstall unload + remove
 *   bun InstallConduitInsight.ts --status    show launchd state
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { DATA_ROOT } from "./paths.ts"
import * as systemd from "../../TOOLS/lib/SystemdUser"
import { installVerb } from "../../TOOLS/lib/InstallVerb"
import { agentPath, writeAgent } from "../../TOOLS/lib/LaunchAgent"

const LABEL = "com.lifeos.conduit.insight"
const PLIST = agentPath(LABEL)
const BUILD_INSIGHT = join(import.meta.dir, "BuildInsight.ts")
const LOG_DIR = join(DATA_ROOT, "logs")
// The bun on PATH, not the Cellar path execPath resolves to (see InstallConduit.ts).
// public PR #2208, @pai-scaffolde
const BUN = Bun.which("bun") ?? process.execPath
const INTERVAL_SEC = 3600 // hourly

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * launchd gives jobs a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin) that does NOT
 * include where `claude` lives (~/.local/bin) or homebrew — so the inference call
 * would `spawn ENOENT` and fall back forever. Bake the INSTALLER's PATH (which has
 * claude on it) into the plist. Portable: no hardcoded home path in system code — it
 * uses whatever PATH the person running the installer had.
 */
function launchdPath(): string {
  const base = ["/usr/bin", "/bin", "/usr/sbin", "/sbin"]
  const current = (process.env.PATH ?? "").split(":").filter(Boolean)
  return [...new Set([...current, ...base])].join(":")
}

function plistBody(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(BUN)}</string>
    <string>${escapeXml(BUILD_INSIGHT)}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${escapeXml(launchdPath())}</string>
  </dict>
  <key>StartInterval</key><integer>${INTERVAL_SEC}</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>Nice</key><integer>10</integer>
  <key>StandardOutPath</key><string>${escapeXml(join(LOG_DIR, "conduit-insight.out.log"))}</string>
  <key>StandardErrorPath</key><string>${escapeXml(join(LOG_DIR, "conduit-insight.err.log"))}</string>
</dict>
</plist>
`
}

function install(): void {
  mkdirSync(LOG_DIR, { recursive: true })
  writeAgent(LABEL, plistBody())
  try {
    execFileSync("launchctl", ["unload", PLIST], { stdio: "ignore" })
  } catch {
    /* not loaded yet */
  }
  execFileSync("launchctl", ["load", PLIST], { stdio: "inherit" })
  console.log(`Installed ${LABEL} → runs every ${INTERVAL_SEC}s (hourly)`)
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
 * A second backend beside launchd rather than a change to the scheduling
 * launchd owns. Translation rules live in ../../TOOLS/lib/SystemdUser.ts.
 * ported from public PR #1698, @elhoim
 * ------------------------------------------------------------------------- */

async function linuxSpec(): Promise<systemd.UnitSpec> {
  return {
    label: LABEL,
    description: "LifeOS Conduit insight build",
    // BUN is already absolute (resolved at the top) — no `which` lookup needed.
    exec: [BUN, BUILD_INSIGHT],
    logPath: join(LOG_DIR, "conduit-insight.out.log"),
    errLogPath: join(LOG_DIR, "conduit-insight.err.log"),
    // systemd --user gives a job an even barer PATH than launchd does, so the
    // inference call would `spawn ENOENT` for the same reason launchdPath()
    // exists. Same installer-PATH bake, same rationale.
    environment: { PATH: launchdPath() },
    schedule: { kind: "interval", seconds: INTERVAL_SEC },
  }
}

async function linuxMain(a: string | undefined): Promise<void> {
  const spec = await linuxSpec()
  const log = (m: string) => console.log(`[InstallConduitInsight] ${m}`)
  if (a === "--uninstall") { await systemd.uninstall(spec, log); return }
  if (a === "--status") { if (!(await systemd.status(spec, log))) process.exit(1); return }
  if (!(await systemd.install(spec, log))) process.exit(1)
}

const arg = installVerb(process.argv, "InstallConduitInsight")
if (systemd.hasUserScheduler()) await linuxMain(arg)
else if (arg === "--uninstall") uninstall()
else if (arg === "--status") status()
else install()
