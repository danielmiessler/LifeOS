"use client";

// Problems · Mission · Metrics · Challenges×Strategies · Team · Budget · Recommendations · Preferences
// v6 theming lock — <div role="button"> + .telos-card + inline bg backups.

import { useState } from "react";
import type { CSSProperties, ReactNode, MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Goal, Telos } from "./data";
import { Icons } from "./icons";

const CARD_BG: CSSProperties = { background: "#0F1A33", color: "#E8EFFF" };

interface RBtnProps {
  className?: string;
  style?: CSSProperties;
  onClick?: (e: ReactMouseEvent | ReactKeyboardEvent) => void;
  children?: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function RBtn({ className = "", style, onClick, children, onMouseEnter, onMouseLeave }: RBtnProps) {
  const kd = (e: ReactKeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onClick) onClick(e);
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className={className}
      style={{ ...CARD_BG, ...(style || {}) }}
      onClick={onClick}
      onKeyDown={kd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

interface CommonSectionProps {
  telos: Telos;
  onTrace: (id: string | null) => void;
  showIds: boolean;
  openFile?: (name: string) => void;
}

// ---------- PROBLEMS ----------
export function Problems({ telos, onTrace, showIds, openFile }: CommonSectionProps) {
  return (
    <section className="problems">
      <header className="band-head">
        <div>
          <h2 className="band-title">Problems</h2>
          <p className="band-sub">The systemic issues above Mission. These are why the Mission exists.</p>
        </div>
      </header>
      <div className="prob-grid">
        {telos.problems.map((p) => (
          <RBtn key={p.id} className={"telos-card prob-" + p.severity} onClick={() => openFile ? openFile("PROBLEMS.md") : onTrace(p.id)}>
            <div className="prob-head">
              <span className={"sev-dot sev-" + p.severity} />
              {showIds && <span className="prob-id mono muted">{p.id}</span>}
              <span className="prob-title">{p.title}</span>
            </div>
            <p className="prob-note muted">{p.note}</p>
            <div className="prob-foot muted">
              addresses {p.affects.length} mission{p.affects.length === 1 ? "" : "s"}
            </div>
          </RBtn>
        ))}
      </div>
    </section>
  );
}

// ---------- MISSION + GOALS ----------
interface MissionGoalsProps extends CommonSectionProps {
  missionId: string;
  onMission: (id: string) => void;
  onOpenGoal: (g: Goal) => void;
}

export function MissionGoals({ telos, missionId, onMission, onTrace, onOpenGoal, showIds, openFile }: MissionGoalsProps) {
  const active = telos.missions.find((m) => m.id === missionId) ?? telos.missions[0];
  const metricMap: Record<string, Telos["metrics"][number]> = Object.fromEntries(
    telos.metrics.map((m) => [m.id, m]),
  );
  return (
    <section className="mission-goals">
      <header className="band-head">
        <div>
          <h2 className="band-title">Mission &amp; Goals</h2>
          <p className="band-sub">The chosen purpose and the outcomes in its service.</p>
        </div>
        <div className="seg">
          {telos.missions.map((m) => (
            <button
              key={m.id}
              className={m.id === missionId ? "on" : ""}
              onClick={() => onMission(m.id)}
              type="button"
            >
              {m.horizon}
            </button>
          ))}
        </div>
      </header>

      <RBtn
        className="telos-card mission-card"
        onClick={() => openFile ? openFile("MISSION.md") : onTrace(active.id)}
        style={{ background: "linear-gradient(90deg, rgba(154,203,255,0.08), #0F1A33)" }}
      >
        <div className="mission-eyebrow">Mission · {active.horizon}</div>
        <h3 className="mission-title">{active.title}</h3>
        <div className="mission-foot muted">
          {active.addresses && <>answers {active.addresses.length} problems · </>}
          {telos.goals.length} goals serve this
          {showIds && <span className="mono" style={{ marginLeft: 10 }}>{active.id}</span>}
        </div>
      </RBtn>

      <div className="goals-grid">
        {telos.goals.map((g) => {
          const primaryMetric = metricMap[g.metrics[0]];
          return (
            <RBtn key={g.id} className={"telos-card goal-card dim-" + (g.dims[0] || "freedom")} onClick={() => openFile ? openFile("GOALS.md") : onOpenGoal(g)}>
              <div className="goal-title">
                {showIds && <span className="card-id mono muted">{g.id}</span>}
                {g.title}
                {openFile && (
                  // Single click edits source markdown consistently; this detail affordance preserves the Goal modal.
                  <button
                    type="button"
                    aria-label={`Open goal detail for ${g.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenGoal(g);
                    }}
                    style={{ marginLeft: "auto", background: "transparent", color: "#9ACBFF", border: "1px solid #1A2A4D", borderRadius: 4, cursor: "pointer" }}
                  >
                    ↗
                  </button>
                )}
              </div>
              <div className="goal-kpi">
                <span className="kpi-val mono">{g.kpi}</span>
                <span className="kpi-arrow muted">→</span>
                <span className="kpi-target mono muted">{g.target}</span>
                <span
                  className={"kpi-delta mono " + (g.delta > 0 ? "green-up" : g.delta < 0 ? "coral-down" : "flat-muted")}
                  style={{ marginLeft: "auto" }}
                >
                  {g.delta > 0 ? "+" : ""}{g.delta}
                </span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: g.pct + "%" }} /></div>
              <div className="goal-foot">
                <div className="goal-dims">
                  {g.dims.map((d) => <span key={d} className={"pill pill-" + d}>{d}</span>)}
                </div>
                {primaryMetric && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="pill metric-chip"
                    onClick={(e) => { e.stopPropagation(); onTrace(primaryMetric.id); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onTrace(primaryMetric.id);
                      }
                    }}
                  >
                    {primaryMetric.label}
                  </span>
                )}
              </div>
            </RBtn>
          );
        })}
      </div>
    </section>
  );
}

// ---------- METRICS ----------
interface MetricSparkProps {
  pts: readonly number[];
  color: string;
}

function MetricSpark({ pts, color }: MetricSparkProps) {
  if (!pts || pts.length === 0) return null;
  const W = 100;
  const H = 24;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const d = pts
    .map((v, i) => `${(i / (pts.length - 1)) * W},${H - ((v - min) / Math.max(0.001, max - min)) * H}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mspark" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.6" points={d} />
    </svg>
  );
}

export function Metrics({ telos, onTrace, showIds, openFile }: CommonSectionProps) {
  return (
    <section className="metrics">
      <header className="band-head">
        <div>
          <h2 className="band-title">Metrics</h2>
          <p className="band-sub">First-class measurements. Each links up to a Goal, down to the Work producing it.</p>
        </div>
      </header>
      <div className="metric-grid">
        {telos.metrics.map((m) => (
          <RBtn key={m.id} className="telos-card metric" onClick={() => openFile ? openFile("METRICS.md") : onTrace(m.id)}>
            <div className="metric-top">
              {showIds && <span className="mono metric-id muted">{m.id}</span>}
              <span className="metric-label muted">{m.label}</span>
            </div>
            <div className="metric-row">
              <span className="metric-val mono">
                {m.value}<span className="metric-unit muted">{m.unit}</span>
              </span>
              <span className={"metric-trend " + (m.trend > 0 ? "up" : m.trend < 0 ? "down" : "flat")}>
                {m.trend > 0 ? "↗" : m.trend < 0 ? "↘" : "·"} {Math.abs(m.trend)}
              </span>
            </div>
            <MetricSpark pts={m.spark} color="#9ACBFF" />
            <div className="metric-foot muted">
              feeds {m.feeds.join(", ")}
            </div>
          </RBtn>
        ))}
      </div>
    </section>
  );
}

// ---------- CHALLENGES × STRATEGIES (2-col) ----------
type CSMode = "columns" | "graph";

interface ChallengeStrategyProps extends CommonSectionProps {
  onOpenGoal: (g: Goal) => void;
}

export function ChallengeStrategy({ telos, onTrace, showIds, openFile }: ChallengeStrategyProps) {
  const [mode, setMode] = useState<CSMode>("columns");
  const [hover, setHover] = useState<string | null>(null);
  const rel: Set<string> = hover
    ? (() => {
        const out = new Set<string>([hover]);
        const c = telos.challenges.find((x) => x.id === hover);
        const s = telos.strategies.find((x) => x.id === hover);
        if (c) telos.strategies.forEach((ss) => ss.overcomes.includes(c.id) && out.add(ss.id));
        if (s) s.overcomes.forEach((id) => out.add(id));
        return out;
      })()
    : new Set<string>();

  return (
    <section className="cs">
      <header className="band-head">
        <div>
          <h2 className="band-title">Challenges &amp; Strategies</h2>
          <p className="band-sub">Personal blockers on the left; the plays answering them on the right. Hover to trace.</p>
        </div>
        <div className="seg">
          <button className={mode === "columns" ? "on" : ""} onClick={() => setMode("columns")} type="button">Columns</button>
          <button className={mode === "graph" ? "on" : ""} onClick={() => setMode("graph")} type="button">Graph</button>
        </div>
      </header>

      {mode === "columns" ? (
        <div className="cs-cols">
          <div className="col">
            <div className="col-head"><span>Challenges</span><span className="col-head-note">what&rsquo;s in the way</span></div>
            <div className="col-body">
              {telos.challenges.map((c) => {
                const faded = hover !== null && !rel.has(c.id);
                return (
                  <RBtn
                    key={c.id}
                    className={"telos-card challenge" + (faded ? " faded" : "") + (rel.has(c.id) ? " active" : "")}
                    onMouseEnter={() => setHover(c.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => openFile ? openFile("CHALLENGES.md") : onTrace(c.id)}
                    style={{ borderLeft: "3px solid #9ACBFF" }}
                  >
                    <div className="card-row">
                      {showIds && <span className="card-id mono muted">{c.id}</span>}
                      <div className="card-title">{c.title}</div>
                    </div>
                    <div className="card-note muted">{c.note}</div>
                    <div className="card-links muted">
                      <span className="link-label">blocks</span>
                      <span className="link-count">{c.blocks.length} goals</span>
                    </div>
                  </RBtn>
                );
              })}
            </div>
          </div>
          <div className="col">
            <div className="col-head"><span>Strategies</span><span className="col-head-note">how we&rsquo;re answering</span></div>
            <div className="col-body">
              {telos.strategies.map((s) => {
                const faded = hover !== null && !rel.has(s.id);
                const parts = s.title.split("—").map((x) => x?.trim());
                const head = parts[0] ?? s.title;
                const rule = parts[1];
                return (
                  <RBtn
                    key={s.id}
                    className={"telos-card strategy" + (faded ? " faded" : "") + (rel.has(s.id) ? " active" : "") + (s.active ? " current" : "")}
                    onMouseEnter={() => setHover(s.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => openFile ? openFile("STRATEGIES.md") : onTrace(s.id)}
                    style={{ borderLeft: "3px solid #3B82F6" }}
                  >
                    <div className="card-row">
                      {showIds && <span className="card-id mono muted">{s.id}</span>}
                      <div className="card-title">{head}</div>
                      {s.active && <span className="badge-now pill">doing this</span>}
                    </div>
                    {rule && <div className="card-rule muted">{rule}</div>}
                    <div className="card-links muted">
                      <span className="link-label">answers</span><span className="link-count">{s.overcomes.length}</span>
                      <span className="link-sep">·</span>
                      <span className="link-label">pushes</span><span className="link-count">{s.implements.length}</span>
                    </div>
                  </RBtn>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="cs-graph" style={{ background: "#0F1A33", border: "1px solid #1A2A4D", borderRadius: 12, padding: 16 }}>
          <svg viewBox="0 0 1000 520" className="force-svg" preserveAspectRatio="xMidYMid meet">
            {telos.challenges.map((c, i) => {
              const y = 60 + i * (420 / Math.max(1, telos.challenges.length - 1));
              const active = hover === null || rel.has(c.id);
              return (
                <g
                  key={c.id}
                  opacity={active ? 1 : 0.25}
                  onMouseEnter={() => setHover(c.id)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect x="40" y={y - 16} width="300" height="32" rx="4" fill="#12203D" stroke="#9ACBFF" strokeOpacity="0.4" />
                  <text x="55" y={y + 4} fill="#E8EFFF" fontSize="12">{c.title}</text>
                </g>
              );
            })}
            {telos.strategies.map((s, i) => {
              const y = 40 + i * (450 / Math.max(1, telos.strategies.length - 1));
              const active = hover === null || rel.has(s.id);
              return (
                <g
                  key={s.id}
                  opacity={active ? 1 : 0.25}
                  onMouseEnter={() => setHover(s.id)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect x="660" y={y - 16} width="300" height="32" rx="4" fill="#12203D" stroke="#3B82F6" strokeOpacity="0.45" />
                  <text x="675" y={y + 4} fill="#E8EFFF" fontSize="12">{s.title.split("—")[0].trim()}</text>
                </g>
              );
            })}
            {telos.strategies.flatMap((s, i) => {
              const sy = 40 + i * (450 / Math.max(1, telos.strategies.length - 1));
              return s.overcomes.map((cid) => {
                const ci = telos.challenges.findIndex((c) => c.id === cid);
                const cy = 60 + ci * (420 / Math.max(1, telos.challenges.length - 1));
                const active = hover === null || (rel.has(s.id) && rel.has(cid));
                return (
                  <path
                    key={s.id + cid}
                    d={`M 340 ${cy} C 500 ${cy}, 500 ${sy}, 660 ${sy}`}
                    fill="none"
                    stroke="#3B82F6"
                    strokeOpacity={active ? 0.55 : 0.12}
                    strokeWidth={active ? 1.4 : 0.7}
                  />
                );
              });
            })}
          </svg>
        </div>
      )}
    </section>
  );
}

// ---------- TEAM ----------
export function Team({ telos, onTrace, showIds, openFile }: CommonSectionProps) {
  return (
    <section className="team-sec">
      <header className="band-head">
        <div>
          <h2 className="band-title">Team</h2>
          <p className="band-sub">Humans and agents doing the Work.</p>
        </div>
      </header>
      <div className="team-grid">
        {telos.team.map((t) => (
          <RBtn key={t.id} className={"telos-card team-" + t.kind} onClick={() => openFile ? openFile("TEAM.md") : onTrace(t.id)}>
            <div className="team-top">
              <div className="avatar team-avatar">{t.avatar}</div>
              <div className="team-head">
                <div className="team-name">
                  {t.name} <span className={"pill team-kind " + t.kind}>{t.kind}</span>
                </div>
                <div className="team-role muted">
                  {t.role}
                  {showIds && <span className="mono" style={{ marginLeft: 8 }}>{t.id}</span>}
                </div>
              </div>
            </div>
            <p className="team-note muted">{t.note}</p>
            <div className="team-owns">
              <span className="owns-label muted">owns</span>
              {t.owns.map((pid) => {
                const p = telos.projects.find((x) => x.id === pid);
                return p ? (
                  <span
                    key={pid}
                    role="button"
                    tabIndex={0}
                    className="pill owns-chip"
                    onClick={(e) => { e.stopPropagation(); onTrace(pid); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onTrace(pid);
                      }
                    }}
                  >
                    {p.title}
                  </span>
                ) : null;
              })}
            </div>
          </RBtn>
        ))}
      </div>
    </section>
  );
}

// ---------- BUDGET ----------
export function Budget({ telos, onTrace, showIds, openFile }: CommonSectionProps) {
  const groups = {
    money:     telos.budget.filter((b) => b.kind === "money"),
    time:      telos.budget.filter((b) => b.kind === "time"),
    attention: telos.budget.filter((b) => b.kind === "attention"),
  };
  return (
    <section className="budget">
      <header className="band-head">
        <div>
          <h2 className="band-title">Budget</h2>
          <p className="band-sub">What&rsquo;s being spent, and on what. Money, time, attention.</p>
        </div>
      </header>
      <div className="budget-cols">
        {Object.entries(groups).map(([kind, rows]) => (
          <div key={kind} className="budget-col">
            <div className="budget-kind">{kind}</div>
            {rows.map((b) => (
              <RBtn
                key={b.id}
                className={"telos-card budget-row" + (b.warn ? " warn" : "")}
                onClick={() => openFile ? openFile("BUDGET.md") : onTrace(b.id)}
                style={b.warn ? { borderLeft: "3px solid #F87171" } : {}}
              >
                <div className="budget-head-row">
                  {showIds && <span className="mono card-id muted">{b.id}</span>}
                  <span className="budget-label">{b.label}</span>
                  <span className="budget-val mono" style={{ marginLeft: "auto" }}>
                    {b.value}<span className="budget-of muted">/{b.of}</span>
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: Math.min(100, b.pct) + "%",
                      background: b.warn ? "linear-gradient(90deg,#F87171,#FBBF24)" : undefined,
                    }}
                  />
                </div>
                <div className="budget-note muted">
                  <span>{b.note}</span>
                  {b.funds.length > 0 && (
                    <span className="budget-funds">funds {b.funds.length} item{b.funds.length === 1 ? "" : "s"}</span>
                  )}
                </div>
              </RBtn>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- RECOMMENDATIONS ----------
export function Recommendations({ telos, onTrace, openFile }: CommonSectionProps) {
  return (
    <section className="recs">
      <header className="band-head">
        <div>
          <h2 className="band-title">Recommendations</h2>
          <p className="band-sub">The next two or three moves, with the trace that makes the case.</p>
        </div>
      </header>
      <div className="recs-list">
        {telos.recommendations.map((r, i) => (
          <div
            key={r.id}
            role={openFile ? "button" : undefined}
            tabIndex={openFile ? 0 : undefined}
            className={"telos-card rec rec-" + r.impact}
            style={{ ...CARD_BG, cursor: openFile ? "pointer" : "default" }}
            onClick={openFile ? () => openFile("STATUS.md") : undefined}
            onKeyDown={openFile ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openFile("STATUS.md");
              }
            } : undefined}
          >
            <div className="rec-n mono muted">{String(i + 1).padStart(2, "0")}</div>
            <div className="rec-body">
              <div className="rec-action">{r.action}</div>
              <div className="rec-because muted"><span className="rec-label">because</span> {r.because}</div>
              <div className="rec-trace">
                <span className="rec-label muted">traces</span>
                {r.upstream.map((id) => (
                  <span
                    key={id}
                    role="button"
                    tabIndex={0}
                    className="pill rec-chip mono"
                    onClick={() => onTrace(id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onTrace(id);
                      }
                    }}
                  >
                    {id}
                  </span>
                ))}
              </div>
            </div>
            <div className="rec-meta muted">
              <div><span className="rec-label">effort</span> {r.effort}</div>
              <div><span className="rec-label">impact</span> <span className={"rec-impact " + r.impact}>{r.impact}</span></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- PREFERENCES ----------
interface PreferencesProps {
  telos: Telos;
  openFile?: (name: string) => void;
}

interface PrefListArgs {
  label: string;
  items: readonly string[];
  tone?: string;
  file?: string;
}

export function Preferences({ telos, openFile }: PreferencesProps) {
  const [open, setOpen] = useState<boolean>(false);
  const p = telos.preferences;
  const list = ({ label, items, tone, file }: PrefListArgs) => {
    const clickable = openFile && file;
    return (
      <div
        className="pref-col"
        key={label}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? (e) => { e.stopPropagation(); openFile(file); } : undefined}
        onKeyDown={clickable ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            openFile(file);
          }
        } : undefined}
        style={clickable ? { cursor: "pointer" } : undefined}
      >
        <div className="pref-label muted">{label}</div>
        <div className="pref-items">
          {items.map((x, i) => (
            <span key={i} className={"pref-item " + (tone || "")}>{x}</span>
          ))}
        </div>
      </div>
    );
  };
  return (
    <section className={"telos-card prefs" + (open ? " open" : "")} style={{ ...CARD_BG, padding: 0, cursor: "default" }}>
      <div
        role="button"
        tabIndex={0}
        className="prefs-toggle"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <span className="prefs-title">Preference context</span>
        <span className="prefs-sub muted">The signals that aren&rsquo;t primitives but color every decision.</span>
        <Icons.Chev
          size={14}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms", marginLeft: "auto", color: "#6B80AB" }}
        />
      </div>
      {open && (
        <div className="prefs-body">
          {list({ label: "Books", items: p.books, file: "BOOKS.md" })}
          {list({ label: "Films", items: p.films, file: "MOVIES.md" })}
          {list({ label: "Music", items: p.music ?? [], file: "BANDS.md" })}
          {list({ label: "Anime", items: p.anime, file: "MOVIES.md" })}
          {list({ label: "Characters", items: p.characters, file: "AUTHORS.md" })}
          {list({ label: "Aphorisms", items: p.aphorisms, tone: "aph", file: "WISDOM.md" })}
          {list({ label: "Hobbies", items: p.hobbies, file: "IDEAS.md" })}
          {list({ label: "Literature", items: p.literature, file: "AUTHORS.md" })}
        </div>
      )}
    </section>
  );
}
