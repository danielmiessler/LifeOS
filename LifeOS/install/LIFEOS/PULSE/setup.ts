#!/usr/bin/env bun
/**
 * LifeOS Pulse Worker — Provisioning Script
 *
 * Sets up a new LifeOS Worker from scratch.
 * Reads DA_IDENTITY.md for worker identity.
 * Generates PULSE.toml, .env, and installs launchd service.
 *
 * Usage: bun run setup.ts [--force]
 * Goal: under 30 minutes from bare machine to working worker.
 *
 * Config writes are create-only. Re-running against a configured install
 * leaves PULSE.toml and the launch agent alone; --force replaces them, but
 * announces it first and copies the old file aside with a timestamp.
 */

import { join, resolve } from "path"
import { copyFileSync, existsSync, mkdirSync } from "fs"
import { PULSE_BASE, PULSE_PORT } from "./endpoint"
import { homedir } from "node:os";

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir()
const LIFEOS_DIR = join(HOME, ".claude", "LIFEOS")
const PULSE_DIR = join(LIFEOS_DIR, "PULSE")

// ── Helpers ──

function prompt(question: string): Promise<string> {
  process.stdout.write(`\n  ${question} `)
  return new Promise((resolve) => {
    const buf: Buffer[] = []
    process.stdin.resume()
    process.stdin.once("data", (data) => {
      process.stdin.pause()
      resolve(data.toString().trim())
    })
  })
}

function heading(text: string): void {
  console.log(`\n${"─".repeat(50)}`)
  console.log(`  ${text}`)
  console.log(`${"─".repeat(50)}`)
}

function ok(text: string): void {
  console.log(`  [ok] ${text}`)
}

function warn(text: string): void {
  console.log(`  [!!] ${text}`)
}

// ── Config write guard ──
//
// Provisioning must never destroy an existing install. PULSE.toml is the
// daemon's config of record — modules, ports, notification routing, the DA
// block, every cron job — and most installs are not git repos, so a clobber
// is unrecoverable. Every config write goes through writeConfigPreserving:
// create when absent, leave alone when present, replace only under an
// explicit --force, announced up front and after a timestamped copy-aside.
// This is the same check the .env branch has always done.
// public PR #1642, @elhoim

export type ConfigWriteOutcome = "created" | "preserved" | "overwritten"

export interface ConfigWriteResult {
  outcome: ConfigWriteOutcome
  /** Set only when an existing file was replaced under --force. */
  backupPath?: string
}

/** `<file>.backup-<iso>` — the copy-aside naming the other install tools use. */
export function backupPathFor(path: string, now: Date = new Date()): string {
  return `${path}.backup-${now.toISOString().replace(/[:.]/g, "-")}`
}

export async function writeConfigPreserving(
  path: string,
  contents: string,
  opts: {
    force?: boolean
    /** Called before anything on disk changes, so the user sees it coming. */
    onOverwrite?: (info: { path: string; backupPath: string }) => void
  } = {},
): Promise<ConfigWriteResult> {
  if (!existsSync(path)) {
    await Bun.write(path, contents)
    return { outcome: "created" }
  }

  if (!opts.force) return { outcome: "preserved" }

  const backupPath = backupPathFor(path)
  opts.onOverwrite?.({ path, backupPath })
  copyFileSync(path, backupPath)
  await Bun.write(path, contents)
  return { outcome: "overwritten", backupPath }
}

// ── Step 1: Read Identity ──

async function readIdentity(): Promise<{ name: string; description: string }> {
  heading("Step 1: Worker Identity")

  // DIGITAL_ASSISTANT/ is the real home (public issue #1504, @tzioup — the old
  // flat USER/ path silently missed the identity file and fell back to defaults).
  const identityPath = join(LIFEOS_DIR, "USER", "DIGITAL_ASSISTANT", "DA_IDENTITY.md")
  if (existsSync(identityPath)) {
    const content = await Bun.file(identityPath).text()
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/i) ?? content.match(/^-\s*\*\*Name:\*\*\s*(.+)/mi)
    const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/i)
    const name = nameMatch?.[1]?.trim() ?? ""
    const description = roleMatch?.[1]?.trim() ?? ""

    if (name) {
      ok(`Found identity: ${name}`)
      if (description) ok(`Role: ${description}`)
      return { name: name.toLowerCase(), description }
    }
  }

  const name = await prompt("Worker name (e.g., echo, cipher, atlas):")
  const description = await prompt("Worker description (e.g., research specialist):")
  return { name: name.toLowerCase(), description }
}

// ── Step 2: GitHub App Setup ──

async function setupGitHubApp(workerName: string): Promise<{
  appId: string
  installationId: string
  privateKeyPath: string
  repos: string[]
}> {
  heading("Step 2: GitHub App")

  const ghHomepage = process.env.LIFEOS_GITHUB_HOMEPAGE ?? "https://github.com/YOUR-USERNAME";
  console.log(`
  Create a GitHub App for this worker:
  1. Go to: https://github.com/settings/apps/new
  2. App name: lifeos-worker-${workerName}
  3. Homepage URL: ${ghHomepage}
  4. Uncheck Webhook (Active)
  5. Permissions:
     - Issues: Read & Write
     - Contents: Read & Write
     - Pull requests: Read & Write
     - Metadata: Read-only
  6. Where can this app be installed? → Only on this account
  7. Create GitHub App
  8. Note the App ID
  9. Generate a private key (downloads .pem file)
  10. Install the app on your repos
  `)

  const appId = await prompt("GitHub App ID:")
  const privateKeyPath = await prompt("Path to private key (.pem file):")
  const resolvedKey = resolve(privateKeyPath.replace(/^~/, HOME))

  if (!existsSync(resolvedKey)) {
    warn(`Private key not found at: ${resolvedKey}`)
    warn("You can set this up later in PULSE.toml")
  } else {
    ok(`Private key found: ${resolvedKey}`)
  }

  // Get installation ID
  console.log(`
  Find your installation ID:
  1. Go to: https://github.com/settings/installations
  2. Click "Configure" on lifeos-worker-${workerName}
  3. The URL ends with /installations/XXXXX — that number is the ID
  `)

  const installationId = await prompt("Installation ID:")

  const reposInput = await prompt("Repos to monitor (comma-separated, e.g., your-org/your-repo):")
  const repos = reposInput.split(",").map((r) => r.trim()).filter(Boolean)

  ok(`GitHub App configured: ${appId}`)
  return { appId, installationId, privateKeyPath: resolvedKey, repos }
}

// ── Step 3: Generate Config Files ──

export async function generateConfigs(opts: {
  name: string
  description: string
  appId: string
  installationId: string
  privateKeyPath: string
  repos: string[]
  specialization: string[]
  force?: boolean
}): Promise<void> {
  heading("Step 4: Generating Config Files")

  // PULSE.toml
  const reposToml = opts.repos.map((r) => `"${r}"`).join(", ")
  const specToml = opts.specialization.map((s) => `"${s}"`).join(", ")

  const pulseToml = `# LifeOS Pulse — ${opts.name} Worker Configuration
#
# type = "script" → runs command, $0 cost
# type = "claude" → spawns claude --print, costs tokens
# output = voice | ntfy | email | log
# Sentinels: NO_ACTION, NO_URGENT, NO_EVENTS → suppress dispatch

[worker]
name = "${opts.name}"
github_app_id = "${opts.appId}"
github_app_private_key = "${opts.privateKeyPath}"
github_installation_id = "${opts.installationId}"
repos = [${reposToml}]
specialization = [${specToml}]
max_concurrent = 1

[[job]]
name = "github-work"
schedule = "*/2 * * * *"
type = "script"
command = "bun run checks/github-work.ts"
output = "log"
enabled = true

[[job]]
name = "healthcheck"
schedule = "*/5 * * * *"
type = "script"
command = "bun run checks/health.ts"
output = "log"
enabled = true

[[job]]
name = "morning-report"
schedule = "0 7 * * *"
type = "claude"
prompt = "You are ${opts.name}, a LifeOS Worker (${opts.description}). Summarize your completed work from the last 24 hours. Check recent git log and closed issues. Be concise."
model = "sonnet"
output = "ntfy"
enabled = true
`

  const pulseTomlPath = join(PULSE_DIR, "PULSE.toml")
  const written = await writeConfigPreserving(pulseTomlPath, pulseToml, {
    force: opts.force,
    onOverwrite: ({ backupPath }) =>
      warn(`--force: replacing PULSE.toml — copying the current one to ${backupPath}`),
  })

  if (written.outcome === "created") {
    ok("PULSE.toml written")
  } else if (written.outcome === "overwritten") {
    ok(`PULSE.toml replaced (backup: ${written.backupPath})`)
  } else {
    warn("PULSE.toml already exists — left untouched. Your daemon config is the record.")
    warn("Merge the worker block below by hand, or re-run with --force to replace it (backed up first).")
    console.log(`\n${"─".repeat(50)}\n${pulseToml}${"─".repeat(50)}`)
  }

  // .env
  const envLines = [
    `# LifeOS Worker: ${opts.name}`,
    `# Generated by setup.ts on ${new Date().toISOString()}`,
    ``,
    `# GitHub App`,
    `GITHUB_APP_ID=${opts.appId}`,
    `GITHUB_APP_PRIVATE_KEY_PATH=${opts.privateKeyPath}`,
    `GITHUB_INSTALLATION_ID=${opts.installationId}`,
    ``,
    `# Anthropic`,
    `# ANTHROPIC_API_KEY=<your-anthropic-key>`,
    ``,
  ]

  const envPath = join(HOME, ".claude", ".env")
  if (existsSync(envPath)) {
    warn(`.env already exists — appending worker config`)
    const existing = await Bun.file(envPath).text()
    await Bun.write(envPath, existing + "\n" + envLines.join("\n"))
  } else {
    await Bun.write(envPath, envLines.join("\n"))
  }
  ok(".env written")
}

// ── Step 5: Install launchd Service ──
// (The former Step 5 "Local HTTPS (mkcert)" was removed 2026-08-10: Pulse's TLS
// support was retired (pulse.ts marks the tls config "unused — TLS removed"), so
// the hosts entry and mkcert certificates it generated served nothing — a dead
// flow that also shipped a retired-brand hostname string. Max payload audit W5.)

async function installService(force = false): Promise<void> {
  heading("Step 5: Installing launchd Service")

  // Create directories
  for (const dir of ["state", "logs"]) {
    const path = join(PULSE_DIR, dir)
    if (!existsSync(path)) mkdirSync(path, { recursive: true })
  }

  const plistSrc = join(PULSE_DIR, "com.lifeos.pulse.plist")
  const plistDst = join(HOME, "Library", "LaunchAgents", "com.lifeos.pulse.plist")

  if (!existsSync(plistSrc)) {
    warn("com.lifeos.pulse.plist not found — create it manually")
    return
  }

  // Read template, substitute __HOME__ with actual user home, write to LaunchAgents.
  // The source plist ships as a template (no hardcoded user paths) so the system
  // file is deny-list clean; the installed copy is per-user materialized.
  const template = await Bun.file(plistSrc).text()
  const materialized = template.split("__HOME__").join(HOME)
  const written = await writeConfigPreserving(plistDst, materialized, {
    force,
    onOverwrite: ({ backupPath }) =>
      warn(`--force: replacing the launch agent — copying the current one to ${backupPath}`),
  })
  const proc = Bun.spawn(["launchctl", "load", plistDst], {
    stdout: "pipe",
    stderr: "pipe",
  })
  await proc.exited

  if (written.outcome === "created") {
    ok("launchd service installed")
  } else if (written.outcome === "overwritten") {
    ok(`launchd service reinstalled (backup: ${written.backupPath})`)
  } else {
    ok("launch agent already installed — left untouched (any local edits kept)")
  }
}

// ── Step 6: Health Check ──

async function healthCheck(): Promise<void> {
  heading("Step 6: Health Check")

  // Wait for Pulse to start
  await Bun.sleep(3_000)

  const pidPath = join(PULSE_DIR, "state", "pulse.pid")
  if (existsSync(pidPath)) {
    const pid = (await Bun.file(pidPath).text()).trim()
    const proc = Bun.spawn(["ps", "-p", pid], { stdout: "pipe", stderr: "pipe" })
    const code = await proc.exited
    if (code === 0) {
      ok(`Pulse running (PID ${pid})`)
    } else {
      warn(`Pulse PID ${pid} not running — check logs/pulse-stderr.log`)
    }
  } else {
    warn("No PID file — Pulse may not have started")
  }

  // Check hook server
  try {
    const resp = await fetch(`${PULSE_BASE}/healthz`, { signal: AbortSignal.timeout(3_000) })
    if (resp.ok) {
      const data = (await resp.json()) as { status: string; jobs: unknown[] }
      ok(`Hook server responding — ${(data.jobs as unknown[])?.length ?? 0} jobs loaded`)
    }
  } catch {
    warn(`Hook server not responding on port ${PULSE_PORT}`)
  }
}

// ── Main ──

async function main() {
  console.log(`
${"═".repeat(50)}
  LifeOS Pulse Worker Setup
  Goal: Working AI employee in under 30 minutes
${"═".repeat(50)}`)

  const startTime = Date.now()
  const force = process.argv.includes("--force")
  if (force) {
    warn("--force: an existing PULSE.toml and launch agent will be REPLACED.")
    warn("Each one is copied to <file>.backup-<timestamp> before it is touched.")
  }

  const identity = await readIdentity()

  const specInput = await prompt("Specialization labels (comma-separated, e.g., research,content — or Enter for none):")
  const specialization = specInput ? specInput.split(",").map((s) => s.trim()).filter(Boolean) : []

  const github = await setupGitHubApp(identity.name)

  await generateConfigs({
    ...identity,
    ...github,
    specialization,
    force,
  })

  await installService(force)
  await healthCheck()

  const elapsed = Math.round((Date.now() - startTime) / 1000)

  console.log(`
${"═".repeat(50)}
  Setup Complete!

  Worker: ${identity.name}
  Time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s

  Next steps:
  - Verify ANTHROPIC_API_KEY is set in ${join(HOME, ".claude", ".env")}
  - Create a test issue with label "status:ready" in one of your repos
  - Watch: tail -f ${join(PULSE_DIR, "logs", "pulse-stdout.log")}
  - Status: ${join(PULSE_DIR, "manage.sh")} status
${"═".repeat(50)}
`)
}

// Guarded so tests can import the config-write helpers without provisioning.
if (import.meta.main) {
  main().catch((err) => {
    console.error(`Setup failed: ${err}`)
    process.exit(1)
  })
}
