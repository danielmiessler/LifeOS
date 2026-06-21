"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { usePAIEvents, type PAIEvent } from "@/hooks/usePAIEvents";
import type { HookEvent } from "@/hooks/useAgentEvents";
import type { TimeRange } from "@/hooks/useChartData";
import LivePulseChart from "./LivePulseChart";
import AgentSwimLane from "./AgentSwimLane";
import EventTimeline from "./EventTimeline";

// ─── Time Range Options ───

const TIME_RANGES: TimeRange[] = ["1M", "2M", "4M", "8M", "16M"];

// ─── Transform PAIEvent → HookEvent ───
// Remap historical timestamps into the current time window so the chart renders bars.
// The EventTimeline shows relative time ("2m ago") so remapped times still make sense.

// Deterministic hash for stable event IDs across poll cycles (djb2)
function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function toHookEvents(paiEvents: PAIEvent[]): HookEvent[] {
  if (paiEvents.length === 0) return [];

  return paiEvents.map((e) => {
    const rawTs = typeof e.timestamp === "string" ? new Date(e.timestamp).getTime() : (e.timestamp as number);
    const subagentType = (e.subagent_type as string) || undefined;
    const description = (e.description as string) || undefined;
    const promptPreview = (e.prompt_preview as string) || undefined;
    const isSubagent = (e.source as string) === "subagent";

    return {
      id: hashString(`${e.timestamp}|${e.session_id}|${e.type}|${e.source}|${e.subagent_id || ""}`),
      source_app: (e.source as string) || "unknown",
      session_id: e.session_id || "",
      hook_event_type: mapEventType(e.type, e.source),
      payload: extractPayload(e),
      summary: isSubagent
        ? (description || promptPreview || (e.message as string) || undefined)
        : ((e.message as string) || description || (e.change_summary as string) || (e.error as string) || undefined),
      timestamp: rawTs,
      model_name: (e.model as string) || (e.subagent_model as string) || undefined,
      agent_name: isSubagent
        ? (subagentType && subagentType !== "unknown" ? subagentType : "subagent")
        : ((e.source as string) || undefined),
    };
  });
}

function mapEventType(type: string, source: string): string {
  if (type.includes("tool_failure") || source === "tool-failure") return "PostToolUse";
  if (type.includes("tool_use") || source === "tool-activity") return "PostToolUse";
  if (type.includes("subagent") || source === "subagent") return "PreToolUse";
  if (type.includes("config") || source === "config") return "Notification";
  if (type.includes("session")) return "SessionStart";
  return "Notification";
}

function extractPayload(e: PAIEvent): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(e)) {
    if (!["timestamp", "session_id", "source", "type"].includes(k)) {
      payload[k] = v;
    }
  }
  if (e.tool_name) payload.tool_name = e.tool_name;
  return payload;
}

// ─── Main Component ───

export default function ObservabilityDashboard() {
  const { events: paiEvents } = usePAIEvents();

  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const heatLevelRef = useRef<{ intensity: number; color: string; label: string }>({
    intensity: 0,
    color: "#565f89",
    label: "Idle",
  });
  const eventsPerMinuteRef = useRef(0);
  // Stable callbacks that write to refs instead of state (prevents re-render cascade)
  const handleHeatUpdate = useCallback((h: { intensity: number; color: string; label: string }) => {
    heatLevelRef.current = h;
  }, []);
  const handleEventsPerMinuteUpdate = useCallback((epm: number) => {
    eventsPerMinuteRef.current = epm;
  }, []);

  // Transform PAIEvents → HookEvents (original timestamps for stable React keys)
  const events: HookEvent[] = useMemo(
    () => toHookEvents(paiEvents),
    [paiEvents]
  );

  const handleAgentPillClick = useCallback((agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* LivePulseChart — skills/workflows/tools header + agent pills + canvas chart */}
      <LivePulseChart
        events={events}
        externalTimeRange={timeRange}
        onHeatUpdate={handleHeatUpdate}
        onEventsPerMinuteUpdate={handleEventsPerMinuteUpdate}
        onTimeRangeChange={setTimeRange}
        onAgentPillClick={handleAgentPillClick}
      />

      {/* Agent Swim Lanes — toggled by clicking agent pills */}
      {selectedAgents.length > 0 && (
        <div className="px-5 py-3 border-t border-white/[0.04]">
          {selectedAgents.map((agentId) => (
            <AgentSwimLane
              key={agentId}
              agentName={agentId}
              events={events}
              timeRange={timeRange}
              onClose={() =>
                setSelectedAgents((prev) => prev.filter((id) => id !== agentId))
              }
            />
          ))}
        </div>
      )}

      {/* Event Timeline — intensity bar + event list */}
      <div className="flex-1 overflow-hidden flex flex-col border-t border-white/[0.04]">
        <EventTimeline
          events={events}
          heatLevel={heatLevelRef.current}
          eventsPerMinute={eventsPerMinuteRef.current}
          timeRange={timeRange}
          timeRanges={TIME_RANGES}
          onSetTimeRange={setTimeRange}
        />
      </div>
    </div>
  );
}
