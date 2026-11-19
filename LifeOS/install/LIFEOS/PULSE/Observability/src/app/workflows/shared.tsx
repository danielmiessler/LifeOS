"use client";

/**
 * Workflows page — shared vocabulary: the runtime and executor palettes, the
 * health model, time formatting, the response-shape guard, and the small
 * glyphs every section draws. One file so a colour or a status rule cannot
 * mean one thing in the catalog and another in the card.
 *
 * Contract: LIFEOS/WORKFLOWS/types.ts (what GET /api/workflows returns).
 */

import type { CSSProperties } from "react";
import { CodeXml, Scale, Sparkles, UserRound, CircleQuestionMark, type LucideIcon } from "lucide-react";
import type {
  Card,
  Executor,
  Finding,
  Inventory,
  Runtime,
  Severity,
  WorkflowRecord,
} from "../../../../../WORKFLOWS/types";
import { parseApps } from "./v2/api";
import { fmtClock, fmtDateParts, zonedDayKey } from "@/lib/time";

export type { Card, Executor, Finding, Inventory, Runtime, Severity, WorkflowRecord };

/* ── Runtimes: one colour each, used for grouping everywhere on the page ── */

export const SCHEDULED_RUNTIMES = ["launchd", "systemd", "agent-job", "pulse-cron", "cloud", "project-cron", "workflow"] as const satisfies readonly Runtime[];
export const ALL_RUNTIMES: readonly Runtime[] = [...SCHEDULED_RUNTIMES, "skill"];

/* Cool and neutral hues only, so a runtime never reads as a health colour
   (green / amber / red belong to status). */
export const RUNTIME_META: Record<Runtime, { label: string; color: string; blurb: string }> = {
  launchd: { label: "launchd", color: "#7DD3FC", blurb: "macOS services" },
  systemd: { label: "systemd", color: "#F59E0B", blurb: "Linux user timers" },
  "agent-job": { label: "agent jobs", color: "#B794F4", blurb: "scheduled agent runs" },
  "pulse-cron": { label: "Pulse cron", color: "#2DD4BF", blurb: "jobs inside the Pulse daemon" },
  cloud: { label: "Cloud (Cloudflare)", color: "#F472B6", blurb: "Cloudflare Workers: actions, pipelines, flows and apps" },
  "project-cron": { label: "project cron", color: "#E0A458", blurb: "crons in project repos" },
  skill: { label: "skills", color: "#94A3B8", blurb: "on-demand skill intents" },
  workflow: { label: "typed workflows", color: "#818CF8", blurb: "typed Workflows definitions" },
};

export function runtimeTint(rt: Runtime, alpha: number): string {
  return hexAlpha(RUNTIME_META[rt].color, alpha);
}

/* ── Executors: who or what performs a step ── */

export const EXECUTORS: readonly Executor[] = ["code", "judgment", "model", "human", "unknown"];

export const EXECUTOR_META: Record<Executor, { label: string; color: string; icon: LucideIcon; blurb: string }> = {
  code: { label: "code", color: "#60A5FA", icon: CodeXml, blurb: "deterministic code" },
  judgment: { label: "judgment", color: "#FCD34D", icon: Scale, blurb: "a Glance judgment" },
  model: { label: "model", color: "#E879F9", icon: Sparkles, blurb: "a language model" },
  human: { label: "human", color: "#FB923C", icon: UserRound, blurb: "a person" },
  unknown: { label: "unknown", color: "#7C8BA1", icon: CircleQuestionMark, blurb: "not stated" },
};

export function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/* ── Health: derived per record from its evidence and its open findings ── */

export type Health = "fail" | "warn" | "ok" | "unknown" | "off" | "on-demand";

export const HEALTH_META: Record<Health, { label: string; color: string; order: number }> = {
  fail: { label: "failing or high-severity finding", color: "var(--err)", order: 0 },
  warn: { label: "open finding", color: "var(--warn)", order: 1 },
  unknown: { label: "status unknown", color: "var(--ink-3)", order: 2 },
  ok: { label: "last run ok", color: "var(--ok)", order: 3 },
  "on-demand": { label: "on demand", color: "var(--ink-3)", order: 4 },
  off: { label: "disabled", color: "var(--ink-3)", order: 5 },
};

/** Open (unacknowledged) findings per record id. */
export function findingsByRecord(findings: Finding[]): Map<string, Finding[]> {
  const m = new Map<string, Finding[]>();
  for (const f of findings) {
    for (const id of f.ids) {
      const list = m.get(id);
      if (list) list.push(f);
      else m.set(id, [f]);
    }
  }
  return m;
}

/* ── Severity ── */

export const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
export const SEVERITY_HEALTH: Record<Severity, Health> = { high: "fail", medium: "warn", low: "unknown" };

/**
 * Status dot for one record. Acknowledged findings are the adoption baseline:
 * they show on the card but never repaint the row. An open finding paints the
 * dot by its severity (high red, medium amber, low the hollow unknown ring),
 * and a failing last run is red whether or not a finding says so.
 */
export function healthOf(r: WorkflowRecord, findings: Finding[] | undefined): Health {
  if (!r.enabled) return "off";
  if (r.evidence.lastStatus === "error") return "fail";
  const open = (findings ?? []).filter((f) => !f.acknowledged);
  if (open.length > 0) {
    const worst = open.reduce((a, b) => (SEVERITY_ORDER[b.severity] < SEVERITY_ORDER[a.severity] ? b : a));
    return SEVERITY_HEALTH[worst.severity];
  }
  if (r.trigger.kind === "on-demand") return "on-demand";
  if (r.evidence.lastStatus === "ok") return "ok";
  return "unknown";
}

/* ── Evidence in plain words ── */

export const EVIDENCE_PHRASE: Record<WorkflowRecord["evidence"]["kind"], string> = {
  "launchd-exit": "launchd's last exit code",
  "systemd-result": "systemd's last trigger time and result",
  "run-log": "the job's run log",
  "state-file": "Pulse's job state",
  "log-mtime": "the time its log last changed",
  none: "nothing records its runs",
};

/** What the page knows about the last run, as one sentence for a tooltip. */
export function lastRunNote(r: WorkflowRecord): string {
  const ev = r.evidence;
  if (ev.kind === "launchd-exit") {
    if (ev.lastStatus === "ok") return "exit 0 last time launchd ran it";
    if (ev.lastStatus === "error") return "nonzero exit last time launchd ran it";
    return "launchd has no exit status for it (not loaded)";
  }
  if (ev.kind === "none") return "no run record";
  if (!ev.lastRunAt) return `no run yet in ${EVIDENCE_PHRASE[ev.kind]}`;
  return `${clock24(ev.lastRunAt)} · ${ev.lastStatus === "unknown" ? "status unknown" : ev.lastStatus} · from ${EVIDENCE_PHRASE[ev.kind]}`;
}

/* ── Card slots ── */

export const SLOTS = ["purpose", "input", "steps", "sop", "output", "destination"] as const;
export type Slot = (typeof SLOTS)[number];

export function slotsDeclared(card: Card): number {
  return SLOTS.filter((s) => isDeclared(card, s)).length;
}

export function isDeclared(card: Card, slot: Slot): boolean {
  if (card.inferred.includes(slot)) return true;
  if (card.undeclared.includes(slot)) return false;
  if (slot === "steps") return card.steps.length > 0;
  return card[slot] != null && card[slot] !== "";
}

/* ── Time: relative for scanning, 24-hour absolute on hover ── */

/** "3h ago"; "—" when there is no time, because a missing record is not proof it never ran. */
export function relativeAgo(iso: string | null, now: number): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const ms = now - t;
  if (ms < 0) return "just now";
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = ms / 3_600_000;
  if (h < 48) return `${h < 10 ? h.toFixed(1).replace(/\.0$/, "") : Math.round(h)}h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d ago`;
  return `${Math.round(d / 30)}mo ago`;
}

/**
 * Every clock on the Workflows pages is the principal's zone, never the
 * browser's (ISC-107): the page adopts the server's configured zone (principal-tz.ts), so a laptop set to another zone still reads the principal's clock.
 * The formatting itself lives in src/lib/time.ts.
 */
const validIso = (iso: string | null): iso is string => !!iso && Number.isFinite(Date.parse(iso));

/** The principal's zone, 24-hour clock: "2026-09-24 08:05". */
export function clock24(iso: string | null): string {
  return validIso(iso) ? `${zonedDayKey(iso)} ${fmtClock(iso)}` : "—";
}

/** The principal's zone, 24-hour clock: "08:05". */
export function hhmm(iso: string | null): string {
  return validIso(iso) ? fmtClock(iso) : "—";
}

/** The principal's calendar day: "2026-09-24". */
export function dayKeyTz(iso: string): string {
  return validIso(iso) ? zonedDayKey(iso) : "—";
}

/** The principal's day header: "Thu 2026-09-24". */
export function dayLabelTz(iso: string): string {
  return validIso(iso) ? `${fmtDateParts(iso, { weekday: "short" })} ${zonedDayKey(iso)}` : "—";
}

/* ── Response-shape guard: the page trusts nothing it has not checked ── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Checks the load-bearing shape of an /api/workflows payload. Returns the
 * inventory, or a sentence naming the first thing that is wrong. Records are
 * checked field by field for what the page dereferences; a malformed record is
 * dropped and counted rather than crashing the page.
 */
export function parseInventory(raw: unknown): { ok: true; inv: Inventory; dropped: number } | { ok: false; reason: string } {
  if (!isObj(raw)) return { ok: false, reason: "the response is not a JSON object" };
  if (!Array.isArray(raw.records)) return { ok: false, reason: "the response has no records array" };
  if (!Array.isArray(raw.findings)) return { ok: false, reason: "the response has no findings array" };
  if (!isObj(raw.summary)) return { ok: false, reason: "the response has no summary" };

  const records: WorkflowRecord[] = [];
  let dropped = 0;
  for (const r of raw.records) {
    if (
      isObj(r) && typeof r.id === "string" && typeof r.runtime === "string" && r.runtime in RUNTIME_META &&
      typeof r.title === "string" && isObj(r.trigger) && isObj(r.evidence) && isObj(r.card) &&
      Array.isArray((r.card as Record<string, unknown>).steps) && Array.isArray((r.card as Record<string, unknown>).undeclared)
    ) {
      const rec = r as unknown as WorkflowRecord;
      records.push({
        ...rec,
        card: { ...rec.card, inferred: Array.isArray(rec.card.inferred) ? rec.card.inferred.filter((x): x is Slot => SLOTS.includes(x)) : [] },
        linked: Array.isArray(rec.linked) ? rec.linked.filter((x): x is string => typeof x === "string") : [],
        group: rec.group || "—",
        alsoInstalledAs: typeof rec.alsoInstalledAs === "string" && rec.alsoInstalledAs ? rec.alsoInstalledAs : undefined,
        apps: parseApps((r as Record<string, unknown>).apps),
      });
    } else {
      dropped++;
    }
  }
  const findings = (raw.findings as unknown[]).filter(
    (f): f is Finding => isObj(f) && Array.isArray(f.ids) && typeof f.sentence === "string" && typeof f.severity === "string" && f.severity in SEVERITY_ORDER,
  );
  const s = raw.summary as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const rec = (v: unknown) => (isObj(v) ? v : {});
  const byRuntimeRaw = rec(s.byRuntime);
  const mixRaw = rec(s.executorMix);
  const inv: Inventory = {
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
    records,
    findings,
    sops: Array.isArray(raw.sops) ? (raw.sops as Inventory["sops"]).filter((x) => isObj(x) && typeof x.id === "string") : [],
    summary: {
      total: num(s.total),
      byRuntime: Object.fromEntries(ALL_RUNTIMES.map((k) => [k, num(byRuntimeRaw[k])])) as Record<Runtime, number>,
      scheduled: num(s.scheduled),
      onDemand: num(s.onDemand),
      healthy: num(s.healthy),
      attention: num(s.attention),
      cardCoverage: num(s.cardCoverage),
      executorMix: Object.fromEntries(EXECUTORS.map((k) => [k, num(mixRaw[k])])) as Record<Executor, number>,
    },
    errors: Array.isArray(raw.errors)
      ? (raw.errors as unknown[]).filter((e): e is { source: string; message: string } => isObj(e) && typeof e.source === "string" && typeof e.message === "string")
      : [],
  };
  return { ok: true, inv, dropped };
}

/* ── Glyphs ── */

/** Health mark: shape carries the meaning, colour reinforces it. */
export function HealthGlyph({ health, size = 10, title }: { health: Health; size?: number; title?: string }) {
  const c = HEALTH_META[health].color;
  const label = title ?? HEALTH_META[health].label;
  const common = { width: size, height: size, viewBox: "0 0 10 10", role: "img" as const, "aria-label": label, style: { flex: "none" } as CSSProperties };
  switch (health) {
    case "fail":
      return <svg {...common}><title>{label}</title><path d="M5 0.6 9.4 5 5 9.4 0.6 5Z" fill={c} /></svg>;
    case "warn":
      return <svg {...common}><title>{label}</title><path d="M5 0.8 9.5 9H0.5Z" fill={c} /></svg>;
    case "ok":
      return <svg {...common}><title>{label}</title><circle cx="5" cy="5" r="4" fill={c} /></svg>;
    case "unknown":
      return <svg {...common}><title>{label}</title><circle cx="5" cy="5" r="3.5" fill="none" stroke={c} strokeWidth="1.4" /></svg>;
    case "on-demand":
      return <svg {...common}><title>{label}</title><circle cx="5" cy="5" r="3.5" fill="none" stroke={c} strokeWidth="1.2" strokeDasharray="1.6 1.4" /></svg>;
    case "off":
      return <svg {...common}><title>{label}</title><path d="M1.5 5h7" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>;
  }
}

export function SeverityMark({ severity }: { severity: Severity }) {
  return (
    <span className="wf-sev" data-severity={severity}>
      <HealthGlyph health={SEVERITY_HEALTH[severity]} title={`${severity} severity`} />
      <span>{severity}</span>
    </span>
  );
}

export function RuntimeSwatch({ runtime, size = 8 }: { runtime: Runtime; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, borderRadius: 2, background: RUNTIME_META[runtime].color, flex: "none", display: "inline-block" }}
    />
  );
}

/** Six tick marks, filled for each declared slot, plus the "4/6" count. */
export function Completeness({ card }: { card: Card }) {
  const n = slotsDeclared(card);
  return (
    <span className="wf-complete" title={`${n} of 6 card slots filled${card.inferred.length ? ` · ${card.inferred.length} inferred` : ""}${card.undeclared.length ? ` · missing: ${card.undeclared.join(", ")}` : ""}`}>
      <span className="wf-complete-ticks" aria-hidden>
        {SLOTS.map((s) => (
          <span key={s} data-on={isDeclared(card, s) ? "1" : "0"} />
        ))}
      </span>
      <span className="mono">{n}/6</span>
    </span>
  );
}

/** Search haystack for a record. */
export function recordHaystack(r: WorkflowRecord): string {
  return [r.title, r.name, r.group, r.card.purpose ?? "", r.definedIn, r.trigger.display, r.runtime].join(" ").toLowerCase();
}

export function matchesQuery(r: WorkflowRecord, q: string): boolean {
  if (!q) return true;
  const hay = recordHaystack(r);
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}
