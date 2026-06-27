#!/usr/bin/env bun
/**
 * AgentWatchdog.ts — Monitor script for detecting hung background agents
 *
 * Designed to run inside the Monitor tool. Watches tool-activity.jsonl for
 * silence while agents are active per subagent-starts.json.
 *
 * Emits alert lines to stdout (= Monitor notifications) when no tool calls
 * detected for THRESHOLD seconds with active agents.
 *
 * Usage (inside Monitor):
 *   Monitor({
 *     description: "Agent watchdog",
 *     persistent: true,
 *     timeout_ms: 3600000,
 *     command: "bun ${PAI_DIR}/Tools/AgentWatchdog.ts"
 *   })
 */

import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { getPaiDir } from "./lib/runtime-paths";

const PAI_DIR = getPaiDir(import.meta.dir);
const OBS_DIR = join(PAI_DIR, "MEMORY", "OBSERVABILITY");
const ACTIVITY_FILE = join(OBS_DIR, "tool-activity.jsonl");
const STARTS_FILE = join(OBS_DIR, "subagent-starts.json");

const SILENCE_THRESHOLD_S = 90;
const CHECK_INTERVAL_S = 15;
const ALERT_COOLDOWN_S = 60;

let lastAlertEpoch = 0;

function getActiveAgents(): { count: number; names: string[] } {
  try {
    if (!existsSync(STARTS_FILE)) return { count: 0, names: [] };
    const data = JSON.parse(readFileSync(STARTS_FILE, "utf-8"));
    const entries = Object.entries(data) as [string, { type: string }][];
    return {
      count: entries.length,
      names: entries.map(([id, info]) => `${info.type}(${id.slice(0, 8)})`),
    };
  } catch {
    return { count: 0, names: [] };
  }
}

function getLastActivityEpoch(): number {
  try {
    if (!existsSync(ACTIVITY_FILE)) return 0;
    return Math.floor(statSync(ACTIVITY_FILE).mtimeMs / 1000);
  } catch {
    return 0;
  }
}

function check() {
  const { count, names } = getActiveAgents();
  if (count === 0) return;

  const now = Math.floor(Date.now() / 1000);
  const lastActivity = getLastActivityEpoch();
  const silenceS = now - lastActivity;

  if (silenceS > SILENCE_THRESHOLD_S && now - lastAlertEpoch >= ALERT_COOLDOWN_S) {
    const agentList = names.length > 0 ? names.join(", ") : `${count} agent(s)`;
    console.log(
      `WATCHDOG: No tool activity for ${silenceS}s — ${agentList} may be hung. Check with TaskList or SendMessage.`
    );
    lastAlertEpoch = now;
  }
}

// Run check loop
const interval = setInterval(check, CHECK_INTERVAL_S * 1000);

// Clean shutdown
const cleanup = () => {
  clearInterval(interval);
  process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
