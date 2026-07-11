/**
 * Inference.autostate.test.ts — session-resolution contract for
 * synthesizeAdvisorState() (the --mode advisor --auto-state path).
 *
 * Runs in-process: the function resolves everything from $HOME, so each test
 * points HOME at a throwaway tree. No inference call is ever made — only the
 * state-synthesis step is exercised. Run with: bun test Inference.autostate.test.ts
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { synthesizeAdvisorState } from "./Inference";

const MIN = 60 * 1000;
const iso = (agoMs: number) => new Date(Date.now() - agoMs).toISOString();

const UUID_A = "aaaaaaaa-0000-0000-0000-000000000001";
const UUID_B = "aaaaaaaa-0000-0000-0000-000000000002";

let savedHome: string | undefined;
let savedUserProfile: string | undefined;
let savedSessionId: string | undefined;

beforeEach(() => {
  savedHome = process.env.HOME;
  savedUserProfile = process.env.USERPROFILE;
  savedSessionId = process.env.CLAUDE_SESSION_ID;
  delete process.env.CLAUDE_SESSION_ID;
});

afterEach(() => {
  if (savedHome !== undefined) process.env.HOME = savedHome; else delete process.env.HOME;
  if (savedUserProfile !== undefined) process.env.USERPROFILE = savedUserProfile; else delete process.env.USERPROFILE;
  if (savedSessionId !== undefined) process.env.CLAUDE_SESSION_ID = savedSessionId; else delete process.env.CLAUDE_SESSION_ID;
});

/** Build a throwaway $HOME with a registry and one ISA.md per session slug. */
function fixture(sessions: Record<string, any>): void {
  const home = mkdtempSync(join(tmpdir(), "inference-test-"));
  const memory = join(home, ".claude", "LIFEOS", "MEMORY");
  mkdirSync(join(memory, "STATE"), { recursive: true });
  writeFileSync(join(memory, "STATE", "work.json"), JSON.stringify({ sessions }, null, 2));
  for (const slug of Object.keys(sessions)) {
    if (slug === "__pulse_strip") continue;
    mkdirSync(join(memory, "WORK", slug), { recursive: true });
    writeFileSync(join(memory, "WORK", slug, "ISA.md"), `# ISA for ${slug}\nbody\n`);
  }
  process.env.HOME = home;
  process.env.USERPROFILE = home;
}

function row(overrides: Record<string, any> = {}) {
  return { mode: "interactive", currentMode: "algorithm", phase: "build", updatedAt: iso(1 * MIN), ...overrides };
}

test("CLAUDE_SESSION_ID match wins, including its phase:complete row", async () => {
  fixture({
    "session-a": row({ sessionUUID: UUID_A, phase: "complete", updatedAt: iso(2 * MIN) }),
    "session-b": row({ sessionUUID: UUID_B, phase: "build" }),
  });
  process.env.CLAUDE_SESSION_ID = UUID_A;
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ISA: session-a");
});

test("CLAUDE_SESSION_ID set but unmatched: no state, never a guess", async () => {
  fixture({ "session-a": row({ sessionUUID: UUID_A }) });
  process.env.CLAUDE_SESSION_ID = "aaaaaaaa-0000-0000-0000-00000000dead";
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ADVISOR STATE UNAVAILABLE");
});

test("no env, single fresh live session: uses its ISA", async () => {
  fixture({ "session-a": row({ sessionUUID: UUID_A }) });
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ISA: session-a");
});

test("no env, two fresh live sessions: no state", async () => {
  fixture({
    "session-a": row({ sessionUUID: UUID_A }),
    "session-b": row({ sessionUUID: UUID_B }),
  });
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ADVISOR STATE UNAVAILABLE");
});

test("completion boundary: complete row from 2min ago, no live rows: uses it", async () => {
  fixture({ "session-a": row({ sessionUUID: UUID_A, phase: "complete", updatedAt: iso(2 * MIN) }) });
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ISA: session-a");
});

test("two recent completes, no live: most recently updated wins", async () => {
  fixture({
    "session-a": row({ sessionUUID: UUID_A, phase: "complete", updatedAt: iso(4 * MIN) }),
    "session-b": row({ sessionUUID: UUID_B, phase: "complete", updatedAt: iso(1 * MIN) }),
  });
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ISA: session-b");
});

test("recent complete AND a live row: ambiguous, no state", async () => {
  fixture({
    "session-a": row({ sessionUUID: UUID_A, phase: "complete", updatedAt: iso(2 * MIN) }),
    "session-b": row({ sessionUUID: UUID_B, phase: "build" }),
  });
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ADVISOR STATE UNAVAILABLE");
});

test("old complete (1h ago) is outside the completion window: no state", async () => {
  fixture({ "session-a": row({ sessionUUID: UUID_A, phase: "complete", updatedAt: iso(60 * MIN) }) });
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ADVISOR STATE UNAVAILABLE");
});

test("stale live row (2h idle) is not guessable: no state", async () => {
  fixture({ "session-a": row({ sessionUUID: UUID_A, updatedAt: iso(120 * MIN) }) });
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ADVISOR STATE UNAVAILABLE");
});

test("native placeholder rows are never candidates", async () => {
  fixture({
    "session-native": row({ sessionUUID: UUID_B, mode: "native", phase: "native" }),
    "session-a": row({ sessionUUID: UUID_A }),
  });
  const state = await synthesizeAdvisorState();
  expect(state).toContain("ISA: session-a");
});
