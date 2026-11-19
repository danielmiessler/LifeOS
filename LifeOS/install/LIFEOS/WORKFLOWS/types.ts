/**
 * Workflows — the shared contract between the inventory (Inventory.ts), its CLI
 * (Workflows.ts), the Pulse module (`GET /api/workflows`) and the `/workflows`
 * page. One record per piece of work LifeOS runs, wherever it runs.
 */

/** Where a workflow's definition lives and what schedules it. */
export type Runtime =
  | "launchd"       // a com.lifeos.* service in the Services.ts registry / services.json, or an installed plist
  | "systemd"       // a systemd user timer in ~/.config/systemd/user (Linux)
  | "agent-job"     // a job in USER/CONFIG/agent-jobs.json (scheduled by its own com.lifeos.job.<id> plist)
  | "pulse-cron"    // a [[job]] in PULSE.toml or USER/CONFIG/PULSE.user.toml
  | "cloud"         // a Cloudflare Worker in the LifeOS fleet (USER/CUSTOMIZATIONS/WORKFLOWS): action, pipeline, flow or app, whatever starts it
  | "project-cron"  // a cf (or legacy wrangler) cron in a repo under ~/Projects or ~/LocalProjects
  | "skill"         // a skills/<Skill>/Intents/*.md file, run on demand
  | "workflow";     // a typed Workflows definition in USER/WORKFLOWS/<name>.workflow.yaml (format v2, or v1 lifted)

export type TriggerKind = "schedule" | "daemon" | "on-demand";

export interface Trigger {
  kind: TriggerKind;
  /** Raw expression as written: a cron string, "every 30m", a launchd StartInterval/StartCalendarInterval summary. */
  expr: string | null;
  /** Human reading of expr, 24-hour clock ("daily 08:00", "every 15m"). */
  display: string;
  /** Expected gap between runs in minutes, when it can be derived; null for daemons, on-demand, or unparseable. */
  periodMinutes: number | null;
  /**
   * What starts a cloud Worker; only `cloud` records carry it. `cron`: a Worker cron trigger.
   * `queue`: a queue another Worker fills. `http`: a request to its URL or custom domain.
   * `service-binding`: another fleet Worker calls it through a service binding.
   */
  via?: "cron" | "queue" | "http" | "service-binding";
}

/** Who or what performs a step. */
export type Executor = "code" | "judgment" | "model" | "human" | "unknown";

export interface Step {
  id: string;
  label: string;
  executor: Executor;
}

/** Deployment state, independent of whether a definition exists. */
export type Installed =
  | "loaded"       // launchd has it loaded right now
  | "on-disk"      // plist exists but launchd does not have it loaded
  | "absent"       // no plist / no deployment found
  | "deployed"     // a cloud Worker or cron in a config file (deployment itself not verified)
  | "n/a";         // on-demand work: nothing to install

export type EvidenceKind = "run-log" | "state-file" | "log-mtime" | "launchd-exit" | "systemd-result" | "none";

export interface Evidence {
  kind: EvidenceKind;
  /** ISO timestamp of the last observed run, when known. */
  lastRunAt: string | null;
  lastStatus: "ok" | "error" | "unknown";
  /** Path (home shown as ~) the evidence was read from; null when none. */
  source: string | null;
  /** Total runs, when the source counts them. */
  runs: number | null;
}

/**
 * The six things every workflow card shows. A slot the definition does not
 * declare is null and appears in `undeclared`; the page draws it as an empty box.
 */
export interface Card {
  purpose: string | null;      // what is being done
  input: string | null;        // what it reads
  steps: Step[];               // the transforms, each with its executor (how the work is done authoritatively)
  sop: string | null;          // the SOP that governs it (path or id + version)
  output: string | null;       // output format
  destination: string | null;  // where the output goes
  inferred: Array<"purpose" | "input" | "steps" | "sop" | "output" | "destination">; // slots inferred from code rather than declared by a person
  undeclared: Array<"purpose" | "input" | "steps" | "sop" | "output" | "destination">;
}

export interface WorkflowRecord {
  /** Stable id: `${runtime}:${name}`. */
  id: string;
  runtime: Runtime;
  name: string;
  title: string;
  /** Grouping for the catalog: a skill name, a Services.ts category, a cloud Worker kind (action|pipeline|flow|app), a repo name. */
  group: string;
  enabled: boolean;
  /** True when a definition home declares it (registry row, job entry, TOML job, wrangler config, workflow file). */
  declared: boolean;
  installed: Installed;
  trigger: Trigger;
  evidence: Evidence;
  card: Card;
  /** Where the definition lives, home shown as ~. */
  definedIn: string;
  /** Checkout paths carrying this same project cron, home shown as ~. */
  seenIn?: string[];
  /** Records connected to this one: the same work seen from another home, a v2 `after:` link, or a cloud Worker it calls or is called by. */
  linked: string[];
  /**
   * A second home this record absorbed rather than listing separately: an agent
   * job's `com.lifeos.job.<id>` launchd plist, as "label · ~/path/to.plist".
   */
  alsoInstalledAs?: string;
  /** Typed workflows only: true when the definition (or every trigger it has) is switched off. A paused workflow is never late and never missing a run record. */
  paused?: boolean;
  /** Typed workflows only: sha256 of the definition file text, the same hash the run ledger records. */
  definitionHash?: string;
  /**
   * launchd records only: the definition hash a `com.lifeos.wf.<name>` plist was compiled from,
   * read from its `LifeOSDefinitionHash` key. Absent when the plist carries no such key.
   */
  compiledFrom?: string;
  /**
   * The deployed applications or websites this workflow serves, attached by the Pulse
   * module from the USER-zone app map (`USER/CONFIG/workflow-apps.json`). Absent or empty
   * when the map assigns it to none; the page draws one icon per entry.
   */
  apps?: WorkflowApp[];
}

/** One application or website a workflow serves. Its icon is served at `/api/workflows/app-icon/<slug>`. */
export interface WorkflowApp {
  slug: string;
  name: string;
  url: string;
}

export type FindingKind =
  | "missing"             // declared, not installed (and not an opt-in)
  | "orphan"              // installed, declared nowhere
  | "possible-duplicate"  // same work scheduled in two places
  | "late"                // last run older than 2× period
  | "failing"             // last run failed / nonzero exit
  | "no-run-record"      // scheduled, but nothing records its runs
  | "drift"              // an installed com.lifeos.wf.<name> plist was compiled from a different definition hash than the file now on disk
  | "no-sop"             // a typed workflow that names no SOP
  | "outside-workflows"; // a legacy launchd job, agent job or Pulse cron that runs outside Workflows (migration debt)

export type Severity = "high" | "medium" | "low";

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  /** Record ids involved (a duplicate names two or more). */
  ids: string[];
  /** One plain sentence the principal can read without context. */
  sentence: string;
  /** True when this finding is in the acknowledged baseline (present at adoption). */
  acknowledged: boolean;
}

export interface SopRecord {
  id: string;
  title: string;
  path: string;
  /** Workflow record ids whose card names this SOP. */
  usedBy: string[];
}

/** One typed workflow over the trailing 30 days, from the run ledger. */
export interface WorkflowStats {
  /** Runs finished in the window. */
  runs: number;
  failed: number;
  /** failed / runs, 0 when there were no runs. */
  failureRate: number;
  /** Median run duration in milliseconds; null when there were no runs. */
  medianDurationMs: number | null;
  /** Model spend in US dollars over the window; null while the ledger carries no cost field. */
  modelSpendUsd: number | null;
}

/** One day of the executor mix and the share of typed connections that are checked, kept as a dated series. */
export interface WorkflowSnapshot {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  /** Steps by executor across every record, the same numbers as `summary.executorMix`. */
  executorMix: Record<Executor, number>;
  /** Steps by executor across typed workflows only, the migration's own trend line. */
  typedExecutorMix: Record<Executor, number>;
  /** Connections classed `checked`, out of checked + runtime + mismatch, across every valid typed workflow; null when there are none. */
  checkedConnectionShare: number | null;
  connections: { checked: number; runtime: number; mismatch: number };
}

export interface Inventory {
  generatedAt: string;
  records: WorkflowRecord[];
  findings: Finding[];
  sops: SopRecord[];
  summary: {
    total: number;
    byRuntime: Record<Runtime, number>;
    scheduled: number;
    onDemand: number;
    healthy: number;
    attention: number;
    /** Share of the six card slots declared, across scheduled records (0–1). */
    cardCoverage: number;
    executorMix: Record<Executor, number>;
    /** Trailing 30 days per typed workflow (by workflow name), from the ledger's daily stats index. */
    workflowStats?: Record<string, WorkflowStats>;
    /** Today's snapshot of executor mix and checked-connection share. */
    snapshot?: WorkflowSnapshot;
    /** Every dated snapshot kept so far, oldest first; filled by the CLI, which owns the series file. */
    series?: WorkflowSnapshot[];
  };
  /** Collector failures, shown rather than swallowed. */
  errors: Array<{ source: string; message: string }>;
}
