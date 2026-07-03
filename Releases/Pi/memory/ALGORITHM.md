# PAI Algorithm v6.3.0 — Full Specification Reference

> This is the canonical reference for the PAI Algorithm. Every non-trivial task runs through this loop.
> Algorithm: v6.3.0 | Part of PAI v5.0 Life Operating System

---

## 1. Overview

The Algorithm is a universal 7-phase execution loop that drives every non-trivial task from **Current State** to **Ideal State**. It is modeled on the scientific method and uses Karl Popper/David Deutsch's framing of hard-to-vary explanations as the standard for "good."

```
Current State → [OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN] → Ideal State
```

Each phase is sequential but iteration is allowed — LEARN feeds back into OBSERVE for the next loop.

---

## 2. Mode Classification

Before execution begins, classify the user request:

### Modes

| Mode | When | Output Format |
|------|------|---------------|
| MINIMAL | Greetings, ratings, simple acknowledgments, yes/no | 8-word summary only |
| NATIVE | Single-action tasks needing no planning | Standard execution + 8-word change/verify |
| ALGORITHM | Everything requiring thought, build, design, debug, plan, analyze, research, multi-step | Full 7-phase loop |

### Classification Rules

- Use model-level reasoning — NOT regex, NOT keyword matching
- The classifier evaluates intent, complexity, scope, and ambiguity
- **When in doubt, ALWAYS select ALGORITHM**
- Classification output: `MODE: ALGORITHM | TIER: E3 | REASONING: ...`

---

## 3. Effort Tiers (E1-E5)

### Tier Definitions

| Tier | Time Budget | Min ISCs | Core Sections | Verification Rigor |
|------|-------------|----------|---------------|-------------------|
| E1 | <90 seconds | 1-8 | Goal + Criteria | Direct check |
| E2 | <8 minutes | 8-16 | + Problem + Test Strategy | Evidence check |
| E3 | <16 minutes | 16-32 | All 8 core (Problem→Features) | Thinking skills required |
| E4 | <32 minutes | 32-128 | All 12 sections | Cross-vendor audit |
| E5 | <2+ hours | 128-256+ | All 12 + interview before BUILD | Cross-vendor audit |

### Tier Selection Guidance

- **E1:** Simple edits, single file change, known fix, quick lookup
- **E2:** Moderate task with clear boundaries, moderate complexity
- **E3:** Complex multi-file task, new feature, integration work
- **E4:** Major feature with cross-cutting concerns, system design
- **E5:** Large project scaffolding, new system build, multi-day effort

Time budget is the **hard constraint**. If you're not sure, select the lower tier.

---

## 4. The 7 Phases (Detailed)

### Phase 1: OBSERVE

**Purpose:** Understand what's needed before doing anything.

**Entry criteria:** User request received, mode classified as ALGORITHM.

**Steps:**
1. Reverse-engineer the request into:
   - Explicit wants (what they asked for)
   - Implied wants (what they need but didn't say)
   - Explicit not-wanted (what they said to avoid)
   - Implied not-wanted (what would violate intent)
2. Select effort tier (E1-E5)
3. Scaffold the ISA (tier-appropriate sections)
4. Define ISCs — atomic, binary, individually testable criteria
5. Select capabilities — which skills, tools, and thinking capabilities to use

**Exit criteria:** ISA scaffolded with all tier-required sections populated. ISCs defined.

**Output:** Structured ISA document with ISC list.

---

### Phase 2: THINK

**Purpose:** Pressure-test the approach before committing to a plan.

**Entry criteria:** ISA scaffolded, ISCs defined.

**Steps:**
1. Select thinking capabilities from the closed list (see §7)
2. Identify riskiest assumptions
3. Run premortem — how could this fail?
4. Check prerequisites — are we ready to build?
5. Surface unknown unknowns via selected thinking capabilities

**Exit criteria:** Risks identified, assumptions documented, prerequisites validated.

**Rules:**
- Only the 19 approved thinking capabilities may be used (phantom capabilities = CRITICAL FAILURE)
- E1 tasks may skip this phase
- E3+ tasks MUST use at least one thinking capability

---

### Phase 3: PLAN

**Purpose:** Design the technical approach.

**Entry criteria:** THINK phase complete, risks documented.

**Steps:**
1. Validate prerequisites
2. Design technical approach with key decisions
3. Choose depth vs. breadth for execution
4. Define features with dependency graph
5. Check feasibility against constraints

**Exit criteria:** Technical approach documented, features defined, dependency order clear.

---

### Phase 4: BUILD

**Purpose:** Prepare everything needed for execution.

**Entry criteria:** Plan ready, dependencies clear.

**Steps:**
1. Invoke selected capabilities and skills
2. Create necessary artifacts, scaffolds, test harnesses
3. Prepare ephemeral feature files for parallel work
4. Set up verification infrastructure

**Exit criteria:** All artifacts needed for execution are created.

---

### Phase 5: EXECUTE

**Purpose:** Do the actual work.

**Entry criteria:** All build artifacts ready.

**Steps:**
1. Execute features in dependency order
2. Execute the plan
3. Mark ISC criteria as they're satisfied:

```
- [x] ISC-1: CLI tool accepts --help flag
- [x] ISC-2: Output is valid JSON
```

**Exit criteria:** All features implemented, ISCs progressively marked.

---

### Phase 6: VERIFY

**Purpose:** Prove the work meets the criteria.

**Entry criteria:** Execution complete, all features implemented.

**Steps:**
1. Test EACH criterion with concrete evidence
2. Live-probe required for user-facing artifacts
3. Collect evidence (command output, file content, API response)
4. E4/E5: Cross-vendor audit — second AI from different provider reviews
5. Surface conflicts between advisor recommendations and empirical results

**Evidence format:**
```
ISC-3: pass | User sees confirmation message after save
  Evidence: `node app.js --save config.json` returned "Configuration saved"
```

**Exit criteria:** Every ISC has a pass/fail verdict with evidence.

**Failure handling:**
- Failed ISC → revise approach and re-execute
- >20% ISCs fail → flag for human review

---

### Phase 7: LEARN

**Purpose:** Capture what was learned and close the loop.

**Entry criteria:** Verification complete.

**Steps:**
1. Capture satisfaction signal (rating, reflection, pattern)
2. Record changelog entry in four-piece format
3. Identify what worked and what didn't
4. Persist learning to LEARNING tier
5. Reconcile ephemeral files back to master ISA
6. Decide: more iterations? If yes, return to OBSERVE

**Changelog format (non-negotiable):**
```
2026-05-30 14:30
- Conjecture: Node.js v22 would handle the stream correctly
- Refuted by: Stream emitted error on large payloads
- Learned: Need to use pipeline() instead of pipe()
- Criterion now: Criterion-4 updated to require pipeline() in stream handling
```

**Exit criteria:** Changelog written, learning signals captured, ephemeral files reconciled.

---

## 5. ISA (Ideal State Artifact)

### Document Structure

12 sections, INVARIANT order:

```
┌─────────────────────────────────────┐
│ 1. Problem                          │
│ 2. Vision                           │
│ 3. Out of Scope                     │
│ 4. Principles                       │
│ 5. Constraints                      │
│ 6. Goal                             │
│ 7. Criteria (ISCs)                  │
│ 8. Test Strategy                    │
│ 9. Features                         │
│ 10. Decisions                       │
│ 11. Changelog                       │
│ 12. Verification                    │
└─────────────────────────────────────┘
```

### ISA's Five Identities

1. **Ideal state articulation** — Hard-to-vary description of done
2. **Test harness** — ISCs are executable tests
3. **Build verification** — Passing ISCs = successful build
4. **Done condition** — All ISCs pass = task complete
5. **System of record** — Canonical source of truth

### ISC (Ideal State Criteria) Rules

- Every criterion must be ATOMIC — one verifiable end-state, 8-12 words, binary pass/fail
- Apply the Splitting Test:
  - "and"/"with" test: if the description contains "and" or "with", split it
  - Independent failure test: can one part fail while another passes? Split.
  - Scope word test: does it use vague words like "properly", "appropriate", "correct"? Clarify.
  - Domain boundary test: does it span multiple domains? Split.
- Anti-criteria (ISC-A prefix): what must NOT happen — at least one required at every tier
- IDs are IMMUTABLE — never re-number when editing
  - Splitting ISC-7 creates ISC-7.1, ISC-7.2
  - Dropping an ISC creates a tombstone entry — ID never reused

### ISC Verification Contract

```
Input: ISC description + current system state
Output: { isc_id: string, status: "pass"|"fail", evidence: string }
Evidence MUST be concrete: file content, command output, API response
```

---

## 6. 19 Thinking Capabilities

Closed list — NO others permitted. Phantom capabilities = CRITICAL FAILURE.

| # | Capability | Methodology | When to Use |
|---|-----------|-------------|-------------|
| 1 | **IterativeDepth** | 2-8 sequential passes from different scientific lenses | Hard problems with invisible edge cases |
| 2 | **ApertureOscillation** | 3-pass: tactical → strategic → synthesis | Design tensions invisible at any single zoom level |
| 3 | **FirstPrinciples** | Deconstruct → challenge assumptions → rebuild from fundamentals | Breaking through analogical reasoning ruts |
| 4 | **SystemsThinking** | Iceberg model, causal loops, leverage points (Meadows, Senge) | Recurring problems, systemic issues |
| 5 | **RootCauseAnalysis** | 5 Whys, Fishbone, Apollo, Swiss Cheese, Blameless Postmortem | Incident postmortems, "this keeps happening" |
| 6 | **Council** | Multi-agent debate with visible transcripts | Decisions benefiting from genuine disagreement |
| 7 | **RedTeam** | 32 parallel adversarial expert agents | Premortem on strategy, finding failure modes |
| 8 | **Science** | Hypothesis (>=3) → Experiment → Measure | Forcing hypothesis plurality, falsifiable tests |
| 9 | **BeCreative** | Verbalized Sampling for divergent ideation | Generating diverse candidates from seed |
| 10 | **Ideate** | 9-phase: Consume→Dream→Daydream→Contemplate→Steal→Mate→Test→Evolve→Meta-Learn | Long-form idea generation, novel angles |
| 11 | **BitterPillEngineering** | "Would a smarter model need this rule?" audit | Trimming ceremony bloat, shrinking instruction sets |
| 12 | **Evals** | Code/model/human graders, pass@k scoring | Testing skills/agents against rubrics |
| 13 | **WorldThreatModel** | 11 time horizons (6mo—50yr) stress-testing | Strategy with long tails, resilience planning |
| 14 | **Fabric** | 240+ prompt patterns (extract_wisdom, summarize, etc.) | Battle-tested patterns instead of inventing |
| 15 | **ContextSearch** | 2-phase parallel scan of registry, work dirs, ISAs | Cold-starting sessions, resuming paused work |
| 16 | **ISA** | Scaffold, Interview, CheckCompleteness, Reconcile, Seed, Append | Every E2+ Algorithm run |
| 17 | **Advisor** | Expert consultation at commitment boundaries | Before committing to a design/approach |
| 18 | **ReReadCheck** | Re-read ISA before declaring complete | Preventing scope drift |
| 19 | **FeedbackMemoryConsult** | Consult LEARNING tier for past patterns | Recurring decisions, avoiding past mistakes |

---

## 7. Quality Standards

### Verification Doctrine

1. **Never assert without verification** — do not claim something "is" without tool-based evidence
2. **Never claim completion without evidence** — every ISC needs a pass verdict with concrete evidence
3. **Reproduce-before-fix** on bugs — confirm the bug exists before attempting a fix
4. **Live-probe required** for user-facing artifacts — run the thing, don't reason about it
5. **Advisor calls at commitment boundaries** — consult before committing to architecture

### Evidence Grading

| Grade | Definition | Example |
|-------|-----------|---------|
| A | Tool output (command run, file written) | `npm test` returned exit code 0 |
| B | File content verified | Contents of output file match spec |
| C | Reasoned analysis (no tool available) | "Cannot test without deployment" |

Grade A is preferred. Grade C is acceptable only when A and B are impossible.

### Changelog Four-Piece Format

Every changelog entry MUST have EXACTLY four components:

1. **Conjecture** — what was believed/hypothesized
2. **Refuted by** — the specific evidence or event that disproved it
3. **Learned** — the new understanding derived
4. **Criterion now** — how the ISA/criterion was updated

This structure is non-negotiable. Entries lacking any component are incomplete.

---

## 8. Skill Routing

When the Algorithm determines a skill is needed, it invokes by name with a natural-language action:

```
Skill('ISA', 'Scaffold a new ISA for CLI tool')
Skill('Research', 'Find latest papers on transformer architectures')
Skill('Council', 'Debate whether to use SQLite or PostgreSQL')
```

Skills compose via cross-invocation — one skill can call another. The routing is:
1. Match action to Workflow Routing Table in the skill's SKILL.md
2. Load the matched Workflow file
3. Execute steps in order
4. Append to execution log

---

## 9. Memory Architecture

### Tiers

| Tier | Purpose | Structure | Lifecycle |
|------|---------|-----------|-----------|
| WORK | Active task ISAs + artifacts | `work/{slug}/` | Ephemeral — archived after VERIFY+LEARN |
| KNOWLEDGE | Curated entities | `knowledge/{People,Companies,Ideas,Research,Blogs}/` | Long-lived, promoted from other tiers |
| LEARNING | Meta-patterns + signals | `learning/` | Appended during LEARN phase |

### Key Files

| Path | Content |
|------|---------|
| `state/work.json` | Session registry (active/completed/abandoned sessions) |
| `skills/execution.jsonl` | Every skill invocation (timestamp, skill, workflow, status, duration) |
| `learning/signals.jsonl` | Satisfaction signals captured during LEARN |
| `work/{slug}/ISA.md` | Per-task ISA document |

---

## 10. Reference

- **Current version:** 6.3.0
- **PAI release:** v5.0.0
- **Core primitive:** ISA (Ideal State Artifact)
- **Execution model:** Sequential 7-phase loop with optional iteration
- **Classification:** Model-level reasoning (ALGORITHM / NATIVE / MINIMAL)
- **Effort tiers:** E1-E5 (time-budget-gated)
- **Thinking library:** 19 closed-list capabilities
- **Verification:** Evidence-based, binary ISC pass/fail, cross-vendor at E4/E5
- **Memory:** Text-first, append-mostly, filesystem-as-index (no RAG)
- **Privacy:** 6 containment zones (Z1-Z6), cross-zone blocked by default
