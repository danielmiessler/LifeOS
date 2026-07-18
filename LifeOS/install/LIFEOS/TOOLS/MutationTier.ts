#!/usr/bin/env bun
/**
 * MutationTier — four-tier autonomic-mutation boundary classifier.
 *
 * LifeOS autonomic memory subsystem, F8.
 *
 * Classifies any absolute path under ~/.claude/ into one of four tiers that
 * govern what the Memory Reviewer subprocess is allowed to do with it:
 *
 *   Tier A — fully autonomic. Reviewer Phase 1 may set-overwrite via MemoryWriter.
 *            (the two _MEMORY.md hot-layer files)
 *
 *   Tier B — logged-append only. Reviewer Phase 2 may append, writing a row to
 *            tier-b-writes.jsonl per write.
 *            (PROJECTS.md, CONTACTS.md, anything under MEMORY/KNOWLEDGE/)
 *
 *   Tier C — propose-only. Reviewer Phase 1 may queue an identity-doctrine
 *            proposal to be surfaced via Telegram (loud) or applied silently
 *            (quiet) per the confidence threshold; never direct-Edit.
 *            (PRINCIPAL_IDENTITY, DA_IDENTITY, WRITINGSTYLE, DEFINITIONS,
 *            CANONICAL_CONTENT, RESUME)
 *
 *   Tier D — untouchable. Reviewer dispatcher rejects any Edit attempt.
 *            (default for everything not on a Tier A/B/C list)
 *
 * The classifier is an ALLOWLIST, not a denylist (ISC-105): a new file added
 * to ~/.claude/ is by default unreachable to the reviewer. Tier classifications
 * are hard-coded in this file (ISC-106): there is no config-file override
 * path — changing a tier requires editing this code, reviewing, committing.
 *
 * CLI:
 *   bun MutationTier.ts classify <absolute-path>
 *   bun MutationTier.ts test                       (smoke test — exit 0 on pass)
 */

import { resolve as pathResolve } from "node:path";
import { homedir } from "node:os";
import { claudeDir } from "./lifeos-root";

// ── Constants ──

const CLAUDE_ROOT = pathResolve(claudeDir());

export type Tier = "A" | "B" | "C" | "D";

/** Tier A: fully-autonomic memory hot-layer files. */
const TIER_A_FILES: ReadonlySet<string> = new Set([
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md"),
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md"),
]);

/** Tier B: append-with-audit files (exact-match paths). */
const TIER_B_FILES: ReadonlySet<string> = new Set([
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PROJECTS.md"),
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/CONTACTS.md"),
]);

/** Tier B: append-with-audit prefixes (any file beneath these dirs is Tier B). */
const TIER_B_PREFIXES: readonly string[] = [
  pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/KNOWLEDGE") + "/",
  pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/IDEAS") + "/",
];

/** Tier C: propose-only identity-doctrine files (exact-match paths). */
const TIER_C_FILES: ReadonlySet<string> = new Set([
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md"),
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md"),
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/WRITINGSTYLE.md"),
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DEFINITIONS.md"),
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/CANONICAL_CONTENT.md"),
  pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/RESUME.md"),
]);

// ── Public API ──

/**
 * Classify an absolute path into one of four mutation tiers.
 *
 * The argument MUST be absolute (caller should `path.resolve()` first). Symlink
 * resolution is the caller's responsibility — this classifier matches on the
 * canonical absolute path string only, by design: it must be cheap, sync, and
 * untrickable by relative-path games.
 *
 * Returns 'D' (untouchable) for any path that is not explicitly on a higher
 * tier's allowlist. This default-deny posture is intentional: a brand-new file
 * added to ~/.claude/ is unreachable to the reviewer until a code change
 * explicitly raises its tier.
 */
export function getTier(absolutePath: string): Tier {
  if (!absolutePath.startsWith("/")) {
    // Defensive: relative paths are always Tier D. The reviewer dispatcher
    // should resolve before classification, but we don't trust the caller.
    return "D";
  }

  const abs = pathResolve(absolutePath);

  if (TIER_A_FILES.has(abs)) return "A";
  if (TIER_B_FILES.has(abs)) return "B";
  for (const prefix of TIER_B_PREFIXES) {
    if (abs.startsWith(prefix)) return "B";
  }
  if (TIER_C_FILES.has(abs)) return "C";

  return "D";
}

/**
 * Human-readable tier name for logs / error messages.
 */
export function tierLabel(t: Tier): string {
  switch (t) {
    case "A": return "A (autonomic set-overwrite)";
    case "B": return "B (append + audit)";
    case "C": return "C (propose-only)";
    case "D": return "D (untouchable)";
  }
}

// ── CLI ──

function smokeTest(): number {
  console.log("MutationTier smoke test starting…");

  interface Case {
    path: string;
    expected: Tier;
    why: string;
  }

  const cases: Case[] = [
    // Tier A — the two memory files
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md"),
      expected: "A",
      why: "PRINCIPAL_MEMORY.md is hot-layer autonomic",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md"),
      expected: "A",
      why: "DA_MEMORY.md is hot-layer autonomic",
    },

    // Tier B — exact-match
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PROJECTS.md"),
      expected: "B",
      why: "PROJECTS.md is append-with-audit",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/CONTACTS.md"),
      expected: "B",
      why: "CONTACTS.md is append-with-audit",
    },

    // Tier B — KNOWLEDGE prefix
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/KNOWLEDGE/People/{{PRINCIPAL_NAME}}.md"),
      expected: "B",
      why: "KNOWLEDGE/People/* is append-with-audit",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/KNOWLEDGE/Ideas/some-idea.md"),
      expected: "B",
      why: "KNOWLEDGE/Ideas/* is append-with-audit",
    },

    // Tier C — six identity-doctrine files
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md"),
      expected: "C",
      why: "PRINCIPAL_IDENTITY.md is propose-only",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md"),
      expected: "C",
      why: "DA_IDENTITY.md is propose-only",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/WRITINGSTYLE.md"),
      expected: "C",
      why: "WRITINGSTYLE.md is propose-only",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/DEFINITIONS.md"),
      expected: "C",
      why: "DEFINITIONS.md is propose-only",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/CANONICAL_CONTENT.md"),
      expected: "C",
      why: "CANONICAL_CONTENT.md is propose-only",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/PRINCIPAL/RESUME.md"),
      expected: "C",
      why: "RESUME.md is propose-only",
    },

    // Tier D — default-deny for anything not on a higher list
    {
      path: pathResolve(CLAUDE_ROOT, "settings.json"),
      expected: "D",
      why: "settings.json is untouchable by reviewer",
    },
    {
      path: pathResolve(CLAUDE_ROOT, ".env"),
      expected: "D",
      why: ".env is untouchable by reviewer",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "hooks/Safety.hook.ts"),
      expected: "D",
      why: "hooks/* is code, untouchable",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "CLAUDE.md"),
      expected: "D",
      why: "CLAUDE.md is code-doctrine, untouchable",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/LIFEOS_SYSTEM_PROMPT.md"),
      expected: "D",
      why: "LIFEOS_SYSTEM_PROMPT.md is constitutional, untouchable",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/ALGORITHM/v6.9.0.md"),
      expected: "D",
      why: "Algorithm/* is doctrine, untouchable",
    },
    {
      path: pathResolve(CLAUDE_ROOT, "skills/ISA/SKILL.md"),
      expected: "D",
      why: "skills/* is doctrine, untouchable",
    },
    // ISC-105 — newly-added arbitrary file defaults to Tier D
    {
      path: pathResolve(CLAUDE_ROOT, "LIFEOS/USER/some_brand_new_file_2026.md"),
      expected: "D",
      why: "ISC-105 anti: unknown file defaults to Tier D",
    },
    // Relative path defensive case
    {
      path: "LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md",
      expected: "D",
      why: "relative path is always Tier D",
    },
  ];

  let pass = 0;
  let fail = 0;
  for (const c of cases) {
    const got = getTier(c.path);
    const ok = got === c.expected;
    if (ok) {
      pass++;
      console.log(`  ✓ ${c.expected}  ${c.path.replace(CLAUDE_ROOT, "~/.claude")}  — ${c.why}`);
    } else {
      fail++;
      console.error(`  ✗ expected ${c.expected}, got ${got}  ${c.path}  — ${c.why}`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed (${cases.length} total)`);
  if (fail === 0) {
    console.log("✓ MutationTier smoke test PASSED");
    return 0;
  }
  console.error("✗ MutationTier smoke test FAILED");
  return 1;
}

function main() {
  const cmd = process.argv[2];
  if (cmd === "test") {
    process.exit(smokeTest());
  }
  if (cmd === "classify") {
    const path = process.argv[3];
    if (!path) {
      console.error("Usage: bun MutationTier.ts classify <absolute-path>");
      process.exit(2);
    }
    const t = getTier(path);
    console.log(JSON.stringify({ path, tier: t, label: tierLabel(t) }));
    process.exit(0);
  }
  console.error("Usage: bun MutationTier.ts {test|classify <absolute-path>}");
  process.exit(2);
}

if (import.meta.main) {
  main();
}
