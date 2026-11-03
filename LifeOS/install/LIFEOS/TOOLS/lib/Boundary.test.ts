/**
 * Boundary.confinedPath on Windows-shaped paths. The walk runs over an in-memory tree through
 * path.win32, so the Windows cases run on Linux and macOS CI too; one case uses the real filesystem.
 * Run: bun test LIFEOS/TOOLS/lib/Boundary.test.ts
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path, { type PlatformPath } from "node:path"
import { confinedPath, type ConfinedPathHost } from "./Boundary"

type Node = "dir" | "file" | { link: string }

/** A filesystem of `tree` entries (absolute paths) for path flavour `p`; Windows lookups ignore case like NTFS. */
function fakeHost(p: PlatformPath, tree: Record<string, Node>): ConfinedPathHost {
  const fold = (s: string) => (p.sep === "\\" ? s.toLowerCase() : s)
  const entries = new Map(Object.entries(tree).map(([name, node]) => [fold(p.normalize(name)), { name, node }]))
  const enoent = (s: string) => Object.assign(new Error(`ENOENT: ${s}`), { code: "ENOENT" })
  const lookup = (s: string) => {
    const n = p.normalize(s)
    if (n === p.parse(n).root) return { name: n, node: "dir" as Node }
    const e = entries.get(fold(n))
    if (!e) throw enoent(s)
    return e
  }
  const realpath = (s: string): string => {
    const n = p.normalize(s)
    const root = p.parse(n).root
    let cur = root
    for (const comp of n.slice(root.length).split(p.sep).filter(Boolean)) {
      const e = lookup(p.join(cur, comp))
      cur = typeof e.node === "object" ? realpath(e.node.link) : e.name
    }
    return cur
  }
  const kind = (node: Node) => ({ isSymbolicLink: () => typeof node === "object", isDirectory: () => node === "dir" })
  return {
    path: p,
    realpath,
    lstat: (s) => kind(lookup(s).node),
    stat: (s) => kind(lookup(realpath(s)).node),
  }
}

// The real layout on Windows: ~/.claude/LIFEOS/USER links to the private data repo under ~/.config.
const HOME = "C:\\Users\\A"
const USER_LINK = `${HOME}\\.claude\\LIFEOS\\USER`
const USER_REAL = `${HOME}\\.config\\LIFEOS\\USER`
const MEMORY = `${USER_LINK}\\PRINCIPAL\\PRINCIPAL_MEMORY.md`
const win = fakeHost(path.win32, {
  "C:\\Users": "dir",
  [HOME]: "dir",
  [`${HOME}\\.claude`]: "dir",
  [`${HOME}\\.claude\\settings.json`]: "file",
  [`${HOME}\\.claude\\LIFEOS`]: "dir",
  [USER_LINK]: { link: USER_REAL },
  [`${HOME}\\.config`]: "dir",
  [`${HOME}\\.config\\LIFEOS`]: "dir",
  [USER_REAL]: "dir",
  [`${USER_REAL}\\PRINCIPAL`]: "dir",
  [`${USER_REAL}\\PRINCIPAL\\PRINCIPAL_MEMORY.md`]: "file",
})

describe("confinedPath with Windows paths", () => {
  test("an absolute C:\\ path inside the root resolves (it walked from \"\\\" and was always refused)", () => {
    expect(confinedPath(USER_LINK, MEMORY, win)).toBe(`${USER_REAL}\\PRINCIPAL\\PRINCIPAL_MEMORY.md`)
  })

  test("drive-letter and folder case do not matter", () => {
    const got = confinedPath(USER_LINK, MEMORY.toLowerCase(), win)
    expect(got?.toLowerCase()).toBe(`${USER_REAL}\\PRINCIPAL\\PRINCIPAL_MEMORY.md`.toLowerCase())
    expect(confinedPath(USER_LINK.toUpperCase(), MEMORY, win)).not.toBeNull()
  })

  test("forward-slash spelling (Git Bash, bun) resolves to the same place", () => {
    expect(confinedPath(USER_LINK, MEMORY.replace(/\\/g, "/"), win)).toBe(`${USER_REAL}\\PRINCIPAL\\PRINCIPAL_MEMORY.md`)
  })

  test("a new file in an existing folder is allowed; relative paths walk from the real root", () => {
    expect(confinedPath(USER_LINK, `${USER_LINK}\\PRINCIPAL\\NEW.md`, win)).toBe(`${USER_REAL}\\PRINCIPAL\\NEW.md`)
    expect(confinedPath(USER_LINK, "PRINCIPAL\\NEW.md", win)).toBe(`${USER_REAL}\\PRINCIPAL\\NEW.md`)
  })

  test(".. is taken from the real parent of a link, not folded lexically", () => {
    // USER\.. is ~/.config/LIFEOS physically, so USER\..\USER is back inside the data repo.
    expect(confinedPath(USER_LINK, `${USER_LINK}\\..\\USER\\PRINCIPAL\\PRINCIPAL_MEMORY.md`, win)).toBe(`${USER_REAL}\\PRINCIPAL\\PRINCIPAL_MEMORY.md`)
  })

  test("paths outside the root are refused", () => {
    expect(confinedPath(USER_LINK, `${HOME}\\.claude\\settings.json`, win)).toBeNull()
    expect(confinedPath(USER_LINK, "D:\\LIFEOS\\USER\\x.md", win)).toBeNull()
    expect(confinedPath(USER_LINK, "..\\..\\settings.json", win)).toBeNull()
    expect(confinedPath(USER_LINK, "PRINCIPAL\\missing\\..\\..\\..\\x.md", win)).toBeNull()
  })
})

describe("confinedPath with POSIX paths (unchanged behaviour)", () => {
  const posix = fakeHost(path.posix, {
    "/home": "dir",
    "/home/a": "dir",
    "/home/a/.claude": "dir",
    "/home/a/.claude/LIFEOS": "dir",
    "/home/a/.claude/LIFEOS/USER": { link: "/home/a/.config/LIFEOS/USER" },
    "/home/a/.config": "dir",
    "/home/a/.config/LIFEOS": "dir",
    "/home/a/.config/LIFEOS/USER": "dir",
  })
  test("inside resolves through the link, case is significant, outside is refused", () => {
    expect(confinedPath("/home/a/.claude/LIFEOS/USER", "/home/a/.claude/LIFEOS/USER/x.md", posix)).toBe("/home/a/.config/LIFEOS/USER/x.md")
    expect(confinedPath("/home/a/.claude/LIFEOS/USER", "/HOME/a/.claude/LIFEOS/USER/x.md", posix)).toBeNull()
    expect(confinedPath("/home/a/.claude/LIFEOS/USER", "/home/a/.claude/x.md", posix)).toBeNull()
  })
})

test("confinedPath on the real filesystem accepts an absolute path inside the root", () => {
  const root = mkdtempSync(path.join(tmpdir(), "boundary-"))
  try {
    mkdirSync(path.join(root, "PRINCIPAL"))
    writeFileSync(path.join(root, "PRINCIPAL", "MEMORY.md"), "x")
    const got = confinedPath(root, path.join(root, "PRINCIPAL", "MEMORY.md"))
    expect(got).not.toBeNull()
    expect(confinedPath(root, path.join(root, "..", "outside.md"))).toBeNull()
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
