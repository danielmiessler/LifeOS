"use client";

// App shell — 11 TELOS primitives, bidirectional trace, view toggle.
// Ported from v7 app.jsx. Topbar dropped (Pulse AppHeader owns nav).
// PaiLogo retained and exported for reuse. ReactDOM.createRoot removed (Next.js renders).

import React, { useEffect, useState } from "react";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import { type Telos, type Goal } from "./data";
import { Hero } from "./hero";
import {
  Problems,
  MissionGoals,
  Metrics,
  ChallengeStrategy,
  Team,
  Budget,
  Recommendations,
  Preferences,
} from "./sections";
import { Stranded } from "./stranded";
import { SubTabs } from "./subtabs";
import { What } from "./what";
import { GoalModal } from "./modal";
import { TraceModal } from "./trace";
import { useTweaks, TweakPanel } from "./tweaks";
import { FileEditor } from "./file-editor";
import { useTelosData } from "./use-telos-data";

// View kind — persisted to localStorage.
type ViewKind = "columns" | "tree" | "graph";

interface PaiLogoProps {
  size?: number;
}

export function PaiLogo({ size = 22 }: PaiLogoProps) {
  const NAVY = "#002B9D";
  const AZ = "#3B82F6";
  const SKY = "#9ACBFF";
  const W = 100;
  const rowH = 18;
  const gap = 2;
  const H = 5 * rowH + 4 * gap;
  const y = (r: number) => r * (rowH + gap);
  return (
    <svg
      width={size * (W / H)}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      aria-label="PAI"
      shapeRendering="crispEdges"
    >
      <rect x="0"  y={y(0)} width="75" height={rowH} fill={NAVY} />
      <rect x="75" y={y(0)} width="25" height={rowH} fill={SKY} />
      <rect x="0"  y={y(1)} width="15" height={rowH} fill={NAVY} />
      <rect x="65" y={y(1)} width="25" height={rowH} fill={NAVY} />
      <rect x="90" y={y(1)} width="10" height={rowH} fill={SKY} />
      <rect x="0"  y={y(2)} width="75" height={rowH} fill={NAVY} />
      <rect x="75" y={y(2)} width="25" height={rowH} fill={SKY} />
      <rect x="0"  y={y(3)} width="15" height={rowH} fill={NAVY} />
      <rect x="65" y={y(3)} width="25" height={rowH} fill={AZ} />
      <rect x="90" y={y(3)} width="10" height={rowH} fill={SKY} />
      <rect x="0"  y={y(4)} width="15" height={rowH} fill={NAVY} />
      <rect x="65" y={y(4)} width="25" height={rowH} fill={AZ} />
      <rect x="90" y={y(4)} width="10" height={rowH} fill={SKY} />
    </svg>
  );
}

interface ViewControlsProps {
  view: ViewKind;
  onView: (v: ViewKind) => void;
  showIds: boolean;
  onToggleIds: () => void;
}

function ViewControls({ view, onView, showIds, onToggleIds }: ViewControlsProps) {
  const views: ViewKind[] = ["columns", "tree", "graph"];
  return (
    <div className="telos-view-controls">
      <div className="view-seg">
        {views.map((v) => (
          <button
            key={v}
            className={view === v ? "on" : ""}
            onClick={() => onView(v)}
            type="button"
          >
            {v}
          </button>
        ))}
      </div>
      <button
        className={"id-toggle" + (showIds ? " on" : "")}
        onClick={onToggleIds}
        title="Show TELOS IDs"
        type="button"
      >
        <span className="id-toggle-dot" />
        <span>IDs</span>
      </button>
    </div>
  );
}

interface CommonViewProps {
  telos: Telos;
  onTrace: (id: string | null) => void;
  showIds: boolean;
  openFile?: (name: string) => void;
}

export function TreeView({ telos, onTrace, showIds }: CommonViewProps) {
  function row<T>(
    kind: string,
    color: string,
    items: readonly T[],
    getLabel: (it: T) => string,
    getId: (it: T) => string,
  ) {
    return (
    <div className="tree-row" key={kind}>
      <div className="tree-row-head" style={{ color }}>
        <span className="tree-kind">{kind}</span>
        <span className="tree-count">{items.length}</span>
      </div>
      <div className="tree-row-body">
        {items.map((it) => (
          <button
            key={getId(it)}
            className="tree-node"
            style={{ borderColor: color + "55" }}
            onClick={() => onTrace(getId(it))}
            type="button"
          >
            {showIds && <span className="mono tree-id" style={{ color }}>{getId(it)}</span>}
            <span className="tree-label">{getLabel(it)}</span>
          </button>
        ))}
      </div>
    </div>
    );
  }

  const allWork = telos.projects.flatMap((p) => p.work);

  return (
    <section className="tree-view">
      <header className="band-head">
        <div>
          <h2 className="band-title">All 11 primitives · top-down</h2>
          <p className="band-sub">The full TELOS model in dependency order. Click any node to trace.</p>
        </div>
      </header>
      <div className="tree-list">
        {row("Ideal State", "var(--sky)",      telos.dimensions, (d) => `${d.label} · ${d.cur}→${d.ideal}`, (d) => d.id)}
        {row("Problems",    "var(--bad)",      telos.problems,   (p) => p.title, (p) => p.id)}
        {row("Mission",     "var(--warm)",     telos.missions,   (m) => `${m.horizon} — ${m.title}`, (m) => m.id)}
        {row("Goals",       "var(--ok)",       telos.goals,      (g) => g.title, (g) => g.id)}
        {row("Metrics",     "var(--azure)",    telos.metrics,    (m) => `${m.label} · ${m.value}${m.unit}`, (m) => m.id)}
        {row("Challenges",  "var(--warm)",     telos.challenges, (c) => c.title, (c) => c.id)}
        {row("Strategies",  "var(--accent-2)", telos.strategies, (s) => s.title.split("—")[0].trim(), (s) => s.id)}
        {row("Projects",    "var(--sky)",      telos.projects,   (p) => p.title, (p) => p.id)}
        {row("Work",        "var(--text-2)",   allWork,          (w) => w.title, (w) => w.id)}
        {row("Team",        "var(--accent-2)", telos.team,       (t) => `${t.name} — ${t.role}`, (t) => t.id)}
        {row("Budget",      "var(--money)",    telos.budget,     (b) => `${b.label} · ${b.value}/${b.of}`, (b) => b.id)}
      </div>
    </section>
  );
}

interface GraphPosition {
  x: number;
  y: number;
  color: string;
  label: string;
  layer: string;
}

type GraphEdge = [string, string, string];

export function GraphView({ telos, onTrace }: CommonViewProps) {
  // Radial layered layout: Mission at center, expanding outward through layers.
  const layers: Array<{ key: string; color: string; items: Array<{ id: string; label: string }> }> = [
    { key: "ideal",   color: "#7DD3FC", items: telos.dimensions.map((d) => ({ id: d.id, label: d.label })) },
    { key: "problem", color: "#F87171", items: telos.problems.map((p) => ({ id: p.id, label: p.title })) },
    { key: "mission", color: "#BAE6FD", items: telos.missions.filter((m) => m.active).map((m) => ({ id: m.id, label: m.horizon })) },
    { key: "goal",    color: "#4ADE80", items: telos.goals.map((g) => ({ id: g.id, label: g.id })) },
    { key: "metric",  color: "#3B82F6", items: telos.metrics.map((m) => ({ id: m.id, label: m.id })) },
    { key: "strat",   color: "#A5B4FC", items: telos.strategies.map((s) => ({ id: s.id, label: s.id })) },
    { key: "project", color: "#9ACBFF", items: telos.projects.map((p) => ({ id: p.id, label: p.title })) },
    { key: "work",    color: "#9BB0D6", items: telos.projects.flatMap((p) => p.work).map((w) => ({ id: w.id, label: w.id })) },
  ];
  const W = 1000;
  const H = 720;
  const cx = W / 2;
  const cy = H / 2 + 20;
  const radii = [70, 150, 0, 220, 290, 360, 430, 500];
  const positions: Record<string, GraphPosition> = {};
  layers.forEach((layer, li) => {
    const r = radii[li];
    const n = layer.items.length;
    layer.items.forEach((it, i) => {
      if (li === 2) {
        positions[it.id] = { x: cx, y: cy, color: layer.color, label: it.label, layer: layer.key };
        return;
      }
      const theta = (i / n) * Math.PI * 2 - Math.PI / 2 + (li % 2 ? Math.PI / n : 0);
      positions[it.id] = {
        x: cx + r * Math.cos(theta),
        y: cy + r * Math.sin(theta),
        color: layer.color,
        label: it.label,
        layer: layer.key,
      };
    });
  });

  const edges: GraphEdge[] = [];
  telos.goals.forEach((g) => {
    g.dims.forEach((d) => edges.push([d, g.id, "rgba(125,211,252,0.18)"]));
    const m = telos.missions.find((mm) => mm.active);
    if (m) edges.push([m.id, g.id, "rgba(186,230,253,0.22)"]);
    g.metrics.forEach((mid) => edges.push([g.id, mid, "rgba(59,130,246,0.25)"]));
  });
  telos.strategies.forEach((s) => {
    s.implements.forEach((gid) => edges.push([gid, s.id, "rgba(165,180,252,0.22)"]));
  });
  telos.projects.forEach((p) => {
    edges.push([p.strategy, p.id, "rgba(154,203,255,0.26)"]);
    p.work.forEach((w) => edges.push([p.id, w.id, "rgba(155,176,214,0.22)"]));
  });
  const m1 = telos.missions.find((m) => m.active);
  if (m1 && m1.addresses) {
    m1.addresses.forEach((pid) => edges.push([m1.id, pid, "rgba(248,113,113,0.25)"]));
  }

  return (
    <section className="graph-view">
      <header className="band-head">
        <div>
          <h2 className="band-title">Graph · all primitives and their links</h2>
          <p className="band-sub">Concentric layers radiating out from Mission. Click any node to trace.</p>
        </div>
      </header>
      <div className="graph-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg" preserveAspectRatio="xMidYMid meet">
          {edges.map(([a, b, c], i) => {
            const pa = positions[a];
            const pb = positions[b];
            if (!pa || !pb) return null;
            const mx = (pa.x + pb.x) / 2;
            const my = (pa.y + pb.y) / 2 - 20;
            return (
              <path
                key={i}
                d={`M ${pa.x} ${pa.y} Q ${mx} ${my} ${pb.x} ${pb.y}`}
                fill="none"
                stroke={c}
                strokeWidth="0.8"
              />
            );
          })}
          {Object.entries(positions).map(([id, p]) => (
            <g key={id} style={{ cursor: "pointer" }} onClick={() => onTrace(id)}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.layer === "mission" ? 26 : p.layer === "ideal" || p.layer === "problem" ? 8 : 5}
                fill={p.color}
                opacity={p.layer === "mission" ? 0.9 : 0.8}
              />
              {(p.layer === "mission" || p.layer === "ideal" || p.layer === "problem" || p.layer === "project") && (
                <text
                  x={p.x}
                  y={p.y + (p.layer === "mission" ? 4 : -12)}
                  fill="var(--text-2)"
                  fontSize={p.layer === "mission" ? 11 : 10}
                  textAnchor="middle"
                  fontFamily="var(--sans)"
                >
                  {p.label.length > 22 ? p.label.slice(0, 22) + "…" : p.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

const STORAGE_KEY = "telos-view";

function isViewKind(v: string | null): v is ViewKind {
  return v === "columns" || v === "tree" || v === "graph";
}

function App() {
  const { telos, refetch } = useTelosData();
  const [mission, setMission] = useState<string>("M0");
  const [openGoal, setOpenGoal] = useState<Goal | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [showIds, setShowIds] = useState<boolean>(false);
  const [view, setView] = useState<ViewKind>("columns");
  const tweaks = useTweaks();

  // Hydration-safe load from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isViewKind(stored)) setView(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, view);
  }, [view]);

  // Reset active mission when live data loads with different IDs than the default.
  useEffect(() => {
    if (telos && !telos.missions.find(m => m.id === mission)) {
      const firstId = telos.missions[0]?.id;
      if (firstId) setMission(firstId);
    }
  }, [telos?.missions]);

  const trace = (id: string | null) => {
    if (id) setTraceId(id);
  };

  const openFile = (name: string) => setEditingFile(name);

  if (!telos) return <div style={{ padding: 40, color: "#E8EFFF" }}>Loading...</div>;

  const common: CommonViewProps = { telos, onTrace: trace, showIds, openFile };
  const isFreshInstall =
    telos.goals.length === 0 &&
    telos.missions.length === 0 &&
    telos.problems.length === 0 &&
    telos.strategies.length === 0;

  return (
    <>
      <ViewControls
        view={view}
        onView={setView}
        showIds={showIds}
        onToggleIds={() => setShowIds((v) => !v)}
      />
      <main
        className="frame"
        data-tone={tweaks.vals.narrativeTone}
        data-view={view}
      >
        {isFreshInstall && (
          <div style={{ padding: "20px 24px 0" }}>
            <EmptyStateGuide
              section="Telos"
              description="Your missions, goals, problems, strategies, and the narratives behind your work — loaded into every PAI session."
              userDir="TELOS"
              daPromptExample="walk me through setting up my mission and goals"
            />
          </div>
        )}
        {view === "tree"  && <TreeView {...common} />}
        {view === "graph" && <GraphView {...common} />}
        {view === "columns" && (
          <>
            <Hero telos={telos} tone={tweaks.vals.narrativeTone} showIds={showIds} onTrace={trace} />
            <Problems {...common} />
            <MissionGoals
              {...common}
              missionId={mission}
              onMission={setMission}
              onOpenGoal={setOpenGoal}
            />
            <Metrics {...common} />
            <ChallengeStrategy {...common} onOpenGoal={setOpenGoal} />
            <What telos={telos} showIds={showIds} openFile={openFile} />
            <Team {...common} />
            <Budget {...common} />
            <Recommendations {...common} />
            <Stranded telos={telos} showIds={showIds} openFile={openFile} />
            <SubTabs telos={telos} openFile={openFile} />
            <Preferences telos={telos} openFile={openFile} />
          </>
        )}
        <footer className="ftr">
          <span>PAI · Personal AI</span>
          <span className="ftr-sep">·</span>
          <span>graph synced three minutes ago</span>
          <span className="ftr-sep">·</span>
          <span>
            11 primitives · {telos.goals.length} goals · {telos.metrics.length} metrics · {telos.team.length} on team
          </span>
        </footer>
      </main>
      <GoalModal telos={telos} goal={openGoal} onClose={() => setOpenGoal(null)} showIds={showIds} />
      <TraceModal telos={telos} id={traceId} onTrace={setTraceId} onClose={() => setTraceId(null)} />
      <TweakPanel vals={tweaks.vals} set={tweaks.set} visible={tweaks.visible} />
      <FileEditor
        open={!!editingFile}
        filename={editingFile}
        onClose={() => setEditingFile(null)}
        onSaved={() => {
          setEditingFile(null);
          refetch();
        }}
      />
    </>
  );
}

export default App;
