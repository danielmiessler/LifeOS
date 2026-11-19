/**
 * Synthetic inventory for `next dev` only. The page imports this file inside a
 * `process.env.NODE_ENV !== "production"` branch, and only when /api/workflows
 * is unreachable, so it never reaches the production bundle. Every name here
 * is invented; none describes a real job.
 */

import type { Card, Executor, Finding, Inventory, Runtime, Step, WorkflowRecord } from "../../../../../WORKFLOWS/types";

const NOW = Date.now();
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

type Slot = Card["undeclared"][number];

function card(p: Partial<Omit<Card, "undeclared" | "steps">> & { steps?: Array<[string, Executor]> }): Card {
  const steps: Step[] = (p.steps ?? []).map(([label, executor], i) => ({ id: `s${i + 1}`, label, executor }));
  const c: Card = {
    purpose: p.purpose ?? null,
    input: p.input ?? null,
    steps,
    sop: p.sop ?? null,
    output: p.output ?? null,
    destination: p.destination ?? null,
    inferred: [],
    undeclared: [],
  };
  const missing: Slot[] = [];
  if (!c.purpose) missing.push("purpose");
  if (!c.input) missing.push("input");
  if (steps.length === 0 || steps.every((s) => s.executor === "unknown")) missing.push("steps");
  if (!c.sop) missing.push("sop");
  if (!c.output) missing.push("output");
  if (!c.destination) missing.push("destination");
  c.undeclared = missing;
  return c;
}

interface Spec {
  runtime: Runtime;
  name: string;
  title: string;
  group: string;
  trigger: [WorkflowRecord["trigger"]["kind"], string | null, string, number | null];
  via?: WorkflowRecord["trigger"]["via"];
  lastRunMin?: number | null;
  status?: WorkflowRecord["evidence"]["lastStatus"];
  runs?: number | null;
  installed?: WorkflowRecord["installed"];
  enabled?: boolean;
  declared?: boolean;
  card: Card;
  linked?: string[];
  alsoInstalledAs?: string;
}

function rec(s: Spec): WorkflowRecord {
  const hasRun = s.lastRunMin != null;
  return {
    id: `${s.runtime}:${s.name}`,
    runtime: s.runtime,
    name: s.name,
    title: s.title,
    group: s.group,
    enabled: s.enabled ?? true,
    declared: s.declared ?? true,
    installed: s.installed ?? (s.runtime === "launchd" || s.runtime === "agent-job" ? "loaded" : s.runtime === "skill" ? "n/a" : "deployed"),
    trigger: { kind: s.trigger[0], expr: s.trigger[1], display: s.trigger[2], periodMinutes: s.trigger[3], ...(s.via ? { via: s.via } : {}) },
    evidence: {
      kind: hasRun ? "run-log" : "none",
      lastRunAt: hasRun ? ago(s.lastRunMin as number) : null,
      lastStatus: s.status ?? (hasRun ? "ok" : "unknown"),
      source: hasRun ? `~/.local/state/sample/${s.name}.log` : null,
      runs: s.runs ?? (hasRun ? 120 : null),
    },
    card: s.card,
    definedIn: `~/sample/definitions/${s.runtime}/${s.name}`,
    linked: s.linked ?? [],
    ...(s.alsoInstalledAs ? { alsoInstalledAs: s.alsoInstalledAs } : {}),
  };
}

const scheduled: WorkflowRecord[] = [
  rec({ runtime: "launchd", name: "com.sample.digest", title: "Sample digest", group: "reports", trigger: ["schedule", "Hour=7 Minute=30", "daily 07:30", 1440], lastRunMin: 190, runs: 412,
    card: card({ purpose: "Summarise yesterday's sample events into one morning digest", input: "sample event log (JSONL)", steps: [["Read the last 24 h of events", "code"], ["Rank events by importance", "judgment"], ["Write the digest prose", "model"], ["Render the HTML email", "code"]], sop: "SOP-EX-001", output: "HTML email", destination: "principal inbox" }) }),
  rec({ runtime: "launchd", name: "com.sample.indexer", title: "Example indexer", group: "memory", trigger: ["schedule", "StartInterval=900", "every 15m", 15], lastRunMin: 6, runs: 9021,
    card: card({ purpose: "Keep the example search index current", input: "changed example files", steps: [["Diff file mtimes", "code"], ["Re-embed changed files", "model"], ["Write the index", "code"]], output: "SQLite index", destination: "~/sample/index.db" }) }),
  rec({ runtime: "launchd", name: "com.sample.watcher", title: "Example watcher", group: "infra", trigger: ["daemon", "KeepAlive", "always on", null], lastRunMin: 2, runs: null,
    card: card({ purpose: "Watch the example folder for new drops", steps: [["Watch the folder", "code"]], output: "event lines" }) }),
  rec({ runtime: "launchd", name: "com.sample.stray", title: "Stray sample plist", group: "unregistered", trigger: ["schedule", "StartInterval=3600", "hourly", 60], lastRunMin: 45, declared: false, card: card({}) }),
  rec({ runtime: "launchd", name: "com.sample.backup", title: "Sample backup", group: "infra", trigger: ["schedule", "Hour=2 Minute=0", "daily 02:00", 1440], lastRunMin: 1300, status: "error", runs: 88,
    card: card({ purpose: "Snapshot the sample store", input: "sample store", steps: [["Copy to snapshot", "code"], ["Verify checksum", "code"]], output: "tarball", destination: "~/sample/backups" }) }),
  rec({ runtime: "agent-job", name: "example-brief", title: "Example brief", group: "briefs", trigger: ["schedule", "0 8 * * *", "daily 08:00", 1440], lastRunMin: 250, runs: 61,
    card: card({ purpose: "Brief the principal on example customer activity", input: "example CRM export", steps: [["Pull the export", "code"], ["Decide what is notable", "judgment"], ["Draft the brief", "model"], ["Approve the send", "human"]], sop: "SOP-EX-002", output: "branded HTML email", destination: "principal inbox" }), alsoInstalledAs: "com.sample.job.example-brief · ~/sample/LaunchAgents/com.sample.job.example-brief.plist" }),
  rec({ runtime: "agent-job", name: "example-triage", title: "Example triage", group: "inbox", trigger: ["schedule", "*/30 * * * *", "every 30m", 30], lastRunMin: 140, runs: 700,
    card: card({ purpose: "Sort new example mail into queues", input: "example mailbox", steps: [["Fetch new mail", "code"], ["Classify each message", "judgment"]], output: "labels", destination: "example mailbox" }) }),
  rec({ runtime: "agent-job", name: "example-weekly", title: "Example weekly review", group: "reviews", trigger: ["schedule", "0 9 * * 1", "Mondays 09:00", 10080], enabled: false, installed: "absent",
    card: card({ purpose: "Weekly review of example goals", steps: [["Gather the week", "code"], ["Write the review", "model"]] }) }),
  rec({ runtime: "agent-job", name: "example-missing", title: "Example missing job", group: "briefs", trigger: ["schedule", "0 6 * * *", "daily 06:00", 1440], installed: "absent",
    card: card({ purpose: "A declared job that was never installed", steps: [["Unknown step", "unknown"]] }) }),
  rec({ runtime: "pulse-cron", name: "sample-refresh", title: "Sample refresh", group: "pulse", trigger: ["schedule", "every 10m", "every 10m", 10], lastRunMin: 4, runs: 15000,
    card: card({ purpose: "Refresh the sample dashboard cache", input: "sample APIs", steps: [["Call the APIs", "code"], ["Merge results", "code"]], output: "JSON snapshot", destination: "Pulse state" }) }),
  rec({ runtime: "pulse-cron", name: "sample-health", title: "Sample health probe", group: "pulse", trigger: ["schedule", "every 5m", "every 5m", 5], lastRunMin: 3, runs: 30000,
    card: card({ purpose: "Probe sample endpoints", steps: [["HTTP probe", "code"]], output: "status rows", destination: "Pulse state" }) }),
  rec({ runtime: "pulse-cron", name: "sample-rollup", title: "Sample rollup", group: "pulse", trigger: ["schedule", "0 * * * *", "hourly", 60], lastRunMin: 400,
    card: card({ purpose: "Roll up sample metrics", steps: [["Aggregate", "code"]] }) }),
  rec({ runtime: "cloud", name: "example-feed-pull", title: "Example feed pull", group: "action", trigger: ["schedule", "*/15 * * * *", "every 15m", 15], via: "cron",
    card: card({ purpose: "Pull example feeds into the queue", input: "example RSS list", steps: [["Fetch feeds", "code"], ["Score items", "judgment"], ["Summarise top items", "model"]], output: "queue rows", destination: "example D1 table" }) }),
  rec({ runtime: "cloud", name: "example-flow", title: "Example flow", group: "flow", trigger: ["schedule", "0 */6 * * *", "every 6h", 360], via: "cron",
    card: card({ purpose: "Chain two example actions", steps: [["example tagger", "model"], ["Run action B", "code"]] }), linked: ["cloud:example-tagger"] }),
  rec({ runtime: "cloud", name: "example-pipeline", title: "Example pipeline", group: "pipeline", trigger: ["schedule", "30 5 * * *", "daily 05:30", 1440], via: "cron",
    card: card({}) }),
  rec({ runtime: "cloud", name: "example-tagger", title: "Example tagger", group: "action", trigger: ["on-demand", null, "called by example flow", null], via: "service-binding",
    card: card({ purpose: "Tag one example item", input: "JSON {text}", steps: [["example tagger", "model"]], output: "JSON {tags}" }), linked: ["cloud:example-flow"] }),
  rec({ runtime: "project-cron", name: "sample-site/rebuild", title: "Sample site rebuild", group: "sample-site", trigger: ["schedule", "0 4 * * *", "daily 04:00", 1440],
    card: card({ purpose: "Rebuild the sample site nightly", steps: [["Build", "code"], ["Deploy", "code"]], output: "static site", destination: "sample.example" }) }),
  rec({ runtime: "project-cron", name: "sample-app/cleanup", title: "Sample app cleanup", group: "sample-app", trigger: ["schedule", "0 3 * * 0", "Sundays 03:00", 10080],
    card: card({ purpose: "Delete expired sample sessions", steps: [["Delete rows", "code"]] }) }),
  rec({ runtime: "project-cron", name: "sample-app/digest", title: "Sample app digest", group: "sample-app", trigger: ["schedule", "0 8 * * *", "daily 08:00", 1440],
    card: card({ purpose: "Duplicate of the sample digest, run from the app", steps: [["Write digest", "model"]] }), linked: ["launchd:com.sample.digest"] }),
];

const SKILLS: Array<[string, string[]]> = [
  ["_SAMPLEBLOG", ["Draft", "Proofread", "Publish", "HeaderImage", "AudioVersion"]],
  ["ExampleResearch", ["Quick", "Standard", "Extensive", "Extract"]],
  ["ExampleArt", ["Diagram", "Infographic", "Icon", "Wallpaper", "Comic", "Thumbnail"]],
  ["SampleInbox", ["Triage", "Archive", "Reply"]],
  ["SampleVideo", ["Intake", "TightCut", "Thumbnail", "Description", "Upload"]],
  ["ExampleMemory", ["Recall", "Ingest", "Digest"]],
  ["SampleTelos", ["Update", "Report"]],
  ["ExampleSecurity", ["Scan", "Rotate", "Triage", "Report"]],
];

const skills: WorkflowRecord[] = SKILLS.flatMap(([skill, flows]) =>
  flows.map((flow, i) =>
    rec({
      runtime: "skill",
      name: `${skill}/${flow}`,
      title: flow.replace(/([a-z])([A-Z])/g, "$1 $2"),
      group: skill,
      trigger: ["on-demand", null, "on demand", null],
      lastRunMin: i % 3 === 0 ? 60 * 24 * (i + 1) : null,
      card: card(
        i % 2 === 0
          ? { purpose: `${flow} for ${skill}`, input: "the request", steps: [["Load context", "code"], [`Do the ${flow.toLowerCase()} work`, "model"]], output: "markdown" }
          : { purpose: `${flow} for ${skill}`, steps: [["the DA follows the intent prose", "unknown"]] },
      ),
    }),
  ),
);

const records = [...scheduled, ...skills];

const findings: Finding[] = [
  { kind: "failing", severity: "high", ids: ["launchd:com.sample.backup"], sentence: "Sample backup failed on its last run (exit 1) and has not succeeded since.", acknowledged: false },
  { kind: "missing", severity: "high", ids: ["agent-job:example-missing"], sentence: "Example missing job is declared in the job file but was never installed, so it has never run.", acknowledged: false },
  { kind: "late", severity: "medium", ids: ["agent-job:example-triage"], sentence: "Example triage should run every 30 minutes but last ran over 2 hours ago.", acknowledged: false },
  { kind: "late", severity: "medium", ids: ["pulse-cron:sample-rollup"], sentence: "Sample rollup should run hourly but last ran almost 7 hours ago.", acknowledged: false },
  { kind: "possible-duplicate", severity: "medium", ids: ["launchd:com.sample.digest", "project-cron:sample-app/digest"], sentence: "The sample digest looks scheduled twice: once by launchd and once by the sample app.", acknowledged: false },
  { kind: "orphan", severity: "low", ids: ["launchd:com.sample.stray"], sentence: "A sample plist is installed and running, but nothing declares it.", acknowledged: true },
  { kind: "no-run-record", severity: "low", ids: ["cloud:example-feed-pull", "cloud:example-flow", "cloud:example-pipeline"], sentence: "3 scheduled Cloudflare Workers keep no record of their runs, so nobody can tell whether they ran.", acknowledged: true },
  { kind: "no-run-record", severity: "low", ids: ["project-cron:sample-site/rebuild", "project-cron:sample-app/cleanup", "project-cron:sample-app/digest"], sentence: "3 project crons keep no record of their runs.", acknowledged: true },
];

const scheduledOnly = records.filter((r) => r.runtime !== "skill");
const slotShare = scheduledOnly.reduce((n, r) => n + (6 - r.card.undeclared.length), 0) / (scheduledOnly.length * 6);
const mix: Record<Executor, number> = { code: 0, judgment: 0, model: 0, human: 0, unknown: 0 };
// As in Inventory.ts: the skill placeholder step (executor unknown) is not counted.
for (const r of records) for (const s of r.card.steps) if (!(r.runtime === "skill" && s.executor === "unknown")) mix[s.executor]++;
const byRuntime: Record<Runtime, number> = { launchd: 0, systemd: 0, "agent-job": 0, "pulse-cron": 0, cloud: 0, "project-cron": 0, skill: 0, workflow: 0 };
for (const r of records) byRuntime[r.runtime]++;
// Same semantics as LIFEOS/WORKFLOWS/Inventory.ts: healthy = scheduled with no open medium or high finding;
// attention = count of unacknowledged findings.
const afflicted = new Set(findings.filter((f) => !f.acknowledged && f.severity !== "low").flatMap((f) => f.ids));

export const SAMPLE_INVENTORY: Inventory = {
  generatedAt: ago(3),
  records,
  findings,
  sops: [
    { id: "SOP-EX-001", title: "Example digest SOP", path: "~/sample/sops/digest.md", usedBy: ["launchd:com.sample.digest"] },
    { id: "SOP-EX-002", title: "Example brief SOP", path: "~/sample/sops/brief.md", usedBy: ["agent-job:example-brief"] },
  ],
  summary: {
    total: records.length,
    byRuntime,
    scheduled: scheduledOnly.length,
    onDemand: records.length - scheduledOnly.length,
    healthy: scheduledOnly.filter((r) => !afflicted.has(r.id)).length,
    attention: findings.filter((f) => !f.acknowledged).length,
    cardCoverage: slotShare,
    executorMix: mix,
  },
  errors: [{ source: "sample-collector", message: "Synthetic collector error, shown so the notice can be seen in development." }],
};
