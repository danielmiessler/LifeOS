"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Cpu,
  Zap,
  Clock,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import EmptyStateGuide from "@/components/EmptyStateGuide";

type Tab = "cost" | "failures" | "anthropic";
type Dimension = "money" | "creative" | "freedom" | "health" | "rhythms" | "relationships";

interface AnthropicSnapshot {
  ts: string;
  subscription: { five_hour_pct: number | null; seven_day_pct: number | null };
  api_spend: { month_used_usd: number | null; source: string };
  call_sites: { total: number; bypass: number; legit: number; new_since_baseline: string[] };
  alerts: string[];
}

interface AnthropicCallSite {
  file: string;
  line: number;
  classification: "bypass" | "legit" | "unknown";
  reason: string;
}

interface AnthropicData {
  current: AnthropicSnapshot | null;
  history: AnthropicSnapshot[];
  total_entries: number;
  sites: AnthropicCallSite[];
  baseline_updated: string | null;
}

interface CostData {
  days: number;
  totalSessions: number;
  totalCost: number;
  totalTokens: number;
  avgCostPerSession: number;
  costBreakdown: { input: number; output: number; cacheWrite: number; cacheRead: number };
  byModel: Array<{ model: string; cost: number; sessions: number; tokens: number }>;
  dailyCosts: Array<{ day: string; cost: number }>;
  topSessions: Array<{
    sessionId: string;
    project: string;
    primaryModel: string;
    messageCount: number;
    costTotal: number;
    totalTokens: number;
    firstTimestamp: string;
    lastTimestamp: string;
  }>;
}

interface FailureData {
  totalFailures: number;
  totalCalls: number;
  overallRate: number;
  byTool: Array<{ tool: string; failures: number; calls: number; failureRate: number }>;
  trend: Array<{ day: string; failures: number; total: number; rate: number }>;
}

const dimColors: Record<Dimension, string> = {
  money: "var(--money)",
  creative: "var(--creative)",
  freedom: "var(--freedom)",
  health: "var(--health)",
  rhythms: "var(--rhythms)",
  relationships: "var(--relationships)",
};

const dimTints: Record<Dimension, string> = {
  money: "rgba(224,164,88,0.16)",
  creative: "rgba(248,123,123,0.16)",
  freedom: "rgba(125,211,252,0.16)",
  health: "rgba(52,211,153,0.16)",
  rhythms: "rgba(45,212,191,0.16)",
  relationships: "rgba(183,148,244,0.16)",
};

function formatCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function shortModel(m: string): string {
  if (m.includes("opus")) return "Opus";
  if (m.includes("haiku")) return "Haiku";
  if (m.includes("sonnet")) return "Sonnet";
  return m.slice(0, 20);
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  dimension = "money",
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub?: string;
  dimension?: Dimension;
}) {
  return (
    <div className="telos-card metric" style={{ cursor: "default" }}>
      <div className="metric-top">
        <Icon className="w-3.5 h-3.5" style={{ color: dimColors[dimension] }} />
        <span className="metric-label muted">{label}</span>
      </div>
      <div className="metric-row">
        <span className="metric-val mono" style={{ color: dimColors[dimension] }}>{value}</span>
      </div>
      {sub && <div className="metric-foot muted">{sub}</div>}
    </div>
  );
}

function CostTab({ data }: { data: CostData | null }) {
  if (!data) return <div className="p-8 muted">Loading cost data...</div>;

  const maxDaily = Math.max(...data.dailyCosts.map((d) => d.cost), 1);
  const isEmpty = data.totalSessions === 0 && data.totalCost === 0 && data.totalTokens === 0;

  return (
    <div className="p-4 space-y-6">
      {isEmpty && (
        <EmptyStateGuide
          section="Performance"
          description="Runtime telemetry — tool latency, model timing, agent durations. Populates as you use PAI."
          hideInterview
          daPromptExample="show me where my sessions are spending time"
        />
      )}
      {/* Summary cards */}
      <div className="metric-grid">
        <StatCard
          icon={DollarSign}
          label={`Total (${data.days}d)`}
          value={formatCost(data.totalCost)}
          sub={`${data.totalSessions.toLocaleString()} sessions`}
        />
        <StatCard icon={TrendingUp} label="Avg / Session" value={formatCost(data.avgCostPerSession)} />
        <StatCard icon={Cpu} label="Total Tokens" value={formatTokens(data.totalTokens)} />
        <StatCard
          icon={Zap}
          label="Cache Read $"
          value={formatCost(data.costBreakdown.cacheRead)}
          sub={`${Math.round((data.costBreakdown.cacheRead / Math.max(data.totalCost, 0.01)) * 100)}% of total`}
        />
      </div>

      {/* Cost breakdown */}
      <div className="telos-card" style={{ cursor: "default" }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: "#E8EFFF" }}>Cost Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Input", val: data.costBreakdown.input, color: "#E0A458" },
            { label: "Output", val: data.costBreakdown.output, color: "#F87B7B" },
            { label: "Cache Write", val: data.costBreakdown.cacheWrite, color: "#2DD4BF" },
            { label: "Cache Read", val: data.costBreakdown.cacheRead, color: "#34D399" },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <span className="text-xs muted">{item.label}</span>
              </div>
              <div className="text-lg font-medium" style={{ color: "#E8EFFF" }}>{formatCost(item.val)}</div>
              <div className="text-xs muted">
                {Math.round((item.val / Math.max(data.totalCost, 0.01)) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model breakdown */}
      <div className="telos-card" style={{ cursor: "default" }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: "#E8EFFF" }}>Cost by Model</h3>
        <div className="space-y-2">
          {data.byModel.map((m) => (
            <div key={m.model} className="flex items-center gap-3">
              <span className="text-xs w-20 shrink-0" style={{ color: "#D6E1F5" }}>{shortModel(m.model)}</span>
              <div className="progress-bar flex-1" style={{ height: 20, margin: 0 }}>
                <div
                  className="progress-fill flex items-center px-2"
                  style={{
                    width: `${Math.max((m.cost / Math.max(data.totalCost, 1)) * 100, 8)}%`,
                    background: "linear-gradient(90deg, #E0A458, #F0A35E)",
                  }}
                >
                  <span className="text-[10px] whitespace-nowrap" style={{ color: "#060B1A", fontWeight: 600 }}>
                    {formatCost(m.cost)} · {m.sessions} sessions
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily trend */}
      {data.dailyCosts.length > 1 && (
        <div className="telos-card" style={{ cursor: "default" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "#E8EFFF" }}>Daily Cost Trend</h3>
          <div className="flex items-end gap-1 h-32">
            {data.dailyCosts.slice(-30).map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t-sm min-h-[2px] transition-all"
                  style={{
                    height: `${(d.cost / maxDaily) * 100}%`,
                    background: "linear-gradient(180deg, #F0A35E, #E0A458)",
                  }}
                  title={`${d.day}: ${formatCost(d.cost)}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] muted">{data.dailyCosts[0]?.day?.slice(5)}</span>
            <span className="text-[10px] muted">
              {data.dailyCosts[data.dailyCosts.length - 1]?.day?.slice(5)}
            </span>
          </div>
        </div>
      )}

      {/* Top sessions */}
      <div className="telos-card" style={{ cursor: "default" }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: "#E8EFFF" }}>Most Expensive Sessions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #1A2A4D" }}>
                <th className="text-left py-2 pr-3 muted">Cost</th>
                <th className="text-left py-2 pr-3 muted">Model</th>
                <th className="text-right py-2 pr-3 muted">Msgs</th>
                <th className="text-right py-2 pr-3 muted">Tokens</th>
                <th className="text-left py-2 muted">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.topSessions.slice(0, 15).map((s) => (
                <tr
                  key={s.sessionId}
                  style={{ borderBottom: "1px solid rgba(26,42,77,0.5)" }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#12203D")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="py-2 pr-3 font-medium" style={{ color: "#E8EFFF" }}>{formatCost(s.costTotal)}</td>
                  <td className="py-2 pr-3" style={{ color: "#D6E1F5" }}>{shortModel(s.primaryModel)}</td>
                  <td className="py-2 pr-3 text-right" style={{ color: "#9BB0D6" }}>{s.messageCount}</td>
                  <td className="py-2 pr-3 text-right" style={{ color: "#9BB0D6" }}>{formatTokens(s.totalTokens)}</td>
                  <td className="py-2 muted">{(s.lastTimestamp || "").slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FailuresTab({ data }: { data: FailureData | null }) {
  if (!data) return <div className="p-8 muted">Loading failure data...</div>;

  return (
    <div className="p-4 space-y-6">
      {/* Summary cards */}
      <div className="metric-grid">
        <StatCard
          icon={AlertTriangle}
          label="Overall Failure Rate"
          value={`${data.overallRate}%`}
          sub={`${data.totalFailures.toLocaleString()} failures / ${data.totalCalls.toLocaleString()} calls`}
          dimension="creative"
        />
        <StatCard
          icon={BarChart3}
          label="Top Offender"
          value={data.byTool[0]?.tool || "—"}
          sub={`${data.byTool[0]?.failures ?? 0} failures (${data.byTool[0]?.failureRate ?? 0}%)`}
          dimension="creative"
        />
        <StatCard
          icon={Clock}
          label="Trend"
          value={
            data.trend.length >= 2
              ? `${data.trend[data.trend.length - 1]?.rate ?? 0}%`
              : "—"
          }
          sub="Most recent day"
          dimension="creative"
        />
      </div>

      {/* Daily trend */}
      {data.trend.length > 1 && (
        <div className="telos-card" style={{ cursor: "default" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "#E8EFFF" }}>7-Day Failure Rate</h3>
          <div className="flex items-end gap-2 h-24">
            {data.trend.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-[10px] muted">{d.rate}%</span>
                <div
                  className="w-full rounded-t-sm min-h-[2px]"
                  style={{
                    height: `${Math.min(d.rate * 5, 100)}%`,
                    background: "linear-gradient(180deg, #F87B7B, #F0A35E)",
                  }}
                />
                <span className="text-[10px] muted">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-tool table */}
      <div className="telos-card" style={{ cursor: "default" }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: "#E8EFFF" }}>Failure Rate by Tool</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #1A2A4D" }}>
                <th className="text-left py-2 pr-4 muted">Tool</th>
                <th className="text-right py-2 pr-4 muted">Failures</th>
                <th className="text-right py-2 pr-4 muted">Total Calls</th>
                <th className="text-right py-2 pr-4 muted">Rate</th>
                <th className="text-left py-2 muted" style={{ width: "30%" }}>Bar</th>
              </tr>
            </thead>
            <tbody>
              {data.byTool
                .filter((t) => t.failures > 0)
                .map((t) => (
                  <tr
                    key={t.tool}
                    style={{ borderBottom: "1px solid rgba(26,42,77,0.5)" }}
                    className="transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#12203D")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="py-2 pr-4 font-medium" style={{ color: "#E8EFFF" }}>{t.tool}</td>
                    <td className="py-2 pr-4 text-right coral-down">{t.failures}</td>
                    <td className="py-2 pr-4 text-right" style={{ color: "#9BB0D6" }}>{t.calls.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right" style={{ color: "#E8EFFF" }}>{t.failureRate}%</td>
                    <td className="py-2">
                      <div className="progress-bar" style={{ height: 10, margin: 0 }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(t.failureRate * 2, 100)}%`,
                            background: "linear-gradient(90deg, #F87171, #FBBF24)",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AnthropicTab({ data }: { data: AnthropicData | null }) {
  if (!data) return <div className="p-8 muted">Loading Anthropic cost data...</div>;
  if (!data.current)
    return (
      <div className="p-8 muted">
        No ledger entries yet. CostTracker cron runs hourly — next entry at :00.
        Run manually: <code>bun $PAI_DIR/TOOLS/CostTracker.ts log</code>
      </div>
    );

  const snap = data.current;
  const fiveH = snap.subscription.five_hour_pct ?? 0;
  const sevenD = snap.subscription.seven_day_pct ?? 0;
  const apiSpend = snap.api_spend.month_used_usd;
  const bypassSites = data.sites.filter((s) => s.classification === "bypass");
  const legitSites = data.sites.filter((s) => s.classification === "legit");
  const unknownSites = data.sites.filter((s) => s.classification === "unknown");

  return (
    <div className="p-4 space-y-6">
      {/* Alerts */}
      {snap.alerts.length > 0 && (
        <div
          className="telos-card"
          style={{ borderColor: "rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.08)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" style={{ color: "#F87171" }} />
            <span className="text-sm font-medium" style={{ color: "#F87171" }}>
              Active Alerts
            </span>
          </div>
          <ul className="text-sm space-y-1" style={{ color: "#FCA5A5" }}>
            {snap.alerts.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary cards */}
      <div className="metric-grid">
        <StatCard
          icon={ShieldCheck}
          label="Subscription 5h"
          value={`${fiveH}%`}
          sub={fiveH > 80 ? "approaching cap" : "healthy"}
        />
        <StatCard
          icon={TrendingUp}
          label="Subscription 7d"
          value={`${sevenD}%`}
          sub={sevenD > 80 ? "approaching cap" : "healthy"}
        />
        <StatCard
          icon={DollarSign}
          label="API Spend MTD"
          value={apiSpend !== null ? `$${apiSpend.toFixed(2)}` : "—"}
          sub={apiSpend !== null ? snap.api_spend.source : "set ANTHROPIC_ADMIN_API_KEY"}
        />
        <StatCard
          icon={bypassSites.length > 0 ? XCircle : CheckCircle2}
          label="Bypass call sites"
          value={String(bypassSites.length)}
          sub={bypassSites.length === 0 ? "✅ all guarded" : "🚨 review and patch"}
        />
      </div>

      {/* Call sites inventory */}
      <div className="telos-card" style={{ cursor: "default" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium" style={{ color: "#E8EFFF" }}>
            Call Sites ({data.sites.length})
          </h3>
          <span className="text-xs muted">
            baseline: {data.baseline_updated ? new Date(data.baseline_updated).toLocaleString() : "none"}
          </span>
        </div>
        <div className="space-y-1" style={{ fontSize: 12 }}>
          {bypassSites.map((s, i) => (
            <div key={`b-${i}`} className="flex items-start gap-2 py-1">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#F87171" }} />
              <div className="flex-1 min-w-0">
                <div className="mono truncate" style={{ color: "#FCA5A5" }}>
                  {s.file}:{s.line}
                </div>
                <div className="muted text-[11px]">{s.reason}</div>
              </div>
            </div>
          ))}
          {unknownSites.map((s, i) => (
            <div key={`u-${i}`} className="flex items-start gap-2 py-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#FBBF24" }} />
              <div className="flex-1 min-w-0">
                <div className="mono truncate" style={{ color: "#FDE68A" }}>
                  {s.file}:{s.line}
                </div>
                <div className="muted text-[11px]">{s.reason}</div>
              </div>
            </div>
          ))}
          {legitSites.map((s, i) => (
            <div key={`l-${i}`} className="flex items-start gap-2 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--health)" }} />
              <div className="flex-1 min-w-0">
                <div className="mono truncate" style={{ color: "#D6E1F5" }}>
                  {s.file}:{s.line}
                </div>
                <div className="muted text-[11px]">{s.reason}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 24h trend */}
      <div className="telos-card" style={{ cursor: "default" }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: "#E8EFFF" }}>
          Last 24h — subscription usage
        </h3>
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {data.history.length === 0 ? (
            <span className="muted text-xs">Waiting for hourly samples…</span>
          ) : (
            data.history.map((h, i) => {
              const pct = h.subscription.five_hour_pct ?? 0;
              const alert = h.alerts.length > 0;
              return (
                <div
                  key={i}
                  className="flex-1"
                  title={`${new Date(h.ts).toLocaleTimeString()} — 5h=${pct}%, sites=${h.call_sites.total} (bypass=${h.call_sites.bypass})`}
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    background: alert
                      ? "linear-gradient(to top, #EF4444, #F87171)"
                      : "linear-gradient(to top, #E0A458, #F0A35E)",
                    borderRadius: 2,
                    minWidth: 8,
                  }}
                />
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] muted">{data.total_entries} total ledger entries</span>
          <span className="text-[11px] muted mono">
            last sample: {new Date(snap.ts).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* How-to */}
      <div className="telos-card" style={{ cursor: "default", opacity: 0.85 }}>
        <div className="text-xs muted space-y-1">
          <div>
            <span className="mono" style={{ color: "var(--money)" }}>
              bun $PAI_DIR/TOOLS/CostTracker.ts status
            </span>{" "}
            — human-readable snapshot
          </div>
          <div>
            <span className="mono" style={{ color: "var(--money)" }}>
              bun $PAI_DIR/TOOLS/CostTracker.ts scan
            </span>{" "}
            — re-run static scan
          </div>
          <div>
            <span className="mono" style={{ color: "var(--money)" }}>
              bun $PAI_DIR/TOOLS/CostTracker.ts baseline
            </span>{" "}
            — lock a new known-good snapshot
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const [tab, setTab] = useState<Tab>("cost");
  const [costData, setCostData] = useState<CostData | null>(null);
  const [failureData, setFailureData] = useState<FailureData | null>(null);
  const [anthropicData, setAnthropicData] = useState<AnthropicData | null>(null);
  const [days, setDays] = useState(30);

  const fetchCost = useCallback(async () => {
    try {
      const res = await fetch(`/api/performance/cost?days=${days}`);
      if (res.ok) setCostData(await res.json());
    } catch { /* silent */ }
  }, [days]);

  const fetchFailures = useCallback(async () => {
    try {
      const res = await fetch("/api/performance/failures");
      if (res.ok) setFailureData(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchAnthropic = useCallback(async () => {
    try {
      const res = await fetch("/api/performance/anthropic-cost");
      if (res.ok) setAnthropicData(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCost();
    fetchFailures();
    fetchAnthropic();
    const interval = setInterval(() => {
      fetchCost();
      fetchFailures();
      fetchAnthropic();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchCost, fetchFailures, fetchAnthropic]);

  const pillBtn = (active: boolean, dimension: Dimension) => ({
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer" as const,
    background: active ? dimTints[dimension] : "rgba(168,165,200,0.08)",
    color: active ? "#E8EFFF" : dimColors[dimension],
    border: active ? `1px solid ${dimColors[dimension]}` : "1px solid rgba(168,165,200,0.22)",
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid #1A2A4D", background: "#0F1A33" }}
      >
        <button
          type="button"
          onClick={() => setTab("cost")}
          className="pill pill-money flex items-center gap-1.5"
          style={pillBtn(tab === "cost", "money")}
        >
          <DollarSign className="w-4 h-4" />
          Cost
        </button>
        <button
          type="button"
          onClick={() => setTab("failures")}
          className="pill pill-creative flex items-center gap-1.5"
          style={pillBtn(tab === "failures", "creative")}
        >
          <AlertTriangle className="w-4 h-4" />
          Failures
        </button>
        <button
          type="button"
          onClick={() => setTab("anthropic")}
          className="pill pill-freedom flex items-center gap-1.5"
          style={pillBtn(tab === "anthropic", "freedom")}
        >
          <ShieldCheck className="w-4 h-4" />
          Anthropic
        </button>

        {tab === "cost" && (
          <div className="ml-auto flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className="pill text-xs"
                style={{
                  padding: "4px 10px",
                  background: days === d ? "rgba(224,164,88,0.18)" : "transparent",
                  color: days === d ? "#E8EFFF" : "#9BB0D6",
                  border: "1px solid rgba(224,164,88,0.32)",
                  cursor: "pointer",
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-3 shrink-0">
        <div className="telos-card goal-card dim-money" style={{ cursor: "default", padding: 14 }}>
          <div className="goal-title">
            <DollarSign className="w-4 h-4 shrink-0" style={{ color: "var(--money)" }} />
            <span>Performance ledger</span>
            <span className="pill pill-money">money</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "68%" }} />
          </div>
          <div className="goal-foot">
            <div className="goal-dims">
              <span className="pill pill-creative">failures</span>
              <span className="pill pill-rhythms">cache</span>
              <span className="pill pill-health">guarded</span>
            </div>
            <span className="goal-delta flat-muted">live costs</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "cost" && <CostTab data={costData} />}
        {tab === "failures" && <FailuresTab data={failureData} />}
        {tab === "anthropic" && <AnthropicTab data={anthropicData} />}
      </div>
    </div>
  );
}
