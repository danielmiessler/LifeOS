#!/usr/bin/env bun
/**
 * LifeosUpgrade.ts — idempotent migration runner + diagnostic harness for LifeOS rebuild.
 *
 * Each migration knows how to detect its own applied state and is safe to re-run.
 * `--diagnose` audits without changes. `--dry-run` prints the apply plan.
 * `default` runs all not-yet-applied migrations in registry order, fail-loud.
 *
 * Designed by: LIFEOS/MEMORY/WORK/20260520-pai-system-user-separation-rebuild/PhaseG-design.md
 *
 * Usage:
 *   bun ~/.claude/LIFEOS/TOOLS/LifeosUpgrade.ts [--diagnose | --dry-run | --from-fresh-install] [--target=<version>]
 *
 * Exit codes:
 *   0  all migrations applied or already-applied (no-op)
 *   1  migration failed; partial state — see error output
 *   2  usage error
 */

import { existsSync, readFileSync, lstatSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { claudeDir } from "./lifeos-root";

const HOME = process.env.HOME ?? homedir();
const CLAUDE_ROOT = join(claudeDir());

interface MigrationContext {
  claudeRoot: string;
  dryRun: boolean;
}

interface Migration {
  id: string;
  name: string;
  isApplied: (ctx: MigrationContext) => boolean;
  apply: (ctx: MigrationContext) => void;
  /** Optional rollback for emergencies; not run automatically. */
  rollback?: (ctx: MigrationContext) => void;
}

// ─── Migration Registry ──────────────────────────────────────────────────────
// Each migration corresponds to a Phase of the rebuild and is idempotent.
// Order matters: earlier migrations are prerequisites for later ones.
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATIONS: Migration[] = [
  {
    id: "m-001",
    name: "Phase B Part 2 — settings.json split into system+user halves",
    isApplied: ({ claudeRoot }) =>
      existsSync(join(claudeRoot, "settings.system.json")) &&
      existsSync(join(claudeRoot, "LIFEOS/USER/CONFIG/settings.user.json")) &&
      existsSync(join(claudeRoot, "LIFEOS/TOOLS/MergeSettings.ts")),
    apply: () => {
      throw new Error("m-001 apply not implemented — Phase B was a hand-migration; auto-apply path would re-derive settings.system.json from a fresh public LifeOS checkout, which only matters during from-fresh-install. For an in-place upgrade, this migration is detected-as-applied or detected-as-missing-and-skipped (manual remediation required).");
    },
  },
  {
    id: "m-002",
    name: "Phase C — CLAUDE.md @-imports the five identity files directly + OPERATIONAL_RULES.md present",
    isApplied: ({ claudeRoot }) => {
      const claudeMd = join(claudeRoot, "CLAUDE.md");
      if (!existsSync(claudeMd)) return false;
      const content = readFileSync(claudeMd, "utf8");
      const requiredImports = [
        "@LIFEOS/USER/TELOS/PRINCIPAL_TELOS.md",
        "@LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md",
        "@LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md",
        "@LIFEOS/USER/PROJECTS.md",
        "@LIFEOS/USER/CONFIG/OPERATIONAL_RULES.md",
      ];
      const allImportsPresent = requiredImports.every((imp) => content.includes(imp));
      const opRulesPresent = existsSync(join(claudeRoot, "LIFEOS/USER/CONFIG/OPERATIONAL_RULES.md"));
      return allImportsPresent && opRulesPresent;
    },
    apply: () => {
      throw new Error("m-002 apply not implemented — Phase C was a hand-migration. For from-fresh-install, the public LifeOS checkout's CLAUDE.md is staged from skills/_LIFEOS/RELEASE_TEMPLATES/CLAUDE.public.md and `pai setup` populates the identity files + adds the @-imports.");
    },
  },
  {
    id: "m-003",
    name: "Phase F — LifeosConfig.ts present + LIFEOS_CONFIG.toml populated",
    isApplied: ({ claudeRoot }) =>
      existsSync(join(claudeRoot, "LIFEOS/TOOLS/LifeosConfig.ts")) &&
      existsSync(join(claudeRoot, "LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml")),
    apply: () => {
      throw new Error("m-003 apply not implemented — LifeosConfig.ts ships with public LifeOS; LIFEOS_CONFIG.toml comes from `pai setup`. Missing artifact requires manual remediation.");
    },
  },
  {
    id: "m-004",
    name: "Phase G — LIFEOS/USER is symlink to user data repo",
    isApplied: ({ claudeRoot }) => {
      const userPath = join(claudeRoot, "LIFEOS/USER");
      if (!existsSync(userPath)) return false;
      try {
        const lst = lstatSync(userPath);
        if (!lst.isSymbolicLink()) return false;
        const target = readlinkSync(userPath);
        return target.length > 0 && existsSync(userPath);
      } catch {
        return false;
      }
    },
    apply: () => {
      throw new Error("m-004 apply requires principal authorization for `gh repo create` + live tree move. Run the Phase G migration session interactively per PhaseG-design.md, NOT via LifeosUpgrade.ts. This migration is detect-only.");
    },
  },
  {
    id: "m-005",
    name: "Phase G — LIFEOS/MEMORY/ in .gitignore",
    isApplied: ({ claudeRoot }) => {
      const gitignore = join(claudeRoot, ".gitignore");
      if (!existsSync(gitignore)) return false;
      const content = readFileSync(gitignore, "utf8");
      // Already-applied if any LIFEOS/MEMORY/ subpath is gitignored. The current
      // policy gitignores LEARNING/, OBSERVABILITY/, STATE/, etc. selectively;
      // Phase G may broaden this. For now, we detect "any LIFEOS/MEMORY/ rule" as
      // applied.
      return /^LifeOS\/MEMORY\//m.test(content);
    },
    apply: () => {
      throw new Error("m-005 apply not implemented — modify .gitignore in source PR rather than via tool. The detect-only check surfaces missing state.");
    },
  },
  {
    id: "m-006",
    name: "Phase E — SystemFileGuard hook registered",
    isApplied: ({ claudeRoot }) => {
      const settingsPath = join(claudeRoot, "settings.json");
      if (!existsSync(settingsPath)) return false;
      try {
        const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
          hooks?: { PreToolUse?: Array<{ matcher?: string; hooks?: Array<{ command?: string }> }> };
        };
        const preTool = settings.hooks?.PreToolUse ?? [];
        return preTool.some((entry) =>
          (entry.hooks ?? []).some((h) => (h.command ?? "").includes("SystemFileGuard.hook.ts")),
        );
      } catch {
        return false;
      }
    },
    apply: () => {
      throw new Error("m-006 apply not implemented — hook entry must be added to settings.system.json (public template), then SessionStart's MergeSettings regenerates settings.json. Detected-as-missing requires manual remediation in public PAI.");
    },
  },
  {
    id: "m-007",
    name: "Phase G — pre-push hook syncs USER-data repo before push",
    isApplied: ({ claudeRoot }) => {
      const hookPath = join(claudeRoot, ".git/hooks/pre-push");
      if (!existsSync(hookPath)) return false;
      try {
        const content = readFileSync(hookPath, "utf8");
        // Generic marker comments the installer writes — no principal-bound
        // repo name in this check. The augmented hook is identified by the
        // "# pai-user-data-sync" marker block AND the lfs handoff line.
        return content.includes("# pai-user-data-sync") && content.includes("git lfs pre-push");
      } catch {
        return false;
      }
    },
    apply: () => {
      throw new Error("m-007 apply not implemented — pre-push hook installation belongs to Phase G execution session (G.4b). The auto-install path requires the user's USER-data repo to exist first; once Phase G EXECUTE runs, this migration's apply will write the hook content (including the `# pai-user-data-sync` marker comment) and back up the original to ~/.claude/.git/hooks/pre-push.pre-G-backup.");
    },
  },
];

// ─── CLI ─────────────────────────────────────────────────────────────────────

function usage(code = 2): never {
  console.log(
    `LifeosUpgrade — idempotent migration runner for LifeOS rebuild\n\n` +
      `Usage:\n` +
      `  bun ${process.argv[1]} --diagnose\n` +
      `  bun ${process.argv[1]} --dry-run\n` +
      `  bun ${process.argv[1]} [--target=<version>]\n` +
      `  bun ${process.argv[1]} --from-fresh-install   (NOT YET IMPLEMENTED)\n` +
      `  bun ${process.argv[1]} --help\n\n` +
      `Exit: 0 success / 1 migration failed / 2 usage error.`,
  );
  process.exit(code);
}

interface CliArgs {
  diagnose: boolean;
  dryRun: boolean;
  fromFreshInstall: boolean;
  target: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { diagnose: false, dryRun: false, fromFreshInstall: false, target: null };
  for (const a of argv) {
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--diagnose") args.diagnose = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--from-fresh-install") args.fromFreshInstall = true;
    else if (a.startsWith("--target=")) args.target = a.slice("--target=".length);
    else {
      console.error(`Unknown argument: ${a}`);
      usage(2);
    }
  }
  return args;
}

function diagnose(ctx: MigrationContext): void {
  console.log(`LifeOS install audit — ${ctx.claudeRoot}\n`);
  console.log("Migration registry status:");
  let appliedCount = 0;
  let missingCount = 0;
  for (const m of MIGRATIONS) {
    const applied = (() => {
      try {
        return m.isApplied(ctx);
      } catch (err) {
        return null;
      }
    })();
    const tag = applied === true ? "✓ APPLIED " : applied === false ? "✗ MISSING " : "? ERROR   ";
    console.log(`  ${tag} ${m.id}  ${m.name}`);
    if (applied === true) appliedCount++;
    else if (applied === false) missingCount++;
  }
  console.log(`\nSummary: ${appliedCount} applied, ${missingCount} missing, of ${MIGRATIONS.length} total.`);
  if (missingCount > 0) {
    console.log(`\nNext step: review missing migrations against PhaseG-design.md and the parent ISA before applying.`);
  } else {
    console.log(`\nInstall is up-to-date through the registered migration set.`);
  }
}

function plan(ctx: MigrationContext): { toApply: Migration[]; alreadyApplied: Migration[] } {
  const toApply: Migration[] = [];
  const alreadyApplied: Migration[] = [];
  for (const m of MIGRATIONS) {
    try {
      if (m.isApplied(ctx)) alreadyApplied.push(m);
      else toApply.push(m);
    } catch (err) {
      console.error(`migration ${m.id} isApplied() threw: ${err instanceof Error ? err.message : String(err)}`);
      toApply.push(m); // err-toward-apply for visibility
    }
  }
  return { toApply, alreadyApplied };
}

function dryRun(ctx: MigrationContext): void {
  const { toApply, alreadyApplied } = plan(ctx);
  console.log(`Already applied (${alreadyApplied.length}):`);
  for (const m of alreadyApplied) console.log(`  ✓ ${m.id}  ${m.name}`);
  console.log(`\nWould apply (${toApply.length}):`);
  for (const m of toApply) console.log(`  → ${m.id}  ${m.name}`);
  if (toApply.length === 0) console.log("  (nothing to do — install is current)");
}

function runMigrations(ctx: MigrationContext): never {
  const { toApply, alreadyApplied } = plan(ctx);
  console.log(`Already applied: ${alreadyApplied.length}/${MIGRATIONS.length}`);
  if (toApply.length === 0) {
    console.log("Nothing to do — install is current.");
    process.exit(0);
  }
  for (const m of toApply) {
    console.log(`\n→ Applying ${m.id}: ${m.name}`);
    try {
      m.apply(ctx);
      console.log(`  ✓ ${m.id} applied`);
    } catch (err) {
      console.error(`  ✗ ${m.id} failed: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`\nMigration halted. Partial state may exist. Review error and re-run after remediation.`);
      process.exit(1);
    }
  }
  console.log(`\nAll ${toApply.length} migrations applied successfully.`);
  process.exit(0);
}

function main(): never {
  const args = parseArgs(process.argv.slice(2));

  // Sanity: must be running against a recognizable LifeOS tree.
  if (!existsSync(join(CLAUDE_ROOT, "LIFEOS"))) {
    console.error(`LifeosUpgrade: ${CLAUDE_ROOT}/PAI not found — is this a LifeOS install?`);
    process.exit(2);
  }

  const ctx: MigrationContext = { claudeRoot: CLAUDE_ROOT, dryRun: args.dryRun };

  if (args.fromFreshInstall) {
    console.error(`--from-fresh-install is NOT YET IMPLEMENTED. See PhaseG-design.md for the design; the install.sh path is the current way to scaffold a fresh LifeOS tree.`);
    process.exit(2);
  }

  if (args.diagnose) {
    diagnose(ctx);
    process.exit(0);
  }

  if (args.dryRun) {
    dryRun(ctx);
    process.exit(0);
  }

  runMigrations(ctx);
}

main();
