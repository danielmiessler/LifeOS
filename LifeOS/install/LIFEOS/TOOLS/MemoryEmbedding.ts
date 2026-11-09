/**
 * MemoryEmbedding.ts — the opt-in embedding leg of per-turn memory retrieval (public issue #2207).
 *
 * Off unless LIFEOS_MEMORY_EMBEDDING=1. Off, nothing here runs: no request, no file, no import side
 * effect, and retrieval is the keyword (BM25) path exactly as before.
 *
 * On, the per-turn retriever ranks notes by cosine similarity between the query and each note's
 * embedding, and injects nothing when the best cosine is under LIFEOS_MEMORY_EMBEDDING_CUTOFF. That
 * cutoff is the "return nothing when nothing fits" signal the keyword score could not give (#2207).
 * Measured on bge-m3: fusing the keyword score back in did not beat cosine alone (McNemar p = 0.77),
 * so the leg ranks by cosine only.
 *
 * - Local only. Embeddings come from an Ollama server on this machine (`/api/embed`); a URL whose
 *   host is not loopback is refused, so note text never leaves the machine.
 * - Off the prompt path except for one query embed. Note vectors are computed by the async Stop
 *   hook (MemoryIndexRefresh → refreshEmbeddings), never on the prompt, and a new note joins the
 *   ranking on a later turn. No daemon, no detached process, no new clock.
 * - Vectors live in a disposable cache keyed by path + mtime + model under
 *   MEMORY/STATE/cache/memory-embeddings/<model>/. Deleting it only forces a re-embed.
 * - MEMORY/LEARNING notes are not ranked by vector: they are raw transcript excerpts, read like
 *   conversation, and took 54% of top-5 slots on conversational queries while no labelled turn
 *   needed one (#2207).
 * - Every failure (no server, no model, timeout, no vectors yet, dimension mismatch) throws; the
 *   caller (MemoryRetriever.getRelevantContextAsync) computes the keyword result first and serves it,
 *   with the query embed bounded by the hook's deadline. This module never takes down a turn.
 * - Setup: a local Ollama with the model pulled (`ollama pull bge-m3`). A missing model is a 404,
 *   which reads as a failure: keyword retrieval every turn, and a line on the Stop hook's stderr.
 */
import * as fs from "fs";
import * as path from "path";
import { lifeosPath } from "./Paths";

export interface EmbeddingConfig {
  enabled: boolean;
  /** Ollama base URL, loopback only. */
  url: string;
  model: string;
  /** Minimum best cosine for a turn to inject anything. Model-specific; 0.56 measured on bge-m3. */
  cutoff: number;
  /** Sent as Ollama `keep_alive` only when set; otherwise the server's own setting applies. */
  keepAlive?: string;
  cacheRoot: string;
}

const num = (v: string | undefined, d: number) => (v !== undefined && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

/** True for a URL whose host is this machine. */
export function isLoopbackUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.replace(/^\[|\]$/g, "");
    return h === "localhost" || h === "::1" || /^127(\.\d{1,3}){3}$/.test(h);
  } catch {
    return false;
  }
}

export function embeddingConfig(env: NodeJS.ProcessEnv = process.env): EmbeddingConfig {
  const url = (env.LIFEOS_MEMORY_EMBEDDING_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  return {
    // A non-loopback URL leaves the leg off: retrieval stays keyword-only rather than send notes away.
    enabled: env.LIFEOS_MEMORY_EMBEDDING === "1" && isLoopbackUrl(url),
    url,
    model: env.LIFEOS_MEMORY_EMBEDDING_MODEL || "bge-m3",
    cutoff: num(env.LIFEOS_MEMORY_EMBEDDING_CUTOFF, 0.56),
    keepAlive: env.LIFEOS_MEMORY_EMBEDDING_KEEP_ALIVE || undefined,
    cacheRoot: env.LIFEOS_MEMORY_EMBEDDING_CACHE || lifeosPath("MEMORY", "STATE", "cache", "memory-embeddings"),
  };
}

const MAX_DOC_CHARS = 6000;
const MAX_QUERY_CHARS = 4000;
const BATCH = 8;
const BATCH_TIMEOUT_MS = 15_000;

// ---------- Ollama ----------

export type Embedder = (inputs: string[], timeoutMs: number) => Promise<number[][]>;

/** The Ollama embedder for `cfg`. Throws on any failure. Injectable so tests need no network. */
export function ollamaEmbedder(cfg: EmbeddingConfig): Embedder {
  return async (inputs, timeoutMs) => {
    if (!isLoopbackUrl(cfg.url)) throw new Error("embedding: refusing a non-loopback server");
    if (timeoutMs < 10) throw new Error("embedding: no time left");
    const keepAlive = cfg.keepAlive === undefined ? undefined : /^-?\d+$/.test(cfg.keepAlive) ? Number(cfg.keepAlive) : cfg.keepAlive;
    const res = await fetch(`${cfg.url}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model, input: inputs, truncate: true, ...(keepAlive === undefined ? {} : { keep_alive: keepAlive }) }),
      signal: AbortSignal.timeout(Math.ceil(timeoutMs)),
      redirect: "error", // a loopback server must not forward note text elsewhere
    });
    if (!res.ok) throw new Error(`embedding: HTTP ${res.status}`);
    const j = (await res.json()) as { embeddings?: number[][]; error?: string };
    if (!Array.isArray(j.embeddings) || j.embeddings.length !== inputs.length) throw new Error(`embedding: ${j.error ?? "response without embeddings"}`);
    return j.embeddings;
  };
}

export function normalize(v: ArrayLike<number>): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const o = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) o[i] = v[i] / n;
  return o;
}

// ---------- vector cache ----------

const CACHE_VERSION = 2;

export interface VectorCache { dim: number; entries: Map<string, { m: number; v: Float32Array }> }

export const cacheDir = (cfg: EmbeddingConfig) => path.join(cfg.cacheRoot, cfg.model.replace(/[^A-Za-z0-9._-]/g, "_"));

/** The cache on disk; empty when absent, from another version, or truncated. */
export function loadCache(cfg: EmbeddingConfig): VectorCache {
  const c: VectorCache = { dim: 0, entries: new Map() };
  try {
    const dir = cacheDir(cfg);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as { version: number; dim: number; vectors: string; entries: { p: string; m: number }[] };
    if (meta.version !== CACHE_VERSION || !meta.dim || !/^vecs\.[A-Za-z0-9.-]+\.bin$/.test(meta.vectors)) return c;
    const buf = fs.readFileSync(path.join(dir, meta.vectors));
    const all = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    if (all.length !== meta.entries.length * meta.dim) return c;
    c.dim = meta.dim;
    meta.entries.forEach((e, row) => c.entries.set(e.p, { m: e.m, v: all.subarray(row * meta.dim, (row + 1) * meta.dim) }));
  } catch { /* absent = empty */ }
  return c;
}

/**
 * Write the entries in `keep`. The vectors go to a new file named by generation, then index.json
 * (renamed into place) points at it, so a reader always sees an index and the vectors written with
 * it, even when two Stop hooks race. Older vector files are removed after the switch.
 */
export function saveCache(cfg: EmbeddingConfig, c: VectorCache, keep: Set<string>): void {
  const entries: { p: string; m: number }[] = [];
  const rows: Float32Array[] = [];
  for (const [p, e] of c.entries) if (keep.has(p)) { entries.push({ p, m: e.m }); rows.push(e.v); }
  const bin = new Float32Array(rows.length * c.dim);
  rows.forEach((r, i) => bin.set(r, i * c.dim));
  const dir = cacheDir(cfg);
  fs.mkdirSync(dir, { recursive: true });
  const gen = `${Date.now()}-${process.pid}`;
  const vectors = `vecs.${gen}.bin`;
  fs.writeFileSync(path.join(dir, vectors), Buffer.from(bin.buffer));
  const tmp = path.join(dir, `index.json.${gen}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify({ version: CACHE_VERSION, model: cfg.model, dim: c.dim, vectors, entries }));
  fs.renameSync(tmp, path.join(dir, "index.json"));
  // Keep the newest previous file too: a reader that loaded the old index a moment ago can still read it.
  const old = fs.readdirSync(dir).filter((n) => /^vecs\..+\.bin$/.test(n) && n !== vectors).sort().slice(0, -1);
  for (const n of [...old, "vecs.bin"]) { try { fs.unlinkSync(path.join(dir, n)); } catch { /* gone or held open */ } }
}

// ---------- corpus ----------

/** A note as this leg sees it. `body` is needed only to embed. */
export interface EmbeddingNote { filePath: string; title: string; noteClass: string; body?: string }

export const vectorRankable = (n: Pick<EmbeddingNote, "noteClass">) => n.noteClass !== "learning";

const mtimeOf = (p: string): number | null => { try { return fs.statSync(p).mtimeMs; } catch { return null; } };

export const noteText = (n: EmbeddingNote) => `${n.title}\n${(n.body ?? "").slice(0, MAX_DOC_CHARS)}`;

// ---------- Stop hook: embed new and changed notes ----------

/**
 * Embed every rankable note whose vector is missing or older than the file, and drop vectors of
 * notes no longer in the corpus. Stops starting new batches at `budgetMs` and saves after each
 * batch, so a large first index spreads over a few turns. With nothing to embed, sends one tiny
 * embed so the model is loaded before the next prompt needs it (`warm: false` skips it).
 */
export async function refreshEmbeddings(
  notes: EmbeddingNote[],
  cfg: EmbeddingConfig = embeddingConfig(),
  opts: { budgetMs?: number; embed?: Embedder; warm?: boolean } = {},
): Promise<{ embedded: number; pending: number; pruned: number; warmed: boolean }> {
  const t0 = Date.now();
  const budget = opts.budgetMs ?? 40_000;
  const embed = opts.embed ?? ollamaEmbedder(cfg);
  const c = loadCache(cfg);
  const rankable = notes.filter(vectorRankable);
  const keep = new Set(rankable.map((n) => n.filePath));
  const pruned = [...c.entries.keys()].filter((p) => !keep.has(p)).length;
  const todo: { n: EmbeddingNote; m: number }[] = [];
  for (const n of rankable) {
    const m = mtimeOf(n.filePath);
    if (m !== null && c.entries.get(n.filePath)?.m !== m) todo.push({ n, m });
  }
  let embedded = 0;
  // A batch starts only while a whole batch timeout still fits in the budget, so the hook never
  // runs into its own timeout and a slow batch never throws away the ones already saved.
  for (let i = 0; i < todo.length && Date.now() - t0 + BATCH_TIMEOUT_MS <= budget; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const vecs = await embed(batch.map((b) => noteText(b.n)), BATCH_TIMEOUT_MS);
    for (let j = 0; j < batch.length; j++) {
      const v = normalize(vecs[j]);
      if (c.dim && v.length !== c.dim) c.entries.clear(); // a different model under the same name: start over
      c.dim = v.length;
      c.entries.set(batch[j].n.filePath, { m: batch[j].m, v });
    }
    embedded += batch.length;
    saveCache(cfg, c, keep);
  }
  if (!embedded && pruned && c.dim) saveCache(cfg, c, keep);
  // Warm the model off the prompt path. Measured: with the model unloaded, the prompt's query embed
  // outlives the 300 ms budget, the worker is terminated, the request is aborted, and Ollama cancels
  // the load, so the model never loaded and every later turn fell back to keywords. One tiny embed
  // here loads it (or refreshes its keep-alive) where nothing waits on it. Failure is harmless.
  let warmed = embedded > 0;
  if (!warmed && opts.warm !== false && Date.now() - t0 + BATCH_TIMEOUT_MS <= budget) {
    try { await embed(["warm-up"], BATCH_TIMEOUT_MS); warmed = true; } catch { /* the next turn falls back to keywords */ }
  }
  return { embedded, pending: todo.length - embedded, pruned, warmed };
}

// ---------- prompt path: rank by cosine ----------

export interface EmbeddingRanking {
  /** Indices into the candidates, best first; empty when the best cosine is under the cutoff. */
  order: number[];
  /** Cosine per entry of `order`. */
  cosines: number[];
  topCosine: number;
  /** Candidates that had a vector and took part. */
  ranked: number;
}

/**
 * Rank `candidates` for `query`. A candidate without a vector yet is left out; one whose file
 * changed keeps its previous vector until the Stop hook refreshes it. Throws when the leg cannot
 * answer, so the caller serves the keyword result.
 */
export async function rankByEmbedding(
  query: string,
  candidates: Pick<EmbeddingNote, "filePath" | "noteClass">[],
  cfg: EmbeddingConfig = embeddingConfig(),
  opts: { timeoutMs?: number; embed?: Embedder; cache?: VectorCache } = {},
): Promise<EmbeddingRanking> {
  const c = opts.cache ?? loadCache(cfg);
  const pool: number[] = [];
  candidates.forEach((cand, i) => { if (vectorRankable(cand) && c.entries.has(cand.filePath)) pool.push(i); });
  if (!pool.length) throw new Error("embedding: no note vectors yet");
  const [raw] = await (opts.embed ?? ollamaEmbedder(cfg))([query.slice(0, MAX_QUERY_CHARS)], opts.timeoutMs ?? 250);
  const qv = normalize(raw);
  if (qv.length !== c.dim) throw new Error("embedding: cache dimension differs from the model's");
  const cos = pool.map((i) => {
    const v = c.entries.get(candidates[i].filePath)!.v;
    let s = 0;
    for (let k = 0; k < qv.length; k++) s += v[k] * qv[k];
    return s;
  });
  const topCosine = cos.reduce((a, b) => Math.max(a, b), -Infinity);
  if (topCosine < cfg.cutoff) return { order: [], cosines: [], topCosine, ranked: pool.length };
  const idx = pool.map((_, j) => j).sort((a, b) => cos[b] - cos[a]);
  return { order: idx.map((j) => pool[j]), cosines: idx.map((j) => cos[j]), topCosine, ranked: pool.length };
}
