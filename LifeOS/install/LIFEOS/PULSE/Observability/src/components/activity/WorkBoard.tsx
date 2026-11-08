"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAlgorithmState } from "@/hooks/useAlgorithmState";
import type { AlgorithmState, AlgorithmCriterion, ActivityClass } from "@/types/algorithm";
import { deriveLifecycle, LIFECYCLE_META, LIFECYCLE_ORDER, formatElapsed, formatAgo, type Lifecycle } from "@/lib/lifecycle";
import ClimbChart from "./ClimbChart";
import { fmtClock } from "@/lib/time";
import QuickPulseStrip from "./QuickPulseStrip";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Columns3,
  List,
  Loader2,
  Mountain,
  RotateCcw,
  Shield,
  Terminal,
  Target,
  XCircle,
} from "lucide-react";

// ─── WorkBoard — tracked climbs + untracked sessions ───
//
// Replaces UnifiedWorkDashboard (2026-07-14 redesign). No modes, no effort
// tiers, no phase stations. Two kinds of rows:
//   TRACKED  — an ISA backs the session: criteria, evidence, the climb.
//   UNTRACKED — a live session with no ISA: liveness + what it's doing.
// Lifecycle is derived from data (lib/lifecycle.ts), never declared.

type BoardFilter = "all" | "tracked" | "untracked";

const FILTERS: { value: BoardFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tracked", label: "Climbs" },
  { value: "untracked", label: "Sessions" },
];

// ─── ISA badge — marks a tracked run, carries the ISC count ───

/** Criterion counts with a legacy fallback: rows written before the progress
 *  normalization can carry 0/0 while their criteria[] are fully populated. */
export function claimCounts(s: AlgorithmState): { done: number; total: number } {
  if ((s.progress?.total ?? 0) > 0) return s.progress;
  const claims = s.criteria?.filter((c) => c.type !== "anti-criterion") ?? [];
  return { done: claims.filter((c) => c.status === "completed").length, total: claims.length };
}

/** Explicit absence marker — "no badge" was invisible convention (2026-07-15). */
function NoISAChip({ size = "sm" }: { size?: "sm" | "xs" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-ink-3 shrink-0 ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-px text-[10px]"
      } font-medium tracking-wide`}
      title="Untracked session — no ISA, no criteria; liveness only"
    >
      NO ISA
    </span>
  );
}

// ─── Activity chip — what the tool stream says the run is doing RIGHT NOW ───
//
// Second axis on top of the lifecycle lane (2026-07-22): the lane is the macro
// state from ISA data; this chip is the live state derived server-side from
// tool-activity.jsonl. Shown only while fresh (< 5 min since last tool call).

const ACTIVITY_META: Record<ActivityClass, { label: string; color: string }> = {
  exploring: { label: "Exploring", color: "#7dcfff" },
  building: { label: "Building", color: "#e0af68" },
  verifying: { label: "Verifying", color: "#34d399" },
  delegating: { label: "Delegating", color: "#bb9af7" },
  other: { label: "Working", color: "#c0caf5" },
};

const ACTIVITY_FRESH_MS = 5 * 60 * 1000;

function ActivityChip({ s, size = "sm" }: { s: AlgorithmState; size?: "sm" | "xs" }) {
  const a = s.activity;
  if (!s.active || !a?.state || !a.lastTs || Date.now() - a.lastTs > ACTIVITY_FRESH_MS) return null;
  // A completed run is closed — residual tool calls in the same terminal are
  // post-run chatter, not run work. Done cards never advertise live activity
  // (principal directive, 2026-07-22).
  // A run in the learn wrap-up (phase not yet COMPLETE) keeps the chip: wrap-up
  // is real work. (Was "Summit keeps the chip" — summit folded into cairn 2026-07-30.)
  if (s.currentPhase === "COMPLETE") return null;
  const meta = ACTIVITY_META[a.state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border shrink-0 font-medium tracking-wide ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-px text-[10px]"
      }`}
      style={{ color: meta.color, borderColor: `${meta.color}30`, backgroundColor: `${meta.color}0d` }}
      title={a.lastTool ? `${meta.label} — last tool ${a.lastTool} ${formatAgo(a.lastTs)}` : meta.label}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: meta.color }} />
      {meta.label}
      {size === "sm" && a.lastTool && <span className="opacity-60 font-mono">{a.lastTool}</span>}
    </span>
  );
}

/** ISC delta text — "+2 · ✓3 (1h)" — only when something actually moved. */
function deltaText(s: AlgorithmState): string | null {
  const d = s.iscDeltas;
  if (!d || (d.added1h === 0 && d.closed1h === 0)) return null;
  const parts: string[] = [];
  if (d.added1h > 0) parts.push(`+${d.added1h}`);
  if (d.closed1h > 0) parts.push(`✓${d.closed1h}`);
  return `${parts.join(" · ")} (1h)`;
}

function ISABadge({ s, size = "sm" }: { s: AlgorithmState; size?: "sm" | "xs" }) {
  if (!s.tracked) return <NoISAChip size={size} />;
  const { done, total } = claimCounts(s);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/[0.08] text-sky-300 shrink-0 ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-px text-[10px]"
      } font-semibold tracking-wide`}
      title={`ISA-tracked — ${done}/${total} criteria verified`}
    >
      <Mountain className={size === "sm" ? "w-3 h-3" : "w-2.5 h-2.5"} />
      ISA{total > 0 ? ` ${done}/${total}` : ""}
    </span>
  );
}

// ─── Criteria Kanban — columns are criterion STATES, the thing that actually moves ───
//
// The old kanban's columns were phases (retired — nothing walked them). These
// columns are real: every card sits where its verification status puts it,
// and cards migrate left→right as evidence lands.

const CLAIM_COLUMNS: {
  key: string;
  label: string;
  color: string;
  match: (c: AlgorithmCriterion) => boolean;
}[] = [
  // "In progress" column removed 2026-07-22: no writer has ever emitted
  // in_progress (parser is pending|completed) — the column was permanently empty.
  { key: "open", label: "Open", color: "#7dcfff", match: (c) => c.status !== "completed" && c.status !== "failed" },
  { key: "verified", label: "Verified", color: "#34d399", match: (c) => c.status === "completed" },
];

function splitEvidence(c: AlgorithmCriterion): [string, string] {
  const m = c.description.match(/^([\s\S]*?)(?:\s*\*{0,2}Evidence:?\*{0,2}\s*)([\s\S]+)$/i);
  if (m) return [m[1].trim(), m[2].trim()];
  return [c.description, c.evidence || ""];
}

function ClaimsKanban({ s }: { s: AlgorithmState }) {
  const claims = s.criteria.filter((c) => c.type !== "anti-criterion");
  if (claims.length === 0) return null;
  const failed = claims.filter((c) => c.status === "failed");
  const cols = [
    ...CLAIM_COLUMNS,
    ...(failed.length > 0
      ? [{ key: "failed", label: "Failed", color: "#f7768e", match: (c: AlgorithmCriterion) => c.status === "failed" }]
      : []),
  ];

  return (
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
      {cols.map((col) => {
        const cards = claims.filter(col.match);
        return (
          <div key={col.key} className="rounded-lg border border-white/[0.05] bg-white/[0.01] min-h-[80px]">
            <div
              className="px-2.5 py-1.5 flex items-center gap-1.5 border-b border-white/[0.04]"
              style={{ color: col.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider">{col.label}</span>
              <span className="text-[11px] font-mono ml-auto opacity-60">{cards.length}</span>
            </div>
            <div className="p-1.5 space-y-1.5">
              {cards.map((c) => {
                const [claimText, evidenceText] = splitEvidence(c);
                return (
                  <div
                    key={c.id}
                    className="rounded px-2 py-1.5 bg-white/[0.02] border border-white/[0.04]"
                    title={evidenceText ? `${claimText}\n\nEvidence: ${evidenceText}` : claimText}
                    data-sensitive
                  >
                    <div className="text-[11px] font-mono mb-0.5" style={{ color: `${col.color}99` }}>
                      {c.id}
                    </div>
                    <p className="text-[12px] leading-snug text-ink-2 line-clamp-3">{claimText}</p>
                    {col.key === "verified" && evidenceText && (
                      <p className="text-[11px] leading-snug text-ink-3 line-clamp-2 mt-1">
                        <span className="text-emerald-400/60">✓ </span>
                        {evidenceText}
                      </p>
                    )}
                  </div>
                );
              })}
              {cards.length === 0 && <div className="text-[11px] text-ink-3 italic px-1 py-2">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Criterion row (expanded view) ───

function ClaimRow({ c }: { c: AlgorithmCriterion }) {
  const isAnti = c.type === "anti-criterion";
  const icon =
    c.status === "completed" ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
    ) : c.status === "failed" ? (
      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
    ) : (
      <Circle className="w-3.5 h-3.5 text-ink-3 shrink-0 mt-0.5" />
    );

  // Evidence is embedded in descriptions as "Evidence: …" — split it out so
  // the criterion reads clean and the proof reads quiet.
  const [claimText, evidenceText] = useMemo(() => {
    const m = c.description.match(/^([\s\S]*?)(?:\s*\*{0,2}Evidence:?\*{0,2}\s*)([\s\S]+)$/i);
    if (m) return [m[1].trim(), m[2].trim()];
    return [c.description, c.evidence || ""];
  }, [c.description, c.evidence]);

  return (
    <div className={`flex items-start gap-2 px-3 py-1.5 rounded ${isAnti ? "bg-rose-500/[0.03]" : "bg-white/[0.015]"}`} data-sensitive>
      {isAnti ? <Shield className="w-3.5 h-3.5 text-rose-300/70 shrink-0 mt-0.5" /> : icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-mono text-ink-3 shrink-0">{c.id}</span>
          {isAnti && <span className="text-[11px] uppercase tracking-wider text-rose-300/60 shrink-0">guardrail</span>}
        </div>
        <p className={`text-sm leading-snug ${c.status === "completed" ? "text-ink-2" : "text-ink-1"}`}>{claimText}</p>
        {evidenceText && c.status === "completed" && (
          <p className="text-[13px] text-ink-3 leading-snug mt-0.5 line-clamp-2">
            <span className="text-emerald-400/60">evidence</span> {evidenceText}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Expanded view for an untracked session ───
//
// Everything work.json knows about a session with no ISA: the opening ask,
// timing, liveness. Exists because "I don't know anything about them"
// (principal, 2026-07-15) — every card must open into whatever we do know.

export function SessionExpanded({ s, bare = false }: { s: AlgorithmState; bare?: boolean }) {
  // bare: plain always-open panel for the spotlight — see ClimbExpanded.
  const Wrapper = bare ? "div" : motion.div;
  const motionProps = bare
    ? {}
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0.18, ease: "easeInOut" },
      };
  return (
    <Wrapper
      {...(motionProps as object)}
      className="overflow-hidden border-b border-white/[0.06]"
    >
      <div className="px-5 py-4 space-y-3">
        {s.rawTask && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1">Opening ask</div>
            <p className="text-sm text-ink-1 leading-relaxed" data-sensitive>“{s.rawTask}”</p>
          </div>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-2">
          <span>
            <span className="text-ink-3">started </span>
            {fmtClock(s.algorithmStartedAt)}
            {s.active ? (
              <>
                <span className="text-ink-3"> · running </span>
                {formatElapsed(Date.now() - (s.algorithmStartedAt || Date.now()))}
              </>
            ) : s.currentPhase === "COMPLETE" && s.completedAt ? (
              // A closed session's length stops at its end, not at now.
              <>
                <span className="text-ink-3"> · ended after </span>
                {formatElapsed(s.completedAt - s.algorithmStartedAt)}
              </>
            ) : (
              // Inactive without a recorded end (stale): its outcome is unknown, so it is not called finished.
              <span className="text-ink-3"> · not active, end not recorded</span>
            )}
          </span>
          <span>
            <span className="text-ink-3">last activity </span>
            {formatAgo(s.phaseStartedAt || s.algorithmStartedAt)}
          </span>
          {s.sessionUUID && (
            <span className="font-mono text-[11px] text-ink-3 self-center">{s.sessionUUID.slice(0, 8)}</span>
          )}
        </div>
        <p className="text-[12px] text-ink-3 leading-snug">
          Untracked session — no ISA, so no criteria, no climb. If this becomes real work, the run writes an ISA and
          this card graduates to a tracked climb automatically.
        </p>
      </div>
    </Wrapper>
  );
}

// ─── Expanded view for a tracked run ───

function ClimbExpanded({ s, bare = false }: { s: AlgorithmState; bare?: boolean }) {
  const claims = s.criteria.filter((c) => c.type !== "anti-criterion");
  const guards = s.criteria.filter((c) => c.type === "anti-criterion");
  // bare: render as a plain always-open panel (the spotlight). The 0→auto
  // height animation is for the list-view expander; as a persistent pane it
  // can wedge at collapsed height (observed 2026-07-22: 40px spotlight).
  const Wrapper = bare ? "div" : motion.div;
  const motionProps = bare
    ? {}
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0.18, ease: "easeInOut" },
      };
  return (
    <Wrapper
      {...(motionProps as object)}
      className="overflow-hidden border-b border-white/[0.06]"
    >
      <div className="px-5 py-4 space-y-4">
        {((s.climb?.length ?? 0) > 0 || (s.activity?.ribbon?.length ?? 0) > 0) && (
          <div className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-3">
            <ClimbChart state={s} variant="full" />
          </div>
        )}

        {s.intent && !s.criteria.length && (
          <p className="text-sm text-ink-2 leading-relaxed" data-sensitive>{s.intent}</p>
        )}

        {claims.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                Criteria {claimCounts(s).done}/{claimCounts(s).total}
              </span>
              {s.iscDeltas && (s.iscDeltas.addedTotal > 0 || s.iscDeltas.closedTotal > 0) && (
                <span className="text-[11px] font-mono text-ink-3">
                  {s.iscDeltas.addedTotal} added · {s.iscDeltas.closedTotal} closed
                  {deltaText(s) && <span className="text-amber-400/80"> · {deltaText(s)}</span>}
                </span>
              )}
            </div>
            <ClaimsKanban s={s} />
          </div>
        )}

        {guards.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Shield className="w-3.5 h-3.5 text-rose-300/70" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">Guardrails</span>
            </div>
            {guards.map((c) => (
              <ClaimRow key={c.id} c={c} />
            ))}
          </div>
        )}

        {s.criteriaParseWarning && (
          <p className="text-[13px] text-amber-400/70">
            ISA criteria could not be parsed ({s.criteriaParseWarning}) — showing frontmatter progress only.
          </p>
        )}

        {(s.agents?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {s.agents.map((a, i) => (
              <span
                key={i}
                className={`text-[12px] px-2 py-0.5 rounded-full border ${
                  a.status === "active"
                    ? "text-sky-300 border-sky-500/30 bg-sky-500/10"
                    : "text-ink-3 border-white/[0.06] bg-white/[0.02]"
                }`}
                title={a.task || a.name}
                data-sensitive
              >
                ⬡ {a.name.split("::").pop()} · {a.agentType}
              </span>
            ))}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

// ─── One board row ───

function BoardRow({
  s,
  expanded,
  onToggle,
}: {
  s: AlgorithmState;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lc = deriveLifecycle(s);
  const meta = LIFECYCLE_META[lc];
  const rework = (s.iteration ?? 1) > 1;
  const elapsed = s.active
    ? formatElapsed(Date.now() - (s.algorithmStartedAt || Date.now()))
    : formatAgo(s.completedAt || s.phaseStartedAt || s.algorithmStartedAt);
  const expandable = s.tracked
    ? s.criteria.length > 0 || (s.climb?.length ?? 0) > 0 || !!s.intent
    : !!s.rawTask;

  return (
    <>
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] text-left transition-colors ${
          expandable ? "hover:bg-white/[0.02] cursor-pointer" : "cursor-default"
        }`}
      >
        {/* liveness dot */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${s.active ? "animate-pulse" : ""}`}
          style={{ backgroundColor: meta.color, opacity: meta.dim ? 0.5 : 1 }}
        />

        {/* lifecycle pill */}
        <span
          className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 border"
          style={{
            color: meta.color,
            borderColor: `${meta.color}30`,
            backgroundColor: `${meta.color}0d`,
            opacity: meta.dim ? 0.7 : 1,
          }}
        >
          {meta.label}
        </span>

        {/* title */}
        <span className={`text-sm truncate flex-1 ${s.active ? "text-ink-1" : "text-ink-2"}`} data-sensitive>
          {s.taskDescription}
        </span>

        {/* live activity — what the tool stream says is happening */}
        <ActivityChip s={s} />

        {/* ISA badge — tracked rows announce themselves */}
        <ISABadge s={s} />

        {/* rework badge */}
        {rework && (
          <span className="flex items-center gap-1 text-amber-400/80 shrink-0" title={`Iteration ${s.iteration}`}>
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[12px] font-mono">×{s.iteration}</span>
          </span>
        )}

        {/* climb sparkline for tracked rows */}
        {s.tracked && s.progress.total > 0 && <ClimbChart state={s} variant="mini" />}

        {/* untracked: what it's doing — only when it adds information beyond the title */}
        {!s.tracked &&
          s.rawTask &&
          !s.taskDescription.toLowerCase().startsWith(s.rawTask.toLowerCase().slice(0, 24)) &&
          !s.rawTask.toLowerCase().startsWith(s.taskDescription.toLowerCase().slice(0, 24)) && (
            <span className="text-[13px] text-ink-3 truncate max-w-[280px] shrink-0" data-sensitive>{s.rawTask}</span>
          )}

        <span className="text-[13px] font-mono text-ink-3 shrink-0 w-16 text-right">{elapsed}</span>

        {expandable && (
          <ChevronRight
            className={`w-4 h-4 text-ink-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && expandable && (s.tracked ? <ClimbExpanded s={s} /> : <SessionExpanded s={s} />)}
      </AnimatePresence>
    </>
  );
}

// ─── Board Kanban — lifecycle lanes, sessions as cards ───
//
// Lanes are DERIVED states (lib/lifecycle.ts), so a card's lane is always
// true: it sits where its data puts it. Click a card to expand its detail
// below the lanes.

// Live sessions lead the board (2026-07-15): most real-time activity is
// untracked quick work, and burying it in the last lane made an active
// morning read as a dead board.
//
// 2026-07-22 hill-climb lanes (6-state fold 2026-07-30): the in-flight middle (Ascending/
// Verifying) derives from the live tool stream, so cards migrate as the work's
// character changes — the old Scoping/Climbing/Learning trio was static by
// construction (see lib/lifecycle.ts). Left→right is the arc of a run.
// Lane glyphs are the ascent-table emoji (LIFECYCLE_META.icon) — the EXACT
// glyph the Kitty tab, status line, and ISA mirror show. The old
// local lucide "twin" map drifted from the table by construction and was
// deleted 2026-07-28 (principal directive) — an icon change in
// ascent.ts now propagates here with no board edit.

// Lane membership is TABLE POLICY (ascent.ts `board` field), never a list
// spelled here — the local list drifted twice on 2026-07-28 alone. Columns are
// STATIC (principal directive, 2026-07-30): every
// run state is a permanent column, populated or not; only 'hidden' (idle)
// never renders. The conditional placements ('laneWhenPopulated', 'list') and
// the separate Done ledger they produced are retired.
const LANE_STATES: Lifecycle[] = LIFECYCLE_ORDER.filter(
  (lc) => LIFECYCLE_META[lc].board === "lane",
);

function SessionCard2({
  s,
  selected,
  onSelect,
}: {
  s: AlgorithmState;
  selected: boolean;
  onSelect: () => void;
}) {
  const lc = deriveLifecycle(s);
  const meta = LIFECYCLE_META[lc];
  const rework = (s.iteration ?? 1) > 1;
  // Metadata footer (2026-07-28): everything here already rides AlgorithmState —
  // last tool from the live stream, rope team size, ISC movement. The card says
  // what the run is DOING, not just what it's called.
  const lastToolFresh =
    s.active && s.activity?.lastTool && s.activity.lastTs && Date.now() - s.activity.lastTs < ACTIVITY_FRESH_MS
      ? s.activity
      : null;
  const activeAgents = s.agents?.filter((a) => a.status === "active").length ?? 0;
  const delta = s.tracked ? deltaText(s) : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
        selected
          ? "border-sky-500/40 bg-sky-500/[0.06]"
          : "border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.active ? "animate-pulse" : ""}`}
          style={{ backgroundColor: meta.color }}
        />
        <ISABadge s={s} size="xs" />
        <ActivityChip s={s} size="xs" />
        {rework && (
          <span className="text-[10px] font-mono text-amber-400/80 shrink-0">×{s.iteration}</span>
        )}
        <span className="text-[11px] font-mono text-ink-3 ml-auto shrink-0">
          {s.active
            ? formatElapsed(Date.now() - (s.algorithmStartedAt || Date.now()))
            : formatAgo(s.completedAt || s.phaseStartedAt || s.algorithmStartedAt)}
        </span>
      </div>
      <p className="text-[13px] leading-snug text-ink-1 line-clamp-2 mb-1.5" data-sensitive>{s.taskDescription}</p>
      {s.tracked && s.progress.total > 0 && (
        <div className="flex items-center gap-2">
          <ClimbChart state={s} variant="mini" />
        </div>
      )}
      {/* untracked: show the opening ask so the card says WHAT it is */}
      {!s.tracked && s.rawTask && !s.taskDescription.toLowerCase().startsWith(s.rawTask.toLowerCase().slice(0, 24)) && (
        <p className="text-[12px] leading-snug text-ink-3 line-clamp-2 mb-1" data-sensitive>“{s.rawTask}”</p>
      )}
      {(lastToolFresh || activeAgents > 0 || delta) && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-ink-3 truncate">
          {lastToolFresh && (
            <span title={`Last tool call ${formatAgo(lastToolFresh.lastTs!)}`} className="truncate">
              ⌘ {lastToolFresh.lastTool}
              <span className="opacity-60"> {formatAgo(lastToolFresh.lastTs!)}</span>
            </span>
          )}
          {activeAgents > 0 && (
            <span className="text-cyan-300/80 shrink-0" title={`${activeAgents} delegate agent${activeAgents > 1 ? "s" : ""} active`}>
              ⬡ {activeAgents}
            </span>
          )}
          {delta && (
            <span className="text-amber-400/80 shrink-0" title="ISC movement, last hour">
              {delta}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// Wall mode (2026-09-10, Pulse Dashboard): "lanes" fills its viewport with the six
// lanes and no spotlight; "spotlight" renders only the spotlight panel, full height.
// Both are the same board, sliced for an embedder that owns the surrounding layout.
export type BoardWall = "lanes" | "spotlight";

function BoardKanban({
  sessions,
  selectedId,
  onSelect,
  wall,
}: {
  sessions: AlgorithmState[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  wall?: BoardWall;
}) {
  // Camped is tracked-only by construction (deriveLifecycle); untracked
  // quiet rows land in "idle", which the table marks 'hidden'.
  // Static columns (principal, 2026-07-30): every lane renders every load —
  // no populated-only filter, no separate Done block. Cairn is a column.
  const byLane = LANE_STATES.map((lc) => ({
    lc,
    label: LIFECYCLE_META[lc].label,
    icon: LIFECYCLE_META[lc].icon,
    items: sessions
      .filter((s) => deriveLifecycle(s) === lc)
      .sort((a, b) =>
        lc === "cairn"
          ? (b.completedAt || b.phaseStartedAt || 0) - (a.completedAt || a.phaseStartedAt || 0)
          : (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0),
      ),
  }));

  const selected = sessions.find((s) => s.sessionId === selectedId) || null;

  // The detail panel sits ABOVE the lanes and is always populated, spotlighting one active task
  // (principal directive, 2026-07-22).
  // Manual selection wins; otherwise auto-spotlight the most recently active
  // tracked run so the climb visualization is live by default.
  const autoSpotlight =
    sessions
      .filter((s) => s.tracked && s.active && deriveLifecycle(s) !== "cairn")
      .sort((a, b) => (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0))[0] || null;
  const displayed = selected || autoSpotlight;

  if (wall === "spotlight") {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden" data-board="spotlight">
        {displayed ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-4 py-2 flex items-center gap-2 bg-surface-1 sticky top-0 backdrop-blur-sm z-10">
              <span className={`w-2 h-2 rounded-full shrink-0 ${displayed.active ? "bg-sky-400 animate-pulse" : "bg-ink-3"}`} />
              <ISABadge s={displayed} />
              <span className="text-sm text-ink-1 truncate">{displayed.taskDescription}</span>
              {!selected && (
                <span className="text-[11px] uppercase tracking-wider text-sky-400/60 ml-auto shrink-0">live spotlight</span>
              )}
            </div>
            {displayed.tracked ? <ClimbExpanded s={displayed} bare /> : <SessionExpanded s={displayed} bare />}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink-3 text-sm">No active climb to spotlight.</div>
        )}
      </div>
    );
  }

  const lanesWall = wall === "lanes";

  return (
    // ONE scroll container (2026-07-28): the lanes are the highlight and own
    // the viewport. The spotlight rides the viewport bottom via sticky (still
    // never below the fold — the 2026-07-22 rule holds). The Done list is the
    // LOWEST block on the page, past the spotlight — scroll to reach it, and
    // it never steals height from the columns.
    <div className={lanesWall ? "flex-1 min-h-0 flex flex-col overflow-hidden" : "flex-1 min-h-0 overflow-y-auto"} data-board={lanesWall ? "lanes" : "board"}>
      {/* All lanes fit the viewport width — minmax(0,1fr) with no min floor, no
          horizontal scroll (2026-07-20). Cards clamp text so narrow lanes hold. */}
      <div
        className={lanesWall ? "grid gap-2 p-3 flex-1 min-h-0" : "grid gap-2 p-3"}
        style={{ gridTemplateColumns: `repeat(${byLane.length}, minmax(0, 1fr))` }}
      >
        {byLane.map((lane) => {
          const meta = LIFECYCLE_META[lane.lc];
          return (
            <div
              key={lane.lc}
              className={lanesWall ? "rounded-lg border min-w-0 min-h-0 flex flex-col" : "rounded-lg border min-h-[120px] min-w-0"}
              data-lane={lane.lc}
              style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}14` }}
            >
              <div
                className="px-2.5 py-1.5 flex items-center gap-1.5 border-b"
                style={{ borderColor: `${meta.color}33`, backgroundColor: `${meta.color}26` }}
              >
                {/* lane icon carries the liveness pulse (replaced the bare dot, 2026-07-20) */}
                <span
                  className={`text-[13px] leading-none shrink-0 ${lane.items.some((s) => s.active) ? "animate-pulse" : ""}`}
                  aria-hidden
                >
                  {lane.icon}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                  {lane.label}
                </span>
                <span className="text-[11px] font-mono text-ink-3 ml-auto">{lane.items.length}</span>
              </div>
              {/* Columns fill the viewport down to the spotlight, scrolling
                  internally past that (principal, 2026-09-28: the spotlight
                  halved so the lanes get the room). Grid stretch keeps every
                  lane the height of the tallest one. */}
              <div className={lanesWall ? "p-1.5 space-y-1.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden" : "p-1.5 space-y-1.5 min-h-[max(384px,58vh)] max-h-[max(780px,58vh)] overflow-y-auto"} data-lane-cards>
                {lane.items.map((s) => (
                  <SessionCard2
                    key={s.sessionId}
                    s={s}
                    selected={displayed?.sessionId === s.sessionId}
                    onSelect={() => onSelect(selectedId === s.sessionId ? null : s.sessionId)}
                  />
                ))}
                {lane.items.length === 0 && (
                  <div className="text-[11px] text-ink-3 italic px-1 py-2">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Spotlight — the selected (or auto-selected active) run's expanded
          detail. Sticky bottom: rides the viewport while the lanes scroll,
          never below the fold. Auto-populates with the most recent active
          tracked run. */}
      {displayed && !lanesWall && (
        // sticky bottom: the live area rides the viewport — never below the
        // fold no matter the screen height or scroll position. Opaque ground
        // so lanes don't bleed through while scrolling behind it.
        // Half height (principal, 2026-09-28): 42vh → 21vh; the lanes take the space.
        <div className="mx-3 mb-3 shrink-0 sticky bottom-3 z-20 rounded-lg glass-raised max-h-[21vh] overflow-y-auto">
          <div className="px-4 py-2 flex items-center gap-2 bg-surface-1 sticky top-0 backdrop-blur-sm">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${displayed.active ? "bg-sky-400 animate-pulse" : "bg-ink-3"}`}
            />
            <ISABadge s={displayed} />
            <span className="text-sm text-ink-1 truncate">{displayed.taskDescription}</span>
            {!selected && (
              <span className="text-[11px] uppercase tracking-wider text-sky-400/60 ml-auto shrink-0">
                live spotlight
              </span>
            )}
          </div>
          {displayed.tracked ? <ClimbExpanded s={displayed} bare /> : <SessionExpanded s={displayed} bare />}
        </div>
      )}

      {/* The separate Done/cairn ledger is GONE (principal, 2026-07-30): columns
          are static and cairn is a real column like every other state. */}
    </div>
  );
}

// ─── Section header ───

function SectionHeader({
  icon,
  label,
  count,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <div className="px-4 py-1.5 flex items-center gap-2 border-b border-white/[0.05] bg-surface-1">
      {icon}
      <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: tone }}>
        {label}
      </span>
      <span className="text-xs text-ink-3 ml-auto font-mono">{count}</span>
    </div>
  );
}

// ─── Main board ───

export default function WorkBoard({ wall }: { wall?: BoardWall } = {}) {
  const { algorithmStates, pulseStrip, isLoading } = useAlgorithmState();
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Key bumped to v2 (2026-07-20): kanban is the default, and stale "list"
  // prefs saved under the old key must not override it.
  const [view, setView] = useState<"list" | "kanban">(() => {
    if (wall || typeof window === "undefined") return "kanban";
    return (localStorage.getItem("workboard-view-v2") as "list" | "kanban") || "kanban";
  });
  const switchView = (v: "list" | "kanban") => {
    setView(v);
    try {
      localStorage.setItem("workboard-view-v2", v);
    } catch {}
  };

  // Satisfaction pulses, windowed to the last 24h — a week-old rating has no
  // business setting today's mood (2026-07-14 review: widget read a low score off
  // one stale rating). dayAgo is computed INSIDE the memo, not as a dep: a fresh
  // Date.now() every render would change the dep on every render and defeat the
  // memo entirely (full recompute per render). The window instead re-evaluates
  // whenever the data actually changes, which is the correct trigger.
  const pulses = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const all = [...(pulseStrip ?? []), ...algorithmStates.flatMap((s) => s.ratings ?? [])];
    return all.filter((p) => p.timestamp > dayAgo).sort((a, b) => a.timestamp - b.timestamp);
  }, [algorithmStates, pulseStrip]);

  const { activeClimbs, liveSessions, resumable, doneList } = useMemo(() => {
    const byFilter = (s: AlgorithmState) =>
      filter === "all" ? true : filter === "tracked" ? s.tracked : !s.tracked;

    const visible = algorithmStates.filter(byFilter);
    const lcOf = (s: AlgorithmState) => deriveLifecycle(s);

    const activeClimbs = visible
      .filter((s) => s.tracked && s.active && lcOf(s) !== "cairn")
      .sort((a, b) => (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0));
    const liveSessions = visible
      .filter((s) => !s.tracked && s.active)
      .sort((a, b) => (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0));
    const resumable = visible
      .filter((s) => s.tracked && !s.active && lcOf(s) !== "cairn")
      .sort((a, b) => (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0));
    // Un-windowed 2026-07-28 (was 24h): done is a list, the registry fold is
    // the retention bound — matches the kanban's Done section.
    const doneList = visible
      .filter((s) => lcOf(s) === "cairn")
      .sort((a, b) => (b.completedAt || b.phaseStartedAt || 0) - (a.completedAt || a.phaseStartedAt || 0));

    return { activeClimbs, liveSessions, resumable, doneList };
  }, [algorithmStates, filter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-ink-3">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">Loading work...</span>
      </div>
    );
  }

  const empty =
    activeClimbs.length + liveSessions.length + resumable.length + doneList.length === 0;

  if (empty && filter === "all") {
    return (
      <div className="px-6 pt-5">
        <EmptyStateGuide
          section="Work"
          description="Tracked runs land here as climbs — criteria closing on evidence until the summit. Untracked sessions show as live activity. Start work in any session and the board fills in."
          hideInterview
          daPromptExample="run the Algorithm on my next task"
        />
      </div>
    );
  }

  const totalDone = activeClimbs.reduce((n, s) => n + s.progress.done, 0);
  const totalClaims = activeClimbs.reduce((n, s) => n + s.progress.total, 0);
  // Aggregate ISC movement across active climbs — the live add/close pulse.
  const added1h = activeClimbs.reduce((n, s) => n + (s.iscDeltas?.added1h ?? 0), 0);
  const closed1h = activeClimbs.reduce((n, s) => n + (s.iscDeltas?.closed1h ?? 0), 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {!wall && <QuickPulseStrip pulses={pulses} />}

      {/* Summary + filter bar (hidden in spotlight wall: the embedder frames it) */}
      {wall !== "spotlight" && (
      <div className="px-4 py-2 flex items-center gap-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-[13px] font-medium transition-colors border ${
                filter === f.value
                  ? "bg-[rgba(125,207,255,0.12)] text-ink-1 border-[rgba(125,207,255,0.3)]"
                  : "bg-surface-1 text-ink-3 hover:text-ink-2 border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {totalClaims > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Target className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-ink-3">Criteria</span>
              <span className="font-mono text-ink-1">
                {totalDone}/{totalClaims}
              </span>
              {(added1h > 0 || closed1h > 0) && (
                <span className="font-mono text-amber-400/80" title="ISC movement across active climbs, last hour">
                  {added1h > 0 && `+${added1h}`}
                  {added1h > 0 && closed1h > 0 && " · "}
                  {closed1h > 0 && `✓${closed1h}`}
                </span>
              )}
            </div>
          )}
          {!wall && (
          <div className="flex items-center rounded-full border border-white/[0.08] overflow-hidden">
            <button
              onClick={() => switchView("list")}
              className={`px-2.5 py-1 flex items-center gap-1 text-[12px] transition-colors ${
                view === "list" ? "bg-white/[0.08] text-ink-1" : "text-ink-3 hover:text-ink-2"
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => switchView("kanban")}
              className={`px-2.5 py-1 flex items-center gap-1 text-[12px] transition-colors ${
                view === "kanban" ? "bg-white/[0.08] text-ink-1" : "text-ink-3 hover:text-ink-2"
              }`}
              title="Kanban view — lifecycle lanes"
            >
              <Columns3 className="w-3.5 h-3.5" /> Kanban
            </button>
          </div>
          )}
        </div>
      </div>
      )}

      {view === "kanban" && (
        <BoardKanban
          sessions={algorithmStates.filter((s) =>
            filter === "all" ? true : filter === "tracked" ? s.tracked : !s.tracked,
          )}
          selectedId={expandedId}
          onSelect={setExpandedId}
          wall={wall}
        />
      )}

      {view === "list" && (
      <>{/* list view */}

      <ScrollArea className="flex-1">
        {activeClimbs.length > 0 && (
          <div>
            <SectionHeader
              icon={<Mountain className="w-3.5 h-3.5" style={{ color: "#7dcfff" }} />}
              label="Active climbs"
              count={activeClimbs.length}
              tone="#7dcfff"
            />
            {activeClimbs.map((s) => (
              <BoardRow
                key={s.sessionId}
                s={s}
                expanded={expandedId === s.sessionId}
                onToggle={() => setExpandedId(expandedId === s.sessionId ? null : s.sessionId)}
              />
            ))}
          </div>
        )}

        {liveSessions.length > 0 && (
          <div>
            <SectionHeader
              icon={<Terminal className="w-3.5 h-3.5" style={{ color: "#c0caf5" }} />}
              label="Live sessions"
              count={liveSessions.length}
              tone="#c0caf5"
            />
            {/* Live rows drew a chevron that did nothing — same toggle as every
                other section. ported from public PR #1735, @elhoim */}
            {liveSessions.map((s) => (
              <BoardRow
                key={s.sessionId}
                s={s}
                expanded={expandedId === s.sessionId}
                onToggle={() => setExpandedId(expandedId === s.sessionId ? null : s.sessionId)}
              />
            ))}
          </div>
        )}

        {resumable.length > 0 && (
          <div>
            <SectionHeader
              icon={<Clock className="w-3.5 h-3.5" style={{ color: "#e0af68" }} />}
              label="Resumable"
              count={resumable.length}
              tone="#e0af68"
            />
            {resumable.map((s) => (
              <BoardRow
                key={s.sessionId}
                s={s}
                expanded={expandedId === s.sessionId}
                onToggle={() => setExpandedId(expandedId === s.sessionId ? null : s.sessionId)}
              />
            ))}
          </div>
        )}

        {doneList.length > 0 && (
          <div>
            <SectionHeader
              icon={<span className="text-[13px] leading-none" aria-hidden>{LIFECYCLE_META.cairn.icon}</span>}
              label={LIFECYCLE_META.cairn.label}
              count={doneList.length}
              tone={LIFECYCLE_META.cairn.color}
            />
            {doneList.map((s) => (
              <BoardRow
                key={s.sessionId}
                s={s}
                expanded={expandedId === s.sessionId}
                onToggle={() => setExpandedId(expandedId === s.sessionId ? null : s.sessionId)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
      </>
      )}
    </div>
  );
}
