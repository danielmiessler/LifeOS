"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { usePAIEvents, type PAIEvent } from "@/hooks/usePAIEvents";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radio,
  Trash2,
  Filter,
  ChevronDown,
  Zap,
  Eye,
  Brain,
  Hammer,
  CheckCircle2,
  BookOpen,
  MessageSquare,
  GitBranch,
  FileText,
  Box,
} from "lucide-react";

// ─── Event type styling ───

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "algorithm": { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  "work": { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  "hook": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  "session": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  "rating": { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  "learning": { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  "isa": { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20" },
  "doc": { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  "build": { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  "system": { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
  "settings": { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  "tab": { bg: "bg-lime-500/10", text: "text-lime-400", border: "border-lime-500/20" },
  "custom": { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20" },
};

function getTypeStyle(type: string) {
  const prefix = type.split(".")[0];
  return TYPE_COLORS[prefix] || { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" };
}

function getTypeIcon(type: string) {
  const prefix = type.split(".")[0];
  switch (prefix) {
    case "algorithm": return Brain;
    case "work": return Hammer;
    case "hook": return GitBranch;
    case "session": return MessageSquare;
    case "rating": return CheckCircle2;
    case "learning": return BookOpen;
    case "isa": return FileText;
    case "doc": return FileText;
    case "build": return Hammer;
    case "system": return Box;
    case "settings": return Box;
    case "tab": return Eye;
    case "custom": return Zap;
    default: return Zap;
  }
}

function formatTime(ts: string | number): string {
  try {
    const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const s = d.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  } catch {
    return "--:--:--";
  }
}

function formatRelativeTime(ts: string | number): string {
  try {
    const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
    const diff = Date.now() - d.getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  } catch {
    return "";
  }
}

// ─── Filter presets ───

const FILTER_PRESETS = [
  { label: "All", value: "" },
  { label: "Algorithm", value: "algorithm.*" },
  { label: "Work", value: "work.*" },
  { label: "Hook", value: "hook.*" },
  { label: "Session", value: "session.*" },
  { label: "Rating", value: "rating.*" },
  { label: "Learning", value: "learning.*" },
  { label: "ISA", value: "isa.*" },
  { label: "Doc", value: "doc.*" },
  { label: "Build", value: "build.*" },
  { label: "System", value: "system.*" },
  { label: "Tab", value: "tab.*" },
];

// ─── Event Row ───

function PAIEventRow({ event }: { event: PAIEvent }) {
  const [expanded, setExpanded] = useState(false);
  const style = getTypeStyle(event.type);
  const Icon = getTypeIcon(event.type);

  // Extract meaningful summary from event data
  const summary = (() => {
    if (typeof event.message === "string") return event.message;
    if (typeof event.description === "string") return event.description;
    if (typeof event.phase === "string") return event.phase;
    if (typeof event.action === "string") return event.action;
    return "";
  })();

  // Build extra detail keys (everything except the base fields)
  const detailKeys = Object.keys(event).filter(
    (k) => !["timestamp", "session_id", "source", "type", "message", "description"].includes(k)
  );

  return (
    <div
      className={`group px-3 py-1.5 hover:bg-white/[0.02] transition-colors cursor-pointer ${
        expanded ? "bg-white/[0.015]" : ""
      }`}
      onClick={() => detailKeys.length > 0 && setExpanded(!expanded)}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Type icon */}
        <Icon className={`w-3.5 h-3.5 shrink-0 ${style.text}`} />

        {/* Type badge */}
        <span
          className={`shrink-0 px-1.5 py-0.5 rounded text-[13px] font-mono font-medium border ${style.bg} ${style.text} ${style.border}`}
        >
          {event.type}
        </span>

        {/* Source */}
        <span className="shrink-0 text-[13px] text-zinc-600 font-mono">
          {event.source}
        </span>

        {/* Summary */}
        {summary && (
          <span className="text-xs text-zinc-400 truncate flex-1 min-w-0">
            {summary}
          </span>
        )}

        {/* Session ID (abbreviated) */}
        <span className="shrink-0 text-[13px] text-zinc-700 font-mono">
          {event.session_id?.slice(0, 8) || ""}
        </span>

        {/* Timestamp */}
        <span
          className="shrink-0 text-[13px] text-zinc-600 font-mono w-16 text-right"
          title={formatTime(event.timestamp)}
        >
          {formatRelativeTime(event.timestamp)}
        </span>

        {/* Expand indicator */}
        {detailKeys.length > 0 && (
          <ChevronDown
            className={`w-3 h-3 text-zinc-700 shrink-0 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        )}
      </div>

      {/* Expanded detail */}
      {expanded && detailKeys.length > 0 && (
        <div className="mt-1.5 ml-6 pl-2 border-l border-white/[0.06] space-y-0.5">
          {detailKeys.map((k) => {
            const val = event[k];
            const display =
              typeof val === "object" ? JSON.stringify(val) : String(val);
            return (
              <div key={k} className="flex items-start gap-2 text-[14px]">
                <span className="text-zinc-600 font-mono shrink-0">{k}:</span>
                <span className="text-zinc-400 break-all">{display}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───

export default function LiveEvents() {
  const { events, filteredEvents, clearEvents } = usePAIEvents();
  const [filter, setFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const displayEvents = useMemo(() => {
    return filter ? filteredEvents(filter) : events;
  }, [events, filter, filteredEvents]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayEvents.length, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  };

  // Unique type prefixes for dynamic filter chips
  const activeTypes = useMemo(() => {
    const prefixes = new Set<string>();
    for (const e of events) {
      const prefix = e.type.split(".")[0];
      if (prefix) prefixes.add(prefix);
    }
    return Array.from(prefixes).sort();
  }, [events]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Live Events
          </span>
          <span className="text-xs text-zinc-600 font-mono">
            {displayEvents.length}
            {filter ? ` / ${events.length}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
              filter
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {filter ? filter : "Filter"}
          </button>

          {/* Clear */}
          <button
            onClick={clearEvents}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/[0.04] flex-wrap">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setFilter(preset.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === preset.value
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                  : "text-zinc-500 hover:text-zinc-300 bg-white/[0.02] hover:bg-white/[0.05] border border-transparent"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Event list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {displayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="bg-white/[0.03] p-6 rounded-2xl mb-4">
              <Box size={40} className="text-[#414868]" />
            </div>
            <p className="text-base font-medium text-[#9aa5ce] mb-1">
              No events yet
            </p>
            <p className="text-sm text-[#414868]">
              Events from events.jsonl will appear here in real-time
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {displayEvents.map((event, i) => (
              <PAIEventRow key={`${event.timestamp}-${event.type}-${i}`} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && displayEvents.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
        >
          Scroll to latest
        </button>
      )}
    </div>
  );
}
