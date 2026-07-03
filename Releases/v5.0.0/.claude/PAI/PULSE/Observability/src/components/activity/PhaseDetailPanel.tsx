"use client";

import type { AlgorithmState, AlgorithmPhase } from "@/types/algorithm";
import { Eye, Brain, ClipboardList, Hammer, Zap, CheckCircle2, BookOpen, Clock, Users, Layers, type LucideIcon } from "lucide-react";
import { resolveEffortTier, TIER_BADGE_CLASSES } from "@/lib/effort-tier";

// ─── Phase config ───

const PHASE_ORDER: AlgorithmPhase[] = ["OBSERVE", "THINK", "PLAN", "BUILD", "EXECUTE", "VERIFY", "LEARN"];

const PHASE_META: Record<string, { color: string; icon: LucideIcon; activeNarrative: string }> = {
  OBSERVE: {
    color: "#7dcfff",
    icon: Eye,
    activeNarrative: "Scanning the problem space. Building ISC criteria from the request \u2014 what must be true when done, what must NOT happen.",
  },
  THINK: {
    color: "#bb9af7",
    icon: Brain,
    activeNarrative: "Analyzing edge cases, complexity, and dependencies. Evolving criteria. Deciding which capabilities to invoke.",
  },
  PLAN: {
    color: "#7aa2f7",
    icon: ClipboardList,
    activeNarrative: "Choosing execution strategy. Evaluating parallelization. Partitioning work across agents if criteria are independent.",
  },
  BUILD: {
    color: "#ff9e64",
    icon: Hammer,
    activeNarrative: "Creating artifacts. Code, content, infrastructure. Each non-obvious decision gets documented in the ISA.",
  },
  EXECUTE: {
    color: "#9ece6a",
    icon: Zap,
    activeNarrative: "Deploying capabilities. Running skills, spawning agents, executing the plan. New edge cases become new criteria.",
  },
  VERIFY: {
    color: "#73daca",
    icon: CheckCircle2,
    activeNarrative: "The culmination. Every ISC criterion tested against evidence. Binary YES/NO \u2014 no ambiguity. This is hill-climbing.",
  },
  LEARN: {
    color: "#e0af68",
    icon: BookOpen,
    activeNarrative: "Capturing what worked and what didn't. Updating ISA with session context. Building institutional knowledge.",
  },
};

const AGENT_TYPE_COLORS: Record<string, string> = {
  Engineer: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  Architect: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Algorithm: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  Researcher: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  Explore: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Designer: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  Intern: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
};

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

// ─── Panel ───

export default function PhaseDetailPanel({ state }: { state: AlgorithmState }) {
  const now = Date.now();
  const phaseElapsed = now - state.phaseStartedAt;
  const totalElapsed = now - state.algorithmStartedAt;
  const currentIdx = PHASE_ORDER.indexOf(state.currentPhase);

  const pendingCount = state.criteria.filter((c) => c.status === "pending" || c.status === "in_progress").length;
  const completedCount = state.criteria.filter((c) => c.status === "completed").length;
  const failedCount = state.criteria.filter((c) => c.status === "failed").length;

  const phaseMeta = PHASE_META[state.currentPhase];
  const PhaseIcon = phaseMeta?.icon ?? Eye;
  // Find the current (uncompleted) phase history entry for live narrative
  const currentPhaseEntry = state.phaseHistory.find((h) => h.phase === state.currentPhase && !h.completedAt);
  const narrativeText = currentPhaseEntry?.phaseNarrative ?? phaseMeta?.activeNarrative ?? "Processing...";

  return (
    <div className="border-t border-white/[0.06] bg-white/[0.015]">
      {/* Row 1: Phase narrative + metrics */}
      <div className="flex items-start gap-4 px-4 py-3">
        {/* Phase icon + narrative */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: `${phaseMeta?.color ?? "#666"}15` }}
          >
            <PhaseIcon className="w-4 h-4" style={{ color: phaseMeta?.color ?? "#666" }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold" style={{ color: phaseMeta?.color ?? "#666" }}>
                {state.currentPhase}
              </span>
              {(() => {
                const eff = resolveEffortTier(state.effortLevel || state.sla);
                const cls = eff.tier ? TIER_BADGE_CLASSES[eff.tier] : TIER_BADGE_CLASSES.pending;
                return (
                  <span className={`px-2 py-0.5 rounded text-[14px] font-medium border ${cls}`}>
                    {eff.label}
                  </span>
                );
              })()}
            </div>
            <p className="text-[15px] text-zinc-400 leading-relaxed">
              {narrativeText}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-4 shrink-0 text-[15px]">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span className="font-mono">{formatElapsed(phaseElapsed)}</span>
            <span className="text-zinc-600">/</span>
            <span className="font-mono text-zinc-500">{formatElapsed(totalElapsed)}</span>
          </div>
          <div className="h-4 w-px bg-white/[0.06]" />
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400 font-medium">{completedCount}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-300 font-medium">{state.criteria.length}</span>
            <span className="text-zinc-500">criteria</span>
            {failedCount > 0 && (
              <span className="text-red-400 text-[14px]">({failedCount} failed)</span>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Agents + Capabilities + Timeline */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.04]">
        {/* Active Agents */}
        {state.agents.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            <div className="flex items-center gap-1.5">
              {state.agents.map((agent) => {
                const agentColor = AGENT_TYPE_COLORS[agent.agentType] ?? "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";
                const statusDot =
                  agent.status === "active"
                    ? "bg-emerald-500 animate-pulse"
                    : agent.status === "idle"
                    ? "bg-amber-500"
                    : "bg-zinc-500";

                return (
                  <span
                    key={agent.name}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[14px] ${agentColor}`}
                    title={agent.task ?? agent.agentType}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    <span className="font-medium">{agent.name}</span>
                    <span className="text-[13px] opacity-60">{agent.agentType}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Capabilities */}
        {state.capabilities.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
            <div className="flex items-center gap-1">
              {state.capabilities.map((cap) => (
                <span key={cap} className="px-2 py-0.5 rounded bg-white/[0.04] text-zinc-400 text-[14px] border border-white/[0.04]">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Phase Timeline */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {PHASE_ORDER.map((phase, i) => {
            const isComplete = i < currentIdx;
            const isCurrent = phase === state.currentPhase;
            const color = PHASE_META[phase]?.color ?? "#666";
            const historyEntry = state.phaseHistory.find((h) => h.phase === phase);
            const PhIcon = PHASE_META[phase]?.icon ?? Eye;

            return (
              <div key={phase} className="flex items-center gap-1.5">
                <div
                  className={`w-5 h-5 rounded transition-all flex items-center justify-center ${
                    isCurrent ? "animate-pulse" : ""
                  }`}
                  style={{
                    backgroundColor: isComplete || isCurrent ? `${color}20` : undefined,
                    opacity: isComplete ? 0.7 : isCurrent ? 1 : 0.15,
                    boxShadow: isCurrent ? `0 0 0 2px ${color}30` : undefined,
                  }}
                  title={`${phase}${historyEntry?.completedAt ? ` (${formatElapsed(historyEntry.completedAt - historyEntry.startedAt)})` : ""}${historyEntry?.phaseNarrative ? `\n${historyEntry.phaseNarrative}` : ""}`}
                >
                  <PhIcon className="w-3 h-3" style={{ color }} />
                </div>
                {i < PHASE_ORDER.length - 1 && (
                  <div
                    className="w-3 h-0.5 rounded-full"
                    style={{
                      backgroundColor: isComplete ? `${color}50` : "rgba(255,255,255,0.06)",
                    }}
                  />
                )}
              </div>
            );
          })}
          <span className="text-zinc-500 ml-2 font-mono text-[14px]">{formatElapsed(totalElapsed)}</span>
        </div>
      </div>
    </div>
  );
}
