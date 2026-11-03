"use client";

/**
 * Pulse chrome kit — the ONE set of page-structure primitives.
 * Every route page renders inside PageShell; panels, stat tiles, tabs,
 * and pills come from here. Colors come exclusively from the design
 * tokens in globals.css (surface/line/ink/dim/status) — no component
 * in this file, and no consumer of it, hardcodes a palette.
 */

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode, CSSProperties } from "react";

/* ── Dimension + status tint tables (single source for pill/tab tinting) ── */

export type Dim =
  | "health" | "money" | "freedom" | "creative" | "relationships" | "rhythms"
  | "blue" | "ok" | "warn" | "err" | "neutral";

const DIM_COLOR: Record<Dim, string> = {
  health: "var(--health)",
  money: "var(--money)",
  freedom: "var(--freedom)",
  creative: "var(--creative)",
  relationships: "var(--relationships)",
  rhythms: "var(--rhythms)",
  blue: "var(--accent-blue)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  err: "var(--err)",
  neutral: "var(--ink-2)",
};

const DIM_TINT: Record<Dim, string> = {
  health: "rgba(52,211,153,0.14)",
  money: "rgba(224,164,88,0.14)",
  freedom: "rgba(125,211,252,0.14)",
  creative: "rgba(248,123,123,0.14)",
  relationships: "rgba(183,148,244,0.14)",
  rhythms: "rgba(45,212,191,0.14)",
  blue: "rgba(59,130,246,0.15)",
  ok: "rgba(74,222,128,0.14)",
  warn: "rgba(251,191,36,0.14)",
  err: "rgba(248,113,113,0.14)",
  neutral: "rgba(168,165,200,0.10)",
};

const DIM_BORDER: Record<Dim, string> = {
  health: "rgba(52,211,153,0.3)",
  money: "rgba(224,164,88,0.3)",
  freedom: "rgba(125,211,252,0.3)",
  creative: "rgba(248,123,123,0.3)",
  relationships: "rgba(183,148,244,0.3)",
  rhythms: "rgba(45,212,191,0.3)",
  blue: "rgba(154,203,255,0.3)",
  ok: "rgba(74,222,128,0.3)",
  warn: "rgba(251,191,36,0.3)",
  err: "rgba(248,113,113,0.3)",
  neutral: "rgba(168,165,200,0.22)",
};

export function dimStyle(dim: Dim, active = true): CSSProperties {
  return {
    background: active ? DIM_TINT[dim] : "rgba(168,165,200,0.08)",
    color: active ? DIM_COLOR[dim] : "var(--ink-2)",
    border: `1px solid ${active ? DIM_BORDER[dim] : "rgba(168,165,200,0.22)"}`,
  };
}

/* ── PageShell — the outer frame of every route page ── */

export function PageShell({
  children,
  fullBleed = false,
  className,
}: {
  children: ReactNode;
  /** Full-viewport dashboards (agents) — no padding, no max width. */
  fullBleed?: boolean;
  className?: string;
}) {
  if (fullBleed) {
    return <div className={cn("flex flex-col flex-1 min-h-0 page-enter", className)}>{children}</div>;
  }
  // Shared blue dashboard frame; all routes inherit the same material.
  return (
    <div className="max-w-[1680px] mx-auto w-full px-3 sm:px-6 pt-3 pb-10 page-enter">
      <div className={cn("glass-sheet pulse-page rounded-xl px-4 sm:px-8 py-7 flex flex-col gap-6", className)}>
        {children}
      </div>
    </div>
  );
}

/* ── PageHeader — serif title, muted subtitle, right-side actions ── */

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pulse-page-header flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-ink-1">
          {Icon && <Icon className="w-6 h-6 text-ink-3 shrink-0" />}
          {title}
        </h1>
        {/* The warm hairline — the ember note under every page title. */}
        <div
          aria-hidden
          className="mt-2 h-px w-14"
          style={{ background: "linear-gradient(90deg, var(--accent-blue), var(--accent-soft) 70%, transparent)" }}
        />
        {subtitle && <p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ── Panel — the unified card ── */

export function Panel({
  children,
  className,
  hover = false,
  as: Tag = "div",
  style,
  onClick,
}: {
  children?: ReactNode;
  className?: string;
  /** Adds the standard hover raise (surface-3 + line-3). */
  hover?: boolean;
  as?: "div" | "section" | "article" | "li";
  style?: CSSProperties;
  onClick?: () => void;
}) {
  // Clickable panels stay keyboard-reachable: role/tabIndex + Enter/Space.
  const interactive = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  return (
    <Tag
      className={cn(
        "glass rounded-lg p-5",
        (hover || onClick) && "glass-hover",
        onClick && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-blue)]",
        className
      )}
      style={style}
      onClick={onClick}
      {...interactive}
    >
      {children}
    </Tag>
  );
}

/* ── PanelHeader — uppercase label row inside a Panel ── */

export function PanelHeader({
  title,
  icon: Icon,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pulse-section-header flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-3", className)}>
      {Icon && <Icon className="w-4 h-4 text-ink-3 shrink-0" />}
      <span
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3"
        style={{ fontFamily: "'concourse-c3', 'concourse-t3', sans-serif" }}
      >
        {title}
      </span>
      {meta && <span className="text-[12px] text-ink-3 mono">{meta}</span>}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2 min-w-0">{actions}</div>}
    </div>
  );
}

/* ── StatTile — number + label ── */

export function StatTile({
  label,
  value,
  unit,
  icon: Icon,
  dim,
  sub,
  className,
  onClick,
  active,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  icon?: LucideIcon;
  /** Tints the value with a dimension/status color. */
  dim?: Dim;
  sub?: ReactNode;
  className?: string;
  /** When set, the tile becomes a clickable filter toggle (cursor, hover, keyboard, active ring). */
  onClick?: () => void;
  /** Highlights the tile as the currently-applied filter. */
  active?: boolean;
}) {
  const tile = (
    <Panel className={cn("p-4 flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-ink-3 shrink-0" />}
        <span className="pulse-stat-label text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="pulse-stat-value leading-none"
          style={dim ? { color: DIM_COLOR[dim] } : { color: "var(--ink-1)" }}
        >
          {value}
        </span>
        {unit && <span className="text-sm text-ink-2">{unit}</span>}
      </div>
      {sub && <div className="text-[12px] text-ink-3">{sub}</div>}
    </Panel>
  );

  if (!onClick) return tile;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={!!active}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        cursor: "pointer",
        borderRadius: 12,
        outline: active ? "1px solid rgba(125,211,252,0.85)" : "1px solid transparent",
        transition: "outline-color 120ms",
      }}
    >
      {tile}
    </div>
  );
}

/* ── TabBar — the pill tab row (agents-page pattern, generalized) ── */

export interface TabSpec<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: LucideIcon;
  dim?: Dim;
  /** Small hint rendered after the label (count, keyboard number). */
  hint?: ReactNode;
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  right,
  className,
}: {
  tabs: TabSpec<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Extra content pinned to the right of the row. */
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {tabs.map(({ id, label, icon: Icon, dim = "blue", hint }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap backdrop-blur-sm"
            style={{
              ...dimStyle(dim, isActive),
              ...(isActive
                ? { color: "var(--ink-1)", boxShadow: "inset 0 1px 0 var(--glass-edge)" }
                : {}),
            }}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            {label}
            {hint != null && <span className="text-[11px] opacity-70 mono">{hint}</span>}
          </button>
        );
      })}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

/* ── Pill — inline status/dimension chip ── */

export function Pill({
  children,
  dim = "blue",
  className,
  title,
}: {
  children: ReactNode;
  dim?: Dim;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-medium whitespace-nowrap backdrop-blur-sm", className)}
      style={{ ...dimStyle(dim, true), boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
    >
      {children}
    </span>
  );
}

/* ── EmptyState — consistent nothing-here placeholder ── */

export function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center gap-2 py-12", className)}>
      {Icon && <Icon className="w-8 h-8 text-ink-3" />}
      <div className="text-ink-2">{title}</div>
      {hint && <div className="text-[13px] text-ink-3 max-w-md">{hint}</div>}
    </div>
  );
}
