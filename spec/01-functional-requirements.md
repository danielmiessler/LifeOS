# PAI v5.0 — Functional Requirements

## FR-01: Algorithm Execution Loop [HIGH]
The system MUST provide a 7-phase execution loop (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN) that drives all non-trivial tasks. Each phase MUST have entry criteria, exit criteria, and an allowed set of operations.

## FR-02: Effort Tier Classification [HIGH]
The system MUST classify every task into one of five effort tiers (E1–E5) based on complexity, time budget, and risk. The tier MUST determine ISA section requirements, thinking skill requirements, and verification rigor.

## FR-03: Mode Classification [HIGH]
The system MUST classify every user request into one of three execution modes: MINIMAL (direct answer), NATIVE (standard processing), ALGORITHM (full 7-phase loop). Classification MUST happen before execution begins.

## FR-04: ISA Scaffolding [HIGH]
The system MUST generate an Ideal State Artifact (ISA) from a user prompt. The ISA MUST have 12 fixed sections in order. Section requirements are tier-gated (E1 requires Goal + Criteria, E5 requires all 12).

## FR-05: Criteria-Driven Verification [HIGH]
The system MUST decompose every task into atomic, individually testable ISCs (Ideal State Criteria). Each ISC MUST have a binary pass/fail verification method. The system MUST verify each ISC with evidence before marking it complete.

## FR-06: Skill Routing [HIGH]
The system MUST provide a skill system with at least 45 skills across 7+ domains. Each skill MUST have a SKILL.md front door with a routing table mapping trigger phrases to Workflow files. Skills MUST invoke each other by name with natural-language actions.

## FR-07: Skill Customization Per User [MEDIUM]
Each skill MUST check for user customizations before executing. Customizations MUST override default skill behavior. The customization search path MUST be deterministic.

## FR-08: Voice Notification [HIGH]
Every non-trivial operation MUST emit a voice notification describing what the system is doing. Notifications MUST be non-blocking (fire-and-forget). The notification system MUST support emotional presets.

## FR-09: Life Dashboard [HIGH]
The system MUST provide a visual web dashboard at a local address showing: Life overview, Health, Finances, Business, Work, Telos, Goals, System Performance, Hook Status, Skills, Agents, Security, Knowledge Graph, System Docs.

## FR-10: Memory Persistence [HIGH]
The system MUST persist memory across sessions. Memory MUST have three primary tiers: WORK (task artifacts), KNOWLEDGE (curated entities with cross-references), LEARNING (meta-patterns). All memory MUST be accessible to the AI agent during operation.

## FR-11: Knowledge Graph [HIGH]
The system MUST support a knowledge graph of entities (People, Companies, Ideas, Research, Blogs) with typed cross-references (wikilinks, related-entity declarations, backlinks). The graph MUST be queryable by the AI agent.

## FR-12: Hook Lifecycle [HIGH]
The system MUST have lifecycle hooks that fire at specific events: Session Start, Pre Tool Use, Post Tool Use, Stop, Pre Compaction, Instructions Loaded, File Changed, Question Answered, Config Audited, Integrity Check. Hooks MUST be able to read, modify, or block operations.

## FR-13: Containment Zones [HIGH]
The system MUST enforce privacy at the filesystem level using containment zones. Cross-zone writes MUST be blocked. The containment policy MUST be declared programmatically, not maintained by hand.

## FR-14: Secure Release Publishing [HIGH]
The system MUST validate any public release through security gates before publishing. Security gates MUST check for API keys, PII, private paths, secrets, and other sensitive data. Releases MUST be two-stage (stage → review → publish).

## FR-15: Agent Composition [MEDIUM]
The system MUST support composing custom agents from traits, voices, and personalities. Composed agents MUST be launchable as parallel workers. Multi-agent debates MUST be supported with round-by-round transcripts.

## FR-16: Delegation [HIGH]
The system MUST support at least 6 parallelization patterns: built-in agents, worktrees, background tasks, custom agents, teams, and parallel dispatch. Delegation MUST work across independent workstreams within a single Algorithm run.

## FR-17: Digital Assistant Identity [HIGH]
The system MUST maintain a persistent identity for the Digital Assistant (DA): name, voice ID, personality, writing style, communication preferences. The DA identity MUST be loaded at session start.

## FR-18: User Identity [HIGH]
The system MUST maintain a persistent identity for the human user: name, role, location, worldview, preferences, goals. This identity MUST inform all AI operations.

## FR-19: Telos Management [HIGH]
The system MUST support management of the user's mission, goals, beliefs, wisdom, challenges, mental models, and narratives (collectively "Telos"). Telos MUST influence task priority, decision-making, and ideal state definitions.

## FR-20: Self-Improvement Loop [HIGH]
The system MUST capture signals about what went well and what didn't (ratings, sentiment, verification outcomes, satisfaction). These signals MUST feed back into system improvement — the system that runs the work MUST also get better at running it.

## FR-21: Life Dashboard Voice Pipeline [MEDIUM]
The Life Dashboard MUST accept voice notification requests via HTTP POST. Request body MUST contain a message string and optional emotional preset. The pipeline MUST support text-to-speech rendering with pronunciation rules.

## FR-22: Cron/Scheduling [HIGH]
The system MUST support scheduled, recurring jobs. Jobs MUST be defined in a configuration file with schedule expressions. Job types: script execution, agent execution, webhook calls. Jobs MUST log execution and support output dispatch to configured targets (voice, messaging, email, log).

## FR-23: Observability Telemetry [MEDIUM]
The system MUST collect telemetry data: tool call activity, session costs, tool failures, satisfaction signals. Data MUST be append-mostly JSONL files. The dashboard MUST expose telemetry via API routes.

## FR-24: External Channel Integration [MEDIUM]
The system MUST support receiving and responding to messages from external messaging channels (Telegram, iMessage). Messages MUST be processed through the full Algorithm (for tasks) or conversational (for simple queries). Authentication MUST restrict access to authorized users.

## FR-25: Wiki API [LOW]
The system MUST expose the KNOWLEDGE archive and system documentation over HTTP. The API MUST support full-text search, backlink resolution, and entity retrieval.

## FR-26: Project-Bound Memory [MEDIUM]
The system MUST support per-project memory compartments. Each project MUST get its own scoped memory directory separate from global memory. The project context MUST be loaded automatically when working on that project.

## FR-27: ISA Reconciliation [HIGH]
The system MUST support deterministic merge of derived ISA views back into the master ISA. Merge keys MUST be stable ISC IDs. Conflicts MUST be resolved deterministically (latest timestamp wins for same ID, appended for new IDs).

## FR-28: ISA Changelog Discipline [HIGH]
Every ISA change MUST record a changelog entry in the prescribed four-piece format: conjecture → refuted-by → learned → criterion-now. This forms an error-correction trail.

## FR-29: Thinking Capability Library [HIGH]
The system MUST maintain a closed set of named thinking capabilities (at least 19) that the Algorithm can invoke during OBSERVE and THINK phases. Each capability MUST have a defined methodology, invocation triggers, and output format.

## FR-30: Execution Log Audit Trail [MEDIUM]
Every skill invocation MUST append to a shared execution log with: timestamp, skill name, workflow used, input summary, status, duration. This provides a cross-skill audit trail.

## FR-31: Billing Protection [HIGH]
The system MUST protect against unexpected billing from API keys. API key values MUST be stripped from the runtime environment before spawning subprocesses or SDK operations that could incur charges at a different billing tier.

## FR-32: Cross-Vendor Audit [MEDIUM]
Tasks at the highest effort tiers (E4, E5) MUST undergo cross-vendor audit — a second AI from a different provider reviews the work before it is accepted as complete.

## FR-33: Notification Rate Limiting [LOW]
The system MUST rate-limit notification output to prevent flooding. Consecutive duplicate notifications MUST be suppressed. The rate limit window and threshold MUST be configurable.

## FR-34: Syslog Capture [LOW]
The system MUST support capturing syslog messages from network devices (via UDP). Parsed messages MUST be persisted to the OBSERVABILITY compartment. The syslog parser MUST support RFC3164 and CEF formats.

## FR-35: Pronunciation Customization [LOW]
The voice notification system MUST support custom pronunciation rules. Rules MUST be defined as regex-to-phonetic replacements in a user-editable configuration file.

## FR-36: Password/Secret Rotation [MEDIUM]
The system MUST support secure credential rotation for secrets stored in configuration. The installation/upgrade process MUST detect stale or default credentials and prompt for rotation.
