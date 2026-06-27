#!/usr/bin/env bun
/**
 * HarvestExecutor
 *
 * Executes routed harvest actions from the Arbol harvest API against the local
 * PAI knowledge and learning stores. The tool is intentionally conservative:
 * it backfills from existing notes when possible, never fabricates related
 * links, and records per-item execution state in a sidecar file.
 */

import { parseArgs } from "node:util";
import * as fs from "fs";
import * as path from "path";
import { inference } from "./Inference";
import { getPaiDir } from "./lib/runtime-paths";

const HOME = process.env.HOME!;
const PAI_DIR = getPaiDir(import.meta.dir);
const MEMORY_DIR = path.join(PAI_DIR, "MEMORY");
const KNOWLEDGE_DIR = path.join(MEMORY_DIR, "KNOWLEDGE");
const LEARNING_DIR = path.join(MEMORY_DIR, "LEARNING");
const STATE_DIR = path.join(MEMORY_DIR, "STATE");
const SIDECAR_PATH = path.join(STATE_DIR, "harvest-executor-state.json");
const LEARNING_QUEUE_PATH = path.join(LEARNING_DIR, "queue.md");
const ARBOL_CONFIG_PATH = path.join(HOME, ".config", "arbol", "config.yaml");
const HARVEST_API_BASE = "https://arbol-f-harvest.danielmiessler.workers.dev";
const HTTP_TIMEOUT_MS = 20000;
const KNOWLEDGE_TYPE_DIRS = ["Ideas", "People", "Companies", "Research", "Blogs"] as const;

type HarvestItem = {
  id: number;
  source: string;
  external_id: string;
  title: string;
  url: string;
  classification: string;
  confidence: number;
  reasoning: string;
  routed_actions: string;
  ingested_at: number;
  routed_at: number;
};

type Action = { verb: string; params: Record<string, string> };
type ActionStatus = "executed" | "backfilled" | "skipped" | "deferred" | "error";
type ActionResult = {
  verb: string;
  status: ActionStatus;
  paths?: string[];
  reason?: string;
  error?: string;
  params?: Record<string, string>;
};

type SidecarItemRecord = {
  executed_at: string;
  external_id: string;
  action_results: ActionResult[];
};

type Sidecar = {
  version: 1;
  items: Record<string, SidecarItemRecord>;
};

type KnowledgeNoteIndex = {
  path: string;
  type: string;
  slug: string;
  frontmatter: Record<string, string>;
};

type Cli = {
  dryRun: boolean;
  itemId?: number;
  limit: number;
  force: boolean;
};

type ExecCtx = {
  dryRun: boolean;
  index: KnowledgeNoteIndex[];
};

function parseCli(): Cli {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      item: { type: "string" },
      limit: { type: "string", default: "50" },
      force: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (parsed.values.help) {
    console.log(`HarvestExecutor

Usage:
  bun ${path.join(PAI_DIR, "TOOLS", "HarvestExecutor.ts")} [options]

Options:
  --dry-run        Evaluate actions without writing files or sidecar state
  --item <id>      Restrict execution to a single harvest item id
  --limit <n>      Fetch up to n items from /items (default: 50)
  --force          Re-run items already present in sidecar state
  --help           Show this help
`);
    process.exit(0);
  }

  let itemId: number | undefined;
  if (parsed.values.item !== undefined) {
    itemId = Number.parseInt(parsed.values.item, 10);
    if (!Number.isInteger(itemId)) {
      throw new Error(`Invalid --item value: ${parsed.values.item}`);
    }
  }

  const limit = Number.parseInt(parsed.values.limit, 10);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`Invalid --limit value: ${parsed.values.limit}`);
  }

  return {
    dryRun: parsed.values["dry-run"],
    itemId,
    limit,
    force: parsed.values.force,
  };
}

function loadAuthToken(): string {
  const raw = fs.readFileSync(ARBOL_CONFIG_PATH, "utf8");
  const match = raw.match(/^auth_token:\s*(.+)\s*$/m);
  if (!match) {
    throw new Error(`Auth token not found in ${ARBOL_CONFIG_PATH}`);
  }

  const value = match[1].trim();
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1);
  }
  return value;
}

async function fetchHarvestItems(token: string, limit: number, itemId?: number): Promise<HarvestItem[]> {
  const url = new URL(`${HARVEST_API_BASE}/items`);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Harvest API error ${response.status}: ${body.slice(0, 300)}`);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON from harvest API: ${message}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Harvest API payload was not an object");
  }

  const record = parsed as Record<string, unknown>;
  if (record.success !== true) {
    throw new Error("Harvest API payload indicated failure");
  }
  if (!Array.isArray(record.items)) {
    throw new Error("Harvest API payload missing items array");
  }

  const items = record.items.filter(isHarvestItem);
  if (items.length !== record.items.length) {
    throw new Error("Harvest API returned one or more malformed items");
  }

  if (itemId !== undefined) {
    return items.filter((item) => item.id === itemId);
  }

  return items;
}

function isHarvestItem(value: unknown): value is HarvestItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "number" &&
    typeof record.source === "string" &&
    typeof record.external_id === "string" &&
    typeof record.title === "string" &&
    typeof record.url === "string" &&
    typeof record.classification === "string" &&
    typeof record.confidence === "number" &&
    typeof record.reasoning === "string" &&
    typeof record.routed_actions === "string" &&
    typeof record.ingested_at === "number" &&
    typeof record.routed_at === "number"
  );
}

function parseActions(routedActionsJson: string): Action[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(routedActionsJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid routed_actions JSON: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("routed_actions payload was not an array");
  }

  const actions: Action[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "string") {
      throw new Error("routed_actions array contained a non-string entry");
    }

    const colonIndex = entry.indexOf(":");
    const verb = colonIndex === -1 ? entry.trim() : entry.slice(0, colonIndex).trim();
    const paramsRegion = colonIndex === -1 ? "" : entry.slice(colonIndex + 1);
    const params: Record<string, string> = {};
    const segments: string[] = [];
    let current = "";
    let depth = 0;

    for (const char of paramsRegion) {
      if (char === "[") {
        depth += 1;
        current += char;
        continue;
      }
      if (char === "]") {
        depth = Math.max(0, depth - 1);
        current += char;
        continue;
      }
      if (char === "," && depth === 0) {
        if (current.trim() !== "") {
          segments.push(current.trim());
        }
        current = "";
        continue;
      }
      current += char;
    }
    if (current.trim() !== "") {
      segments.push(current.trim());
    }

    let positionalIndex = 0;
    for (const segment of segments) {
      const equalsIndex = segment.indexOf("=");
      if (equalsIndex === -1) {
        params[`_pos${positionalIndex}`] = segment.trim();
        positionalIndex += 1;
        continue;
      }

      const key = segment.slice(0, equalsIndex).trim();
      let value = segment.slice(equalsIndex + 1).trim();
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1);
      }
      params[key] = value;
    }

    actions.push({ verb, params });
  }

  return actions;
}

function loadKnowledgeIndex(): KnowledgeNoteIndex[] {
  const notes: KnowledgeNoteIndex[] = [];

  for (const typeDir of KNOWLEDGE_TYPE_DIRS) {
    const dirPath = path.join(KNOWLEDGE_DIR, typeDir);
    if (!fs.existsSync(dirPath)) {
      continue;
    }

    for (const entry of fs.readdirSync(dirPath)) {
      if (!entry.endsWith(".md") || entry === "_index.md" || entry === "_schema.md") {
        continue;
      }

      const notePath = path.join(dirPath, entry);
      const raw = fs.readFileSync(notePath, "utf8");
      notes.push({
        path: notePath,
        type: typeDir,
        slug: path.basename(entry, ".md"),
        frontmatter: parseFrontmatter(raw),
      });
    }
  }

  return notes;
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"") && !value.startsWith("[")) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

function detectBackfill(item: HarvestItem, action: Action, index: KnowledgeNoteIndex[]): KnowledgeNoteIndex[] {
  const matches = new Map<string, KnowledgeNoteIndex>();

  const remember = (note: KnowledgeNoteIndex): void => {
    matches.set(note.path, note);
  };

  const candidateUrls = [action.params.url, item.url]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  for (const candidateUrl of candidateUrls) {
    for (const note of index) {
      if ((note.frontmatter.source_url ?? "").trim() === candidateUrl) {
        remember(note);
      }
    }
  }

  if (item.source === "lifelog") {
    const targetTitle = action.params.title.trim();
    if (targetTitle !== "") {
      for (const note of index) {
        if ((note.frontmatter.source ?? "").trim() !== "lifelog") {
          continue;
        }
        const noteTitle = (note.frontmatter.title ?? note.slug).trim();
        if (tokenOverlapScore(noteTitle, targetTitle) >= 0.5) {
          remember(note);
        }
      }
    }
  }

  const itemId = String(item.id);
  for (const note of index) {
    if ((note.frontmatter.source_harvest_id ?? "").trim() === itemId) {
      remember(note);
    }
  }

  const primaryMatches = Array.from(matches.values());
  for (const note of primaryMatches) {
    if (note.type !== "Ideas") {
      continue;
    }

    const raw = fs.readFileSync(note.path, "utf8");
    const wikilinks = Array.from(raw.matchAll(/\[\[([^[\]]+)\]\]/g));
    for (const linkMatch of wikilinks) {
      const slug = linkMatch[1].trim();
      const linked = index.find((candidate) => candidate.slug === slug);
      if (linked) {
        remember(linked);
      }
    }

    for (const slug of loadNoteRelated(note.path)) {
      const related = index.find((candidate) => candidate.slug === slug);
      if (related) {
        remember(related);
      }
    }
  }

  return Array.from(matches.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function tokenOverlapScore(left: string, right: string): number {
  const leftTokens = tokenizeForOverlap(left);
  const rightTokens = tokenizeForOverlap(right);
  const smallerSize = Math.min(leftTokens.size, rightTokens.size);
  if (smallerSize === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of Array.from(leftTokens)) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }
  return intersection / smallerSize;
}

function tokenizeForOverlap(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
}

function slugExists(slug: string, index: KnowledgeNoteIndex[]): boolean {
  return index.some((note) => note.slug === slug);
}

function loadNoteRelated(notePath: string): string[] {
  const raw = fs.readFileSync(notePath, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return [];
  }

  const lines = match[1].split("\n");
  const related: string[] = [];
  let inRelated = false;

  for (const line of lines) {
    if (!inRelated) {
      if (line.trim() === "related:") {
        inRelated = true;
      }
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }

    const slugMatch = line.match(/^\s*-\s*slug:\s*(.+)\s*$/);
    if (slugMatch) {
      related.push(slugMatch[1].trim());
    }
  }

  return related;
}

function loadSidecar(): Sidecar {
  if (!fs.existsSync(SIDECAR_PATH)) {
    return { version: 1, items: {} };
  }

  const raw = fs.readFileSync(SIDECAR_PATH, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid sidecar JSON at ${SIDECAR_PATH}: ${message}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as Record<string, unknown>).version !== 1 ||
    typeof (parsed as Record<string, unknown>).items !== "object" ||
    (parsed as Record<string, unknown>).items === null
  ) {
    throw new Error(`Malformed sidecar structure at ${SIDECAR_PATH}`);
  }

  const itemsValue = (parsed as Record<string, unknown>).items;
  const itemsRecord = itemsValue as Record<string, unknown>;
  for (const [key, value] of Object.entries(itemsRecord)) {
    if (!isSidecarItemRecord(value)) {
      throw new Error(`Malformed sidecar item record for key ${key}`);
    }
  }

  return parsed as Sidecar;
}

function isSidecarItemRecord(value: unknown): value is SidecarItemRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.executed_at === "string" &&
    typeof record.external_id === "string" &&
    Array.isArray(record.action_results)
  );
}

function saveSidecar(sidecar: Sidecar): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const tempPath = `${SIDECAR_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, SIDECAR_PATH);
}

async function handleCreateKnowledgeIdea(
  item: HarvestItem,
  action: Action,
  ctx: ExecCtx,
): Promise<ActionResult> {
  const matches = detectBackfill(item, action, ctx.index);
  if (matches.length > 0) {
    return {
      verb: action.verb,
      status: "backfilled",
      paths: matches.map((match) => path.relative(KNOWLEDGE_DIR, match.path)),
      reason: "source_url or source+title match",
    };
  }

  if (ctx.dryRun) {
    return { verb: action.verb, status: "skipped", reason: "dry-run" };
  }

  const title = (action.params.title ?? item.title).trim();
  const tags = (action.params.tags ?? "harvested")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const tagsCsv = tags.join(", ");
  const today = new Date().toISOString().slice(0, 10);
  const slug = kebabCase(title);
  const targetPath = path.join(KNOWLEDGE_DIR, "Ideas", `${slug}.md`);

  if (fs.existsSync(targetPath)) {
    return {
      verb: action.verb,
      status: "skipped",
      reason: "would overwrite (no --force in v1)",
    };
  }

  // body unavailable from /items in v1; synthesizing from title+url+reasoning+classification.
  const inferenceResult = await inference({
    systemPrompt:
      "You write concise PAI knowledge notes in markdown. Return only the note body, no frontmatter, grounded strictly in the provided harvest metadata.",
    userPrompt: [
      `Title: ${title}`,
      `Source URL: ${item.url}`,
      `Classification: ${item.classification}`,
      `Reasoning: ${item.reasoning}`,
      `Action Verb: ${action.verb}`,
      `Action Params: ${JSON.stringify(action.params)}`,
      "",
      "Write a compact knowledge note body with a short summary, key points, and practical implications. Do not invent facts beyond these inputs.",
    ].join("\n"),
    level: "standard",
  });

  if (!inferenceResult.success || typeof inferenceResult.output !== "string") {
    throw new Error(inferenceResult.error ?? "Inference failed to produce note body");
  }

  const verifiedRelated = tags.filter((tag) => slugExists(kebabCase(tag), ctx.index));
  const relatedBlock =
    verifiedRelated.length >= 2
      ? `related:\n${verifiedRelated.map((slugValue) => `  - slug: ${kebabCase(slugValue)}`).join("\n")}\n`
      : "";
  // v1 omits related links unless at least two verified slugs already exist locally.

  const frontmatterLines = [
    "---",
    `title: "${escapeDoubleQuotes(title)}"`,
    "type: idea",
    `tags: [${tagsCsv}]`,
    `created: ${today}`,
    `updated: ${today}`,
    "quality: 5",
    `source_url: ${item.url}`,
    `source_harvest_id: "${item.id}"`,
    ...(relatedBlock === "" ? [] : [relatedBlock.trimEnd()]),
    "---",
    "",
  ];

  const body = `${frontmatterLines.join("\n")}\n${inferenceResult.output.trim()}\n`;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, body, "utf8");

  return {
    verb: action.verb,
    status: "executed",
    paths: [path.relative(KNOWLEDGE_DIR, targetPath)],
  };
}

async function handleCreateLearningQueue(
  item: HarvestItem,
  action: Action,
  ctx: ExecCtx,
): Promise<ActionResult> {
  const today = new Date().toISOString().slice(0, 10);
  const priority = (action.params.priority ?? "P3").trim() || "P3";
  const topic = (action.params.topic ?? item.title).trim();
  const subtopicsString = (action.params.subtopics ?? "").trim();
  const bullet = [
    `- **${today} — ${priority} — ${topic}** (item ${item.id})`,
    `  - Subtopics: ${subtopicsString}`,
    `  - Source: ${item.url}`,
  ].join("\n");

  if (ctx.dryRun) {
    return { verb: action.verb, status: "skipped", reason: "dry-run" };
  }

  fs.mkdirSync(LEARNING_DIR, { recursive: true });
  if (!fs.existsSync(LEARNING_QUEUE_PATH)) {
    fs.writeFileSync(
      LEARNING_QUEUE_PATH,
      "# Learning Queue\n\nTopics queued for study, harvested from signal routing.\n\n",
      "utf8",
    );
  }

  const existing = fs.readFileSync(LEARNING_QUEUE_PATH, "utf8");
  const prefix = existing.length > 0 && !existing.endsWith("\n\n") ? "\n" : "";
  fs.appendFileSync(LEARNING_QUEUE_PATH, `${prefix}${bullet}\n`, "utf8");

  return {
    verb: action.verb,
    status: "executed",
    paths: [path.relative(MEMORY_DIR, LEARNING_QUEUE_PATH)],
  };
}

async function handleOpenGithubIssue(
  item: HarvestItem,
  action: Action,
  _ctx: ExecCtx,
): Promise<ActionResult> {
  // NOTE: github dispatch deferred to UL Work Hub follow-up; sidecar status=deferred captures the gap.
  console.log("Deferred github issue dispatch:", { itemId: item.id, params: action.params });
  return {
    verb: action.verb,
    status: "deferred",
    reason: "stub — github dispatch not implemented in v1",
    params: action.params,
  };
}

async function handleTelosUpdate(
  item: HarvestItem,
  action: Action,
  _ctx: ExecCtx,
): Promise<ActionResult> {
  // NOTE: github dispatch deferred to UL Work Hub follow-up; sidecar status=deferred captures the gap.
  console.log("Deferred telos update dispatch:", { itemId: item.id, params: action.params });
  return {
    verb: action.verb,
    status: "deferred",
    reason: "stub — telos updates flow through Telos skill, not raw appends",
    params: action.params,
  };
}

async function dispatchAction(item: HarvestItem, action: Action, ctx: ExecCtx): Promise<ActionResult> {
  switch (action.verb) {
    case "create_knowledge_source_entry":
    case "create_knowledge_idea_entry":
      return handleCreateKnowledgeIdea(item, action, ctx);
    case "create_learning_queue_entry":
      return handleCreateLearningQueue(item, action, ctx);
    case "open_github_issue":
      return handleOpenGithubIssue(item, action, ctx);
    case "telos_update":
      return handleTelosUpdate(item, action, ctx);
    default:
      return { verb: action.verb, status: "skipped", reason: "unknown verb" };
  }
}

async function executeItem(
  item: HarvestItem,
  ctx: ExecCtx,
  sidecar: Sidecar,
  force: boolean,
): Promise<{ newRecord: SidecarItemRecord | null; alreadyDone: boolean }> {
  const existing = sidecar.items[String(item.id)];
  if (existing && !force) {
    return { newRecord: null, alreadyDone: true };
  }

  const actionResults: ActionResult[] = [];
  if (item.routed_actions.trim() === "" || item.routed_actions.trim() === "[]") {
    actionResults.push({ verb: "<none>", status: "skipped", reason: "no routed actions" });
  } else {
    const actions = parseActions(item.routed_actions);
    for (const action of actions) {
      try {
        actionResults.push(await dispatchAction(item, action, ctx));
      } catch (error) {
        actionResults.push({
          verb: action.verb,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const newRecord: SidecarItemRecord = {
    executed_at: new Date().toISOString(),
    external_id: item.external_id,
    action_results: actionResults,
  };

  return { newRecord, alreadyDone: false };
}

function kebabCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function escapeDoubleQuotes(value: string): string {
  return value.replace(/"/g, '\\"');
}

function formatItemSummary(item: HarvestItem, results: ActionResult[]): string {
  const counts = countStatuses(results);
  const fragments = (["executed", "backfilled", "deferred", "skipped", "error"] as const)
    .filter((status) => counts[status] > 0)
    .map((status) => `${status}:${counts[status]}`);
  return `${item.id} ${item.source} ${item.classification} -> ${results.length} actions [${fragments.join(", ")}]`;
}

function countStatuses(results: ActionResult[]): Record<ActionStatus, number> {
  return {
    executed: results.filter((result) => result.status === "executed").length,
    backfilled: results.filter((result) => result.status === "backfilled").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    deferred: results.filter((result) => result.status === "deferred").length,
    error: results.filter((result) => result.status === "error").length,
  };
}

async function main(): Promise<void> {
  const cli = parseCli();
  console.log("== HarvestExecutor ==");
  console.log(`Mode: ${cli.dryRun ? "dry-run" : "live"}`);
  console.log(`Force: ${cli.force ? "on" : "off"}`);

  const sidecar = loadSidecar();
  const token = loadAuthToken();
  const items = await fetchHarvestItems(token, cli.limit, cli.itemId);
  const index = loadKnowledgeIndex();

  let alreadyDoneCount = 0;
  const aggregate: Record<ActionStatus, number> = {
    executed: 0,
    backfilled: 0,
    skipped: 0,
    deferred: 0,
    error: 0,
  };
  const perItemSummaries: string[] = [];

  for (const item of items) {
    const result = await executeItem(item, { dryRun: cli.dryRun, index }, sidecar, cli.force);
    if (result.alreadyDone) {
      alreadyDoneCount += 1;
      const existing = sidecar.items[String(item.id)];
      if (existing) {
        perItemSummaries.push(`${formatItemSummary(item, existing.action_results)} [state]`);
      }
      continue;
    }

    if (result.newRecord) {
      for (const actionResult of result.newRecord.action_results) {
        aggregate[actionResult.status] += 1;
      }
      perItemSummaries.push(formatItemSummary(item, result.newRecord.action_results));
      if (!cli.dryRun) {
        sidecar.items[String(item.id)] = result.newRecord;
      }
    }
  }

  if (!cli.dryRun) {
    saveSidecar(sidecar);
  }

  console.log("");
  console.log("Summary");
  console.log(`  total items considered: ${items.length}`);
  console.log(`  total items already in state: ${alreadyDoneCount}`);
  console.log(`  total actions executed: ${aggregate.executed}`);
  console.log(`  total actions backfilled: ${aggregate.backfilled}`);
  console.log(`  total actions deferred: ${aggregate.deferred}`);
  console.log(`  total actions skipped: ${aggregate.skipped}`);
  console.log(`  total actions error: ${aggregate.error}`);
  console.log("");

  for (const line of perItemSummaries) {
    console.log(`  ${line}`);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("FATAL:", message);
  process.exit(1);
});
