#!/usr/bin/env bun
/**
 * @version 1.1.1
 * VigilTaskSummary.hook.ts — logs one Vigil event per finished task that changed something.
 *
 * TRIGGER: Stop (async, so it never holds the turn).
 * "Finished task" = the final answer carries a `🔧 CHANGE:` section, which the output
 * contract reserves for turns that mutated something. Conversational turns log nothing.
 * The event is `info`, so policy.json routes it to the dashboard only, never a text.
 *
 * Written through STATVS writeEvent (hooks/lib/handoff-state writeStatvsEvent; STATVS migration Lane E2): in p1 that is
 * Vigil's local outbox, which the five-minute tick ships to the store, plus the record under dual-write. A refusal or a
 * missing STATVS prints one stderr line and nothing else.
 * Public: ships with the Vigil engine it imports (classification.txt: public LIFEOS/VIGIL/, publish ISA F5).
 * Fail-soft by contract: always exits 0.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { readJson, statePath, writeJson } from "../LIFEOS/VIGIL/State";
import { closerPattern } from "./lib/identity";
import { statvsIndexPath, writeStatvsEvent } from "./lib/handoff-state";

/** The event this hook writes: Vigil's event shape, as STATVS writeEvent takes it. */
export type TaskEvent = {
  id: string; source: string; ts: string; kind: string; severity: string; title: string; summary: string;
  ref: string | null; url: string | null; privacy_class: string; dedup_key: string; meta?: Record<string, unknown>;
};

/**
 * The refusal rules STATVS's event writer applies (STATVS `validateEvent`), loaded by the same computed, optional path
 * as the writer. LIFEOS/STATVS ships in every payload; the optional load only covers an install whose STATVS was
 * removed. With no STATVS there is no rule to check and no writer either, so the event is kept as built and
 * writeStatvsEvent reports it unwritten.
 */
function validator(): ((event: unknown) => void) | null {
  const path = statvsIndexPath();
  if (!existsSync(path)) return null;
  return (require(path) as { validateEvent: (event: unknown) => void }).validateEvent;
}
import { readHookInput, parseTranscriptFromInput } from "./lib/hook-io";
import { findActiveSessionByUUID } from "./lib/isa-utils";

export const SOURCE = "tasks";
const SECTION_END = new RegExp(`^(?:🔧|✅|❓|${closerPattern()}|⚙️|🧠|🩺|🔀|════)`, "u");

/** Bullets under a `<marker> LABEL:` field, up to the next field. */
export function sectionBullets(answer: string, marker: RegExp): string[] {
  const lines = answer.split("\n"), start = lines.findIndex((l) => marker.test(l.trim()));
  if (start < 0) return [];
  const out: string[] = [];
  for (const raw of lines.slice(start + 1)) {
    const line = raw.trim();
    if (SECTION_END.test(line)) break;
    const bullet = line.match(/^(?:[-*•]|\d+\.)\s+(.*)$/)?.[1];
    if (bullet) out.push(bullet.replace(/\*\*|`/g, "").trim().replace(/[.;]+$/, ""));
  }
  return out;
}

/** The answer's lead: first prose line after the banner. */
export function leadLine(answer: string): string {
  for (const raw of answer.split("\n")) {
    const line = raw.trim().replace(/^#+\s*/, "").replace(/\*\*|`/g, "");
    if (!line || /^═/.test(line) || SECTION_END.test(line)) continue;
    return line;
  }
  return "Task finished";
}

export function buildEvent(answer: string, session: string, cwd: string, isa: string | null, now = new Date(), validate?: ((event: unknown) => void) | null): TaskEvent | null {
  const changes = sectionBullets(answer, /^🔧\s*CHANGE:/u);
  if (!/^🔧\s*CHANGE:/mu.test(answer.split("\n").map((l) => l.trim()).join("\n"))) return null;
  const verify = sectionBullets(answer, /^✅\s*VERIFY:/u);
  const project = cwd ? basename(cwd) : "unknown";
  const key = createHash("sha256").update(`${session}\n${changes.join("\n")}\n${verify.join("\n")}`).digest("hex").slice(0, 12);
  const summary = [
    changes.length ? `Changed: ${changes.join("; ")}.` : "",
    verify.length ? `Verified: ${verify.join("; ")}.` : "",
  ].filter(Boolean).join(" ");
  const base: TaskEvent = {
    id: randomUUID(), source: SOURCE, ts: now.toISOString(), kind: "life", severity: "info",
    title: `${project}: ${leadLine(answer)}`.slice(0, 140),
    summary: (summary || "Work changed something; no bullets given.").slice(0, 1000),
    ref: isa ? `MEMORY/WORK/${isa}/ISA.md` : null, url: null, privacy_class: "personal",
    dedup_key: `${SOURCE}:${session || "nosession"}:${key}`,
    meta: { session: session || null, project, isa, changes: changes.length, verified: verify.length },
  };
  // Loaded only once there is an event to check, so a turn that changed nothing never loads STATVS.
  const check = validate === undefined ? validator() : validate;
  try { check?.(base); return base; }
  catch {
    // The answer quoted something the schema refuses (a token shape, an email header): keep the
    // fact that the task happened, drop the text.
    return { ...base, title: `${project}: task finished`, summary: `Changed ${changes.length} things, verified ${verify.length}. Text withheld: it failed Vigil's content check.` };
  }
}

/** One event per turn: a gate-held turn fires Stop again with the same answer. */
function alreadyLogged(session: string, key: string): boolean {
  const path = statePath("task-summary-last.json"), seen = readJson<Record<string, string>>(path, {});
  if (seen[session] === key) return true;
  const next = Object.fromEntries(Object.entries({ ...seen, [session]: key }).slice(-200));
  writeJson(path, next);
  return false;
}

async function main() {
  try {
    const input = await readHookInput(); if (!input) return;
    const session = String(input.session_id ?? "");
    let answer: string = typeof input.last_assistant_message === "string" ? input.last_assistant_message : "";
    if (!answer) answer = (await parseTranscriptFromInput(input)).lastMessage ?? "";
    if (!answer) return;
    let isa: string | null = null;
    try { isa = findActiveSessionByUUID(session)?.slug ?? null; } catch {}
    const event = buildEvent(answer, session, String((input as { cwd?: unknown }).cwd ?? ""), isa);
    if (!event || alreadyLogged(session || "nosession", event.dedup_key)) return;
    const written = writeStatvsEvent(event);
    if (!written.ok) console.error("[VigilTaskSummary] event not written:", written.reason);
  } catch (err) { console.error("[VigilTaskSummary]", err instanceof Error ? err.message : err); }
}

if (import.meta.main) main().then(() => process.exit(0)).catch(() => process.exit(0));
