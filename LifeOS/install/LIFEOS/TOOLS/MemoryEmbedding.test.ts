/**
 * MemoryEmbedding.test.ts — the opt-in embedding leg (public issue #2207). No network: unit tests
 * inject the embedder, and the end-to-end tests run a fake Ollama on 127.0.0.1 over an isolated
 * corpus (CORTEX_MEMORY_ROOT), so the live install is never read or written.
 */
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  embeddingConfig,
  isLoopbackUrl,
  loadCache,
  saveCache,
  rankByEmbedding,
  refreshEmbeddings,
  normalize,
  ollamaEmbedder,
  type Embedder,
  type EmbeddingConfig,
} from "./MemoryEmbedding";

// A deterministic toy embedding: one axis per topic word, so cosine is predictable.
const AXES = ["deadlock", "fila", "heartbeat", "tennis", "dose"];
const toyVec = (text: string) => {
  const t = text.toLowerCase();
  const v = AXES.map((w) => (t.includes(w) ? 1 : 0));
  v.push(0.05); // never all-zero
  return v;
};
const toyEmbedder: Embedder = async (inputs) => inputs.map(toyVec);

function tmpCfg(over: Partial<EmbeddingConfig> = {}): EmbeddingConfig {
  return { ...embeddingConfig({ LIFEOS_MEMORY_EMBEDDING: "1" }), cacheRoot: fs.mkdtempSync(path.join(os.tmpdir(), "emb-")), cutoff: 0.5, ...over };
}
function note(dir: string, name: string, body: string, noteClass = "knowledge") {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, body);
  return { filePath, title: name.replace(/\.md$/, ""), noteClass, body };
}

describe("config", () => {
  test("off by default; on only with LIFEOS_MEMORY_EMBEDDING=1", () => {
    expect(embeddingConfig({}).enabled).toBe(false);
    expect(embeddingConfig({ LIFEOS_MEMORY_EMBEDDING: "true" }).enabled).toBe(false);
    expect(embeddingConfig({ LIFEOS_MEMORY_EMBEDDING: "1" }).enabled).toBe(true);
  });
  test("a non-loopback server leaves the leg off, so note text never leaves the machine", () => {
    for (const url of ["http://192.0.2.10:11434", "http://ollama.example.com", "http://127.0.0.1.example.com:11434", "file:///etc/passwd"]) {
      expect(isLoopbackUrl(url)).toBe(false);
      expect(embeddingConfig({ LIFEOS_MEMORY_EMBEDDING: "1", LIFEOS_MEMORY_EMBEDDING_URL: url }).enabled).toBe(false);
    }
    for (const url of ["http://127.0.0.1:11434", "http://localhost:11434", "http://[::1]:11434"]) expect(isLoopbackUrl(url)).toBe(true);
  });
  test("keep_alive is not sent unless configured", () => {
    expect(embeddingConfig({ LIFEOS_MEMORY_EMBEDDING: "1" }).keepAlive).toBeUndefined();
  });
});

describe("ollamaEmbedder", () => {
  test("never follows a redirect, so a loopback server cannot forward note text elsewhere", async () => {
    let leaked = 0;
    const elsewhere = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch() { leaked++; return Response.json({ embeddings: [[1]] }); } });
    const redirector = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch() { return new Response(null, { status: 307, headers: { location: `http://127.0.0.1:${elsewhere.port}/api/embed` } }); } });
    try {
      const cfg = tmpCfg({ url: `http://127.0.0.1:${redirector.port}` });
      await expect(ollamaEmbedder(cfg)(["secret note text"], 2000)).rejects.toThrow();
      expect(leaked).toBe(0);
    } finally { elsewhere.stop(true); redirector.stop(true); }
  });
});

describe("cache", () => {
  test("round-trips, keeps only the given paths, and reads another version as empty", () => {
    const cfg = tmpCfg();
    const c = { dim: 3, entries: new Map([["a", { m: 1, v: normalize([1, 0, 0]) }], ["b", { m: 2, v: normalize([0, 1, 0]) }]]) };
    saveCache(cfg, c, new Set(["a"]));
    const back = loadCache(cfg);
    expect([...back.entries.keys()]).toEqual(["a"]);
    expect(Array.from(back.entries.get("a")!.v)).toEqual([1, 0, 0]);
    const idx = path.join(cfg.cacheRoot, "bge-m3", "index.json");
    fs.writeFileSync(idx, JSON.stringify({ ...JSON.parse(fs.readFileSync(idx, "utf8")), version: 999 }));
    expect(loadCache(cfg).entries.size).toBe(0);
  });
  test("a truncated vector file reads as empty, never as wrong vectors", () => {
    const cfg = tmpCfg();
    saveCache(cfg, { dim: 3, entries: new Map([["a", { m: 1, v: normalize([1, 0, 0]) }]]) }, new Set(["a"]));
    const dir = path.join(cfg.cacheRoot, "bge-m3");
    fs.writeFileSync(path.join(dir, JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")).vectors), Buffer.alloc(4));
    expect(loadCache(cfg).entries.size).toBe(0);
  });
  test("each save writes a new vector file the index points at, and keeps at most one previous file", () => {
    const cfg = tmpCfg();
    const dir = path.join(cfg.cacheRoot, "bge-m3");
    const vecFiles = () => fs.readdirSync(dir).filter((n) => n.startsWith("vecs."));
    for (let i = 0; i < 4; i++) {
      saveCache(cfg, { dim: 3, entries: new Map([["a", { m: i, v: normalize([1, i, 0]) }]]) }, new Set(["a"]));
      Bun.sleepSync(2);
    }
    const current = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")).vectors;
    expect(vecFiles()).toContain(current);
    expect(vecFiles().length).toBeLessThanOrEqual(2);
    expect(loadCache(cfg).entries.get("a")!.m).toBe(3);
  });
});

describe("refreshEmbeddings", () => {
  test("embeds new and changed notes, skips fresh ones, prunes deleted ones, never embeds learning", async () => {
    const cfg = tmpCfg();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
    const a = note(dir, "a.md", "deadlock na fila");
    const b = note(dir, "b.md", "heartbeat");
    const l = note(dir, "l.md", "deadlock", "learning");
    let calls = 0;
    const counting: Embedder = async (inputs) => { calls += inputs.length; return inputs.map(toyVec); };
    expect(await refreshEmbeddings([a, b, l], cfg, { embed: counting })).toMatchObject({ embedded: 2, pending: 0, pruned: 0, warmed: true });
    expect(calls).toBe(2);
    // nothing new: one tiny warm-up embed loads the model off the prompt path, and no note is re-embedded
    expect(await refreshEmbeddings([a, b, l], cfg, { embed: counting })).toMatchObject({ embedded: 0, pending: 0, pruned: 0, warmed: true });
    expect(calls).toBe(3);
    expect(await refreshEmbeddings([a, b, l], cfg, { embed: counting, warm: false })).toMatchObject({ warmed: false });
    expect(calls).toBe(3);
    fs.utimesSync(a.filePath, new Date(), new Date(Date.now() + 5000)); // a changed
    expect(await refreshEmbeddings([a], cfg, { embed: counting })).toMatchObject({ embedded: 1, pending: 0, pruned: 1 });
    expect([...loadCache(cfg).entries.keys()]).toEqual([a.filePath]);
  });
  test("stops starting batches at the budget and keeps what it saved", async () => {
    const cfg = tmpCfg();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
    const notes = Array.from({ length: 20 }, (_, i) => note(dir, `n${i}.md`, "fila"));
    const r = await refreshEmbeddings(notes, cfg, { embed: toyEmbedder, budgetMs: 0 });
    expect(r).toMatchObject({ embedded: 0, pending: 20, pruned: 0, warmed: false });
    const r2 = await refreshEmbeddings(notes, cfg, { embed: toyEmbedder, budgetMs: 60_000 });
    expect(r2.embedded).toBe(20);
  });
});

describe("rankByEmbedding", () => {
  async function setup() {
    const cfg = tmpCfg();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
    const notes = [note(dir, "fila.md", "deadlock fila"), note(dir, "hb.md", "heartbeat"), note(dir, "learn.md", "deadlock fila", "learning")];
    await refreshEmbeddings(notes, cfg, { embed: toyEmbedder });
    return { cfg, notes };
  }
  test("orders by cosine and never ranks learning notes", async () => {
    const { cfg, notes } = await setup();
    const r = await rankByEmbedding("o deadlock da fila", notes, cfg, { embed: toyEmbedder });
    expect(r.order[0]).toBe(0);
    expect(r.order).not.toContain(2);
    expect(r.ranked).toBe(2);
  });
  test("under the cutoff the turn injects nothing", async () => {
    const { cfg, notes } = await setup();
    const r = await rankByEmbedding("tennis amanhã", notes, cfg, { embed: toyEmbedder });
    expect(r.order).toEqual([]);
    expect(r.topCosine).toBeLessThan(cfg.cutoff);
  });
  test("throws (so the caller falls back to keywords) with no vectors, a failing server, or a dimension change", async () => {
    const cfg = tmpCfg();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-"));
    const n = [note(dir, "x.md", "fila")];
    await expect(rankByEmbedding("fila", n, cfg, { embed: toyEmbedder })).rejects.toThrow(/no note vectors/);
    await refreshEmbeddings(n, cfg, { embed: toyEmbedder });
    await expect(rankByEmbedding("fila", n, cfg, { embed: async () => { throw new Error("down"); } })).rejects.toThrow("down");
    await expect(rankByEmbedding("fila", n, cfg, { embed: async (i) => i.map(() => [1, 0]) })).rejects.toThrow(/dimension/);
  });
});

// ---------- end to end through MemoryRetriever, isolated corpus, fake Ollama on loopback ----------

describe("getRelevantContextAsync (end to end)", () => {
  let server: ReturnType<typeof Bun.serve>;
  let root: string;
  let hits = 0;
  let down = false;
  let slowMs = 0;
  const env = { ...process.env };

  beforeAll(() => {
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        hits++;
        if (down) return new Response("down", { status: 500 });
        if (slowMs) await Bun.sleep(slowMs);
        const body = (await req.json()) as { input: string[] };
        return Response.json({ embeddings: body.input.map(toyVec) });
      },
    });
    root = fs.mkdtempSync(path.join(os.tmpdir(), "mem-"));
    fs.mkdirSync(path.join(root, "KNOWLEDGE", "Research"), { recursive: true });
    fs.writeFileSync(path.join(root, "KNOWLEDGE", "Research", "fila.md"), "---\ntitle: Fila de relatórios\ntype: knowledge\n---\nO deadlock 40001 na fila de relatórios acontece quando dois workers pegam o mesmo item.\n");
    fs.writeFileSync(path.join(root, "KNOWLEDGE", "Research", "hb.md"), "---\ntitle: Heartbeat\ntype: knowledge\n---\nO heartbeat chama /version a cada minuto.\n");
    process.env.CORTEX_MEMORY_ROOT = root;
    // The two USER memory files resolve from LIFEOS_DIR, not CORTEX_MEMORY_ROOT: point it at the temp root
    // too, so this test reads no file of the live install.
    process.env.LIFEOS_DIR = path.join(root, "lifeos");
    // CLAUDE_CONFIG_DIR outranks LIFEOS_DIR in Paths.ts: set it too, so a dev shell that exports it
    // (or LIFEOS_SKILLS_DIR) cannot point this test at the live install.
    process.env.CLAUDE_CONFIG_DIR = root;
    delete process.env.LIFEOS_SKILLS_DIR;
    delete process.env.CLAUDE_PLUGIN_ROOT;
    process.env.LIFEOS_MEMORY_EMBEDDING_URL = `http://127.0.0.1:${server.port}`;
    process.env.LIFEOS_MEMORY_EMBEDDING_CACHE = path.join(root, "STATE", "cache", "memory-embeddings");
    process.env.LIFEOS_MEMORY_EMBEDDING_CUTOFF = "0.5";
  });
  afterAll(() => { server.stop(true); process.env = env; });

  test("off: identical to getRelevantContext and no request is made", async () => {
    delete process.env.LIFEOS_MEMORY_EMBEDDING;
    const m = await import("./MemoryRetriever");
    for (const q of ["deadlock na fila de relatórios", "heartbeat version", "ok", "nada a ver"]) {
      m.clearRelevantCache();
      const sync = m.getRelevantContext(q, { topK: 5, threshold: 0.2 });
      m.clearRelevantCache();
      const asyncR = await m.getRelevantContextAsync(q, { topK: 5, threshold: 0.2 });
      expect(asyncR).toEqual(sync);
    }
    expect(await m.refreshEmbeddingIndex()).toBeNull();
    expect(hits).toBe(0);
  });

  test("on: ranks by meaning, stays silent under the cutoff, and falls back to keywords when the server fails", async () => {
    process.env.LIFEOS_MEMORY_EMBEDDING = "1";
    const m = await import("./MemoryRetriever");
    const idx = await m.refreshEmbeddingIndex();
    expect(idx?.embedded).toBe(2);
    const before = hits;
    expect((await m.refreshEmbeddingIndex())?.warmed).toBe(true); // the Stop hook warms the model when nothing is new
    expect(hits).toBe(before + 1);
    m.clearRelevantCache();
    const r = await m.getRelevantContextAsync("como tá o deadlock da fila?", { topK: 5, threshold: 0.2, timeoutMs: 2000 });
    expect(r.results[0]?.title).toBe("Fila de relatórios");
    expect(r.markdownBlock).toContain("## RELEVANT MEMORY");
    m.clearRelevantCache();
    expect((await m.getRelevantContextAsync("jogo de tennis amanhã", { timeoutMs: 2000 })).results).toEqual([]);
    down = true;
    m.clearRelevantCache();
    const fb = await m.getRelevantContextAsync("deadlock fila relatórios", { topK: 5, threshold: 0.2, timeoutMs: 2000 });
    m.clearRelevantCache();
    expect(fb).toEqual(m.getRelevantContext("deadlock fila relatórios", { topK: 5, threshold: 0.2 }));
    down = false;
  });

  test("on: a slow server past the deadline still gets the keyword result in time", async () => {
    process.env.LIFEOS_MEMORY_EMBEDDING = "1";
    const m = await import("./MemoryRetriever");
    await m.refreshEmbeddingIndex();
    slowMs = 1000;
    m.clearRelevantCache();
    const t0 = Date.now();
    const r = await m.getRelevantContextAsync("deadlock fila relatórios", { topK: 5, threshold: 0.2, deadline: Date.now() + 150 });
    const took = Date.now() - t0;
    slowMs = 0;
    expect(took).toBeLessThan(400);
    m.clearRelevantCache();
    expect(r).toEqual(m.getRelevantContext("deadlock fila relatórios", { topK: 5, threshold: 0.2 }));
  });

  test("on: the conversation context is embedded with the prompt but never decides whether to search", async () => {
    process.env.LIFEOS_MEMORY_EMBEDDING = "1";
    const m = await import("./MemoryRetriever");
    await m.refreshEmbeddingIndex();
    m.clearRelevantCache();
    // "and how is it now?" alone matches no topic; with the previous message it is about the queue
    expect((await m.getRelevantContextAsync("and how is it now?", { timeoutMs: 2000 })).results).toEqual([]);
    m.clearRelevantCache();
    const withCtx = await m.getRelevantContextAsync("and how is it now?", { timeoutMs: 2000, context: "the deadlock in the report fila" });
    expect(withCtx.results[0]?.title).toBe("Fila de relatórios");
    // an approval-only prompt retrieves nothing even with a topical context (the keyword path's gate)
    m.clearRelevantCache();
    expect((await m.getRelevantContextAsync("ok", { timeoutMs: 2000, context: "deadlock fila" })).results).toEqual([]);
  });

  test("worker: accepts the object message and, off, answers exactly as getRelevantContext", async () => {
    delete process.env.LIFEOS_MEMORY_EMBEDDING;
    const m = await import("./MemoryRetriever");
    // a Bun worker starts from the environment the process began with: hand it the isolated one
    const w = new Worker(new URL("../../hooks/lib/retrieval-worker.ts", import.meta.url).href, { env: { ...process.env } } as any);
    const got = await new Promise<any>((res) => { w.onmessage = (e) => res(e.data); w.postMessage({ query: "deadlock fila relatórios", deadline: Date.now() + 2000, transcriptPath: "/does/not/exist.jsonl" }); });
    w.terminate();
    m.clearRelevantCache();
    expect(got.markdownBlock).toBe(m.getRelevantContext("deadlock fila relatórios", { topK: 5, threshold: 0.2, allowStaleIndex: true }).markdownBlock);
  });
});
