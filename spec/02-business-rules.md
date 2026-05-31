# PAI v5.0 — Business Rules

## BR-01: Algorithm is Gravitational Center [HIGH]
Every non-trivial task MUST pass through the Algorithm. Tasks classified as MINIMAL mode are exempt. The Algorithm phase sequence (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN) is invariant — phases cannot be reordered.

## BR-02: Classification Precedes Execution [HIGH]
Mode classification (MINIMAL/NATIVE/ALGORITHM) MUST happen before ANY execution work begins. The classifier uses the model's own reasoning, not regex or keyword matching.

## BR-03: Effort Tier Determines Rigor [HIGH]
E1 — Goal + Criteria only, no thinking skills required. E2 — Problem + Goal + Criteria + Test Strategy, ≥16 ISCs. E3 — All 8 core sections, ≥32 ISCs, thinking skills required. E4 — All 12 sections, ≥128 ISCs, cross-vendor audit required. E5 — All 12 sections, ≥256 ISCs, interview workflow before BUILD, cross-vendor audit required.

## BR-04: ISC IDs Are Immutable [HIGH]
ISC IDs never re-number when ISCs are edited. Splitting an ISC creates children (ISC-7 → ISC-7.1, ISC-7.2). Dropped ISCs get tombstones — the ID is never reused.

## BR-05: Anti-Criteria Required [HIGH]
Every ISA at every tier MUST include at least one Anti-ISC (a criterion that PROVES the task is NOT done — e.g., "system crashes on empty input").

## BR-06: Antecedent Rule for Experiential Goals [MEDIUM]
When the goal is experiential (art, design, content), at least one Antecedent ISC is required — a criterion anchored to prior work or reference material, not derived from first principles.

## BR-07: Voice Notification Is Mandatory [HIGH]
Every non-trivial operation MUST fire a voice notification before beginning work. The notification MUST describe what is being done. The notification MUST be non-blocking. This is not optional.

## BR-08: Execution Log Append [MEDIUM]
Every skill invocation MUST append to `MEMORY/SKILLS/execution.jsonl` with: timestamp, skill name, workflow, input summary (≤8 words), status (ok/error), duration in seconds.

## BR-09: Text Over Opaque Storage [HIGH]
All system data MUST be stored as plain text (Markdown preferred, JSONL for structured logs). SQLite, Postgres, and other binary/opaque stores MUST NOT be used for primary data. Exception: temporary runtime state. Rule: "If you can't read it with `cat`, we don't want it."

## BR-10: Filesystem Is the Index [HIGH]
The filesystem IS the index. RAG (vector embeddings + retrieval) MUST NOT be used. Fast filesystem search (ripgrep-equivalent) replaces embedding-based retrieval. Cross-references are markdown wikilinks, not vector distances.

## BR-11: Skills Are Code-First [HIGH]
Skills MUST prefer deterministic code over prompts. The hierarchy is: compiled/runtime code → CLI tools → workflows wrapping the CLI → SKILL.md routing. Prompts wrap code; code does NOT wrap prompts.

## BR-12: SKILL.md Max Length [MEDIUM]
SKILL.md should be ≤500 lines. Content beyond this MUST be extracted into reference files and loaded on demand.

## BR-13: Hook Idempotency [HIGH]
All hooks MUST be idempotent — running them multiple times with the same inputs produces the same side effects. Hooks MUST NOT assume in-memory state lives between reloads.

## BR-14: Zone-Based Privacy [HIGH]
Filesystem writes are governed by containment zones. Zone Z1 is user identity data (cannot be published). Zone Z6 is public (can be published freely). Cross-zone writes are blocked unless explicitly permitted by zone policy. Zone membership is declared in a single source of truth.

## BR-15: Two-Stage Release [HIGH]
Public releases require two stages: (1) stage — system prepares the release artifact with automated validation; (2) publish — system publishes after final human review. These stages MUST NOT auto-chain.

## BR-16: 12-Principle Release Gate [HIGH]
Every release artifact MUST pass 12+ security gates checking for: API keys (G1), SSH keys (G2), tokens (G3), PII (G4), email patterns (G5), credit card numbers (G6), IP addresses (G7), private filesystem paths (G8), environment variables (G9), shell history (G10), keychain entries (G11), and macOS-specific data (G12).

## BR-17: Memory Is Append-Mostly [HIGH]
Memory SHOULD be append-mostly. Editing or deleting past knowledge artifacts is discouraged — preference is to add new, superseding entries. Exception: SCRATCHPAD is ephemeral and deletable.

## BR-18: Billing Key Protection [HIGH]
API keys that could trigger billing at a different rate MUST be stripped from process environment before forking/spawning subprocesses or SDK operations. Protection operates at minimum at the process boundary; preferably at two additional layers.

## BR-19: Only Task ISA Goes Through Algorithm [MEDIUM]
Project-level ISAs (permanent artifacts at project root) are exempt from the full Algorithm lifecyle. Only task-level ISAs (in MEMORY/WORK/) go through the 7-phase loop.

## BR-20: Changelog Four-Piece Format [HIGH]
Every changelog entry MUST have exactly four components: (1) what was conjectured, (2) what refuted it, (3) what was learned, (4) what the criterion now says. This structure is non-negotiable.

## BR-21: Notification Sentinels [LOW]
Cron job output matching sentinel strings (NO_ACTION, NO_URGENT, NO_EVENTS, HEARTBEAT_OK) suppresses notification dispatch entirely. This prevents noise from routine/nominal results.

## BR-22: Max Failures Disables Job [LOW]
A cron job with 3+ consecutive failures is automatically paused until manually reset.

## BR-23: Signal Suppression Precedence [LOW]
When a cron job matches both a sentinel AND a dispatch target, the sentinel wins — no dispatch occurs.

## BR-24: Cross-Profile Isolation [HIGH]
System components operating under different profiles or user contexts MUST NOT share memory, configuration, or state. Each profile/context is an isolated universe.

## BR-25: ISC Test Strategy Is Binary [HIGH]
Each ISC verification MUST produce a binary pass/fail result. There is no partial pass. Evidence MUST be concrete (command output, file content, API response).

## BR-26: ID Stability for Decisions [MEDIUM]
Decision log entries in ISA use stable, timestamp-based IDs. Decision entries are never deleted — only superseded by newer entries.

## BR-27: DA Prime Directive [HIGH]
The Digital Assistant's primary mandate is: read the user's current state from available signals, compare it to the user's Telos-articulated ideal state, and constantly act to close the gap. This supersedes all other directives.

## BR-28: Skill Disambiguation in Description [HIGH]
Every skill's description field MUST include both positive triggers (USE WHEN) and negative disambiguation (NOT FOR / NOT TO BE USED FOR) to prevent false invocation.

## BR-29: Context Scaffolding Over Model Quality [HIGH]
The quality of context provided to the AI model matters more than the quality of the AI model itself. When resources are limited, invest in context quality first.

## BR-30: Bitter Pill Reduction [HIGH]
The system MUST be continuously audited to remove prescriptive instructions that smarter models can infer from context alone. Instructions that do not carry unique system knowledge should be removed. The system should SHRINK as models GROW.

## BR-31: Cross-Reference Integrity [MEDIUM]
All wikilinks in the KNOWLEDGE graph MUST resolve to existing pages. Unresolvable links MUST be flagged. The system SHOULD check cross-reference integrity on startup and on write.

## BR-32: Progressive Skill Loading [MEDIUM]
Skill information MUST be loaded progressively: Level 1 (frontmatter only, always in context) → Level 2 (SKILL.md body, loaded on invocation) → Level 3 (reference files, loaded on demand). This prevents context pollution from unused skill content.

## BR-33: DA Messaging Protocol [LOW]
When the DA receives a message from an external channel (Telegram, iMessage), it MUST: (1) authenticate the sender, (2) sanitize the input, (3) check for injection patterns, (4) load conversation context, (5) respond through the Algorithm (task) or conversationally (chat), (6) live-stream the response to the channel.
