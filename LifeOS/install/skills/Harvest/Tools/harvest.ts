#!/usr/bin/env bun
/**
 * Harvest skill — single front door for "harvest <X>".
 *
 * Detects source type (article URL / YouTube / raw text), fetches body or
 * transcript locally, POSTs to the Workflows harvest worker's /ingest-and-classify, then
 * shells out to HarvestExecutor.ts to produce the actual MEMORY/KNOWLEDGE
 * note. Never writes to KNOWLEDGE directly.
 */

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { workflowsConfigPath } from "../../../LIFEOS/TOOLS/WorkflowsConfig";
import { watchFile, watchYoutube } from "../../../LIFEOS/TOOLS/GeminiWatch";
import { invariant } from "../../../LIFEOS/TOOLS/Invariant";
import { claudeDirFor } from "../../../LIFEOS/TOOLS/Paths";
import { writeEvent } from "../../../LIFEOS/STATVS/index.ts";

const HOME = (process.env.HOME ?? process.env.USERPROFILE ?? os.homedir());  // USERPROFILE covers Windows hosts with no HOME
const WORKFLOWS_CONFIG_PATH = workflowsConfigPath(HOME);
// The install root: $CLAUDE_CONFIG_DIR when set, else ~/.claude. Every sibling tool
// and the USER extension resolve from here, so an alternate root works end to end.
const CONFIG_ROOT = claudeDirFor(process.env, HOME);
// The skill's own directory name, so the USER extension path follows a rename.
const SKILL_DIR_NAME = path.basename(path.resolve(import.meta.dir, ".."));
export const HARVEST_CONFIG_PATH = path.join(CONFIG_ROOT, "LIFEOS", "USER", "CUSTOMIZATIONS", "SKILLS", SKILL_DIR_NAME, "Config.md");
// The key's value is read from its own line only: a blank `harvest_api_base:` must
// never borrow the next line (a `## Notes` heading once became the endpoint), and
// anything that is not an http(s) URL is treated as unset.
export function parseHarvestApiBase(configText: string): string | undefined {
  const m = configText.match(/^[ \t]*harvest_api_base:[ \t]*([^\s]*)/im);
  const value = m?.[1];
  if (!value || !/^https?:\/\/\S+$/i.test(value)) return undefined;
  return value.replace(/\/+$/, "");
}
export function parseOcrLangs(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v && /^[A-Za-z_]+(\+[A-Za-z_]+)*$/.test(v) ? v : undefined;
}
export function ocrLanguageArgs(): string[] {
  let fromFile: string | undefined;
  try {
    fromFile = fs.readFileSync(HARVEST_CONFIG_PATH, "utf8").match(/^[ \t]*ocr_langs:[ \t]*([^\s]*)/im)?.[1];
  } catch {}
  const langs = parseOcrLangs(process.env.HARVEST_OCR_LANGS) ?? parseOcrLangs(fromFile);
  return langs ? ["-l", langs] : [];
}
function resolveHarvestApiBase(): string {
  const fromEnv = process.env.HARVEST_API_BASE;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  try {
    const fromFile = parseHarvestApiBase(fs.readFileSync(HARVEST_CONFIG_PATH, "utf8"));
    if (fromFile) return fromFile;
  } catch {}
  throw new Error(`HARVEST_API_BASE not configured — set the env var or the harvest_api_base key in ${HARVEST_CONFIG_PATH} (see Setup.md).`);
}
// Resolved on first use, never at import: the tests and any importer of the parse
// helpers must load this module on an install whose Config.md is not filled in yet.
// main() resolves it before anything else, so a CLI run still stops at start-up.
let harvestApiBaseCache: string | undefined;
export function harvestApiBase(): string {
  harvestApiBaseCache ??= resolveHarvestApiBase();
  return harvestApiBaseCache;
}
const EXECUTOR_PATH = path.join(CONFIG_ROOT, "LIFEOS", "TOOLS", "HarvestExecutor.ts");
const HTTP_TIMEOUT_MS = 30_000;
const MIN_BODY_BYTES = 200;
const MIN_TRANSCRIPT_BYTES = 500;
// An image capture can legitimately be mostly picture, so its floor is lower
// than an article's — but zero readable content is still a failed capture.
const MIN_IMAGE_BYTES = 40;
// A voice memo is a legitimate capture at one sentence, so it gets its own floor
// rather than inheriting YouTube's — a long-video threshold rejects real memos.
const MIN_AUDIO_TRANSCRIPT_BYTES = 80;
// Local transcription runs on mlx-whisper (Apple Silicon): a three-hour stream
// transcribes in about a minute. The openai `whisper` CLI is the fallback when
// mlx_whisper is not installed; it takes its own model names, hence two settings.
const MLX_WHISPER_MODEL = process.env.HARVEST_MLX_WHISPER_MODEL ?? "mlx-community/whisper-large-v3-turbo";
const WHISPER_MODEL = process.env.HARVEST_WHISPER_MODEL ?? "small";
// Every fetch says what it is. HARVEST_USER_AGENT overrides it for an install
// that needs a different declared client name.
const USER_AGENT = process.env.HARVEST_USER_AGENT?.trim() || "LifeOS-Harvest/1.0 (personal knowledge capture)";

// Optional lanes an install may add beside this file. A missing file means the lane
// is not part of this install and the caller takes its public path; a file that is
// present but fails to load is a real error and propagates.
interface ApiSampleLane {
  fetchApiSample(pageUrl: string, html: string, opts: { userAgent: string; timeoutMs: number }): Promise<string | null>;
}
interface YoutubeAudioLane {
  audioTranscript(url: string, opts: { transcribe: (file: string) => string; minBytes: number }): string;
}
async function loadOptionalLane<T>(file: string): Promise<T | null> {
  const p = path.join(import.meta.dir, file);
  if (!fs.existsSync(p)) return null;
  return (await import(p)) as T;
}

type SourceType = "article" | "youtube" | "x" | "text" | "textfile" | "pdf" | "image" | "audio";

// Extension → type, for local files and for URLs whose path ends in one.
// Synapse ISC-19/20/21: a content type earns the parse its content deserves, so
// a PDF is downloaded and read rather than fetched as HTML and stripped to gibberish.
const PDF_EXT = /\.pdf$/i;
const IMAGE_EXT = /\.(png|jpe?g|heic|heif|webp|gif|tiff?|bmp)$/i;
const AUDIO_EXT = /\.(mp3|m4a|wav|aiff?|aac|flac|ogg|opus|caf|amr|mp4|mov|m4v)$/i;
const TEXT_EXT = /\.(txt|md|markdown|rst|org|csv|json|ya?ml|log)$/i;

type HarvestItem = {
  id: number;
  classification: string;
  confidence: number;
  reasoning?: string;
  routed_actions?: string;
  /** Set by the classifier when the model call failed; the item is stored but unclassified. */
  error?: string;
};

type ClassifyResponse = {
  success: boolean;
  flow?: string;
  ingest?: {
    success?: boolean;
    output?: { status?: string; id?: number; source?: string; external_id?: string };
  };
  classify?: {
    success?: boolean;
    output?: { classified?: number; errors?: number; items?: HarvestItem[] };
  };
  output?: {
    status?: string;
    id?: number;
    items?: HarvestItem[];
  };
  error?: string;
};

export function extractStatusAndItem(resp: ClassifyResponse): { status: string; item: HarvestItem | null } {
  const status =
    resp.ingest?.output?.status ??
    resp.output?.status ??
    "unknown";
  const fromClassify = resp.classify?.output?.items?.[0];
  const fromFlat = resp.output?.items?.[0];
  let item = fromClassify ?? fromFlat ?? null;
  // The stored row's id, from either response shape; a flat duplicate carries only output.id.
  const storedId = resp.ingest?.output?.id ?? resp.output?.id;
  if (!item && storedId) {
    item = {
      id: storedId,
      classification: "(pending)",
      confidence: 0,
    };
  }
  return { status, item };
}

/** The classifier's own error for this item, or null when it classified. A pending item (ingest only) is not a failure. */
export function classifierFailure(resp: ClassifyResponse, item: HarvestItem): string | null {
  if (item.error) return item.error;
  if (resp.classify && resp.classify.success === false) return resp.error ?? "classify step reported failure";
  if (item.classification === "(pending)") return null;
  if (!item.classification) return "classifier returned no classification";
  return null;
}

/** One event per day of failures (STATVS writes it, Vigil routes it), so a dead classifier texts once instead of per capture. */
function alertClassifierFailure(itemId: number, reason: string): void {
  const now = new Date().toISOString();
  const r = writeEvent({
    id: randomUUID(),
    source: "harvest",
    ts: now,
    kind: "infra",
    severity: "high",
    title: "Harvest classifier is failing",
    summary: `Harvest item ${itemId} was stored but not classified, so nothing reaches Cortex: ${reason}`.slice(0, 1000),
    ref: String(itemId),
    url: null,
    privacy_class: "personal",
    dedup_key: `harvest:classify-failed:${now.slice(0, 10)}`,
    meta: { item_id: itemId },
  });
  if (!r.ok) process.stderr.write(`harvest: event refused: ${r.refused}\n`);
}

const HELP = `harvest — route a signal through Workflows + HarvestExecutor

USAGE
  bun harvest.ts <input> [--type auto|article|youtube|x|text|pdf|image|audio] [--dry-run] [--body-out <file>]
  echo "<text>" | bun harvest.ts --type text -
  bun harvest.ts ~/Downloads/paper.pdf          # local file, any supported type
  bun harvest.ts https://example.com/paper.pdf  # remote file, downloaded first

FLAGS
  --type <kind>   Force source type. Default: auto-detect by host, URL path
                  extension, or local-file extension.

  --url <url>     Canonical source URL for text signals (auth-walled pages
                  captured via browser; Workflows requires a url string).
  --dry-run       Detect + fetch only. No Workflows POST, no executor.
  --body-out <f>  Write the fetched title and full body to <f> as soon as the
                  fetch succeeds, before any POST, so a caller reads the same
                  text the note is built from without fetching it twice.
  --help          Show this help.

PARSING BY TYPE
  article  fetch + strip to body text          pdf    download + pdftotext
  youtube  Gemini watch pass on the URL       image  vision description + OCR
  text     used as-is                          audio  mlx-whisper transcript
  textfile read from disk                      x      X read tool; a post's video
                                                      is downloaded and watched

  Remote content-type wins over the URL path, so an extension-less PDF link
  (arxiv.org/pdf/<id>) is read as a PDF rather than stripped as HTML.

OUTPUT
  Single readable summary block:
    source, workflows.id, classification, confidence, executor.paths_written.

EXIT
  0 on success or duplicate. Non-zero on Intents/executor failure.
`;

function readWorkflowsToken(): string {
  if (!fs.existsSync(WORKFLOWS_CONFIG_PATH)) {
    throw new Error(`Workflows config not found at ${WORKFLOWS_CONFIG_PATH}`);
  }
  const text = fs.readFileSync(WORKFLOWS_CONFIG_PATH, "utf8");
  const match = text.match(/^auth_token:\s*["']?([^"'\s]+)["']?\s*$/m);
  if (!match) {
    throw new Error(`auth_token not found in ${WORKFLOWS_CONFIG_PATH}`);
  }
  return match[1];
}

const SOURCE_TYPES: SourceType[] = ["article", "youtube", "x", "text", "textfile", "pdf", "image", "audio"];

// An X post page is a login wall to a plain fetch, so a post filed as an article
// stored the wall and the tweet framing, never the video it carried (Synapse ISC-32).
const X_HOST = /^(?:www\.|mobile\.)?(?:x|twitter)\.com$/i;
function xStatusId(url: URL): string | null {
  if (!X_HOST.test(url.hostname)) return null;
  return url.pathname.match(/\/status\/(\d+)/)?.[1] ?? null;
}

function detectType(input: string, override?: string): SourceType {
  if (override && SOURCE_TYPES.includes(override as SourceType)) {
    return override as SourceType;
  }
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (/(^|\.)(youtu\.be|youtube\.com)$/i.test(url.hostname)) return "youtube";
      if (xStatusId(url)) return "x";
      if (PDF_EXT.test(url.pathname)) return "pdf";
      if (IMAGE_EXT.test(url.pathname)) return "image";
      if (AUDIO_EXT.test(url.pathname)) return "audio";
      return "article";
    } catch {
      return "text";
    }
  }
  // A local file is a first-class input: the principal captures things that
  // never had a URL (a downloaded paper, a screenshot, a voice memo).
  const asPath = localPathOf(trimmed);
  if (asPath) {
    if (PDF_EXT.test(asPath)) return "pdf";
    if (IMAGE_EXT.test(asPath)) return "image";
    if (AUDIO_EXT.test(asPath)) return "audio";
    if (TEXT_EXT.test(asPath)) return "textfile";
    // A real file whose type we can't parse must fail loudly. Falling through to
    // "text" files the PATH STRING as the body — a stub masquerading as a
    // successful capture, which is the failure Synapse ISC-22 forbids.
    throw new Error(
      `Unsupported file type: ${path.basename(asPath)} — no handler for this extension. ` +
        `Supported: pdf, image (png/jpg/heic/webp/gif/tiff), audio (mp3/m4a/wav/aiff/flac/ogg/mp4), text (txt/md/csv/json/yaml).`,
    );
  }
  return "text";
}

/**
 * Absolute path for a file input, or null when the input is not an existing
 * file. Accepts absolute, `~`-prefixed, `file://` and relative paths; a relative
 * path resolves against the working directory, so `harvest.ts notes.md` reads
 * the file instead of filing the string "notes.md" as raw text. Multi-line
 * input is always text, never a path.
 */
function localPathOf(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /[\r\n]/.test(trimmed) || /^https?:\/\//i.test(trimmed)) return null;
  const raw = trimmed.replace(/^file:\/\//, "").replace(/^~(?=\/|$)/, HOME);
  const p = path.resolve(raw);
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  } catch {
    return null;
  }
  return null;
}

/** Download a remote binary to a temp file so type-specific tools can read it. */
async function downloadToTemp(url: string, ext: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`Fetch ${url} returned ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harvest-"));
    const file = path.join(dir, `source${ext}`);
    fs.writeFileSync(file, buf);
    return file;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve an input to a readable local file, downloading it when remote. */
async function materialize(input: string, ext: string): Promise<string> {
  return localPathOf(input) ?? (await downloadToTemp(input, ext));
}

/** Short content digest of a file's bytes, the external_id key for file-shaped captures. */
export function fileDigest(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
}

function runTool(bin: string, args: string[], timeoutMs: number): string {
  const r = spawnSync(bin, args, { encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`${bin} failed to run: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${bin} exited ${r.status}: ${(r.stderr || r.stdout || "").slice(0, 400)}`);
  return r.stdout ?? "";
}

async function fetchPdfBody(input: string): Promise<{ title: string; body: string; digest: string }> {
  const file = await materialize(input, ".pdf");
  return { ...fetchPdfFromFile(file, input), digest: fileDigest(file) };
}

function fetchPdfFromFile(file: string, _source?: string): { title: string; body: string } {
  const text = runTool("pdftotext", ["-q", "-enc", "UTF-8", file, "-"], 120_000).replace(/\s+\n/g, "\n").trim();
  if (text.length < MIN_BODY_BYTES) {
    throw new Error(`PDF text too short (${text.length} bytes) — likely a scanned image PDF with no text layer`);
  }
  const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 8) ?? path.basename(file);
  return { title: first.slice(0, 240), body: text };
}

async function fetchImageBody(input: string): Promise<{ title: string; body: string; digest: string }> {
  const file = await materialize(input, path.extname(input) || ".png");
  return { ...(await fetchImageFromFile(file)), digest: fileDigest(file) };
}

async function fetchImageFromFile(file: string): Promise<{ title: string; body: string }> {
  const ocr = runTool("tesseract", [file, "stdout", "--psm", "3", ...ocrLanguageArgs()], 120_000).replace(/\s+/g, " ").trim();
  const described = await describeImage(file);
  const parts: string[] = [];
  if (described) parts.push(`DESCRIPTION:\n${described}`);
  if (ocr) parts.push(`TEXT IN IMAGE:\n${ocr}`);
  const body = parts.join("\n\n");
  if (body.length < MIN_IMAGE_BYTES) {
    throw new Error(`Image yielded no readable content (${body.length} bytes) — no text layer and no description`);
  }
  const title = (described?.split(/[.\n]/)[0] ?? ocr.slice(0, 80) ?? path.basename(file)).trim();
  return { title: title.slice(0, 240), body };
}

/**
 * Vision description via the leveled inference utility. Skipped inside a nested
 * Claude Code session — CLAUDECODE blocks the subprocess (OPERATIONAL_PREFERENCES),
 * so OCR alone carries the capture rather than the whole harvest failing.
 */
async function describeImage(file: string): Promise<string | null> {
  if (process.env.CLAUDECODE) return null;
  try {
    const { inference } = await import(path.join(CONFIG_ROOT, "LIFEOS", "TOOLS", "Inference.ts"));
    // Only the anthropic (claude CLI, subscription) lane takes imagePaths; the openai lanes refuse them.
    const out = await inference({
      systemPrompt: "You describe images for a personal knowledge archive.",
      userPrompt:
        "Describe this image in 2-4 sentences: what it shows, any diagram or chart structure, and what a reader would take from it. Plain prose, no preamble.",
      level: "low",
      vendor: "anthropic",
      allowVendorFallback: false,
      imagePaths: [file],
      timeout: 90_000,
    });
    if (!out.success) {
      console.error(`[harvest] image description skipped: ${out.error ?? "inference failed"}`);
      return null;
    }
    return out.output.trim() || null;
  } catch (err) {
    console.error(`[harvest] image description skipped: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function fetchAudioBody(input: string): Promise<{ title: string; body: string; digest: string }> {
  const file = await materialize(input, path.extname(input) || ".mp3");
  return { ...fetchAudioFromFile(file), digest: fileDigest(file) };
}

function fetchAudioFromFile(file: string): { title: string; body: string } {
  const body = transcribeLocal(file);
  if (body.length < MIN_AUDIO_TRANSCRIPT_BYTES) {
    throw new Error(`Transcript too short (${body.length} bytes) — audio may be silent or unreadable`);
  }
  return { title: path.basename(file, path.extname(file)).slice(0, 240), body };
}

// mlx_whisper installs to ~/.local/bin, which a launchd PATH may not carry.
function mlxWhisperBin(): string | null {
  const onPath = Bun.which("mlx_whisper");
  if (onPath) return onPath;
  const local = path.join(HOME, ".local", "bin", "mlx_whisper");
  return fs.existsSync(local) ? local : null;
}

function transcribeLocal(file: string): string {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "harvest-whisper-"));
  try {
    const mlx = mlxWhisperBin();
    if (mlx) {
      runTool(mlx, [file, "--model", MLX_WHISPER_MODEL, "--output-format", "txt", "--output-dir", outDir, "--verbose", "False"], 900_000);
    } else {
      runTool("whisper", [file, "--model", WHISPER_MODEL, "--output_format", "txt", "--output_dir", outDir, "--verbose", "False"], 900_000);
    }
    const txt = fs.readdirSync(outDir).find((f) => f.endsWith(".txt"));
    if (!txt) throw new Error("whisper produced no transcript file");
    return fs.readFileSync(path.join(outDir, txt), "utf8").trim();
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function fetchArticleBody(url: string): Promise<{ title: string; body: string; parsedAs?: SourceType; digest?: string }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      throw new Error(`Fetch ${url} returned ${res.status} ${res.statusText}`);
    }
    // Content-type is the authority, not the URL path. arxiv.org/pdf/<id> serves
    // a PDF from an extension-less URL; without this the bytes get HTML-stripped
    // into 266KB of mojibake that passes the length check and files as a real
    // capture — the exact stub-as-success failure Synapse ISC-22 forbids.
    const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    const magic = buf.subarray(0, 5).toString("latin1");
    if (ctype.includes("application/pdf") || magic === "%PDF-") {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harvest-"));
      const file = path.join(dir, "source.pdf");
      fs.writeFileSync(file, buf);
      return { ...fetchPdfFromFile(file, url), parsedAs: "pdf", digest: fileDigest(file) };
    }
    if (ctype.startsWith("image/")) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harvest-"));
      const ext = ctype.includes("png") ? ".png" : ctype.includes("gif") ? ".gif" : ".jpg";
      const file = path.join(dir, `source${ext}`);
      fs.writeFileSync(file, buf);
      return { ...(await fetchImageFromFile(file)), parsedAs: "image", digest: fileDigest(file) };
    }
    if (ctype.startsWith("audio/") || ctype.startsWith("video/")) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harvest-"));
      const file = path.join(dir, "source.mp4");
      fs.writeFileSync(file, buf);
      return { ...fetchAudioFromFile(file), parsedAs: "audio", digest: fileDigest(file) };
    }
    const html = buf.toString("utf8");
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    // Backreference to the OPENING quote — a naive [^"']+ class stops at an
    // apostrophe inside a double-quoted value, truncating
    // content="I'm Worried About X" down to "I" (same bug found live in the
    // LinkedIn adapter on 2026-08-19).
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=(["'])(.*?)\1/i);
    const title = (ogTitle?.[2] ?? titleMatch?.[1] ?? url).replace(/\s+/g, " ").trim().slice(0, 240);
    let body = stripHtml(html);
    // A JS app shell strips to a few hundred bytes of "Loading…". An install that
    // provides the API-sampling lane adds its bounded sample; without it the
    // body floor below decides, as for any other thin page.
    if (body.length < SHELL_MAX_TEXT_BYTES) {
      const lane = await loadOptionalLane<ApiSampleLane>("ApiSample.ts"); // optional lane, not in the public release
      const sample = lane ? await lane.fetchApiSample(url, html, { userAgent: USER_AGENT, timeoutMs: HTTP_TIMEOUT_MS }) : null;
      if (sample) body = `${body}\n\n${sample}`;
    }
    if (body.length < MIN_BODY_BYTES) {
      throw new Error(`Body too short after strip (${body.length} bytes) — likely paywall or JS-rendered page`);
    }
    assertReadableText(body, url);
    return { title, body };
  } finally {
    clearTimeout(timer);
  }
}

// App-shell pages: an install may provide an API-sampling lane (not in the public release).
// The gate stays here so the article path reads the same with or without it.
const SHELL_MAX_TEXT_BYTES = 2000;

/**
 * Backstop for any binary that slips past content-type sniffing: decoded
 * binary is dense in replacement and control characters, real prose is not.
 * A capture that is mostly mojibake is a failed parse, never a stored note.
 */
export function assertReadableText(body: string, source: string): void {
  const sample = body.slice(0, 4000);
  const junk = (sample.match(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
  const ratio = junk / Math.max(sample.length, 1);
  if (ratio > 0.02) {
    throw new Error(
      `Extracted text is ${(ratio * 100).toFixed(1)}% unreadable characters — ${source} is binary, not text. ` +
        `Re-run with an explicit --type if this source has a real handler.`,
    );
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYoutubeId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.replace(/^\//, "").split("/")[0];
    const v = u.searchParams.get("v");
    if (v) return v;
    const short = u.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/);
    if (short) return short[1];
    throw new Error("No video id in URL");
  } catch (e) {
    throw new Error(`Cannot extract YouTube id from ${url}: ${(e as Error).message}`);
  }
}

// The title comes from YouTube's published oEmbed endpoint, the metadata it offers for
// embedding. Best effort: any failure, or a response without a string title, means null.
export function parseOembedTitle(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const { title, author_name } = json as { title?: unknown; author_name?: unknown };
  if (typeof title !== "string" || !title.trim()) return null;
  return typeof author_name === "string" && author_name.trim() ? `${title.trim()} — ${author_name.trim()}` : title.trim();
}

async function youtubeTitle(url: string): Promise<string | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
      signal: ac.signal,
      headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
    });
    if (!res.ok) return null;
    return parseOembedTitle(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// The transcript comes from a Gemini watch pass on the public URL. An install that
// provides the local-audio lane (not in the public release) tries it first and falls back
// to the watch pass when it fails; the note body says which source it came from.
async function fetchYoutubeTranscript(url: string): Promise<{ title: string; body: string }> {
  const title = (await youtubeTitle(url)) ?? `YouTube ${extractYoutubeId(url)}`;
  const audioLane = await loadOptionalLane<YoutubeAudioLane>("YoutubeAudio.ts"); // optional lane, not in the public release
  let localFailure: string | null = null;
  if (audioLane) {
    try {
      return { title, body: audioLane.audioTranscript(url, { transcribe: transcribeLocal, minBytes: MIN_TRANSCRIPT_BYTES }) };
    } catch (audioErr) {
      localFailure = (audioErr as Error).message;
      console.error(`harvest: ${localFailure.split("\n")[0]} — falling back to a Gemini watch pass`);
    }
  }
  let watched: { text: string; model: string };
  try {
    watched = await watchYoutube(url);
  } catch (geminiErr) {
    const prefix = localFailure ? `${localFailure}; Gemini fallback failed` : "Gemini watch pass failed";
    throw new Error(`${prefix}: ${(geminiErr as Error).message}`);
  }
  if (watched.text.length < MIN_TRANSCRIPT_BYTES) {
    const prefix = localFailure ? `${localFailure}; Gemini fallback too short` : "Gemini watch pass too short";
    throw new Error(`${prefix} (${watched.text.length} bytes) — video may have no speech`);
  }
  console.error(`harvest: transcript source gemini (${watched.model}, ${watched.text.length} chars)`);
  const note = localFailure
    ? `[Transcript from a Gemini watch pass (${watched.model}); local audio transcription failed.]`
    : `[Transcript from a Gemini watch pass (${watched.model}).]`;
  return { title, body: `${note}\n\n${watched.text}` };
}

// The title is the post's first line, unless that line is only links: a post that just
// shares an article would otherwise be titled with its t.co URL. Then the article title
// read.ts prints wins, else the first line of the post's own text. A t.co link never
// reaches the title.
export function xPostTitle(post: string, url: string): string {
  const lines = post.split("\n").map((l) => l.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const handle = first.match(/^(@\w+):\s*/)?.[1];
  const text = first.replace(/^@\w+:\s*/, "").replace(/https?:\/\/\S+/g, "").trim();
  const label = (t: string) => (handle ? `${handle}: ${t}` : t).slice(0, 120);
  if (text) return label(text);

  const article = post.match(/^=== ARTICLE: (.+?)\s*===\s*$/m)?.[1]?.trim();
  if (article) return label(article);
  const fullText = post.match(/^=== FULL TEXT[^\n]*===\n(.+)$/m)?.[1]?.replace(/https?:\/\/\S+/g, "").trim();
  if (fullText) return label(fullText);
  return label(`X post ${url.match(/status\/(\d+)/)?.[1] ?? url}`);
}

// X reads go through the X read tool (OPERATIONAL_PREFERENCES § X reads). When the
// post carries a video, the video is the source and the post is someone's framing of
// it (§ Video-bearing content): download it and run a Gemini watch pass on the file.
// A failed video watch fails the capture rather than filing the framing alone.
async function fetchXPost(url: string): Promise<{ title: string; body: string }> {
  const readTool = path.join(CONFIG_ROOT, "skills", "X", "Tools", "read.ts");
  const post = runTool(process.execPath, [readTool, url], 120_000).trim();
  if (!post) throw new Error("X read returned nothing");
  const title = xPostTitle(post, url);
  if (!/\/video\/\d+/.test(post)) return { title, body: post };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harvest-xvideo-"));
  try {
    runTool(
      "yt-dlp",
      ["--no-playlist", "--no-progress", "--no-warnings", "--merge-output-format", "mp4", "-o", path.join(dir, "video.%(ext)s"), url],
      900_000,
    );
    const video = fs.readdirSync(dir).find((f) => f.startsWith("video.") && !f.endsWith(".part"));
    if (!video) throw new Error("yt-dlp produced no video file for the X post");
    const watched = await watchFile(path.join(dir, video), video.endsWith(".mp4") ? "video/mp4" : "video/*");
    if (watched.text.length < MIN_TRANSCRIPT_BYTES) {
      throw new Error(`X video watch pass too short (${watched.text.length} bytes)`);
    }
    console.error(`harvest: X video watched (${watched.model}, ${watched.text.length} chars)`);
    return { title, body: `${post}\n\n## Video (Gemini watch pass, ${watched.model})\n\n${watched.text}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function readStdinSync(): string {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/**
 * Stable id for an article URL: a readable host+path slug plus a short hash of the exact
 * host+path+query. The slug alone is lossy (case folds, and every run of punctuation becomes one
 * hyphen), so `/Guide` and `/guide`, or `/a_b`, `/a-b` and `/a/b`, would share an id and the second
 * article would be dropped as a duplicate; the hash keeps them apart. Trailing slashes are trimmed
 * before hashing, so `/post` and `/post/` stay one article. Ids stored as bare slugs before the hash
 * was always appended do not match these, so re-harvesting one of those URLs ingests it once more.
 */
export function articleExternalId(u: URL): string {
  const full = u.hostname + u.pathname.replace(/\/+$/, "");
  const slug = full.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const digest = sha256Hex(full + u.search).slice(0, 8);
  return `${slug.slice(0, 110).replace(/-$/, "")}-${digest}`;
}

function buildPayload(opts: {
  type: SourceType;
  input: string;
  url: string | null;
  title: string;
  body: string;
  /** Digest of the file bytes actually read, local or downloaded (fileDigest). */
  digest?: string;
}): { source: string; external_id: string; url: string | null; title: string; body: string } {
  if (opts.type === "youtube") {
    return {
      source: "web",
      external_id: extractYoutubeId(opts.url!),
      url: opts.url,
      title: opts.title,
      body: opts.body,
    };
  }
  if (opts.type === "x") {
    return {
      source: "manual",
      external_id: `x-${xStatusId(new URL(opts.url!))}`,
      url: opts.url,
      title: opts.title,
      body: opts.body,
    };
  }
  if (opts.type === "article") {
    const u = new URL(opts.url!);
    return {
      source: "manual",
      external_id: articleExternalId(u),
      url: opts.url,
      title: opts.title,
      body: opts.body,
    };
  }
  // File-shaped captures are content-addressed so the same PDF, screenshot, or
  // recording arriving twice — from disk and from a URL — collapses to one row
  // (Synapse's idempotency contract). A remote file is hashed from the bytes
  // downloaded for it, never from its URL, so both arrivals share one key.
  if (opts.type === "pdf" || opts.type === "image" || opts.type === "audio" || opts.type === "textfile") {
    const local = localPathOf(opts.input);
    invariant(!!opts.digest || !!local, `harvest: ${opts.type} capture reached buildPayload with no file bytes to address`);
    const digest = opts.digest ?? fileDigest(local!);
    return {
      source: "manual",
      external_id: `${opts.type}-${digest}`,
      url: opts.url ?? undefined,
      title: opts.title,
      body: opts.body,
    };
  }
  const hash = sha256Hex(opts.input).slice(0, 16);
  return {
    source: "manual",
    external_id: `text-${hash}`,
    // Workflows' ingest action accepts url as string-or-absent, never null:
    // `null` fails its "url must be string" check on pasted text.
    // Omit it when there is none; --url supplies a
    // canonical one for text signals captured from auth-walled pages.
    url: opts.url ?? undefined,
    title: opts.title || opts.input.slice(0, 120),
    body: opts.body,
  };
}

async function postToWorkflows(
  token: string,
  payload: ReturnType<typeof buildPayload>,
): Promise<ClassifyResponse> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${harvestApiBase()}/ingest-and-classify`, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: ClassifyResponse;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Workflows returned non-JSON (${res.status}): ${text.slice(0, 400)}`);
    }
    if (!res.ok) {
      throw new Error(`Workflows ${res.status}: ${json.error ?? text.slice(0, 400)}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// The body goes down by file: /items does not return it, and without it the note is
// written from the title and the classifier's reasoning alone (Synapse ISC-33).
function runExecutor(itemId: number, body: string): { code: number; stdout: string; stderr: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harvest-body-"));
  const bodyFile = path.join(dir, "body.txt");
  fs.writeFileSync(bodyFile, body, "utf8");
  try {
    const result = spawnSync("bun", [EXECUTOR_PATH, "--item", String(itemId), "--body-file", bodyFile], {
      encoding: "utf8",
      timeout: 300_000,
      // The executor reads the harvest endpoint from WORKFLOWS_HARVEST_API_BASE.
      // The wrapper owns the URL, so thread it down — otherwise the executor
      // defaults to "" and crashes building new URL("/items").
      env: { ...process.env, WORKFLOWS_HARVEST_API_BASE: harvestApiBase() },
    });
    return {
      code: result.status ?? -1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  try {
    harvestApiBase();
  } catch (e) {
    process.stderr.write(`harvest: ${(e as Error).message}\n`);
    return 1;
  }
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      options: {
        type: { type: "string", default: "auto" },
        url: { type: "string" },
        "dry-run": { type: "boolean", default: false },
        "body-out": { type: "string" },
        help: { type: "boolean", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (e) {
    process.stderr.write(`harvest: ${(e as Error).message}\n\n${HELP}`);
    return 2;
  }

  if (parsed.values.help || parsed.positionals.length === 0) {
    process.stdout.write(HELP);
    return parsed.values.help ? 0 : 2;
  }

  let input = parsed.positionals[0];
  if (input === "-") input = readStdinSync().trim();
  if (!input) {
    process.stderr.write("harvest: empty input\n");
    return 2;
  }

  let type: SourceType;
  try {
    type = detectType(input, parsed.values.type as string);
  } catch (e) {
    process.stderr.write(`harvest: ${(e as Error).message}\n`);
    return 1;
  }
  const isRemote = /^https?:\/\//i.test(input.trim());
  const url =
    type === "text" || !isRemote
      ? ((parsed.values.url as string | undefined) ?? null)
      : input;
  const dryRun = parsed.values["dry-run"] as boolean;

  let title = "";
  let body = "";
  let parsedAs: SourceType | null = null;
  let digest: string | undefined;
  try {
    if (type === "article") {
      const fetched = await fetchArticleBody(url!);
      title = fetched.title;
      body = fetched.body;
      if (fetched.parsedAs) parsedAs = fetched.parsedAs;
      digest = fetched.digest;
    } else if (type === "x") {
      const fetched = await fetchXPost(url!);
      title = fetched.title;
      body = fetched.body;
    } else if (type === "youtube") {
      const fetched = await fetchYoutubeTranscript(url!);
      title = fetched.title;
      body = fetched.body;
    } else if (type === "pdf") {
      const fetched = await fetchPdfBody(input);
      title = fetched.title;
      body = fetched.body;
      digest = fetched.digest;
    } else if (type === "image") {
      const fetched = await fetchImageBody(input);
      title = fetched.title;
      body = fetched.body;
      digest = fetched.digest;
    } else if (type === "audio") {
      const fetched = await fetchAudioBody(input);
      title = fetched.title;
      body = fetched.body;
      digest = fetched.digest;
    } else if (type === "textfile") {
      const file = localPathOf(input)!;
      body = fs.readFileSync(file, "utf8").trim();
      if (body.length < MIN_BODY_BYTES) {
        throw new Error(`File text too short (${body.length} bytes): ${path.basename(file)}`);
      }
      title = (body.split("\n").find((l) => l.trim().length > 8) ?? path.basename(file)).replace(/^#+\s*/, "").slice(0, 240);
    } else {
      // First real line, never a slice across newlines: a 120-char slice of a
      // multi-line paste becomes a title that runs into the body.
      title = (input.split("\n").find((l) => l.trim().length > 0) ?? input).trim().slice(0, 120);
      body = input;
    }
  } catch (e) {
    process.stderr.write(`harvest: source fetch failed: ${(e as Error).message}\n`);
    return 1;
  }

  // A file served from an extension-less URL is keyed as the file it turned out
  // to be, from its bytes, so it collapses with the same file harvested from disk.
  const payload = buildPayload({ type: parsedAs ?? type, input, url, title, body, digest });

  // Written before the POST so a Workflows failure still leaves the caller the
  // text to analyze; Mine reads this instead of fetching the source again.
  const bodyOut = parsed.values["body-out"] as string | undefined;
  if (bodyOut) {
    invariant(payload.body.length > 0, "harvest: --body-out reached with an empty body; the fetch floors should have refused it");
    fs.writeFileSync(bodyOut, `${payload.title}\n\n${payload.body}\n`, "utf8");
  }

  if (dryRun) {
    process.stdout.write(
      `--- HARVEST DRY RUN ---\n` +
        `type:        ${type}${parsedAs && parsedAs !== type ? ` (parsed as ${parsedAs})` : ""}\n` +
        `source:      ${payload.source}\n` +
        `external_id: ${payload.external_id}\n` +
        `url:         ${payload.url ?? "(none)"}\n` +
        `title:       ${payload.title}\n` +
        `body bytes:  ${payload.body.length}\n` +
        `body head:   ${payload.body.replace(/\s+/g, " ").slice(0, 200)}\n` +
        `(no Workflows POST, no executor)\n`,
    );
    return 0;
  }

  let token: string;
  try {
    token = readWorkflowsToken();
  } catch (e) {
    process.stderr.write(`harvest: ${(e as Error).message}\n`);
    return 1;
  }

  let workflowsResp: ClassifyResponse;
  try {
    workflowsResp = await postToWorkflows(token, payload);
  } catch (e) {
    process.stderr.write(`harvest: Workflows classify failed: ${(e as Error).message}\n`);
    return 1;
  }

  const { status, item } = extractStatusAndItem(workflowsResp);

  process.stdout.write(
    `--- HARVEST ---\n` +
      `type:           ${type}\n` +
      `source:         ${payload.source}\n` +
      `external_id:    ${payload.external_id}\n` +
      `workflows.status: ${status}\n`,
  );

  if (status === "duplicate") {
    process.stdout.write(`workflows.id:   ${item?.id ?? "(unknown — look up via /items)"}\n`);
    // Storage happens before classification and the note write, either of which can fail. A repeat
    // harvest must not report success on a half-finished capture, so the failure checks and the
    // executor run again below; the executor skips items its own state already holds. A duplicate
    // with no id cannot be re-checked, so it falls through to the no-usable-id failure below.
    if (item && typeof item.id === "number") {
      process.stdout.write(`note:           already harvested; re-checking classification and note\n`);
    }
  }

  if (!item || typeof item.id !== "number") {
    process.stderr.write(`harvest: Workflows returned no usable item id; response: ${JSON.stringify(workflowsResp).slice(0, 400)}\n`);
    return 1;
  }

  // The item is stored, but the classifier failed on it. Running the executor anyway files nothing
  // and reads as success (a revoked classifier API key leaves every capture at a null class).
  const classifyFailure = classifierFailure(workflowsResp, item);
  if (classifyFailure) {
    process.stderr.write(
      `harvest: item ${item.id} was stored but the classifier failed: ${classifyFailure}\n` +
        `harvest: once the classifier works, retry with POST ${harvestApiBase()}/classify {"item_id":${item.id}}\n`,
    );
    alertClassifierFailure(item.id, classifyFailure);
    return 1;
  }

  process.stdout.write(
    `workflows.id:   ${item.id}\n` +
      `classification: ${item.classification}\n` +
      `confidence:     ${item.confidence}\n` +
      (item.reasoning ? `reasoning:      ${item.reasoning.slice(0, 200)}\n` : ``) +
      (item.routed_actions ? `routed_actions: ${item.routed_actions}\n` : ``),
  );

  const exec = runExecutor(item.id, payload.body);
  process.stdout.write(`\n--- HarvestExecutor (item ${item.id}) ---\n${exec.stdout}`);
  if (exec.code !== 0) {
    process.stderr.write(`harvest: executor exited ${exec.code}\n${exec.stderr}`);
    return exec.code === -1 ? 1 : exec.code;
  }
  return 0;
}

// Guarded so the parse guards can be imported and probed without running a harvest.
if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`harvest: unexpected error: ${(e as Error).stack ?? e}\n`);
      process.exit(1);
    });
}
