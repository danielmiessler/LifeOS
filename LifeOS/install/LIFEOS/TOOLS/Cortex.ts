#!/usr/bin/env bun
/**
 * @version 1.0.3
 */
import { existsSync, lstatSync, opendirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { createCaptureEnvelope, isEnvelopeValidAt } from "./CaptureEnvelope";
import { lifeosPath } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord

export const SCHEMA = "lifeos-cortex/v1" as const;
export const EXIT = { OK: 0, INTERNAL: 1, NOT_FOUND: 3, INVALID_INPUT: 4, WRITE_REFUSED: 5 } as const;
export const LIMITS = { QUERY_CHARS: 2048, QUERY_TERMS: 64, PAGE_SIZE: 100, GRAPH_NODES: 100, GRAPH_TOKENS: 50_000, IDS: 100, WRITE_BYTES: 262_144 } as const;
// Fail-closed limits for the complete canonical corpus, checked before content reads.
export const CANONICAL_CORPUS_LIMITS = { MAX_FILES: 10_000, MAX_FILE_BYTES: 8 * 1024 * 1024, MAX_TOTAL_BYTES: 128 * 1024 * 1024, MAX_RECORDS: 50_000 } as const;
const ADAPTERS = new Set(["claude", "hermes", "codex", "subagent"]);
const COMMANDS = new Set(["status", "search", "timeline", "get", "export", "remember", "propose", "rebuild"]);

export interface CortexEnvelope { schema: typeof SCHEMA; ok: boolean; command: string; data: unknown; error: null | { code: string; message: string } }
export interface CortexRunResult { exitCode: number; envelope: CortexEnvelope }
export interface CortexRuntime { memoryRoot?: string; memoryAdd?: (item: any) => any }
export interface CortexRecord { id: string; type: string; title: string; created: string; updated: string; provenance: { source: string; session: string | null; path: string }; content: string; related: string[]; valid_from?: string | null; valid_until?: string | null }
export interface CortexCard { id: string; type: string; created: string; updated: string; provenance: CortexRecord["provenance"]; score: number; est_tokens: number }

export function validateCortexEnvelope(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["envelope must be an object"];
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["command", "data", "error", "ok", "schema"])) errors.push("envelope has unexpected or missing properties");
  if (row.schema !== SCHEMA) errors.push("schema must be lifeos-cortex/v1");
  if (typeof row.ok !== "boolean") errors.push("ok must be boolean");
  if (typeof row.command !== "string") errors.push("command must be string");
  if (row.ok === true && (row.error !== null || row.data === null || row.data === undefined)) errors.push("successful envelope must have data and null error");
  if (row.ok === false) {
    if (row.data !== null) errors.push("failed envelope must have null data");
    const error = row.error as Record<string, unknown> | null;
    if (!error || typeof error !== "object" || typeof error.code !== "string" || typeof error.message !== "string") errors.push("failed envelope must have a structured error");
  }
  return errors;
}

function checked(result: CortexRunResult): CortexRunResult {
  const errors = validateCortexEnvelope(result.envelope);
  if (errors.length) throw new Error(`Invalid Cortex response envelope: ${errors.join("; ")}`);
  return result;
}
function envelope(command: string, data: unknown): CortexEnvelope { return { schema: SCHEMA, ok: true, command, data, error: null }; }
function failure(command: string, code: string, message: string): CortexEnvelope { return { schema: SCHEMA, ok: false, command, data: null, error: { code, message } }; }
function ok(command: string, data: unknown): CortexRunResult { return checked({ exitCode: EXIT.OK, envelope: envelope(command, data) }); }
function fail(command: string, exitCode: number, code: string, message: string): CortexRunResult { return checked({ exitCode, envelope: failure(command, code, message) }); }

class IntegrityError extends Error {}
function integrity(message: string): never { throw new IntegrityError(message); }
function isWithin(root: string, path: string): boolean { return path === root || path.startsWith(root + sep); }
function checkedRealpath(path: string, rootReal: string): string {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) integrity(`Canonical path is a symlink: ${path}`);
  const real = realpathSync(path);
  if (!isWithin(rootReal, real)) integrity(`Canonical path escapes root: ${path}`);
  return real;
}
function filesUnder(root: string, corpusRoot: string): string[] {
  if (!existsSync(root)) return [];
  const corpusReal = realpathSync(corpusRoot);
  const rootReal = checkedRealpath(root, corpusReal);
  if (!lstatSync(rootReal).isDirectory()) integrity(`Canonical corpus path is not a directory: ${root}`);
  const files: string[] = [];
  const walk = (dir: string) => {
    const opened = opendirSync(dir);
    try {
      for (let entry = opened.readSync(); entry !== null; entry = opened.readSync()) {
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
        const path = join(dir, entry.name);
        const extension = entry.name.endsWith(".md") || entry.name.endsWith(".jsonl");
        if (entry.isSymbolicLink()) integrity(`Canonical path is a symlink: ${path}`);
        if (extension && !entry.isDirectory() && (!entry.isFile() || !lstatSync(path).isFile())) integrity(`Canonical path is not a regular file: ${path}`);
        checkedRealpath(path, corpusReal);
        if (entry.isDirectory()) walk(path);
        else if (extension) {
          if (files.length >= CANONICAL_CORPUS_LIMITS.MAX_FILES) integrity(`Canonical corpus exceeds file count limit (${CANONICAL_CORPUS_LIMITS.MAX_FILES})`);
          files.push(path);
        }
      }
    } finally { opened.closeSync(); }
  };
  walk(rootReal);
  return files.sort();
}
function scalar(value: string): string { return value.trim().replace(/^[\"']|[\"']$/g, ""); }
function fieldsFromMarkdown(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const fields: Record<string, string> = {};
  if (match) for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (field) fields[field[1]] = scalar(field[2]);
  }
  return fields;
}
function validTimestamp(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2}))?$/);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return false;
  return match[4] === undefined || (Number(match[4]) <= 23 && Number(match[5]) <= 59 && Number(match[6] ?? 0) <= 59);
}
function validateRecord(record: CortexRecord): CortexRecord {
  if (!record.id.trim()) integrity(`Canonical record has an empty ID at ${record.provenance.path}`);
  for (const [name, value] of [["created", record.created], ["updated", record.updated]] as const) if (!validTimestamp(value)) integrity(`Invalid ${name} timestamp for ${record.id}: ${value}`);
  for (const [name, value] of [["valid_from", record.valid_from], ["valid_until", record.valid_until]] as const) if (value != null && !validTimestamp(value)) integrity(`Invalid ${name} timestamp for ${record.id}: ${value}`);
  if (Date.parse(record.updated) < Date.parse(record.created)) integrity(`Canonical record ${record.id} is updated before it was created`);
  if (record.valid_from != null && record.valid_until != null && Date.parse(record.valid_from) >= Date.parse(record.valid_until)) integrity(`Canonical record ${record.id} has an incoherent validity window`);
  return record;
}
function assertCanonicalText(content: string, path: string): void {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(content) || /[\uD800-\uDFFF]/u.test(content)) integrity(`Canonical text contains forbidden control or malformed Unicode at ${path}`);
}
function readCanonicalUtf8(path: string, label: string): string {
  let content: string;
  try { content = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path)); }
  catch { integrity(`Canonical text is not valid UTF-8 at ${label}`); }
  assertCanonicalText(content!, label);
  return content!;
}
function sanitizeContent(content: string, fields: Record<string, string>): string {
  return createCaptureEnvelope({ source: fields.source_kind || fields.source || "canonical", channel: "canonical", timestamps: { captured_at: fields.created || fields.date || fields.ts || new Date(0).toISOString() }, valid_from: fields.valid_from || null, valid_until: fields.valid_until || null, session_id: fields.source_session || null, content }).content;
}
function parseMarkdown(path: string, root: string): CortexRecord {
  const raw = readCanonicalUtf8(path, relative(root, path));
  const preliminary = fieldsFromMarkdown(raw);
  const content = sanitizeContent(raw, preliminary);
  const fields = fieldsFromMarkdown(content);
  const rel = relative(root, path);
  const digest = createHash("sha256").update(rel).digest("hex").slice(0, 16);
  const created = fields.created || fields.date || fields.ts || new Date(0).toISOString();
  return validateRecord({ id: fields.id || `path:${digest}`, type: fields.type || (rel.includes("WORK/") ? "work" : "memory"), title: fields.title || fields.name || rel, created, updated: fields.updated || fields.last_updated || created, provenance: { source: fields.source_kind || fields.source || "canonical", session: fields.source_session || null, path: rel }, content, related: [...content.matchAll(/^\s*-?\s*slug:\s*([^\s#]+).*$/gm)].map((m) => scalar(m[1])), valid_from: fields.valid_from || null, valid_until: fields.valid_until || null });
}
function pinCanonicalRoot(root: string): string {
  if (!existsSync(root)) integrity(`Canonical root does not exist: ${root}`);
  const rootReal = realpathSync(root);
  if (!lstatSync(rootReal).isDirectory()) integrity(`Canonical root is not a directory: ${root}`);
  return rootReal;
}
function canonicalFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const rootReal = pinCanonicalRoot(root);
  const knowledge = join(root, "KNOWLEDGE"), nested = join(root, "MEMORY/KNOWLEDGE");
  if (existsSync(knowledge)) {
    const hot: string[] = [], opened = opendirSync(root);
    try {
      for (let entry = opened.readSync(); entry !== null; entry = opened.readSync()) if (entry.name.endsWith("_MEMORY.md")) {
        const path = join(root, entry.name);
        if (entry.isSymbolicLink() || !entry.isFile()) integrity(`Canonical path is not a regular file: ${path}`);
        checkedRealpath(path, rootReal); hot.push(path);
      }
    } finally { opened.closeSync(); }
    return [...filesUnder(knowledge, root), ...hot].sort();
  }
  if (existsSync(nested)) return filesUnder(nested, root);
  return filesUnder(root, root);
}
export function enumerateCanonicalCorpus(root: string): { root: string; files: string[]; records: CortexRecord[] } {
  const canonicalRoot = pinCanonicalRoot(root);
  const files = canonicalFiles(canonicalRoot), records: CortexRecord[] = [], ids = new Map<string, string>();
  if (files.length > CANONICAL_CORPUS_LIMITS.MAX_FILES) integrity(`Canonical corpus exceeds file count limit (${CANONICAL_CORPUS_LIMITS.MAX_FILES})`);
  let totalBytes = 0;
  for (const path of files) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isFile()) integrity(`Canonical path is not a regular file: ${path}`);
    if (stat.size > CANONICAL_CORPUS_LIMITS.MAX_FILE_BYTES) integrity(`Canonical file exceeds per-file byte limit (${CANONICAL_CORPUS_LIMITS.MAX_FILE_BYTES}): ${relative(canonicalRoot, path)}`);
    totalBytes += stat.size;
    if (totalBytes > CANONICAL_CORPUS_LIMITS.MAX_TOTAL_BYTES) integrity(`Canonical corpus exceeds total byte limit (${CANONICAL_CORPUS_LIMITS.MAX_TOTAL_BYTES})`);
  }
  const addRecord = (record: CortexRecord) => {
    if (records.length >= CANONICAL_CORPUS_LIMITS.MAX_RECORDS) integrity(`Canonical corpus exceeds record count limit (${CANONICAL_CORPUS_LIMITS.MAX_RECORDS})`);
    records.push(record);
  };
  for (const path of files) {
    if (path.endsWith(".md")) addRecord(parseMarkdown(path, canonicalRoot));
    else for (const [index, rawLine] of readCanonicalUtf8(path, relative(canonicalRoot, path)).split(/\r?\n/).entries()) {
      if (!rawLine.trim()) continue;
      const location = `${relative(canonicalRoot, path)}:${index + 1}`;
      assertCanonicalText(rawLine, location);
      const sanitized = sanitizeContent(rawLine, {});
      let row: any;
      try { row = JSON.parse(sanitized); } catch { integrity(`Malformed JSONL at ${location}`); }
      if (!row || typeof row !== "object" || Array.isArray(row)) integrity(`JSONL row must be an object at ${location}`);
      const allowed = new Set(["id","type","title","created","updated","source_kind","source","source_session","content","related","valid_from","valid_until"]);
      if (Object.keys(row).some(key => !allowed.has(key))) integrity(`JSONL row has unknown fields at ${location}`);
      for (const key of ["id","type","title","created","updated","content"] as const) if (typeof row[key] !== "string" || !row[key].trim()) integrity(`JSONL ${key} must be a non-empty string at ${location}`);
      for (const key of ["source_kind","source"] as const) if (row[key] !== undefined && (typeof row[key] !== "string" || !row[key].trim())) integrity(`JSONL ${key} must be a non-empty string at ${location}`);
      if (row.source_session !== undefined && row.source_session !== null && typeof row.source_session !== "string") integrity(`JSONL source_session must be a string or null at ${location}`);
      if (row.related !== undefined && (!Array.isArray(row.related) || row.related.some((id: unknown) => typeof id !== "string" || !id.trim()))) integrity(`JSONL related must contain only non-empty string IDs at ${location}`);
      if (row.valid_from != null && typeof row.valid_from !== "string") integrity(`JSONL valid_from must be a string at ${location}`);
      if (row.valid_until != null && typeof row.valid_until !== "string") integrity(`JSONL valid_until must be a string at ${location}`);
      for (const value of Object.values(row)) if (typeof value === "string") assertCanonicalText(value, location);
      for (const id of row.related ?? []) assertCanonicalText(id, location);
      addRecord(validateRecord({ id: row.id, type: row.type, title: row.title, created: row.created, updated: row.updated, provenance: { source: row.source_kind ?? row.source ?? "canonical", session: row.source_session ?? null, path: relative(canonicalRoot, path) }, content: sanitizeContent(row.content, row), related: row.related ?? [], valid_from: row.valid_from ?? null, valid_until: row.valid_until ?? null }));
    }
  }
  for (const record of records) { const prior = ids.get(record.id); if (prior) integrity(`Duplicate canonical ID ${record.id}: ${prior} and ${record.provenance.path}`); ids.set(record.id, record.provenance.path); }
  return { root: canonicalRoot, files, records };
}
export function loadCanonicalRecords(root: string): CortexRecord[] { return enumerateCanonicalCorpus(root).records; }

type Parsed = { command: string; options: Map<string, string | true>; positionals: string[] };
const VALUE_OPTIONS = new Set(["--memory-root", "--adapter", "--type", "--source", "--session", "--from", "--to", "--page", "--page-size", "--recency", "--expand", "--max-nodes", "--max-tokens", "--anchor", "--before", "--after"]);
const BOOL_OPTIONS = new Set(["--allow-write", "--from-canonical"]);
const ALLOWED: Record<string, Set<string>> = {
  status: new Set(["--memory-root", "--adapter"]),
  search: new Set(["--memory-root", "--adapter", "--type", "--source", "--session", "--from", "--to", "--page", "--page-size", "--recency", "--expand", "--max-nodes", "--max-tokens"]),
  timeline: new Set(["--memory-root", "--adapter", "--type", "--source", "--session", "--from", "--to", "--page", "--page-size", "--anchor", "--before", "--after"]),
  get: new Set(["--memory-root", "--adapter"]), export: new Set(["--memory-root", "--adapter"]),
  // Writes go through MemorySystem.add, which has fixed paths and never reads a
  // memory root, so --memory-root is refused here rather than silently ignored.
  remember: new Set(["--adapter", "--allow-write"]), propose: new Set(["--adapter", "--allow-write"]),
  rebuild: new Set(["--memory-root", "--adapter", "--from-canonical"]),
};
function parseArguments(args: string[]): Parsed | string {
  const command = args[0] ?? "";
  if (!COMMANDS.has(command)) return `Unknown command: ${command || "(missing)"}`;
  const options = new Map<string, string | true>(), positionals: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) { positionals.push(arg); continue; }
    if (!ALLOWED[command].has(arg) || (!VALUE_OPTIONS.has(arg) && !BOOL_OPTIONS.has(arg))) return `Unknown option for ${command}: ${arg}`;
    if (options.has(arg)) return `Duplicate option: ${arg}`;
    if (BOOL_OPTIONS.has(arg)) options.set(arg, true);
    else { const value = args[++i]; if (!value || value.startsWith("--")) return `Missing value for ${arg}`; options.set(arg, value); }
  }
  const adapter = options.get("--adapter");
  if (adapter !== undefined && (typeof adapter !== "string" || !ADAPTERS.has(adapter))) return `--adapter must be one of: ${[...ADAPTERS].join(", ")}`;
  return { command, options, positionals };
}
function opt(parsed: Parsed, name: string): string | undefined { const value = parsed.options.get(name); return typeof value === "string" ? value : undefined; }
function positiveInt(value: string | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER): number | null { if (value === undefined) return fallback; const n = Number(value); return Number.isInteger(n) && n > 0 && n <= max ? n : null; }
function nonNegativeInt(value: string | undefined, fallback: number): number | null { if (value === undefined) return fallback; const n = Number(value); return Number.isInteger(n) && n >= 0 && n <= LIMITS.PAGE_SIZE ? n : null; }
export function toCortexCard(record: CortexRecord, score: number): CortexCard { return { id: record.id, type: record.type, created: record.created, updated: record.updated, provenance: record.provenance, score: Number(score.toFixed(6)), est_tokens: Math.ceil(record.content.length / 4) }; }
function terms(text: string): string[] { return text.toLowerCase().match(/[a-z0-9]+/g) ?? []; }
export function rankBM25(records: CortexRecord[], query: string): Array<{ record: CortexRecord; score: number }> {
  const queryTerms = [...new Set(terms(query))], df = new Map(queryTerms.map((term) => [term, 0]));
  let totalLength = 0;
  for (const record of records) { const words = terms(`${record.title} ${record.content}`); totalLength += words.length; const present = new Set(words); for (const term of queryTerms) if (present.has(term)) df.set(term, (df.get(term) ?? 0) + 1); }
  const avg = totalLength / Math.max(1, records.length), n = records.length;
  return records.map((record) => {
    const words = terms(`${record.title} ${record.content}`), frequencies = new Map<string, number>();
    for (const word of words) if (df.has(word)) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) { const tf = frequencies.get(term) ?? 0; if (!tf) continue; const idf = Math.log(1 + (n - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5)); score += idf * tf * 2.5 / (tf + 1.5 * (0.25 + 0.75 * words.length / Math.max(1, avg))); }
    return { record, score };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));
}
export const rankCanonicalCorpus = rankBM25;
export function activeCortexCards(records: CortexRecord[], now = new Date()): CortexCard[] { return activeCortexRecords(records, now).map(record => toCortexCard(record, 0)); }
export function activeCortexRecords(records: CortexRecord[], now = new Date()): CortexRecord[] { return records.filter((record) => isEnvelopeValidAt({ source: record.provenance.source, channel: "canonical", timestamps: { captured_at: record.created }, valid_from: record.valid_from, valid_until: record.valid_until, session_id: record.provenance.session, content: record.content }, now)); }
export interface RecordFilters { type?: string; source?: string; session?: string; from?: string; to?: string }
/**
 * Apply the listing filters to a record set.
 *
 * Presence, never truthiness. `--type ""` is a filter the caller asked for and
 * nothing matches it; the previous `!type || …` form dropped the clause instead
 * and silently WIDENED the result set to everything. Same class Honcho fixed in
 * #881/#882, where empty membership lists failed open in their filter builders.
 */
export function applyRecordFilters(records: CortexRecord[], f: RecordFilters): CortexRecord[] {
  return records.filter((r) =>
    (f.type === undefined || r.type === f.type) &&
    (f.source === undefined || r.provenance.source === f.source) &&
    (f.session === undefined || r.provenance.session === f.session) &&
    (f.from === undefined || Date.parse(r.created) >= Date.parse(f.from)) &&
    (f.to === undefined || Date.parse(r.created) <= Date.parse(f.to)));
}
function filtered(records: CortexRecord[], parsed: Parsed): CortexRecord[] | null {
  const type=opt(parsed,"--type"), source=opt(parsed,"--source"), session=opt(parsed,"--session"), from=opt(parsed,"--from"), to=opt(parsed,"--to");
  if ((from !== undefined && !validTimestamp(from)) || (to !== undefined && !validTimestamp(to))) return null;
  return applyRecordFilters(records, { type, source, session, from, to });
}
function paged(items: CortexCard[], parsed: Parsed) { const page=positiveInt(opt(parsed,"--page"),1), size=positiveInt(opt(parsed,"--page-size"),10,LIMITS.PAGE_SIZE); return page===null||size===null?null:{items:items.slice((page-1)*size,page*size),total:items.length,page,page_size:size}; }
function expandGraph(records: CortexRecord[], startId: string, maxNodes: number, maxTokens: number) { const byId=new Map(records.map(r=>[r.id,r])); const start=byId.get(startId); if(!start)return null; const queue=[start],seen=new Set<string>(),items:CortexCard[]=[];let est=0;while(queue.length&&items.length<maxNodes){const current=queue.shift()!;if(seen.has(current.id))continue;seen.add(current.id);const next=toCortexCard(current,0);if(est+next.est_tokens>maxTokens)break;items.push(next);est+=next.est_tokens;for(const id of current.related){const linked=byId.get(id);if(linked&&!seen.has(id))queue.push(linked);}}return{items,est_tokens:est,truncated:queue.length>0}; }
export function canonicalCorpusDigest(records: CortexRecord[]): string { const normalized=records.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(r=>({id:r.id,type:r.type,title:r.title,created:r.created,updated:r.updated,provenance:r.provenance,content:r.content,related:r.related,valid_from:r.valid_from??null,valid_until:r.valid_until??null})); return createHash("sha256").update(JSON.stringify(normalized)).digest("hex"); }

export async function runCortex(args: string[], runtime: CortexRuntime = {}): Promise<CortexRunResult> {
  const command = args[0] ?? "";
  const parsedResult = parseArguments(args);
  if (typeof parsedResult === "string") return fail(command, EXIT.INVALID_INPUT, "invalid_input", parsedResult);
  const parsed = parsedResult;
  if ((command === "remember" || command === "propose")) {
    const adapter = opt(parsed, "--adapter");
    // Same rule for the in-process seam: a runtime memoryRoot cannot redirect a write
    // (MemorySystem.add has fixed paths), so refuse it unless the caller also supplies memoryAdd.
    if (runtime.memoryRoot !== undefined && !runtime.memoryAdd) return fail(command, EXIT.INVALID_INPUT, "invalid_input", `${command} does not support a memory root; writes use the install's fixed memory paths`);
    if (!adapter || !parsed.options.has("--allow-write")) return fail(command, EXIT.WRITE_REFUSED, "write_refused", "Write commands require explicit --adapter and --allow-write");
    if (parsed.positionals.length !== 1) return fail(command, EXIT.INVALID_INPUT, "invalid_input", "Write command requires exactly one JSON payload");
    const raw=parsed.positionals[0]; if(Buffer.byteLength(raw)>LIMITS.WRITE_BYTES)return fail(command,EXIT.INVALID_INPUT,"invalid_input",`Write payload exceeds ${LIMITS.WRITE_BYTES} bytes`);
    let item:any;try{item=JSON.parse(raw);}catch{return fail(command,EXIT.INVALID_INPUT,"invalid_input","Write payload must be valid JSON");}
    const durableTypes = new Set(["memory", "idea", "knowledge"]);
    if ((command === "propose" && item?.type !== "proposal") || (command === "remember" && !durableTypes.has(item?.type))) return fail(command, EXIT.WRITE_REFUSED, "write_refused", `${command} payload type is not authorized for this command`);
    const memoryAdd=runtime.memoryAdd??(await import("./MemorySystem")).add; const result=memoryAdd(item);
    if(!result?.ok)return fail(command,EXIT.WRITE_REFUSED,"governance_refused",String(result?.message??result?.code??"MemorySystem refused write"));
    return ok(command,{adapter,result});
  }
  if(command==="status"&&parsed.positionals.length) return fail(command,EXIT.INVALID_INPUT,"invalid_input","status accepts no positional arguments");
  if(command==="rebuild"&&(!parsed.options.has("--from-canonical")||parsed.positionals.length)) return fail(command,EXIT.INVALID_INPUT,"invalid_input","rebuild requires --from-canonical");
  if(command==="search"&&parsed.positionals.length!==1) return fail(command,EXIT.INVALID_INPUT,"invalid_input","search requires exactly one query");
  if(command==="timeline"&&parsed.positionals.length) return fail(command,EXIT.INVALID_INPUT,"invalid_input","timeline accepts no positional arguments");
  if((command==="get"||command==="export")&&(parsed.positionals.length===0||parsed.positionals.length>LIMITS.IDS)) return fail(command,EXIT.INVALID_INPUT,"invalid_input",`${command} requires one or more explicit IDs (maximum ${LIMITS.IDS})`);
  const requestedRoot=resolve(runtime.memoryRoot??opt(parsed,"--memory-root")??process.env.CORTEX_MEMORY_ROOT??lifeosPath("MEMORY"));
  let memoryRoot=requestedRoot, records:CortexRecord[];try{const corpus=enumerateCanonicalCorpus(requestedRoot);memoryRoot=corpus.root;records=corpus.records;}catch(error){if(error instanceof IntegrityError)return fail(command,EXIT.INVALID_INPUT,"integrity_error",error.message);return fail(command,EXIT.INTERNAL,"internal_error",error instanceof Error?error.message:String(error));}
  if(command==="status")return ok(command,{canonical:{root:memoryRoot,records:records.length},mode:"local-read-only",indexes:[]});
  if(command==="rebuild"){const canonical=canonicalCorpusDigest(records);const rebuilt=canonicalCorpusDigest(JSON.parse(JSON.stringify(records)));return ok(command,{format:"lifeos-cortex-canonical-rebuild/v1",canonical_digest:canonical,rebuilt_digest:rebuilt,equivalent:canonical===rebuilt,records:records.length,indexes:[]});}
  const validRecords=activeCortexRecords(records);
  if(command==="search"){
    const query=parsed.positionals[0];const queryTerms=terms(query);if(query.length>LIMITS.QUERY_CHARS||queryTerms.length>LIMITS.QUERY_TERMS||!queryTerms.length)return fail(command,EXIT.INVALID_INPUT,"invalid_input","Query exceeds length/term limits or has no searchable terms");
    const narrowed=filtered(validRecords,parsed);if(!narrowed)return fail(command,EXIT.INVALID_INPUT,"invalid_input","Invalid date filter");
    const recency=Number(opt(parsed,"--recency")??0);if(!Number.isFinite(recency)||recency<0)return fail(command,EXIT.INVALID_INPUT,"invalid_input","--recency must be non-negative");
    const ranked=rankBM25(narrowed,query).sort((a,b)=>(b.score+recency*Date.parse(b.record.updated)/1e13)-(a.score+recency*Date.parse(a.record.updated)/1e13)||a.record.id.localeCompare(b.record.id)).map(row=>toCortexCard(row.record,row.score+recency*Date.parse(row.record.updated)/1e13));
    const page=paged(ranked,parsed);if(!page)return fail(command,EXIT.INVALID_INPUT,"invalid_input",`page must be positive and page-size at most ${LIMITS.PAGE_SIZE}`);
    const expand=opt(parsed,"--expand");if(expand){const nodes=positiveInt(opt(parsed,"--max-nodes"),10,LIMITS.GRAPH_NODES),tokens=positiveInt(opt(parsed,"--max-tokens"),2000,LIMITS.GRAPH_TOKENS);if(nodes===null||tokens===null)return fail(command,EXIT.INVALID_INPUT,"invalid_input","graph budgets exceed limits");const expansion=expandGraph(validRecords,expand,nodes,tokens);if(!expansion)return fail(command,EXIT.NOT_FOUND,"not_found",`Expansion root not found: ${expand}`);return ok(command,{...page,expansion});}return ok(command,page);
  }
  if(command==="timeline"){
    const anchorValue=opt(parsed,"--anchor");if(!anchorValue)return fail(command,EXIT.INVALID_INPUT,"invalid_input","timeline requires --anchor ID-or-date");const narrowed=filtered(validRecords,parsed);if(!narrowed)return fail(command,EXIT.INVALID_INPUT,"invalid_input","Invalid date filter");const before=nonNegativeInt(opt(parsed,"--before"),5),after=nonNegativeInt(opt(parsed,"--after"),5);if(before===null||after===null)return fail(command,EXIT.INVALID_INPUT,"invalid_input","before and after must be bounded non-negative integers");const ordered=narrowed.slice().sort((a,b)=>Date.parse(a.created)-Date.parse(b.created)||a.id.localeCompare(b.id));const byId=new Map(validRecords.map(r=>[r.id,r]));const anchorRecord=byId.get(anchorValue);if(!anchorRecord&&!validTimestamp(anchorValue))return fail(command,EXIT.NOT_FOUND,"not_found",`Timeline anchor not found: ${anchorValue}`);const anchorDate=anchorRecord?.created??new Date(Date.parse(anchorValue)).toISOString();const prior=ordered.filter(r=>Date.parse(r.created)<Date.parse(anchorDate)).slice(-before),center=anchorRecord&&ordered.some(r=>r.id===anchorRecord.id)?[anchorRecord]:[],later=ordered.filter(r=>Date.parse(r.created)>Date.parse(anchorDate)).slice(0,after);const page=paged([...prior,...center,...later].map(r=>toCortexCard(r,0)),parsed);if(!page)return fail(command,EXIT.INVALID_INPUT,"invalid_input","invalid page");return ok(command,{...page,anchor:{id:anchorRecord?.id??null,date:anchorDate}});
  }
  const byId=new Map(validRecords.map(r=>[r.id,r]));const chosen=parsed.positionals.map(id=>byId.get(id)).filter((r):r is CortexRecord=>Boolean(r));if(chosen.length!==parsed.positionals.length)return fail(command,EXIT.NOT_FOUND,"not_found","One or more records were not found");return ok(command,{format:"lifeos-cortex-export/v1",items:chosen});
}

async function main(){const result=await runCortex(process.argv.slice(2));process.stdout.write(JSON.stringify(result.envelope)+"\n");process.exit(result.exitCode);}
if(import.meta.main||resolve(process.argv[1]??"")===resolve(import.meta.path))await main();
