/**
 * MemoryWriter path keys on Windows-shaped paths, exercised through path.win32 on any OS.
 * Run: bun test LIFEOS/TOOLS/MemoryWriter.test.ts
 */
import { describe, expect, test } from "bun:test";
import path from "node:path";
import { ledgerKey, snapshotTarget } from "./MemoryWriter";

const W = path.win32;
const ROOT = "C:\\Users\\A\\.claude";
const SNAPSHOTS = `${ROOT}\\LIFEOS\\MEMORY\\OBSERVABILITY\\memory-snapshots`;
const STAMP = "2026-11-03T06-00-00-000Z";

describe("snapshotTarget", () => {
  test("a backslash memory path snapshots directly into the ring (split('/') kept the whole path)", () => {
    const { base, target } = snapshotTarget(SNAPSHOTS, `${ROOT}\\LIFEOS\\USER\\PRINCIPAL\\PRINCIPAL_MEMORY.md`, STAMP, W);
    expect(base).toBe("PRINCIPAL_MEMORY");
    expect(target).toBe(`${SNAPSHOTS}\\PRINCIPAL_MEMORY__${STAMP}.md`);
    expect(W.dirname(target)).toBe(SNAPSHOTS);
  });

  test("POSIX paths name the same snapshot", () => {
    const { target } = snapshotTarget("/r/snaps", "/r/LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md", STAMP, path.posix);
    expect(target).toBe(`/r/snaps/PRINCIPAL_MEMORY__${STAMP}.md`);
  });
});

describe("ledgerKey", () => {
  test("Windows ledger rows are keyed LIFEOS/USER/..., the key CortexLedger verify folds by", () => {
    expect(ledgerKey(`${ROOT}\\LIFEOS\\USER\\PRINCIPAL\\PRINCIPAL_MEMORY.md`, ROOT, W)).toBe("LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md");
    expect(ledgerKey(`${ROOT}\\LIFEOS\\USER\\DIGITAL_ASSISTANT\\DA_MEMORY.md`, "c:/users/a/.claude/", W)).toBe("LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md");
  });

  test("the key is the same string a POSIX install writes", () => {
    expect(ledgerKey("/Users/a/.claude/LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md", "/Users/a/.claude", path.posix))
      .toBe(ledgerKey(`${ROOT}\\LIFEOS\\USER\\PRINCIPAL\\PRINCIPAL_MEMORY.md`, ROOT, W));
  });
});
