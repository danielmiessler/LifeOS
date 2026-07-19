#!/usr/bin/env bun
/**
 * GenerateKnowledgeSchemaDoc — regenerate `MEMORY/KNOWLEDGE/_schema.md` FROM
 * `KnowledgeSchema.ts`, so the human-readable schema doc is derived from the code
 * and can never drift from it (the two-homes drift that produced three dialects
 * is what this kills). Same pattern as ArchitectureSummaryGenerator.
 *
 * The code is the single source of truth; this doc is generated. Run after any
 * change to the ENVELOPE / types / relation vocab in KnowledgeSchema.ts.
 *
 * CLI:
 *   bun GenerateKnowledgeSchemaDoc.ts            # write the doc
 *   bun GenerateKnowledgeSchemaDoc.ts --stdout   # print, don't write
 */

import { writeFileSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { homedir } from "node:os";
import { claudeDir, shellQuote } from "./lifeos-root";
import {
  ENVELOPE, CANONICAL_TYPES, TYPE_TO_DIR, PER_TYPE_REQUIRED,
  RELATION_VOCAB, SOURCE_KINDS, STATUS_VALUES, SCHEMA_VERSION,
} from "./KnowledgeSchema";

const OUT = pathResolve(claudeDir(), "LIFEOS/MEMORY/KNOWLEDGE/_schema.md");

function render(): string {
  const L: string[] = [];
  const tool = (name: string): string => shellQuote(pathResolve(claudeDir(), "LIFEOS", "TOOLS", name));
  L.push("---");
  L.push('title: "Knowledge Archive Schema"');
  L.push("type: moc");
  L.push("generated: true");
  L.push("---");
  L.push("");
  L.push(`# Knowledge Archive Schema — ${SCHEMA_VERSION}`);
  L.push("");
  L.push("> **Generated from `LIFEOS/TOOLS/KnowledgeSchema.ts` — do not edit by hand.**");
  L.push(`> Regenerate: \`bun ${tool("GenerateKnowledgeSchemaDoc.ts")}\`.`);
  L.push("> The code is the single source of truth; `KnowledgeLint.ts` enforces this contract, `MigrateKnowledge.ts` brings old notes onto it, and new notes are born on it via `MemorySystem.renderInitialNote`.");
  L.push("");
  L.push("The archive stores **entities** — things you'd look up later. Every note is one of the object types below, carries the **Core Envelope** of flat typed frontmatter, and links to others via typed `related:` edges. Topic is a **tag**, entity is a **type**.");
  L.push("");

  L.push("## Object Types");
  L.push("");
  L.push("| Type | Directory |");
  L.push("|---|---|");
  for (const t of CANONICAL_TYPES) L.push(`| \`${t}\` | \`${TYPE_TO_DIR[t]}/\` |`);
  L.push("");

  L.push("## Core Envelope (every note, every type)");
  L.push("");
  L.push("Flat and typed on purpose: flat scalar/list fields query natively in a `kb query` CLI, Obsidian Bases, and Pulse alike (Obsidian Properties have no nested-object type). `related` is the one nested field — a typed-edge list, queryable via `kb`/Dataview.");
  L.push("");
  L.push("| Field | Format | Required | Query it unlocks |");
  L.push("|---|---|---|---|");
  for (const f of ENVELOPE) {
    const req = f.required ? "**yes**" : "no";
    const fmt = f.values ? `${f.format} (${f.values.join(" \\| ")})` : f.format;
    L.push(`| \`${f.key}\` | ${fmt} | ${req} | ${f.query} |`);
  }
  L.push("");

  L.push("## Per-Type Required Fields (beyond the envelope)");
  L.push("");
  L.push("| Type | Additional required |");
  L.push("|---|---|");
  for (const t of CANONICAL_TYPES) {
    const extra = PER_TYPE_REQUIRED[t];
    L.push(`| \`${t}\` | ${extra.length ? extra.map((k) => `\`${k}\``).join(", ") : "— (envelope only)"} |`);
  }
  L.push("");
  L.push("A note missing an optional per-type source field (e.g. a research note with no `source_url`) is **envelope-conformant but incomplete** — Lint reports it as an enrichment gap, not a schema failure.");
  L.push("");

  L.push("## Controlled Vocabularies");
  L.push("");
  L.push(`- **\`source_kind\`**: ${SOURCE_KINDS.map((s) => `\`${s}\``).join(" · ")}`);
  L.push(`- **\`status\`**: ${STATUS_VALUES.map((s) => `\`${s}\``).join(" · ")}`);
  L.push(`- **\`related.type\`** (closed-but-curated): ${RELATION_VOCAB.map((s) => `\`${s}\``).join(" · ")}`);
  L.push("");
  L.push("Bookmarks are NOT a type: an unprocessed saved URL is `status: inbox` + `source_kind: bookmark` on the type it will become; `ingest` promotes it.");
  L.push("");

  L.push("## Querying");
  L.push("");
  L.push("```bash");
  L.push(`bun ${tool("KnowledgeQuery.ts")} --source-author \"<name>\"`);
  L.push(`bun ${tool("KnowledgeQuery.ts")} --type idea --tag security --created-after 2026-05`);
  L.push(`bun ${tool("KnowledgeQuery.ts")} --related-type contradicts --slugs`);
  L.push(`bun ${tool("KnowledgeQuery.ts")} --quality-max 2 --count   # stubs to enrich`);
  L.push(`bun ${tool("KnowledgeLint.ts")}                            # conformance`);
  L.push("```");
  L.push("");
  L.push("The archive is markdown+YAML, so once fields are consistent, Obsidian Bases queries `KNOWLEDGE/` as a database with zero extra code.");
  L.push("");
  L.push("## Rationale & History");
  L.push("");
  L.push("Design + the three-dialect migration that produced this contract: `LIFEOS/MEMORY/WORK/20260704-knowledge-schema-upgrade-design/DESIGN.md`.");
  L.push("");
  return L.join("\n");
}

function main() {
  const doc = render();
  if (process.argv.includes("--stdout")) { console.log(doc); return; }
  writeFileSync(OUT, doc, "utf8");
  console.log(`✓ wrote ${OUT.replace(homedir(), "~")} (${doc.split("\n").length} lines, generated from KnowledgeSchema.ts)`);
}

main();
