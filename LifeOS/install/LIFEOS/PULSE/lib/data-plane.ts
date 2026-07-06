import { readFileSync, existsSync, statSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { paiRoot } from "./manifest-loader";
import { atomicWriteJSON } from "./atomic-write";
import type { PageData, PageMeta, Provenance } from "../Schema/PulseSchema";
import { getClaudeDir } from "../../TOOLS/Paths";

export const PULSE_DATA_DIR = resolve(getClaudeDir(), "LIFEOS", "MEMORY", "PULSE_DATA");

export interface DataPlaneFile {
  schemaVersion: string;
  data: PageData;
  _meta: PageMeta;
}

export interface IndexEntry {
  id: string;
  title: string;
  kind: string;
  lastBuildAt: string;
  hasError: boolean;
  costUSD: number;
  provenance: Provenance;
  staleSinceHours?: number;
}

export interface DataPlaneIndex {
  schemaVersion: string;
  generatedAt: string;
  pages: IndexEntry[];
}

export function pagePath(id: string): string {
  return join(PULSE_DATA_DIR, `${id}.json`);
}

export function metaPath(id: string): string {
  return join(PULSE_DATA_DIR, `${id}.meta.json`);
}

export function errorPath(id: string): string {
  return join(PULSE_DATA_DIR, `${id}.error.json`);
}

export function indexPath(): string {
  return join(PULSE_DATA_DIR, "_index.json");
}

export function readPage(id: string): DataPlaneFile | null {
  const p = pagePath(id);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as DataPlaneFile;
}

export function readMeta(id: string): PageMeta | null {
  const p = metaPath(id);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as PageMeta;
}

export function writePage(id: string, file: DataPlaneFile): void {
  atomicWriteJSON(pagePath(id), file);
  atomicWriteJSON(metaPath(id), file._meta);
}

export function writeError(id: string, error: { kind: string; message: string; details?: unknown }): void {
  atomicWriteJSON(errorPath(id), {
    schemaVersion: "1.0.0",
    pageId: id,
    occurredAt: new Date().toISOString(),
    ...error,
  });
}

export function clearError(id: string): void {
  const p = errorPath(id);
  if (existsSync(p)) {
    try { unlinkSync(p); } catch { /* ignore */ }
  }
}

export function isStale(id: string, staleAfterHours: number | undefined): { stale: boolean; ageHours: number } | null {
  if (!staleAfterHours) return null;
  const p = metaPath(id);
  if (!existsSync(p)) return { stale: true, ageHours: Infinity };
  const ageMs = Date.now() - statSync(p).mtimeMs;
  const ageHours = ageMs / (1000 * 60 * 60);
  return { stale: ageHours > staleAfterHours, ageHours };
}

export function writeIndex(entries: IndexEntry[]): void {
  const idx: DataPlaneIndex = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    pages: entries.sort((a, b) => a.id.localeCompare(b.id)),
  };
  atomicWriteJSON(indexPath(), idx);
}

export function readIndex(): DataPlaneIndex | null {
  const p = indexPath();
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as DataPlaneIndex;
}

void paiRoot;
