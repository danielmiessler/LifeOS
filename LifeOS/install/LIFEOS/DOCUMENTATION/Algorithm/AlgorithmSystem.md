---
last_updated: 2026-07-11T19:30:00Z
last_updated_by: kai
convention: pai-freshness-v1
version: 2.0.0
---

# The Algorithm — the LifeOS Thinking System

**The Algorithm names two things: the system and the file.** The system is the unified ideal-state-chasing loop — the system prompt, the dynamic context loaded through CLAUDE.md, the Algorithm doctrine file, the ISA, the enforcement hooks, and the Pulse instruments working as one. The file is the done-claims doctrine at `LIFEOS/ALGORITHM/LATEST`. When context makes it ambiguous, say "the Algorithm system" vs "the Algorithm file"; unqualified, "the Algorithm" means the whole.

> **Naming.** The system was briefly named **Ascent** (2026-07-10) and renamed **the Algorithm** on 2026-07-11 at {{PRINCIPAL_NAME}}'s direction — one name for the whole thinking apparatus and its doctrine file. Historical records (changelog entries, ISAs, work.json) keep the Ascent name as written.

## The one loop

Current state → ideal state, by writing done as testable claims (the ISA) and refining until every claim survives every test it can be subjected to. Every component below exists to run that loop better; anything that doesn't serve it is cargo. The thesis (`LifeOs/LifeOsThesis.md`) defines the OS's one job — understand current state, understand ideal state, close the gap — and the Algorithm is that job made systematic at every scale: TELOS holds the life-scale ideal state; an ISA holds the task-scale one.

## The governing principle: around the loop, never inside it

The Algorithm adds four kinds of thing to native model execution. It never scripts cognition — no thinking floors, no selection rituals, no mandated reasoning steps, no self-assigned scores. The admission test for any new piece of the system: **is it context, an artifact, a tooth, or an instrument?** If it's a step, a floor, a ritual, or a self-score, it doesn't ship.

| Layer | What it adds | Components |
|---|---|---|
| **Context** | What the model can't know | Identity/TELOS/projects @-imports, LoadContext learning injection, memory hot-layer, AlgorithmNudge event nudges |
| **Artifacts** | What the model won't externalize | The ISA (`Isa/IsaFormat.md`), Decisions/Changelog trails, KNOWLEDGE, reflection records |
| **Teeth** | What the model won't hold itself to | The done-claims (`ALGORITHM/LATEST`, currently v8.4.0 — 15 teeth-annotated claims), VerificationGate + WritingGate teeth (both via `hooks/StopGates.hook.ts`; the telemetry-only OutputFormatGate was removed 2026-07-11 with the mode-banner strip), Forge + Grok cross-vendor review, keep-class doctrine (`RULES/Philosophy.md` § Ideal-State Prompting) |
| **Instruments** | What makes the work observable | Pulse (phase telemetry, work.json, SSE), voice announcements, observability JSONL streams, execution logs |

Spend follows the work, discovered from the task and its evidence gates — never predicted by a classifier or rubric (TheRouter and the effort tiers were retired 2026-07-11). The principal steers in plain language ("go heavy", "quick pass"), which outranks the model's judgment; a literal `/e1`–`/e5` in a prompt reads as "go heavier than default."

## Component map

| Component | Role in the Algorithm system | Canonical doc |
|---|---|---|
| System prompt | Constitution: modes, output contracts, security, verification doctrine | `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` |
| Dynamic context | CLAUDE.md routing table, @-imports, hook-injected session context | `DOCUMENTATION/Config/ConfigSystem.md` |
| The Algorithm file | The done-claims — what a completed run must satisfy | `ALGORITHM/v${LATEST}.md` (resolve `ALGORITHM/LATEST`; currently 8.1.0) |
| ISA | The artifact: done as falsifiable claims | `DOCUMENTATION/Isa/IsaSystem.md` + `IsaFormat.md` |
| Hooks | Mechanical enforcement (the teeth that don't decay) | `DOCUMENTATION/Hooks/HookSystem.md` |
| Pulse | The instruments | `DOCUMENTATION/Pulse/PulseSystem.md` |
| Memory/Learning | The loop's persistence: reflections, signals, curation | `DOCUMENTATION/Memory/MemorySystem.md` |

There are no modes. A one-line answer and a week-long build are the same loop at different depths (the MINIMAL / NATIVE / ALGORITHM modes were retired 2026-07-11 into one adaptive format). How much to spend is the model's judgment call, discovered from the work — the trigger is what "done" requires, not a complexity label.

## Health doctrine

The Algorithm system is audited, not trusted. Empirical law from the 2026-07-10 audit (`MEMORY/WORK/20260710-algorithm-bpe-analysis/REPORT.md`): **declarative rules without mechanical enforcement decay** (anti-criteria were "required" and appeared in 11–22% of ISAs; self-scored audits ran 99.4% constant). Therefore:

- Everything that matters gets a HOOK or a CHECK; FIELD-only rules are honestly labeled self-attested and watched for decay.

- A gate that never fires, or always passes, is presumed theater until data says otherwise.

- Duplicated inventories are forbidden — the system prompt's skill list is THE capability inventory; a second copy provably rots (capabilities.md, removed at v7).

- The recurring audit lives in the `<your-release-skill>` skill: **AlgorithmAudit** — token cost of always-loaded surfaces, gate fire/catch rates, dead-letter detection, capability reach, budget adherence, doctrine↔implementation drift. Run it when efficiency is in question and after any core-surface change; its baselines: 1,117-run reflection corpus, `execution.jsonl`, the observability streams.

## Lineage

v1–v6.31.1 of the Algorithm file accreted procedure per incident; the 2026-07-10 BPE audit split kernel from shell (verification spine and format contracts earned their place in usage data; choreography and self-scores did not). v7.0.0 restructured the file as an outcome contract, and v8.0.0 (2026-07-11) completed the move: a one-page claim set plus the live event layer, now AlgorithmNudge, (`hooks/AlgorithmNudge.hook.ts`). The unified system was named Ascent the same day v7 shipped, then renamed **the Algorithm** on 2026-07-11 — so the whole, not just the file, has one handle, one doc, and an audit. Version-by-version history: `LIFEOS/ALGORITHM/changelog.md`.

## Deferred Refactors

A registry of known-good refactors **intentionally deferred** because they're premature today but become correct at a named trigger. Documented here so the deferral is *discoverable*, not folklore.

### `Clarify` generic primitive — extract when N=2

**Status:** Deferred. Re-open trigger: a second concrete artifact-owner needs interview-shaped clarification.

**Current state (N=1):** the ISA Interview workflow (`$LIFEOS_ROOT/skills/ISA/Workflows/Interview.md`) walks an ISA's thin sections, asks one question at a time, writes answers back. Telos has a parallel-shape workflow (`$LIFEOS_ROOT/skills/Telos/Workflows/Update.md`) performing single-section TELOS edits.

**Why not extract today:** at N=1.5 (ISA fully real, Telos parallel-but-different), DRY-ing into a shared `Clarify(artifact, schema, thin_section_detector, question_generator)` primitive would force a speculative API shape. The mechanic differs in cadence (per-task vs quarterly), audience (task-deliverable vs life-context), and detector logic (section-fillability vs TELOS-freshness staleness).

**Re-open trigger (named, discoverable):** the day `Telos.Update` gains an **auto-trigger** on stale-section detection (currently user-invoked), OR a third artifact-owner (threat model, content brief, design spec) needs the same shape. "It would be cleaner" alone does not qualify. When the trigger fires, refactor `ISA.Interview` and `Telos.Update` to consume `Clarify`, keep the routing skills as thin facades, and replace this section with `## Clarify Primitive`.

---

*The Algorithm file: `LIFEOS/ALGORITHM/LATEST` → `v{LATEST}.md` | ISA format: `DOCUMENTATION/Isa/IsaFormat.md` | ISA skill: `skills/ISA/SKILL.md` | Modes: `LIFEOS/ALGORITHM/modes/README.md`*
