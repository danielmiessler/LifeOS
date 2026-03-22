#!/usr/bin/env bun

/**
 * breadcrumb-mine — Mine tagged insights from AI conversation history
 *
 * Usage:
 *   breadcrumb-mine --dir ~/ChatGPT/split_chats/       Mine ChatGPT JSON exports
 *   breadcrumb-mine --dir ~/conversations/ --format md  Mine markdown files
 *   breadcrumb-mine --dir ~/chats/ --tags "eureka,holy shit,remember this"
 *   breadcrumb-mine --dir ~/chats/ --out breadcrumbs.md Custom output
 *   breadcrumb-mine --dir ~/chats/ --verbose            Show full context
 *   breadcrumb-mine --dir ~/chats/ --json               Raw JSON output
 *
 * Supported formats: ChatGPT JSON (.json), Claude JSONL (.jsonl), Markdown (.md/.txt)
 *
 * Output: Categorized index of tagged insights with surrounding context.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, extname, basename } from "path";

// --- Default tag patterns ---
// These are the natural breakthrough language patterns people use when something clicks.
// Users can override with --tags
const DEFAULT_TAGS: Array<{ pattern: RegExp; label: string; weight: number }> = [
  // Explicit tagging
  { pattern: /\beureka\b/i, label: "eureka", weight: 10 },
  { pattern: /\bremember this\b/i, label: "remember-this", weight: 10 },
  { pattern: /\bbookmark this\b/i, label: "bookmark", weight: 10 },
  { pattern: /\bfuture me\b/i, label: "future-me", weight: 10 },
  { pattern: /\bsave this\b/i, label: "save-this", weight: 8 },
  { pattern: /\bnote to self\b/i, label: "note-to-self", weight: 8 },

  // Natural breakthrough language
  { pattern: /\bholy shit\b/i, label: "holy-shit", weight: 9 },
  { pattern: /\bI just realized\b/i, label: "realization", weight: 9 },
  { pattern: /\bthis changes everything\b/i, label: "paradigm-shift", weight: 9 },
  { pattern: /\bwhy didn'?t I see (this|that|it)\b/i, label: "blind-spot", weight: 8 },
  { pattern: /\bsomething just clicked\b/i, label: "clicked", weight: 8 },
  { pattern: /\boh my god\b/i, label: "omg", weight: 7 },
  { pattern: /\bwait,?\s+(what|hold on|a minute|a second)\b/i, label: "wait-moment", weight: 6 },
  { pattern: /\bthat'?s it\b[.!]/i, label: "thats-it", weight: 7 },
  { pattern: /\bthis is (huge|big|important|significant)\b/i, label: "significance", weight: 7 },

  // Integration / insight language
  { pattern: /\bintegration event\b/i, label: "integration", weight: 9 },
  { pattern: /\bturning point\b/i, label: "turning-point", weight: 8 },
  { pattern: /\bbreakthrough\b/i, label: "breakthrough", weight: 7 },
  { pattern: /\bpattern[: ]/i, label: "pattern-id", weight: 5 },
  { pattern: /\bI'?ve been (wrong|blind|missing)\b/i, label: "correction", weight: 8 },
  { pattern: /\bI finally (understand|get it|see it)\b/i, label: "finally", weight: 8 },

  // Somatic / body signals
  { pattern: /\bmy (body|gut|chest|stomach) (is|was|says?|told|knows?|felt)\b/i, label: "somatic", weight: 7 },
  { pattern: /\bsomething (feels?|felt) (wrong|off|right|true)\b/i, label: "somatic-signal", weight: 6 },
  { pattern: /\bgoosebumps\b/i, label: "somatic", weight: 7 },
  { pattern: /\bchills\b/i, label: "somatic", weight: 5 },
];

// --- Category inference ---
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(heal|healing|trauma|recovery|sobriety|sober|therapist|therapy|nervous system)\b/i, category: "healing" },
  { pattern: /\b(flow|flow state|deep work|focus|concentration|zone)\b/i, category: "flow-protocol" },
  { pattern: /\b(body|somatic|gut|chest|heartbeat|HR|HRV|nervous)\b/i, category: "somatic-observation" },
  { pattern: /\b(identity|who I am|self|persona|mask|authentic)\b/i, category: "identity" },
  { pattern: /\b(product|tool|build|ship|launch|MVP|startup|revenue)\b/i, category: "product-idea" },
  { pattern: /\b(career|job|work|boss|employer|quit|leave|salary)\b/i, category: "career" },
  { pattern: /\b(relationship|partner|wife|husband|friend|family|love)\b/i, category: "relationship" },
  { pattern: /\b(AI|model|prompt|agent|LLM|Claude|GPT|Gemini)\b/i, category: "ai-insight" },
  { pattern: /\b(sacred|timeline|milestone|turning point|era|chapter)\b/i, category: "sacred-timeline" },
];

// --- Parse args ---
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const jsonOutput = args.includes("--json");

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const sourceDir = getFlag("--dir");
const outputPath = getFlag("--out") || "breadcrumb-index.md";
const formatHint = getFlag("--format"); // json, jsonl, md
const customTags = getFlag("--tags");

// Parse custom tags if provided
let tagPatterns = DEFAULT_TAGS;
if (customTags) {
  const extraTags = customTags.split(",").map(t => t.trim()).filter(Boolean);
  const extraPatterns = extraTags.map(t => ({
    pattern: new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i"),
    label: t.toLowerCase().replace(/\s+/g, "-"),
    weight: 8,
  }));
  tagPatterns = [...DEFAULT_TAGS, ...extraPatterns];
}

// --- Format detection ---
function detectFormat(filePath: string): "chatgpt-json" | "claude-jsonl" | "markdown" | "unknown" {
  const ext = extname(filePath).toLowerCase();
  if (formatHint === "md" || ext === ".md" || ext === ".txt") return "markdown";
  if (formatHint === "jsonl" || ext === ".jsonl") return "claude-jsonl";
  if (ext === ".json") {
    // Peek at structure to distinguish ChatGPT from other JSON
    try {
      const content = readFileSync(filePath, "utf-8").substring(0, 500);
      if (content.includes('"mapping"') && content.includes('"title"')) return "chatgpt-json";
    } catch {}
  }
  return "unknown";
}

// --- Extract messages from different formats ---

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

function extractChatGPTMessages(filePath: string): { title: string; messages: Message[] } {
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  const title = raw.title || basename(filePath, ".json");
  const messages: Message[] = [];

  if (!raw.mapping) return { title, messages };

  // Walk the tree to extract messages in order
  const nodes = Object.values(raw.mapping) as any[];
  const sorted = nodes
    .filter((n: any) => n.message?.content?.parts?.length > 0)
    .sort((a: any, b: any) => (a.message.create_time || 0) - (b.message.create_time || 0));

  for (const node of sorted) {
    const msg = node.message;
    if (!msg || !msg.content?.parts) continue;

    const role = msg.author?.role;
    if (role !== "user" && role !== "assistant") continue;

    const content = msg.content.parts
      .filter((p: any) => typeof p === "string")
      .join("\n")
      .trim();

    if (content.length > 0) {
      messages.push({
        role,
        content,
        timestamp: msg.create_time || undefined,
      });
    }
  }

  return { title, messages };
}

function extractClaudeMessages(filePath: string): { title: string; messages: Message[] } {
  const lines = readFileSync(filePath, "utf-8").split("\n").filter(l => l.trim());
  const messages: Message[] = [];
  let title = basename(filePath, ".jsonl");

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.title) title = entry.title;
      if (entry.role && entry.content) {
        messages.push({
          role: entry.role,
          content: typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content),
          timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() / 1000 : undefined,
        });
      }
    } catch {}
  }

  return { title, messages };
}

function extractMarkdownMessages(filePath: string): { title: string; messages: Message[] } {
  const content = readFileSync(filePath, "utf-8");
  const title = basename(filePath).replace(/\.(md|txt)$/, "");

  // Treat the whole file as one user message for scanning
  return {
    title,
    messages: [{ role: "user", content, timestamp: undefined }],
  };
}

// --- Breadcrumb detection ---
interface Breadcrumb {
  file: string;
  title: string;
  tag: string;
  weight: number;
  category: string;
  matchedText: string;
  context: string; // surrounding sentences
  timestamp?: string;
  role: "user" | "assistant";
}

function findBreadcrumbs(
  messages: Message[],
  file: string,
  title: string
): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [];

  for (const msg of messages) {
    // Only scan user messages by default — the human is the tagger
    if (msg.role !== "user") continue;

    const sentences = msg.content.split(/(?<=[.!?])\s+|(?<=\n)\s*/);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence.length < 5) continue;

      for (const tag of tagPatterns) {
        if (tag.pattern.test(sentence)) {
          // Get surrounding context (2 sentences before and after)
          const contextStart = Math.max(0, i - 2);
          const contextEnd = Math.min(sentences.length, i + 3);
          const context = sentences.slice(contextStart, contextEnd)
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .join(" ");

          // Infer category from context
          let category = "insight"; // default
          const contextLower = context.toLowerCase();
          for (const cp of CATEGORY_PATTERNS) {
            if (cp.pattern.test(contextLower)) {
              category = cp.category;
              break;
            }
          }

          // Deduplicate — don't add same sentence with multiple tags
          const existing = breadcrumbs.find(b =>
            b.matchedText === sentence && b.file === file
          );
          if (existing) {
            // Keep the higher-weight tag
            if (tag.weight > existing.weight) {
              existing.tag = tag.label;
              existing.weight = tag.weight;
            }
            continue;
          }

          breadcrumbs.push({
            file: basename(file),
            title,
            tag: tag.label,
            weight: tag.weight,
            category,
            matchedText: sentence.substring(0, 200),
            context: context.substring(0, 500),
            timestamp: msg.timestamp
              ? new Date(msg.timestamp * 1000).toISOString().split("T")[0]
              : undefined,
            role: msg.role,
          });

          break; // One tag per sentence (highest priority match)
        }
      }
    }
  }

  return breadcrumbs;
}

// --- Generate output ---
function generateMarkdownIndex(breadcrumbs: Breadcrumb[]): string {
  // Sort by weight descending
  const sorted = [...breadcrumbs].sort((a, b) => b.weight - a.weight);

  // Category counts
  const categories = new Map<string, number>();
  for (const b of sorted) {
    categories.set(b.category, (categories.get(b.category) || 0) + 1);
  }

  const catSorted = [...categories.entries()].sort((a, b) => b[1] - a[1]);

  let output = `# Breadcrumb Index\n\n`;
  output += `**Source:** ${sourceDir}\n`;
  output += `**Mined:** ${new Date().toISOString().split("T")[0]}\n`;
  output += `**Total breadcrumbs:** ${sorted.length}\n`;
  output += `**Densest categories:** ${catSorted.slice(0, 5).map(([c, n]) => `${c} (${n})`).join(", ")}\n\n`;
  output += `---\n\n`;

  // Top hits (weight >= 9)
  const topHits = sorted.filter(b => b.weight >= 9);
  if (topHits.length > 0) {
    output += `## The Heaviest Hits\n\n`;
    for (const b of topHits.slice(0, 10)) {
      output += `### "${b.matchedText.substring(0, 80)}"\n`;
      output += `*File: ${b.file}${b.timestamp ? ` | ${b.timestamp}` : ""}*\n`;
      output += `${b.context.substring(0, 300)}\n\n`;
    }
    output += `---\n\n`;
  }

  // By category
  output += `## By Category\n\n`;
  for (const [category, count] of catSorted) {
    output += `### ${category.toUpperCase()} (${count} hits)\n`;
    const catBreadcrumbs = sorted.filter(b => b.category === category);
    for (const b of catBreadcrumbs) {
      const preview = b.matchedText.substring(0, 100);
      output += `- "${preview}" — [${b.tag}] ${b.file}${b.timestamp ? ` (${b.timestamp})` : ""}\n`;
    }
    output += `\n`;
  }

  // Tag distribution
  output += `---\n\n## Tag Distribution\n\n`;
  const tagCounts = new Map<string, number>();
  for (const b of sorted) {
    tagCounts.set(b.tag, (tagCounts.get(b.tag) || 0) + 1);
  }
  const tagSorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  output += `| Tag | Count |\n|-----|-------|\n`;
  for (const [tag, count] of tagSorted) {
    output += `| ${tag} | ${count} |\n`;
  }
  output += `\n`;

  return output;
}

// --- Main ---
function main() {
  if (!sourceDir) {
    console.error(`
  breadcrumb-mine — mine tagged insights from AI conversation history

  Usage:
    breadcrumb-mine --dir <folder>                  Mine all supported files in folder
    breadcrumb-mine --dir <folder> --format json     Force ChatGPT JSON format
    breadcrumb-mine --dir <folder> --format md       Force markdown format
    breadcrumb-mine --dir <folder> --tags "a,b,c"   Add custom tag patterns
    breadcrumb-mine --dir <folder> --out index.md    Custom output path
    breadcrumb-mine --dir <folder> --verbose         Show full context per hit
    breadcrumb-mine --dir <folder> --json            Raw JSON output

  Supported formats: ChatGPT JSON, Claude JSONL, Markdown/text
  Default tags: eureka, remember this, holy shit, I just realized, bookmark this, + 20 more
    `);
    process.exit(1);
  }

  if (!existsSync(sourceDir)) {
    console.error(`  Directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Collect files
  const files: string[] = [];
  const supportedExts = new Set([".json", ".jsonl", ".md", ".txt"]);
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        walk(full);
      } else if (entry.isFile() && supportedExts.has(extname(entry.name).toLowerCase())) {
        files.push(full);
      }
    }
  };
  walk(sourceDir);

  console.log();
  console.log(`  Mining ${files.length} files for breadcrumbs...`);
  console.log();

  // Process files
  const allBreadcrumbs: Breadcrumb[] = [];
  let processed = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const format = detectFormat(file);
      let result: { title: string; messages: Message[] };

      switch (format) {
        case "chatgpt-json":
          result = extractChatGPTMessages(file);
          break;
        case "claude-jsonl":
          result = extractClaudeMessages(file);
          break;
        case "markdown":
          result = extractMarkdownMessages(file);
          break;
        default:
          continue;
      }

      const breadcrumbs = findBreadcrumbs(result.messages, file, result.title);
      allBreadcrumbs.push(...breadcrumbs);
      processed++;

      if (verbose && breadcrumbs.length > 0) {
        console.log(`  ${basename(file)}: ${breadcrumbs.length} breadcrumb(s)`);
        for (const b of breadcrumbs) {
          console.log(`    [${b.tag}] "${b.matchedText.substring(0, 60)}..."`);
        }
      }
    } catch (err: any) {
      errors++;
      if (verbose) {
        console.error(`  ERROR ${basename(file)}: ${err.message}`);
      }
    }
  }

  if (allBreadcrumbs.length === 0) {
    console.log(`  No breadcrumbs found in ${processed} files.`);
    console.log(`  Try adding custom tags: --tags "your phrase,another phrase"`);
    process.exit(0);
  }

  // Output
  if (jsonOutput) {
    console.log(JSON.stringify({
      source: sourceDir,
      mined: new Date().toISOString(),
      filesProcessed: processed,
      errors,
      totalBreadcrumbs: allBreadcrumbs.length,
      breadcrumbs: allBreadcrumbs,
    }, null, 2));
  } else {
    const markdown = generateMarkdownIndex(allBreadcrumbs);
    writeFileSync(outputPath, markdown);

    // Summary
    const categories = new Map<string, number>();
    for (const b of allBreadcrumbs) {
      categories.set(b.category, (categories.get(b.category) || 0) + 1);
    }

    console.log(`  Breadcrumbs found: ${allBreadcrumbs.length}`);
    console.log(`  Files processed:   ${processed}`);
    if (errors > 0) console.log(`  Errors:            ${errors}`);
    console.log(`  Categories:        ${categories.size}`);
    console.log();
    for (const [cat, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${cat.padEnd(22)} ${count}`);
    }
    console.log();
    console.log(`  Index saved: ${outputPath}`);
  }

  console.log();
}

main();
