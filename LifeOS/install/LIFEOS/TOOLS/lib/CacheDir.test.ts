/**
 * cacheDir sets up an owner-only directory. On Windows stat reports 0o666 for every directory and
 * chmod cannot narrow it, so the 0700 checks threw there after the directory had been created.
 * Run: bun test LIFEOS/TOOLS/lib/CacheDir.test.ts
 */
import { expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { cacheDir } from "./CacheDir"
import { hasPosixModes } from "../../../hooks/lib/portable-path"

test("cacheDir creates the nested cache and returns it", () => {
  const root = mkdtempSync(join(tmpdir(), "cachedir-"))
  const prior = process.env.XDG_CACHE_HOME
  process.env.XDG_CACHE_HOME = root
  try {
    const dir = cacheDir("lifeos-test", "nested")
    expect(dir).toBe(join(root, "lifeos-test", "nested"))
    expect(existsSync(dir)).toBe(true)
    if (hasPosixModes()) expect(statSync(dir).mode & 0o777).toBe(0o700)
  } finally {
    if (prior === undefined) delete process.env.XDG_CACHE_HOME
    else process.env.XDG_CACHE_HOME = prior
    rmSync(root, { recursive: true, force: true })
  }
})
