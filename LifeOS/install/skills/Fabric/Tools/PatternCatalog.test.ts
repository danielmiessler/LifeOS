import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildCatalog, checkCatalog, main, patternDirs, readCatalog, rewriteUseWhen, triggersList, writeCatalog,
  type CatalogEntry, type Infer,
} from "./PatternCatalog";
import { descriptionProblem } from "../../CreateSkill/Tools/Scaffold";

const SHIPPED = resolve(import.meta.dir, "..", "Patterns");

const EXECUTE = `# ExecutePattern
<!-- ported-patterns:start -->
| Pattern | Runs |
|---------|------|
| \`check_agreement\` | CheckAgreement |
<!-- ported-patterns:end -->
`;
const SKILL = `---
name: Fabric
description: "Runs patterns. USE WHEN fabric, run a pattern. NOT FOR research (Research)."
---
| Intent | Trigger | File |
|--------|---------|------|
| **CheckAgreement** | "check this agreement before I sign", "review this contract for gotchas", \`check_agreement\` | \`Intents/CheckAgreement.md\` |
`;
const SYS = (identity: string, output: string) => `# IDENTITY and PURPOSE\n\n${identity}\n\n# STEPS\n\n- Read it.\n\n# OUTPUT INSTRUCTIONS\n\n${output}\n\n# INPUT\n\nINPUT:\n`;

let root: string;
let patterns: string;
function fixture() {
  root = mkdtempSync(join(tmpdir(), "pattern-catalog-"));
  patterns = join(root, "Patterns");
  for (const [name, body] of Object.entries({
    check_agreement: SYS("You are an expert at reading contracts and agreements.", "- Output a section called GOTCHAS:\n- Output a section called RECOMMENDATIONS:"),
    create_quiz: SYS("You generate quiz questions about a subject for students.", "- Output the questions as a bulleted list."),
    secret_helper: SYS("You turn a messy changelog into release notes for a product launch.", "- Output JSON only."),
  })) {
    mkdirSync(join(patterns, name), { recursive: true });
    writeFileSync(join(patterns, name, "system.md"), body);
  }
  mkdirSync(join(patterns, "raycast"));
  writeFileSync(join(patterns, "raycast", "yt"), "#!/bin/sh\n");
  writeFileSync(join(patterns, "pattern_explanations.md"), [
    "# Brief one-line summary",
    "",
    "1. **check_agreement**: Analyze contracts and agreements to identify important stipulations, issues, and potential gotchas.",
    "2. **create_quiz**: Generates review questions based on learning objectives for students.",
    "",
  ].join("\n"));
  writeFileSync(join(root, "ExecutePattern.md"), EXECUTE);
  writeFileSync(join(root, "SKILL.md"), SKILL);
}
const opts = (infer: Infer | null) => ({
  patternsDir: patterns,
  executePatternPath: join(root, "ExecutePattern.md"),
  skillMdPath: join(root, "SKILL.md"),
  cachePath: join(root, "catalog.cache.json"),
  previousPath: join(patterns, "catalog.yaml"),
  infer,
});
function counter(): { infer: Infer; calls: () => number } {
  let n = 0;
  return { infer: async () => { n++; return { purpose: "Turns a changelog into launch release notes.", triggers: ["release notes", "changelog to notes", "launch notes"] }; }, calls: () => n };
}
const hashes = (dir: string) => Object.fromEntries(patternDirs(dir).map((n) => [n, createHash("sha256").update(readFileSync(join(dir, n, "system.md"))).digest("hex")]));

beforeEach(fixture);
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("build", () => {
  test("one complete entry per pattern directory with a system.md", async () => {
    const c = counter();
    const r = await buildCatalog(opts(c.infer));
    expect(r.entries.map((e) => e.name)).toEqual(["check_agreement", "create_quiz", "secret_helper"]);
    for (const e of r.entries) {
      for (const k of ["name", "purpose", "category", "input", "output", "system_md_hash", "derived"] as const) expect(String(e[k]).length).toBeGreaterThan(0);
      expect(e.triggers.length).toBeGreaterThanOrEqual(3);
    }
    const agree = r.entries.find((e) => e.name === "check_agreement")!;
    expect(agree.ported_intent).toBe("CheckAgreement");
    expect(agree.derived).toBe("explanation");
    expect(agree.purpose).toStartWith("Analyze contracts and agreements");
    expect(agree.triggers).toContain("check this agreement before I sign");
    expect(agree.output).toContain("GOTCHAS");
    expect(r.entries.find((e) => e.name === "create_quiz")!.ported_intent).toBeNull();
    expect(r.entries.find((e) => e.name === "secret_helper")!.derived).toBe("model");
    expect(r.modelCalls).toBe(1);
  });

  test("--no-model: explanation entries complete, uncovered pattern falls back to its IDENTITY", async () => {
    const r = await buildCatalog(opts(null));
    expect(r.modelCalls).toBe(0);
    const helper = r.entries.find((e) => e.name === "secret_helper")!;
    expect(helper.derived).toBe("identity");
    expect(helper.purpose.length).toBeGreaterThan(10);
    expect(helper.triggers.length).toBeGreaterThanOrEqual(3);
    expect(helper.output).toBe("JSON");
  });

  test("model answers are cached by system.md hash: a second build makes zero model calls", async () => {
    const c = counter();
    const first = await buildCatalog(opts(c.infer));
    writeCatalog(join(patterns, "catalog.yaml"), first.entries);
    const second = await buildCatalog(opts(c.infer));
    expect(first.modelCalls).toBe(1);
    expect(second.modelCalls).toBe(0);
    expect(second.entries).toEqual(first.entries);
    expect(second.added).toEqual([]);
    expect(second.changed).toEqual([]);
  });

  test("a failed model pass falls back to IDENTITY and is not cached", async () => {
    let n = 0;
    const failing: Infer = async () => { n++; return null; };
    await buildCatalog(opts(failing));
    await buildCatalog(opts(failing));
    expect(n).toBe(2);
    expect(existsSync(join(root, "catalog.cache.json")) ? Object.keys(JSON.parse(readFileSync(join(root, "catalog.cache.json"), "utf8"))).length : 0).toBe(0);
  });

  test("reports added and changed entries against the previous catalog", async () => {
    const first = await buildCatalog(opts(null));
    writeCatalog(join(patterns, "catalog.yaml"), first.entries);
    mkdirSync(join(patterns, "new_one"));
    writeFileSync(join(patterns, "new_one", "system.md"), SYS("You write haiku about any topic.", "- Output only the haiku."));
    writeFileSync(join(patterns, "create_quiz", "system.md"), SYS("You write harder quiz questions.", "- Output a numbered list."));
    const second = await buildCatalog(opts(null));
    expect(second.added).toEqual(["new_one"]);
    expect(second.changed).toEqual(["create_quiz"]);
  });

  test("the yaml round-trips", async () => {
    const r = await buildCatalog(opts(null));
    writeCatalog(join(patterns, "catalog.yaml"), r.entries);
    expect(readCatalog(join(patterns, "catalog.yaml"))).toEqual(r.entries);
  });

  test("invariant: a build changes no system.md (fixture and the shipped library)", async () => {
    const before = hashes(patterns);
    const r = await buildCatalog(opts(counter().infer));
    writeCatalog(join(patterns, "catalog.yaml"), r.entries);
    expect(hashes(patterns)).toEqual(before);

    const shippedBefore = hashes(SHIPPED);
    const out = join(root, "shipped-catalog.yaml");
    const code = await main(["build", "--no-model", "--no-user", "--out", out, "--cache", join(root, "shipped.cache.json")]);
    expect(code).toBe(0);
    expect(hashes(SHIPPED)).toEqual(shippedBefore);
    expect(readCatalog(out).length).toBe(patternDirs(SHIPPED).length);
  });
});

describe("check", () => {
  test("exit 0 when current, 1 on an uncataloged pattern dir, 1 on a changed hash", async () => {
    const r = await buildCatalog(opts(null));
    const cat = join(patterns, "catalog.yaml");
    writeCatalog(cat, r.entries);
    expect(checkCatalog(patterns, cat).ok).toBe(true);
    expect(await main(["check", "--patterns", patterns, "--catalog", cat])).toBe(0);

    mkdirSync(join(patterns, "temp_pattern"));
    writeFileSync(join(patterns, "temp_pattern", "system.md"), SYS("Temp.", "- Out."));
    const missing = checkCatalog(patterns, cat);
    expect(missing.ok).toBe(false);
    expect(missing.problems.join("\n")).toContain("temp_pattern");
    expect(await main(["check", "--patterns", patterns, "--catalog", cat])).toBe(1);
    rmSync(join(patterns, "temp_pattern"), { recursive: true });
    expect(await main(["check", "--patterns", patterns, "--catalog", cat])).toBe(0);

    writeFileSync(join(patterns, "create_quiz", "system.md"), SYS("Changed.", "- Out."));
    const changed = checkCatalog(patterns, cat);
    expect(changed.ok).toBe(false);
    expect(changed.problems.join("\n")).toContain("create_quiz");
    expect(await main(["check", "--patterns", patterns, "--catalog", cat])).toBe(1);
  });

  test("--complete also fails on an empty field or fewer than three triggers", async () => {
    const r = await buildCatalog(opts(null));
    const cat = join(patterns, "catalog.yaml");
    const broken: CatalogEntry[] = r.entries.map((e, i) => (i === 0 ? { ...e, purpose: "", triggers: ["one"] } : e));
    writeCatalog(cat, broken);
    expect(checkCatalog(patterns, cat).ok).toBe(true);
    const full = checkCatalog(patterns, cat, { complete: true });
    expect(full.ok).toBe(false);
    expect(full.problems.join("\n")).toContain("purpose");
  });

  test("a missing catalog fails check; build on a missing dir still exits 0", async () => {
    expect(await main(["check", "--patterns", patterns, "--catalog", join(root, "nope.yaml")])).toBe(1);
    expect(await main(["build", "--no-model", "--no-user", "--patterns", join(root, "missing"), "--out", join(root, "x.yaml")])).toBe(0);
  });
});

describe("local patterns", () => {
  test("USER patterns go to their own catalog and never into the shipped one", async () => {
    const user = join(root, "USER");
    mkdirSync(join(user, "Patterns", "my_local_thing"), { recursive: true });
    writeFileSync(join(user, "Patterns", "my_local_thing", "system.md"), SYS("You rate gardening blog posts for a local newsletter.", "- Output a score."));
    const out = join(patterns, "catalog.yaml");
    const code = await main(["build", "--no-model", "--patterns", patterns, "--out", out, "--cache", join(root, "c.json"),
      "--execute", join(root, "ExecutePattern.md"), "--skill", join(root, "SKILL.md"), "--user-dir", user]);
    expect(code).toBe(0);
    expect(readFileSync(out, "utf8")).not.toContain("my_local_thing");
    const local = readCatalog(join(user, "catalog.yaml"));
    expect(local.map((e) => e.name)).toEqual(["my_local_thing"]);
    expect(local[0].triggers.length).toBeGreaterThanOrEqual(3);
  });
});

describe("triggers", () => {
  test("the regenerated USE WHEN list fits the validator's limit and keeps head and NOT FOR", async () => {
    const shipped = readCatalog(join(SHIPPED, "catalog.yaml"));
    const skill = readFileSync(resolve(import.meta.dir, "..", "SKILL.md"), "utf8");
    const { description } = rewriteUseWhen(skill, (budget) => triggersList(shipped, budget));
    expect(descriptionProblem(description)).toBeUndefined();
    expect(description).toContain("USE WHEN fabric");
    expect(description).toContain("NOT FOR");
    expect(description.length).toBeLessThanOrEqual(1024);
  });
});
