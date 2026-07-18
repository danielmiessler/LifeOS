#!/usr/bin/env bun
/**
 * MemoryTypes — frozen type registry for LifeOS's unified memory subsystem.
 *
 * LifeOS autonomic memory subsystem, F12.
 *
 * Every item in the memory system has a `type`. The type tells the system:
 *   - WHERE the item is stored (storage_path_resolver)
 *   - WHEN it loads into context (load_timing)
 *   - WHAT tier governs writes to it (tier — orthogonal to type; permissions vs data)
 *   - HOW the writer persists it (write_mode)
 *
 * Four initial types. Extensible by adding a registry entry — no other code
 * changes required.
 *
 *   memory     — durable fact about {{PRINCIPAL_NAME}} or {{DA_NAME}} (hot-layer, always loaded)
 *   idea       — captured thought / insight (loads on relevance)
 *   knowledge  — entity note: person / company / research (loads on relevance)
 *   proposal   — low-confidence identity edit awaiting principal approval
 *
 * The registry is `Object.freeze`d at module load (ISC-160). A new type means
 * appending a registry entry, reviewing the change, committing — never a
 * runtime mutation.
 *
 * FORKS: this file is regenerated at release, so a fork that appends a type
 * here is carrying a patch and will see it clobbered/conflicted on pull. That
 * is a deliberate trade-off (LifeOS#1450): the registry and the MutationTier
 * allowlist are tamper boundaries, kept closed rather than extended via a
 * USER/CUSTOMIZATIONS overlay. If you fork with custom types, maintain the
 * registry edit as your fork's patch.
 *
 * CLI:
 *   bun MemoryTypes.ts list                # print the registry
 *   bun MemoryTypes.ts resolve <type> <item-json>   # show resolved storage path
 *   bun MemoryTypes.ts test                # smoke test
 */

import { resolve as pathResolve, join as pathJoin } from "node:path";
import { homedir } from "node:os";
import { claudeDir } from "./lifeos-root";

// ── Paths ──

const CLAUDE_ROOT = pathResolve(claudeDir());
const LIFEOS_DIR = pathJoin(CLAUDE_ROOT, "LIFEOS");
const KNOWLEDGE_DIR = pathJoin(LIFEOS_DIR, "MEMORY", "KNOWLEDGE");

export const PRINCIPAL_MEMORY_PATH = pathJoin(LIFEOS_DIR, "USER", "PRINCIPAL", "PRINCIPAL_MEMORY.md");
export const DA_MEMORY_PATH = pathJoin(LIFEOS_DIR, "USER", "DIGITAL_ASSISTANT", "DA_MEMORY.md");
export const PENDING_PROPOSALS_PATH = pathJoin(LIFEOS_DIR, "MEMORY", "OBSERVABILITY", "pending-proposals.jsonl");
export const TIER_B_AUDIT_PATH = pathJoin(LIFEOS_DIR, "MEMORY", "OBSERVABILITY", "tier-b-writes.jsonl");

// ── Proposal target paths (Tier C identity-doctrine + Tier B propose-first files) ──
//
// Added P1 2026-05-25 to expand reviewer coverage beyond identity-only proposals.
// Every Tier C file is reachable as a `proposal` item with the matching
// `target_kind` discriminator. Two Tier B files (PROJECTS, CONTACTS) are also
// allowed as proposal targets so the reviewer can propose first-time additions
// rather than blind-appending behavioral inference.

export const PRINCIPAL_IDENTITY_PATH = pathJoin(LIFEOS_DIR, "USER", "PRINCIPAL", "PRINCIPAL_IDENTITY.md");
export const DA_IDENTITY_PATH = pathJoin(LIFEOS_DIR, "USER", "DIGITAL_ASSISTANT", "DA_IDENTITY.md");
export const WRITINGSTYLE_PATH = pathJoin(LIFEOS_DIR, "USER", "PRINCIPAL", "WRITINGSTYLE.md");
export const RESUME_PATH = pathJoin(LIFEOS_DIR, "USER", "PRINCIPAL", "RESUME.md");
export const DEFINITIONS_PATH = pathJoin(LIFEOS_DIR, "USER", "DEFINITIONS.md");
export const CANONICAL_CONTENT_PATH = pathJoin(LIFEOS_DIR, "USER", "CANONICAL_CONTENT.md");
export const OPERATIONAL_RULES_PATH = pathJoin(LIFEOS_DIR, "USER", "CONFIG", "OPERATIONAL_RULES.md");
export const PROJECTS_PATH = pathJoin(LIFEOS_DIR, "USER", "PROJECTS.md");
export const CONTACTS_PATH = pathJoin(LIFEOS_DIR, "USER", "CONTACTS.md");

// ── Types ──

export type MemoryTypeName = "memory" | "idea" | "knowledge" | "proposal";
export type Tier = "A" | "B" | "C";
export type LoadTiming = "always" | "on-relevance" | "surface-only";
export type WriteMode = "set-overwrite" | "append" | "queue";
export type Actor = "principal" | "assistant";
export type EntityType = "person" | "company" | "research";

/**
 * Minimum payload for each type. The reviewer subprocess and MemorySystem.add()
 * narrow these by `type` discriminant.
 */
/**
 * How a memory write is applied:
 *   - "set"  → REPLACE the whole file with `entries` (Honcho peer-card model:
 *              "replaces the entire card — does not merge"). This is the
 *              forgetting path — eviction is omission, supersession is rewrite.
 *              The curation reviewer emits this. Kills the cap-jam permanently.
 *   - "add"  → legacy merge-append of a single `content` entry (back-compat).
 */
export type MemoryOp = "add" | "set";

/** How a fact is known — provenance gradient (Honcho explicit/deductive/inductive). */
export type Provenance = "explicit" | "deduced" | "inferred";

export interface MemoryItem {
  type: "memory";
  actor: Actor;
  /** Curation op. Defaults to "add" (legacy) when absent. */
  op?: MemoryOp;
  /** Single entry to append — used by op:"add"/legacy. */
  content?: string;
  /** Full desired entry list — used by op:"set" (REPLACES the file). */
  entries?: string[];
  /** How this fact is known. Defaults to "explicit" when absent. */
  provenance?: Provenance;
  confidence?: number;
}

export interface IdeaItem {
  type: "idea";
  title: string;
  content: string;
  source_session?: string;
  confidence?: number;
  /** Typed cross-links into the KNOWLEDGE graph (same convention as KnowledgeItem). */
  related?: RelatedLink[];
}

/**
 * Typed cross-link between two knowledge notes. Mirrors the convention
 * already in use across LIFEOS/MEMORY/KNOWLEDGE/ — the 8 supported relationship
 * types form the graph the reasoning layer traverses. New knowledge items
 * SHOULD ship with at least one `related:` link; the reviewer is instructed
 * to populate this from conversation context.
 */
export type RelatedLinkType =
  | "supports"
  | "contradicts"
  | "extends"
  | "part-of"
  | "instance-of"
  | "caused-by"
  | "preceded-by"
  | "related";

export interface RelatedLink {
  slug: string;
  type: RelatedLinkType;
}

export const ALL_RELATED_TYPES: readonly RelatedLinkType[] = Object.freeze([
  "supports", "contradicts", "extends", "part-of",
  "instance-of", "caused-by", "preceded-by", "related",
] as const);

export interface KnowledgeItem {
  type: "knowledge";
  entity_type: EntityType;
  name: string;
  content: string;
  source_session?: string;
  confidence?: number;
  /**
   * Typed cross-links into the existing KNOWLEDGE graph. Empty array is
   * valid but discouraged — the reviewer should populate at least one link
   * based on conversation context. The writer preserves these on append and
   * deduplicates by slug.
   */
  related?: RelatedLink[];
}


/**
 * Proposal subtype discriminator (P1 2026-05-25). Tells the reviewer which
 * identity-doctrine or curated-context file the proposal targets. Routing,
 * Telegram surfacing, and tier validation use this to enforce per-target rules.
 *
 * Subtypes map to specific target files via PROPOSAL_KIND_TO_FILES below. The
 * `identity` kind is allowed-set (PRINCIPAL or DA); others are exact-match.
 * Defaults to 'identity' when absent (backwards compat with v8.1 reviewer
 * output that only knew the original identity proposal shape).
 */
export type ProposalTargetKind =
  | "identity"            // PRINCIPAL_IDENTITY.md OR DA_IDENTITY.md
  | "style"               // WRITINGSTYLE.md
  | "definition"          // DEFINITIONS.md
  | "canonical-content"   // CANONICAL_CONTENT.md
  | "resume"              // RESUME.md
  | "operational-rule"    // CONFIG/OPERATIONAL_RULES.md
  | "projects"            // PROJECTS.md (Tier B; propose first-time additions)
  | "contacts";           // CONTACTS.md (Tier B; propose first-time additions)

export const ALL_PROPOSAL_KINDS: readonly ProposalTargetKind[] = Object.freeze([
  "identity", "style", "definition", "canonical-content",
  "resume", "operational-rule", "projects", "contacts",
] as const);

/**
 * Allowed target_file paths per subtype. Used by MemorySystem.add() to validate
 * the (target_kind, target_file) pair — a 'style' proposal must point at
 * WRITINGSTYLE.md, not some arbitrary file. Closed allowlist; default-deny.
 */
export const PROPOSAL_KIND_TO_FILES: Readonly<Record<ProposalTargetKind, readonly string[]>> = Object.freeze({
  identity:             Object.freeze([PRINCIPAL_IDENTITY_PATH, DA_IDENTITY_PATH]),
  style:                Object.freeze([WRITINGSTYLE_PATH]),
  definition:           Object.freeze([DEFINITIONS_PATH]),
  "canonical-content":  Object.freeze([CANONICAL_CONTENT_PATH]),
  resume:               Object.freeze([RESUME_PATH]),
  "operational-rule":   Object.freeze([OPERATIONAL_RULES_PATH]),
  projects:             Object.freeze([PROJECTS_PATH]),
  contacts:             Object.freeze([CONTACTS_PATH]),
});

/**
 * Reverse lookup — derive a proposal kind from a target file path. Returns
 * 'identity' as the sane default for legacy proposals that only carry a
 * target_file (no target_kind), so the v8.1 wire format keeps working.
 */
export function inferProposalKind(targetFile: string): ProposalTargetKind {
  for (const [kind, files] of Object.entries(PROPOSAL_KIND_TO_FILES) as [ProposalTargetKind, readonly string[]][]) {
    if (files.includes(targetFile)) return kind;
  }
  return "identity";
}

export function isKnownProposalKind(k: string): k is ProposalTargetKind {
  return (ALL_PROPOSAL_KINDS as readonly string[]).includes(k);
}

export interface ProposalItem {
  type: "proposal";
  target_file: string;            // absolute path to the destination file
  /**
   * Subtype discriminator (P1 2026-05-25). Defaults to 'identity' when absent
   * for backwards compat. The reviewer is instructed to populate this so the
   * Telegram surfacer renders the right label and the validator can enforce
   * (kind, file) consistency.
   */
  target_kind?: ProposalTargetKind;
  edit: string;                   // the proposed addition (already formatted)
  confidence: number;             // 0..1
  rationale: string;              // why this is being proposed
  observed_across_sessions?: number;
  source_session?: string;
}

export type TypedItem = MemoryItem | IdeaItem | KnowledgeItem | ProposalItem;

export interface TypeRegistryEntry {
  /** Resolve where an item of this type is persisted. Throws on item-shape errors. */
  storage_path_resolver: (item: TypedItem) => string;
  /** When the item shows up in prompts. */
  load_timing: LoadTiming;
  /** Mutation tier that gates writes to this type's storage. */
  tier: Tier;
  /** How the writer persists this type. */
  write_mode: WriteMode;
  /** Human-readable one-line description (for `list` CLI). */
  description: string;
}

// ── Helpers ──

const SLUG_RE = /[^a-z0-9]+/g;
function slugify(s: string): string {
  return s.trim().toLowerCase().replace(SLUG_RE, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "untitled";
}

function entityTypeToSubdir(et: EntityType): string {
  switch (et) {
    case "person":   return "People";
    case "company":  return "Companies";
    case "research": return "Research";
  }
}

// ── Registry ──

const _REGISTRY: Record<MemoryTypeName, TypeRegistryEntry> = {
  memory: {
    storage_path_resolver: (item) => {
      if (item.type !== "memory") throw new Error(`Type mismatch: expected 'memory', got '${(item as any).type}'`);
      if (item.actor === "principal") return PRINCIPAL_MEMORY_PATH;
      if (item.actor === "assistant") return DA_MEMORY_PATH;
      throw new Error(`Unknown actor for memory item: ${String((item as any).actor)} (must be 'principal' or 'assistant')`);
    },
    load_timing: "always",
    tier: "A",
    write_mode: "set-overwrite",
    description: "Durable fact about the principal or the assistant. Loaded into every prompt.",
  },
  idea: {
    storage_path_resolver: (item) => {
      if (item.type !== "idea") throw new Error(`Type mismatch: expected 'idea', got '${(item as any).type}'`);
      if (!item.title) throw new Error("Idea item missing required 'title' field");
      return pathJoin(KNOWLEDGE_DIR, "Ideas", `${slugify(item.title)}.md`);
    },
    load_timing: "on-relevance",
    tier: "B",
    write_mode: "append",
    description: "Captured thought or insight. Stored alongside knowledge notes; loads on relevance.",
  },
  knowledge: {
    storage_path_resolver: (item) => {
      if (item.type !== "knowledge") throw new Error(`Type mismatch: expected 'knowledge', got '${(item as any).type}'`);
      if (!item.entity_type) throw new Error("Knowledge item missing required 'entity_type' field");
      if (!item.name) throw new Error("Knowledge item missing required 'name' field");
      const sub = entityTypeToSubdir(item.entity_type);
      return pathJoin(KNOWLEDGE_DIR, sub, `${slugify(item.name)}.md`);
    },
    load_timing: "on-relevance",
    tier: "B",
    write_mode: "append",
    description: "Entity note (person / company / research). Loads on relevance.",
  },
  proposal: {
    // Proposals always queue to the single pending-proposals.jsonl. The
    // target_file on the item carries the intended Tier C destination, but the
    // write itself goes to the queue.
    storage_path_resolver: () => PENDING_PROPOSALS_PATH,
    load_timing: "surface-only",
    tier: "C",
    write_mode: "queue",
    description: "Low-confidence identity-doctrine edit awaiting principal approval via Telegram.",
  },
};

/** Frozen registry. Mutation attempts fail (strict mode throws, sloppy silently no-ops). */
export const TYPE_REGISTRY: Readonly<Record<MemoryTypeName, Readonly<TypeRegistryEntry>>> =
  Object.freeze({
    memory:    Object.freeze(_REGISTRY.memory),
    idea:      Object.freeze(_REGISTRY.idea),
    knowledge: Object.freeze(_REGISTRY.knowledge),
    proposal:  Object.freeze(_REGISTRY.proposal),
  });

export const ALL_TYPES: readonly MemoryTypeName[] = Object.freeze(["memory", "idea", "knowledge", "proposal"] as const);

// ── Public lookups ──

export function isKnownType(t: string): t is MemoryTypeName {
  return (ALL_TYPES as readonly string[]).includes(t);
}

export function getTypeEntry(t: MemoryTypeName): Readonly<TypeRegistryEntry> {
  return TYPE_REGISTRY[t];
}

export function resolveStoragePath(item: TypedItem): string {
  const entry = TYPE_REGISTRY[item.type];
  if (!entry) throw new Error(`Unknown type: ${(item as any).type}`);
  return entry.storage_path_resolver(item);
}

// ── CLI ──

function smokeTest(): number {
  console.log("MemoryTypes smoke test starting…");
  let pass = 0, fail = 0;

  const check = (name: string, ok: boolean, detail?: string) => {
    if (ok) { pass++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`); }
    else    { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
  };

  // 1. All four types are registered
  check("registry has 4 types", ALL_TYPES.length === 4);
  for (const t of ALL_TYPES) check(`type '${t}' registered`, !!TYPE_REGISTRY[t]);

  // 2. Tier orthogonality — each type declares its tier
  check("memory → tier A", TYPE_REGISTRY.memory.tier === "A");
  check("idea → tier B",   TYPE_REGISTRY.idea.tier === "B");
  check("knowledge → tier B", TYPE_REGISTRY.knowledge.tier === "B");
  check("proposal → tier C", TYPE_REGISTRY.proposal.tier === "C");

  // 3. Write-mode discipline
  check("memory → set-overwrite", TYPE_REGISTRY.memory.write_mode === "set-overwrite");
  check("idea → append",          TYPE_REGISTRY.idea.write_mode === "append");
  check("knowledge → append",     TYPE_REGISTRY.knowledge.write_mode === "append");
  check("proposal → queue",       TYPE_REGISTRY.proposal.write_mode === "queue");

  // 4. Load timing
  check("memory → always",          TYPE_REGISTRY.memory.load_timing === "always");
  check("idea → on-relevance",      TYPE_REGISTRY.idea.load_timing === "on-relevance");
  check("knowledge → on-relevance", TYPE_REGISTRY.knowledge.load_timing === "on-relevance");
  check("proposal → surface-only",  TYPE_REGISTRY.proposal.load_timing === "surface-only");

  // 5. Path resolution — memory routes by actor
  const memPrincipal = resolveStoragePath({ type: "memory", actor: "principal", content: "RULE: x" });
  check("memory(principal) → PRINCIPAL_MEMORY.md", memPrincipal === PRINCIPAL_MEMORY_PATH, memPrincipal);
  const memAssistant = resolveStoragePath({ type: "memory", actor: "assistant", content: "ROLE: y" });
  check("memory(assistant) → DA_MEMORY.md", memAssistant === DA_MEMORY_PATH, memAssistant);

  // 6. Path resolution — knowledge routes by entity_type subdir
  const kPerson = resolveStoragePath({ type: "knowledge", entity_type: "person", name: "Some Person", content: "..." });
  check("knowledge(person) → KNOWLEDGE/People/", kPerson.endsWith("/MEMORY/KNOWLEDGE/People/some-person.md"), kPerson);
  const kCompany = resolveStoragePath({ type: "knowledge", entity_type: "company", name: "Anthropic", content: "..." });
  check("knowledge(company) → KNOWLEDGE/Companies/", kCompany.endsWith("/MEMORY/KNOWLEDGE/Companies/anthropic.md"), kCompany);
  const kResearch = resolveStoragePath({ type: "knowledge", entity_type: "research", name: "Honcho Paper", content: "..." });
  check("knowledge(research) → KNOWLEDGE/Research/", kResearch.endsWith("/MEMORY/KNOWLEDGE/Research/honcho-paper.md"), kResearch);

  // 7. Path resolution — idea routes to KNOWLEDGE/Ideas/
  const idea = resolveStoragePath({ type: "idea", title: "Single Memory System Insight", content: "..." });
  check("idea → KNOWLEDGE/Ideas/", idea.endsWith("/MEMORY/KNOWLEDGE/Ideas/single-memory-system-insight.md"), idea);

  // 8. Path resolution — proposal always goes to pending-proposals.jsonl
  const prop = resolveStoragePath({
    type: "proposal",
    target_file: PRINCIPAL_MEMORY_PATH,
    edit: "RULE: ...",
    confidence: 0.6,
    rationale: "observed",
  });
  check("proposal → pending-proposals.jsonl", prop === PENDING_PROPOSALS_PATH, prop);

  // 9. Unknown type detection
  check("unknown type rejected", !isKnownType("not_a_type"));
  check("'memory' is known type", isKnownType("memory"));

  // 10. ISC-160 — registry frozen
  let mutationBlocked = false;
  try {
    (TYPE_REGISTRY as any).memory = null;
    if (TYPE_REGISTRY.memory === null) {
      // sloppy mode silently no-op'd OR frozen — either way the value should be unchanged
      mutationBlocked = false;
    } else {
      mutationBlocked = true;
    }
  } catch {
    mutationBlocked = true;
  }
  check("ISC-160: TYPE_REGISTRY is frozen against mutation", mutationBlocked);

  // 11. Bad-actor rejection
  let actorRejected = false;
  try {
    resolveStoragePath({ type: "memory", actor: "stranger" as any, content: "..." });
  } catch (e) {
    actorRejected = true;
  }
  check("memory with unknown actor rejected", actorRejected);

  // 12. Missing required fields
  let kMissingFieldRejected = false;
  try {
    resolveStoragePath({ type: "knowledge", entity_type: "person", name: "", content: "..." } as any);
  } catch {
    kMissingFieldRejected = true;
  }
  check("knowledge with empty name rejected", kMissingFieldRejected);

  // 13. P1 2026-05-25: proposal subtype registry coverage
  check("proposal kinds: 8 subtypes registered", ALL_PROPOSAL_KINDS.length === 8);
  for (const k of ALL_PROPOSAL_KINDS) {
    check(`proposal kind '${k}' has at least one allowed target file`,
      Array.isArray(PROPOSAL_KIND_TO_FILES[k]) && PROPOSAL_KIND_TO_FILES[k].length > 0);
  }
  check("identity kind allows BOTH principal and DA identity files",
    PROPOSAL_KIND_TO_FILES.identity.includes(PRINCIPAL_IDENTITY_PATH) &&
    PROPOSAL_KIND_TO_FILES.identity.includes(DA_IDENTITY_PATH));
  check("style → WRITINGSTYLE only", PROPOSAL_KIND_TO_FILES.style.length === 1 && PROPOSAL_KIND_TO_FILES.style[0] === WRITINGSTYLE_PATH);
  check("operational-rule → OPERATIONAL_RULES only", PROPOSAL_KIND_TO_FILES["operational-rule"][0] === OPERATIONAL_RULES_PATH);

  // 14. Reverse inference: target_file → kind
  check("infer: PRINCIPAL_IDENTITY → identity",   inferProposalKind(PRINCIPAL_IDENTITY_PATH) === "identity");
  check("infer: DA_IDENTITY → identity",          inferProposalKind(DA_IDENTITY_PATH) === "identity");
  check("infer: WRITINGSTYLE → style",            inferProposalKind(WRITINGSTYLE_PATH) === "style");
  check("infer: DEFINITIONS → definition",        inferProposalKind(DEFINITIONS_PATH) === "definition");
  check("infer: OPERATIONAL_RULES → operational-rule", inferProposalKind(OPERATIONAL_RULES_PATH) === "operational-rule");
  check("infer: PROJECTS → projects",             inferProposalKind(PROJECTS_PATH) === "projects");
  check("infer: CONTACTS → contacts",             inferProposalKind(CONTACTS_PATH) === "contacts");
  check("infer: unknown path defaults to identity (legacy compat)",
    inferProposalKind("/tmp/random.md") === "identity");

  // 15. Known-kind helper
  check("isKnownProposalKind: 'style' true", isKnownProposalKind("style"));
  check("isKnownProposalKind: 'nonsense' false", !isKnownProposalKind("nonsense"));

  // 16. Frozen registry — PROPOSAL_KIND_TO_FILES can't be mutated at runtime
  let kindMutationBlocked = false;
  try {
    (PROPOSAL_KIND_TO_FILES as any).identity = ["/etc/passwd"];
    if (!PROPOSAL_KIND_TO_FILES.identity.includes("/etc/passwd")) {
      kindMutationBlocked = true;
    }
  } catch { kindMutationBlocked = true; }
  check("PROPOSAL_KIND_TO_FILES is frozen against mutation", kindMutationBlocked);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail === 0) {
    console.log("✓ MemoryTypes smoke test PASSED");
    return 0;
  }
  console.error("✗ MemoryTypes smoke test FAILED");
  return 1;
}

function main() {
  const cmd = process.argv[2];
  if (cmd === "test") {
    process.exit(smokeTest());
  }
  if (cmd === "list") {
    console.log(JSON.stringify(
      Object.fromEntries(ALL_TYPES.map((t) => [t, {
        load_timing: TYPE_REGISTRY[t].load_timing,
        tier:        TYPE_REGISTRY[t].tier,
        write_mode:  TYPE_REGISTRY[t].write_mode,
        description: TYPE_REGISTRY[t].description,
      }])),
      null, 2,
    ));
    process.exit(0);
  }
  if (cmd === "resolve") {
    const typeName = process.argv[3];
    const itemJson = process.argv[4];
    if (!typeName || !itemJson) {
      console.error("Usage: bun MemoryTypes.ts resolve <type> <item-json>");
      process.exit(2);
    }
    try {
      const item = JSON.parse(itemJson);
      item.type = typeName;
      const path = resolveStoragePath(item);
      console.log(JSON.stringify({ type: typeName, path }));
      process.exit(0);
    } catch (e: any) {
      console.error(`Resolve failed: ${e?.message || String(e)}`);
      process.exit(1);
    }
  }
  console.error("Usage: bun MemoryTypes.ts {test|list|resolve <type> <item-json>}");
  process.exit(2);
}

if (import.meta.main) {
  main();
}
