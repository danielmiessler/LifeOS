/**
 * Content module — feeds the Pulse "CONTENT" tab (Conveyor board).
 *
 * The content ledger (MEMORY/STATE/content-pipeline/events.jsonl) is the
 * source of truth; the Conveyor watcher and stage-runner write it. This module
 * reads the board, plus ONE deliberate write path: DELETE, which is the
 * dashboard's kill switch (delete event + source file to .trash + artifacts
 * removed + runner kicked if the item held a live lease, so in-flight work
 * actually stops). The P4 approve endpoint will be the second write path.
 *
 * Routes (all under /api/content):
 *   GET    /api/content         → { columns[], items[], counts, generatedAt }
 *   GET    /api/content/stream  → text/event-stream, one `data:` board frame per change
 *   GET    /api/content/status  → module health
 *   DELETE /api/content/:id     → kill an item: dead card, dead tasks, no resurrection
 *   POST   /api/content/:id/run → request the regular run (edit → augment → clips → social,
 *                                 staged): writes requested_run to the ledger; {{DA_NAME}} in-session
 *                                 or the stage-runner (P3) picks it up. Publishing stays gated.
 */

import { existsSync, mkdirSync, renameSync, rmSync, watch } from "fs";
import { basename, dirname, join } from "path";
import { homedir } from "os";
import { LEGS, appendEvents, eventsPath, readState } from "../../TOOLS/Conveyor/Ledger";
import { claudeDir } from "../../TOOLS/lifeos-root";

const MODULE = "content";
const STAGES = ["inbox", "prep", "produce", "review", "publishing", "done"] as const;

const state = { running: false, startedAt: null as Date | null };

export async function start(): Promise<void> {
  console.log(`[${MODULE}] Starting (ledger: ${eventsPath()})`);
  state.running = true;
  state.startedAt = new Date();
}

export async function stop(): Promise<void> {
  state.running = false;
}

export function health(): { status: string; details?: Record<string, unknown> } {
  let items = 0;
  try {
    items = Object.keys(readState().items).length;
  } catch {
    /* health must not throw */
  }
  return {
    status: state.running ? "healthy" : "stopped",
    details: { items, ledger: eventsPath() },
  };
}

/** Fold the ledger into the board-shaped payload the dashboard renders. */
function buildBoard(): Record<string, unknown> {
  const items = Object.values(readState().items).sort((a, b) =>
    String(b.created ?? "").localeCompare(String(a.created ?? "")),
  );
  const counts: Record<string, number> = {};
  for (const s of STAGES) counts[s] = 0;
  for (const it of items) counts[String(it.stage ?? "inbox")] = (counts[String(it.stage ?? "inbox")] ?? 0) + 1;
  return { columns: STAGES, legs: LEGS, items, counts, generatedAt: new Date().toISOString() };
}

/** SSE: push a board frame now, then on every ledger change (debounced), plus heartbeats. */
function streamResponse(): Response {
  const ledger = eventsPath();
  const encoder = new TextEncoder();
  let cleanup: () => void = () => {};
  const body = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (payload: unknown): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // First frame immediately so the board paints on connect.
      send(buildBoard());

      // Debounce fs.watch bursts — one paint per settle.
      let timer: ReturnType<typeof setTimeout> | null = null;
      const onChange = (): void => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => send(buildBoard()), 150);
      };

      let watcher: ReturnType<typeof watch> | null = null;
      try {
        watcher = watch(ledger, onChange);
      } catch {
        /* if watch fails, the client's poll fallback carries it */
      }

      // Heartbeat keeps the connection from idling out and re-syncs slow watchers.
      const beat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: hb\n\n`));
        } catch {
          closed = true;
        }
      }, 15_000);

      // Resync poll — a cheap safety net if a change event is ever missed.
      const resync = setInterval(() => send(buildBoard()), 5_000);

      cleanup = () => {
        closed = true;
        if (timer) clearTimeout(timer);
        clearInterval(beat);
        clearInterval(resync);
        watcher?.close();
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** Kill an item: delete event, source to .trash, artifacts gone, running work kicked. */
function deleteItem(id: string): Response {
  const item = readState().items[id];
  if (!item) return Response.json({ error: `no item ${id}` }, { status: 404 });

  // 1. Delete event first — the runner's write guard suppresses any in-flight
  //    progress writes from the moment this lands.
  appendEvents([{ v: 1, ts: new Date().toISOString(), id, op: "delete", src: "dashboard" }]);

  // 2. Source file (and sidecar) out of the inbox, or the watcher re-registers
  //    the hash the delete just removed. Dotdir keeps it invisible to the scan.
  const moved: string[] = [];
  try {
    if (item.path && existsSync(String(item.path))) {
      const trash = join(dirname(String(item.path)), ".trash");
      mkdirSync(trash, { recursive: true });
      for (const p of [String(item.path), `${item.path}.md`]) {
        if (existsSync(p)) {
          renameSync(p, join(trash, basename(p)));
          moved.push(p);
        }
      }
    }
  } catch (err) {
    console.warn(`[${MODULE}] delete ${id}: trash move failed: ${err}`);
  }

  // 3. Artifacts (audio, transcript, derivatives).
  const artifacts = join(
    process.env.LIFEOS_DIR || join(claudeDir(), "LIFEOS"),
    "MEMORY", "STATE", "content-pipeline", "artifacts", id,
  );
  try {
    rmSync(artifacts, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[${MODULE}] delete ${id}: artifact cleanup failed: ${err}`);
  }

  // 4. If the runner holds a live lease on this item, kick the service so the
  //    in-flight stage (transcription, audit, whatever) actually dies now.
  let kicked = false;
  const leaseLive = item.lease_expires && Date.parse(String(item.lease_expires)) > Date.now();
  if (leaseLive || item.stage_status === "running") {
    const uid = Bun.spawnSync(["id", "-u"], { stdout: "pipe" }).stdout.toString().trim();
    const r = Bun.spawnSync(["launchctl", "kickstart", "-k", `gui/${uid}/com.lifeos.conveyor-runner`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    kicked = r.exitCode === 0;
    console.log(`[${MODULE}] delete ${id}: runner kickstart ${kicked ? "OK" : "failed: " + r.stderr.toString().trim()}`);
  }

  return Response.json({ ok: true, id, trashed: moved.length, artifactsRemoved: true, runnerKicked: kicked });
}

/** Request the regular run for an item: one ledger upsert; executors poll the flag. */
function requestRun(id: string): Response {
  const item = readState().items[id];
  if (!item) return Response.json({ error: `no item ${id}` }, { status: 404 });
  if (item.requested_run) return Response.json({ ok: true, id, already: true });
  appendEvents([
    {
      v: 1,
      ts: new Date().toISOString(),
      id,
      op: "upsert",
      fields: { requested_run: "regular", requested_at: new Date().toISOString(), updated: new Date().toISOString() },
      src: "dashboard",
    },
  ]);
  return Response.json({ ok: true, id, requested_run: "regular" });
}

export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith("/api/content")) return null;
  const sub = pathname.replace(/^\/api\/content/, "") || "/";

  if (sub === "/status") return Response.json(health());

  const runMatch = sub.match(/^\/([A-Za-z0-9]+)\/run$/);
  if (req.method === "POST" && runMatch) return requestRun(runMatch[1]);

  const idMatch = sub.match(/^\/([A-Za-z0-9]+)$/);
  if (req.method === "DELETE" && idMatch) return deleteItem(idMatch[1]);

  if (sub === "/stream" && req.method === "GET") return streamResponse();

  if (req.method === "GET" && (sub === "/" || sub === "")) {
    try {
      return Response.json(buildBoard());
    } catch (err) {
      return Response.json({ columns: STAGES, legs: LEGS, items: [], counts: {}, error: String(err) }, { status: 200 });
    }
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
