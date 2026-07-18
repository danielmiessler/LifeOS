#!/usr/bin/env bun
/**
 * AlgorithmPhaseReport.ts — Writes algorithm state to algorithm-phase.json
 *
 * Usage:
 *   bun run AlgorithmPhaseReport.ts phase --phase OBSERVE --task "Auth rebuild" --sla Standard
 *   bun run AlgorithmPhaseReport.ts criterion --id 1 --desc "JWT rejects expired tokens" --type criterion --status pending
 *   bun run AlgorithmPhaseReport.ts criterion --id 1 --status completed --evidence "Tests pass"
 *   bun run AlgorithmPhaseReport.ts agent --name engineer-1 --type Engineer --status active --task "JWT middleware"
 *   bun run AlgorithmPhaseReport.ts capabilities --list "Task Tool,Engineer Agents,Skills"
 *   bun run AlgorithmPhaseReport.ts config --preset dream --focus 0.25 --mode ideate
 *   bun run AlgorithmPhaseReport.ts config --params '{"selectionPressure":0.3,"stepSize":0.5}'
 *   bun run AlgorithmPhaseReport.ts meta-adjust --param selectionPressure --from 0.3 --to 0.45 --cycle 2 --rationale "Ideas converging too slowly"
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { parseArgs } from "util";
import { claudeDir } from "./lifeos-root";

const STATE_DIR = join(claudeDir(), "LIFEOS", "MEMORY", "STATE");
const STATE_FILE = join(STATE_DIR, "algorithm-phase.json");

interface AlgorithmState {
  active: boolean;
  sessionId: string;
  taskDescription: string;
  currentPhase: string;
  phaseStartedAt: number;
  algorithmStartedAt: number;
  sla: string;
  criteria: Array<{
    id: string;
    description: string;
    type: string;
    status: string;
    evidence?: string;
    createdInPhase: string;
  }>;
  agents: Array<{
    name: string;
    agentType: string;
    status: string;
    task?: string;
    phase: string;
  }>;
  capabilities: string[];
  prdPath?: string;
  phaseHistory: Array<{
    phase: string;
    startedAt: number;
    completedAt?: number;
    criteriaCount: number;
    agentCount: number;
  }>;
  qualityGate?: Record<string, boolean>;
  algorithmConfig?: {
    preset: string | null;
    focus: number | null;
    params: Record<string, number | string>;
    mode: string;
    lockedParams?: string[];
  };
  metaLearnerAdjustments?: Array<{
    cycle: number;
    parameter: string;
    previousValue: number;
    newValue: number;
    rationale: string;
  }>;
}

function readState(): AlgorithmState {
  try {
    const raw = readFileSync(STATE_FILE, "utf-8").trim();
    if (!raw || raw === "{}") throw new Error("empty");
    return JSON.parse(raw);
  } catch {
    return {
      active: false,
      sessionId: "",
      taskDescription: "",
      currentPhase: "IDLE",
      phaseStartedAt: Date.now(),
      algorithmStartedAt: Date.now(),
      sla: "Standard",
      criteria: [],
      agents: [],
      capabilities: [],
      phaseHistory: [],
    };
  }
}

function writeState(state: AlgorithmState): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // Silent on error — non-blocking
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

try {
  const [command, ...rest] = process.argv.slice(2);

  if (!command) {
    console.log("Usage: AlgorithmPhaseReport.ts <phase|criterion|agent|capabilities|config|meta-adjust> [options]");
    process.exit(0);
  }

  const state = readState();

  switch (command) {
    case "phase": {
      const phase = getArg(rest, "--phase");
      const task = getArg(rest, "--task");
      const sla = getArg(rest, "--sla");
      const sessionId = getArg(rest, "--session");
      const prdPath = getArg(rest, "--prd");

      if (!phase) {
        console.error("--phase required");
        process.exit(1);
      }

      // Close previous phase in history
      if (state.currentPhase && state.currentPhase !== "IDLE" && state.currentPhase !== phase) {
        const prevEntry = state.phaseHistory.find(
          (h) => h.phase === state.currentPhase && !h.completedAt
        );
        if (prevEntry) {
          prevEntry.completedAt = Date.now();
          prevEntry.criteriaCount = state.criteria.length;
          prevEntry.agentCount = state.agents.length;
        }
      }

      state.active = phase !== "IDLE" && phase !== "COMPLETE";
      state.currentPhase = phase;
      state.phaseStartedAt = Date.now();

      if (task) state.taskDescription = task;
      if (sla) state.sla = sla;
      if (sessionId) state.sessionId = sessionId;
      if (prdPath) state.prdPath = prdPath;

      if (!state.algorithmStartedAt || phase === "OBSERVE") {
        state.algorithmStartedAt = Date.now();
      }

      // Add to phase history
      state.phaseHistory.push({
        phase,
        startedAt: Date.now(),
        criteriaCount: state.criteria.length,
        agentCount: state.agents.length,
      });

      break;
    }

    case "criterion": {
      const id = getArg(rest, "--id");
      const desc = getArg(rest, "--desc");
      const type = getArg(rest, "--type");
      const status = getArg(rest, "--status");
      const evidence = getArg(rest, "--evidence");

      if (!id) {
        console.error("--id required");
        process.exit(1);
      }

      const existing = state.criteria.find((c) => c.id === id);
      if (existing) {
        if (desc) existing.description = desc;
        if (type) existing.type = type;
        if (status) existing.status = status;
        if (evidence) existing.evidence = evidence;
      } else {
        state.criteria.push({
          id,
          description: desc ?? "",
          type: type ?? "criterion",
          status: status ?? "pending",
          evidence,
          createdInPhase: state.currentPhase,
        });
      }
      break;
    }

    case "agent": {
      const name = getArg(rest, "--name");
      const agentType = getArg(rest, "--type");
      const status = getArg(rest, "--status");
      const task = getArg(rest, "--task");

      if (!name) {
        console.error("--name required");
        process.exit(1);
      }

      const existing = state.agents.find((a) => a.name === name);
      if (existing) {
        if (agentType) existing.agentType = agentType;
        if (status) existing.status = status;
        if (task) existing.task = task;
        existing.phase = state.currentPhase;
      } else {
        state.agents.push({
          name,
          agentType: agentType ?? "general-purpose",
          status: status ?? "active",
          task,
          phase: state.currentPhase,
        });
      }
      break;
    }

    case "capabilities": {
      const list = getArg(rest, "--list");
      if (list) {
        state.capabilities = list.split(",").map((s) => s.trim());
      }
      break;
    }

    case "config": {
      const preset = getArg(rest, "--preset");
      const focusStr = getArg(rest, "--focus");
      const mode = getArg(rest, "--mode");
      const paramsJson = getArg(rest, "--params");

      if (!state.algorithmConfig) {
        state.algorithmConfig = {
          preset: null,
          focus: null,
          params: {},
          mode: "standard",
        };
      }

      if (preset !== undefined) state.algorithmConfig.preset = preset;
      if (focusStr !== undefined) state.algorithmConfig.focus = parseFloat(focusStr);
      if (mode) state.algorithmConfig.mode = mode;

      if (paramsJson) {
        try {
          const parsed = JSON.parse(paramsJson);
          state.algorithmConfig.params = { ...state.algorithmConfig.params, ...parsed };
        } catch {
          console.error("Invalid JSON for --params");
          process.exit(1);
        }
      }
      break;
    }

    case "meta-adjust": {
      const param = getArg(rest, "--param");
      const fromStr = getArg(rest, "--from");
      const toStr = getArg(rest, "--to");
      const cycleStr = getArg(rest, "--cycle");
      const rationale = getArg(rest, "--rationale");

      if (!param || fromStr === undefined || toStr === undefined || !cycleStr) {
        console.error("--param, --from, --to, and --cycle are required");
        process.exit(1);
      }

      if (!state.metaLearnerAdjustments) {
        state.metaLearnerAdjustments = [];
      }

      state.metaLearnerAdjustments.push({
        cycle: parseInt(cycleStr, 10),
        parameter: param,
        previousValue: parseFloat(fromStr),
        newValue: parseFloat(toStr),
        rationale: rationale ?? "",
      });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }

  writeState(state);
} catch {
  // Silent on error — non-blocking
}
