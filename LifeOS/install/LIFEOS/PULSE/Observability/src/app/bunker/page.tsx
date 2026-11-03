"use client";

import { useRef, useState, type ReactNode } from "react";
import { ApiError, useApi } from "@/lib/api";
import { PageShell, PageHeader, Panel, PanelHeader, Pill, StatTile, EmptyState, type Dim } from "@/components/ui/chrome";
import type { LucideIcon } from "lucide-react";
import {
  Container, Globe, Server, Building2, Cog, Workflow, Terminal, Smartphone, Box,
  LayoutGrid, Activity, ShieldCheck, Shield, DollarSign, FlaskConical, Layers, FolderGit2,
  CheckCircle2, XCircle, MinusCircle, Camera, Hand, Bot, GitCommitHorizontal, Image as ImageIcon,
  FileCode2, KeyRound, Rocket, SlidersHorizontal, Database, CreditCard, ExternalLink,
  ArrowLeft, Plus, Radio, Clock, Link2, AlertTriangle, Gavel,
} from "lucide-react";
import { fmtClock, fmtDate, fmtDateTime } from "@/lib/time";
import { provisionalDim, provisionalSummary, provisionalPill, type ProvisionalMark } from "@/lib/bunker-provisional";

// ── Bunker: the application-harness readout. Each app is a bay with ISA probes. ──

interface Probe {
  isc: string; check: string; status: string; detail: string;
  type?: string; tool?: string; anchors_to?: string; severity?: string; tier?: string; lane?: string; stage?: number;
  // ISC-20: a judged eval row with no earned calibration record (age in days, why, past-the-limit).
  provisional?: ProvisionalMark | null;
}
interface AppSecurity {
  status: "green" | "orange" | "red";
  lastScan: string;
  targets: string[];
  fails: number;
  errors: number;
  failing: { target: string; category: string; check: string; severity: string }[];
}
interface App {
  name: string; type: string; dir: string; isaPath: string; url?: string;
  platform?: string; components?: Record<string, unknown>;
  pass: number; fail: number; skip: number; og: boolean; favicon: boolean; shot: boolean; probes: Probe[];
  lastCommit?: { at: string; subject: string } | null;
  security?: AppSecurity | null;
  tiers?: { code: number; glance: number; judge: number; human: number };
  unspannedFeatures?: string[];
  tierMovement?: { movedDown: number; periodStart: string };
}
interface Snapshot {
  apps: App[];
  summary: { apps: number; green: number; probesPass: number; probesTotal: number; manual: number };
  lastFetch: string | null;
  // Served by modules/bunker.ts since 2026-09-02: true when the monitor's
  // snapshot is missing or older than two cycles. Rendered as a red fault,
  // never as a quiet "pending" — that quiet state hid 0 bays for days.
  stale?: boolean;
  stale_reason?: string;
}

function st(a: App): "ok" | "down" | "idle" {
  const total = a.pass + a.fail;
  if (total === 0) return "idle";
  return a.fail > 0 ? "down" : "ok";
}
// app/probe status → design-token dimension. ok=ok, down=err, idle=warn.
const stDim = (s: string): Dim => (s === "ok" ? "ok" : s === "down" ? "err" : "warn");
const dimVar = (d: Dim): string => `var(--${d === "blue" ? "accent-blue" : d === "neutral" ? "ink-3" : d})`;

// ── Icon vocabulary: every kind of thing in Bunker has one, so the page reads
// at a glance instead of by parsing labels. ──

const TYPE_ICON: Record<string, LucideIcon> = {
  "web-static": Globe,
  "web-service": Server,
  "web-enterprise": Building2,
  worker: Cog,
  pipeline: Workflow,
  cli: Terminal,
  mobile: Smartphone,
};
const typeIcon = (t: string): LucideIcon => TYPE_ICON[t] ?? Box;

const PROBE_KIND_ICON: Record<string, LucideIcon> = {
  bash: Terminal,
  curl: Globe,
  "bun-test": FlaskConical,
  "bun-property": FlaskConical,
  manual: Hand,
  screenshot: Camera,
  eval: Bot,
};

const PLANE_ICON: Record<string, LucideIcon> = {
  QUALITY: FlaskConical,
  OBSERVABILITY: Activity,
  SECURITY: Shield,
  DELIVERY: Rocket,
  CONTROL: SlidersHorizontal,
  IDENTITY: KeyRound,
  DATA: Database,
  COMMERCE: CreditCard,
};

// ── Time helpers ──

const ago = (iso: string | null | undefined): string => {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "?";
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.round(mo / 12)}y ago`;
};
const clock = (iso: string | null): string => fmtClock(iso);
const host = (u?: string): string => {
  if (!u) return "";
  try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; }
};

// ── Site health (cloud uptime) — fetched ONCE at page level so a bay card can
// show its own uptime without a click, and the roster panel reuses the same data. ──

interface SiteRow { name: string; url: string; state: string; lastCheck: string | null; since: string | null; spark: number[] }
interface SiteHealthData { total: number; red: number; degraded: number; updatedAt: string | null; apps: SiteRow[]; error?: string }

const siteDim = (s: string): Dim => (s === "green" ? "ok" : s === "degraded" ? "warn" : "err");

/** The text a failed read shows, matching the old "Error: <message>" strings. */
function errText(e: unknown, bodyError = false): string {
  if (e instanceof ApiError) {
    let msg: string | undefined;
    if (bodyError) { try { msg = JSON.parse(e.body)?.error; } catch { /* non-JSON body */ } }
    return String(new Error(msg ?? "HTTP " + e.status));
  }
  return String(e);
}

/**
 * A polled read whose body may carry an `error` field. Keeps the last good payload while a later
 * read fails or reports an error, and returns the error text beside it.
 */
function useCheckedApi<T>(path: string, interval: number): { d: T | null; err: string | null } {
  const q = useApi<T>(path, { refetchInterval: interval });
  const good = useRef<T | null>(null);
  const bodyErr = (q.data as { error?: string } | undefined)?.error;
  if (q.data && !bodyErr) good.current = q.data;
  const err = q.isError ? errText(q.error, true) : bodyErr ? String(new Error(bodyErr)) : null;
  return { d: good.current, err };
}

function useSiteHealth() {
  return useCheckedApi<SiteHealthData>("/api/bunker/sitehealth", 60_000);
}

/** The uptime row for an app — matched on hostname, falling back to name. */
function uptimeOf(app: App, sites: SiteRow[] | undefined): SiteRow | null {
  if (!sites) return null;
  const h = host(app.url);
  return (
    (h ? sites.find((s) => host(s.url) === h) : undefined) ??
    sites.find((s) => s.name === app.name) ??
    null
  );
}

// ── Small readouts ──

/** One labelled fact with an icon — the card's scannable unit. */
function Fact({ icon: Icon, children, dim = "neutral", title }: { icon: LucideIcon; children: ReactNode; dim?: Dim; title?: string }) {
  const c = dim === "neutral" ? "var(--ink-3)" : dimVar(dim);
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap" style={{ fontSize: 12, color: c }} title={title}>
      <Icon style={{ width: 13, height: 13, flex: "none" }} />
      {children}
    </span>
  );
}

function Spark({ spark, height = 18, className = "" }: { spark: number[]; height?: number; className?: string }) {
  const pts = spark.slice(-96);
  if (pts.length === 0) return null;
  return (
    <span className={`flex items-end gap-[1px] ${className}`} style={{ height }} title={`${pts.length} checks`}>
      {pts.map((v, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: v === 2 ? height : v === 1 ? height * 0.55 : height * 0.3,
            background: v === 2 ? "var(--ok)" : v === 1 ? "var(--warn)" : "var(--err)",
            borderRadius: 1,
            flex: "none",
          }}
        />
      ))}
    </span>
  );
}

export default function BunkerPage() {
  const snapQ = useApi<Snapshot>("/api/bunker", { refetchInterval: 60_000 });
  const data = snapQ.data ?? null; // a failed refetch keeps the last good snapshot
  const error = snapQ.isError ? errText(snapQ.error) : null;
  const [selected, setSelected] = useState<string | null>(null);
  // The four fleet tiles are filters over the bay list: click one to keep only
  // the bays it counts, click it again (or the Bays tile) to clear.
  const [filter, setFilter] = useState<BayFilter>("all");
  const site = useSiteHealth();


  const app = data?.apps.find((a) => a.name === selected) ?? null;
  // public issue #1843, @jacobo-ortiz — the status pill must reflect the fleet, not the page rendering
  // A stale or empty snapshot is a FAULT in the display plane, shown as one.
  const fleetStatus = !data ? "NO DATA" : data.stale ? "DISPLAY STALE" : data.apps.length === 0 ? "NO APPS" : "SYSTEMS ONLINE";
  const fleetOnline = fleetStatus === "SYSTEMS ONLINE";
  const fleetFault = fleetStatus === "DISPLAY STALE" || fleetStatus === "NO APPS";

  return (
    <PageShell>
      <PageHeader
        icon={Container}
        title="Bunker"
        subtitle="Universal application harness · discovery-based registry · the harness speaks ISA"
        actions={
          <>
            <Pill dim={fleetOnline ? "ok" : fleetFault ? "err" : "neutral"}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: fleetOnline ? "var(--ok)" : fleetFault ? "var(--err)" : "var(--ink-3)", animation: fleetOnline ? "pulse 2s ease-in-out infinite" : undefined }} />
              {fleetStatus}
            </Pill>
            {data && (
              <Pill dim={data.summary.probesPass === data.summary.probesTotal ? "ok" : "warn"}>
                {data.summary.apps} APPS · {data.summary.probesPass}/{data.summary.probesTotal} ✓
              </Pill>
            )}
          </>
        }
      />

      {data && fleetFault && (
        <Panel style={{ borderLeftWidth: 2, borderLeftColor: "var(--err)" }}>
          <span style={{ color: "var(--err)" }}>
            DISPLAY FAULT · {data.stale_reason ?? "snapshot has no apps"} — the numbers below are not current. Check com.lifeos.bunkermonitor.
          </span>
        </Panel>
      )}
      {error && (
        <Panel style={{ borderLeftWidth: 2, borderLeftColor: "var(--err)" }}>
          <span style={{ color: "var(--err)" }}>SIGNAL LOST · /api/bunker — {error}</span>
        </Panel>
      )}
      {!data && !error && <EmptyState icon={Container} title="Establishing link…" />}

      {data && !app && (
        <>
          <FleetStats data={data} site={site.d} filter={filter} onFilter={setFilter} />
          <Bays data={data} sites={site.d?.apps} onOpen={setSelected} filter={filter} onFilter={setFilter} />
          <SiteHealthPanel d={site.d} err={site.err} />
          <CloudScanPanel />
          <CodeSweepPanel />
          <CostPanel />
        </>
      )}
      {data && app && <Readout app={app} uptime={uptimeOf(app, site.d?.apps)} onBack={() => setSelected(null)} />}

      {data && (
        <div className="text-[11px] tracking-[0.12em] text-ink-3">
          {data.lastFetch ? `LAST SCAN ${fmtClock(data.lastFetch)} · ` : ""}discovery-based registry
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </PageShell>
  );
}

// ── Fleet stats: the four numbers that describe the whole harness. Each tile is a filter. ──

type BayFilter = "all" | "failing" | "security" | "down";
const FILTER_LABEL: Record<BayFilter, string> = { all: "", failing: "FAILING PROBES", security: "SECURITY FLAGGED OR UNSCANNED", down: "UPTIME NOT GREEN" };

function bayMatches(app: App, filter: BayFilter, sites: SiteRow[] | undefined): boolean {
  switch (filter) {
    case "all": return true;
    case "failing": return app.fail > 0;
    case "security": return !app.security || app.security.status !== "green";
    case "down": { const u = uptimeOf(app, sites); return !!u && u.state !== "green"; }
  }
}

function FleetStats({ data, site, filter, onFilter }: { data: Snapshot; site: SiteHealthData | null; filter: BayFilter; onFilter: (f: BayFilter) => void }) {
  const toggle = (f: BayFilter) => onFilter(filter === f ? "all" : f);
  const red = data.apps.filter((a) => a.fail > 0).length;
  const noProbes = data.apps.filter((a) => a.pass + a.fail === 0).length;
  const secRed = data.apps.filter((a) => a.security && a.security.status !== "green").length;
  const secNone = data.apps.filter((a) => !a.security).length;
  const up = site ? site.total - site.red - site.degraded : null;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
      <StatTile
        icon={LayoutGrid}
        label="Bays"
        value={data.summary.apps}
        dim="blue"
        sub={`${data.summary.green} green · ${red} failing · ${noProbes} unprobed`}
        onClick={() => onFilter("all")}
        active={filter === "all"}
      />
      <StatTile
        icon={FlaskConical}
        label="ISA Probes"
        value={`${data.summary.probesPass}/${data.summary.probesTotal}`}
        dim={data.summary.probesPass === data.summary.probesTotal ? "ok" : "err"}
        sub={`${data.summary.manual} manual criteria not machine-checkable`}
        onClick={() => toggle("failing")}
        active={filter === "failing"}
      />
      <StatTile
        icon={Shield}
        label="Security"
        value={secRed === 0 ? "CLEAN" : `${secRed} FLAGGED`}
        dim={secRed === 0 ? "ok" : "warn"}
        sub={`hourly cloud scan · ${secNone} bays with no scan target`}
        onClick={() => toggle("security")}
        active={filter === "security"}
      />
      <StatTile
        icon={Activity}
        label="Uptime"
        value={site ? `${up}/${site.total}` : "…"}
        dim={site ? (site.red > 0 ? "err" : site.degraded > 0 ? "warn" : "ok") : "neutral"}
        sub={site ? `5-min cloud monitor · ${site.updatedAt ? `checked ${ago(site.updatedAt)}` : "no recent check"}` : "cloud monitor loading"}
        onClick={() => toggle("down")}
        active={filter === "down"}
      />
    </div>
  );
}

function Thumb({ app, w, h }: { app: App; w: number | string; h: number }) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  // Prefer the real live-page screenshot (bunker shots), then the OG image, then the tile.
  const kind = app.shot && !broken.shot ? "shot" : app.og && !broken.og ? "og" : null;
  if (kind) {
    return (
      <img
        src={`/api/bunker/asset?app=${encodeURIComponent(app.name)}&kind=${kind}`}
        alt={app.name}
        onError={() => setBroken((b) => ({ ...b, [kind]: true }))}
        className="border border-line-2"
        style={{ width: w, height: h, objectFit: "cover", objectPosition: "top", borderRadius: 3, flex: "none", background: "var(--ground)" }}
      />
    );
  }
  // No screenshot and no social image: draw a real tile rather than a small
  // outline adrift in a black rectangle. The type mark fills the tile, tinted
  // by the bay's own status, over a tinted ground — a designed placeholder,
  // not a broken-image slot.
  const Icon = typeIcon(app.type);
  const c = dimVar(stDim(st(app)));
  const mark = Math.round(h * 0.52);
  return (
    <div
      className="border border-line-2"
      style={{
        width: w, height: h, borderRadius: 3, flex: "none",
        background: `radial-gradient(120% 120% at 50% 20%, color-mix(in srgb, ${c} 12%, var(--surface-1)) 0%, var(--ground) 78%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon style={{ width: mark, height: mark, color: c, opacity: 0.72, strokeWidth: 1.4 }} />
    </div>
  );
}

const PAGE_SIZE = 10;

function Bays({ data, sites, onOpen, filter, onFilter }: { data: Snapshot; sites: SiteRow[] | undefined; onOpen: (n: string) => void; filter: BayFilter; onFilter: (f: BayFilter) => void }) {
  const [page, setPage] = useState(0);
  const apps = data.apps.filter((a) => bayMatches(a, filter, sites));
  const pages = Math.max(1, Math.ceil(apps.length / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const shown = apps.slice(cur * PAGE_SIZE, (cur + 1) * PAGE_SIZE);
  const pager = pages > 1 && (
    <div className="flex items-center gap-4 text-[12px] tracking-[0.14em]">
      <button
        onClick={() => setPage((p) => Math.max(0, p - 1))}
        disabled={cur === 0}
        className="cursor-pointer disabled:cursor-default"
        style={{ background: "none", border: "none", padding: 0, color: cur === 0 ? "var(--ink-3)" : "var(--accent-blue)" }}
      >◂ PREV</button>
      <span className="text-ink-3">PAGE {cur + 1}/{pages} · {apps.length} APPS</span>
      <button
        onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
        disabled={cur >= pages - 1}
        className="cursor-pointer disabled:cursor-default"
        style={{ background: "none", border: "none", padding: 0, color: cur >= pages - 1 ? "var(--ink-3)" : "var(--accent-blue)" }}
      >NEXT ▸</button>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PanelHeader icon={LayoutGrid} title={filter === "all" ? `Application Bays (${data.apps.length})` : `Application Bays · ${FILTER_LABEL[filter]} (${apps.length} of ${data.apps.length})`} className="mb-0" />
        <div className="flex items-center gap-4">
          {filter !== "all" && (
            <button onClick={() => onFilter("all")} className="cursor-pointer text-[12px] tracking-[0.14em]" style={{ background: "none", border: "none", padding: 0, color: "var(--accent-blue)" }}>✕ CLEAR FILTER</button>
          )}
          {pager}
        </div>
      </div>
      {apps.length === 0 && (
        <Panel className="text-ink-3 text-[12px] tracking-[0.1em]">No bays match this filter.</Panel>
      )}
      {shown.map((a) => (
        <BayCard key={a.name} app={a} uptime={uptimeOf(a, sites)} onOpen={() => onOpen(a.name)} />
      ))}
      {pager}
      <Panel className="border-dashed text-ink-3 text-[12px] tracking-[0.1em] flex flex-row items-center gap-2">
        <Plus style={{ width: 14, height: 14 }} /> ADOPT AN APP · bunker adopt &lt;dir&gt;
      </Panel>
    </div>
  );
}

/** One bay card. Carries everything you'd otherwise have to click in for:
 *  what it is, where it lives, what's verified, what's failing, whether the
 *  cloud monitors are green, and when the code last moved. */
function BayCard({ app, uptime, onOpen }: { app: App; uptime: SiteRow | null; onOpen: () => void }) {
  const dim = stDim(st(app));
  const c = dimVar(dim);
  const total = app.pass + app.fail;
  const pct = total === 0 ? 0 : Math.round((app.pass / total) * 100);
  const TypeIcon = typeIcon(app.type);
  const failing = app.probes.filter((p) => p.status === "fail");
  const provisional = app.probes.map((p) => p.provisional);
  const provDim = provisionalDim(provisional);
  const assets = [
    app.shot && { icon: Camera, label: "screenshot" },
    app.og && { icon: ImageIcon, label: "og image" },
    app.favicon && { icon: Link2, label: "favicon" },
  ].filter(Boolean) as { icon: LucideIcon; label: string }[];

  return (
    <Panel
      hover
      onClick={onOpen}
      className="flex flex-row items-center gap-4 cursor-pointer"
      style={{ borderLeftWidth: 2, borderLeftColor: c }}
    >
      <Thumb app={app} w={132} h={78} />
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flex: "none" }} />
          <TypeIcon style={{ width: 15, height: 15, color: c, flex: "none" }} />
          <span className="text-ink-1" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.02em" }}>{app.name}</span>
          <Pill dim="neutral">{app.type.toUpperCase()}</Pill>
          {app.platform && <Pill dim="neutral">{app.platform.replace("cloudflare-", "CF ").toUpperCase()}</Pill>}
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1"
              style={{ fontSize: 12, color: "var(--accent-blue)" }}
            >
              {host(app.url)} <ExternalLink style={{ width: 11, height: 11 }} />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-surface-1 rounded-[3px] overflow-hidden" style={{ height: 5, width: 180, maxWidth: "40vw", flex: "none" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: c }} />
          </div>
          <span style={{ fontSize: 12, color: c, letterSpacing: "0.06em" }}>
            {total === 0 ? "NO PROBES" : `${app.pass}/${total} PROBES`}
          </span>
          {app.skip > 0 && <Fact icon={Hand} title="manual criteria — not machine-checkable">{app.skip} manual</Fact>}
          {failing.length > 0 && (
            <Fact icon={AlertTriangle} dim="err" title={failing.map((f) => `${f.isc} ${f.check}`).join(" · ")}>
              {failing.slice(0, 3).map((f) => f.isc).join(", ")}{failing.length > 3 ? ` +${failing.length - 3}` : ""} failing
            </Fact>
          )}
          {provDim && (
            <Fact icon={Gavel} dim={provDim} title={app.probes.filter((p) => p.provisional).map((p) => `${p.isc}: ${p.provisional!.reason}`).join(" · ")}>
              {provisionalSummary(provisional)}
            </Fact>
          )}
        </div>

        {app.tiers && (
          <div className="flex items-center gap-2 flex-wrap" aria-label={`${app.name} evaluation tier split`}>
            <span className="flex items-center overflow-hidden rounded-[3px] border border-line-2" style={{ fontSize: 10, letterSpacing: "0.08em" }}>
              {(["code", "glance", "judge", "human"] as const).map((tier) => (
                <span key={tier} className="px-2 py-1 border-r border-line-2 last:border-r-0" title={`${app.tiers![tier]} ${tier}-tier probes`}>
                  <span className="text-ink-3">{tier.toUpperCase()}</span> <span className="text-ink-1">{app.tiers![tier]}</span>
                </span>
              ))}
            </span>
            <span className="text-ink-3" style={{ fontSize: 11 }} title={`Period started ${fmtDateTime(app.tierMovement?.periodStart ?? "")}`}>
              ↓ {app.tierMovement?.movedDown ?? 0} moved down
            </span>
            {(app.unspannedFeatures ?? []).map((feature) => <Pill key={feature} dim="warn">{feature} · UNSPANNED</Pill>)}
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <Fact
            icon={Shield}
            dim={app.security ? (app.security.status === "green" ? "ok" : app.security.status === "orange" ? "warn" : "err") : "neutral"}
            title={app.security ? `${app.security.targets.join(", ")} · scanned ${fmtDateTime(app.security.lastScan)}` : "no cloud scan target matched this app"}
          >
            {app.security
              ? `${app.security.status === "green" ? "secure" : `${app.security.fails} security finding${app.security.fails === 1 ? "" : "s"}`} · ${ago(app.security.lastScan)}`
              : "no security scan"}
          </Fact>
          <Fact
            icon={Activity}
            dim={uptime ? siteDim(uptime.state) : "neutral"}
            title={uptime ? `${uptime.state} since ${fmtDateTime(uptime.since)} · last check ${fmtDateTime(uptime.lastCheck)}` : "not in the cloud uptime roster"}
          >
            {uptime ? (uptime.since ? `${uptime.state === "green" ? "up" : uptime.state} ${ago(uptime.since).replace(" ago", "")}` : `${uptime.state} · no recent check`) : "no uptime monitor"}
          </Fact>
          {app.lastCommit && (
            <Fact icon={GitCommitHorizontal} title={`${app.lastCommit.subject} — ${fmtDateTime(app.lastCommit.at)}`}>
              {ago(app.lastCommit.at)}
            </Fact>
          )}
          {assets.length > 0 && (
            <span className="flex items-center gap-1.5" style={{ color: "var(--ink-3)" }} title={assets.map((a) => a.label).join(" · ")}>
              {assets.map(({ icon: I, label }) => <I key={label} style={{ width: 13, height: 13 }} />)}
            </span>
          )}
        </div>
      </div>
      <span className="text-ink-3" style={{ fontSize: 12, letterSpacing: "0.14em", flex: "none" }}>OPEN ▸</span>
    </Panel>
  );
}

// ── The six planes, derived from EVIDENCE, not from a hardcoded per-type table.
// Every row states what is actually true of this app right now — a declared
// component slot, a probe that runs, a monitor that covers it, a file that
// exists. Nothing here is aspirational: a slot with no evidence reads "none",
// never "PENDING", so the panel can't drift away from reality. ──

interface PlaneItem { name: string; on: boolean; note: string }
interface PlaneRow { plane: string; items: PlaneItem[] }

const AUTH_RE = /\b(auth|oauth|login|logout|session|rbac|401|403|bearer|token)\b/i;

function planesFor(app: App, uptime: SiteRow | null): PlaneRow[] {
  const comp = app.components ?? {};
  const declared = (k: string): boolean => Boolean(comp[k]);
  const total = app.pass + app.fail;
  const deep = app.probes.filter((p) => p.lane !== "liveness").length;
  const authProbes = app.probes.filter((p) => AUTH_RE.test(`${p.check} ${p.tool ?? ""}`));
  const isaFile = app.isaPath.split("/").pop() ?? "ISA.md";

  const rows: PlaneRow[] = [
    {
      plane: "QUALITY",
      items: [
        { name: "ISA test strategy", on: total > 0, note: total > 0 ? `${total} probes${app.skip ? ` · ${app.skip} manual` : ""}` : "no runnable probe rows" },
        { name: "deep-tier probes", on: deep > 0, note: deep > 0 ? `${deep} on the slow contract` : "fast probes only" },
        { name: "harness runner", on: true, note: "bunker test · app-relative cwd" },
      ],
    },
    {
      plane: "OBSERVABILITY",
      items: [
        { name: "cloud uptime monitor", on: Boolean(uptime), note: uptime ? `${uptime.state} · 5-min cron · checked ${ago(uptime.lastCheck)}` : "not in the site-health roster" },
        { name: "live screenshot", on: app.shot, note: app.shot ? "captured by bunker shots" : "no shot captured" },
        { name: "tracking", on: declared("tracking"), note: declared("tracking") ? "declared in bunker.config" : "not declared" },
      ],
    },
    {
      plane: "SECURITY",
      items: [
        { name: "hourly infra scan", on: Boolean(app.security), note: app.security ? app.security.targets.join(", ") : "no curated scan target" },
        { name: "open findings", on: Boolean(app.security) && app.security!.fails === 0, note: app.security ? (app.security.fails === 0 ? `clean as of ${ago(app.security.lastScan)}` : `${app.security.fails} failing check${app.security.fails === 1 ? "" : "s"}`) : "not scanned" },
        { name: "headers / secrets", on: declared("headers") || declared("secrets"), note: declared("headers") || declared("secrets") ? "declared in bunker.config" : "not declared" },
      ],
    },
    {
      plane: "DELIVERY",
      items: [
        { name: "public URL", on: Boolean(app.url), note: app.url ? host(app.url) : "not publicly deployed" },
        { name: "brand assets", on: app.og && app.favicon, note: app.og && app.favicon ? "favicon + og image present" : [!app.favicon && "favicon missing", !app.og && "og image missing"].filter(Boolean).join(" · ") },
        { name: "platform", on: Boolean(app.platform), note: app.platform ?? "not declared" },
      ],
    },
    {
      plane: "CONTROL",
      items: [
        { name: "bunker.config.ts", on: true, note: `type ${app.type}` },
        { name: "ISA of record", on: true, note: isaFile },
        { name: "declared components", on: Object.keys(comp).length > 0, note: Object.keys(comp).length > 0 ? Object.keys(comp).join(", ") : "type defaults only" },
      ],
    },
    {
      plane: "IDENTITY",
      items: [
        { name: "auth", on: declared("auth") || authProbes.length > 0, note: declared("auth") ? "declared in bunker.config" : authProbes.length > 0 ? `${authProbes.length} auth-boundary probe${authProbes.length === 1 ? "" : "s"}` : `no auth surface for a ${app.type} app` },
        { name: "rbac", on: declared("rbac"), note: declared("rbac") ? "declared in bunker.config" : "not declared" },
        { name: "audit log", on: declared("audit"), note: declared("audit") ? "declared in bunker.config" : "not declared" },
      ],
    },
  ];

  // Optional planes: shown only when the app actually has one.
  if (declared("data") || declared("storage") || declared("backup")) {
    rows.push({
      plane: "DATA",
      items: [
        { name: "database", on: declared("data"), note: declared("data") ? "declared in bunker.config" : "not declared" },
        { name: "object storage", on: declared("storage"), note: declared("storage") ? "declared in bunker.config" : "not declared" },
        { name: "backup", on: declared("backup"), note: declared("backup") ? "declared in bunker.config" : "not declared" },
      ],
    });
  }
  if (declared("payments") || declared("customerMetrics")) {
    rows.push({
      plane: "COMMERCE",
      items: [
        { name: "payments", on: declared("payments"), note: "declared in bunker.config" },
        { name: "customer metrics", on: declared("customerMetrics"), note: declared("customerMetrics") ? "declared in bunker.config" : "not declared" },
      ],
    });
  }
  return rows;
}

function Readout({ app, uptime, onBack }: { app: App; uptime: SiteRow | null; onBack: () => void }) {
  const dim = stDim(st(app));
  const c = dimVar(dim);
  const total = app.pass + app.fail;
  const pct = total === 0 ? 0 : Math.round((app.pass / total) * 100);
  const TypeIcon = typeIcon(app.type);
  const sec = app.security;

  return (
    <div className="flex flex-col gap-3.5">
      <button onClick={onBack} className="self-start flex items-center gap-1.5 text-[12px] tracking-[0.14em] cursor-pointer" style={{ background: "none", border: "none", color: "var(--accent-blue)", padding: 0 }}>
        <ArrowLeft style={{ width: 13, height: 13 }} /> ALL BAYS
      </button>

      <Thumb app={app} w="100%" h={app.shot || app.og ? 280 : 150} />

      <div className="flex items-center gap-3 flex-wrap">
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, flex: "none" }} />
        <TypeIcon style={{ width: 20, height: 20, color: c, flex: "none" }} />
        <span className="text-ink-1" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.04em" }}>{app.name}</span>
        <Pill dim="neutral">{app.type.toUpperCase()}</Pill>
        {app.platform && <Pill dim="neutral">{app.platform.replace("cloudflare-", "CF ").toUpperCase()}</Pill>}
        {app.url && (
          <a href={app.url} target="_blank" rel="noreferrer" className="flex items-center gap-1" style={{ fontSize: 13, color: "var(--accent-blue)" }}>
            {host(app.url)} <ExternalLink style={{ width: 12, height: 12 }} />
          </a>
        )}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <StatTile
          icon={FlaskConical}
          label="ISA Probes"
          value={total === 0 ? "—" : `${app.pass}/${total}`}
          dim={total === 0 ? "warn" : dim}
          sub={total === 0 ? "no runnable probe rows in this ISA" : `${pct}% green${app.skip ? ` · ${app.skip} manual` : ""}`}
        />
        <StatTile
          icon={Shield}
          label="Security"
          value={sec ? sec.status.toUpperCase() : "NO SCAN"}
          dim={sec ? (sec.status === "green" ? "ok" : sec.status === "orange" ? "warn" : "err") : "neutral"}
          sub={sec ? `${sec.fails} failing · scanned ${ago(sec.lastScan)}` : "no curated scan target"}
        />
        <StatTile
          icon={Activity}
          label="Uptime"
          value={uptime ? uptime.state.toUpperCase() : "UNMONITORED"}
          dim={uptime ? siteDim(uptime.state) : "neutral"}
          sub={uptime ? `since ${fmtDate(uptime.since)} · checked ${ago(uptime.lastCheck)}` : "not in the site-health roster"}
        />
        <StatTile
          icon={GitCommitHorizontal}
          label="Last Commit"
          value={app.lastCommit ? ago(app.lastCommit.at).replace(" ago", "") : "—"}
          dim="neutral"
          sub={app.lastCommit ? app.lastCommit.subject : "not a git repository"}
        />
      </div>

      <RPanel icon={FlaskConical} title="ISA Criteria & Probes" pill={total === 0 ? "NO PROBES" : `${app.pass}/${total} PASS`} dim={total === 0 ? "warn" : dim}>
        {app.probes.length === 0 ? (
          <p className="text-ink-3" style={{ fontSize: 13, margin: 0 }}>
            This ISA has no <span className="mono">## Test Strategy</span> rows. Nothing about this bay is machine-verified.
          </p>
        ) : (
          app.probes.map((p) => {
            const pd = stDim(p.status === "pass" ? "ok" : p.status === "fail" || p.status === "gated" ? "down" : "idle");
            const pc = dimVar(pd);
            const StatusIcon = p.status === "pass" ? CheckCircle2 : p.status === "fail" ? XCircle : MinusCircle;
            const KindIcon = PROBE_KIND_ICON[p.type ?? ""] ?? Terminal;
            return (
              <div key={p.isc} className="flex flex-col gap-0.5 border-b border-line-1" style={{ padding: "7px 0" }}>
                <div className="flex items-center gap-2.5" style={{ fontSize: 13 }}>
                  <StatusIcon style={{ width: 15, height: 15, color: pc, flex: "none" }} />
                  <span className="text-ink-3 mono" style={{ flex: "none", width: 56 }}>{p.isc}</span>
                  <span className="text-ink-1 flex-1 min-w-0">{p.check}</span>
                  {p.status === "gated" && <Pill dim="err">GATED</Pill>}
                  {p.provisional && <Pill dim={p.provisional.red ? "err" : "warn"}>{provisionalPill(p.provisional)}</Pill>}
                  {p.lane === "build" ? <Pill dim="neutral">BUILD</Pill> : p.lane === "integrity" && <Pill dim="neutral">INTEGRITY</Pill>}
                  {p.severity && p.severity !== "normal" && <Pill dim="warn">{p.severity.toUpperCase()}</Pill>}
                  <span className="flex items-center gap-1.5 text-ink-3" style={{ flex: "none", fontSize: 12 }} title={`probe type: ${p.type ?? "?"}`}>
                    <KindIcon style={{ width: 13, height: 13 }} />{p.type}
                  </span>
                  <span style={{ color: pc, flex: "none", fontSize: 12 }}>{p.detail}</span>
                </div>
                {p.tool && (
                  <div className="text-ink-3 mono" style={{ fontSize: 11, paddingLeft: 73, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.tool}>
                    {p.tool}
                  </div>
                )}
              </div>
            );
          })
        )}
      </RPanel>

      <RPanel
        icon={Shield}
        title="Security · Hourly Cloud Scan"
        pill={sec ? `${sec.status.toUpperCase()}${sec.fails ? ` · ${sec.fails} FAILING` : ""}` : "NO TARGET"}
        dim={sec ? (sec.status === "green" ? "ok" : sec.status === "orange" ? "warn" : "err") : "neutral"}
      >
        {!sec ? (
          <p className="text-ink-3" style={{ fontSize: 13, margin: 0 }}>
            No curated target in the infra-security scanner matches this bay, so it gets no auth-boundary checks. Add it to the scanner&apos;s inventory to cover it.
          </p>
        ) : (
          <>
            <div className="text-ink-2" style={{ fontSize: 13, marginBottom: sec.failing.length ? 8 : 0 }}>
              {sec.targets.join(", ")} · scanned {fmtDateTime(sec.lastScan)}
              {sec.errors > 0 ? ` · ${sec.errors} checks errored` : ""}
              {sec.fails === 0 ? " · no failing checks" : ""}
            </div>
            {sec.failing.map((f, i) => (
              <div key={f.check + i} className="flex items-center gap-3 border-b border-line-1" style={{ padding: "6px 0", fontSize: 13 }}>
                <AlertTriangle style={{ width: 14, height: 14, color: dimVar(sevDim(f.severity)), flex: "none" }} />
                <span className="mono text-ink-3" style={{ flex: "none", width: 70 }}>{f.severity.toUpperCase()}</span>
                <span className="text-ink-1 flex-1 min-w-0">{f.check}</span>
                <span className="text-ink-3" style={{ flex: "none" }}>{f.category}</span>
              </div>
            ))}
          </>
        )}
      </RPanel>

      <RPanel
        icon={Activity}
        title="Uptime · 5-Min Cloud Monitor"
        pill={uptime ? uptime.state.toUpperCase() : "UNMONITORED"}
        dim={uptime ? siteDim(uptime.state) : "neutral"}
      >
        {!uptime ? (
          <p className="text-ink-3" style={{ fontSize: 13, margin: 0 }}>
            {app.url
              ? "This bay has a public URL but no row in the site-health roster — the cloud monitor is not watching it."
              : "No public URL, so there is nothing for the uptime monitor to watch."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Spark spark={uptime.spark} height={26} />
            <div className="text-ink-3" style={{ fontSize: 12 }}>
              {uptime.spark.length} checks shown · {uptime.state} since {fmtDateTime(uptime.since)} · last check {fmtDateTime(uptime.lastCheck)}
            </div>
          </div>
        )}
      </RPanel>

      <RPanel icon={Layers} title="Harness Planes · Evidence" pill="DERIVED" dim="blue">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", columnGap: 34, rowGap: 16 }}>
          {planesFor(app, uptime).map((pl) => {
            const PIcon = PLANE_ICON[pl.plane] ?? Box;
            return (
              <div key={pl.plane}>
                <div className="flex items-center gap-1.5 mb-1.5" style={{ color: "var(--accent-blue)" }}>
                  <PIcon style={{ width: 13, height: 13 }} />
                  <span className="text-[10px] tracking-[0.2em]">{pl.plane}</span>
                </div>
                {pl.items.map((it) => (
                  <div key={it.name} className="flex items-baseline gap-2" style={{ padding: "2px 0", fontSize: 13 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: it.on ? "var(--ok)" : "var(--ink-3)", flex: "none", transform: "translateY(-2px)" }} />
                    <span className="text-ink-2" style={{ flex: "none" }}>{it.name}</span>
                    <span className="text-ink-3 flex-1 min-w-0" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.note}>
                      {it.note}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </RPanel>

      <RPanel icon={FolderGit2} title="Source" pill="LOCAL" dim="neutral">
        <div className="flex flex-col gap-1" style={{ fontSize: 12 }} data-sensitive>
          <SourceRow icon={Box} label="type">{app.type}{app.platform ? ` · ${app.platform}` : ""}</SourceRow>
          <SourceRow icon={FolderGit2} label="dir">{app.dir}</SourceRow>
          <SourceRow icon={FileCode2} label="isa">{app.isaPath}</SourceRow>
          {app.url && <SourceRow icon={Globe} label="url">{app.url}</SourceRow>}
          {app.lastCommit && (
            <SourceRow icon={GitCommitHorizontal} label="commit">
              {fmtDateTime(app.lastCommit.at)} — {app.lastCommit.subject}
            </SourceRow>
          )}
        </div>
      </RPanel>
    </div>
  );
}

function SourceRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-ink-3">
      <Icon style={{ width: 13, height: 13, flex: "none" }} />
      <span className="mono" style={{ flex: "none", width: 58 }}>{label}</span>
      <span className="mono text-ink-2 min-w-0" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
    </div>
  );
}

/** A detail-view panel: icon + title + a status pill, tinted by what it reports. */
function RPanel({ icon, title, pill, dim, children }: { icon: LucideIcon; title: string; pill: string; dim: Dim; children: ReactNode }) {
  return (
    <Panel style={{ borderLeftWidth: 2, borderLeftColor: dim === "neutral" ? "var(--line-2)" : dimVar(dim) }}>
      <PanelHeader icon={icon} title={title} actions={<Pill dim={dim}>{pill}</Pill>} />
      {children}
    </Panel>
  );
}

// ── Cost: what the monitoring stack actually costs on Cloudflare. Real request
// counts from the CF analytics API, projected monthly and priced against the plan. ──

interface CostWorker { name: string; reqPerDay: number; reqPerMonth: number }
interface CostData {
  updatedAt: string;
  totalReqPerMonth: number;
  includedRequests: number;
  pctOfIncluded: number;
  marginalMonthly: number;
  standaloneMonthly: number;
  plan: string;
  workers: CostWorker[];
  error?: string;
}

const fmtN = (n: number): string => n.toLocaleString();

function CostPanel() {
  const { d: c, err } = useCheckedApi<CostData>("/api/bunker/cost", 60 * 60_000);

  return (
    <Panel style={{ borderLeftWidth: 2, borderLeftColor: err ? "var(--err)" : "var(--ok)" }}>
      <PanelHeader
        icon={DollarSign}
        title="Monitoring Cost · Cloudflare"
        actions={
          c ? (
            <>
              <Pill dim="ok">${c.marginalMonthly.toFixed(2)}/mo MARGINAL</Pill>
              <Pill dim="neutral">{c.pctOfIncluded < 0.1 ? "<0.1" : c.pctOfIncluded.toFixed(1)}% OF INCLUDED</Pill>
            </>
          ) : (
            <Pill dim={err ? "err" : "neutral"}>{err ? "OFFLINE" : "…"}</Pill>
          )
        }
      />
      {err && <span style={{ color: "var(--err)", fontSize: 13 }}>SIGNAL LOST · /api/bunker/cost — {err}</span>}
      {c && (
        <>
          <p className="text-ink-2" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 10px" }}>
            The uptime and security monitors run {fmtN(c.totalReqPerMonth)} worker requests/month, about{" "}
            {c.pctOfIncluded < 0.1 ? "under 0.1" : c.pctOfIncluded.toFixed(1)}% of the {fmtN(c.includedRequests / 1_000_000)}M included in the
            plan. Marginal cost is <strong style={{ color: "var(--ok)" }}>$0</strong> — it all sits inside the flat {c.plan}.
            Billed purely per-request it would be about ${c.standaloneMonthly.toFixed(2)}/month.
          </p>
          {c.workers.map((w) => (
            <div key={w.name} className="flex items-center gap-3 border-b border-line-1" style={{ padding: "5px 0", fontSize: 13 }}>
              <Cog style={{ width: 13, height: 13, color: "var(--ink-3)", flex: "none" }} />
              <span className="text-ink-1 flex-1 min-w-0">{w.name}</span>
              <span className="text-ink-3 mono whitespace-nowrap" style={{ flex: "none" }}>{fmtN(w.reqPerDay)}/day</span>
              <span className="text-ink-2 mono whitespace-nowrap" style={{ flex: "none", width: 120, textAlign: "right" }}>{fmtN(w.reqPerMonth)}/mo</span>
            </div>
          ))}
          <div className="text-[11px] tracking-[0.12em] text-ink-3" style={{ paddingTop: 6 }}>
            LIVE FROM CLOUDFLARE ANALYTICS · updated {clock(c.updatedAt)} · 24h window projected to 30.4 days
          </div>
        </>
      )}
    </Panel>
  );
}

// ── Site Health: the cloud uptime leg. Every deployed site checked every 5 min
// by the site-health worker (was a public dashboard, now authenticated and
// read into Pulse server-side). Data comes from the page-level hook so the bay
// cards and this roster can never disagree. ──

function SiteHealthPanel({ d, err }: { d: SiteHealthData | null; err: string | null }) {
  const allGreen = d ? d.red === 0 && d.degraded === 0 : false;

  return (
    <Panel style={{ borderLeftWidth: 2, borderLeftColor: err ? "var(--err)" : "var(--accent-blue)" }}>
      <PanelHeader
        icon={Radio}
        title="Cloud Uptime · Every Deployed Site"
        actions={
          d ? (
            <>
              <Pill dim="neutral">{d.total} SITES · 5-MIN</Pill>
              <Pill dim={allGreen ? "ok" : d.red > 0 ? "err" : "warn"}>
                {d.total - d.red - d.degraded} UP{d.degraded ? ` · ${d.degraded} DEGRADED` : ""}{d.red ? ` · ${d.red} DOWN` : ""}
              </Pill>
            </>
          ) : (
            <Pill dim={err ? "err" : "neutral"}>{err ? "OFFLINE" : "…"}</Pill>
          )
        }
      />
      {err && <span style={{ color: "var(--err)", fontSize: 13 }}>SIGNAL LOST · /api/bunker/sitehealth — {err}</span>}
      {d && (
        <>
          {[...d.apps].sort((a, b) => (siteDim(a.state) === "err" ? -1 : siteDim(b.state) === "err" ? 1 : 0)).map((s) => {
            const sd = siteDim(s.state);
            const col = dimVar(sd);
            const Icon = s.state === "green" ? CheckCircle2 : s.state === "degraded" ? AlertTriangle : XCircle;
            return (
              <div key={s.name} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 border-b border-line-1" style={{ padding: "6px 0", fontSize: 13 }}>
                <Icon style={{ width: 14, height: 14, color: col, flex: "none" }} />
                <span className="text-ink-1 truncate grow-0 shrink basis-auto sm:basis-[200px] min-w-0" title={s.name}>{s.name}</span>
                <span style={{ color: col, flex: "none", width: 84, fontSize: 12, letterSpacing: "0.06em" }}>{s.state.toUpperCase()}</span>
                <Spark spark={s.spark} height={14} className="justify-end overflow-hidden order-last basis-full sm:order-none sm:basis-auto grow-0 shrink min-w-0" />
                <span className="flex-1" />
                <span className="text-ink-3 whitespace-nowrap flex items-center gap-1.5" style={{ flex: "none", fontSize: 12 }} title={`${s.state} since ${fmtDateTime(s.since)}`}>
                  <Clock style={{ width: 12, height: 12 }} />{clock(s.lastCheck)}
                </span>
              </div>
            );
          })}
          <div className="text-[11px] tracking-[0.12em] text-ink-3" style={{ paddingTop: 6 }}>
            {d.updatedAt ? `LAST CLOUD CHECK ${fmtDateTime(d.updatedAt)}` : "NO RECENT CLOUD CHECK"} · the site-health worker · 5-min cron · authenticated
          </div>
        </>
      )}
    </Panel>
  );
}

// ── Workflows: the cloud leg of the same uptime/security stack. Hourly worker scan
// over every deployed property; Bunker shows its last report next to the local
// probe results so one page carries the whole picture. ──

interface CloudScanFail { target: string; category: string; check: string; severity: string }
interface CodeSweepState {
  app: string;
  running?: { pid: number; started_at: string; head: string };
  completed_at?: string;
  mode?: "full" | "incremental";
  head?: string;
  wall_ms?: number;
  findings?: { raw: number; corroborated: number; dropped: number; registered: string[]; existing: string[] };
  error?: string;
  error_at?: string;
}
interface CodeSweepData { apps: { app: string; state: CodeSweepState | null }[] }

function CodeSweepPanel() {
  const { d: sweeps, err } = useCheckedApi<CodeSweepData>("/api/bunker/codesweep", 60_000);
  return (
    <Panel style={{ borderLeftWidth: 2, borderLeftColor: err ? "var(--err)" : "var(--accent-blue)" }}>
      <PanelHeader
        icon={FileCode2}
        title="Code Sweep · White-Box Security"
        actions={<Pill dim={err ? "err" : sweeps?.apps.some((row) => Boolean(row.state?.error)) ? "warn" : "ok"}>{err ? "OFFLINE" : `${sweeps?.apps.length ?? "…"} APPS`}</Pill>}
      />
      {err && <span style={{ color: "var(--err)", fontSize: 13 }}>SIGNAL LOST · /api/bunker/codesweep — {err}</span>}
      {sweeps?.apps.length === 0 && <span className="text-ink-3" style={{ fontSize: 13 }}>NEVER SWEPT · no code-sweep state has been recorded.</span>}
      {sweeps?.apps.map(({ app, state }) => {
        const scanFault = Boolean(state?.error) || !state;
        const findings = state?.findings;
        return (
          <div key={app} className="border-b border-line-1" style={{ padding: "9px 0" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <FileCode2 style={{ width: 14, height: 14, color: dimVar(scanFault ? "err" : "ok") }} />
              <span className="text-ink-1 mono" style={{ fontSize: 13, fontWeight: 700 }}>{app}</span>
              <Pill dim={scanFault ? "err" : "ok"}>{scanFault ? "FAULT" : "SWEPT"}</Pill>
              {state?.mode && <Pill dim="neutral">{state.mode.toUpperCase()}</Pill>}
              {state?.head && <span className="mono text-ink-3" style={{ fontSize: 12 }}>HEAD {state.head.slice(0, 8)}</span>}
            </div>
            {state ? <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 6 }}>
              <Fact icon={Clock} title={state.completed_at ? fmtDateTime(state.completed_at) : "no completed sweep"}>{state.completed_at ? `LAST SWEEP ${ago(state.completed_at)}` : "NO COMPLETED SWEEP"}</Fact>
              <Fact icon={Activity}>{state.wall_ms === undefined ? "WALL —" : `WALL ${(state.wall_ms / 1000).toFixed(1)}s`}</Fact>
              <Fact icon={AlertTriangle} dim={(findings?.raw ?? 0) > 0 ? "warn" : "ok"}>{`FINDINGS ${findings?.raw ?? 0} RAW / ${findings?.corroborated ?? 0} CORROBORATED / ${findings?.registered.length ?? 0} REGISTERED`}</Fact>
            </div> : <span style={{ color: "var(--err)", fontSize: 13 }}>STATE FAULT · sweep directory has no readable state.</span>}
            {state?.error && <div style={{ color: "var(--err)", fontSize: 13, marginTop: 6 }}>SWEEP ERROR {state.error_at ? `· ${fmtDateTime(state.error_at)} · ` : "· "}{state.error}</div>}
          </div>
        );
      })}
    </Panel>
  );
}

interface CloudScanData {
  timestamp: string;
  summary: { pass: number; fail: number; error: number; skip: number };
  targets: number;
  bySeverity: Record<string, number>;
  failing: CloudScanFail[];
  error?: string;
}

const sevDim = (s: string): Dim => (s === "critical" || s === "high" ? "err" : s === "medium" ? "warn" : "neutral");

function CloudScanPanel() {
  const { d: scan, err } = useCheckedApi<CloudScanData>("/api/bunker/security-scan", 5 * 60_000);
  const [showAll, setShowAll] = useState(false);

  const shown = scan ? (showAll ? scan.failing : scan.failing.slice(0, 10)) : [];

  return (
    <Panel style={{ borderLeftWidth: 2, borderLeftColor: err ? "var(--err)" : "var(--accent-blue)" }}>
      <PanelHeader
        icon={ShieldCheck}
        title="Cloud Watch · Workflows Infra-Security"
        actions={
          scan ? (
            <>
              <Pill dim="neutral">{scan.targets} TARGETS · HOURLY</Pill>
              <Pill dim={scan.summary.fail > 0 ? "warn" : "ok"}>
                {scan.summary.pass} PASS · {scan.summary.fail} FAIL · {scan.summary.error} ERR
              </Pill>
              {Object.entries(scan.bySeverity).map(([sev, n]) => (
                <Pill key={sev} dim={sevDim(sev)}>{n} {sev.toUpperCase()}</Pill>
              ))}
            </>
          ) : (
            <Pill dim={err ? "err" : "neutral"}>{err ? "OFFLINE" : "…"}</Pill>
          )
        }
      />
      {err && <span style={{ color: "var(--err)", fontSize: 13 }}>SIGNAL LOST · /api/bunker/security-scan — {err}</span>}
      {scan && (
        <>
          {shown.map((f, i) => (
            <div key={f.target + f.check + i} className="flex items-center gap-3 border-b border-line-1" style={{ padding: "6px 0", fontSize: 13 }}>
              <AlertTriangle style={{ width: 14, height: 14, color: dimVar(sevDim(f.severity)), flex: "none" }} />
              <span className="mono" style={{ color: dimVar(sevDim(f.severity)), flex: "none", width: 62 }}>
                {({ critical: "CRIT", high: "HIGH", medium: "MED", low: "LOW" } as Record<string, string>)[f.severity] ?? f.severity.toUpperCase().slice(0, 4)}
              </span>
              <span className="text-ink-1 truncate" style={{ flex: "0 1 200px", minWidth: 0 }} title={f.target}>{f.target}</span>
              <span className="text-ink-2 flex-1 min-w-0">{f.check}</span>
              <span className="text-ink-3" style={{ flex: "none" }}>{f.category}</span>
            </div>
          ))}
          {scan.failing.length > 10 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="self-start text-[12px] tracking-[0.12em] cursor-pointer"
              style={{ background: "none", border: "none", color: "var(--accent-blue)", padding: "6px 0 0" }}
            >
              {showAll ? "◂ SHOW FEWER" : `SHOW ALL ${scan.failing.length} FAILING ▸`}
            </button>
          )}
          <div className="text-[11px] tracking-[0.12em] text-ink-3" style={{ paddingTop: 6 }}>
            LAST CLOUD SCAN {fmtDateTime(scan.timestamp)} · the infra-security worker · hourly cron
          </div>
        </>
      )}
    </Panel>
  );
}
