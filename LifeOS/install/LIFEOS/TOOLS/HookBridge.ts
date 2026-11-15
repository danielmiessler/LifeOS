#!/usr/bin/env bun
import { PRIVATE_SKILL_NAMES } from "./CodeDataBoundary.ts";
/**
 * @version 1.1.5
 * HookBridge.ts — the ONE host-side process the LifeOSHooks plugin runs.
 *
 * A function-hooks module runs in its own environment with no Node. `$.fs`
 * takes absolute paths (claude-code.d.ts, 2.1.287), but the plugin keeps every
 * read or write under ~/.claude and the USER tree here anyway, one verb per call,
 * JSON in (argv or stdin) and JSON out (stdout), so the plugin holds exactly
 * one `$.process.run` shape and the host side stays auditable in one place.
 *
 * Verbs:
 *   stamp <sid>                 write MEMORY/STATE/function-hooks/<sid>.json — the
 *                               liveness stamp hooks/lib/function-hooks.ts reads
 *   memory-line <sid>           the 🧠 / 🩺 lines MemoryTurnStart left for this session
 *   isa-state <path>            frontmatter + criterion counts + derived ascent for one ISA
 *                               (read-only: ISASync stays the only work.json writer)
 *   security-protocol           the Security Protocol section of the system prompt
 *   subagent-event <json>       append one row to MEMORY/OBSERVABILITY/subagent-events.jsonl
 *   prompt-context              stdin: UserPromptSubmit input → { entries[], modelRequests[] } in ISC-18 order
 *   pane-notes <json>           { notes: { <session id>: line } }: what other sessions wait on or ended with
 *   band-state <sid>            { isa, nudges[], ultracode, voice, fast, deadline, nextWorkflow } for the AbovePrompt band and footer
 *   turn-complete               stdin: { session_id, cwd, answer, voice? } → last-response cache, voice, { modelRequests[] } (always empty since 2026-09-21)
 *   model-result                stdin: { kind, continuation, text?, error? } → the hook's finish() runs
 *   x-read <url>                the social-platform skill read.ts output for an X status URL ({ok,text} | {ok:false,error})
 *   yt-transcript <url>         fabric -y transcript for a YouTube URL (same shape)
 *   events                      stdin: JSONL batch → MEMORY/OBSERVABILITY/function-hook-events.jsonl
 *   rm-preview <cwd>            stdin command → what a recursive/forced rm would remove (RmPreview.ts)
 *   subagent-sandbox            stdin: { op: plan|surface|after, ... } → SubagentGitSandbox for one subagent Bash call:
 *                               the guard verdict plus the inline-profile wrap, or a fallback with the detector snapshot
 *   status-snapshot <sid> [--full] [--base-url=<url>]  the status display's slow figures (StatusSnapshot.ts); reads caches only
 *   version                     the running Claude Code build (`claude --version`)
 *   codex-lanes                 { lanes: { <AgentType>: <cross-vendor model id> }, efforts: { <AgentType>: low|high } } for every
 *                               agents/*.md whose lower-cased-first-letter name (or explicit `lane:` frontmatter) is a CROSS_VENDOR key —
 *                               the plugin draws the codex model + reasoning effort on the DISPATCH line instead of the wrapper's Claude alias
 *   session-tree                stdin: { session_id, agents[{id, status, stopMs?}], commands[], apply } → { stragglers, reaped }:
 *                               the stray-process reaper (SessionTree.ts): this session's process stragglers reaped and the state file
 *                               Vigil reads written
 *   workflow-card <sid> <runId> <columns>  { lines: string[] } — one workflow run as ANSI lines (WorkflowCard.ts: board-view rows
 *                               + an `as of HH:mm` line) for RichFormat's answer card; an unknown run gives { lines: [] }
 *   memory-ack <sid>            ISC-14: acknowledge the memory emission recorded for <sid> (chunks consumed) once the turn
 *                               was accepted → { acked: emissionId | "" }. The plugin has no filesystem; this verb is its receipt path.
 *   prompt-origin               stdin: { session_id, kind, prompt } → { ok, recorded } — records a non-principal prompt's
 *                               origin by sha before next(), for the private send-override minter, not shipped (hooks/lib/prompt-origin.ts)
 *
 * Every verb prints one JSON object and exits 0; errors print {"error": …} and
 * exit 1. Never blocks on anything: a bridge failure degrades a line, never a turn.
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { getClaudeDir, getLifeosDir, lifeosPath } from "./Paths";
import { cacheResponse } from "../../hooks/lib/response-cache";
import { deriveAscent, ascentTag } from "./ascent";
import { stampPath, readSurfaceLines, mergeStampCaps, PROMPT_MODULE_CAPS } from "../../hooks/lib/function-hooks";
import { presenceContext } from "../../hooks/lib/presence-context";
import { parseFrontmatter } from "../../hooks/lib/isa-utils";
import { countClaims } from "../../hooks/lib/system-surfaces";
import { CROSS_VENDOR, EFFORT_MODEL } from "./models";
import { pursuitNudge, type PursuitSummary } from "../IDEALSTATE/Pursuit";
import { statePath as idealStatePath } from "../IDEALSTATE/Store";
import { routerLevels } from "../../hooks/lib/router-pick";
import { readdirSync } from "node:fs";
import { compose as composeMemory } from "../../hooks/MemoryTurnStart.hook";
import { run as algorithmNudge } from "../../hooks/AlgorithmNudge.hook";
import { run as driftReminder } from "../../hooks/DriftReminder.hook";
import { run as versionDrift } from "../../hooks/VersionDrift.hook";
import { run as modelDriftGuard } from "../../hooks/ModelDriftGuard.hook";
import { HookTimer } from "../../hooks/lib/hook-timing";
import { run as satisfactionCapture } from "../../hooks/SatisfactionCapture.hook";
import { plan as promptPlan, finish as promptFinish, type PPContinuation } from "../../hooks/PromptProcessing.hook";
import { speakAnswer } from "../../hooks/VoiceCompletion.hook";
import { ultracodeForSession } from "./UltracodeState";
import { bandExtras, type BandExtras } from "./BandExtras";
import { paneNotes } from "./PaneNotes";

interface Nudge { text: string; severity: "amber" | "warn" | "info"; prompt: string }
function readJsonFile<T>(p: string, fallback: T): T { try { return JSON.parse(readFileSync(p, "utf8")) as T; } catch { return fallback; } }
/** The band's nudges: the same files the statusline's attention stream reads, each with the prompt its button submits. */
function bandNudges(now: number): Nudge[] {
  const out: Nudge[] = [];
  const iv = readJsonFile<{ due?: boolean }>(join(getLifeosDir(), "USER", "CACHE", "interview-due.json"), {});
  if (iv.due === true) out.push({ text: "Interview due", severity: "amber", prompt: "/interview" });
  try {
    const last = readFileSync(lifeosPath("MEMORY", "OBSERVABILITY", "memory-health.jsonl"), "utf8").trim().split("\n").pop() ?? "";
    const row = JSON.parse(last) as { actions?: Array<{ text?: string; severity?: string }> };
    for (const a of row.actions ?? []) if (typeof a.text === "string" && a.text) out.push({ text: a.text, severity: a.severity === "critical" ? "amber" : "warn", prompt: a.text });
  } catch { /* no health row */ }
  const wa = readJsonFile<{ overdue?: unknown[]; goals_without_work?: unknown[]; stale_projects?: unknown[]; ble?: { overdue?: boolean } }>(lifeosPath("MEMORY", "STATE", "work-attention.json"), {});
  if ((wa.overdue?.length ?? 0) > 0) out.push({ text: `${wa.overdue!.length} issues overdue`, severity: "amber", prompt: "Show me the overdue work issues and what to do about each" });
  // What is moving each ideal-state target and goal (ideal-reconcile), in place of the GitHub-label goal count.
  const pursuit = pursuitNudge(readJsonFile<{ pursuit_summary?: PursuitSummary }>(idealStatePath("reconcile.json"), {}).pursuit_summary);
  if (pursuit) out.push(pursuit);
  if ((wa.stale_projects?.length ?? 0) > 0) out.push({ text: `${wa.stale_projects!.length} projects idle 14d+`, severity: "info", prompt: "Which projects are idle past two weeks, and which one should move first?" });
  if (wa.ble?.overdue) out.push({ text: "BLE pass due", severity: "warn", prompt: "Run the BLE subtraction pass" });
  const st = readJsonFile<{ dims?: Record<string, { value?: number | null; ts?: string }> }>(join(getLifeosDir(), "USER", "STATE", "current.json"), {});
  const stale: string[] = []; let workout = false, walk = false;
  const NAMES: Record<string, string> = { H: "overall", M: "mood", E: "energy", S: "sleep", R: "relationships", F: "finances", C: "creativity", CF: "creative freedom", A: "affirmation" };
  for (const [k, d] of Object.entries(st.dims ?? {})) {
    const age = d?.ts ? now - Date.parse(d.ts) : Infinity;
    if (k === "W") { if (age > 7 * 86_400_000) workout = true; continue; }
    if (k === "K") { if (age > 7 * 86_400_000) walk = true; continue; }
    if (d?.value == null || age > 72 * 3_600_000) stale.push(NAMES[k] ?? k);
  }
  if (stale.length) out.push({ text: `Log ${stale.slice(0, 4).join(", ")}${stale.length > 4 ? "…" : ""}`, severity: "info", prompt: `Let's log my state for ${stale.join(", ")}: ask me one at a time on the 1-5 scale.` });
  if (workout) out.push({ text: "Workout due", severity: "info", prompt: "Log my workout" });
  if (walk) out.push({ text: "Walk due", severity: "info", prompt: "Log my walk" });
  return out.slice(0, 9); // nine hotkeys
}

/** The harness names a project dir by its cwd with every "/" and "." turned into "-". */
function transcriptPathFor(cwd: string, sessionId: string): string {
  return join(getClaudeDir(), "projects", cwd.replace(/[\/.]/g, "-"), `${sessionId}.jsonl`);
}
/**
 * Level → Claude tier for a bridge helper call. DERIVED from the registry rather than written out:
 * the hardcoded table said low/medium were sonnet, and survived the 2026-09-21 rule that nothing
 * here runs on Sonnet or Haiku. Deriving it removes the class of drift, not the instance.
 */
const TIER_ALIAS: Record<string, string> = EFFORT_MODEL;
/** `via: "bridge"` (2026-09-18): the plugin hands the request back to the `model-run` verb, which runs it
 *  through Inference.ts, so helper inference follows CONFIG/inference-vendor.json (the OpenAI lanes, with the
 *  claude CLI as the config fallback) instead of the plugin's own Claude client. `model` stays as the label an
 *  older plugin build falls back to with `$.model.complete`. */
interface ModelRequest { kind: string; model: string; level: string; via: "bridge"; system: string; prompt: string; continuation: unknown }

const [verb, ...rest] = process.argv.slice(2);

/** The child's own first stderr line, never the argv echo of "Command failed: …". */
function childError(err: unknown): string {
  const e = err as { stderr?: unknown; message?: unknown };
  const stderr = typeof e?.stderr === "string" ? e.stderr : e?.stderr instanceof Uint8Array ? new TextDecoder().decode(e.stderr) : "";
  const line = stderr.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return (line ?? (typeof e?.message === "string" ? e.message : String(err))).split("\n")[0].slice(0, 300);
}

function out(obj: unknown, code = 0): never {
  process.stdout.write(JSON.stringify(obj) + "\n");
  process.exit(code);
}

/**
 * Withdraw one capability from a session's stamp so the native hook that would cover it
 * runs again. If the stamp cannot be rewritten it is deleted: a stamp left standing would
 * keep suppressing the native fallback for work this module did not do.
 */
function clearStampCap(sessionId: string, cap: string): void {
  const p = stampPath(sessionId);
  try {
    if (!existsSync(p)) return;
    const cur = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    const have = Array.isArray(cur.caps) ? (cur.caps as unknown[]).filter((c): c is string => typeof c === "string") : [];
    if (!have.includes(cap)) return;
    writeFileSync(p, JSON.stringify({ ...cur, caps: have.filter((c) => c !== cap), caps_ts: new Date().toISOString() }) + "\n", "utf8");
  } catch {
    try { unlinkSync(p); } catch { /* already gone */ }
  }
}

function argJson(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rest[0] ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "unknown";
}

try {
  switch (verb) {
    case "stamp": {
      const sid = safeId(rest[0] ?? "");
      const p = stampPath(sid);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ session_id: sid, ts: new Date().toISOString(), plugin: "LifeOSHooks" }) + "\n");
      out({ ok: true, path: p });
    }
    case "memory-line": {
      out(readSurfaceLines(safeId(rest[0] ?? "")));
    }
    case "isa-state": {
      const path = rest[0] ?? "";
      const name = basename(path).toLowerCase();
      if (!path || !(name === "isa.md" || name.endsWith(".isa.md")) || !existsSync(path)) out({ isa: false });
      const content = readFileSync(path, "utf8");
      const fm = parseFrontmatter(content) ?? {};
      const claims = countClaims(content);
      let slug = fm.slug || "";
      if (!slug) {
        const w = path.match(/MEMORY\/WORK\/([^/]+)\//);
        if (w) slug = w[1];
        else {
          const d = path.match(/([^/]+)\/[^/]+$/);
          if (d) slug = "project-" + d[1].toLowerCase();
        }
      }
      const [doneStr, totalStr] = String(fm.progress || "0/0").split("/");
      const state = deriveAscent({
        phase: (fm.phase || "").toUpperCase(),
        tracked: true,
        active: true,
        done: parseInt(doneStr, 10) || 0,
        total: parseInt(totalStr, 10) || 0,
      });
      const tag = ascentTag(state);
      out({ isa: true, slug, phase: fm.phase || "", progress: fm.progress || "", closed: claims.closed, open: claims.open, state, icon: tag.icon, label: tag.label });
    }
    case "security-protocol": {
      const prompt = readFileSync(join(getLifeosDir(), "LIFEOS_SYSTEM_PROMPT.md"), "utf8");
      // The section runs to the next `## ` heading or to the end of the file (it may be last).
      // An absent or empty section is an error, never an empty-but-successful answer: the
      // caller must be able to tell "no protocol" from a protocol that loaded.
      const m = prompt.match(/^## Security Protocol[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
      const text = m ? m[1].trim() : "";
      if (!text) out({ error: "security-protocol: section missing or empty in LIFEOS_SYSTEM_PROMPT.md" }, 1);
      out({ text });
    }
    case "subagent-event": {
      const j = argJson();
      const file = lifeosPath("MEMORY", "OBSERVABILITY", "subagent-events.jsonl");
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, JSON.stringify({ timestamp: new Date().toISOString(), ...j }) + "\n");
      // The in-flight roster the status line reads (agent-starts.json) — same file
      // and shape AgentInvocation.hook.ts maintains on the fallback path, so the
      // roster never goes dark when the plugin takes over.
      try {
        const starts = lifeosPath("MEMORY", "OBSERVABILITY", "agent-starts.json");
        let map: Record<string, unknown> = {};
        try { if (existsSync(starts)) map = JSON.parse(readFileSync(starts, "utf8")); } catch { map = {}; }
        const key = String(j.subagent_id ?? "");
        if (key && j.event === "subagent_start") {
          map[key] = { epoch: Date.now(), timestamp: new Date().toISOString(), subagent_type: j.subagent_type, description: j.description, model: j.subagent_model, level: j.subagent_level };
        } else if (key && j.event === "subagent_stop") {
          delete map[key];
        }
        writeFileSync(starts, JSON.stringify(map, null, 2), "utf8");
      } catch { /* the roster is decoration; the event row already landed */ }
      out({ ok: true });
    }
    case "events": {
      const raw = readFileSync(0, "utf8");
      const file = lifeosPath("MEMORY", "OBSERVABILITY", "function-hook-events.jsonl");
      mkdirSync(dirname(file), { recursive: true });
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length) appendFileSync(file, lines.join("\n") + "\n");
      out({ ok: true, appended: lines.length });
    }
    case "prompt-context": {
      // F2 (ISC-18): the prompt-time composers, once, in one child, in a fixed order.
      // stdin: the UserPromptSubmit hook input shape (session_id, prompt, cwd, model?).
      // The native registrations stay (FUNCTIONHOOKS ISA, ISC-18 decision); each
      // fast-exits when the session is stamped, so this child is the only place the
      // work runs in an armed session.
      const input = JSON.parse(readFileSync(0, "utf8") || "{}") as Record<string, unknown>;
      if (!input.hook_event_name) input.hook_event_name = "UserPromptSubmit";
      if (typeof input.transcript_path !== "string" && typeof input.cwd === "string" && typeof input.session_id === "string") {
        input.transcript_path = transcriptPathFor(input.cwd, input.session_id);
      }
      // The caps prove to the native hooks that the module running this session handed over
      // the prompt/turn work (hooks/lib/function-hooks.ts hookCovers), so a native hook
      // fast-exits only on work this module did. They are therefore committed LAST, after
      // the composers ran, and only if none of them failed; a composer that threw (HookTimer
      // swallows it into timer.errors) or a crash withdraws "prompt-context", so the native
      // fallback runs instead of the prompt silently losing its context. Still before this
      // verb returns, so the natives see the result on this very prompt.
      const sid = typeof input.session_id === "string" ? input.session_id : "";
      try {
      const timer = new HookTimer("UserPromptSubmit", input as never);
      const entries: string[] = [];
      const modelRequests: ModelRequest[] = [];
      const mem = await timer.timed("MemoryTurnStart", async () => {
        // compose()'s own timer is not flushed: this timer's MemoryTurnStart leg is the one row.
        const { stdout } = await composeMemory(input);
        if (!stdout.trim()) return null;
        try { const j = JSON.parse(stdout) as { hookSpecificOutput?: { additionalContext?: string } }; return j.hookSpecificOutput?.additionalContext ?? null; }
        catch { return stdout; }
      });
      if (mem) entries.push(mem);
      const nudge = await timer.timed("AlgorithmNudge", () => algorithmNudge(input as never)); if (nudge) entries.push(nudge);
      const ver = await timer.timed("VersionDrift", () => versionDrift()); if (ver) entries.push(ver);
      const drift = await timer.timed("DriftReminder", () => driftReminder(input)); if (drift) entries.push(drift);
      const model = await timer.timed("ModelDriftGuard", () => modelDriftGuard(input)); if (model) entries.push(model);
      const reach = await timer.timed("PresenceContext", () => presenceContext()); if (reach) entries.push(reach);
      // Unit B: the deterministic legs of the two heavy prompt hooks, and the ONE model
      // request PromptProcessing may want (naming on the first prompt; a misheard-term
      // correction check on the first few follow-ups), for the plugin to run
      // in-process with $.model.complete and hand back through model-result.
      await timer.timed("SatisfactionCapture", () => satisfactionCapture(input as never));
      const pp = await timer.timed("PromptProcessing", () => promptPlan(input as never));
      if (pp) modelRequests.push({ kind: "prompt-processing", model: TIER_ALIAS[pp.request.level] ?? EFFORT_MODEL.medium, level: pp.request.level, via: "bridge", system: pp.request.system, prompt: pp.request.prompt, continuation: pp.continuation });
      const row = timer.flush();
      const covered = timer.errors.length === 0;
      if (sid) {
        if (covered) mergeStampCaps(sid, PROMPT_MODULE_CAPS);
        else clearStampCap(sid, "prompt-context");
      }
      out({ ok: true, covered, errors: [...timer.errors], entries, modelRequests, modules: row?.modules ?? timer.modules, total_ms: Math.round(timer.elapsed()) });
      } catch (err) {
        if (sid) clearStampCap(sid, "prompt-context");
        throw err;
      }
    }
    case "pane-notes": {
      // The band's other-sessions rows (FUNCTIONHOOKS ISC-206/207): one line per session from its transcript tail.
      let items: Array<{ session: string; status: string }> = [];
      try { items = JSON.parse(process.argv[3] ?? "[]"); } catch { items = []; }
      out({ ok: true, notes: paneNotes(Array.isArray(items) ? items : []) });
      break;
    }
    case "band-state": {
      // The band above the prompt: this session's ISA (from its work.json row) and the nudges.
      const sid = process.argv[3] ?? "";
      let isa: Record<string, unknown> | null = null;
      try {
        const w = JSON.parse(readFileSync(lifeosPath("MEMORY", "STATE", "work.json"), "utf8")) as { sessions?: Record<string, { sessionUUID?: string; isa?: string }> };
        const row = Object.values(w.sessions ?? {}).find((r) => r.sessionUUID === sid && typeof r.isa === "string");
        if (row?.isa) {
          const p = row.isa.startsWith("/") ? row.isa : lifeosPath(...row.isa.split("/"));
          const content = readFileSync(p, "utf8");
          const fm = parseFrontmatter(content) ?? {};
          const claims = countClaims(content);
          const [doneStr, totalStr] = String(fm.progress || "0/0").split("/");
          const st = deriveAscent({ phase: (fm.phase || "").toUpperCase(), tracked: true, active: true, done: parseInt(doneStr, 10) || 0, total: parseInt(totalStr, 10) || 0 });
          const tag = ascentTag(st);
          isa = { path: p, slug: String(fm.slug || basename(dirname(p)).toLowerCase()), phase: fm.phase || "", progress: fm.progress || `${claims.closed}/${claims.closed + claims.open}`, closed: claims.closed, open: claims.open, state: st, icon: tag.icon, label: tag.label };
        }
      } catch { /* no row, no ISA */ }
      // The 🧠 memory line rides in the band above the prompt, not trailing at the very bottom. Same stamped source
      // MemoryTurnStart left for this session — read, never recomputed here.
      let memory: string | null = null;
      try {
        const surf = readSurfaceLines(sid) as { memory?: unknown };
        if (surf && typeof surf.memory === "string" && surf.memory) memory = surf.memory;
      } catch { /* no stamped line yet */ }
      // F10: ultracode for this session, read from its transcript (stdin reports it only as effort xhigh).
      let ultracode = false;
      try { ultracode = ultracodeForSession(sid); } catch { /* unreadable transcript: off */ }
      // F12 (ISC-173): voice, fast, this session’s deadline and the next scheduled fire; each degrades on its own.
      let extras: BandExtras = { voice: false, fast: false, deadline: null, nextWorkflow: null };
      try { extras = bandExtras(sid); } catch { /* every field stays empty */ }
      out({ ok: true, isa, memory, nudges: bandNudges(Date.now()), ultracode, ...extras });
    }
    case "turn-complete": {
      // stdin: { session_id, cwd, answer, voice? }. Writes the last-response cache (LastResponseCache's
      // job), speaks the 🗣️ line when asked (VoiceCompletion's job), 
      const j = JSON.parse(readFileSync(0, "utf8") || "{}") as { session_id?: string; cwd?: string; answer?: string; voice?: boolean };
      const sid = typeof j.session_id === "string" ? j.session_id : "";
      if (!sid) out({ error: "session_id required" }, 1);
      const modelRequests: ModelRequest[] = [];
      if (typeof j.answer === "string" && j.answer.trim()) {
        cacheResponse(sid, j.answer);
      }
      let spoke = false;
      if (j.voice === true && typeof j.answer === "string" && j.answer.trim()) {
        try { spoke = await speakAnswer(sid, j.answer); } catch (err) { process.stderr.write(`voice: ${err instanceof Error ? err.message : String(err)}\n`); }
      }
      out({ ok: true, modelRequests, spoke });
    }
    case "model-run":
    case "model-result": {
      // model-result stdin: { kind, continuation, text?, error? } — the plugin ran the model; the hook finishes.
      // model-run stdin: { kind, continuation, system, prompt, level } — the model runs HERE through Inference.ts
      // (vendor from CONFIG/inference-vendor.json), then the same finish. `vendor`/`executed` report what ran.
      const j = JSON.parse(readFileSync(0, "utf8") || "{}") as { kind?: string; continuation?: unknown; text?: string; error?: string; system?: string; prompt?: string; level?: string };
      let ran: { vendor?: string; executed?: string } = {};
      if (verb === "model-run") {
        if (j.kind !== "prompt-processing") out({ error: `unknown model-run kind: ${String(j.kind)}` }, 1);
        const { inference } = await import("./Inference");
        const level = j.level === "low" || j.level === "medium" || j.level === "high" ? j.level : "low";
        const r = await inference({ systemPrompt: String(j.system ?? ""), userPrompt: String(j.prompt ?? ""), level, timeout: 25_000 });
        j.text = r.output ?? "";
        j.error = r.success ? undefined : (r.error ?? "inference failed");
        ran = { vendor: r.vendor, executed: r.executedModel };
      }
      if (j.kind === "prompt-processing") {
        const text = typeof j.text === "string" ? j.text : "";
        const m = text.match(/\{[\s\S]*\}/);
        let parsed: unknown; try { parsed = m ? JSON.parse(m[0]) : undefined; } catch { parsed = undefined; }
        await promptFinish(j.continuation as PPContinuation, { success: !!parsed, parsed, error: j.error ?? (parsed ? undefined : "no JSON in model reply") });
        out({ ok: true, finished: "prompt-processing", named: !!parsed, ...ran });
      }
      out({ error: `unknown model-result kind: ${String(j.kind)}` }, 1);
    }
    case "x-read": {
      // The X reads rule as a route: read.ts first; on failure the plugin answers an
      // error naming the Apify fallback (OPERATIONAL_PREFERENCES § X reads). Never WebFetch.
      const url = process.argv[3] ?? "";
      if (!/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url)) out({ error: "not an X status URL" }, 1);
      // The X reader lives in a private skill that is stripped from the public payload:
      // absence is a clean refusal, never a crash (G8 absence-guard).
      const xReader = join(getClaudeDir(), "skills", PRIVATE_SKILL_NAMES.social, "Tools", "read.ts");
      if (!existsSync(xReader)) out({ ok: false, error: "X reader not installed on this tree" }, 1);
      try {
        const text = execFileSync("bun", [xReader, url], { encoding: "utf8", timeout: 30_000, cwd: getClaudeDir() });
        out({ ok: true, text: text.trim() });
      } catch (err) {
        out({ ok: false, error: childError(err) }, 1);
      }
    }
    case "yt-transcript": {
      const url = process.argv[3] ?? "";
      if (!/(?:youtube\.com\/(?:watch|shorts)|youtu\.be\/)/.test(url)) out({ error: "not a YouTube URL" }, 1);
      try {
        const text = execFileSync("fabric", ["-y", url], { encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
        if (!text.trim()) throw new Error("fabric -y returned no transcript");
        out({ ok: true, text: text.trim() });
      } catch (err) {
        out({ ok: false, error: childError(err) }, 1);
      }
    }
    case "codex-lanes": {
      // Mirrors hooks/AgentInvocation.hook.ts resolveDispatch: cross-vendor key = subagent type with a
      // lower-cased first letter; an explicit `lane:` frontmatter key wins (the worker agents carry one).
      const lanes: Record<string, string> = {};
      // ISC-54: the reasoning effort each contract passes the helper (`--reasoning-effort <x>`), for the DISPATCH line.
      const efforts: Record<string, string> = {};
      const dir = join(getClaudeDir(), "agents");
      for (const f of existsSync(dir) ? readdirSync(dir) : []) {
        if (!f.endsWith(".md") || f === "README.md") continue;
        const type = f.slice(0, -3);
        let key = type.charAt(0).toLowerCase() + type.slice(1);
        let text = "";
        try { text = readFileSync(join(dir, f), "utf8"); } catch { /* unreadable → cvKey rule */ }
        const m = text.slice(0, 4000).match(/^lane:\s*(\S+)/m); if (m) key = m[1];
        if (CROSS_VENDOR[key]) {
          lanes[type] = CROSS_VENDOR[key];
          const ef = text.match(/--reasoning-effort\s+(\w+)/); if (ef) efforts[type] = ef[1];
        }
      }
      // ISC-60: lane and tier levels from WORK_LADDER / EFFORT_MODEL, so the plugin draws the router line with no table of its own.
      out({ lanes, efforts, levels: routerLevels() });
    }
    case "prompt-origin": {
      // A non-principal prompt (task notification, peer, scheduled trigger, channel) is recorded by
      // sha before the plugin calls next(), so the private send-override minter (not shipped) can tell
      // it from the principal's own prompt (hooks/lib/prompt-origin.ts). stdin: { session_id, kind, prompt }.
      const j = JSON.parse(readFileSync(0, "utf8") || "{}") as Record<string, unknown>;
      const sid = typeof j.session_id === "string" ? j.session_id : "";
      const kind = typeof j.kind === "string" ? j.kind : "";
      const prompt = typeof j.prompt === "string" ? j.prompt : "";
      if (!sid || !kind) out({ error: "session_id and kind required" }, 1);
      const { recordOrigin } = await import("../../hooks/lib/prompt-origin");
      out({ ok: true, recorded: recordOrigin({ session_id: sid, kind, prompt }) });
    }
    case "memory-ack": {
      // ISC-14: the acceptance-boundary receipt. MemoryTurnStart wrote the emission id when it emitted
      // chunks; the plugin calls this after next() returned without a drop. Idempotent and best-effort.
      const sid = process.argv[3] ?? "";
      if (!sid) out({ error: "session id required" }, 1);
      const { readEmission, clearEmission } = await import("../../hooks/lib/emission-receipt");
      const { acknowledgeEmission } = await import("../../hooks/MemoryTurnStart.hook");
      const emission = readEmission(sid, getClaudeDir());
      if (emission?.emissionId) { acknowledgeEmission(sid, emission.emissionId); clearEmission(sid, getClaudeDir()); }
      out({ acked: emission?.emissionId ?? "" });
    }
    case "session-tree": {
      const { snapshot } = await import("./SessionTree.ts");
      out(await snapshot(JSON.parse(readFileSync(0, "utf8") || "{}")));
    }
    case "workflow-card": {
      // WORKFLOW BOARD ISA F7: one run drawn as ANSI lines for an answer card (WorkflowCard.ts), from the shared
      // board-view rows. RichFormat runs this only for a flush holding a closed `workflow` fence. Unknown run → no lines.
      const { workflowCardLines } = await import("./WorkflowCard.ts");
      out({ lines: workflowCardLines({ session: safeId(rest[0] ?? ""), runId: rest[1] ?? "", columns: Number(rest[2]) }) });
    }
    case "subagent-sandbox": {
      // stdin: { op: "plan" | "surface" | "after", ... } → the plugin's SubagentGitSandbox step for one subagent
      // Bash call (hooks/SubagentGitSandbox.hook.ts: pluginPlan, surfaceNow, surfaceAfter). The module is an
      // enforce gate (S055, ISA 20261015-security-p1-batch2): one that will not load can neither run
      // SubagentShipGuard on the command nor take the detector's snapshot, so a plan answers a deny with the
      // reason (the plugin honours it) and the detector ops exit non-zero. It never answers the old fallback,
      // which ran the command unwrapped with no guard verdict and no detector.
      // Round 2: EVERY step before the verdict sits inside that rule, not only the sandbox import: the request read,
      // the gate runner's own import, and the plan itself. A failure anywhere answers the deny for a plan (and for a
      // request too broken to name its op, the deny plus an error), so no failure of this step can reach the plugin
      // as a bare {error}, which it would turn into an unwrapped call with the detector only.
      let op = "";
      const refuse = (why: string): never => {
        const reason = `SubagentGitSandbox: ${why}; the subagent's Bash call is refused rather than run unguarded`.slice(0, 400);
        if (op === "plan") out({ kind: "deny", reason });
        if (op === "surface" || op === "after") out({ error: reason }, 1);
        out({ kind: "deny", reason, error: reason }, 1);
      };
      let j: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(readFileSync(0, "utf8") || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not a JSON object");
        j = parsed as Record<string, unknown>;
        op = typeof j.op === "string" ? j.op : "";
      } catch (err) {
        refuse(`unreadable request (${childError(err)})`);
      }
      let runGate: typeof import("../../hooks/lib/gate-run").runGate;
      try {
        ({ runGate } = await import("../../hooks/lib/gate-run"));
      } catch (err) {
        refuse(`the gate runner hooks/lib/gate-run.ts failed to load (${childError(err)})`);
      }
      const ran = await runGate!("enforce", "SubagentGitSandbox", async () => {
        const sandbox = await import("../../hooks/SubagentGitSandbox.hook");
        if (op === "plan") return await sandbox.pluginPlan(j);
        if (op === "surface") return await sandbox.surfaceNow();
        if (op === "after") return await sandbox.surfaceAfter(j);
        return undefined;
      });
      if (ran.status === "failed") refuse(ran.reason);
      else if (ran.value === undefined) out({ error: `subagent-sandbox: unknown op ${String(j.op)}` }, 1);
      else out(ran.value);
    }
    case "rm-preview": {
      // stdin: the command; argv: the cwd. What a recursive/forced rm would remove, never run (RmPreview.ts).
      const { preview, noticeLine } = await import("./RmPreview.ts");
      const cwd = rest[0] || process.cwd();
      const pv = preview(readFileSync(0, "utf8"), cwd);
      out({ ...pv, line: noticeLine(pv, cwd) });
    }
    case "status-snapshot": {
      // The status display's slow figures (StatusSnapshot.ts): FB, Codex, overage, 🧠/🩺; --full adds models, env, version.
      const { snapshot } = await import("./StatusSnapshot.ts");
      // --base-url=<ANTHROPIC_BASE_URL of the Claude Code process, empty when unset>: the transport label (PoolProxy ISC-36/66).
      const baseArg = rest.find((x) => x.startsWith("--base-url="));
      out(snapshot(safeId(rest[0] ?? ""), rest.includes("--full"), undefined, undefined, undefined, baseArg === undefined ? {} : { baseUrl: baseArg.slice("--base-url=".length) }));
    }
    case "isa-governing": {
      // Code sync, start (ISASystem.md § Code sync): the governing ISA of a path, its real path, and whether it is an ISA itself.
      const { governingIsa, isCodeFile } = await import("./IsaGoverning.ts");
      const { realpathSync } = await import("node:fs");
      const p = rest[0] ?? "";
      let real = p;
      try { real = realpathSync(p); } catch { /* a file a Write is about to create */ }
      out({ isa: governingIsa(p), real, isIsa: basename(p) === "ISA.md", code: isCodeFile(p) });
    }
    case "route": {
      // Router ISA F16 (R165/R166): an ISA's written route and its check against this session's dispatches. No model call.
      const { parseRoute, routeLine, checkRoute, checkLines, sessionRows } = await import("../ROUTER/RouteCheck.ts");
      const isaPath = rest[0] ?? "";
      const route = existsSync(isaPath) ? parseRoute(readFileSync(isaPath, "utf8")) : [];
      const results = route.length && rest[1] ? checkRoute(route, sessionRows(safeId(rest[1]))) : [];
      out({ route: routeLine(route), check: checkLines(results), ran: results.some((r) => r.ran.length > 0) });
    }
    case "thinking": {
      // The run's written thinking plan (ISAFormat § Feature blocks, the Thinking: line) and its check against this session's Skill calls. No model call.
      const { parseThinking, thinkingLine, checkThinking, checkLines, skillCalls, sessionTranscripts } = await import("../ROUTER/ThinkingCheck.ts");
      const isaPath = rest[0] ?? "";
      const plans = existsSync(isaPath) ? parseThinking(readFileSync(isaPath, "utf8")) : [];
      const files = plans.length && rest[1] ? sessionTranscripts(safeId(rest[1])) : [];
      const results = files.length ? checkThinking(plans, files.flatMap((f) => skillCalls(readFileSync(f, "utf8")))) : [];
      out({ thinking: thinkingLine(plans), check: checkLines(results), ran: results.some((r) => r.ran.length > 0) });
    }
    case "thinking-fit": {
      // One shadow Assay question per skipped thinking skill; any engine failure is no flag.
      const { parseThinking, fitFlags, fitLines } = await import("../ROUTER/ThinkingCheck.ts");
      const { ask } = await import("../ASSAY/Assay.ts");
      const isaPath = rest[0] ?? "";
      const plans = existsSync(isaPath) ? parseThinking(readFileSync(isaPath, "utf8")) : [];
      const { flags, skipped } = await fitFlags(plans, ask as never, rest[1] ? safeId(rest[1]) : undefined, process.env, isaPath);
      out({ lines: fitLines(flags, skipped) });
    }
    case "route-fit": {
      // Router ISA F16 (R167): the background fit question; any engine failure is no flag.
      const { parseRoute, fitFlags, fitLines } = await import("../ROUTER/RouteCheck.ts");
      const { ask } = await import("../ASSAY/Assay.ts");
      const isaPath = rest[0] ?? "";
      const route = existsSync(isaPath) ? parseRoute(readFileSync(isaPath, "utf8")) : [];
      const { flags } = await fitFlags(route, ask as never, rest[1] ? safeId(rest[1]) : undefined);
      out({ lines: fitLines(flags) });
    }
    case "version": {
      const v = execFileSync("claude", ["--version"], { encoding: "utf8", timeout: 10_000 }).trim();
      out({ version: v.split(/\s+/)[0] ?? v, raw: v });
    }
    default:
      out({ error: `unknown verb: ${verb ?? "(none)"}`, verbs: ["stamp", "memory-line", "isa-state", "security-protocol", "subagent-event", "events", "prompt-context", "band-state", "pane-notes", "turn-complete", "model-result", "x-read", "yt-transcript", "version", "codex-lanes", "memory-ack", "prompt-origin", "session-tree", "status-snapshot", "rm-preview", "workflow-card", "subagent-sandbox", "isa-governing", "route", "route-fit", "thinking", "thinking-fit"] }, 1);
  }
} catch (err) {
  out({ error: err instanceof Error ? err.message : String(err), claudeDir: getClaudeDir() }, 1);
}
