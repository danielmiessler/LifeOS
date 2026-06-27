// containment-zones.ts — single source of truth for the containment zones.
//
// A zone is a named set of path patterns whose contents are allowed to contain
// personal identity, credentials, or infrastructure IDs. Anything outside every
// zone must stay clean per PAI/DOCUMENTATION/Tools/Containment.md.
//
// Both the prospective guard (hooks/ContainmentGuard.hook.ts) and the
// retrospective release gates (skills/_PAI/TOOLS/ShadowRelease.ts) import
// from here. Add, remove, or rename zones in one place.
//
// Path patterns are matched relative to their declared root: the selected
// harness home for hooks/skills/config, or PAI_DIR for USER/MEMORY/runtime
// data. `**` means "anywhere under this prefix". A bare path means "this
// exact file or directory (and anything inside it)".

export interface ContainmentZone {
  name: string;
  root: "harness" | "pai";
  patterns: readonly string[];
  description: string;
}

export const CONTAINMENT_ZONES: readonly ContainmentZone[] = [
  {
    name: "user-data",
    root: "pai",
    patterns: ["USER/**"],
    description: "Principal identity, TELOS, credentials, personal infrastructure, contacts, finances, health, business",
  },
  {
    name: "harness-config-secrets",
    root: "harness",
    patterns: [
      "settings.json",
      "settings.local.json",
      ".vscode/settings.json",
      ".env",
      ".env.*",
    ],
    description: "Shell env with API keys, allowed command lists, MCP auth",
  },
  {
    name: "pai-config-secrets",
    root: "pai",
    patterns: [".env", ".env.*", "settings.json"],
    description: "PAI runtime settings and env symlink/cache",
  },
  {
    name: "runtime-memory",
    root: "pai",
    patterns: ["MEMORY/**"],
    description: "Work sessions, learnings, observability logs, research, raw data, bookmarks, relationship notes",
  },
  {
    name: "private-skills",
    root: "harness",
    patterns: ["skills/_*/**"],
    description: "Skills with underscore-prefixed names — personal and proprietary",
  },
  {
    name: "install-state",
    root: "harness",
    patterns: [
      "history.jsonl",
      "Plugins/**",
      "plugins/installed_plugins.json",
      "plugins/known_marketplaces.json",
    ],
    description: "Agent harness runtime install state written by the harness",
  },
  {
    name: "private-infra",
    root: "pai",
    patterns: [
      "ARBOL/**",
      "PULSE/Assistant/**",
      "PULSE/Plans/**",
      "PULSE/logs/**",
      "PULSE/state/**",
      "PULSE/Observability/out/**",
      "PULSE/.playwright-cli/**",
      "ScheduledTasks/**",
    ],
    description: "Top-level private infrastructure dirs: cloud worker code, DA-specific assistant, planning docs, runtime logs/state, rendered HTML",
  },
];

// Files outside containment that must still be allowed to embed patterns
// (pattern inspectors, policy docs that describe the patterns, etc.). Keep
// minimal — these are tracked in the living appendix of CONTAINMENT_POLICY.md.
export const PATTERN_ALLOWLIST_FILES: readonly string[] = [
  "hooks/ContainmentGuard.hook.ts",
  "hooks/lib/containment-zones.ts",
  "hooks/security/inspectors/PatternInspector.ts",
  "skills/_PAI/TOOLS/ShadowRelease.ts",
  "PAI/DOCUMENTATION/Tools/Containment.md",
  "skills/Daemon/Docs/SecurityClassification.md",
  "skills/Daemon/Tools/SecurityFilter.ts",
  "skills/CreateSkill/Workflows/ValidateSkill.md",
  "PAI/TOOLS/SessionHarvester.ts",
  "PAI/TOOLS/gmail.ts",
  // Fabric quiz/answer patterns that legitimately use "unsupervised learning"
  // as ML terminology (not as a brand name). Allowed past G2.
  "skills/Fabric/Patterns/create_quiz/README.md",
  "skills/Fabric/Patterns/analyze_answers/README.md",
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

function matchesPattern(relPath: string, pattern: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = relPath === "" ? [] : relPath.split("/");
  let pi = 0;
  let i = 0;
  while (pi < patternParts.length) {
    const pp = patternParts[pi];
    if (pp === "**") return true;
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
  if (absolutePath === claudeRoot) return "";
  const prefix = claudeRoot.endsWith("/") ? claudeRoot : claudeRoot + "/";
  return absolutePath.startsWith(prefix) ? absolutePath.slice(prefix.length) : absolutePath;
}

function relativeToRoot(absolutePath: string, root: string): string | null {
  if (absolutePath === root) return "";
  const prefix = root.endsWith("/") ? root : root + "/";
  return absolutePath.startsWith(prefix) ? absolutePath.slice(prefix.length) : null;
}

// Predicate: is this path inside any configured containment zone?
export function isContained(absolutePath: string, harnessRoot: string, paiRoot = `${harnessRoot}/PAI`): boolean {
  for (const zone of CONTAINMENT_ZONES) {
    const root = zone.root === "pai" ? paiRoot : harnessRoot;
    const rel = relativeToRoot(absolutePath, root);
    if (rel === null) continue;
    for (const pattern of zone.patterns) {
      if (matchesPattern(rel, pattern)) return true;
    }
  }
  return false;
}

// Predicate: is this relative path in the pattern-embedding allowlist?
export function isPatternAllowlisted(absolutePath: string, harnessRoot: string, paiRoot = `${harnessRoot}/PAI`): boolean {
  const harnessRel = relativeToRoot(absolutePath, harnessRoot);
  if (harnessRel !== null && PATTERN_ALLOWLIST_FILES.includes(harnessRel)) return true;

  const paiRel = relativeToRoot(absolutePath, paiRoot);
  if (paiRel === null) return false;
  return PATTERN_ALLOWLIST_FILES.includes(paiRel) ||
    PATTERN_ALLOWLIST_FILES.includes(`PAI/${paiRel}`);
}
