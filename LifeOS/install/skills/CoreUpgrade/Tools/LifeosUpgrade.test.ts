import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, symlinkSync, rmSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isPreserved, computeClearList, planUpgrade, copyMissing, preflight, payloadHas,
  parseArgs, safeRemove, scopedBackup, rollback, snapshotDeployTargets, extractCustomizations,
  planClaudeSplit, applyClaudeSplit, undoClaudeSplit,
} from "./LifeosUpgrade";

// TR6: every tmp root is tracked and removed after the suite — no orphaned temp trees.
const CREATED: string[] = [];
const tmp = (p: string) => { const d = mkdtempSync(join(tmpdir(), p)); CREATED.push(d); return d; };
const trackedPath = (name: string) => { const p = join(tmpdir(), name); CREATED.push(p); return p; };
afterAll(() => { for (const d of CREATED) rmSync(d, { recursive: true, force: true }); });
const lexistsT = (p: string): boolean => { try { lstatSync(p); return true; } catch { return false; } };
function tree(root: string, dirs: string[], files: Record<string, string> = {}) {
  for (const d of dirs) mkdirSync(join(root, d), { recursive: true });
  for (const [f, c] of Object.entries(files)) { mkdirSync(join(root, f, ".."), { recursive: true }); writeFileSync(join(root, f), c); }
}

test("isPreserved protects user + harness zones (case-insensitive)", () => {
  for (const p of ["LIFEOS/USER", "LIFEOS/USER/CONFIG/x.md", "LIFEOS/MEMORY", "LIFEOS/ARBOL",
                   "LIFEOS/Memory", "LIFEOS/User", "lifeos/memory",           // #5 APFS case variants
                   ".env", ".env.local", "CLAUDE.md", "settings.json", "settings.user.json",
                   "skills/_RECON", "skills/_UPGRADE",                          // #11 private-skill denylist depth
                   "sessions", "todos/x", "tasks", "plugins/y", "cache", "history.jsonl", "ide"]) {
    expect(isPreserved(p)).toBe(true);
  }
});

test("isPreserved does NOT over-preserve system code — and basename over-match is fixed (#10)", () => {
  for (const p of ["LIFEOS/TOOLS", "LIFEOS/ALGORITHM/v.md", "LIFEOS/PULSE", "commands", "agents",
                   "skills/Crucible",
                   "skills/jobs", "skills/tasks", "skills/cache", "LIFEOS/jobs"]) {   // #10 basename must NOT match
    expect(isPreserved(p)).toBe(false);
  }
});

test("computeClearList: payload-aware — replace only what payload ships (#1, #2)", () => {
  const root = tmp("lu-c-"), pay = tmp("lu-cp-");
  tree(root, ["LIFEOS/TOOLS", "LIFEOS/USER", "LIFEOS/MEMORY", "skills/Research", "skills/Crucible", "skills/_RECON", "commands", "agents"],
    { "commands/pu.md": "sys", "commands/mine.md": "user", "agents/Forge.md": "sys", "CLAUDE.md": "x", "settings.json": "x" });
  // payload ships: LIFEOS/TOOLS, skills/Research, commands/pu.md, agents/Forge.md  (NOT Crucible, NOT mine.md)
  tree(pay, ["LIFEOS/TOOLS", "skills/Research", "commands", "agents"],
    { "commands/pu.md": "new", "agents/Forge.md": "new" });
  const clear = computeClearList(root, pay);
  expect(clear).toContain("LIFEOS/TOOLS");
  expect(clear).toContain("skills/Research");
  expect(clear).toContain("commands/pu.md");   // shipped → replaced
  expect(clear).toContain("agents/Forge.md");
  // user content NOT shipped by payload → preserved
  expect(clear).not.toContain("commands/mine.md");   // #1 user command survives
  expect(clear).not.toContain("skills/Crucible");    // #1 user public skill survives
  expect(clear).not.toContain("skills/_RECON");
  expect(clear).not.toContain("LIFEOS/USER");
  expect(clear).not.toContain("LIFEOS/MEMORY");
  expect(clear).not.toContain("CLAUDE.md");
});

test("computeClearList: empty/wrong payload clears NOTHING (#2)", () => {
  const root = tmp("lu-e-"), pay = tmp("lu-ep-");   // payload has no LIFEOS/skills/commands/agents
  tree(root, ["LIFEOS/TOOLS", "skills/Research", "commands"], { "CLAUDE.md": "x" });
  tree(pay, ["someWrongThing"], {});
  expect(computeClearList(root, pay)).toEqual([]);
  expect(planUpgrade(root, pay).deployRoots).toEqual([]);   // main aborts on this before any mutation
});

test("payloadHas: maps rel paths 1:1 onto payload layout — LIFEOS/ canonical (#G1)", () => {
  const pay = tmp("lu-ph-");
  tree(pay, ["LIFEOS/TOOLS", "skills/Research", "commands"], { "commands/pu.md": "x" });
  expect(payloadHas(pay, "LIFEOS/TOOLS")).toBe(true);
  expect(payloadHas(pay, "skills/Research")).toBe(true);
  expect(payloadHas(pay, "commands/pu.md")).toBe(true);
  expect(payloadHas(pay, "LIFEOS/NOPE")).toBe(false);
  expect(payloadHas(pay, "skills/Missing")).toBe(false);
});

test("preflight: bare CLAUDE.md dir is rejected (#3); dev-tree refused", () => {
  const notInstall = tmp("lu-n-"); writeFileSync(join(notInstall, "CLAUDE.md"), "x");  // no LIFEOS/
  const pay = tmp("lu-pp-"); mkdirSync(join(pay, "LIFEOS"), { recursive: true });
  expect(preflight(notInstall, pay).some((e) => e.includes("no LIFEOS/"))).toBe(true);
  const dev = tmp("lu-d-"); tree(dev, ["LIFEOS", "skills/_LIFEOS"], { "settings.json": "{}" });
  expect(preflight(dev, pay).some((e) => e.includes("DEV-TREE"))).toBe(true);
});

test("preflight: missing payload + ambiguous target rejected (#TR3)", () => {
  const root = tmp("lu-pf-"); tree(root, ["LIFEOS"], { "settings.json": "{}" });
  expect(preflight(root, "").some((e) => e.includes("--payload"))).toBe(true);                       // payload missing
  expect(preflight(root, join(root, "nope")).some((e) => e.includes("--payload"))).toBe(true);       // payload nonexistent
  const ambiguous = tmp("lu-amb-"); mkdirSync(join(ambiguous, "LIFEOS"), { recursive: true });       // LIFEOS/ but no settings.json/CLAUDE.md
  const pay = tmp("lu-pfp-"); mkdirSync(join(pay, "LIFEOS"), { recursive: true });
  expect(preflight(ambiguous, pay).some((e) => e.includes("ambiguous"))).toBe(true);
});

test("scopedBackup refuses a pre-existing backup dir (#TR8)", () => {
  const root = tmp("lu-sb-"); tree(root, ["LIFEOS/TOOLS"], { "LIFEOS/TOOLS/a.ts": "A" });
  const bak = tmp("lu-sb-bak-");                                                                     // exists already
  expect(() => scopedBackup(root, bak, ["LIFEOS/TOOLS"])).toThrow(/already exists/);
});

test("parseArgs: rejects empty/missing values and swallowed flags (#4, #9)", () => {
  expect(() => parseArgs(["--payload"])).toThrow();                       // missing value
  expect(() => parseArgs(["--config-root", ""])).toThrow();              // explicit empty → no silent prod default (#4)
  expect(() => parseArgs(["--backup-dir", "--apply"])).toThrow();        // #9 value-flag must not swallow --apply
  expect(() => parseArgs(["--bogus"])).toThrow();                        // unknown arg
  expect(parseArgs(["--payload", "/x", "--apply"])).toEqual({ apply: true, payload: "/x" });
});

test("copyMissing: never follows OR deploys symlinks (#7, #S1 — matches upstream DeployCore)", () => {
  const base = tmp("lu-sl-"); const src = join(base, "src"), dst = join(base, "dst");
  mkdirSync(src, { recursive: true }); writeFileSync(join(src, "real.txt"), "R");
  symlinkSync(src, join(src, "loop"));                 // self-referential dir symlink (would infinite-recurse if followed)
  symlinkSync("/tmp/attacker-target-nope", join(src, "evil"));  // payload symlink to an arbitrary target
  const { copied } = copyMissing(src, dst);            // must terminate
  expect(existsSync(join(dst, "real.txt"))).toBe(true);
  expect(copied).toBeGreaterThan(0);
  expect(readdirSync(dst)).not.toContain("loop");      // S1: payload symlinks are SKIPPED, never recreated
  expect(readdirSync(dst)).not.toContain("evil");
});

test("backup+rollback are symlink-aware: dangling symlink round-trips without spurious failure (#P1/#P2)", () => {
  const root = tmp("lu-syl-"); const bak = trackedPath("bak-syl-" + Date.now());
  tree(root, ["LIFEOS/TOOLS"], { "LIFEOS/TOOLS/real.ts": "R" });
  symlinkSync("/nonexistent-target-xyz", join(root, "LIFEOS/TOOLS/dead-link"));   // dangling symlink in the cleared zone
  const clear = ["LIFEOS/TOOLS"];
  const snap = snapshotDeployTargets(root, [{ src: "LIFEOS", dest: "LIFEOS" }]);
  scopedBackup(root, bak, clear);                                                  // P1: must NOT spuriously abort
  expect(lexistsT(join(bak, "LIFEOS/TOOLS/dead-link"))).toBe(true);                // backup holds the symlink itself
  safeRemove(root, "LIFEOS/TOOLS");
  const failed = rollback(root, bak, clear, snap);                                 // P2: must NOT report PARTIAL
  expect(failed).toEqual([]);
  expect(readFileSync(join(root, "LIFEOS/TOOLS/real.ts"), "utf8")).toBe("R");
  expect(lexistsT(join(root, "LIFEOS/TOOLS/dead-link"))).toBe(true);               // symlink restored as a symlink
});

test("safeRemove refuses a preserved path (guard 1) and path escape (guard 2)", () => {
  const root = tmp("lu-sr-");
  expect(() => safeRemove(root, "LIFEOS/USER")).toThrow(/REFUSING/);
  expect(() => safeRemove(root, "skills/_RECON")).toThrow(/REFUSING/);
  expect(() => safeRemove(root, "../evil")).toThrow(/escapes/);
});

test("scopedBackup backs up ONLY the clear-list, per-entry verified (#8, #13)", () => {
  const root = tmp("lu-b-"); const bak = join(root, "..", "bak-" + Date.now());
  tree(root, ["LIFEOS/TOOLS", "LIFEOS/USER", "plugins"], { "LIFEOS/TOOLS/a.ts": "A", "LIFEOS/USER/big.md": "U", "plugins/x": "P" });
  scopedBackup(root, bak, ["LIFEOS/TOOLS"]);
  expect(readFileSync(join(bak, "LIFEOS/TOOLS/a.ts"), "utf8")).toBe("A");   // cleared entry backed up
  expect(existsSync(join(bak, "LIFEOS/USER"))).toBe(false);                 // preserved zone NOT copied (scoped, not 3.1GB)
  expect(existsSync(join(bak, "plugins"))).toBe(false);
  rmSync(bak, { recursive: true, force: true });
});

test("rollback: restores cleared entries AND removes NEW deploy artifacts (#6, Crucible HIGH)", () => {
  const root = tmp("lu-rb-"); const bak = join(root, "..", "bak-rb-" + Date.now());
  tree(root, ["LIFEOS/TOOLS", "skills/Research"], { "LIFEOS/TOOLS/orig.ts": "ORIG", "skills/Research/s.md": "R" });
  const clear = ["LIFEOS/TOOLS", "skills/Research"];
  const snap = snapshotDeployTargets(root, [{ src: "LIFEOS", dest: "LIFEOS" }, { src: "skills", dest: "skills" }]);
  scopedBackup(root, bak, clear);
  // simulate clear + partial deploy
  safeRemove(root, "LIFEOS/TOOLS"); mkdirSync(join(root, "LIFEOS/TOOLS"), { recursive: true }); writeFileSync(join(root, "LIFEOS/TOOLS/new.ts"), "NEW");
  safeRemove(root, "skills/Research");
  mkdirSync(join(root, "skills/NewSkill"), { recursive: true }); writeFileSync(join(root, "skills/NewSkill/n.md"), "NEWSKILL"); // brand-new deploy artifact
  const failed = rollback(root, bak, clear, snap);
  expect(failed).toEqual([]);
  expect(readFileSync(join(root, "LIFEOS/TOOLS/orig.ts"), "utf8")).toBe("ORIG");    // cleared entry restored
  expect(existsSync(join(root, "LIFEOS/TOOLS/new.ts"))).toBe(false);                // intra-entry remnant gone (restored from backup)
  expect(readFileSync(join(root, "skills/Research/s.md"), "utf8")).toBe("R");        // cleared entry restored
  expect(existsSync(join(root, "skills/NewSkill"))).toBe(false);                     // NEW top-level artifact removed (the HIGH)
  rmSync(bak, { recursive: true, force: true });
});

test("rollback: reports entries it could NOT restore instead of false success (#security-MEDIUM)", () => {
  const root = tmp("lu-rf-"); const bak = join(root, "..", "bak-rf-" + Date.now());
  tree(root, ["LIFEOS/TOOLS"], { "LIFEOS/TOOLS/x.ts": "X" });
  mkdirSync(bak, { recursive: true });                                // empty backup — nothing captured
  const failed = rollback(root, bak, ["LIFEOS/TOOLS"], {});
  expect(failed).toContain("LIFEOS/TOOLS");                           // surfaced, not silently "complete"
  rmSync(bak, { recursive: true, force: true });
});

test("preflight rejects a --backup-dir nested inside config-root (#security-MEDIUM)", () => {
  const root = tmp("lu-bd-"); tree(root, ["LIFEOS"], { "settings.json": "{}" });
  const pay = tmp("lu-bdp-"); mkdirSync(join(pay, "LIFEOS"), { recursive: true });
  expect(preflight(root, pay, join(root, "skills/nested-bak")).some((e) => e.includes("OUTSIDE config-root"))).toBe(true);
  expect(preflight(root, pay, join(root, "..", "outside-bak")).some((e) => e.includes("OUTSIDE config-root"))).toBe(false);
});

test("extractCustomizations: additions auto-extracted, modifications flagged, noise excluded (#G-split)", () => {
  const base = [
    "# LifeOS 7.1.1 — LifeOS",
    "",
    "# @LIFEOS/USER/PROJECTS.md",
    "",
    "## LifeOS System",
    "",
    "- **Memory** — `Memory/MemorySystem.md`",
    '- **Browser automation** — `Skill("Interceptor")` (real Chrome, mandatory)',
  ].join("\n");
  const user = [
    "# LifeOS 6.0.5 — LifeOS",                                                          // version header → noise
    "",
    "@LIFEOS/USER/PROJECTS.md",                                                         // activated import → noise (comment-state ignored)
    "",
    "## LifeOS System",                                                                 // heading identical → matched
    "",
    "- **Memory** — `Memory/MemorySystem.md`",                                          // identical → matched
    '- **Browser automation** — `Skill("Browser")` + Interceptor + Chrome DevTools MCP',// same key, diff body → MODIFICATION
    "- **CodeGraph** — structural code intel via `mcp__codegraph__*`",                  // absent upstream → ADDITION
  ].join("\n");

  const { global, report } = extractCustomizations(user, base);
  expect(report.additions.some((a) => a.includes("CodeGraph"))).toBe(true);            // addition captured
  expect(global).toContain("CodeGraph");
  expect(report.modifications.some((m) => m.includes("Chrome DevTools MCP"))).toBe(true); // modification flagged…
  expect(global).not.toContain("Chrome DevTools MCP");                                 // …NOT auto-extracted
  expect(global).not.toContain("6.0.5");                                               // version header excluded
  expect(global).not.toContain("@LIFEOS/USER/PROJECTS.md");                            // import excluded
  expect(report.noise.some((n) => n.includes("6.0.5"))).toBe(true);
  expect(global).not.toContain("MemorySystem");                                        // identical system block dropped
  expect(report.matched).toBeGreaterThanOrEqual(2);                                    // "## LifeOS System" + Memory bullet
});

test("extractCustomizations: no customizations → empty global (benign)", () => {
  const base = "## LifeOS System\n\n- **Memory** — `x`";
  const { global, report } = extractCustomizations(base, base);
  expect(global).toBe("");
  expect(report.additions).toEqual([]);
  expect(report.modifications).toEqual([]);
});

test("planClaudeSplit: preconditions + classifies against payload template (#split)", () => {
  const root = tmp("lu-sp-"), pay = tmp("lu-spp-");
  tree(root, ["LIFEOS/USER/CUSTOMIZATIONS"], { "CLAUDE.md": "## LifeOS System\n\n- **Memory** — `x`\n- **CodeGraph** — mine" });
  writeFileSync(join(pay, "CLAUDE.template.md"), "## LifeOS System\n\n- **Memory** — `x`");
  const p = planClaudeSplit(root, pay);
  expect(p.willSplit).toBe(true);
  expect(p.report.additions.some((a) => a.includes("CodeGraph"))).toBe(true);
  expect(p.global).toContain("CodeGraph");
  expect(p.globalExists).toBe(false);
  expect(p.injectImport).toBe(true);                                  // template has no GLOBAL import line
  expect(planClaudeSplit(root, tmp("lu-spx-")).willSplit).toBe(false); // payload ships no CLAUDE.template.md
});

test("applyClaudeSplit + undo: backs up CLAUDE.md, writes GLOBAL.md + base, undo restores (#split)", () => {
  const root = tmp("lu-sa-"), pay = tmp("lu-sap-"); const bak = join(root, "..", "bak-sa-" + Date.now());
  tree(root, ["LIFEOS/USER/CUSTOMIZATIONS"], { "CLAUDE.md": "## LifeOS System\n\n- **CodeGraph** — mine" });
  writeFileSync(join(pay, "CLAUDE.template.md"), "## LifeOS System\n\n- **Memory** — `x`");
  mkdirSync(bak, { recursive: true });
  const undo = applyClaudeSplit(root, pay, bak, planClaudeSplit(root, pay));
  const newClaude = readFileSync(join(root, "CLAUDE.md"), "utf8");
  expect(newClaude).toContain("Memory");                                             // base deployed
  expect(newClaude).not.toContain("CodeGraph");                                      // customization out of CLAUDE.md
  expect(newClaude).toContain("@LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md");              // import injected (commented)
  expect(readFileSync(join(root, "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md"), "utf8")).toContain("CodeGraph");
  expect(readFileSync(undo.claudeBackup, "utf8")).toContain("CodeGraph");            // old CLAUDE.md backed up
  const failed = undoClaudeSplit(root, undo);
  expect(failed).toEqual([]);
  expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toContain("CodeGraph");      // restored
  expect(existsSync(join(root, "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md"))).toBe(false); // created GLOBAL removed
  rmSync(bak, { recursive: true, force: true });
});

test("applyClaudeSplit: never overwrites an existing GLOBAL.md (#split-safety)", () => {
  const root = tmp("lu-sg-"), pay = tmp("lu-sgp-"); const bak = join(root, "..", "bak-sg-" + Date.now());
  tree(root, ["LIFEOS/USER/CUSTOMIZATIONS"], {
    "CLAUDE.md": "## LifeOS System\n\n- **CodeGraph** — mine",
    "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md": "MY CURATED CUSTOMIZATIONS",
  });
  writeFileSync(join(pay, "CLAUDE.template.md"), "## LifeOS System\n\n- **Memory** — `x`");
  mkdirSync(bak, { recursive: true });
  const plan = planClaudeSplit(root, pay);
  expect(plan.globalExists).toBe(true);
  const undo = applyClaudeSplit(root, pay, bak, plan);
  expect(readFileSync(join(root, "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md"), "utf8")).toBe("MY CURATED CUSTOMIZATIONS"); // untouched
  expect(undo.globalCreated).toBeUndefined();                          // did not create/overwrite it
  rmSync(bak, { recursive: true, force: true });
});

test("applyClaudeSplit: re-checks GLOBAL.md at WRITE time — no plan→apply TOCTOU clobber (#split-safety-L3)", () => {
  const root = tmp("lu-st-"), pay = tmp("lu-stp-"); const bak = join(root, "..", "bak-st-" + Date.now());
  tree(root, ["LIFEOS/USER/CUSTOMIZATIONS"], { "CLAUDE.md": "## LifeOS System\n\n- **CodeGraph** — mine" });
  writeFileSync(join(pay, "CLAUDE.template.md"), "## LifeOS System\n\n- **Memory** — `x`");
  const plan = planClaudeSplit(root, pay);
  expect(plan.globalExists).toBe(false);                                              // plan captured BEFORE the file appears
  writeFileSync(join(root, "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md"), "APPEARED AFTER PLAN");  // created between plan and apply
  const undo = applyClaudeSplit(root, pay, bak, plan);
  expect(readFileSync(join(root, "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md"), "utf8")).toBe("APPEARED AFTER PLAN"); // NOT clobbered
  expect(undo.globalCreated).toBeUndefined();
  rmSync(bak, { recursive: true, force: true });
});

test("applyClaudeSplit: throw BEFORE CLAUDE.md write self-cleans — CLAUDE.md untouched (#TR2a)", () => {
  const root = tmp("lu-t2a-"), pay = tmp("lu-t2ap-"); const bak = trackedPath("bak-t2a-" + Date.now());
  tree(root, ["LIFEOS/USER"], { "CLAUDE.md": "## LifeOS System\n\n- **CodeGraph** — mine" });
  writeFileSync(join(root, "LIFEOS/USER/CUSTOMIZATIONS"), "A FILE, NOT A DIR");   // makes ensureParentDir(GLOBAL) throw
  writeFileSync(join(pay, "CLAUDE.template.md"), "## LifeOS System\n\n- **Memory** — `x`");
  mkdirSync(bak, { recursive: true });
  const plan = planClaudeSplit(root, pay);
  expect(plan.willSplit).toBe(true);
  expect(() => applyClaudeSplit(root, pay, bak, plan)).toThrow();                  // forced failure fires the catch
  expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toContain("CodeGraph");    // CLAUDE.md untouched
  expect(readFileSync(join(bak, "CLAUDE.md.pre-split"), "utf8")).toContain("CodeGraph"); // backup was written first
});

test("applyClaudeSplit: throw AFTER GLOBAL write removes the partial GLOBAL.md (#TR2b)", () => {
  const root = tmp("lu-t2b-"), pay = tmp("lu-t2bp-"); const bak = trackedPath("bak-t2b-" + Date.now());
  tree(root, ["LIFEOS/USER/CUSTOMIZATIONS"], { "CLAUDE.md": "## LifeOS System\n\n- **CodeGraph** — mine" });
  writeFileSync(join(pay, "CLAUDE.template.md"), "## LifeOS System\n\n- **Memory** — `x`");
  mkdirSync(bak, { recursive: true });
  const plan = planClaudeSplit(root, pay);
  rmSync(join(pay, "CLAUDE.template.md"));                                         // vanish the template between plan and apply
  expect(() => applyClaudeSplit(root, pay, bak, plan)).toThrow();                  // readFileSync(template) throws AFTER GLOBAL write
  expect(existsSync(join(root, "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md"))).toBe(false); // partial GLOBAL cleaned up
  expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toContain("CodeGraph");    // CLAUDE.md untouched
});

const TOOL_PATH = new URL("./LifeosUpgrade.ts", import.meta.url).pathname;

test("main() dry-run via subprocess: exit 0, renders plan, mutates NOTHING (#TR1)", () => {
  const root = tmp("lu-m1-"), pay = tmp("lu-m1p-");
  tree(root, ["LIFEOS/TOOLS", "LIFEOS/USER"], { "LIFEOS/TOOLS/orig.ts": "ORIG", "CLAUDE.md": "x", "settings.json": "{}" });
  tree(pay, ["LIFEOS/TOOLS"], { "LIFEOS/TOOLS/new.ts": "NEW" });
  const r = Bun.spawnSync(["bun", TOOL_PATH, "--payload", pay, "--config-root", root]);
  expect(r.exitCode).toBe(0);
  expect(r.stdout.toString()).toContain("DRY-RUN");
  expect(readFileSync(join(root, "LIFEOS/TOOLS/orig.ts"), "utf8")).toBe("ORIG");   // nothing changed
  expect(existsSync(join(root, "LIFEOS/TOOLS/new.ts"))).toBe(false);
});

test("main() apply via subprocess: backup precedes delete; SYSTEM replaced, USER preserved (#TR1)", () => {
  const root = tmp("lu-m2-"), pay = tmp("lu-m2p-"); const bak = trackedPath("bak-m2-" + Date.now());
  tree(root, ["LIFEOS/TOOLS", "LIFEOS/USER"], {
    "LIFEOS/TOOLS/orig.ts": "ORIG", "LIFEOS/USER/keep.md": "USER", "CLAUDE.md": "MY CLAUDE", "settings.json": "{}",
  });
  tree(pay, ["LIFEOS/TOOLS"], { "LIFEOS/TOOLS/new.ts": "NEW" });
  const r = Bun.spawnSync(["bun", TOOL_PATH, "--payload", pay, "--config-root", root, "--apply", "--backup-dir", bak]);
  expect(r.exitCode).toBe(0);
  expect(readFileSync(join(bak, "LIFEOS/TOOLS/orig.ts"), "utf8")).toBe("ORIG");    // backup holds the ORIGINAL → backup preceded delete
  expect(readFileSync(join(root, "LIFEOS/TOOLS/new.ts"), "utf8")).toBe("NEW");     // payload deployed
  expect(existsSync(join(root, "LIFEOS/TOOLS/orig.ts"))).toBe(false);              // upstream deletion honored
  expect(readFileSync(join(root, "LIFEOS/USER/keep.md"), "utf8")).toBe("USER");    // USER preserved
  expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toBe("MY CLAUDE");         // CLAUDE.md preserved (no --split-claude-md)
});

test("split + rollback compose: deploy failure restores CLAUDE.md, removes GLOBAL, restores SYSTEM (#split-rollback)", () => {
  const root = tmp("lu-srb-"), pay = tmp("lu-srbp-"); const bak = join(root, "..", "bak-srb-" + Date.now());
  tree(root, ["LIFEOS/TOOLS", "LIFEOS/USER/CUSTOMIZATIONS"], {
    "CLAUDE.md": "## LifeOS System\n\n- **CodeGraph** — mine",
    "LIFEOS/TOOLS/orig.ts": "ORIG",
  });
  writeFileSync(join(pay, "CLAUDE.template.md"), "## LifeOS System\n\n- **Memory** — `x`");
  // NB: do NOT pre-create bak — scopedBackup refuses an existing backup dir (safety) and creates it itself.

  // mirror main()'s order: scoped backup → split → snapshot → (clear + partial deploy) → FAIL → undo split → rollback
  const clear = ["LIFEOS/TOOLS"];
  scopedBackup(root, bak, clear);
  const splitUndo = applyClaudeSplit(root, pay, bak, planClaudeSplit(root, pay));
  const snap = snapshotDeployTargets(root, [{ src: "LIFEOS", dest: "LIFEOS" }]);
  expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).not.toContain("CodeGraph");     // split took effect
  expect(existsSync(join(root, "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md"))).toBe(true);

  safeRemove(root, "LIFEOS/TOOLS"); mkdirSync(join(root, "LIFEOS/TOOLS"), { recursive: true }); writeFileSync(join(root, "LIFEOS/TOOLS/new.ts"), "NEW");
  const sf = undoClaudeSplit(root, splitUndo);        // main()'s catch order: split undo first…
  const failed = rollback(root, bak, clear, snap);    // …then SYSTEM rollback

  expect(sf).toEqual([]);
  expect(failed).toEqual([]);
  expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toContain("CodeGraph");          // CLAUDE.md fully restored
  expect(existsSync(join(root, "LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md"))).toBe(false);     // split-created GLOBAL removed
  expect(readFileSync(join(root, "LIFEOS/TOOLS/orig.ts"), "utf8")).toBe("ORIG");          // SYSTEM restored
  expect(existsSync(join(root, "LIFEOS/TOOLS/new.ts"))).toBe(false);                      // deploy remnant gone
  rmSync(bak, { recursive: true, force: true });
});
