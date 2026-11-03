/**
 * @version 1.4.42
 */
// containment-zones.ts — release-pipeline zone inventory.
//
// A zone is a named set of path patterns whose contents are allowed to contain
// personal identity, credentials, or infrastructure IDs. Anything outside every
// zone must stay clean per LIFEOS/DOCUMENTATION/Tools/Containment.md.
//
// Consumed by two enforcement points:
//   1. Release pipeline gates in the release tooling (build-time).
//   2. The pre-commit leak scan (LIFEOS/TOOLS/githooks/StagedLeakScan.ts),
//      through system-file-guard-core's evaluateWrite(), which reads
//      CONTAINMENT_ZONES via isContained() to decide whether a staged path is
//      USER (allowed to hold identity) or SYSTEM (must be deny-list clean).
//
// Path patterns are matched relative to CLAUDE_ROOT (the .claude directory
// root, resolved from HOME). `**` means "anywhere under this prefix". A bare
// path means "this exact file or directory (and anything inside it)".

import { rootRelativeKey } from "./portable-path";

export interface ContainmentZone {
  name: string;
  patterns: readonly string[];
  description: string;
}

export const CONTAINMENT_ZONES: readonly ContainmentZone[] = [
  {
    name: "user-data",
    patterns: ["LIFEOS/USER/**"],
    description: "Principal identity, TELOS, credentials, personal infrastructure, contacts, finances, health, business",
  },
  {
    name: "config-secrets",
    patterns: [
      "settings.json",
      "settings.local.json",
      ".vscode/settings.json",
      ".env",
      ".env.*",
      "LIFEOS/.env",
      "LIFEOS/.env.*",
    ],
    description: "Shell env with API keys, allowed command lists, MCP auth",
  },
  {
    name: "runtime-memory",
    patterns: ["LIFEOS/MEMORY/**"],
    description: "Work sessions, learnings, observability logs, research, raw data, bookmarks, relationship notes",
  },
  {
    name: "private-skills",
    patterns: ["skills/_*/**"],
    description: "Skills with underscore-prefixed names — personal and proprietary",
  },
  {
    name: "install-state",
    patterns: [
      "history.jsonl",
      "Plugins/**",
      "Plugins/installed_plugins.json",
      "Plugins/known_marketplaces.json",
      // public issue #1719, @catchingknives — pattern matching here is
      // case-SENSITIVE (componentMatch uses ===/startsWith/endsWith). macOS
      // hides this because the filesystem is case-insensitive, but Linux
      // harnesses write a lowercase plugins/ and it fell outside every zone.
      // Both spellings are carried: this install's real dir is capital-P, and
      // an extra zone only ever excludes MORE from the public payload.
      "plugins/**",
      "plugins/installed_plugins.json",
      "plugins/known_marketplaces.json",
      "debug/**",
      "debug",
      // Classed sensitive at release time too (ShadowRelease RSYNC excludes +
      // ROOT_RUNTIME_STATE_DENY) — keep both surfaces in agreement. Parity is
      // enforced by test/regression/runtime-state-zone-parity.test.ts: every
      // file-shaped ROOT_RUNTIME_STATE_DENY entry must be zone-covered.
      "remote-settings.json",
      "stats-cache.json",
      "stats.json",
      "ids.txt",
      "checkpoint-repos.txt",
      // Claude Code daemon supervisor (v2.1.233+): control.key, roster, dispatch mailbox,
      // the daemon log, and the job pin file — harness-owned, found tracked at the 7.50.0
      // zone review; also in ROOT_RUNTIME_STATE_DENY + rsync excludes (parity test above).
      "daemon/**",
      "daemon",
      "daemon.log",
      "jobs/**",
      "jobs",
    ],
    description: "Claude Code runtime install state written by the harness — plugin registry (both Plugins/ and Linux's lowercase plugins/), history, remote-settings.json, and debug/ session transcripts (the debug/latest symlink and per-session .txt dumps; runtime output, never ships)",
  },
  {
    name: "private-infra",
    patterns: [
      "LIFEOS/WORKFLOWS/v1/**",
      "LIFEOS/PULSE/Assistant/state/**",
      "LIFEOS/PULSE/Plans/**",
      "LIFEOS/PULSE/logs/**",
      "LIFEOS/PULSE/state/**",
      // The LIVE out/ (this machine's rendered dashboard state) never ships.
      // The release DOES ship a dashboard bundle at the same path: ShadowRelease
      // Phase E (buildStagedDashboard) rebuilds it fresh inside staging and G11
      // scans the rendered HTML for identity. Zone = live tree; rebuild = payload.
      "LIFEOS/PULSE/Observability/out/**",
      "LIFEOS/PULSE/.playwright-cli/**",
      "LIFEOS/PULSE/Bunker/**",
      // Vigil is not zoned: its engine and skill ship, and the install's personal
      // adapters live in LIFEOS/USER/VIGIL/ under user-data (Vigil ISA F14).
      // Watches emit through Vigil and read hyper-local personal sources (utility, roads, city, mentions).
      "LIFEOS/WATCHES/**",
      "LIFEOS/ScheduledTasks/**",
    ],
    description: "Top-level private infrastructure dirs (the Workflows v1 tree, now LIFEOS/WORKFLOWS/v1, left this zone 2026-09-09: the runner, declarative workflow format and example actions are SYSTEM and ship; a user's own worker code stays in LIFEOS/USER/CUSTOMIZATIONS/WORKFLOWS): Assistant runtime state (diary jsonl), planning docs, runtime logs/state, rendered HTML, Bunker app-harness code (personal probe targets + alert email; concept ships via DOCUMENTATION, impl stays private)",
  },
  // The private offensive-security surface (pentest-cognition tool, its PostToolUse
  // gate, and the private-gate registry StopGates loads via an existsSync guard) is
  // release-excluded through the operative exclusion lists in the non-shipping
  // ShadowRelease.ts — NOT named here. This inventory file ships in the public payload,
  // and G18 forbids the codename in any lexical form, so listing those paths here would
  // make the inventory itself the leak (self-referential redaction blind spot, 2026-08-17).
  {
    name: "pre-sanitization-backups",
    patterns: [
      "LIFEOS/Backups/**",
    ],
    description: "Pre-sanitization snapshots of SYSTEM files (e.g. LIFEOS_SYSTEM_PROMPT pre-restructure copies). Legitimately retain identity literals from before sanitization; never ship publicly. Already excluded from staging by RSYNC_EXCLUDES — this zone makes DenyListCheck classify them as private-zone rather than real-leak.",
  },
  {
    name: "skill-runtime-data",
    patterns: [
      "skills/*/profile-data/**",
      "skills/*/state/**",
      // Capital-case variants: real skill dirs are TitleCase (State/, Cache/, Logs/)
      // and the matcher is case-sensitive, so the lowercase patterns alone MISSED
      // them. RSYNC_EXCLUDES already covers these; keeping the zone in sync so
      // DenyListCheck classifies them as private-zone, not a real-leak false alarm
      // (2026-08-11 skill/data-separation audit).
      "skills/*/State/**",
      "skills/*/cache/**",
      "skills/*/Cache/**",
      "skills/*/Logs/**",
      "skills/*/.playwright-cli/**",
      "skills/*/.cache/**",
      "skills/*/node_modules/**",
    ],
    description: "Runtime data accumulated under public-named skills — Chrome profiles (Interceptor), per-skill caches, state JSONLs, build artifacts. These directories collect secrets and machine-bound state during normal use and must never ship publicly even though their parent skill is TitleCase (public).",
  },
  {
    name: "security-sdk-runtime",
    patterns: [
      "security/**",
    ],
    description: "Agent-SDK runtime/bootstrap state for security skills — python venv (agent-sdk-venv), .sdk_bootstrap_spawned marker, warning-state JSON, lock files, log.txt. Untracked machine-bound build artifacts; never ship. (Zoned 2026-05-31 after a shadow release surfaced the unzoned venv tripping G4/G13.)",
  },
];

// Files outside containment that must still be allowed to embed patterns
// (pattern inspectors, policy docs that describe the patterns, etc.). Keep
// minimal — these are tracked in the living appendix of CONTAINMENT_POLICY.md.
export const PATTERN_ALLOWLIST_FILES: readonly string[] = [
  "hooks/lib/containment-zones.ts",
  "skills/_LIFEOS/Tools/ShadowRelease.ts",
  "LIFEOS/DOCUMENTATION/Tools/Containment.md",
  "skills/_DAEMON/Tools/SecurityFilter.ts",
  "skills/CreateSkill/Intents/ValidateSkill.md",
  "LIFEOS/TOOLS/SessionHarvester.ts",
  "LIFEOS/TOOLS/gmail.ts",
  // NOTE for public installs: some allowlisted paths below (test files, private
  // release tooling) do not SHIP in the release payload. That is coherent, not
  // stale: an allowlist entry for an absent file matches nothing and allows
  // nothing — fail-closed by construction. The inventory describes the
  // maintainer tree, where these gates actually run. (Cross-vendor audit
  // finding, 7.43.0 cut, dispositioned as-designed with this note.)
  // SystemFileGuard test file legitimately embeds deny-list pattern literals
  // as test fixtures — the whole point is verifying the gate catches them.
  "hooks/SystemFileGuard.test.ts",
  // 2026-07-20 — the public install flow embeds the public install URL
  // (the `curl -fsSL <project site>/install.sh` line) BY DESIGN: that domain is
  // the project's public marketing/install site, and these files are the shipped
  // install path + brand-asset doc. Reviewed hit-by-hit before allowlisting;
  // only the install-domain pattern fires in them.
  "skills/LifeOS/SKILL.md",
  "skills/LifeOS/INSTALL.md",
  "skills/LifeOS/install/install.sh",
  // The public repo README (template overlay lands at staging root README.md).
  // Author attribution — blog/social links, contributor credits — is BY DESIGN
  // here and already public in the LifeOS repo on GitHub; the star-history
  // README refresh (2026-07-17) made G2 fire on it. Allowlisting also skips the
  // token sanitizer so the links ship intact. (Principal approved 2026-07-21.)
  "README.md",
  "LIFEOS/DOCUMENTATION/BrandAssets.md",
  // 2026-10-10: community leaderboard service address, a data-only file (Leaderboard ISA ISC-95). Principal approved.
  "LIFEOS/TOOLS/leaderboard-endpoint.json",
  // Fabric quiz/answer patterns that use standard ML terminology.
  // Allowed past G2.
  "skills/Fabric/Patterns/create_quiz/README.md",
  "skills/Fabric/Patterns/analyze_answers/README.md",
  // Phase G.5 (added 2026-05-25 after Forge iter-4) — files that legitimately
  // embed pattern literals as functional or doctrine content:
  //   - DocsPublicAudit.ts defines the patterns it audits (maintainer-side, not shipped; the entry is inert on an install)
  //   - CLAUDE.md (live) gets overlaid by RELEASE_TEMPLATES/CLAUDE.public.md
  //     at build time — the live form ships only to the principal; the public
  //     ship is the template overlay. Verified: staged CLAUDE.md is clean.
  // NOTE (Phase G.6, 2026-05-25 after Forge iter-5): `LIFEOS/TOOLS/LifeosUpgrade.ts`
  // and `LIFEOS/PULSE/Tools/ReleaseAudit.ts` were REMOVED from this allowlist.
  // LifeosUpgrade.ts now uses a generic marker comment instead of the previous
  // principal-bound repo-name literal; ReleaseAudit.ts now loads its prohibited
  // strings from a USER-zone config file at runtime (never ships publicly).
  // Allowlist became an escape hatch hiding real bare-token leaks — fixed at
  // the source instead.
  "LIFEOS/TOOLS/DocsPublicAudit.ts", // maintainer-side, not shipped
  "CLAUDE.md",
];

// Component-wise glob match. Handles `*` within a single path segment and
// `**` as a terminal wildcard meaning "any remaining components, including zero".
function componentMatch(component: string, glob: string): boolean {
  if (glob === "*") return true;
  if (!glob.includes("*")) return component === glob;
  const parts = glob.split("*");
  if (!component.startsWith(parts[0])) return false;
  let cursor = parts[0].length;
  for (let i = 1; i < parts.length - 1; i += 1) {
    const idx = component.indexOf(parts[i], cursor);
    if (idx < 0) return false;
    cursor = idx + parts[i].length;
  }
  const tail = parts[parts.length - 1];
  if (tail === "") return true;
  return component.endsWith(tail) && component.length >= cursor + tail.length;
}

export function matchesPattern(relPath: string, pattern: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = relPath === "" ? [] : relPath.split("/");
  let pi = 0;
  let i = 0;
  while (pi < patternParts.length) {
    const pp = patternParts[pi];
    // public issue #1869, @garthsch — `**` is TERMINAL-only. A bare `return true`
    // here made a leading or mid-pattern `**` match every path, failing isContained()
    // open for every consumer. Terminal `**` behavior is unchanged.
    if (pp === "**") return pi === patternParts.length - 1;
    if (i >= pathParts.length) return false;
    if (!componentMatch(pathParts[i], pp)) return false;
    pi += 1;
    i += 1;
  }
  return i === pathParts.length;
}

// Normalize an absolute path to the path relative to CLAUDE_ROOT. Returns
// the input unchanged if it does not live under CLAUDE_ROOT.
export function relativeToClaudeRoot(absolutePath: string, claudeRoot: string): string {
  // "/"-keyed on every platform: a Windows path left absolute matched no zone pattern, so containment failed open.
  return rootRelativeKey(claudeRoot, absolutePath) ?? absolutePath;
}

// Predicate: is this path inside any configured containment zone?
export function isContained(absolutePath: string, claudeRoot: string): boolean {
  const rel = relativeToClaudeRoot(absolutePath, claudeRoot);
  for (const zone of CONTAINMENT_ZONES) {
    for (const pattern of zone.patterns) {
      if (matchesPattern(rel, pattern)) return true;
    }
  }
  return false;
}

// Predicate: is this relative path in the pattern-embedding allowlist?
export function isPatternAllowlisted(relativePath: string): boolean {
  return PATTERN_ALLOWLIST_FILES.includes(relativePath);
}
