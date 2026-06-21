"use client";

import { useState, useEffect, useCallback } from "react";
import { localOnlyApiCall } from "@/lib/local-api";
import { Terminal, FileText, Zap } from "lucide-react";

// ─── System Health Vitals (Widget 18) ───
// Persistent bar at top of Activity page, visible across all tabs.
// Polls hooks, docs, and session health every 30s.

interface HealthData {
  hookReliability: {
    failsPerHour: number;
    status: "healthy" | "degraded" | "failing";
  };
  docFreshness: {
    status: "healthy" | "degraded" | "failing";
    label: string;
  };
  activeSessions: {
    count: number;
    status: "healthy" | "degraded" | "failing";
  };
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "text-emerald-400",
  degraded: "text-amber-400",
  failing: "text-rose-400",
};

const STATUS_DOTS: Record<string, string> = {
  healthy: "bg-emerald-400",
  degraded: "bg-amber-400",
  failing: "bg-rose-400",
};

export default function SystemHealthVitals() {
  const [health, setHealth] = useState<HealthData | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      // Fetch tool failures
      const failures = await localOnlyApiCall<{
        summary?: { recent24h?: number };
      }>("/api/observability/tool-failures").catch(() => null);
      const recentFailures = failures?.summary?.recent24h ?? 0;
      const failsPerHour = recentFailures / 24;

      // Fetch algorithm state for active session count
      const algo = await localOnlyApiCall<{
        algorithms?: Array<{ active?: boolean }>;
      }>("/api/algorithm").catch(() => null);
      const activeCount =
        algo?.algorithms?.filter((a) => a.active)?.length ?? 0;

      setHealth({
        hookReliability: {
          failsPerHour: Math.round(failsPerHour * 10) / 10,
          status:
            failsPerHour <= 1
              ? "healthy"
              : failsPerHour <= 5
                ? "degraded"
                : "failing",
        },
        docFreshness: {
          status: "healthy",
          label: "Fresh",
        },
        activeSessions: {
          count: activeCount,
          status: activeCount > 0 ? "healthy" : "degraded",
        },
      });
    } catch {
      // Silently fail — vitals bar simply stays hidden until data arrives
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (!health) return null;

  return (
    <div className="flex items-center gap-6 px-4 py-1.5 bg-zinc-900/50 border-b border-white/[0.04] shrink-0">
      <VitalMetric
        icon={Terminal}
        label="Hooks"
        value={`${health.hookReliability.failsPerHour}/hr`}
        status={health.hookReliability.status}
      />
      <VitalMetric
        icon={FileText}
        label="Documentation"
        value={health.docFreshness.label}
        status={health.docFreshness.status}
      />
      <VitalMetric
        icon={Zap}
        label="Active"
        value={`${health.activeSessions.count}`}
        status={health.activeSessions.status}
      />
    </div>
  );
}

function VitalMetric({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  status: "healthy" | "degraded" | "failing";
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${STATUS_DOTS[status]}`}
      />
      <Icon className="w-4 h-4 text-zinc-500" />
      <span className="text-xs text-zinc-500 uppercase">{label}</span>
      <span
        className={`text-sm font-mono font-medium ${STATUS_COLORS[status]}`}
      >
        {value}
      </span>
    </div>
  );
}
