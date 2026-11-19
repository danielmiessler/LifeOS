// Workflows inventory source: systemd user timers in ~/.config/systemd/user (Linux).
import { join } from "node:path";
import type { Evidence, Trigger, WorkflowRecord } from "../types.ts";
import { card, cronTrigger, emptyEvidence, everySeconds, record, step } from "./shared.ts";

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const UNIT_SECONDS: Record<string, number> = { s: 1, sec: 1, m: 60, min: 60, h: 3600, hour: 3600, d: 86400, day: 86400 };

function timerEntries(text: string): Record<string, string> {
  const entries: Record<string, string> = {};
  let inTimer = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) { inTimer = trimmed === "[Timer]"; continue; }
    if (!inTimer) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!(key in entries)) entries[key] = trimmed.slice(eq + 1).trim();
  }
  return entries;
}

export function timerTrigger(text: string): Trigger {
  const entries = timerEntries(text);
  const calendar = entries.OnCalendar;
  if (calendar !== undefined) {
    if (calendar === "daily") return cronTrigger("0 0 * * *");
    if (calendar === "hourly") return cronTrigger("0 * * * *");
    if (calendar === "weekly") return cronTrigger("0 0 * * 1");
    const m = /^(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+)?\*-\*-\*\s+(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(calendar);
    if (m) return cronTrigger(`${Number(m[3])} ${Number(m[2])} * * ${m[1] ? DOW[m[1]] : "*"}`);
    return { kind: "schedule", expr: calendar, display: calendar, periodMinutes: null };
  }
  const interval = entries.OnUnitActiveSec ?? entries.OnUnitInactiveSec;
  if (interval !== undefined) {
    const m = /^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hour|d|day)?$/i.exec(interval);
    if (m) {
      const n = Number(m[1]) * (m[2] ? UNIT_SECONDS[m[2].toLowerCase()] : 1);
      return { kind: "schedule", expr: `${n}s`, display: everySeconds(n), periodMinutes: n / 60 };
    }
  }
  return { kind: "on-demand", expr: null, display: "on demand", periodMinutes: null };
}

export function parseShow(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const block of text.split(/\n[ \t]*\n/)) {
    const fields: Record<string, string> = {};
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      fields[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
    if (fields.Id) out[fields.Id] = fields;
  }
  return out;
}

function lastTriggerIso(value: string | undefined): string | null {
  if (!value || value === "n/a") return null;
  const m = /^\w{3} (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})$/.exec(value);
  if (!m) return null;
  const date = new Date(`${m[1]}T${m[2]}${m[3]}:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function collectSystemd(dir: string, timers: { name: string; text: string }[], showText: string, shown: (p: string) => string): WorkflowRecord[] {
  const show = parseShow(showText);
  return timers.map(({ name, text }) => {
    const base = name.replace(/\.timer$/, "");
    const t = show[name];
    const svc = show[`${base}.service`];
    const source = shown(join(dir, name));
    const lastRunAt = lastTriggerIso(t?.LastTriggerUSec);
    const lastStatus: Evidence["lastStatus"] = lastRunAt === null ? "unknown" : svc?.Result === "success" ? "ok" : svc?.Result ? "error" : "unknown";
    return record("systemd", base, svc?.Description || base, "systemd", timerTrigger(text), source, {
      declared: true,
      installed: t?.ActiveState === "active" ? "loaded" : "on-disk",
      enabled: t?.UnitFileState === "enabled",
      evidence: { ...emptyEvidence(), kind: "systemd-result", source, lastRunAt, lastStatus },
      card: card({ purpose: svc?.Description ?? null, steps: [step(`${base}.service`)] }),
    });
  });
}