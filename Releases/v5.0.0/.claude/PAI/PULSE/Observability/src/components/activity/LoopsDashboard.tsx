"use client";

import { useState, useEffect, useCallback } from "react";
import { localOnlyApiCall } from "@/lib/local-api";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Play,
  Pause,
  Square,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
  Repeat,
  FileText,
  Clock,
  Target,
  AlertCircle,
  BookOpen,
  Zap,
  Activity,
} from "lucide-react";

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

// ─── Running Indicator ───
// Animated bars that pulse when a loop is actively iterating

function RunningIndicator() {
  return (
    <div className="flex items-end gap-[2px] h-3.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-blue-400"
          animate={{
            height: ["4px", "14px", "4px"],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── Status Badge ───

function StatusBadge({ status, loopStatus }: { status: string; loopStatus: string | null }) {
  if (status === "COMPLETE") {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[13px] px-1.5 py-0 gap-1">
        <Check className="w-2.5 h-2.5" />
        COMPLETE
      </Badge>
    );
  }
  if (loopStatus === "running") {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[13px] px-1.5 py-0 gap-1">
        <RunningIndicator />
        RUNNING
      </Badge>
    );
  }
  if (loopStatus === "paused") {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[13px] px-1.5 py-0 gap-1">
        <Pause className="w-2.5 h-2.5" />
        PAUSED
      </Badge>
    );
  }
  if (loopStatus === "failed") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[13px] px-1.5 py-0 gap-1">
        <AlertCircle className="w-2.5 h-2.5" />
        FAILED
      </Badge>
    );
  }
  if (loopStatus === "stopped") {
    return (
      <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-[13px] px-1.5 py-0 gap-1">
        <Square className="w-2.5 h-2.5" />
        STOPPED
      </Badge>
    );
  }
  return (
    <Badge className="bg-zinc-800/50 text-zinc-500 border-zinc-700/30 text-[13px] px-1.5 py-0">
      {status}
    </Badge>
  );
}

// ─── Document Icon ───
// Visual ISA icon with dynamic accent color based on state

function ISAIcon({ status, loopStatus }: { status: string; loopStatus: string | null }) {
  const isComplete = status === "COMPLETE";
  const isRunning = loopStatus === "running";
  const isPaused = loopStatus === "paused";
  const isFailed = loopStatus === "failed";

  const accentColor = isComplete
    ? "text-emerald-500"
    : isRunning
    ? "text-blue-400"
    : isPaused
    ? "text-amber-400"
    : isFailed
    ? "text-red-400"
    : "text-zinc-600";

  const bgColor = isComplete
    ? "bg-emerald-500/10"
    : isRunning
    ? "bg-blue-500/10"
    : isPaused
    ? "bg-amber-500/10"
    : isFailed
    ? "bg-red-500/10"
    : "bg-zinc-800/50";

  return (
    <div className={`relative shrink-0 w-9 h-10 rounded-md ${bgColor} flex items-center justify-center`}>
      <FileText className={`w-4.5 h-4.5 ${accentColor}`} />
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-md border border-blue-400/40"
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {isComplete && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check className="w-2 h-2 text-zinc-950" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

// ─── Criteria Checklist ───

function CriteriaList({ criteria }: { criteria: CriterionItem[] }) {
  return (
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
          <span
            className={`text-[14px] leading-relaxed ${
              c.passing ? "text-zinc-300" : "text-zinc-500"
            }`}
          >
            <span className="font-mono text-[13px] text-zinc-600 mr-1.5">{c.id}</span>
            {c.text}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Log Timeline ───

function LogTimeline({ entries }: { entries: LogEntry[] }) {
  if (!entries || entries.length === 0) {
    return <p className="text-[14px] text-zinc-600 italic px-2">No log entries yet</p>;
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-800" />

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-3 relative">
            {/* Timeline dot */}
            <div
              className={`shrink-0 w-[15px] h-[15px] rounded-full border-2 mt-0.5 z-10 ${
                i === 0
                  ? "bg-blue-500/20 border-blue-400"
                  : "bg-zinc-900 border-zinc-700"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-zinc-300 leading-snug">
                {entry.title}
              </p>
              {entry.content && (
                <p className="text-[13px] text-zinc-500 leading-relaxed mt-0.5 line-clamp-2">
                  {entry.content}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Context Section (Problem / Approach) ───

function ContextSection({ icon: Icon, label, content }: {
  icon: React.ElementType;
  label: string;
  content: string;
}) {
  if (!content) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-zinc-600" />
        <span className="text-[13px] text-zinc-600 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-[14px] text-zinc-400 leading-relaxed pl-[18px]">
        {content}
      </p>
    </div>
  );
}

// ─── ISA Card ───

function ISACard({
  isa,
  isExpanded,
  onToggle,
  onAction,
  actionLoading,
}: {
  isa: ISASummary;
  isExpanded: boolean;
  onToggle: () => void;
  onAction: (action: string, filename: string) => void;
  actionLoading: string | null;
}) {
  const { frontmatter, title, oneLiner, criteria, totalCriteria, passingCriteria } = isa;
  const progressPct = totalCriteria > 0 ? (passingCriteria / totalCriteria) * 100 : 0;
  const isComplete = frontmatter.status === "COMPLETE";
  const isRunning = frontmatter.loopStatus === "running";
  const isPaused = frontmatter.loopStatus === "paused";

  // Format relative time from ISO date
  const updatedAgo = formatRelativeTime(frontmatter.updated);

  return (
    <motion.div
      layout
      className={`rounded-lg border transition-colors overflow-hidden ${
        isComplete
          ? "border-emerald-500/20 bg-emerald-500/[0.02]"
          : isRunning
          ? "border-blue-500/25 bg-blue-500/[0.03]"
          : "border-white/[0.06] bg-white/[0.015]"
      }`}
    >
      {/* ─── Running glow bar ─── */}
      {isRunning && (
        <motion.div
          className="h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* ─── Complete bar ─── */}
      {isComplete && <div className="h-[2px] bg-emerald-500/60" />}

      {/* ─── Card Header (always visible) ─── */}
      <div
        className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        {/* ISA document icon */}
        <ISAIcon status={frontmatter.status} loopStatus={frontmatter.loopStatus} />

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-medium text-zinc-200 truncate">{title}</span>
            <StatusBadge status={frontmatter.status} loopStatus={frontmatter.loopStatus} />
          </div>
          {oneLiner && (
            <p className="text-[14px] text-zinc-500 mt-0.5 truncate">{oneLiner}</p>
          )}
          {/* Meta row: ISA ID + updated time */}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[13px] font-mono text-zinc-600">{frontmatter.id}</span>
            {updatedAgo && (
              <span className="flex items-center gap-1 text-[13px] text-zinc-600">
                <Clock className="w-2.5 h-2.5" />
                {updatedAgo}
              </span>
            )}
          </div>
        </div>

        {/* Right side metrics */}
        <div className="flex items-center gap-4 shrink-0 mt-0.5">
          {/* Criteria progress */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-mono text-zinc-400">
                {passingCriteria}<span className="text-zinc-600">/{totalCriteria}</span>
              </span>
            </div>
            <div className="w-24">
              <Progress
                value={progressPct}
                className={`h-1.5 ${
                  isComplete
                    ? "[&>div]:bg-emerald-500"
                    : isRunning
                    ? "[&>div]:bg-blue-400"
                    : "[&>div]:bg-zinc-500"
                }`}
              />
            </div>
          </div>

          {/* Iteration counter */}
          <div className="flex items-center gap-1.5 text-[14px] text-zinc-500 shrink-0">
            <Repeat className="w-3 h-3" />
            <span className="font-mono">
              {frontmatter.iteration}<span className="text-zinc-700">/</span>{frontmatter.maxIterations}
            </span>
          </div>

          {/* Expand chevron */}
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
          </motion.div>
        </div>
      </div>

      {/* ─── Expanded Content ─── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <Separator className="bg-white/[0.04]" />

            {/* ─── Control Bar ─── */}
            <div className="px-4 py-2 flex items-center gap-2">
              {!isComplete && !isRunning && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction("start", isa.filename); }}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 text-[14px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "start" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  Start Loop
                </button>
              )}
              {isRunning && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction("pause", isa.filename); }}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-400 text-[14px] font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                >
                  <Pause className="w-3 h-3" />
                  Pause
                </button>
              )}
              {isPaused && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction("resume", isa.filename); }}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 text-[14px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                >
                  <Play className="w-3 h-3" />
                  Resume
                </button>
              )}
              {(isRunning || isPaused) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction("stop", isa.filename); }}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[14px] font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              )}

              {/* Status table pills */}
              {isa.statusTable && Object.keys(isa.statusTable).length > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  {Object.entries(isa.statusTable).slice(0, 4).map(([key, value]) => (
                    <span
                      key={key}
                      className="text-[13px] font-mono text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded"
                    >
                      {key}: <span className="text-zinc-400">{value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Separator className="bg-white/[0.04]" />

            {/* ─── Problem + Approach context ─── */}
            {(isa.problem || isa.approach) && (
              <>
                <div className="px-4 py-3 space-y-3">
                  <ContextSection icon={Target} label="Problem" content={isa.problem} />
                  <ContextSection icon={Zap} label="Approach" content={isa.approach} />
                </div>
                <Separator className="bg-white/[0.04]" />
              </>
            )}

            {/* ─── Criteria + Log split ─── */}
            <div className="grid grid-cols-2 divide-x divide-white/[0.04]">
              {/* Criteria checklist */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <BookOpen className="w-3 h-3 text-zinc-600" />
                  <span className="text-[13px] text-zinc-600 uppercase tracking-wider font-medium">
                    Criteria
                  </span>
                  <span className="text-[13px] font-mono text-zinc-600 ml-auto">
                    {passingCriteria}/{totalCriteria}
                  </span>
                </div>
                <CriteriaList criteria={criteria} />
              </div>

              {/* Log timeline */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <Activity className="w-3 h-3 text-zinc-600" />
                  <span className="text-[13px] text-zinc-600 uppercase tracking-wider font-medium">
                    Activity Log
                  </span>
                </div>
                <LogTimeline entries={isa.logEntries || []} />
                {/* Fallback if only lastLogEntry exists */}
                {(!isa.logEntries || isa.logEntries.length === 0) && isa.lastLogEntry && (
                  <pre className="text-[14px] text-zinc-500 whitespace-pre-wrap leading-relaxed font-mono px-2">
                    {isa.lastLogEntry}
                  </pre>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Helpers ───

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

// ─── Main Dashboard ───

export default function LoopsDashboard() {
  const [prds, setISAs] = useState<ISASummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchISAs = useCallback(async () => {
    try {
      const data = await localOnlyApiCall<{ prds?: ISASummary[] }>("/api/loops");
      setISAs(data.prds || []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch + polling: 5s when running, 30s otherwise
  useEffect(() => {
    fetchISAs();
    const hasRunning = prds.some((p) => p.frontmatter.loopStatus === "running");
    const interval = setInterval(fetchISAs, hasRunning ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [fetchISAs, prds.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Loading state ───
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm">Loading ISAs...</span>
      </div>
    );
  }

  // ─── Error state ───
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      </div>
    );
  }

  // ─── Empty state ───
  if (prds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
        <div className="w-14 h-16 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
          <FileText className="w-7 h-7 text-zinc-700" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-400">No ISAs found</p>
          <p className="text-[14px] text-zinc-600 mt-1">
            ISAs are created by the Algorithm and stored in {process.env.NEXT_PUBLIC_CLAUDE_PLANS_DIR || "~/.claude/plans"}/
          </p>
        </div>
      </div>
    );
  }

  // ─── Sort: running > paused > in-progress > other > complete ───
  const sorted = [...prds].sort((a, b) => {
    const order = (p: ISASummary) => {
      if (p.frontmatter.loopStatus === "running") return 0;
      if (p.frontmatter.loopStatus === "paused") return 1;
      if (p.frontmatter.status === "IN_PROGRESS") return 2;
      if (p.frontmatter.status === "COMPLETE") return 4;
      return 3;
    };
    return order(a) - order(b);
  });

  const runningCount = prds.filter((p) => p.frontmatter.loopStatus === "running").length;
  const completeCount = prds.filter((p) => p.frontmatter.status === "COMPLETE").length;
  const totalCriteria = prds.reduce((sum, p) => sum + p.totalCriteria, 0);
  const passingCriteria = prds.reduce((sum, p) => sum + p.passingCriteria, 0);
  const overallPct = totalCriteria > 0 ? Math.round((passingCriteria / totalCriteria) * 100) : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ─── Summary header ─── */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 text-[14px] text-zinc-400">
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span className="font-medium text-zinc-200">{prds.length}</span>
            <span className="text-zinc-500">ISAs</span>
          </div>

          {runningCount > 0 && (
            <div className="flex items-center gap-1.5 text-[14px]">
              <RunningIndicator />
              <span className="font-medium text-blue-400">{runningCount}</span>
              <span className="text-blue-400/60">running</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[14px]">
            <Check className="w-3 h-3 text-emerald-500" />
            <span className="font-medium text-emerald-400">{completeCount}</span>
            <span className="text-zinc-500">complete</span>
          </div>

          <Separator orientation="vertical" className="h-4 bg-zinc-800" />

          <div className="flex items-center gap-2 text-[14px]">
            <span className="text-zinc-500">Criteria:</span>
            <span className="font-mono text-zinc-300">{passingCriteria}/{totalCriteria}</span>
            <div className="w-16">
              <Progress value={overallPct} className="h-1 [&>div]:bg-zinc-400" />
            </div>
          </div>
        </div>

        <button
          onClick={fetchISAs}
          className="flex items-center gap-1.5 text-[14px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-white/[0.04]"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* ─── ISA list ─── */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-2">
          {sorted.map((isa) => (
            <ISACard
              key={isa.frontmatter.id}
              isa={isa}
              isExpanded={expandedId === isa.frontmatter.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === isa.frontmatter.id ? null : isa.frontmatter.id))
              }
              onAction={handleAction}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
