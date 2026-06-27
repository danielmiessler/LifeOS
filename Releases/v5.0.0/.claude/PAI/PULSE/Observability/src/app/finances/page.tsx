"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  Landmark,
  CreditCard,
  PiggyBank,
  Receipt,
  Target,
  Lock,
  TrendingUp,
  TrendingDown,
  Wallet,
  Mail,
  Globe,
  BookOpen,
  Mic,
  Briefcase,
  Home,
  Users,
  Cpu,
  Server,
  Scissors,
  Trophy,
  Sparkles,
  PieChart,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import {
  Sankey,
  Rectangle,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { FreshnessIndicator, type FreshnessData } from "@/components/FreshnessIndicator";
import EmptyStateGuide from "@/components/EmptyStateGuide";

// ─── Types matching /api/life/finances v2 envelope ───

interface Section {
  heading: string;
  body: string;
}
interface Stream {
  label: string;
  annual: number;
}

interface ResolvedLine {
  id: string;
  name: string;
  scope: string;
  monthly_usd: number;
  annual_usd: number;
  source: "collector" | "manual" | "unconfigured";
  cadence: string;
  tags?: string[];
  notes?: string;
  collector?: string;
}

interface TrendPoint {
  month: string;
  income: number;
  outbound: number;
  net: number;
}

interface InsightLine {
  display: string;
  monthly_usd: number;
  annual_usd: number;
  observed_usd: number;
  cadence: string;
  confidence: "high" | "medium" | "low";
  scope: string;
  tags: string[];
  active_months: number;
  charge_count: number;
  last_seen: string;
  reason?: string;
}

interface SpendInsights {
  top_bills: InsightLine[];
  top_ai_services: InsightLine[];
  top_infrastructure_services: InsightLine[];
  cut_candidates: InsightLine[];
  by_category: { category: string; annual_usd: number; merchants: number }[];
  total_annualized: number;
  statement_spend: {
    generated_at: string | null;
    record_count: number;
    jsonl_path: string;
    tool: string;
  };
}

interface FinancesDataV2 {
  version?: number;
  income?: {
    streams: Stream[];
    annual: number;
    monthly: number;
    mrr_monthly: number;
    mrr_annual: number;
  };
  outbound?: {
    vendors: ResolvedLine[];
    obligations: ResolvedLine[];
    other: ResolvedLine[];
    annual: number;
    monthly: number;
    vendors_annual: number;
    obligations_annual: number;
    other_annual: number;
  };
  overall?: {
    net_pre_tax_annual: number;
    net_pre_tax_monthly: number;
    net_post_tax_annual: number;
    net_post_tax_monthly: number;
    effective_tax_rate: number;
    trend: TrendPoint[];
  };
  collector_status?: {
    configured_vendors: number;
    active_collectors: string[];
    jsonl_path: string;
  };
  insights?: SpendInsights;
  // v1 legacy fields (still populated)
  accounts?: Section[];
  goals?: Section[];
  expenses?: Section[];
  investments?: Section[];
  taxes?: Section[];
  overview?: Section[];
  incomeStreams?: Stream[];
  expenseCategories?: Stream[];
  annualIncome?: number;
  annualExpenses?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  net?: number;
  freshness?: FreshnessData;
  freshness_per_card?: {
    income?: FreshnessData;
    outbound?: FreshnessData;
    overall?: FreshnessData;
    accounts?: FreshnessData;
    investments?: FreshnessData;
    taxes?: FreshnessData;
  };
}

// ─── Formatting ───

function fmtHero(dollars: number | null | undefined): string {
  const n = Number(dollars) || 0;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  if (n >= 1_000) {
    const k = n / 1000;
    return k % 1 === 0 ? `$${k.toFixed(0)}K` : `$${k.toFixed(1)}K`;
  }
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtExact(dollars: number | null | undefined): string {
  const n = Number(dollars) || 0;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtPct(rate: number | null | undefined): string {
  const n = Number(rate) || 0;
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Palette — v8 dimensions, with coral reserved for outbound/net-negative ───

const DIMENSION_PALETTE = ["#34D399", "#E0A458", "#7DD3FC", "#F87B7B", "#B794F4", "#2DD4BF"];
const SANKEY_INCOME_PALETTE = ["#34D399", "#E0A458"];
const SANKEY_OUTFLOW_PALETTE = ["#F0A35E", "#F87B7B"];

const SANKEY_COLORS: Record<string, string> = {
  "Gross Income": "#E0A458",
  "Net": "#7DD3FC",
  "Expenses": "#F87B7B",
  "Vendors": "#F0A35E",
  "Obligations": "#F87B7B",
  "Other": "#F0A35E",
};

const INCOME_ICON: Record<string, LucideIcon> = {
  newsletter: Mail,
  podcast: Mic,
  sponsor: Mail,
  membership: Users,
  course: BookOpen,
  speaking: Mic,
  consulting: Briefcase,
  product: Globe,
};

const OUTBOUND_ICON: Record<string, LucideIcon> = {
  aws: Server,
  cloudflare: Server,
  anthropic: Cpu,
  openai: Cpu,
  elevenlabs: Cpu,
  mortgage: Home,
  property_tax: Home,
  home_insurance: Home,
  tesla_lease: TrendingDown,
  auto_insurance: TrendingDown,
  mobile_phone: Receipt,
  home_internet: Receipt,
};

function pickIcon(
  key: string,
  table: Record<string, LucideIcon>,
  fallback: LucideIcon,
): LucideIcon {
  const lower = key.toLowerCase();
  for (const k of Object.keys(table)) {
    if (lower.includes(k) || k.includes(lower)) return table[k];
  }
  return fallback;
}

function parseSubheadings(body: string): string[] {
  return body
    .split("\n")
    .filter((l) => l.startsWith("### "))
    .map((l) => l.replace(/^###\s*/, ""));
}

// ─── Shared bits ───

function KpiChip({
  label,
  value,
  tone,
  sensitive = true,
}: {
  label: string;
  value: string;
  tone: "income" | "outbound" | "net" | "neutral";
  sensitive?: boolean;
}) {
  const toneColor =
    tone === "income"
      ? "#E0A458"
      : tone === "outbound"
        ? "#F87B7B"
        : tone === "net"
          ? "#7DD3FC"
          : "#E8EFFF";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wider muted">{label}</span>
      <span
        className="text-lg font-medium tabular-nums"
        style={{ color: toneColor }}
        {...(sensitive ? { "data-sensitive": true } : {})}
      >
        {value}
      </span>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  return <span className="pill pill-rhythms">{source}</span>;
}

function ScopeBadge({ scope }: { scope: string }) {
  return <span className="pill pill-money">{scope}</span>;
}

function LineRow({ line, tone }: { line: ResolvedLine; tone: "income" | "outbound" }) {
  const Icon = pickIcon(
    line.id,
    tone === "income" ? INCOME_ICON : OUTBOUND_ICON,
    tone === "income" ? Wallet : Receipt,
  );
  const toneColor = tone === "income" ? "#E0A458" : "#F87B7B";
  return (
    <div className={`telos-card dim-${tone === "income" ? "money" : "creative"}`} style={{ cursor: "default", padding: 16, gap: 6, borderLeft: `3px solid ${toneColor}` }}>
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 mt-1 shrink-0" color={toneColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{line.name}</span>
            <ScopeBadge scope={line.scope} />
            <SourceBadge source={line.source} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="text-lg font-medium tabular-nums"
              style={{ color: toneColor }}
              data-sensitive
            >
              {fmtHero(line.monthly_usd)}
            </span>
            <span className="text-xs muted">/mo</span>
            <span className="ml-auto text-xs tabular-nums muted" data-sensitive>
              {fmtHero(line.annual_usd)}/yr
            </span>
          </div>
          {line.notes && (
            <p className="mt-1 text-[11px] line-clamp-2 muted">{line.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StreamCard({ stream }: { stream: Stream }) {
  const Icon = pickIcon(stream.label, INCOME_ICON, Wallet);
  return (
    <div className="telos-card dim-money" style={{ cursor: "default", padding: 16, gap: 6, borderLeft: "3px solid #E0A458" }}>
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 mt-1 shrink-0" color="#E0A458" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{stream.label}</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="text-lg font-medium tabular-nums"
              style={{ color: "#E0A458" }}
              data-sensitive
            >
              {fmtHero(stream.annual)}
            </span>
            <span className="text-xs muted">/yr</span>
            <span className="ml-auto text-xs tabular-nums muted" data-sensitive>
              {fmtHero(stream.annual / 12)}/mo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero banners ───

function IncomeHero({
  data,
  freshness,
}: {
  data: NonNullable<FinancesDataV2["income"]>;
  freshness?: FreshnessData;
}) {
  return (
    <div className="telos-card dim-money relative" style={{ cursor: "default", borderLeft: "3px solid #E0A458" }}>
      <div className="absolute top-5 right-5 md:top-6 md:right-6 z-10">
        <FreshnessIndicator freshness={freshness} />
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wider muted">Total Annual Income</span>
      <div className="flex items-baseline gap-3 mt-1">
        <span
          className="text-5xl font-medium tabular-nums"
          style={{ color: "#E0A458", letterSpacing: "-0.02em" }}
          data-sensitive
        >
          {fmtHero(data.annual)}
        </span>
        <span className="text-sm muted" data-sensitive>
          {fmtHero(data.monthly)}/mo
        </span>
      </div>
      <span className="text-sm mt-1 block muted">
        <Lock className="inline w-3 h-3 mr-1" /> Private. Toggle Observer mode to blur.
      </span>
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4"
        style={{ borderTop: "1px solid #1A2A4D" }}
      >
        <KpiChip label="Monthly Recurring" value={fmtHero(data.mrr_monthly)} tone="income" />
        <KpiChip label="MRR Annualized" value={fmtHero(data.mrr_annual)} tone="income" />
        <KpiChip label="Streams" value={`${data.streams.length}`} tone="neutral" sensitive={false} />
        <KpiChip label="Monthly Income" value={fmtHero(data.monthly)} tone="income" />
      </div>
    </div>
  );
}

function OutboundHero({
  data,
  freshness,
}: {
  data: NonNullable<FinancesDataV2["outbound"]>;
  freshness?: FreshnessData;
}) {
  return (
    <div className="telos-card dim-creative relative" style={{ cursor: "default", borderLeft: "3px solid #F87B7B" }}>
      <div className="absolute top-5 right-5 md:top-6 md:right-6 z-10">
        <FreshnessIndicator freshness={freshness} />
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wider muted">Total Annual Expenses</span>
      <div className="flex items-baseline gap-3 mt-1">
        <span
          className="text-5xl font-medium tabular-nums"
          style={{ color: "#F87B7B", letterSpacing: "-0.02em" }}
          data-sensitive
        >
          {fmtHero(data.annual)}
        </span>
        <span className="text-sm muted" data-sensitive>
          {fmtHero(data.monthly)}/mo
        </span>
      </div>
      <span className="text-sm mt-1 block muted">
        <Lock className="inline w-3 h-3 mr-1" /> Sum of vendors, personal obligations, and other.
      </span>
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4"
        style={{ borderTop: "1px solid #1A2A4D" }}
      >
        <KpiChip label="Vendors" value={fmtHero(data.vendors_annual)} tone="outbound" />
        <KpiChip label="Obligations" value={fmtHero(data.obligations_annual)} tone="outbound" />
        <KpiChip label="Other" value={fmtHero(data.other_annual)} tone="outbound" />
        <KpiChip
          label="Lines Tracked"
          value={`${data.vendors.length + data.obligations.length + data.other.length}`}
          tone="neutral"
          sensitive={false}
        />
      </div>
    </div>
  );
}

function OverallHero({
  data,
  periodView,
  freshness,
}: {
  data: NonNullable<FinancesDataV2["overall"]>;
  periodView: "monthly" | "annual";
  freshness?: FreshnessData;
}) {
  const pre = periodView === "monthly" ? data.net_pre_tax_monthly : data.net_pre_tax_annual;
  const post = periodView === "monthly" ? data.net_post_tax_monthly : data.net_post_tax_annual;
  const preColor = pre >= 0 ? "#7DD3FC" : "#F87B7B";
  return (
    <div className="telos-card dim-freedom relative" style={{ cursor: "default", borderLeft: "3px solid #7DD3FC" }}>
      <div className="absolute top-5 right-5 md:top-6 md:right-6 z-10">
        <FreshnessIndicator freshness={freshness} />
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wider muted">
        Net ({periodView === "monthly" ? "Monthly" : "Annual"})
      </span>
      <div className="flex items-baseline gap-3 mt-1">
        <span
          className="text-5xl font-medium tabular-nums"
          style={{ color: preColor, letterSpacing: "-0.02em" }}
          data-sensitive
        >
          {fmtHero(pre)}
        </span>
        <span className="text-sm muted">pre-tax</span>
      </div>
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4"
        style={{ borderTop: "1px solid #1A2A4D" }}
      >
        <KpiChip
          label="Post-Tax Net"
          value={fmtHero(post)}
          tone={post >= 0 ? "net" : "outbound"}
        />
        <KpiChip
          label="Effective Tax Rate"
          value={fmtPct(data.effective_tax_rate)}
          tone="neutral"
          sensitive={false}
        />
        <KpiChip
          label={periodView === "monthly" ? "Annual Pre-Tax" : "Monthly Pre-Tax"}
          value={fmtHero(
            periodView === "monthly" ? data.net_pre_tax_annual : data.net_pre_tax_monthly,
          )}
          tone="net"
        />
        <KpiChip
          label={periodView === "monthly" ? "Annual Post-Tax" : "Monthly Post-Tax"}
          value={fmtHero(
            periodView === "monthly" ? data.net_post_tax_annual : data.net_post_tax_monthly,
          )}
          tone="net"
        />
      </div>
    </div>
  );
}

// ─── Overall trend chart ───

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  return (
    <div className="telos-card dim-money" style={{ cursor: "default", borderLeft: "3px solid #E0A458" }}>
      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
        <ArrowLeftRight className="w-4 h-4" color="#B794F4" /> Income vs Expenses — 12 Month Trend
      </h3>
      <div className="w-full h-64" data-sensitive>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A2A4D" />
            <XAxis dataKey="month" stroke="#6B80AB" fontSize={11} />
            <YAxis
              stroke="#6B80AB"
              fontSize={11}
              tickFormatter={(v) => `$${Math.round(v / 1000)}K`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0F1A33",
                border: "1px solid #1A2A4D",
                borderRadius: 8,
                color: "#E8EFFF",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#9BB0D6" }} />
            <Line type="monotone" dataKey="income" stroke="#E0A458" strokeWidth={2} dot={false} name="Income" />
            <Line type="monotone" dataKey="outbound" stroke="#F87B7B" strokeWidth={2} dot={false} name="Expenses" />
            <Line type="monotone" dataKey="net" stroke="#7DD3FC" strokeWidth={2} dot={false} name="Net" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] mt-2 muted">
        Flat baseline until Phase 2 collectors accumulate historical monthly data.
      </p>
    </div>
  );
}

// ─── Sankey ───

interface SankeyNodePayload {
  name?: string;
  category?: string;
  colorIndex?: number;
  value?: number;
}

interface SankeyNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: SankeyNodePayload;
}

function SankeyNode(props: SankeyNodeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const name = payload?.name ?? "";
  const colorIndex = payload?.colorIndex ?? 0;
  const color =
    SANKEY_COLORS[name] ||
    (payload?.category === "income"
      ? SANKEY_INCOME_PALETTE[colorIndex % SANKEY_INCOME_PALETTE.length]
      : payload?.category === "outbound"
        ? SANKEY_OUTFLOW_PALETTE[colorIndex % SANKEY_OUTFLOW_PALETTE.length]
        : payload?.category === "net"
          ? DIMENSION_PALETTE[2]
        : "#6B80AB");
  const isLeft = x < 300;
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.9}
        radius={[3, 3, 3, 3]}
      />
      <text
        x={isLeft ? x - 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={isLeft ? "end" : "start"}
        dominantBaseline="central"
        fill="#E8EFFF"
        fontSize={12}
        fontWeight={500}
      >
        {name}
      </text>
      <text
        x={isLeft ? x - 8 : x + width + 8}
        y={y + height / 2 + 16}
        textAnchor={isLeft ? "end" : "start"}
        dominantBaseline="central"
        fill="#9BB0D6"
        fontSize={11}
        data-sensitive
      >
        {payload?.value != null ? `${fmtHero(payload.value / 12)}/mo` : ""}
      </text>
    </g>
  );
}

interface SankeyLinkProps {
  sourceX?: number;
  sourceY?: number;
  sourceControlX?: number;
  targetX?: number;
  targetY?: number;
  targetControlX?: number;
  linkWidth?: number;
  payload?: {
    source?: SankeyNodePayload;
    target?: SankeyNodePayload;
  };
}

function SankeyLink(props: SankeyLinkProps) {
  const {
    sourceX = 0,
    sourceY = 0,
    sourceControlX = 0,
    targetX = 0,
    targetY = 0,
    targetControlX = 0,
    linkWidth = 0,
    payload,
  } = props;
  const sourceName = payload?.source?.name ?? "";
  const targetName = payload?.target?.name ?? "";
  const color = SANKEY_COLORS[targetName] || SANKEY_COLORS[sourceName] || "#6B80AB";
  return (
    <path
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={color}
      strokeWidth={linkWidth}
      strokeOpacity={0.25}
    />
  );
}

interface SankeyNodeDatum {
  name: string;
  category: "income" | "outbound" | "pool" | "net";
  colorIndex?: number;
}

interface SankeyLinkDatum {
  source: number;
  target: number;
  value: number;
}

function FinancesSankey({
  incomeStreams,
  outbound,
  net,
}: {
  incomeStreams: Stream[];
  outbound: NonNullable<FinancesDataV2["outbound"]>;
  net: number;
}) {
  const data = useMemo<{ nodes: SankeyNodeDatum[]; links: SankeyLinkDatum[] }>(() => {
    const nodes: SankeyNodeDatum[] = [];
    const links: SankeyLinkDatum[] = [];
    incomeStreams.forEach((s, i) =>
      nodes.push({ name: s.label, category: "income", colorIndex: i }),
    );
    nodes.push({ name: "Gross Income", category: "pool" });
    const grossIdx = nodes.length - 1;
    incomeStreams.forEach((s, i) => {
      if (s.annual > 0) links.push({ source: i, target: grossIdx, value: s.annual });
    });
    nodes.push({ name: "Expenses", category: "pool" });
    const outboundIdx = nodes.length - 1;
    if (outbound.annual > 0)
      links.push({ source: grossIdx, target: outboundIdx, value: outbound.annual });
    if (net > 0) {
      nodes.push({ name: "Net", category: "net" });
      links.push({ source: grossIdx, target: nodes.length - 1, value: net });
    }
    if (outbound.vendors_annual > 0) {
      nodes.push({ name: "Vendors", category: "outbound" });
      links.push({ source: outboundIdx, target: nodes.length - 1, value: outbound.vendors_annual });
    }
    if (outbound.obligations_annual > 0) {
      nodes.push({ name: "Obligations", category: "outbound" });
      links.push({
        source: outboundIdx,
        target: nodes.length - 1,
        value: outbound.obligations_annual,
      });
    }
    if (outbound.other_annual > 0) {
      nodes.push({ name: "Other", category: "outbound" });
      links.push({ source: outboundIdx, target: nodes.length - 1, value: outbound.other_annual });
    }
    return { nodes, links };
  }, [incomeStreams, outbound, net]);

  if (data.nodes.length === 0) return null;

  return (
    <div className="telos-card" style={{ cursor: "default", padding: 16 }}>
      <div className="w-full h-[460px]" data-sensitive>
        <Sankey
          width={1200}
          height={460}
          data={data}
          node={<SankeyNode />}
          link={<SankeyLink />}
          nodePadding={50}
          margin={{ top: 20, bottom: 20, left: 100, right: 100 }}
        >
          <Tooltip
            contentStyle={{
              backgroundColor: "#0F1A33",
              border: "1px solid #1A2A4D",
              borderRadius: 8,
              color: "#E8EFFF",
            }}
            formatter={(v: number) => fmtExact(v)}
          />
        </Sankey>
      </div>
    </div>
  );
}

// ─── Inline Tabs (no new dep) ───

type TabKey = "income" | "outbound" | "overall";
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "income", label: "Income", icon: ArrowUpCircle },
  { key: "outbound", label: "Expenses", icon: ArrowDownCircle },
  { key: "overall", label: "Overall", icon: ArrowLeftRight },
];

function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-lg"
      style={{ background: "#0F1A33", border: "1px solid #1A2A4D" }}
    >
      {TABS.map((t, i) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              background: isActive ? "#17284A" : "transparent",
              color: isActive ? "#E8EFFF" : "#9BB0D6",
            }}
            aria-selected={isActive}
            aria-label={`${t.label} tab (shortcut ${i + 1})`}
            role="tab"
          >
            <Icon className="w-4 h-4" />
            {t.label}
            <span className="text-[10px] muted ml-1">{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: "monthly" | "annual";
  onChange: (v: "monthly" | "annual") => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-lg"
      style={{ background: "#0F1A33", border: "1px solid #1A2A4D" }}
    >
      {(["monthly", "annual"] as const).map((v) => {
        const isActive = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              background: isActive ? "#17284A" : "transparent",
              color: isActive ? "#E8EFFF" : "#9BB0D6",
            }}
          >
            {v === "monthly" ? "Monthly" : "Annual"}
          </button>
        );
      })}
    </div>
  );
}

// ─── Section renderers ───

function SectionGroup({
  title,
  items,
  icon: Icon,
  freshness,
}: {
  title: string;
  items?: Section[];
  icon: LucideIcon;
  freshness?: FreshnessData;
}) {
  if (!items || items.length === 0) return null;
  const accent =
    title === "Investments" ? "#34D399" : title === "Goals" ? "#B794F4" : "#F0A35E";
  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-medium uppercase tracking-widest muted flex items-center gap-2">
          <Icon className="w-4 h-4" color={accent} /> {title}
        </h2>
        {freshness && <FreshnessIndicator freshness={freshness} />}
      </div>
      <div className="prob-grid">
        {items.map((item, i) => (
          <div key={i} className="telos-card" style={{ cursor: "default", borderLeft: `3px solid ${accent}` }}>
            <h3 className="text-sm font-medium mb-1">{item.heading}</h3>
            <div
              className="text-xs whitespace-pre-wrap line-clamp-5 muted"
              data-sensitive
            >
              {item.body}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AccountCategory({ item }: { item: Section }) {
  const ACCOUNT_ICON: Record<string, LucideIcon> = {
    Banking: Landmark,
    "Credit Cards": CreditCard,
    "Investment Accounts": PiggyBank,
    Investments: PiggyBank,
    "Account Processing": Receipt,
  };
  const Icon = ACCOUNT_ICON[item.heading] || DollarSign;
  const subs = parseSubheadings(item.body);
  return (
    <div
      className="telos-card dim-money"
      style={{ cursor: "default", borderLeft: "3px solid #E0A458" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" color="#E0A458" />
        <h3 className="text-sm font-medium uppercase tracking-wider">{item.heading}</h3>
        <span className="ml-auto text-xs muted">
          {subs.length > 0 ? `${subs.length} items` : ""}
        </span>
      </div>
      {subs.length > 0 ? (
        <div className="space-y-2" data-sensitive>
          {subs.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "#2DD4BF", opacity: 0.6 }}
              />
              <span>{s}</span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="text-xs whitespace-pre-wrap line-clamp-5 muted"
          data-sensitive
        >
          {item.body}
        </div>
      )}
    </div>
  );
}

// ─── Tabs ───

function IncomeTab({ data }: { data: FinancesDataV2 }) {
  const income = data.income;
  const streams = income?.streams ?? data.incomeStreams ?? [];
  const incomeFreshness = data.freshness_per_card?.income ?? data.freshness;
  return (
    <div className="space-y-6">
      {income && <IncomeHero data={income} freshness={incomeFreshness} />}
      {streams.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-widest muted mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" color="#E0A458" /> Income Streams
          </h2>
          <div className="prob-grid">
            {streams.map((s) => (
              <StreamCard key={s.label} stream={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OutboundSubgroup({
  title,
  icon: Icon,
  lines,
}: {
  title: string;
  icon: LucideIcon;
  lines: ResolvedLine[];
}) {
  if (lines.length === 0) return null;
  const total = lines.reduce((s, l) => s + l.annual_usd, 0);
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium uppercase tracking-widest muted flex items-center gap-2">
          <Icon className="w-4 h-4" color="#F87B7B" /> {title}
        </h3>
        <span className="text-xs tabular-nums muted" data-sensitive>
          {fmtHero(total / 12)}/mo · {fmtHero(total)}/yr
        </span>
      </div>
      <div className="prob-grid">
        {lines.map((l) => (
          <LineRow key={l.id} line={l} tone="outbound" />
        ))}
      </div>
    </section>
  );
}

function InsightLineRow({ line, accent }: { line: InsightLine; accent: string }) {
  // Honest cadence labels — only true monthly_recurring shows /yr projection prominently.
  // observed_one_month and one_time show "$X observed (1mo)" so the user sees what we actually saw.
  const isUncertain = line.cadence === "observed_one_month" || (line.cadence === "one_time" && line.charge_count >= 2);
  const cadenceLabel =
    line.cadence === "monthly_recurring"
      ? `${line.charge_count}× over ${line.active_months}mo · monthly`
      : line.cadence === "annual_subscription"
        ? "annual subscription"
        : line.cadence === "observed_one_month"
          ? `${line.charge_count}× in 1mo · observed only`
          : "one-time";
  const confidenceColor =
    line.confidence === "high" ? "#34D399" : line.confidence === "medium" ? "#E0A458" : "#9BB0D6";
  return (
    <div className="telos-card" style={{ cursor: "default", padding: 14, gap: 4, borderLeft: `3px solid ${accent}` }}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium truncate">{line.display}</span>
        <span className="text-base font-medium tabular-nums" style={{ color: accent }} data-sensitive>
          {isUncertain ? fmtHero(line.observed_usd) : fmtHero(line.annual_usd)}
          <span className="text-[11px] muted ml-1">{isUncertain ? "observed" : "/yr"}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px] muted flex-wrap">
        {!isUncertain && line.monthly_usd > 0 && (
          <>
            <span data-sensitive>{fmtHero(line.monthly_usd)}/mo</span>
            <span>·</span>
          </>
        )}
        <span>{cadenceLabel}</span>
        <span>·</span>
        <span style={{ color: confidenceColor }}>conf: {line.confidence}</span>
        {line.tags.length > 0 && (
          <>
            <span>·</span>
            <span>{line.tags.slice(0, 3).join(" / ")}</span>
          </>
        )}
      </div>
      {line.reason && (
        <p className="text-[11px] mt-1" style={{ color: "#FCA5A5" }}>{line.reason}</p>
      )}
    </div>
  );
}

function InsightSection({
  title,
  icon: Icon,
  accent,
  description,
  lines,
  emptyHint,
}: {
  title: string;
  icon: LucideIcon;
  accent: string;
  description?: string;
  lines: InsightLine[];
  emptyHint: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-widest muted flex items-center gap-2">
            <Icon className="w-4 h-4" color={accent} /> {title}
          </h3>
          {description && <p className="text-[11px] muted mt-1">{description}</p>}
        </div>
        {lines.length > 0 && (
          <span className="text-xs tabular-nums muted" data-sensitive>
            {fmtHero(lines.reduce((s, l) => s + l.annual_usd, 0))}/yr · {lines.length} item{lines.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {lines.length === 0 ? (
        <div className="telos-card" style={{ cursor: "default", padding: 16 }}>
          <p className="text-xs muted">{emptyHint}</p>
        </div>
      ) : (
        <div className="prob-grid">
          {lines.map((l, i) => (
            <InsightLineRow key={`${l.display}-${i}`} line={l} accent={accent} />
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryBreakdown({ categories, total }: { categories: SpendInsights["by_category"]; total: number }) {
  if (categories.length === 0) return null;
  const max = Math.max(...categories.map(c => c.annual_usd), 1);
  const CATEGORY_LABEL: Record<string, string> = {
    taxes: "Taxes", payroll: "Payroll / Contractors",
    ai: "AI", infrastructure: "Infrastructure", saas: "SaaS / Subscriptions",
    food: "Food", transportation: "Transportation", utilities: "Utilities",
    entertainment: "Entertainment", health: "Health", news: "News", shopping: "Shopping",
    travel: "Travel", "business-services": "Business Services", debt: "Debt", advertising: "Advertising",
    other: "Other",
  };
  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-medium uppercase tracking-widest muted flex items-center gap-2">
          <PieChart className="w-4 h-4" color="#B794F4" /> Spending By Category
        </h3>
        <span className="text-xs tabular-nums muted" data-sensitive>{fmtHero(total)}/yr total observed</span>
      </div>
      <div className="telos-card" style={{ cursor: "default", padding: 16 }}>
        <div className="flex flex-col gap-2.5">
          {categories.map((c) => {
            const pct = total > 0 ? Math.round((c.annual_usd / total) * 100) : 0;
            const barPct = (c.annual_usd / max) * 100;
            return (
              <div key={c.category} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  <span className="tabular-nums muted" data-sensitive>
                    {fmtHero(c.annual_usd)}/yr · {c.merchants} {c.merchants === 1 ? "merchant" : "merchants"} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#0F1A33" }}>
                  <div
                    className="h-full"
                    style={{ width: `${barPct}%`, background: "#F0A35E", opacity: 0.8 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SpendInsightsSection({ insights }: { insights: SpendInsights }) {
  return (
    <div className="space-y-6 pt-4" style={{ borderTop: "1px solid #1A2A4D" }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-widest muted flex items-center gap-2">
            <Sparkles className="w-4 h-4" color="#F0A35E" /> Spending Analysis
          </h2>
          <p className="text-[11px] muted mt-1">
            Derived from statement CSVs in <code style={{ color: "#9BB0D6" }}>FINANCES/Statements/*</code>.
            Re-run with <code style={{ color: "#9BB0D6" }}>bun $PAI_DIR/USER/FINANCES/Tools/StatementAnalyzer.ts</code>.
          </p>
        </div>
        {insights.statement_spend.generated_at && (
          <span className="text-[11px] muted">
            {insights.statement_spend.record_count} merchants · generated{" "}
            {new Date(insights.statement_spend.generated_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </span>
        )}
      </div>

      <CategoryBreakdown categories={insights.by_category} total={insights.total_annualized} />

      <InsightSection
        title="Top Bills"
        icon={Trophy}
        accent="#F0A35E"
        description="Highest annualized spend across all sources (transfers excluded)."
        lines={insights.top_bills}
        emptyHint="No statement aggregate yet — run StatementAnalyzer.ts to populate."
      />

      <InsightSection
        title="Top AI Services"
        icon={Cpu}
        accent="#B794F4"
        description="What the AI stack actually costs — sorted by annualized spend."
        lines={insights.top_ai_services}
        emptyHint="No AI services detected yet. Drop more CSV exports under FINANCES/Statements/."
      />

      <InsightSection
        title="Top Infrastructure Services"
        icon={Server}
        accent="#7DD3FC"
        description="Cloud, hosting, dev, monitoring, networking."
        lines={insights.top_infrastructure_services}
        emptyHint="No infrastructure services detected yet."
      />

      <InsightSection
        title="Cut Candidates"
        icon={Scissors}
        accent="#F87B7B"
        description="Subscriptions flagged for review — single-use annuals, low-value recurring, overlapping tools."
        lines={insights.cut_candidates}
        emptyHint="No obvious cut candidates. Stack is lean (or analyzer needs more data)."
      />
    </div>
  );
}

function OutboundTab({ data }: { data: FinancesDataV2 }) {
  const outbound = data.outbound;
  const outboundFreshness = data.freshness_per_card?.outbound ?? data.freshness;
  if (!outbound) {
    return (
      <div className="telos-card" style={{ cursor: "default" }}>
        <p className="text-sm text-center muted">
          Expenses data unavailable. Check{" "}
          <code style={{ color: "#E8EFFF" }}>
            $PAI_DIR/USER/FINANCES/vendors.yaml
          </code>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <OutboundHero data={outbound} freshness={outboundFreshness} />
      <OutboundSubgroup
        title="Vendors & Services"
        icon={Server}
        lines={outbound.vendors}
      />
      <OutboundSubgroup
        title="Personal Obligations"
        icon={Home}
        lines={outbound.obligations}
      />
      <OutboundSubgroup title="Other" icon={Receipt} lines={outbound.other} />
      {data.insights && <SpendInsightsSection insights={data.insights} />}
    </div>
  );
}

function OverallTab({
  data,
  periodView,
  onPeriodChange,
}: {
  data: FinancesDataV2;
  periodView: "monthly" | "annual";
  onPeriodChange: (v: "monthly" | "annual") => void;
}) {
  const overall = data.overall;
  const income = data.income;
  const outbound = data.outbound;
  if (!overall || !income || !outbound) {
    return (
      <div className="telos-card" style={{ cursor: "default" }}>
        <p className="text-sm text-center muted">Overall data unavailable.</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <PeriodToggle value={periodView} onChange={onPeriodChange} />
      </div>
      <OverallHero
        data={overall}
        periodView={periodView}
        freshness={data.freshness_per_card?.overall ?? data.freshness}
      />
      <FinancesSankey
        incomeStreams={income.streams}
        outbound={outbound}
        net={overall.net_pre_tax_annual}
      />
      <TrendChart trend={overall.trend} />
      {data.accounts && data.accounts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-medium uppercase tracking-widest muted flex items-center gap-2">
              <Landmark className="w-4 h-4" color="#E0A458" /> Accounts
            </h2>
            <FreshnessIndicator freshness={data.freshness_per_card?.accounts} />
          </div>
          <div className="prob-grid">
            {data.accounts.map((item, i) => (
              <AccountCategory key={i} item={item} />
            ))}
          </div>
        </section>
      )}
      <SectionGroup
        title="Investments"
        items={data.investments}
        icon={PiggyBank}
        freshness={data.freshness_per_card?.investments}
      />
      <SectionGroup title="Goals" items={data.goals} icon={Target} />
      <SectionGroup
        title="Taxes"
        items={data.taxes}
        icon={Receipt}
        freshness={data.freshness_per_card?.taxes}
      />
    </div>
  );
}

// ─── Page ───

export default function FinancesPage() {
  const [data, setData] = useState<FinancesDataV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("income");
  const [periodView, setPeriodView] = useState<"monthly" | "annual">("monthly");

  // Load data
  useEffect(() => {
    fetch("/api/life/finances")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  // Hash-routed tab state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "") as TabKey;
    if (hash === "income" || hash === "outbound" || hash === "overall") setTab(hash);
    const onHashChange = () => {
      const h = window.location.hash.replace("#", "") as TabKey;
      if (h === "income" || h === "outbound" || h === "overall") setTab(h);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Keyboard 1/2/3 cycles tabs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1") changeTab("income");
      else if (e.key === "2") changeTab("outbound");
      else if (e.key === "3") changeTab("overall");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const changeTab = (k: TabKey) => {
    setTab(k);
    if (typeof window !== "undefined") window.location.hash = k;
  };

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div
          className="telos-card"
          style={{ cursor: "default", borderLeft: "3px solid #F87171" }}
        >
          <h2 className="font-medium" style={{ color: "#F87171" }}>
            Failed to load finances
          </h2>
          <p className="text-sm" style={{ color: "#FCA5A5" }}>
            {error}
          </p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="p-8 text-sm muted">Loading Finances...</div>;

  const incomeAnnual = data.income?.annual ?? data.annualIncome ?? 0;
  const outboundAnnual = data.outbound?.annual ?? data.annualExpenses ?? 0;
  const incomeStreams = data.income?.streams ?? data.incomeStreams ?? [];
  const isFreshInstall =
    incomeAnnual === 0 &&
    outboundAnnual === 0 &&
    incomeStreams.length === 0 &&
    (!data.accounts || data.accounts.length === 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: "#E8EFFF" }}>
            Finances
          </h1>
          <p className="text-xs muted">
            Income · Expenses · Overall · Press 1/2/3 to switch tabs
          </p>
        </div>
        <TabBar active={tab} onChange={changeTab} />
      </div>

      {isFreshInstall && (
        <EmptyStateGuide
          section="Finances"
          description="Accounts, transactions, P&L, and revenue tracked over time."
          userDir="FINANCES"
          daPromptExample="help me wire up my financial data"
        />
      )}

      {tab === "income" && <IncomeTab data={data} />}
      {tab === "outbound" && <OutboundTab data={data} />}
      {tab === "overall" && (
        <OverallTab data={data} periodView={periodView} onPeriodChange={setPeriodView} />
      )}
    </div>
  );
}
