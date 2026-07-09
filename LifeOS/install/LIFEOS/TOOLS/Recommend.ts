#!/usr/bin/env bun

/**
 * Recommend — recency-aware picker for restaurants, movies, books.
 *
 * Per plan §7 and §15.7: called as a CLI (not import) from the briefing composer
 * and from voice queries. Returns JSON or human-readable pick respecting recency,
 * cuisine/genre match, rating, blocklist.
 *
 * Usage:
 *   bun Recommend.ts --category restaurant [--cuisine thai] [--not-visited 30d]
 *   bun Recommend.ts --category movie [--genre sci-fi] [--not-watched 90d]
 *   bun Recommend.ts --category book [--theme philosophy]
 *   bun Recommend.ts --json (add to any command for JSON output)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const TELOS_DIR = join(LIFEOS_DIR, "USER", "TELOS");
const CURRENT_DIR = join(TELOS_DIR, "CURRENT_STATE");

type Category = "restaurant" | "movie" | "book";

type Candidate = {
  name: string;
  attrs: Record<string, unknown>;
  last_consumed?: string;
  days_since?: number;
  rating?: number;
  source_file: string;
  confidence: number;
  confidence_note?: string;
};

function readIf(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

function parseRecencyDays(input?: string): number | null {
  if (!input) return null;
  const m = input.match(/^(\d+)\s*d?$/i);
  if (!m) return null;
  return Number(m[1]);
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// Simple YAML-ish line parser for `name: "X"` / `cuisine: thai` / etc.
function parseEntries(markdown: string): Array<Record<string, string>> {
  const entries: Array<Record<string, string>> = [];
  let current: Record<string, string> = {};
  for (const line of markdown.split("\n")) {
    const nameMatch = line.match(/^\s*-\s+name:\s*"?([^"]+)"?\s*$/);
    const attrMatch = line.match(/^\s+(\w+):\s*"?([^"]+)"?\s*$/);
    if (nameMatch) {
      if (Object.keys(current).length) entries.push(current);
      current = { name: nameMatch[1] };
    } else if (attrMatch && Object.keys(current).length) {
      current[attrMatch[1]] = attrMatch[2];
    }
  }
  if (Object.keys(current).length) entries.push(current);
  return entries;
}

function loadCandidates(category: Category): Candidate[] {
  if (category === "restaurant") {
    const prefs = parseEntries(readIf(join(TELOS_DIR, "RESTAURANTS.md")));
    const consumption = parseEntries(readIf(join(CURRENT_DIR, "CONSUMPTION.md")));
    const blocklist = new Set(
      parseEntries(
        readIf(join(TELOS_DIR, "RESTAURANTS.md")).split("## Blocklist")[1] || ""
      ).map((e) => e.name.toLowerCase())
    );
    return prefs
      .filter((p) => !blocklist.has(p.name.toLowerCase()))
      .map((p) => {
        const visit = consumption.find(
          (c) => c.name?.toLowerCase() === p.name.toLowerCase() && c.category === "restaurant"
        );
        return {
          name: p.name,
          attrs: p,
          last_consumed: visit?.visited,
          days_since: visit?.visited ? daysSince(visit.visited) : undefined,
          rating: p.rating ? Number(p.rating) : undefined,
          source_file: "TELOS/RESTAURANTS.md",
          confidence: 0.8,
        };
      });
  }
  if (category === "movie") {
    const prefs = parseEntries(readIf(join(TELOS_DIR, "MOVIES.md")));
    const consumption = parseEntries(readIf(join(CURRENT_DIR, "CONSUMPTION.md")));
    return prefs.map((p) => {
      const seen = consumption.find(
        (c) => c.title?.toLowerCase() === p.title?.toLowerCase() && c.category === "movie"
      );
      return {
        name: p.title || p.name,
        attrs: p,
        last_consumed: seen?.watched,
        days_since: seen?.watched ? daysSince(seen.watched) : undefined,
        rating: p.rating ? Number(p.rating) : undefined,
        source_file: "TELOS/MOVIES.md",
        confidence: 0.75,
      };
    });
  }
  // book
  const prefs = parseEntries(readIf(join(TELOS_DIR, "BOOKS.md")));
  return prefs.map((p) => ({
    name: p.title || p.name,
    attrs: p,
    rating: p.rating ? Number(p.rating) : undefined,
    source_file: "TELOS/BOOKS.md",
    confidence: 0.7,
  }));
}

function rank(candidates: Candidate[], opts: {
  cuisine?: string;
  genre?: string;
  theme?: string;
  notVisitedDays?: number | null;
}): Candidate[] {
  let filtered = candidates;

  if (opts.cuisine) {
    filtered = filtered.filter((c) => (c.attrs.cuisine as string)?.toLowerCase() === opts.cuisine?.toLowerCase());
  }
  if (opts.genre) {
    filtered = filtered.filter((c) => (c.attrs.genre as string)?.toLowerCase().includes(opts.genre?.toLowerCase() || ""));
  }
  if (opts.theme) {
    filtered = filtered.filter((c) => (c.attrs.themes as string)?.toLowerCase().includes(opts.theme?.toLowerCase() || ""));
  }
  if (opts.notVisitedDays != null) {
    const n = opts.notVisitedDays;
    filtered = filtered.filter((c) => c.days_since == null || c.days_since >= n);
  }

  // Adjust confidence: filter specificity drops confidence if match set is tiny
  const withConfidence = filtered.map((c) => ({
    ...c,
    confidence: filtered.length === 0 ? 0 : Math.max(0.3, c.confidence - (opts.cuisine ? 0.05 : 0) - (opts.notVisitedDays != null ? 0.05 : 0)),
    confidence_note: filtered.length < 3 ? "Narrow candidate pool — low confidence" : undefined,
  }));

  return withConfidence.sort((a, b) => {
    const ra = a.rating || 5;
    const rb = b.rating || 5;
    if (rb !== ra) return rb - ra;
    const da = a.days_since || Infinity;
    const db = b.days_since || Infinity;
    return db - da;
  });
}

// ─── Main ───

const args = process.argv.slice(2);
const catIdx = args.indexOf("--category");
if (catIdx === -1) {
  console.error("Required: --category restaurant|movie|book");
  process.exit(1);
}
const category = args[catIdx + 1] as Category;
if (!["restaurant", "movie", "book"].includes(category)) {
  console.error("Invalid category. Choose: restaurant, movie, book");
  process.exit(1);
}

const cuisineIdx = args.indexOf("--cuisine");
const genreIdx = args.indexOf("--genre");
const themeIdx = args.indexOf("--theme");
const notVisitedIdx = args.indexOf("--not-visited");
const notWatchedIdx = args.indexOf("--not-watched");

const opts = {
  cuisine: cuisineIdx !== -1 ? args[cuisineIdx + 1] : undefined,
  genre: genreIdx !== -1 ? args[genreIdx + 1] : undefined,
  theme: themeIdx !== -1 ? args[themeIdx + 1] : undefined,
  notVisitedDays: parseRecencyDays(args[notVisitedIdx + 1] || args[notWatchedIdx + 1]),
};

const candidates = loadCandidates(category);
const ranked = rank(candidates, opts);

if (args.includes("--json")) {
  console.log(JSON.stringify(ranked.slice(0, 5), null, 2));
} else {
  if (ranked.length === 0) {
    console.log(`No candidates match. Preference file may be unseeded — run the interview.`);
    process.exit(0);
  }
  const top = ranked[0];
  console.log(`🎯 Recommend: ${top.name}`);
  if (top.attrs.cuisine) console.log(`   Cuisine: ${top.attrs.cuisine}`);
  if (top.attrs.location) console.log(`   Location: ${top.attrs.location}`);
  if (top.rating) console.log(`   Rating: ${top.rating}`);
  if (top.days_since != null) console.log(`   Last: ${top.days_since}d ago`);
  else console.log(`   Last: never (or not tracked)`);
  console.log(`   Confidence: ${Math.round(top.confidence * 100)}%`);
  if (top.confidence_note) console.log(`   Note: ${top.confidence_note}`);
  if (ranked.length > 1) {
    console.log(`\nAlso: ${ranked.slice(1, 4).map((c) => c.name).join(", ")}`);
  }
}
