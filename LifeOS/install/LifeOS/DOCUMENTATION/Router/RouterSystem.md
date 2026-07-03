---
last_updated: 2026-07-02
last_updated_by: kai
last_reviewed: 2026-07-02
last_reviewed_by: kai
convention: pai-freshness-v1
---

# The Router

> **The Router is the layer that decides how every prompt gets handled** — the mode, the effort tier, the stated goal, the model rung, and which agent or vendor runs the work. It runs first (classification happens the moment a prompt is submitted) and keeps deciding: each time the work dispatches an agent, the Router picks that agent's model and effort. The Algorithm is its biggest consumer, not part of it.

LifeOS has always had this behavior; it just never had a name. The pieces lived in four places — a classifier hook, a model-abstraction file, a utility-inference tool, and the Algorithm's routing doctrine — and no single doc said "this is one system." This doc names it **the Router** and draws the boundary around it.

The one-line test for what belongs to the Router: **does it help decide _how_ to handle a prompt?** If yes, it's the Router. The Router's job is deciding posture — mode, tier, model, effort, agent. Executing that posture — the seven phases, reading files, verification — is the Algorithm (or a NATIVE turn).

---

## Why the Router is a subsystem, not just plumbing

Three reasons this layer earns first-class status:

- **It preserves dynamic range.** The whole point is to be genuinely fast on trivial work and genuinely deep on hard work, with sharp variation between. A greeting gets a reflexive answer in milliseconds; a doctrine redesign gets seven phases, cross-vendor audits, and the top model rung. Without a deliberate router, everything drifts to a mediocre middle.

- **It works around a hard harness limit.** The main conversation loop's model and reasoning effort are fixed at turn start and cannot be changed mid-turn — a `UserPromptSubmit` hook can classify the task but cannot set the main loop's model. So the Router does its heavy lifting two ways: it classifies **up front** (so the turn starts in the right mode/tier), and it programs the model and effort of the **agents the work dispatches**, which _are_ settable per call. The dynamic range lives in the dispatched agents, orchestrated by the fixed main loop.

- **It has exactly two edit points for the whole model lineup.** A model entering or leaving the subscription, or moving rungs, is a one-line change. Nothing else in the system names a model for routing.

---

## The boundary: Router vs Algorithm

This is the spine of the whole subsystem.

| | The Router | The Algorithm |
|---|-----------|---------------|
| **Job** | Decide the posture | Execute within it |
| **Input** | The prompt (+ a short transcript window) | The posture + the whole corpus |
| **Reads files?** | No — decides from the prompt | Yes — OBSERVE loads context |
| **Output** | `{mode, tier, goal, model rung, dispatch policy}` | The deliverable + its verification |
| **Cadence** | Classify once at prompt submit; select-model + dispatch recur per agent | The seven phases |

**The boundary is functional, not file-location.** Two of the Router's stages — route-effort and dispatch — have their *policy text* physically sitting in the Algorithm doctrine file (the tier→level table, the dispatch profile). That is a documentation-location fact, not a boundary fact. Deciding which model and effort the work runs at is a posture decision; running the seven phases is execution. The doctrine file *hosts* the Router's policy, but the policy is the Router's. Draw the seam at decide-posture vs. execute, and it holds.

The Router does **not** pick which context files to read — that is the Algorithm's OBSERVE phase (the LoadContext hook and skills). The Router picks model, effort, and agent. The single artifact that crosses the seam is the `additionalContext` block the classifier emits; the executor reads it and starts.

---

## The four stages

Every prompt flows through four stages, in this order. Each has a load-bearing source file; the doc's accuracy is anchored to those files. The order matters: the effort posture is decided first, and the model is a lookup against it — you cannot select a model before the level exists.

### 1. Classify — `hooks/EffortRouter.hook.ts`

A `UserPromptSubmit` hook turns the raw prompt into a mode and (if ALGORITHM) a tier. It's a three-stage cascade, cheapest first:

- **Stage A — deterministic fast-paths (0 ms).** Explicit `/e1`–`/e5` override; explicit ratings ("8/10") → MINIMAL; positive praise / acknowledgments → MINIMAL; system-injected text (task-notifications, reminders) → skip; sub-3-char prompts → MINIMAL; and a set of **hard-ALGORITHM phrase triggers** ("master plan", "fundamentally rethink", "audit the … doctrine/architecture/classifier/routing", "from scratch") that route straight to E3/E4 without a model call.
- **Stage B — 60-second decision cache.** A SHA-256 of the normalized prompt keys a short-lived cache, so a repeated or retried prompt reuses its decision.
- **Stage C — the classifier.** An Opus-level (`high`) model call with a rich system prompt does the real discrimination. Its single most important rule: **NATIVE vs ALGORITHM is decided by whether the ideal state is pre-articulable in one line — not by complexity, file count, or step count.** A lookup or an opinion is NATIVE (the answer is checkable at a glance); an answer that must be *constructed* by analytical synthesis against contested evidence is ALGORITHM. A short question is not NATIVE by virtue of being short.
- **Fail-safe.** Any error path — timeout (30 s), non-zero exit, unparseable output — defaults length-tiered: ≥1500 chars → ALGORITHM E4, ≥400 → E3, else NATIVE. Under-escalation is the failure mode the system is built to prevent, so the fail-safe biases up.

The classifier also runs the **goal-signal detector** (four signals: named metric+threshold, explicit outcome assertion, completion condition, structural/design directive) with a fail-closed minimum-content rule, and sets **interview eligibility** (true iff ALGORITHM at tier ≥ E3).

One more branch lives here: the **remote-channel short-circuit.** When the turn is running for a remote messaging channel (the mode banner would be noise in a chat), the hook emits a channel directive that overrides the mode-template rule and asks for plain prose instead of a classification.

### 2. Route the effort — the Algorithm doctrine (`LIFEOS/ALGORITHM/v{VERSION}.md`)

The tier picks an effort **level** and a dispatch profile. This is policy, stated as intent — the output is a level (`max` / `high` / `medium` / `low`), never a model name:

- **NATIVE** delegated work → `high`. **E1–E3** → `high`. **E4/E5** → `max`.
- **Keystone pins** (the two highest-leverage calls, pinned regardless of tier): the **Advisor** is pinned `max` (a once-per-deliverable commitment call worth the top rung); the **classifier** is pinned `high`, deliberately *not* `max` — it fires on every prompt, so "keystone" means highest-leverage, never most-expensive.
- **Core-System Override (domain beats tier).** When the task upgrades LifeOS core itself — the Algorithm files, hooks, the system prompt, `CLAUDE.md`, skill/ISA doctrine, or the core routing tools — delegated work routes to `max` regardless of tier, because core changes have outsized blast radius.
- **Per-Task Intelligence Routing.** A single tier flattens a mixed-difficulty run, so a Feature may carry its own `intelligence` level scored to its hardest criterion. Down-route-only (the tier curve is the fallback), producer-locked (never starve a Feature others depend on), and shadow-logged so a wrong trim is visible and revertible.

### 3. Select the model — `LIFEOS/TOOLS/models.ts`

The level from stage 2 resolves to a concrete model through **`EFFORT_MODEL`** — the one place the four levels bind to the lineup:

| Level | Model rung | Used by |
|-------|-----------|---------|
| `max` | Fable | Algorithm E4/E5 + every Core-System Override task + the Advisor |
| `high` | Opus | Algorithm E1–E3 + NATIVE delegated work + the classifier |
| `medium` | Sonnet | Utility inference (summarization, classification, vision triage) |
| `low` | Haiku | Cheap lookups |

Consumers state **intent** (the level); the mapping resolves the model. Two independent edit points keep the system cohesive across model churn: `EFFORT_MODEL` (edit on a **lineup** change — a model enters/exits or moves rungs) and `CURRENT` (edit on a **version** release — a new dated ID). A change is one line; nothing outside this file names a model for routing.

`models.ts` also carries the **cross-vendor pins** (inventory only, never auto-bumped to a Claude model) and the **data-classification × inference-source routing** that sets a per-route egress ceiling (see *Agent dispatch* below).

`LIFEOS/TOOLS/Inference.ts` is the **utility-path application of this same stage**: it resolves a level to a model for non-agent inference — summaries, classification, vision triage, and the Advisor escalation — without dispatching an agent. It is a parallel consumer of select-model, not a separate stage.

### 4. Dispatch the agent — the dispatch-time `model` param

The resolved model is passed as the `model` parameter on `Agent({…, model})` and on Workflow `agent(prompt, {model})`. This is set **at dispatch** because static agent frontmatter can't be tier-conditional. This is the "agents at different model names for harder work" behavior — the same `general-purpose` agent runs on Haiku, Opus, or Fable depending on the rung the Router picked.

Three realities to know:

- **The override is not universal.** The dispatch `model` param overrides an agent's frontmatter model for agents **without** an `initialPrompt` field. An agent carrying an `initialPrompt` deterministically ignores the override and runs its frontmatter model — so never add `initialPrompt` to an agent whose model must be tier-settable.
- **The `🤖 DISPATCH` line records intent, not execution.** Every dispatch is announced as `🤖 DISPATCH: <agent> — <level> → <model>`, resolved from a table. The only proof of the *executed* model is the agent transcript's own model field.
- **Cross-vendor agents run their own vendor regardless of tier.** Forge (GPT-5.5, build and audit modes) exists for vendor diversity, not Claude-tier scaling, so the tier never changes its model. (The GLM open-model route reaches a non-Anthropic vendor too, but as the `OpenRouter.ts` tool + `EgressClassGuard` hook — not a persona agent; the `Gene` agent was retired 2026-07-02.)

---

## The classifier contract

The seam artifact. On every top-level prompt the classifier writes these lines into `additionalContext`; the executor reads them directly, with no regex and no model judgment:

```
MODE: MINIMAL | NATIVE | ALGORITHM
TIER: E1 | E2 | E3 | E4 | E5          (only when MODE=ALGORITHM)
REASON: <one sentence>
SOURCE: classifier | fail-safe | fast-path | cache | explicit
GOAL_SIGNAL: 1 | 2 | 3 | 4 | none
GOAL_LITERAL: "<verbatim prompt quote>"   (when a goal is detected)
INTERVIEW_ELIGIBLE: true | false
```

(In the emitted output the first four fields — `MODE`/`TIER`/`REASON`/`SOURCE` — share one pipe-delimited line; `GOAL_SIGNAL`, `GOAL_LITERAL`, and `INTERVIEW_ELIGIBLE` each get their own line. The block above lists the fields and their value enums, not the exact line layout.)

**Executor override hierarchy** (the primary agent applies these, in order): (1) explicit `/e1`–`/e5` in the prompt forces the tier; (2) **conversation-context override** — the classifier sees the prompt in isolation, the executor sees the thread, so it may escalate or demote when context makes the true shape clear, noting the mismatch; (3) otherwise honor the classifier verbatim. If the `MODE` line is missing entirely, the executor defaults to ALGORITHM E3 and flags it — under-escalation is the failure this exists to prevent.

---

## The three level axes (don't conflate them)

Three independent dials share the words "max" and "high." They are not one axis:

1. **Model rung** — `EFFORT_MODEL` (max/high/medium/low) — *which model* an agent runs.
2. **Reasoning effort** — the harness `--effort` knob (low/medium/high/xhigh/max) — *how hard* a model thinks within itself. Dispatching at model rung `max` emits reasoning effort `xhigh`, not `max` (LifeOS caps dispatch reasoning at xhigh; `/effort max` is human-interactive only).
3. **Composition** — ultracode — *whether to fan* a task into a multi-agent Workflow. It rides on xhigh effort and belongs to no rung.

The crossover that trips people up: "max model" and "max thinking" are different dials. The single source of truth for the rung→effort crossover is `LEVEL_TO_HARNESS_EFFORT` in `models.ts`.

---

## Agent dispatch & cross-vendor egress

The Router doesn't only pick a Claude rung — it also picks the **vendor**, and each vendor route carries a data-sensitivity ceiling. The `models.ts` routing encodes a per-route ceiling (source + model + residency), most-restrictive-wins:

- **RESTRICTED-capable** routes: the native Anthropic path and the OpenAI (Forge) path only.
- A **Chinese-origin model** (e.g. GLM via the OpenRouter broker route) is capped at **INTERNAL** when pinned to a US zero-data-retention provider, and **PUBLIC** otherwise.
- A US/allied model with US inference and a residency guarantee is capped at **CONFIDENTIAL**; everything else is **PUBLIC**. On-device is unrestricted.

So "route the hard reasoning to a frontier open model" is a Router decision bounded by what class of data the prompt carries — the routing table is policy-as-data, not code.

---

## The Router surface (the files)

| File | Role in the Router |
|------|--------------------|
| `hooks/EffortRouter.hook.ts` | **Classify.** The three-stage cascade, goal-signal detector, interview eligibility, remote-channel short-circuit, telemetry. |
| `LIFEOS/ALGORITHM/v{VERSION}.md` | **Route the effort + dispatch policy.** Mode Classification, the tier→level table, Core-System Override, Per-Task Intelligence Routing, keystone pins. |
| `LIFEOS/TOOLS/models.ts` | **Select the model.** `EFFORT_MODEL` four-level abstraction, `CURRENT`/`ALIAS` IDs, the three-axes reconciliation, cross-vendor pins, egress ceilings. |
| `LIFEOS/TOOLS/Inference.ts` | **Utility select-model.** The same four levels for non-agent inference (summaries, classification, vision) plus the Advisor escalation. |
| `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` (Mode Architecture) | **The executor contract.** How the primary agent reads the classifier lines and applies the override hierarchy. |
| `agents/*.md` + `CROSS_VENDOR` in `models.ts` | **The dispatch targets.** The agents the resolved rung/vendor selects. |

---

## Telemetry & observability

- `MEMORY/OBSERVABILITY/effort-router.jsonl` — one line per classification (mode, tier, reason, source, goal signal, latency).
- `MEMORY/OBSERVABILITY/intelligence-routing.jsonl` — one line per Per-Task down-route.
- On classifying ALGORITHM, the hook pre-writes `currentMode: 'algorithm'` + `phase: 'starting'` into the work registry so the dashboard never shows the wrong mode for the first beat.
- The statusline surfaces the gap between the live reasoning effort and the active tier's target as an amber `↑<TARGET>` nudge — the un-settable main-loop dial made visible, one `/effort` to close.

---

## What the Router is NOT

- **Not the Algorithm.** The Algorithm is its biggest consumer. The Router stops the instant the posture is decided; the Algorithm runs the phases.
- **Not context-file selection.** Choosing what to read is OBSERVE, inside the Algorithm.
- **Not the main-loop model switch.** The Router cannot change the running turn's model — it classifies up front and programs dispatched agents. A deliberate core-system session pairs the override with a manual `/model` on the main loop.
- **Not the Memory system.** Memory decides what to remember; the Router decides how to handle the prompt.

---

## Consumers

The Algorithm (reads MODE/TIER, runs the tier profile), the NATIVE executor (reads the posture, runs the tight template), `Inference.ts` utility calls, the Pulse statusline and Agents view, the work-registry phase tracking, and the remote channels (via the short-circuit directive).

---

## Release role

The Router ships with LifeOS as a **documented subsystem**. This doc lives under `LIFEOS/DOCUMENTATION/`, which the public-docs sync already mirrors (with its scrub rules) and the shadow-release gates already cover — so "a component of the release system" needs no new packaging machinery. It's listed in the routing table (`CLAUDE.md`), the master architecture doc's Subsystem Architecture and Pipeline Topology, the Architecture Decisions log, and the generated `ARCHITECTURE_SUMMARY.md`, exactly like every other subsystem.

---

## Cross-references

- Classifier + mode doctrine — `LIFEOS/ALGORITHM/v{VERSION}.md` (Mode Classification, Tier → Delegation Effort & Model)
- Executor contract — `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` (Mode Architecture)
- Model abstraction — `LIFEOS/TOOLS/models.ts` (AD-4: "the four-level effort→model abstraction")
- Utility inference — `LIFEOS/DOCUMENTATION/Tools/Tools.md`
- Master architecture — `LIFEOS/DOCUMENTATION/LifeosSystemArchitecture.md`
