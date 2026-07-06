import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { ALL_PAGE_SCHEMAS, SCHEMA_VERSION, type PageData, type PageMeta, type Provenance } from "../Schema/PulseSchema";
import { type Manifest, paiRoot, resolveSources } from "../lib/manifest-loader";
import { hashFile, combineSourceHashes } from "../lib/cache";
import { writePage, writeError, clearError, readMeta, type DataPlaneFile, PULSE_DATA_DIR } from "../lib/data-plane";
import { getProvenance } from "../lib/frontmatter";
import { inference, type InferenceLevel } from "../../TOOLS/Inference";
import { getClaudeDir } from "../../TOOLS/Paths";

const OBSERVABILITY_DIR = resolve(getClaudeDir(), "LIFEOS", "MEMORY", "OBSERVABILITY");
const RUNS_LOG = join(OBSERVABILITY_DIR, "adapter-runs.jsonl");

const ADAPTER_TIMEOUT_MS = 120_000;

function modelToLevel(model: string): InferenceLevel {
  const m = model.toLowerCase();
  if (m.includes("haiku")) return "fast";
  if (m.includes("opus")) return "smart";
  return "standard";
}

export interface AdapterResult {
  manifest: Manifest;
  status: "success" | "cached" | "validation-failed" | "inference-failed" | "timeout" | "no-sources";
  pageId: string;
  cached: boolean;
  costUSD: number;
  latencyMs: number;
  sourceCount: number;
  warnings: string[];
  errorMessage?: string;
}

export interface RunOptions {
  force?: boolean;
}

function logRun(entry: Record<string, unknown>): void {
  try {
    mkdirSync(OBSERVABILITY_DIR, { recursive: true });
    appendFileSync(RUNS_LOG, JSON.stringify(entry) + "\n", { encoding: "utf8" });
  } catch {
    /* don't crash adapter on logging failure */
  }
}

function aggregateProvenance(sources: string[]): Provenance {
  const stamps = sources.map(getProvenance);
  if (stamps.every((s) => s === "template")) return "template";
  if (stamps.every((s) => s === "customized" || s === "unknown")) return "customized";
  return "mixed";
}

function buildSourceBundle(sources: string[]): string {
  const parts: string[] = [];
  for (const p of sources.sort()) {
    if (!existsSync(p)) continue;
    parts.push(`### SOURCE: ${p}\n\n${readFileSync(p, "utf8").trim()}\n`);
  }
  return parts.join("\n---\n\n");
}

async function callInference(systemPrompt: string, model: string, sourceText: string): Promise<{ ok: true; data: unknown; rawOutput: string; costUSD: number; latencyMs: number } | { ok: false; reason: "timeout" | "exec-failed" | "parse-failed"; message: string }> {
  const userPrompt = `--- SOURCE BUNDLE ---\n\n${sourceText}\n\n--- END SOURCE BUNDLE ---\n\nReturn ONLY a single JSON object. No prose, no markdown fence.`;
  const result = await inference({
    systemPrompt,
    userPrompt,
    level: modelToLevel(model),
    expectJson: true,
    timeout: ADAPTER_TIMEOUT_MS,
  });
  if (!result.success) {
    if ((result.error ?? "").includes("Timeout")) {
      return { ok: false, reason: "timeout", message: result.error ?? "timeout" };
    }
    if ((result.error ?? "").includes("Failed to parse JSON")) {
      return { ok: false, reason: "parse-failed", message: `JSON parse failed: ${result.error}` };
    }
    return { ok: false, reason: "exec-failed", message: result.error ?? "inference failed" };
  }
  if (!result.parsed) {
    return { ok: false, reason: "parse-failed", message: "inference returned no parsed JSON" };
  }
  return { ok: true, data: result.parsed, rawOutput: result.output, costUSD: 0, latencyMs: result.latencyMs };
}

export async function runAdapter(manifest: Manifest, opts: RunOptions = {}): Promise<AdapterResult> {
  const startedAt = new Date().toISOString();
  const sources = resolveSources(manifest);

  if (sources.length === 0) {
    const result: AdapterResult = {
      manifest,
      status: "no-sources",
      pageId: manifest.id,
      cached: false,
      costUSD: 0,
      latencyMs: 0,
      sourceCount: 0,
      warnings: [`no source files matched globs: ${manifest.sourceGlobs.join(", ")}`],
      errorMessage: "no source files",
    };
    writeError(manifest.id, { kind: "no-sources", message: result.errorMessage! });
    logRun({ ...result, startedAt });
    return result;
  }

  const sourceHashes: Record<string, string> = {};
  for (const s of sources) sourceHashes[s] = hashFile(s);
  const cacheKey = combineSourceHashes(sourceHashes, manifest.adapterVersion, manifest.model, SCHEMA_VERSION);
  const provenance = aggregateProvenance(sources);

  const prevMeta = readMeta(manifest.id);
  const cacheHit = !opts.force && prevMeta && (prevMeta as PageMeta & { cacheKey?: string }).cacheKey === cacheKey;

  if (cacheHit) {
    const result: AdapterResult = {
      manifest,
      status: "cached",
      pageId: manifest.id,
      cached: true,
      costUSD: 0,
      latencyMs: 0,
      sourceCount: sources.length,
      warnings: [],
    };
    logRun({ ...result, startedAt, cacheKey });
    return result;
  }

  const promptPath = resolve(paiRoot(), manifest.adapterPromptFile);
  if (!existsSync(promptPath)) {
    const msg = `adapter prompt not found: ${manifest.adapterPromptFile}`;
    writeError(manifest.id, { kind: "config", message: msg });
    const result: AdapterResult = {
      manifest, status: "validation-failed", pageId: manifest.id, cached: false,
      costUSD: 0, latencyMs: 0, sourceCount: sources.length, warnings: [], errorMessage: msg,
    };
    logRun({ ...result, startedAt });
    return result;
  }
  const adapterPrompt = readFileSync(promptPath, "utf8");
  const sourceBundle = buildSourceBundle(sources);

  const inferenceResult = await callInference(adapterPrompt, manifest.model, sourceBundle);
  if (!inferenceResult.ok) {
    writeError(manifest.id, { kind: inferenceResult.reason, message: inferenceResult.message });
    const result: AdapterResult = {
      manifest,
      status: inferenceResult.reason === "timeout" ? "timeout" : "inference-failed",
      pageId: manifest.id, cached: false, costUSD: 0, latencyMs: 0,
      sourceCount: sources.length, warnings: [],
      errorMessage: inferenceResult.message,
    };
    logRun({ ...result, startedAt });
    return result;
  }

  const schema = ALL_PAGE_SCHEMAS[manifest.dataType as keyof typeof ALL_PAGE_SCHEMAS];
  if (!schema) {
    const msg = `unknown dataType: ${manifest.dataType}`;
    writeError(manifest.id, { kind: "config", message: msg });
    const result: AdapterResult = {
      manifest, status: "validation-failed", pageId: manifest.id, cached: false,
      costUSD: 0, latencyMs: inferenceResult.latencyMs, sourceCount: sources.length,
      warnings: [], errorMessage: msg,
    };
    logRun({ ...result, startedAt });
    return result;
  }

  const adapterData = inferenceResult.data as { meta?: Partial<PageMeta> } & Record<string, unknown>;
  const meta: PageMeta = {
    schemaVersion: SCHEMA_VERSION,
    pageId: manifest.id,
    lastBuildAt: new Date().toISOString(),
    sourceHashes,
    adapterVersion: manifest.adapterVersion,
    model: manifest.model,
    costUSD: inferenceResult.costUSD,
    latencyMs: inferenceResult.latencyMs,
    provenance,
    warnings: (adapterData.meta?.warnings as string[]) ?? [],
  };
  const candidate = { ...adapterData, meta };
  (meta as PageMeta & { cacheKey: string }).cacheKey = cacheKey;

  const validation = schema.safeParse(candidate);
  if (!validation.success) {
    writeError(manifest.id, {
      kind: "validation-failed",
      message: "schema validation failed",
      details: validation.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    const result: AdapterResult = {
      manifest, status: "validation-failed", pageId: manifest.id, cached: false,
      costUSD: inferenceResult.costUSD, latencyMs: inferenceResult.latencyMs,
      sourceCount: sources.length, warnings: meta.warnings,
      errorMessage: `${validation.error.issues.length} schema issue(s)`,
    };
    logRun({ ...result, startedAt, cacheKey });
    return result;
  }

  const file: DataPlaneFile = {
    schemaVersion: SCHEMA_VERSION,
    data: validation.data as PageData,
    _meta: meta,
  };
  writePage(manifest.id, file);
  clearError(manifest.id);

  const result: AdapterResult = {
    manifest, status: "success", pageId: manifest.id, cached: false,
    costUSD: inferenceResult.costUSD, latencyMs: inferenceResult.latencyMs,
    sourceCount: sources.length, warnings: meta.warnings,
  };
  logRun({ ...result, startedAt, cacheKey });
  return result;
}

void PULSE_DATA_DIR;
