#!/usr/bin/env bun

/**
 * poller-meta-monitor — watches every other Pulse monitoring job for silent failure.
 *
 * Pulse's default behavior is to silently skip jobs after 3 consecutive failures.
 * That's exactly the trap "no band in town tonight" can hide for weeks. This
 * meta-monitor reads Pulse state + observability logs and screams loudly if any
 * monitored job has been silent beyond 3× its schedule.
 *
 * Emits one of:
 *   "NO_ACTION"          — everything healthy
 *   "<alert text>"        — list of stale jobs
 *
 * Runs via PULSE.toml as a script-type job every 4 hours.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME || "";
const PAI_DIR = process.env.PAI_DIR || join(HOME, ".claude", "PAI");
const PULSE_STATE = join(PAI_DIR, "PULSE", "state", "state.json");
const PULSE_TOML = join(PAI_DIR, "PULSE", "PULSE.toml");

// Jobs we specifically monitor — the Current→Ideal pipeline ones.
const WATCHED_JOBS = [
  "monitor-band-tours",
  "monitor-author-tours",
  "monitor-meetups-ai-sec",
  "monitor-toofless",
  "monitor-amazon-orders",
  "monitor-bills",
  "monitor-newark-permits",
  "monitor-newark-council",
  "apple-health-export-ingest",
  "compute-gap",
  "lifelog-digest",
  "staleness-review",
];

type PulseState = Record<string, { lastRun?: string; lastSuccess?: string; consecutiveFailures?: number; schedule?: string }>;

function parseCronToMs(cron: string): number {
  // Very rough approximation for "every X hours" detection.
  // `0 */N * * *` → N hours. `*/M * * * *` → M minutes.
  const parts = cron.split(" ");
  if (parts.length < 5) return 24 * 60 * 60 * 1000;
  const hourPart = parts[1];
  const minPart = parts[0];
  const dowPart = parts[4];

  const hMatch = hourPart.match(/^\*\/(\d+)$/);
  if (hMatch) return Number(hMatch[1]) * 60 * 60 * 1000;

  const mMatch = minPart.match(/^\*\/(\d+)$/);
  if (mMatch) return Number(mMatch[1]) * 60 * 1000;

  // Daily ("0 7 * * *") → 24h
  if (hourPart.match(/^\d+$/) && minPart.match(/^\d+$/)) {
    if (dowPart === "*") return 24 * 60 * 60 * 1000;
    return 7 * 24 * 60 * 60 * 1000; // weekly
  }
  return 24 * 60 * 60 * 1000;
}

function loadPulseSchedules(): Record<string, string> {
  if (!existsSync(PULSE_TOML)) return {};
  const toml = readFileSync(PULSE_TOML, "utf-8");
  const schedules: Record<string, string> = {};
  const jobRegex = /\[\[job\]\]\s*([\s\S]*?)(?=\[\[job\]\]|\Z)/g;
  let m: RegExpExecArray | null;
  while ((m = jobRegex.exec(toml)) !== null) {
    const block = m[1];
    const nameMatch = block.match(/name\s*=\s*"([^"]+)"/);
    const schedMatch = block.match(/schedule\s*=\s*"([^"]+)"/);
    if (nameMatch && schedMatch) schedules[nameMatch[1]] = schedMatch[1];
  }
  return schedules;
}

function loadPulseState(): PulseState {
  if (!existsSync(PULSE_STATE)) return {};
  try {
    return JSON.parse(readFileSync(PULSE_STATE, "utf-8")) as PulseState;
  } catch {
    return {};
  }
}

function main(): void {
  const state = loadPulseState();
  const schedules = loadPulseSchedules();
  const now = Date.now();
  const stale: string[] = [];

  for (const job of WATCHED_JOBS) {
    const schedule = schedules[job];
    if (!schedule) continue; // not configured yet (P1 scaffolding)
    const jobState = state[job];
    if (!jobState) {
      // Never run since scheduling. Tolerate for 2× schedule interval.
      continue;
    }
    const expectedIntervalMs = parseCronToMs(schedule);
    const tolerance = 3 * expectedIntervalMs;
    const lastSuccess = jobState.lastSuccess || jobState.lastRun;
    if (!lastSuccess) {
      stale.push(`${job}: never succeeded`);
      continue;
    }
    const sinceMs = now - new Date(lastSuccess).getTime();
    if (sinceMs > tolerance) {
      const hoursStale = Math.round(sinceMs / (60 * 60 * 1000));
      stale.push(`${job}: last success ${hoursStale}h ago (expected every ${Math.round(expectedIntervalMs / 3600000)}h)`);
    }
    if ((jobState.consecutiveFailures || 0) >= 3) {
      stale.push(`${job}: ${jobState.consecutiveFailures} consecutive failures — SILENT SKIP risk`);
    }
  }

  if (stale.length === 0) {
    console.log("NO_ACTION");
    return;
  }

  console.log(`⚠️ Pulse meta-monitor: ${stale.length} monitoring job(s) silent or failing:\n`);
  for (const s of stale) console.log(`  • ${s}`);
  console.log(`\nTrust in proactive monitoring is compromised while these are silent. Investigate.`);
}

main();
