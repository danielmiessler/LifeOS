"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useAlgorithmState } from "@/hooks/useAlgorithmState";
import { localOnlyApiCall } from "@/lib/local-api";
import { AnimatePresence, motion } from "framer-motion";
import type { AlgorithmCriterion, CompletedWork, ReworkCycle, SessionMode } from "@/types/algorithm";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AlgorithmState, AlgorithmPhase } from "@/types/algorithm";
import QuickPulseStrip from "./QuickPulseStrip";
import SessionCard from "./SessionCard";
import CompletedSessionRow from "./CompletedSessionRow";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import { resolveEffortTier, TIER_TEXT_CLASSES, EFFORT_TIERS } from "@/lib/effort-tier";
import {
  Eye,
  Brain,
  ClipboardList,
  Hammer,
  Zap,
  CheckCircle2,
  BookOpen,
  ChevronRight,
  Loader2,
  Repeat,
  Clock,
  RefreshCw,
  Play,
  Pause,
  Square,
  Target,
  Activity,
  Check,
  Terminal,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

// ─── Effort Level Colors ───

// ─── Phase Config ───

const PHASE_META: Record<
  string,
  { icon: LucideIcon; color: string; label: string; narrative: string }
> = {
  OBSERVE: {
    icon: Eye,
    color: "#7dcfff",
    label: "Observe",
    narrative: "Building ISC criteria from the request",
  },
  THINK: {
    icon: Brain,
    color: "#bb9af7",
    label: "Think",
    narrative: "Analyzing edge cases and complexity",
  },
  PLAN: {
    icon: ClipboardList,
    color: "#7aa2f7",
    label: "Plan",
    narrative: "Choosing execution strategy",
  },
  BUILD: {
    icon: Hammer,
    color: "#ff9e64",
    label: "Build",
    narrative: "Creating artifacts",
  },
  EXECUTE: {
    icon: Zap,
    color: "#9ece6a",
    label: "Execute",
    narrative: "Running the work",
  },
  VERIFY: {
    icon: CheckCircle2,
    color: "#73daca",
    label: "Verify",
    narrative: "Testing ISC criteria with evidence",
  },
  LEARN: {
    icon: BookOpen,
    color: "#e0af68",
    label: "Learn",
    narrative: "Capturing insights",
  },
  COMPLETE: {
    icon: CheckCircle2,
    color: "#73daca",
    label: "Complete",
    narrative: "All criteria verified",
  },
  ACTIVE: {
    icon: Activity,
    color: "#c0caf5",
    label: "Active",
    narrative: "Session is actively working",
  },
  IDLE: {
    icon: Eye,
    color: "#565f89",
    label: "Idle",
    narrative: "Waiting",
  },
  NATIVE: {
    icon: Terminal,
    color: "#9ece6a",
    label: "Native",
    narrative: "Direct execution",
  },
  STARTING: {
    icon: Loader2,
    color: "#7aa2f7",
    label: "Starting",
    narrative: "Initializing algorithm...",
  },
};

const ALGORITHM_PHASES: { icon: LucideIcon; name: string; color: string; description: string }[] = [
  {
    icon: Eye,
    name: "Observe",
    color: "#7dcfff",
    description: "Reverse-engineer the request into Ideal State Criteria \u2014 granular, binary, testable conditions that define success and failure.",
  },
  {
    icon: Brain,
    name: "Think",
    color: "#bb9af7",
    description: "Analyze edge cases, dependencies, and complexity. Evolve criteria. Decide which capabilities to invoke from the full PAI toolkit.",
  },
  {
    icon: ClipboardList,
    name: "Plan",
    color: "#7aa2f7",
    description: "Choose execution strategy. Evaluate parallelization. Partition independent criteria across agents or plan sequential execution.",
  },
  {
    icon: Hammer,
    name: "Build",
    color: "#ff9e64",
    description: "Create artifacts: code, content, infrastructure. Document non-obvious decisions. Discover new requirements as they emerge.",
  },
  {
    icon: Zap,
    name: "Execute",
    color: "#9ece6a",
    description: "Deploy capabilities. Run skills, spawn agents, execute the plan. Edge cases discovered here become new criteria.",
  },
  {
    icon: CheckCircle2,
    name: "Verify",
    color: "#73daca",
    description: "The culmination. Every ISC criterion tested against evidence. Binary YES/NO with proof. This is where hill-climbing happens.",
  },
  {
    icon: BookOpen,
    name: "Learn",
    color: "#e0af68",
    description: "Capture insights. What worked, what didn\u2019t, what to improve. Update the ISA with final state and session context for next iteration.",
  },
];

// ─── Types ───

interface CriterionItem {
  id: string;
  text: string;
  passing: boolean;
}

interface ISAFrontmatter {
  id: string;
  status: string;
  created: string;
  updated: string;
  iteration: number;
  maxIterations: number;
  loopStatus: string | null;
  parent: string | null;
}

interface LogEntry {
  title: string;
  content: string;
}

interface ISASummary {
  path: string;
  filename: string;
  frontmatter: ISAFrontmatter;
  title: string;
  oneLiner: string;
  criteria: CriterionItem[];
  totalCriteria: number;
  passingCriteria: number;
  problem: string;
  approach: string;
  statusTable: Record<string, string>;
  logEntries: LogEntry[];
  lastLogEntry: string;
}

type WorkItemType = "interactive" | "loop";

interface UnifiedWorkItem {
  id: string;
  type: WorkItemType;
  title: string;
  summary: string;
  phase: AlgorithmPhase;
  phaseColor: string;
  criteriaTotal: number;
  criteriaPassing: number;
  isComplete: boolean;
  isActive: boolean;
  startedAt?: number;
  // Loop-specific
  iteration?: number;
  maxIterations?: number;
  loopStatus?: string | null;
  updatedAgo?: string;
  // Raw data for expanded views
  algorithmState?: AlgorithmState;
  isaSummary?: ISASummary;
}

// ─── Helpers ───

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return "";
  }
}

function prdStatusToPhase(status: string, loopStatus: string | null): AlgorithmPhase {
  if (status === "COMPLETE") return "COMPLETE";
  if (loopStatus === "running") return "EXECUTE";
  if (loopStatus === "paused") return "IDLE";
  // IN_PROGRESS with no active loop = idle (not actively being worked on)
  return "IDLE";
}

// ─── Active progress bullets ───

function getProgressBullets(item: UnifiedWorkItem): string[] {
  const state = item.algorithmState;
  if (!state) return [];
  const bullets: string[] = [];
  const currentIdx = PHASE_ORDER.indexOf(state.currentPhase);

  // For each completed phase, build a summary bullet
  for (const entry of state.phaseHistory || []) {
    const phaseIdx = PHASE_ORDER.indexOf(entry.phase);
    if (phaseIdx >= currentIdx) continue; // skip current/future
    const meta = PHASE_META[entry.phase];
    const label = meta?.label || entry.phase;
    const duration = entry.completedAt
      ? formatElapsed(entry.completedAt - entry.startedAt)
      : "";
    const criteriaInPhase = state.criteria?.filter(
      (c: any) => c.createdInPhase === entry.phase
    ).length ?? 0;
    const agentCount = entry.agentCount ?? 0;

    let detail = `${label}`;
    const parts: string[] = [];
    if (criteriaInPhase > 0) parts.push(`${criteriaInPhase} criteria`);
    if (agentCount > 0) parts.push(`${agentCount} agent${agentCount > 1 ? "s" : ""}`);
    if (duration) parts.push(duration);
    if (parts.length > 0) detail += ` — ${parts.join(", ")}`;
    bullets.push(detail);
  }

  // Current phase bullet
  const currentMeta = PHASE_META[state.currentPhase];
  if (currentMeta) {
    const elapsed = formatElapsed(Date.now() - (state.phaseStartedAt || Date.now()));
    const pendingCriteria = state.criteria?.filter(
      (c: any) => c.status === "pending" || c.status === "in_progress"
    ).length ?? 0;
    let currentDetail = `${currentMeta.label} (active, ${elapsed})`;
    if (pendingCriteria > 0) currentDetail += ` — ${pendingCriteria} criteria in progress`;
    bullets.push(currentDetail);
  }

  // ISC summary if criteria exist
  const total = state.criteria?.length ?? 0;
  const passing = state.criteria?.filter((c: any) => c.status === "completed").length ?? 0;
  if (total > 0) {
    bullets.push(`ISC: ${passing}/${total} criteria passing`);
  }

  return bullets.slice(0, 6);
}

// ─── Phase Bar (labeled blocks with active summary) ───

const PHASE_ORDER: AlgorithmPhase[] = ["OBSERVE", "THINK", "PLAN", "BUILD", "EXECUTE", "VERIFY", "LEARN"];

// ─── Phase description helper ───

function getPhaseDescription(phase: AlgorithmPhase, item: UnifiedWorkItem): string[] {
  const state = item.algorithmState;
  const currentIdx = PHASE_ORDER.indexOf(item.phase);
  const thisIdx = PHASE_ORDER.indexOf(phase);
  const isComplete = item.phase === "COMPLETE";
  const isCurrent = phase === item.phase && !isComplete;
  const isPast = isComplete || thisIdx < currentIdx;
  const meta = PHASE_META[phase];

  if (isCurrent && state) {
    const lines: string[] = [];
    const elapsed = formatElapsed(Date.now() - (state.phaseStartedAt || Date.now()));
    lines.push(`Active · ${elapsed}`);
    // Show live phaseNarrative from the current phase history entry if available
    const currentEntry = state.phaseHistory?.find((h) => h.phase === phase && !h.completedAt);
    if (currentEntry?.phaseNarrative) {
      lines.push(currentEntry.phaseNarrative);
    } else {
      lines.push(meta?.narrative ?? "Working...");
    }
    const pendingCriteria = state.criteria?.filter(
      (c: any) => c.status === "pending" || c.status === "in_progress"
    ) ?? [];
    const completedCriteria = state.criteria?.filter(
      (c: any) => c.status === "completed"
    ) ?? [];
    if (pendingCriteria.length > 0) {
      lines.push(`${pendingCriteria.length} criteria in progress:`);
      pendingCriteria.forEach((c: any) => {
        const status = c.status === "in_progress" ? "⟳" : "○";
        const desc = c.subject || c.description || "";
        if (desc) lines.push(`${status} ${desc}`);
      });
    }
    if (completedCriteria.length > 0) {
      lines.push(`${completedCriteria.length} criteria passing:`);
      completedCriteria.forEach((c: any) => {
        const desc = c.subject || c.description || "";
        if (desc) lines.push(`✓ ${desc}`);
      });
    }
    const agents = state.agents?.filter((a: any) => a.status === "active") ?? [];
    if (agents.length > 0) {
      lines.push(`${agents.length} active agent${agents.length > 1 ? "s" : ""}:`);
      agents.forEach((a: any) => {
        lines.push(`⬡ ${a.name} (${a.agentType})${a.task ? ` — ${a.task}` : ""}`);
      });
    }
    const idleAgents = state.agents?.filter((a: any) => a.status === "idle") ?? [];
    if (idleAgents.length > 0) lines.push(`${idleAgents.length} agent${idleAgents.length > 1 ? "s" : ""} idle`);
    if (state.capabilities?.length > 0) lines.push(`Capabilities: ${state.capabilities.join(", ")}`);
    return lines.slice(0, 16);
  }

  if (isPast && state) {
    const entry = state.phaseHistory?.find((h) => h.phase === phase);
    const phaseCriteria = state.criteria?.filter((c: any) => c.createdInPhase === phase) ?? [];
    const lines: string[] = [];

    if (entry?.completedAt) {
      lines.push(`Done · ${formatElapsed(entry.completedAt - entry.startedAt)}`);
    } else {
      lines.push("Done");
    }
    // Show phaseNarrative if available, otherwise fall back to static narrative
    if (entry?.phaseNarrative) {
      lines.push(entry.phaseNarrative);
    } else {
      lines.push(meta?.narrative ?? "Completed");
    }
    if (phaseCriteria.length > 0) {
      const passed = phaseCriteria.filter((c: any) => c.status === "completed").length;
      const failed = phaseCriteria.filter((c: any) => c.status === "failed").length;
      lines.push(`${phaseCriteria.length} criteria created${passed > 0 ? `, ${passed} passing` : ""}${failed > 0 ? `, ${failed} failed` : ""}:`);
      phaseCriteria.forEach((c: any) => {
        const status = c.status === "completed" ? "✓" : c.status === "failed" ? "✗" : "○";
        const desc = c.subject || c.description || "";
        if (desc) lines.push(`${status} ${desc}`);
      });
    }
    if ((entry?.agentCount ?? 0) > 0) {
      lines.push(`${entry!.agentCount} agent${entry!.agentCount > 1 ? "s" : ""} used`);
    }
    const phaseAgents = state.agents?.filter((a: any) => a.phase === phase) ?? [];
    if (phaseAgents.length > 0) {
      phaseAgents.forEach((a: any) => {
        lines.push(`⬡ ${a.name} (${a.agentType})${a.task ? ` — ${a.task}` : ""}`);
      });
    }
    // Show task context in Observe column when no criteria were created
    if (phase === "OBSERVE" && phaseCriteria.length === 0 && (state.rawTask || state.taskDescription)) {
      lines.push(state.rawTask || state.taskDescription || "");
    }
    if (lines.length <= 2) lines.push(meta?.narrative ?? "Completed");
    return lines.slice(0, 16);
  }

  if (isPast) return ["Done"];
  return [meta?.narrative ?? ""];
}

// ─── Phase Grid (equal-width blocks spanning full page width) ───

function PhaseGrid({ item }: { item: UnifiedWorkItem }) {
  const currentIdx = PHASE_ORDER.indexOf(item.phase);
  const isComplete = item.phase === "COMPLETE";
  const state = item.algorithmState;
  const isVirtual = (state as any)?._virtual === true || (item.phase as string) === "ACTIVE";
  const totalCriteria = state?.criteria?.length ?? item.criteriaTotal;
  const passingCriteria = state?.criteria?.filter((c: any) => c.status === "completed").length ?? item.criteriaPassing;
  const failedCriteria = state?.criteria?.filter((c: any) => c.status === "failed").length ?? 0;

  // Virtual entries — show compact active indicator instead of empty phase grid
  if (isVirtual) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-sm text-zinc-500">Active session — awaiting phase data</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Rework indicator in phase grid — icon + count */}
      {(state?.reworkCount ?? 0) > 0 && (
        <div className="flex items-center gap-1 mb-1">
          <RotateCcw className={`w-3.5 h-3.5 ${state?.isRework ? "text-amber-400 animate-pulse" : "text-amber-400/60"}`} />
          <span className={`text-sm font-bold font-mono ${state?.isRework ? "text-amber-400" : "text-amber-400/60"}`}>
            {state!.reworkCount}
          </span>
        </div>
      )}

      {/* ISC Progress bar for active items */}
      {item.isActive && totalCriteria > 0 && (
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-400 shrink-0" />
          <span className="text-base text-zinc-400 font-medium">ISC</span>
          <span className="text-base font-mono text-zinc-300">
            {passingCriteria}
            <span className="text-zinc-600">/{totalCriteria}</span>
            {failedCriteria > 0 && <span className="text-red-400 ml-1">({failedCriteria} failed)</span>}
          </span>
          <div className="flex-1 max-w-32">
            <Progress
              value={totalCriteria > 0 ? (passingCriteria / totalCriteria) * 100 : 0}
              className="h-1.5 [&>div]:bg-blue-400"
            />
          </div>
          {state?.qualityGate && (
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
              state.qualityGate.open
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}>
              {state.qualityGate.open ? "GATE OPEN" : "GATE BLOCKED"}
            </span>
          )}
        </div>
      )}

      {/* Compaction indicator for collapsed view */}
      {(state?.compactionEvents?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-amber-400/50 text-xs">&#x27F3;</span>
          <span className="text-xs text-amber-400/40">
            {state!.compactionEvents!.length} compaction{state!.compactionEvents!.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Phase blocks */}
      <div className="grid grid-cols-7 gap-1 w-full">
        {PHASE_ORDER.map((phase, i) => {
          const isCurrent = phase === item.phase && !isComplete;
          const isPast = isComplete || i < currentIdx;
          const meta = PHASE_META[phase];
          const color = meta?.color ?? "#565f89";
          const Icon = meta?.icon ?? Eye;
          const descLines = getPhaseDescription(phase, item);
          // Check if this phase was visited during a rework cycle (only when rework has occurred)
          const isReworkPhase = (state?.reworkCount ?? 0) > 0 &&
            state?.phaseHistory?.some?.((e: any) => e.phase === phase && e.isRework === true) === true;

          // Tooltip data: gather rich info for the hover card
          const entry = state?.phaseHistory?.find((h) => h.phase === phase);
          const phaseCriteria = state?.criteria?.filter((c: any) => c.createdInPhase === phase) ?? [];
          const phaseAgents = state?.agents?.filter((a: any) => a.phase === phase) ?? [];
          const passedInPhase = phaseCriteria.filter((c: any) => c.status === "completed").length;
          const failedInPhase = phaseCriteria.filter((c: any) => c.status === "failed").length;
          const hasTooltipData = (isPast || isCurrent) && (entry || phaseCriteria.length > 0 || phaseAgents.length > 0);

          return (
            <div key={phase} className="group/phase relative">
              <div
                className="flex flex-col px-2 py-2 rounded min-w-0 overflow-y-auto"
                style={{
                  maxHeight: isCurrent ? "240px" : isPast ? "180px" : "120px",
                  backgroundColor: isCurrent ? `${color}18` : isPast ? `${color}08` : "rgba(255,255,255,0.015)",
                  borderBottom: isCurrent ? `2px solid ${color}` : isPast ? `2px solid ${color}30` : "2px solid transparent",
                  ...(isCurrent ? { boxShadow: `0 0 12px ${color}10` } : {}),
                }}
              >
                <div className="flex items-center gap-1 shrink-0 mb-1">
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{
                      color: isCurrent ? color : isPast ? `${color}70` : "rgba(255,255,255,0.15)",
                    }}
                  />
                  <span
                    className="text-sm font-bold tracking-wider"
                    style={{
                      color: isCurrent ? color : isPast ? `${color}70` : "rgba(255,255,255,0.15)",
                    }}
                  >
                    {meta?.label?.toUpperCase()}
                  </span>
                  {isReworkPhase && (isPast || isCurrent) && (
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400/70 shrink-0 ml-auto" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  {descLines.map((line, li) => (
                    <span
                      key={li}
                      className={`text-sm leading-[18px] min-w-0 ${li === 0 ? "font-medium" : ""} ${line.startsWith("→") ? "pl-1" : ""}`}
                      style={{
                        color: isCurrent
                          ? li === 0 ? color : `${color}bb`
                          : isPast
                          ? li === 0 ? `${color}80` : `${color}50`
                          : "rgba(255,255,255,0.06)",
                      }}
                    >
                      {line}
                    </span>
                  ))}
                </div>
              </div>

              {/* Phase hover tooltip */}
              {hasTooltipData && (
                <div className="absolute z-10 hidden group-hover/phase:block bottom-full left-0 mb-2 w-64 p-3 rounded-lg bg-zinc-900 border border-white/[0.08] shadow-xl pointer-events-none">
                  <div className="text-xs space-y-1.5">
                    {/* Phase name + duration */}
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4" style={{ color }} />
                      <span className="font-semibold text-zinc-200" style={{ color }}>{meta?.label}</span>
                      {entry?.completedAt && (
                        <span className="ml-auto font-mono text-zinc-400">
                          {formatElapsed(entry.completedAt - entry.startedAt)}
                        </span>
                      )}
                      {isCurrent && state && (
                        <span className="ml-auto font-mono text-zinc-400">
                          {formatElapsed(Date.now() - (state.phaseStartedAt || Date.now()))}
                        </span>
                      )}
                    </div>

                    {/* Phase narrative */}
                    {entry?.phaseNarrative && (
                      <p className="text-zinc-400 leading-relaxed italic">{entry.phaseNarrative}</p>
                    )}

                    {/* Criteria summary */}
                    {phaseCriteria.length > 0 && (
                      <div className="text-zinc-400">
                        Criteria:{" "}
                        <span className="text-emerald-400 font-medium">{passedInPhase}</span>
                        {failedInPhase > 0 && (
                          <><span className="text-zinc-600"> / </span><span className="text-red-400 font-medium">{failedInPhase} failed</span></>
                        )}
                        <span className="text-zinc-600"> / </span>
                        <span className="text-zinc-300">{phaseCriteria.length} total</span>
                      </div>
                    )}

                    {/* Agents in this phase */}
                    {phaseAgents.length > 0 && (
                      <div className="text-zinc-400">
                        <span className="text-zinc-500">Agents:</span>{" "}
                        <span className="text-zinc-300">{phaseAgents.map((a: any) => `${a.name} (${a.agentType})`).join(", ")}</span>
                      </div>
                    )}
                    {/* Fallback: show agentCount from history entry */}
                    {phaseAgents.length === 0 && (entry?.agentCount ?? 0) > 0 && (
                      <div className="text-zinc-400">
                        Agents: <span className="text-zinc-300">{entry!.agentCount} used</span>
                      </div>
                    )}

                    {/* Capabilities (show session capabilities for active phase) */}
                    {isCurrent && (state?.capabilities?.length ?? 0) > 0 && (
                      <div className="text-zinc-400">
                        <span className="text-zinc-500">Capabilities:</span>{" "}
                        <span className="text-zinc-300">{state!.capabilities.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Expanded: Interactive (full-width phase columns with detail) ───

function InteractiveExpandedView({ item }: { item: UnifiedWorkItem }) {
  const state = item.algorithmState;
  if (!state) return null;

  const isVirtual = (state as any)._virtual === true;
  const currentIdx = PHASE_ORDER.indexOf(state.currentPhase);
  const isComplete = state.currentPhase === "COMPLETE";

  // Virtual entries (from working tabs) — show compact active indicator
  if (isVirtual || (state.currentPhase as string) === "ACTIVE") {
    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="overflow-hidden border-b border-white/[0.06]"
      >
        <div className="flex items-center gap-3 p-6 text-zinc-400">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-sm">Session is actively working — phase tracking starts on next algorithm cycle</span>
        </div>
      </motion.div>
    );
  }

  // Compaction markers positioned between phases
  const compactionTimes = state.compactionEvents || [];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="overflow-hidden border-b border-white/[0.06]"
    >
      {/* Previous work history (collapsed) */}
      {state.workHistory && state.workHistory.length > 0 && (
        <div className="px-4 py-2 border-b border-white/[0.04] bg-indigo-500/[0.03]">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400/60" />
            <span className="text-xs font-medium text-indigo-400/80 uppercase tracking-wider">
              Previous Work ({state.workHistory.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {state.workHistory.map((prev: CompletedWork, idx: number) => {
              const prevPassing = prev.criteria.filter(c => c.status === "completed").length;
              const prevTotal = prev.criteria.length;
              return (
                <div key={idx} className="flex items-center gap-3 px-2 py-1.5 rounded bg-white/[0.02]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500/60 shrink-0" />
                  <span className="text-sm text-zinc-400 truncate flex-1">
                    {prev.taskDescription}
                  </span>
                  <span className="text-xs font-mono text-zinc-500 shrink-0">
                    {prevPassing}/{prevTotal}
                  </span>
                  {prev.summary && (
                    <span className="text-xs text-zinc-600 truncate max-w-48">
                      {prev.summary}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rework history */}
      {state.reworkHistory && state.reworkHistory.length > 0 && (
        <div className="px-4 py-2 border-b border-white/[0.04] bg-amber-500/[0.03]">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-3.5 h-3.5 text-amber-400/60" />
            <span className="text-xs font-medium text-amber-400/80 uppercase tracking-wider">
              Rework History ({state.reworkHistory.length} cycle{state.reworkHistory.length > 1 ? "s" : ""})
            </span>
            {state.isRework && (
              <span className="text-xs text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20 ml-auto">
                Currently Rework #{state.reworkCount}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {state.reworkHistory.map((cycle: ReworkCycle, idx: number) => {
              const cyclePassing = cycle.criteria.filter((c: AlgorithmCriterion) => c.status === "completed").length;
              const cycleTotal = cycle.criteria.length;
              const cycleDuration = formatElapsed(cycle.completedAt - cycle.startedAt);
              const phaseNames = cycle.phaseHistory.map((h) => {
                const meta = PHASE_META[h.phase];
                return meta?.label || h.phase;
              });
              return (
                <div key={idx} className="flex items-center gap-3 px-2 py-1.5 rounded bg-white/[0.02]">
                  <span className="text-xs font-mono text-amber-400/60 shrink-0 w-5">
                    #{cycle.iteration}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {cycle.phaseHistory.map((h, hi) => {
                      const pMeta = PHASE_META[h.phase];
                      const PIcon = pMeta?.icon ?? Eye;
                      return (
                        <PIcon
                          key={hi}
                          className="w-3 h-3"
                          style={{ color: `${pMeta?.color ?? '#565f89'}80` }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono text-zinc-500 shrink-0">
                    {cyclePassing}/{cycleTotal}
                  </span>
                  <span className="text-xs text-zinc-600 font-mono shrink-0">
                    {cycleDuration}
                  </span>
                  {cycle.summary && (
                    <span className="text-xs text-zinc-600 truncate max-w-48">
                      {cycle.summary}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compaction events banner */}
      {compactionTimes.length > 0 && (
        <div className="px-4 py-1.5 border-b border-white/[0.04] bg-amber-500/[0.03] flex items-center gap-2">
          <span className="text-amber-400/70 text-sm">&#x27F3;</span>
          <span className="text-xs text-amber-400/60">
            {compactionTimes.length} context compaction{compactionTimes.length > 1 ? "s" : ""} during this session
          </span>
          <span className="text-xs text-zinc-600 ml-auto font-mono">
            {compactionTimes.map(t => {
              const d = new Date(t);
              return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            }).join(", ")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1.5 p-3" style={{ minHeight: "260px", maxHeight: "480px" }}>
        {PHASE_ORDER.map((phase, i) => {
          const isCurrent = phase === state.currentPhase && !isComplete;
          const isPast = isComplete || i < currentIdx;
          const isFuture = !isCurrent && !isPast;
          const meta = PHASE_META[phase];
          const color = meta?.color ?? "#565f89";
          const Icon = meta?.icon ?? Eye;

          // Criteria for this column
          let columnCriteria: AlgorithmCriterion[] = [];
          if (phase === "VERIFY") {
            columnCriteria = state.criteria.filter(
              (c) => c.status === "completed" || c.status === "failed"
            );
          } else if (phase === state.currentPhase) {
            columnCriteria = state.criteria.filter(
              (c) => c.status === "pending" || c.status === "in_progress"
            );
          } else {
            columnCriteria = state.criteria.filter((c) => c.createdInPhase === phase);
          }

          const histEntry = state.phaseHistory.find((h) => h.phase === phase);
          const phaseAgents = state.agents.filter((a) => a.phase === phase);

          return (
            <div
              key={phase}
              className={`flex flex-col min-w-0 rounded-lg border ${
                isFuture ? "opacity-30" : isPast ? "opacity-70" : ""
              }`}
              style={{
                borderColor: isCurrent
                  ? `${color}60`
                  : isPast
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.04)",
                backgroundColor: isCurrent
                  ? `${color}0a`
                  : isPast
                  ? "rgba(255,255,255,0.015)"
                  : "rgba(255,255,255,0.01)",
                ...(isCurrent
                  ? { boxShadow: `0 0 20px ${color}20, inset 0 0 20px ${color}05` }
                  : {}),
              }}
            >
              {/* Column header */}
              <div className="flex items-center gap-1.5 px-2.5 py-2.5 border-b border-white/[0.04]">
                <Icon className="w-5 h-5 shrink-0" style={{ color }} />
                <span
                  className="text-sm font-bold truncate"
                  style={{ color: isCurrent ? color : undefined }}
                >
                  {meta?.label}
                </span>
                {isPast && !isCurrent && (
                  <CheckCircle2 className="w-3 h-3 text-zinc-600 ml-auto shrink-0" />
                )}
                {columnCriteria.length > 0 && (
                  <span className="text-xs text-zinc-500 ml-auto bg-white/[0.06] px-1.5 py-0.5 rounded shrink-0">
                    {columnCriteria.length}
                  </span>
                )}
              </div>

              {/* Narrative */}
              <div className="px-2.5 py-2 border-b border-white/[0.03]">
                <p
                  className={`text-sm leading-relaxed ${
                    isCurrent ? "text-zinc-400" : isPast ? "text-zinc-600" : "text-zinc-700"
                  }`}
                >
                  {meta?.narrative}
                </p>
              </div>

              {/* Timing */}
              {histEntry && (
                <div className="px-2.5 py-1.5 border-b border-white/[0.03] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <span className="text-xs text-zinc-600 font-mono">
                    {histEntry.completedAt
                      ? formatElapsed(histEntry.completedAt - histEntry.startedAt)
                      : `${formatElapsed(Date.now() - histEntry.startedAt)}\u2026`}
                  </span>
                </div>
              )}

              {/* Task context for Observe column when no criteria */}
              {phase === "OBSERVE" && columnCriteria.length === 0 && (state.rawTask || state.taskDescription) && (
                <div className="px-2.5 py-2">
                  <p className="text-xs text-zinc-500 leading-relaxed italic line-clamp-4">
                    {state.rawTask || state.taskDescription}
                  </p>
                </div>
              )}

              {/* Criteria cards */}
              <div className="flex flex-col gap-2 p-2.5 flex-1 overflow-y-auto">
                {columnCriteria.map((c) => {
                  const isAnti = c.type === "anti-criterion";
                  return (
                    <div
                      key={c.id}
                      className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-2"
                      title={c.evidence ?? undefined}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            c.status === "completed"
                              ? "bg-emerald-500"
                              : c.status === "in_progress"
                              ? "bg-blue-500 animate-pulse"
                              : c.status === "failed"
                              ? "bg-red-500"
                              : "bg-zinc-500"
                          }`}
                        />
                        <span
                          className={`text-xs font-bold ${
                            isAnti ? "text-red-400" : "text-blue-400"
                          }`}
                        >
                          {isAnti ? "A" : "C"}
                          {c.id}
                        </span>
                        {c.status === "completed" && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />
                        )}
                      </div>
                      <p className="text-sm text-zinc-300 leading-snug">{c.description}</p>
                      {c.evidence && (
                        <p className="text-xs text-zinc-500 mt-1.5 leading-snug italic line-clamp-3">
                          {c.evidence}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Agents */}
              {phaseAgents.length > 0 && (
                <div className="px-2.5 py-2 border-t border-white/[0.04] space-y-1">
                  {phaseAgents.map((a) => (
                    <div
                      key={a.name}
                      className="text-xs text-zinc-500 flex items-center gap-1.5"
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          a.status === "active" ? "bg-blue-500 animate-pulse" : "bg-zinc-600"
                        }`}
                      />
                      <span className="truncate">{a.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Type Badge ───

function TypeBadge({ type, isWorker }: { type: WorkItemType; isWorker?: boolean }) {
  if (isWorker) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-500/15 text-sky-400 border border-sky-500/20 shrink-0">
        <Zap className="w-3 h-3" />
        Worker
      </span>
    );
  }
  if (type === "interactive") {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-blue-500/15 text-blue-400 border-blue-500/20 shrink-0">
        <Terminal className="w-3 h-3" />
        Interactive
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-purple-500/15 text-purple-400 border-purple-500/20 shrink-0">
      <Repeat className="w-3 h-3" />
      Loop
    </span>
  );
}

// ─── Worker Expanded View ───

function WorkerExpandedView({ item }: { item: UnifiedWorkItem }) {
  const state = item.algorithmState;
  if (!state) return null;

  // Parse currentAction: "391 messages | $11.62 | claude-sonnet-4-5-20250929"
  const parts = (state.currentAction || "").split(" | ");
  const msgCount = parts[0] || "0 messages";
  const cost = parts[1] || "$0.00";
  const model = parts[2] || "unknown";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="overflow-hidden border-b border-sky-500/10"
    >
      <div className="px-6 py-4 bg-gradient-to-r from-sky-950/30 via-cyan-950/20 to-transparent">
        {/* Stats row */}
        <div className="flex items-center gap-6 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-medium text-sky-300">{msgCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Cost</span>
            <span className="text-sm font-mono text-emerald-400">{cost}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Model</span>
            <span className="text-sm font-mono text-zinc-300">{model}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Origin</span>
            <span className="flex items-center gap-1 text-sm text-sky-400">
              <Zap className="w-3.5 h-3.5" /> Telegram
            </span>
          </div>
          {state.algorithmStartedAt && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-sm font-mono text-zinc-400">
                {formatElapsed(Date.now() - state.algorithmStartedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Capabilities */}
        <div className="flex items-center gap-2">
          {(state.capabilities || []).map((cap) => (
            <span key={cap} className="px-2 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-400/70 border border-sky-500/15">
              {cap}
            </span>
          ))}
        </div>

        {/* Summary if completed */}
        {state.summary && (
          <p className="mt-3 text-xs text-zinc-500 leading-relaxed italic">
            {state.summary}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Running Indicator ───

function RunningIndicator() {
  return (
    <div className="flex items-end gap-[2px] h-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full bg-blue-400"
          animate={{ height: ["3px", "12px", "3px"] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ─── Unified Work Row ───

function WorkRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: UnifiedWorkItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const phaseMeta = PHASE_META[item.phase] || PHASE_META.IDLE;
  const progressPct = item.criteriaTotal > 0 ? (item.criteriaPassing / item.criteriaTotal) * 100 : 0;
  const isWorker = item.algorithmState?.sessionId?.startsWith("worker-") ?? false;
  const isNative = item.algorithmState?.mode === "native" || (item.phase as string) === "NATIVE";
  const isStarting = item.algorithmState?.mode === "starting" || (item.phase as string) === "STARTING";

  // Parse worker metrics from currentAction
  const workerParts = isWorker ? (item.algorithmState?.currentAction || "").split(" | ") : [];
  const workerMsgCount = workerParts[0] || "";
  const workerCost = workerParts[1] || "";

  // Compact one-line rendering for starting algorithm sessions (transient, before ISA)
  if (isStarting && item.isActive && !item.isComplete) {
    return (
      <div
        className="w-full max-w-full px-4 py-1 flex items-center gap-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors text-left overflow-hidden"
      >
        <Loader2 className="w-3.5 h-3.5 text-blue-400/70 shrink-0 animate-spin" />
        <span className="text-sm font-medium uppercase tracking-wide text-blue-400/80 truncate flex-1">
          {item.title}
        </span>
        <span className="text-xs text-zinc-600 shrink-0 tabular-nums">
          {item.startedAt ? formatElapsed(Date.now() - item.startedAt) : ""}
        </span>
      </div>
    );
  }

  // Enhanced rendering for native mode items — show task context + activity pulse
  if (isNative && item.isActive && !item.isComplete) {
    const rawTask = item.algorithmState?.rawTask || "";
    const hasTask = rawTask.length > 0 && rawTask !== item.title;
    return (
      <div
        className="w-full max-w-full px-4 py-2 flex flex-col gap-1 border-b border-amber-500/10 hover:bg-amber-500/[0.03] transition-colors text-left overflow-hidden"
      >
        <div className="flex items-center gap-2">
          {/* Pulsing activity dot */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <Terminal className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
          <span className="text-sm font-bold uppercase tracking-wide text-amber-500 truncate flex-1">
            {item.title}
          </span>
          <span className="text-xs text-amber-500/50 shrink-0 tabular-nums font-mono">
            {item.startedAt ? formatElapsed(Date.now() - item.startedAt) : ""}
          </span>
        </div>
        {hasTask && (
          <p className="text-xs text-zinc-500 truncate pl-[30px]">
            {rawTask.length > 120 ? rawTask.slice(0, 120) + "…" : rawTask}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      className={`w-full max-w-full px-4 py-2 flex flex-col gap-1.5 border-b hover:bg-white/[0.02] transition-colors text-left overflow-hidden ${
        isWorker
          ? "border-sky-500/15 bg-gradient-to-r from-sky-950/20 via-cyan-950/10 to-transparent border-l-2 border-l-sky-400/60"
          : item.isActive && !item.isComplete
          ? "border-white/[0.06] bg-white/[0.01]"
          : item.isComplete
          ? "border-white/[0.03] opacity-50"
          : "border-white/[0.04]"
      }`}
    >
      {/* Line 1: Title + metadata */}
      <div className="flex items-center gap-2.5 w-full min-w-0">
        {/* Expand chevron */}
        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }} className="shrink-0">
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </motion.div>

        {/* Status indicator */}
        {item.isActive && !item.isComplete ? (
          isWorker ? (
            <Zap className="w-4 h-4 text-sky-400 shrink-0" />
          ) : isNative ? (
            <Terminal className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
          )
        ) : item.isComplete ? (
          <CheckCircle2 className="w-4 h-4 text-zinc-600 shrink-0" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
        )}

        {/* Title: session name (ALL CAPS) | current action for active */}
        <div className="flex items-baseline gap-2 flex-1 min-w-0 overflow-hidden">
          <span className={`text-lg font-bold uppercase tracking-wide truncate ${
            isWorker && item.isActive
              ? "bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent"
              : isNative && item.isActive
              ? "text-amber-500"
              : item.isActive
              ? "bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent"
              : item.isComplete
              ? "text-zinc-500"
              : "text-zinc-200"
          }`}>
            {item.title}
          </span>
          {/* Name rejuvenation arrow — shows previous name when session was renamed on rework */}
          {item.algorithmState?.previousNames && item.algorithmState.previousNames.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-400/60 truncate whitespace-nowrap" title={`Previously: ${item.algorithmState.previousNames.map((p: {name: string}) => p.name).join(' → ')}`}>
              <span className="text-amber-400/40">←</span>
              <span className="italic">{item.algorithmState.previousNames[item.algorithmState.previousNames.length - 1].name}</span>
            </span>
          )}
          {item.algorithmState?.currentAction && item.isActive && !item.isComplete && !isWorker && !isNative && (
            <span className="text-xs text-zinc-500 truncate whitespace-nowrap">
              | {item.algorithmState.currentAction}
            </span>
          )}
        </div>

        {/* Worker: show message count + cost instead of effort level/criteria */}
        {isWorker ? (
          <>
            <TypeBadge type={item.type} isWorker />
            {workerMsgCount && (
              <span className="flex items-center gap-1 text-xs font-mono text-sky-400/80">
                <Activity className="w-3 h-3" />
                {workerMsgCount}
              </span>
            )}
            {workerCost && (
              <span className="text-xs font-mono text-emerald-400/80">
                {workerCost}
              </span>
            )}
          </>
        ) : isNative ? (
          <>
            {/* Native: no criteria, just a subtle badge */}
          </>
        ) : (
          <>
            {/* Criteria progress */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-zinc-400">
                {item.criteriaPassing}
                <span className="text-zinc-600">/{item.criteriaTotal}</span>
              </span>
              <div className="w-14">
                <Progress
                  value={progressPct}
                  className={`h-1.5 ${
                    item.isComplete
                      ? "[&>div]:bg-emerald-500"
                      : item.isActive
                      ? "[&>div]:bg-blue-400"
                      : "[&>div]:bg-zinc-600"
                  }`}
                />
              </div>
            </div>

            {/* Loop iterations */}
            {item.type === "loop" && item.iteration !== undefined && (
              <div className="flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                <Repeat className="w-3 h-3" />
                <span className="font-mono">
                  {item.iteration}
                  <span className="text-zinc-700">/</span>
                  {item.maxIterations}
                </span>
              </div>
            )}

            {/* Work history count badge */}
            {item.algorithmState?.workHistory && item.algorithmState.workHistory.length > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <RefreshCw className="w-2.5 h-2.5" />
                {item.algorithmState.workHistory.length + 1}
              </span>
            )}

            {/* Rework badge — icon + count only */}
            {(item.algorithmState?.reworkCount ?? 0) > 0 && (
              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold border shrink-0 ${
                item.algorithmState?.isRework
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/25 animate-pulse"
                  : "bg-amber-500/10 text-amber-400/70 border-amber-500/20"
              }`}>
                <RotateCcw className="w-3.5 h-3.5" />
                {item.algorithmState!.reworkCount}
              </span>
            )}
          </>
        )}

        {/* Elapsed */}
        <span className="text-xs text-zinc-600 shrink-0 tabular-nums w-14 text-right">
          {item.type === "interactive" && item.startedAt
            ? formatElapsed(Date.now() - item.startedAt)
            : item.updatedAgo || ""}
        </span>
      </div>

      {/* Line 2: Metadata bar — effort levels + mode (active non-complete Algorithm sessions only) */}
      {!isWorker && !isNative && item.isActive && !item.isComplete && item.algorithmState?.currentPhase !== "COMPLETE" && item.algorithmState?.currentPhase !== "IDLE" && (
        <div className="pl-[26px] flex items-center gap-3">
          {/* Effort level scale — all levels shown, active one colored */}
          <div className="flex items-center gap-1.5">
            {(() => {
              const resolved = resolveEffortTier(item.algorithmState?.effortLevel || item.algorithmState?.sla);
              return EFFORT_TIERS.map((tier) => {
                const isActive = resolved.tier === tier;
                return (
                  <Fragment key={tier}>
                    <span
                      className={`text-xs font-medium uppercase tracking-wide transition-colors ${
                        isActive ? `${TIER_TEXT_CLASSES[tier]} font-bold` : "text-zinc-700"
                      }`}
                    >
                      {tier}
                    </span>
                  </Fragment>
                );
              });
            })()}
          </div>

          <span className="text-zinc-700 text-xs">|</span>

          {/* Mode — Interactive / Loop */}
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium uppercase tracking-wide ${
              item.type === "interactive" ? "text-blue-400 font-bold" : "text-zinc-700"
            }`}>
              Interactive
            </span>
            <span className={`text-xs font-medium uppercase tracking-wide ${
              item.type === "loop" ? "text-cyan-400 font-bold" : "text-zinc-700"
            }`}>
              Loop
            </span>
          </div>

          {item.type === "loop" && item.loopStatus === "running" && (
            <>
              <span className="text-zinc-700 text-xs">|</span>
              <RunningIndicator />
            </>
          )}
        </div>
      )}

      {/* Line 3: Phase grid for Algorithm sessions, compact indicator for native/workers */}
      <div className="pl-[26px]">
        {isWorker ? (
          item.isActive ? (
            <div className="flex items-center gap-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-xs text-sky-400/60">Active conversation via Telegram</span>
            </div>
          ) : item.summary ? (
            <span className="text-xs text-zinc-500 truncate block">{item.summary}</span>
          ) : null
        ) : isNative ? (
          <div className="flex flex-col gap-0.5 py-0.5">
            {item.isActive && !item.isComplete && item.algorithmState?.currentAction && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-xs text-emerald-400/80 font-mono truncate">
                  {item.algorithmState.currentAction}
                </span>
              </div>
            )}
            {item.algorithmState?.rawTask && (
              <span className={`text-xs truncate ${item.isActive ? "text-zinc-500" : "text-zinc-600"}`}>
                {item.algorithmState.rawTask}
              </span>
            )}
          </div>
        ) : item.type === "interactive" && item.algorithmState && item.isActive && !item.isComplete ? (
          <PhaseGrid item={item} />
        ) : item.summary ? (
          <span className="text-xs text-zinc-500 truncate block">{item.summary}</span>
        ) : null}
      </div>
    </button>
  );
}

// (AlgorithmExpandedView replaced by InteractiveExpandedView above)

// ─── Expanded: Loop (ISA) ───

function LoopExpandedView({
  isa,
  onAction,
  actionLoading,
}: {
  isa: ISASummary;
  onAction: (action: string, filename: string) => void;
  actionLoading: string | null;
}) {
  const { frontmatter, criteria, totalCriteria, passingCriteria } = isa;
  const isComplete = frontmatter.status === "COMPLETE";
  const isRunning = frontmatter.loopStatus === "running";
  const isPaused = frontmatter.loopStatus === "paused";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="overflow-hidden border-b border-white/[0.06]"
    >
      {/* Control Bar */}
      <div className="px-4 py-2 flex items-center gap-2 border-b border-white/[0.04]">
        {!isComplete && !isRunning && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction("start", isa.filename); }}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            {actionLoading === "start" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Start Loop
          </button>
        )}
        {isRunning && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction("pause", isa.filename); }}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            <Pause className="w-3 h-3" />
            Pause
          </button>
        )}
        {isPaused && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction("resume", isa.filename); }}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            Resume
          </button>
        )}
        {(isRunning || isPaused) && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction("stop", isa.filename); }}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <Square className="w-3 h-3" />
            Stop
          </button>
        )}

        {isa.statusTable && Object.keys(isa.statusTable).length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {Object.entries(isa.statusTable).slice(0, 4).map(([key, value]) => (
              <span key={key} className="text-xs font-mono text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded">
                {key}: <span className="text-zinc-400">{value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Problem + Approach */}
      {(isa.problem || isa.approach) && (
        <div className="px-4 py-3 space-y-3 border-b border-white/[0.04]">
          {isa.problem && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-zinc-600" />
                <span className="text-xs text-zinc-600 uppercase tracking-wider font-medium">Problem</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed pl-[18px]">{isa.problem}</p>
            </div>
          )}
          {isa.approach && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-zinc-600" />
                <span className="text-xs text-zinc-600 uppercase tracking-wider font-medium">Approach</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed pl-[18px]">{isa.approach}</p>
            </div>
          )}
        </div>
      )}

      {/* Criteria + Log split */}
      <div className="grid grid-cols-2 divide-x divide-white/[0.04]">
        {/* Criteria */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-3">
            <BookOpen className="w-3 h-3 text-zinc-600" />
            <span className="text-xs text-zinc-600 uppercase tracking-wider font-medium">Criteria</span>
            <span className="text-xs font-mono text-zinc-600 ml-auto">
              {passingCriteria}/{totalCriteria}
            </span>
          </div>
          <div className="space-y-1">
            {criteria.map((c) => (
              <div
                key={c.id}
                className={`flex items-start gap-2.5 py-1 px-2 rounded-md transition-colors ${
                  c.passing ? "bg-emerald-500/[0.04]" : "hover:bg-white/[0.02]"
                }`}
              >
                <div
                  className={`shrink-0 w-4 h-4 rounded mt-0.5 flex items-center justify-center ${
                    c.passing
                      ? "bg-emerald-500/20 border border-emerald-500/40"
                      : "bg-zinc-800 border border-zinc-700"
                  }`}
                >
                  {c.passing && <Check className="w-2.5 h-2.5 text-emerald-400" strokeWidth={3} />}
                </div>
                <span className={`text-sm leading-relaxed ${c.passing ? "text-zinc-300" : "text-zinc-500"}`}>
                  <span className="font-mono text-xs text-zinc-600 mr-1.5">{c.id}</span>
                  {c.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Log */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-3">
            <Activity className="w-3 h-3 text-zinc-600" />
            <span className="text-xs text-zinc-600 uppercase tracking-wider font-medium">Activity Log</span>
          </div>
          {isa.logEntries && isa.logEntries.length > 0 ? (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-800" />
              <div className="space-y-3">
                {isa.logEntries.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 relative">
                    <div
                      className={`shrink-0 w-[15px] h-[15px] rounded-full border-2 mt-0.5 z-10 ${
                        i === 0 ? "bg-blue-500/20 border-blue-400" : "bg-zinc-900 border-zinc-700"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-300 leading-snug">{entry.title}</p>
                      {entry.content && (
                        <p className="text-xs text-zinc-500 leading-relaxed mt-0.5 line-clamp-2">{entry.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : isa.lastLogEntry ? (
            <pre className="text-sm text-zinc-500 whitespace-pre-wrap leading-relaxed font-mono px-2">
              {isa.lastLogEntry}
            </pre>
          ) : (
            <p className="text-sm text-zinc-600 italic px-2">No log entries yet</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Idle State Educational Content ───

function IdleContent() {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div className="px-6 pt-5">
        <EmptyStateGuide
          section="Algorithm Activity"
          description="The Algorithm runs Observe → Think → Plan → Build → Execute → Verify → Learn against your work. ISC criteria, phase progress, and PRDs land here once you start using it."
          hideInterview
          daPromptExample="run the Algorithm on my next task"
        />
      </div>
      <div className="px-6 py-5 border-b border-white/[0.04]">
        <h2 className="text-lg font-bold text-zinc-300 mb-1">The PAI Algorithm</h2>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-2xl">
          A 7-phase scientific loop that hill-climbs from current state to ideal state.
          Every task is decomposed into Ideal State Criteria (ISC) {"\u2014"} granular, binary, testable conditions
          that become the verification criteria. No ambiguity. No hand-waving. Just evidence.
        </p>
      </div>
      <div className="flex-1 px-6 py-4">
        <div className="grid grid-cols-7 gap-3 h-full">
          {ALGORITHM_PHASES.map((phase) => {
            const Icon = phase.icon;
            return (
              <div
                key={phase.name}
                className="flex flex-col rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 opacity-50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5" style={{ color: phase.color }} />
                  <span className="text-sm font-semibold" style={{ color: phase.color }}>
                    {phase.name}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed flex-1">{phase.description}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-6 py-3 border-t border-white/[0.04] text-center">
        <p className="text-sm text-zinc-600">
          Waiting for algorithm runs or loops. Active work will appear as rows above.
        </p>
      </div>
    </div>
  );
}

// ─── Main Unified Work Dashboard ───

// ─── Filter types ───

type ActivityFilter = "all" | "algorithm" | "native" | "active" | "completed";

const FILTER_OPTIONS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "algorithm", label: "Algorithm" },
  { value: "native", label: "Native" },
  { value: "active", label: "Active Only" },
  { value: "completed", label: "Completed" },
];

function resolveSessionMode(state: AlgorithmState): SessionMode {
  if (state.currentMode) return state.currentMode;
  if (state.mode === "native") return "native";
  if (state.mode === "interactive" || state.mode === "starting") return "algorithm";
  if (state.criteria?.length > 0 || state.phaseHistory?.length > 0) return "algorithm";
  return "native";
}

export default function UnifiedWorkDashboard() {
  const { algorithmStates, pulseStrip, isLoading: algoLoading } = useAlgorithmState();
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  // ISA/Loop state
  const [prds, setISAs] = useState<ISASummary[]>([]);
  const [prdLoading, setPrdLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loopStarting, setLoopStarting] = useState(false);

  const fetchISAs = useCallback(async () => {
    try {
      const data = await localOnlyApiCall<{ prds?: ISASummary[] }>("/api/loops");
      setISAs(data.prds || []);
    } catch {
      // Silently fail — ISAs optional
    } finally {
      setPrdLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchISAs();
    const interval = setInterval(fetchISAs, 2000); // 2s refresh for responsive phase visualization
    return () => clearInterval(interval);
  }, [fetchISAs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = useCallback(
    async (action: string, filename: string) => {
      setActionLoading(action);
      try {
        await localOnlyApiCall("/api/loops/control", {
          method: "POST",
          body: JSON.stringify({ action, prdFile: filename }),
        });
        setTimeout(fetchISAs, 1000);
      } catch (e) {
        console.error("Loop action failed:", e);
      } finally {
        setActionLoading(null);
      }
    },
    [fetchISAs]
  );

  const handleLoopStart = useCallback(async () => {
    setLoopStarting(true);
    try {
      const data = await localOnlyApiCall<{ error?: string }>("/api/loops/start", { method: "POST", body: JSON.stringify({}) });
      if (data.error === 'cancelled') { /* user cancelled the dialog */ }
    } catch (e) {
      console.error("Loop start failed:", e);
    } finally {
      setLoopStarting(false);
    }
  }, []);

  // Unify data sources into common items
  const unifiedItems: UnifiedWorkItem[] = useMemo(() => {
    const items: UnifiedWorkItem[] = [];

    // Interactive algorithm runs
    for (const state of algorithmStates) {
      const phaseMeta = PHASE_META[state.currentPhase] || PHASE_META.IDLE;
      const completedCount = state.criteria?.filter((c: any) => c.status === "completed").length ?? 0;
      const displayStatus = (state as any)._displayStatus || 'active';
      // COMPLETE/LEARN phase = finished work, even if active flag is stale
      const isComplete = !!state.completedAt || state.currentPhase === "COMPLETE" || state.currentPhase === "LEARN";
      const isActive = state.active === true && !isComplete;

      // Skip abandoned sessions
      if ((state as any).abandoned === true) continue;

      items.push({
        id: `algo-${state.sessionId}`,
        type: "interactive",
        title: (state.taskDescription && !/^(algorithm\s*run|starting\.{0,3})$/i.test(state.taskDescription) ? state.taskDescription.replace(/^\[Telegram\]\s*/, '') : null)
          || state.sessionId?.slice(0, 8) || "Session",
        summary: isComplete
          ? ((state as any).summary || (() => {
              const phaseCount = state.phaseHistory?.length ?? 0;
              const criteriaCount = state.criteria?.length ?? 0;
              const passCount = state.criteria?.filter((c: any) => c.status === "completed").length ?? 0;
              if (criteriaCount > 0) return `${passCount}/${criteriaCount} criteria passed across ${phaseCount} phases`;
              if (phaseCount > 0) return `Completed ${phaseCount} phases`;
              return "Completed";
            })())
          : phaseMeta.narrative,
        phase: state.currentPhase,
        phaseColor: isComplete ? "text-emerald-400" : phaseMeta.color,
        criteriaTotal: state.criteria?.length ?? 0,
        criteriaPassing: completedCount,
        isComplete,
        isActive,
        startedAt: state.algorithmStartedAt,
        algorithmState: state,
      });
    }

    // Loop/ISA runs
    for (const isa of prds) {
      const phase = prdStatusToPhase(isa.frontmatter.status, isa.frontmatter.loopStatus);
      const phaseMeta = PHASE_META[phase] || PHASE_META.IDLE;
      const isRunning = isa.frontmatter.loopStatus === "running";
      const isComplete = isa.frontmatter.status === "COMPLETE";
      // Only classify as "loop" if it actually has an active/paused loopStatus
      const isLoop = (isa as any).isLoop === true;

      // Skip abandoned ISAs
      if ((isa.frontmatter as any).abandoned === true) continue;

      items.push({
        id: `loop-${isa.frontmatter.id}`,
        type: isLoop ? "loop" : "interactive",
        title: isa.title,
        summary: isa.oneLiner || phaseMeta.narrative,
        phase,
        phaseColor: phaseMeta.color,
        criteriaTotal: isa.totalCriteria,
        criteriaPassing: isa.passingCriteria,
        isComplete,
        isActive: isRunning,
        iteration: isLoop ? isa.frontmatter.iteration : undefined,
        maxIterations: isLoop ? isa.frontmatter.maxIterations : undefined,
        loopStatus: isa.frontmatter.loopStatus,
        updatedAgo: formatRelativeTime(isa.frontmatter.updated),
        isaSummary: isa,
      });
    }

    // Sort: active > in-progress > complete
    items.sort((a, b) => {
      const order = (item: UnifiedWorkItem) => {
        if (item.isActive) return 0;
        if (!item.isComplete) return 1;
        return 2;
      };
      return order(a) - order(b);
    });

    return items;
  }, [algorithmStates, prds]);

  const isLoading = algoLoading && prdLoading;

  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  const allActiveItems = unifiedItems.filter((i) => i.isActive);
  // Split active items: algorithm/worker at top, native at bottom
  const isNativeItem = (i: UnifiedWorkItem) => i.algorithmState?.mode === "native" || (i.phase as string) === "NATIVE";
  const activeAlgorithmItems = allActiveItems.filter((i) => !isNativeItem(i));
  const activeNativeItems = allActiveItems.filter((i) => isNativeItem(i));
  const activeItems = [...activeAlgorithmItems, ...activeNativeItems];
  // Show non-active items from last 24h — they disappear after that but resurrect if activity resumes
  const completedItems = unifiedItems
    .filter((i) => !i.isActive && (i.startedAt ?? 0) > twentyFourHoursAgo)
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  const visibleItems = [...activeItems, ...completedItems];
  const activeCount = activeItems.length;
  const completeCount = completedItems.length;
  const totalCriteria = visibleItems.reduce((sum, i) => sum + i.criteriaTotal, 0);
  const passingCriteria = visibleItems.reduce((sum, i) => sum + i.criteriaPassing, 0);
  const overallPct = totalCriteria > 0 ? Math.round((passingCriteria / totalCriteria) * 100) : 0;

  // Collect all rating pulses: orphan pulseStrip + session-level ratings
  // NOTE: useMemo hooks must be called before any conditional returns (Rules of Hooks)
  const allPulses = useMemo(() => {
    const sessionRatings = algorithmStates
      .flatMap((s) => s.ratings ?? []);
    const combined = [...(pulseStrip ?? []), ...sessionRatings];
    combined.sort((a, b) => a.timestamp - b.timestamp);
    return combined;
  }, [algorithmStates, pulseStrip]);

  // Filter visible items based on activityFilter
  const filteredVisibleItems = useMemo(() => {
    if (activityFilter === "all") return visibleItems;
    if (activityFilter === "active") return visibleItems.filter((i) => i.isActive);
    if (activityFilter === "completed") return visibleItems.filter((i) => !i.isActive);
    if (activityFilter === "algorithm") {
      return visibleItems.filter((i) => {
        if (!i.algorithmState) return false;
        return resolveSessionMode(i.algorithmState) === "algorithm";
      });
    }
    if (activityFilter === "native") {
      return visibleItems.filter((i) => {
        if (!i.algorithmState) return false;
        return resolveSessionMode(i.algorithmState) === "native";
      });
    }
    return visibleItems;
  }, [visibleItems, activityFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">Loading work...</span>
      </div>
    );
  }

  if (unifiedItems.length === 0 || visibleItems.length === 0) {
    return <IdleContent />;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Quick Pulse Strip — ambient MINIMAL ratings at top */}
      <QuickPulseStrip pulses={allPulses} />

      {/* Summary header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-5">
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              <span className="font-medium text-blue-400">{activeCount}</span>
              <span className="text-blue-400/60">active</span>
            </div>
          )}

          {completeCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium text-zinc-400">{completeCount}</span>
              <span className="text-zinc-500">done</span>
            </div>
          )}

          <Separator orientation="vertical" className="h-4 bg-zinc-800" />

          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Criteria:</span>
            <span className="font-mono text-zinc-300">{passingCriteria}/{totalCriteria}</span>
            <div className="w-20">
              <Progress value={overallPct} className="h-1.5 [&>div]:bg-zinc-400" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoopStart}
            disabled={loopStarting}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded-md hover:bg-blue-500/10 border border-blue-500/20 disabled:opacity-50"
          >
            {loopStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />}
            {loopStarting ? 'Selecting...' : 'Loop'}
          </button>
          <button
            onClick={fetchISAs}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-white/[0.04]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 py-1.5 flex items-center gap-1.5 border-b border-white/[0.03]">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActivityFilter(opt.value)}
            className={`px-2.5 py-1 rounded text-sm font-medium transition-colors ${
              activityFilter === opt.value
                ? opt.value === "algorithm"
                  ? "bg-purple-500/15 text-purple-400 border border-purple-500/25"
                  : opt.value === "native"
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                  : "bg-white/[0.06] text-zinc-300 border border-white/[0.08]"
                : "text-zinc-500 hover:text-zinc-400 hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Work items list — Active / Completed (last 24h) */}
      <ScrollArea className="flex-1">
        {(() => {
          const renderItem = (item: UnifiedWorkItem) => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id}>
                <WorkRow
                  item={item}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : item.id)}
                />
                <AnimatePresence initial={false}>
                  {isExpanded && item.algorithmState?.sessionId?.startsWith("worker-") && item.algorithmState && (
                    <WorkerExpandedView item={item} />
                  )}
                  {isExpanded && !item.algorithmState?.sessionId?.startsWith("worker-") && !(item.algorithmState?.mode === "native" || (item.phase as string) === "NATIVE") && item.type === "interactive" && item.algorithmState && (
                    <InteractiveExpandedView item={item} />
                  )}
                  {isExpanded && item.type === "loop" && item.isaSummary && (
                    <LoopExpandedView
                      isa={item.isaSummary}
                      onAction={handleAction}
                      actionLoading={actionLoading}
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          };

          // Re-group filtered items
          const filteredActive = filteredVisibleItems.filter((i) => i.isActive);
          const filteredCompleted = filteredVisibleItems.filter((i) => !i.isActive);
          const filteredAlgo = filteredActive.filter((i) => !isNativeItem(i));
          const filteredNative = filteredActive.filter((i) => isNativeItem(i));

          // Render algorithm items via SessionCard when they have mode data, otherwise via legacy WorkRow
          const renderAlgorithmItem = (item: UnifiedWorkItem) => {
            if (item.algorithmState?.currentMode) {
              return (
                <SessionCard
                  key={item.id}
                  session={item.algorithmState}
                  isExpanded={expandedId === item.id}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                />
              );
            }
            return renderItem(item);
          };

          // Render native items via SessionCard when they have mode data
          const renderNativeItem = (item: UnifiedWorkItem) => {
            if (item.algorithmState?.currentMode) {
              return (
                <SessionCard
                  key={item.id}
                  session={item.algorithmState}
                  isExpanded={expandedId === item.id}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                />
              );
            }
            return renderItem(item);
          };

          // Render completed items via CompletedSessionRow when they have mode data
          const renderCompletedItem = (item: UnifiedWorkItem) => {
            if (item.algorithmState?.currentMode) {
              return (
                <CompletedSessionRow
                  key={item.id}
                  session={item.algorithmState}
                />
              );
            }
            return renderItem(item);
          };

          return (
            <>
              {/* Active — Algorithm runs at top */}
              {filteredAlgo.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02]">
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span className="text-sm font-semibold uppercase tracking-wider text-blue-400">Active</span>
                    <span className="text-xs text-zinc-600 ml-auto">{filteredAlgo.length}</span>
                  </div>
                  {filteredAlgo.map(renderAlgorithmItem)}
                </div>
              )}

              {/* Native — enhanced with activity indicator */}
              {filteredNative.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 flex items-center gap-2 border-b border-amber-500/10 bg-amber-500/[0.03]">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <Terminal className="w-3 h-3 text-amber-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Native</span>
                    <span className="text-xs text-amber-500/50 font-mono ml-auto">{filteredNative.length} active</span>
                  </div>
                  {filteredNative.map(renderNativeItem)}
                </div>
              )}

              {/* Completed — collapsible section */}
              {filteredCompleted.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 flex items-center gap-2 border-b border-white/[0.04] bg-white/[0.01]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span className="text-sm font-semibold uppercase tracking-wider text-emerald-500/70">Completed</span>
                    <span className="text-xs text-zinc-600 ml-1">last 24h</span>
                    <span className="text-xs text-zinc-700 ml-auto">{filteredCompleted.length}</span>
                  </div>
                  {filteredCompleted.map(renderCompletedItem)}
                </div>
              )}

            </>
          );
        })()}
      </ScrollArea>
    </div>
  );
}
