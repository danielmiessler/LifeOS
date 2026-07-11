/**
 * AlgoPhase.resolution.test.ts — session-resolution contract for AlgoPhase.ts
 *
 * Drives the CLI as a subprocess against a throwaway registry (LIFEOS_DIR
 * points at a per-test temp tree, which hooks/lib/paths.ts honors), so the
 * real work.json is never touched. Run with: bun test AlgoPhase.resolution.test.ts
 */

import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const TOOL = join(import.meta.dir, "AlgoPhase.ts");

const MIN = 60 * 1000;
const iso = (agoMs: number) => new Date(Date.now() - agoMs).toISOString();

const UUID_A = "aaaaaaaa-0000-0000-0000-000000000001";
const UUID_B = "aaaaaaaa-0000-0000-0000-000000000002";

function algoRow(overrides: Record<string, unknown> = {}) {
  return {
    mode: "interactive",
    currentMode: "algorithm",
    phase: "build",
    updatedAt: iso(1 * MIN),
    started: iso(30 * MIN),
    effort: "E3",
    ...overrides,
  };
}

/** Write a fixture registry into a fresh LIFEOS_DIR temp tree. */
function fixture(sessions: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "algophase-test-"));
  mkdirSync(join(dir, "MEMORY", "STATE"), { recursive: true });
  writeFileSync(join(dir, "MEMORY", "STATE", "work.json"), JSON.stringify({ sessions }, null, 2));
  return dir;
}

function run(lifeosDir: string, args: string[], extraEnv: Record<string, string> = {}) {
  const proc = Bun.spawnSync(["bun", TOOL, ...args], {
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      LIFEOS_DIR: lifeosDir,
      // CLAUDE_SESSION_ID and CLAUDE_PLUGIN_ROOT deliberately absent unless a
      // test injects them — the env is fully replaced, not inherited.
      ...extraEnv,
    },
  });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

function readSessions(lifeosDir: string): Record<string, any> {
  return JSON.parse(readFileSync(join(lifeosDir, "MEMORY", "STATE", "work.json"), "utf-8")).sessions;
}

test("two fresh live rows, bare call: fails closed, lists candidates, writes nothing", () => {
  const dir = fixture({
    "session-a": algoRow({ sessionUUID: UUID_A, phase: "build" }),
    "session-b": algoRow({ sessionUUID: UUID_B, phase: "build", updatedAt: iso(2 * MIN) }),
  });
  const before = readFileSync(join(dir, "MEMORY", "STATE", "work.json"), "utf-8");
  const r = run(dir, ["think"]);
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("ERR:");
  expect(r.stderr).toContain("ambiguous");
  expect(r.stderr).toContain("session-a");
  expect(r.stderr).toContain("session-b");
  expect(readFileSync(join(dir, "MEMORY", "STATE", "work.json"), "utf-8")).toBe(before);
});

test("single fresh live row, bare call: convenience path writes the phase", () => {
  const dir = fixture({ "session-a": algoRow({ sessionUUID: UUID_A }) });
  const r = run(dir, ["think"]);
  expect(r.exitCode).toBe(0);
  expect(r.stdout).toContain("OK: session-a build→think");
  expect(readSessions(dir)["session-a"].phase).toBe("think");
});

test("stale live rows are not guessable: 2h-idle row is skipped, fresh row wins", () => {
  const dir = fixture({
    "session-stale": algoRow({ sessionUUID: UUID_B, updatedAt: iso(120 * MIN) }),
    "session-a": algoRow({ sessionUUID: UUID_A }),
  });
  const r = run(dir, ["think"]);
  expect(r.exitCode).toBe(0);
  expect(r.stdout).toContain("OK: session-a");
  expect(readSessions(dir)["session-stale"].phase).toBe("build");
});

test("only stale rows: bare call errors instead of resurrecting a ghost", () => {
  const dir = fixture({ "session-stale": algoRow({ sessionUUID: UUID_B, updatedAt: iso(120 * MIN) }) });
  const r = run(dir, ["think"]);
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("ERR:");
});

test("CLAUDE_SESSION_ID resolves the matching row, not the most recent", () => {
  const dir = fixture({
    "session-a": algoRow({ sessionUUID: UUID_A, updatedAt: iso(5 * MIN) }),
    "session-b": algoRow({ sessionUUID: UUID_B, updatedAt: iso(1 * MIN) }),
  });
  const r = run(dir, ["verify"], { CLAUDE_SESSION_ID: UUID_A });
  expect(r.exitCode).toBe(0);
  expect(r.stdout).toContain("OK: session-a");
  expect(readSessions(dir)["session-b"].phase).toBe("build");
});

test("CLAUDE_SESSION_ID set but unmatched: hard error, no fall-through guess", () => {
  const dir = fixture({ "session-a": algoRow({ sessionUUID: UUID_A }) });
  const r = run(dir, ["think"], { CLAUDE_SESSION_ID: "aaaaaaaa-0000-0000-0000-00000000dead" });
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("ERR:");
  expect(readSessions(dir)["session-a"].phase).toBe("build");
});

test("explicit --uuid outranks CLAUDE_SESSION_ID env", () => {
  const dir = fixture({
    "session-a": algoRow({ sessionUUID: UUID_A }),
    "session-b": algoRow({ sessionUUID: UUID_B }),
  });
  const r = run(dir, ["plan", "--uuid", UUID_B], { CLAUDE_SESSION_ID: UUID_A });
  expect(r.exitCode).toBe(0);
  expect(r.stdout).toContain("OK: session-b");
  expect(readSessions(dir)["session-a"].phase).toBe("build");
});

test("--uuid with no live match: error, not a fall-through", () => {
  const dir = fixture({ "session-a": algoRow({ sessionUUID: UUID_A }) });
  const r = run(dir, ["think", "--uuid", "aaaaaaaa-0000-0000-0000-00000000dead"]);
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("ERR:");
});

test("--slug works on a phase:complete row (resume-after-complete is sanctioned)", () => {
  const dir = fixture({ "session-done": algoRow({ sessionUUID: UUID_A, phase: "complete" }) });
  const r = run(dir, ["observe", "--slug", "session-done"]);
  expect(r.exitCode).toBe(0);
  expect(r.stdout).toContain("OK: session-done complete→observe");
});

test("--slug and --uuid that disagree: error, nothing written", () => {
  const dir = fixture({ "session-a": algoRow({ sessionUUID: UUID_A }) });
  const r = run(dir, ["think", "--slug", "session-a", "--uuid", UUID_B]);
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("disagree");
  expect(readSessions(dir)["session-a"].phase).toBe("build");
});

test("prototype key as --slug does not false-match (Object.hasOwn guard)", () => {
  const dir = fixture({ "session-a": algoRow({ sessionUUID: UUID_A }) });
  const r = run(dir, ["think", "--slug", "constructor"]);
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("not found");
});

test("__pulse_strip is never addressable, even explicitly", () => {
  const dir = fixture({
    __pulse_strip: { anything: true },
    "session-a": algoRow({ sessionUUID: UUID_A }),
  });
  const r = run(dir, ["think", "--slug", "__pulse_strip"]);
  expect(r.exitCode).toBe(1);
  expect(r.stderr).toContain("not found");
});
