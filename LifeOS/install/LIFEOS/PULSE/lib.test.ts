/**
 * LifeOS Pulse — lib.ts config-layer tests
 *
 * Covers parseConfigToml()'s ${VAR} expansion: that env references resolve
 * anywhere in the document, and — just as important — that plain literals are
 * returned untouched so an existing install does not break on upgrade.
 *
 * Run from LIFEOS/PULSE (requires `bun install` for smol-toml):
 *   bun test lib.test.ts
 *
 * Every credential-shaped value here is fake. Never put a real token in a test.
 */

import { test, expect } from "bun:test"
import { parseConfigToml, resolveEnvVars } from "./lib.ts"

process.env.FAKE_TEST_TOKEN = "fake-token-value"
process.env.FAKE_TEST_HOOK = "https://example.invalid/hook"

const TOML = `
[discord]
enabled = true
bot_token = "\${FAKE_TEST_TOKEN}"
channel_id = "1234567890"
poll_interval_ms = 5000

[notifications.discord]
enabled = true
webhook = "\${FAKE_TEST_HOOK}"

[notifications.routing]
error = ["ntfy", "discord"]

[[job]]
name = "literal-job"
schedule = "*/5 * * * *"
type = "script"
command = "bun run checks/health.ts"
output = "log"
enabled = true

[[job]]
name = "env-job"
schedule = "0 3 * * *"
type = "script"
command = "echo \${FAKE_TEST_TOKEN}"
output = "log"
enabled = true
`

test("expands ${VAR} in a nested section — the [discord] bot_token path", () => {
  const c = parseConfigToml(TOML) as any
  expect(c.discord.bot_token).toBe("fake-token-value")
})

test("expands ${VAR} in [notifications.discord] — upstream's previously dead webhook stub", () => {
  const c = parseConfigToml(TOML) as any
  expect(c.notifications.discord.webhook).toBe("https://example.invalid/hook")
})

test("literal string values pass through byte-identical (backward compatibility)", () => {
  const c = parseConfigToml(TOML) as any
  expect(c.discord.channel_id).toBe("1234567890")
  expect(c.notifications.routing.error).toEqual(["ntfy", "discord"])
  expect(c.job[0].command).toBe("bun run checks/health.ts")
})

test("non-string scalars keep their type", () => {
  const c = parseConfigToml(TOML) as any
  expect(c.discord.enabled).toBe(true)
  expect(c.discord.poll_interval_ms).toBe(5000)
})

test("job.command still expands — the one field that worked before this change", () => {
  const c = parseConfigToml(TOML) as any
  expect(c.job[1].command).toBe("echo fake-token-value")
})

test("an undefined variable resolves to empty string (semantics unchanged)", () => {
  expect(resolveEnvVars("${DEFINITELY_NOT_SET_XYZ}")).toBe("")
})

test("object keys are never rewritten, only values", () => {
  const c = parseConfigToml(TOML) as any
  expect(Object.keys(c.discord)).toContain("bot_token")
})
