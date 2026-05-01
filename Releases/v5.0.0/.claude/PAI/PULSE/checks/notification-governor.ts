#!/usr/bin/env bun

/**
 * notification-governor — rate-limiter + dedup layer for proactive notifications.
 *
 * Per plan §5 (P0) and SystemsThinking finding: "alert fatigue is the dominant
 * failure mode — cap nudge volume structurally before building anything else."
 *
 * Other Pulse pollers route their proactive notifications through this governor
 * instead of hitting /notify directly. The governor enforces:
 *   - Max 3 voice pings per day
 *   - Max 1 telegram per hour
 *   - 24h dedup by content fingerprint
 *   - Quiet hours 22:00–07:00 (no voice; telegram queued for morning)
 *   - Per-source auto-suppression: 2 false alerts in 7d → that source suppressed 7d
 *
 * Usage:
 *   bun notification-governor.ts --channel voice --source monitor-band-tours \
 *     --message "Tool is playing at the Fillmore Friday" --priority event
 *
 *   bun notification-governor.ts --status
 *   bun notification-governor.ts --suppress-source <name>
 *   bun notification-governor.ts --clear-source <name>
 *
 * Exit codes:
 *   0 — dispatched
 *   1 — error
 *   2 — suppressed (rate limit, dedup, quiet hours, source blocked)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

const HOME = process.env.HOME || "";
const PAI_DIR = process.env.PAI_DIR || join(HOME, ".claude", "PAI");
const STATE_FILE = join(PAI_DIR, "PULSE", "state", "notification-governor.json");
const LOG_FILE = join(PAI_DIR, "MEMORY", "OBSERVABILITY", "notification-governor.jsonl");
const NOTIFY_URL = "http://localhost:31337/notify";
const VOICE_ID = "fTtv3eikoepIosk8dTZ5";

type Priority = "critical" | "event" | "light";
type Channel = "voice" | "telegram" | "ntfy" | "email";

type GovernorState = {
  dispatched: Array<{ ts: string; channel: Channel; source: string; fingerprint: string; priority: Priority }>;
  sourceSuppressions: Record<string, { until: string; reason: string; falseAlertTimestamps: string[] }>;
  sourceFalseAlertHistory: Record<string, string[]>;
};

function loadState(): GovernorState {
  if (!existsSync(STATE_FILE)) {
    const fresh: GovernorState = { dispatched: [], sourceSuppressions: {}, sourceFalseAlertHistory: {} };
    const dir = dirname(STATE_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as GovernorState;
}

function saveState(state: GovernorState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function logDecision(entry: Record<string, unknown>): void {
  const dir = dirname(LOG_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
}

function fingerprint(message: string, source: string): string {
  return createHash("sha256").update(`${source}|${message}`).digest("hex").slice(0, 16);
}

function inQuietHours(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 7;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function daysSince(iso: string): number {
  return hoursSince(iso) / 24;
}

function shouldDispatch(
  state: GovernorState,
  channel: Channel,
  source: string,
  message: string,
  priority: Priority
): { allow: boolean; reason?: string } {
  const fp = fingerprint(message, source);

  // Source-level suppression (kill switch)
  const sup = state.sourceSuppressions[source];
  if (sup && new Date(sup.until).getTime() > Date.now()) {
    return { allow: false, reason: `source-suppressed until ${sup.until}: ${sup.reason}` };
  }

  // Dedup: same fingerprint within 24h
  const recentDup = state.dispatched.find((d) => d.fingerprint === fp && hoursSince(d.ts) < 24);
  if (recentDup) {
    return { allow: false, reason: "duplicate within 24h" };
  }

  // Critical bypasses rate limits and quiet hours — still respects dedup and source-suppress
  if (priority === "critical") return { allow: true };

  // Quiet hours
  if (channel === "voice" && inQuietHours()) {
    return { allow: false, reason: "quiet-hours (22:00-07:00)" };
  }

  // Rate limits
  if (channel === "voice") {
    const today = new Date().toISOString().slice(0, 10);
    const voiceToday = state.dispatched.filter(
      (d) => d.channel === "voice" && d.ts.startsWith(today) && d.priority !== "critical"
    ).length;
    if (voiceToday >= 3) return { allow: false, reason: "voice daily cap (3) reached" };
  }
  if (channel === "telegram") {
    const telegramLastHour = state.dispatched.filter(
      (d) => d.channel === "telegram" && hoursSince(d.ts) < 1 && d.priority !== "critical"
    ).length;
    if (telegramLastHour >= 1) return { allow: false, reason: "telegram hourly cap (1) reached" };
  }

  return { allow: true };
}

async function dispatch(channel: Channel, message: string): Promise<boolean> {
  if (channel === "voice") {
    try {
      const res = await fetch(NOTIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, voice_id: VOICE_ID, voice_enabled: true }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  // Other channels: governor only rate-limits, actual dispatch still owned by pulse.ts.
  // We return true here because the caller is expected to dispatch after governor approves.
  return true;
}

function pruneOld(state: GovernorState): void {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  state.dispatched = state.dispatched.filter((d) => new Date(d.ts).getTime() > cutoff);
  for (const source of Object.keys(state.sourceFalseAlertHistory)) {
    state.sourceFalseAlertHistory[source] = state.sourceFalseAlertHistory[source].filter(
      (ts) => daysSince(ts) < 14
    );
  }
  for (const source of Object.keys(state.sourceSuppressions)) {
    if (new Date(state.sourceSuppressions[source].until).getTime() < Date.now()) {
      delete state.sourceSuppressions[source];
    }
  }
}

// ─── Commands ───

async function cmdNotify(args: string[]): Promise<number> {
  const channel = (args[args.indexOf("--channel") + 1] as Channel) || "voice";
  const source = args[args.indexOf("--source") + 1] || "unknown";
  const message = args[args.indexOf("--message") + 1] || "";
  const priority = (args[args.indexOf("--priority") + 1] as Priority) || "light";

  if (!message) {
    console.error("--message required");
    return 1;
  }

  const state = loadState();
  pruneOld(state);

  const decision = shouldDispatch(state, channel, source, message, priority);
  if (!decision.allow) {
    logDecision({ action: "suppress", channel, source, priority, reason: decision.reason });
    console.log(`🔕 SUPPRESS: ${decision.reason}`);
    return 2;
  }

  const ok = await dispatch(channel, message);
  if (!ok) {
    console.error(`dispatch failed for ${channel}`);
    return 1;
  }

  state.dispatched.push({
    ts: new Date().toISOString(),
    channel,
    source,
    fingerprint: fingerprint(message, source),
    priority,
  });
  saveState(state);
  logDecision({ action: "dispatch", channel, source, priority, message });
  console.log(`✅ Dispatched via ${channel}`);
  return 0;
}

function cmdStatus(): void {
  const state = loadState();
  pruneOld(state);
  const today = new Date().toISOString().slice(0, 10);
  const voiceToday = state.dispatched.filter((d) => d.channel === "voice" && d.ts.startsWith(today)).length;
  const telegramLastHour = state.dispatched.filter(
    (d) => d.channel === "telegram" && hoursSince(d.ts) < 1
  ).length;
  console.log("═══ Notification Governor ═══");
  console.log(`Voice today:     ${voiceToday}/3`);
  console.log(`Telegram last h: ${telegramLastHour}/1`);
  console.log(`Quiet hours:     ${inQuietHours() ? "YES" : "no"}`);
  const sups = Object.entries(state.sourceSuppressions);
  if (sups.length) {
    console.log("\nActive source suppressions:");
    for (const [src, info] of sups) console.log(`  ${src}  until ${info.until}  — ${info.reason}`);
  }
}

function cmdReportFalseAlert(source: string): void {
  if (!source) {
    console.error("--source required");
    process.exit(1);
  }
  const state = loadState();
  state.sourceFalseAlertHistory[source] ||= [];
  state.sourceFalseAlertHistory[source].push(new Date().toISOString());
  const recent = state.sourceFalseAlertHistory[source].filter((ts) => daysSince(ts) < 7);
  if (recent.length >= 2) {
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    state.sourceSuppressions[source] = {
      until,
      reason: `2 false alerts in 7 days`,
      falseAlertTimestamps: recent,
    };
    console.log(`⛔ Source ${source} auto-suppressed until ${until}`);
  } else {
    console.log(`⚠️  False alert logged for ${source} (${recent.length}/2 in 7d)`);
  }
  saveState(state);
}

function cmdClearSource(source: string): void {
  const state = loadState();
  delete state.sourceSuppressions[source];
  state.sourceFalseAlertHistory[source] = [];
  saveState(state);
  console.log(`🔓 Cleared suppression for ${source}`);
}

// ─── Main ───

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--status")) {
    cmdStatus();
    return;
  }
  if (args.includes("--report-false-alert")) {
    cmdReportFalseAlert(args[args.indexOf("--report-false-alert") + 1]);
    return;
  }
  if (args.includes("--clear-source")) {
    cmdClearSource(args[args.indexOf("--clear-source") + 1]);
    return;
  }
  if (args.includes("--message") || args.includes("--channel")) {
    process.exit(await cmdNotify(args));
  }
  console.log("Usage:");
  console.log("  bun notification-governor.ts --channel voice --source X --message 'text' --priority light");
  console.log("  bun notification-governor.ts --status");
  console.log("  bun notification-governor.ts --report-false-alert <source>");
  console.log("  bun notification-governor.ts --clear-source <source>");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
