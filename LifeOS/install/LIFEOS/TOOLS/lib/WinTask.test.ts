/**
 * WinTask: the Task Scheduler XML a UnitSpec renders to, and the cadence Services.ts prints for it.
 * Pure string work, so it runs on any OS; registering a real task is covered by the live run on Windows.
 * Run: bun test LIFEOS/TOOLS/lib/WinTask.test.ts
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { UnitSpec } from "./SystemdUser"
import { cadenceOf, renderTaskXml, taskName } from "./WinTask"

const base: Omit<UnitSpec, "schedule"> = {
  label: "com.lifeos.example",
  description: "LifeOS example <job>",
  exec: ["bun", "Example.ts"],
  logPath: "example.log",
}
const NOW = new Date(2026, 10, 3, 8, 0, 0)

describe("renderTaskXml", () => {
  test("an interval job runs at logon and then repeats every N", () => {
    const xml = renderTaskXml({ ...base, schedule: { kind: "interval", seconds: 3600 } }, "C:\\Tools\\bun.exe", NOW)
    expect(xml).toContain("<LogonTrigger>")
    expect(xml).toContain("<Interval>PT1H</Interval>")
    expect(xml).toContain("<ExecutionTimeLimit>PT1H</ExecutionTimeLimit>")
    expect(xml).toContain(`<URI>${taskName(base.label)}</URI>`)
  })

  test("a calendar job is a daily CalendarTrigger at the hour and minute", () => {
    const xml = renderTaskXml({ ...base, schedule: { kind: "calendar", hour: 5, minute: 10 } }, "bun.exe", NOW)
    expect(xml).toContain("<StartBoundary>2026-11-03T05:10:00</StartBoundary>")
    expect(xml).toContain("<DaysInterval>1</DaysInterval>")
    expect(xml).not.toContain("<LogonTrigger>")
  })

  test("daemon and watch jobs never time out and restart on failure", () => {
    for (const schedule of [{ kind: "daemon", restartSec: 30 }, { kind: "watch", paths: ["C:\\x"] }] as const) {
      const xml = renderTaskXml({ ...base, schedule }, "bun.exe", NOW)
      expect(xml).toContain("<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>")
      expect(xml).toContain("<Count>999</Count>")
    }
  })

  test("the action is headless conhost running WinTaskRun, with XML and argv quoting", () => {
    const xml = renderTaskXml({ ...base, schedule: { kind: "daemon", restartSec: 30 } }, "C:\\Program Files\\bun\\bun.exe", NOW)
    expect(xml).toMatch(/<Command>[^<]*conhost\.exe<\/Command>/)
    expect(xml).toContain("--headless &quot;C:\\Program Files\\bun\\bun.exe&quot;")
    expect(xml).toContain("WinTaskRun.ts")
    expect(xml).toContain("LifeOS example &lt;job&gt;")
  })

  test("labels outside [A-Za-z0-9._-] are refused", () => {
    expect(() => renderTaskXml({ ...base, label: "bad label", schedule: { kind: "daemon", restartSec: 1 } }, "bun.exe", NOW)).toThrow()
  })
})

test("cadenceOf reads the installed spec", () => {
  const dir = mkdtempSync(join(tmpdir(), "wintask-"))
  try {
    const cases: Array<[UnitSpec["schedule"], string]> = [
      [{ kind: "interval", seconds: 3600 }, "every 1h"],
      [{ kind: "interval", seconds: 300 }, "every 5m"],
      [{ kind: "calendar", hour: 5, minute: 10 }, "daily/scheduled"],
      [{ kind: "watch", paths: [] }, "on file-change"],
      [{ kind: "daemon", restartSec: 30 }, "at load"],
    ]
    for (const [schedule, want] of cases) {
      const file = join(dir, "spec.json")
      writeFileSync(file, JSON.stringify({ ...base, schedule }))
      expect(cadenceOf(file)).toBe(want)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
