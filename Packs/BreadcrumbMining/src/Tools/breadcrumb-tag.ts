#!/usr/bin/env bun

/**
 * breadcrumb-tag — Quick-capture a breadcrumb during a live session
 *
 * Usage:
 *   breadcrumb-tag "I just realized the flinch IS the signal"
 *   breadcrumb-tag "eureka: voice profiles are the moat" --category product-idea
 *   breadcrumb-tag --review                                Show recent breadcrumbs
 *   breadcrumb-tag --review --last 7                       Show last 7 days
 *
 * Appends to ~/.claude/breadcrumbs.md with timestamp and auto-categorization.
 * Designed for speed — capture the insight before it fades.
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// --- Config ---
const DEFAULT_FILE = join(process.env.HOME || "/root", ".claude", "breadcrumbs.md");

// --- Category patterns (same as breadcrumb-mine) ---
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(heal|healing|trauma|recovery|sobriety|nervous system)\b/i, category: "healing" },
  { pattern: /\b(flow|flow state|deep work|focus|zone)\b/i, category: "flow-protocol" },
  { pattern: /\b(body|somatic|gut|chest|heartbeat|HR|HRV)\b/i, category: "somatic-observation" },
  { pattern: /\b(identity|who I am|self|persona|authentic)\b/i, category: "identity" },
  { pattern: /\b(product|tool|build|ship|launch|MVP|revenue)\b/i, category: "product-idea" },
  { pattern: /\b(career|job|work|employer|quit|leave)\b/i, category: "career" },
  { pattern: /\b(relationship|partner|wife|husband|friend|family)\b/i, category: "relationship" },
  { pattern: /\b(AI|model|prompt|agent|LLM|Claude|GPT)\b/i, category: "ai-insight" },
  { pattern: /\b(sacred|timeline|milestone|turning point|era)\b/i, category: "sacred-timeline" },
  { pattern: /\b(pattern|architecture|system|framework|structure)\b/i, category: "insight" },
];

// --- Tag detection ---
const TAG_PATTERNS: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /\beureka\b/i, tag: "eureka" },
  { pattern: /\bholy shit\b/i, tag: "holy-shit" },
  { pattern: /\bremember this\b/i, tag: "remember-this" },
  { pattern: /\bbookmark\b/i, tag: "bookmark" },
  { pattern: /\bfuture me\b/i, tag: "future-me" },
  { pattern: /\bjust realized\b/i, tag: "realization" },
  { pattern: /\bbreakthrough\b/i, tag: "breakthrough" },
  { pattern: /\bturning point\b/i, tag: "turning-point" },
  { pattern: /\bintegration\b/i, tag: "integration" },
];

// --- Parse args ---
const args = process.argv.slice(2);
const reviewMode = args.includes("--review");
const filePath = (() => {
  const idx = args.indexOf("--file");
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : DEFAULT_FILE;
})();
const explicitCategory = (() => {
  const idx = args.indexOf("--category");
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
})();
const lastDays = (() => {
  const idx = args.indexOf("--last");
  return idx !== -1 && idx + 1 < args.length ? parseInt(args[idx + 1]) : 30;
})();

// Get the breadcrumb text (everything that's not a flag)
const flagArgs = new Set(["--review", "--file", "--category", "--last", "--json", "--verbose"]);
const breadcrumbText = args.filter((a, i) => {
  if (flagArgs.has(a)) return false;
  if (i > 0 && flagArgs.has(args[i - 1])) return false;
  return !a.startsWith("--");
}).join(" ").trim();

// --- Review mode ---
function review() {
  if (!existsSync(filePath)) {
    console.log(`  No breadcrumbs yet. Start tagging with: breadcrumb-tag "your insight"`);
    process.exit(0);
  }

  const content = readFileSync(filePath, "utf-8");
  const entries = content.split("\n---\n").filter(e => e.trim());

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lastDays);

  let shown = 0;
  console.log();
  console.log(`  Recent breadcrumbs (last ${lastDays} days):`);
  console.log(`  ${"─".repeat(40)}`);

  for (const entry of entries.reverse()) {
    // Extract date from entry
    const dateMatch = entry.match(/\*\*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const entryDate = new Date(dateMatch[1]);
      if (entryDate < cutoff) continue;
    }

    console.log(entry.trim());
    console.log("  ---");
    shown++;

    if (shown >= 20) {
      console.log(`  ... and ${entries.length - 20} more`);
      break;
    }
  }

  if (shown === 0) {
    console.log(`  No breadcrumbs in the last ${lastDays} days.`);
  }

  console.log();
  console.log(`  Total breadcrumbs on file: ${entries.length}`);
  console.log();
}

// --- Tag mode ---
function tag() {
  if (!breadcrumbText) {
    console.error(`
  breadcrumb-tag — quick-capture an insight

  Usage:
    breadcrumb-tag "your insight here"                    Tag an insight
    breadcrumb-tag "eureka: the moat is the corpus"       Auto-detected tag
    breadcrumb-tag "voice profiles" --category product    Explicit category
    breadcrumb-tag --review                               Show recent breadcrumbs
    breadcrumb-tag --review --last 7                      Show last 7 days

  The faster you capture, the less you lose.
    `);
    process.exit(1);
  }

  // Ensure file directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Initialize file if needed
  if (!existsSync(filePath)) {
    appendFileSync(filePath, `# Breadcrumbs\n\nTagged insights captured in real time. Mine later with breadcrumb-mine.\n\n`);
  }

  // Auto-detect tag
  let detectedTag = "insight"; // default
  for (const tp of TAG_PATTERNS) {
    if (tp.pattern.test(breadcrumbText)) {
      detectedTag = tp.tag;
      break;
    }
  }

  // Auto-detect category
  let category = explicitCategory || "insight";
  if (!explicitCategory) {
    for (const cp of CATEGORY_PATTERNS) {
      if (cp.pattern.test(breadcrumbText)) {
        category = cp.category;
        break;
      }
    }
  }

  // Format entry
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].substring(0, 5);

  const entry = `\n---\n**${dateStr} ${timeStr}** | [${detectedTag}] | ${category}\n${breadcrumbText}\n`;

  appendFileSync(filePath, entry);

  console.log();
  console.log(`  Tagged: [${detectedTag}] ${category}`);
  console.log(`  "${breadcrumbText.substring(0, 80)}${breadcrumbText.length > 80 ? "..." : ""}"`);
  console.log(`  Saved to: ${filePath}`);
  console.log();
}

// --- Main ---
if (reviewMode) {
  review();
} else {
  tag();
}
