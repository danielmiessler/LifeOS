/**
 * withKernelLock: acquire, run, release. Windows has no flock(2); before the CreateFileW path every
 * call there returned { ok: false, message: "lock acquisition failed: flock(2) unavailable" }.
 * Run: bun test LIFEOS/TOOLS/lib/LedgerCore.test.ts
 */
import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { withKernelLock } from "./LedgerCore"

test("withKernelLock runs the action and returns its value", () => {
  const dir = mkdtempSync(join(tmpdir(), "kernel-lock-"))
  try {
    expect(withKernelLock(join(dir, "a.lock"), () => 42)).toEqual({ ok: true, value: 42 })
    // Released: the same path can be taken again at once.
    expect(withKernelLock(join(dir, "a.lock"), () => 43, { deadlineMs: 200 })).toEqual({ ok: true, value: 43 })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test.skipIf(process.platform !== "win32")("on Windows a second process waits until the holder releases", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kernel-lock-"))
  const lock = join(dir, "held.lock")
  const mod = join(import.meta.dir, "LedgerCore.ts")
  const script = `const { withKernelLock } = await import(${JSON.stringify(mod)});
withKernelLock(${JSON.stringify(lock)}, () => { console.log("held"); Bun.sleepSync(1500); });`
  const child = Bun.spawn([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" })
  try {
    const reader = child.stdout.getReader()
    let seen = ""
    while (!seen.includes("held")) {
      const { value, done } = await reader.read()
      if (done) break
      seen += new TextDecoder().decode(value)
    }
    expect(seen).toContain("held")
    const busy = withKernelLock(lock, () => "no", { deadlineMs: 200 })
    expect(busy.ok).toBe(false)
    await child.exited
    expect(withKernelLock(lock, () => "yes", { deadlineMs: 2000 })).toEqual({ ok: true, value: "yes" })
  } finally {
    child.kill()
    rmSync(dir, { recursive: true, force: true })
  }
})
