#!/usr/bin/env bun
import { writeFileSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { renderShell, renderPage } from "../ui/render";
import type { PageData } from "../Schema/PulseSchema";
import { PageDataSchema } from "../Schema/PulseSchema";
import { getClaudeDir } from "../../TOOLS/Paths";

const FIX_DIR = resolve(getClaudeDir(), "LIFEOS", "PULSE", "Schema", "Fixtures");
const OUT_DIR = resolve(getClaudeDir(), "LIFEOS", "PULSE", "Schema", "Snapshots");
mkdirSync(OUT_DIR, { recursive: true });

const fixtures = readdirSync(FIX_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("invalid"));
const fakeIndex = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  pages: fixtures.map((f) => {
    const id = basename(f, ".json").split(".")[0]!;
    return { id, title: id[0]!.toUpperCase() + id.slice(1), kind: "?", lastBuildAt: "", hasError: false, costUSD: 0, provenance: "customized" as const };
  }),
};

let count = 0;
for (const f of fixtures) {
  const raw = JSON.parse(readFileSync(join(FIX_DIR, f), "utf8"));
  const parsed = PageDataSchema.safeParse(raw);
  if (!parsed.success) { console.error(`skip ${f}: ${parsed.error.issues[0]?.message}`); continue; }
  const data: PageData = parsed.data;
  const id = basename(f, ".json").split(".")[0]!;
  const body = renderPage(data, { rebuildable: true });
  const html = renderShell({ mode: "light", pageId: id, pageTitle: data.title, index: fakeIndex, body });
  const outPath = join(OUT_DIR, `${id}.fixture.html`);
  writeFileSync(outPath, html);
  count++;
  console.log(`✓ ${id}.fixture.html (${data.kind})`);
}
console.log(`\nWrote ${count} fixture snapshot(s) to ${OUT_DIR}`);
