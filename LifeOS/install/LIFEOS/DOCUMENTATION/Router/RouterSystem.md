---
last_updated: 2026-10-26
last_updated_by: da
last_reviewed: 2026-09-18
last_reviewed_by: da
convention: lifeos-freshness-v1
version: 2.15.2
---

# The Router — who runs what, on which model, at what effort

> **Since 2026-09-19 the Router is the engine of the Algorithm's Route step, not a system beside it.** The per-prompt classifier that once routed every prompt at the loop's entry is retired (Router ISA F13, 2026-10-25): its hook, DispatchAdvisor, stopped running on 2026-10-17 and was deleted, so no install draws a router line, writes a pick or routes effort per turn. The principal's own depth words (one matcher, `LIFEOS/ROUTER/Depth.ts`) make the turn a run, and Claude Code's native thinking and effort carry the depth (2026-10-16, native-unblock ISC-16). Every verdict, MAX and depth included, is advisory: the carrier decides how to split, delegate and cross-check (principal directive, 2026-09-29). The code stays in `LIFEOS/ROUTER/` as the step's engine (principal directive, 2026-09-19), the way Clef-omni sits under Assay's judgment layer.

> **The Router is the LifeOS system that decides which model and which agent do a piece of work, and lets you ask for that by name.** Every dispatch passes through it: an agent is named for the model it runs, its lane resolves in one registry, the helper spawns the right vendor at the right reasoning effort, and the trail shows what actually ran. A lineup change is a one-line registry edit that every surface follows.

The Router owns dispatch resolution. Its routing rules are the principal's preferences, written once in Algorithm § Routing (`LIFEOS/ALGORITHM/AlgorithmReference.md`) as BLE rules: the DA follows each by its intent on every dispatch, with freedom in how, and only the hard floors that section names bind as written (2026-10-26). No classifier picks a lane per prompt any more (see the banner above and § History). What replaced it is the written route: each run puts a `Lane:` line on its features, the LifeOSHooks plugin draws it, a background Assay question (caller `route-fit`, shadow, about half a second) flags a likely misfit, `LIFEOS/ROUTER/RouteCheck.ts` compares it with the dispatch log at the end, and a Socrates standing question holds the outcome, the smartest result rather than the cheapest, week over week (Router ISA F16).

- **Canonical CLI:** `bun LIFEOS/ROUTER/Router.ts lanes | rules | resolve <phrase> | status | models [--files] | audit [--sessions N | --days D] [--rows] | fable [--days N] | glance [--days N] | holdout [on|off] [--rate R] | deadlines [--days N] | checker-log <trigger> found|clean [--run <id>]`
- **Route check:** `bun LIFEOS/ROUTER/RouteCheck.ts route|check|fit <isa> [--session <id>]` (Router ISA F16); every subcommand exits 0 and nothing it reports blocks work
- **Registry:** `LIFEOS/TOOLS/models.ts` (data, never policy)
- **ISA (state of record):** `LIFEOS/ROUTER/ISA.md` (maintainer-side; does not ship)
- **Policy:** Algorithm § Routing (`LIFEOS/ALGORITHM/AlgorithmReference.md`), the only normative statement of routing; `hooks/lib/lane-rules.ts` parses it into `ROUTING_RULES`, and `Router.ts rules` prints it. § Rules below only points there

---

## Rules

The routing rules are written once, in the Algorithm: `LIFEOS/ALGORITHM/AlgorithmReference.md` § Routing, since 2026-10-25. `hooks/lib/lane-rules.ts` parses them from there and `bun LIFEOS/ROUTER/Router.ts rules` prints them. This document describes how the router code works and holds no rule.

## The one-line test

**Does it help decide who runs this piece of work, on which model, at what effort?** If yes, it is the Router. Executing the work is the Algorithm's job; capturing what comes in is Synapse's; the Router sits between them and answers only that question.

---

## The delegation axis — thinking vs execution

**A lane is chosen by how much DECIDING is left in the work, never by how big the work is.** (principal directive, 2026-09-20)

Size and difficulty are different things, and the old rubric ran them together — it described each lane by the shape of the job (renames, feature slices, multi-file refactors), so a large mechanical migration read as harder than a small subtle fix. It is not. A forty-file rename is settled work however long it takes; a six-line concurrency fix is a judgment call however few lines it touches.

| lane | rung | what is left to decide |
|---|---|---|
| inline | — | nothing to hand off: the answer is in context, or the one edit is already decided |
| Haiku | low | nothing, and the work is basic at scale: a careful script could almost do it |
| Sonnet at medium effort | medium | the ordinary local choices inside a decided approach — the what is settled, only the how has options |
| Sol | medium, high | execution for scheduled jobs and the Codex door, or on the principal's word: some thought inside a settled, correctness-judged approach, and volume |
| Opus | high, max | the deciding IS the work, analytical or creative: the main workhorse, and the carrier of most max-level work |
| Fable | max | the top model and the costliest, read-only: the hardest judgment only, one leg per run, and only while § Fable budget reads open, else on the principal's word (2026-10-16); the default second opinion is Sol in audit mode, elected by blast radius (rule 18) |
| Sol audit (lane id `astra`) | max | the OpenAI eye, read-only: strongest on exhaustive passes where missing one detail is the failure; also a cross-vendor second opinion. Run as `Worker.ts sol --mode audit` since 2026-10-12; the Astra agent itself is off automatic routing and runs only when the principal names it |

Two rules follow, and they are the ones that get broken:

- **Volume never buys intelligence.** Sol is the throughput rung, not the hard-thinking rung. Reaching for Sol because a task feels big is the failure the rubric exists to prevent; reaching past Haiku because a one-file fix is subtle is the rubric working.
- **The bottom rung is for work with no intelligence in it, and nothing else.** (principal directive, 2026-09-21; reshaped 2026-10-07) Haiku at high effort is the near-mechanical case; the medium rung is Sonnet at medium effort or Sol for the ordinary local choices inside a decided approach. Anything with real thinking left in it starts at the high rung.
- **The brief is where the thinking goes.** Sending a leg down means the carrier already did the deciding and wrote it down: the paths, the approach, the exact command that proves it landed. If the brief cannot be written that way, the leg is at the wrong rung — think more, or send it to Opus, where an open question is a valid brief.

**Blast radius is its own floor, and it is not the same question.** How much deciding is left says which model is smart enough; what a mistake costs says how cheap a model you are willing to let near it. They come apart: a one-line edit to a deploy gate, a secret path, an auth check or a migration needs no thinking at all and still does not belong on the cheapest lane, because the cost of a small error there is not proportional to the cognition the change required. When the two axes disagree, the floor wins. (Cross-vendor audit, 2026-09-20; the Astra agent contract already treats security boundaries and irreversibility as separate from difficulty.)

**The third axis picks the model once the rung is known.** (principal directive, 2026-09-24) Opus is the workhorse: any work where judgment is the work, analytical or creative, goes to Opus at the high rung and at the max rung. Sol serves scheduled jobs and the Codex door, or takes work on the principal's word. Fable is the top model and is spent gently (§ Fable budget); Sol in audit mode is the default second opinion. Audit mode is recognised by one property: the work fails if a single detail is missed, across something too large to hold at once — a security review of a sensitive system, a whole-codebase hunt for one class of issue, a sweep of a giant corpus. Depth, difficulty or importance alone never makes work an audit lane's.

This is a RULE, not a list, so work nobody has seen before routes correctly the first time it appears (principal directive, 2026-09-21). The axis lives once, as `CRAFT_AXIS` in `hooks/lib/lane-rules.ts`, and every classifier and refusal message renders from it. It replaced the 2026-09-21 vendor split, under which correctness-judged work went to the OpenAI lanes and taste-judged work to the Anthropic lanes.

**And where execution really is fully specified, deterministic code beats any model.** A brief so complete that a weak model cannot go wrong is usually a brief that did not need a model: a script, a codemod, a sed pass. Reach for the lane when the work needs reading and adaptation, not when it needs typing.

The tooth is at the door every caller shares. `LIFEOS/TOOLS/BriefGate.ts` refuses a brief bound for Sol that carries no acceptance statement — what must be TRUE when this is done — or names no paths, and it runs inside the codex helper as well as `Worker.ts`, so the agent wrappers cannot route around it. The acceptance line is the gate rather than a path-and-command check because a cross-vendor audit broke that version in one sentence: "refactor X so lane selection reads better; run bun test" names a real file and a real command and leaves the entire judgment unmade. A carrier that has not thought still knows which file it is pointing at; acceptance is the one section it cannot write without deciding. There is no bypass line, because an escape cheaper than compliance trains the escape; every refusal lands in `route-fidelity.jsonl` instead, so a mis-tuned gate shows up as evidence rather than as friction nobody reports. The executor brief those three receive says in its own words that the decision is already made, and gives the worker a way out: a choice the brief does not settle returns a `needs-judgment` verdict instead of a guess. Astra is exempt from all of it, because its brief is the scope of a sweep rather than a decided change. What the gate cannot do is see whether the decision written down was the RIGHT one — no code can, and it is not sold as doing so. Criteria: Router ISA R34–R35.

---

## The four ideas

**Agents are named for the model they run.** Astra runs OpenAI's flagship, but only when the principal names it (off automatic routing since 2026-10-12; Sol carries the OpenAI lane, audits included). Fable runs Anthropic's top tier. Sol runs the OpenAI worker model that carries its name, and Haiku runs Anthropic's cheapest tier. When you say an agent's name you are naming the carrier, so nothing on screen can be mistaken for something else. (principal directive, 2026-09-10)

**Lanes, never IDs.** No doc, prompt, or agent file names a model ID. An agent carries a lane key; the registry maps the key to today's ID; the daily sync moves the ID forward within the same family and class. Prose that names a model is the bug the registry exists to prevent, and `UpdateModels.ts --check` flags it.

**Levels are aliases, not agents.** "Max intelligence" is something the principal says, not an agent's name. `INTELLIGENCE_AGENT` in the registry maps that phrase to whichever agent runs the strongest model today (Fable); "deep thinking" maps to Opus, which carries max-level work, and "exhaustive coverage", "needle in a haystack" and "second opinion" to Sol in audit mode (Astra until 2026-10-12). On a lineup change the mapping moves; no agent is renamed to match.

**The work ladder, Opus-first at the top.** Low is Haiku (effort high), medium is Sonnet at medium effort or Sol, high is Opus, Sonnet or Sol (Sol serves scheduled jobs and the Codex door; on the Claude front door execution goes to Sonnet), max is Opus, Fable or Sol in audit mode. Needing more intelligence means moving up. The ladder is data (`WORK_LADDER` in the registry, default agent first) and `Router.ts status` holds it to the policy: the low rung must be the in-process Haiku agent at effort high, because it exists for near-mechanical work; the medium, high and max rungs may be either vendor, and an Anthropic rung agent must pin a real tier. At the high rung Opus takes the work where judgment is still open and Sonnet the execution once the approach is set. Haiku carries only the low rung; above it Sonnet is the Anthropic floor, which is also where `EFFORT_MODEL` low and medium land. (principal directive, 2026-09-28; it replaced the 2026-09-21 rule)

**Haiku runs only as the in-process low-rung agent.** Since 2026-10-07 the `Haiku` agent carries the low rung (`low: ["Haiku"]` in the registry). It is never a codex wrapper and never an `EFFORT_MODEL` level, and `Router.ts status` fails when either appears (ISA R21). A wrapper on that tier did the work itself, badly, more than once: it is too weak to hold the "hand it to the child and return the result" contract.

**A Claude route is the base agent plus an effort.** The router picks a model and an effort per task. On the Claude side the pick is `Agent({ subagent_type: "<Opus|Sonnet|Fable|Haiku>", effort: "<medium|high|xhigh>" })`: the Agent tool's `effort` parameter (Claude Code 2.1.292) overrides the agent file's frontmatter `effort:` and survives resume. The route decision and the pick row carry the base agent in `agent` and the effort in `effort`; codex lanes still take `--effort` on `Worker.ts`. Until 2026-10-15 each routed pair had its own generated agent file (`OpusMedium`, `OpusXHigh`, `SonnetMedium`, `SonnetXHigh`, `FableHigh`, `HaikuMedium`, built by `LIFEOS/ROUTER/AgentVariants.ts` (not in the public release)); those six files and the generator were retired 2026-10-15, `RETIREMENTS.json` moves an installed copy aside on upgrade, and `baseAgentOf` in `models.ts` maps an old name found in history to its base agent. `Router.ts status` still holds the ladder to the agent files, so the low rung is the Haiku file at effort high.

**`claude-code-guide` is outside the roster.** It ships inside Claude Code, not in `agents/`, and Anthropic pins it to the smallest tier in the binary. The roster reads `agents/*.md`, so it never enters `Router.ts status` and R21 cannot fail on it. A dispatch line showing that agent on Haiku is correct: docs lookup is the right size of work for it.

**One grammar for every routing line.** `hooks/lib/route-label.ts` draws all of them the same way: glyph, a label padded so `▸` lines up, who `➜` provider and short lane, the level meter, state, then the task in quotes. Dated model ids, the wrapper model and the helper name never appear on a drawn line; they stay in the events log (ISA R22).

**Staying inline is shown, and the default model is never named.** A carrier-only pick (lane `inline`, a skipped prompt, or a lane the work ladder does not carry) draws `◉ Inline · no model change needed`, with the advisor's effort as the meter and its confidence or skip reason after it. It never names the carrier model and carries no `advisory` tag, because nothing was routed. A dispatch lane that happens to be Anthropic (`opus`) is a real routing event and draws its own name. (principal directive, 2026-09-19; 2026-09-25.)

```
🧭 ROUTER   ▸ ▰▱▱▱ LOW · ◉ Inline · no model change needed · ●●●●● 0.97
🧭 ROUTER   ▸ ▰▰▰▱ HIGH · 🟢 Sol · ●●●●○ 0.81 advisory
🤖 DISPATCH ▸ 🟢 Haiku · ▰▱▱▱ LOW · ⏳ background — "rename files"
```

**Effort is the dial that moves.** Which model runs is settled by configuration: the session carrier in `settings.json`, a lane on each codex-backed agent, a worker lane on a down-motion dispatch. What moves with the work is reasoning effort (`/effort`, agent frontmatter, `--reasoning-effort` on the helper). Nothing moves the carrier's effort per turn since effort routing was retired (2026-10-25). A run never decides its own model.

---

## The pieces

| Piece | Where | What it does |
|---|---|---|
| **Registry** | `LIFEOS/TOOLS/models.ts` | The tables code imports when it must name a model: `WORK_LADDER` (level → the agents that carry dispatched work), `EFFORT_MODEL` (Claude tier per level: wrappers and the inference fallback), `CROSS_VENDOR` (every non-Anthropic lane, keyed by agent name with a lower-cased first letter), `INTELLIGENCE_AGENT` (spoken level → agent), pricing, egress classes. Data only; doctrine lives in OPERATIONAL_PREFERENCES. |
| **Roster** | `agents/*.md` | One file per dispatchable agent, named for its model. A codex-backed agent's lane is its name (or an explicit `lane:` key); a Claude-side agent carries a tier alias in `model:` or inherits the session carrier. |
| **Dispatch resolution** | `hooks/AgentInvocation.hook.ts`, `LIFEOS/TOOLS/HookBridge.ts codex-lanes`, the `LifeOSHooks` plugin `agent.spawn` | At the moment of an `Agent()` call the lane resolves the same way in all three places: `lane:` frontmatter wins, else the type's lower-cased name, looked up in `CROSS_VENDOR`; otherwise the Claude tier or inheritance. The plugin draws the `🤖 DISPATCH` line naming provider, model, effort, and wrapper. |
| **Helper** | `LIFEOS/TOOLS/CodexProgress.ts --lane <key>` | The one way a codex-backed agent runs: resolves the lane to an ID, spawns `codex exec` at the stated reasoning effort and sandbox, streams events, and writes the run record the trail reads. Agent files name lanes, never IDs. |
| **Codex-side router** | none | The Codex ModelRouter was removed 2026-10-16: Codex runs no model router. The bridge skips the maintainer-side dispatch-advice hook, which is not in the public release (`LIFEOS/CODEX/Bridge.ts` SKIP_LIST), and Codex picks its own agents and effort. |
| **Trail** | `LIFEOS/TOOLS/RouteTrail.ts`, `ModelMix.ts`, the statusline | What was asked for beside what ran: the 🔀 route trail marks each dispatch ✓ when codex's own session log observed the lane, ✗ when a different model ran, ∅ when a wrapper answered without running the helper. What is running now is Claude Code's own /tasks, /workflows and agent panel, not the trail; LifeOS only reaps stray processes (`Agents/AgentSystem.md` § Stray Processes). |
| **Router line** | Retired 2026-10-25 (Router ISA F13); nothing writes a pick. Formerly DispatchAdvisor, `hooks/lib/router-pick.ts`, `HookBridge.ts router-pick`, the `LifeOSHooks` plugin, the statusline | What the router picked for each prompt, shown to the principal: the dispatch advisor writes its lane pick to `MEMORY/STATE/router-pick/<session>.json`, the plugin draws `🧭 ROUTER ▸ ▰▰▰▱ HIGH · 🟢 Sol · ●●●●○ 0.81 advisory` under the prompt (level from `WORK_LADDER` / `EFFORT_MODEL`), and the statusline marks the picked lane's token with `▸`. The pick row never dispatches, blocks or selects a model. Nothing acts on it since effort routing was deleted (2026-10-25). A binding verdict asks for `🔀 INLINE: <reason>` when skipped; this is Algorithm § Route doctrine and does not hold the turn. Helper calls such as session naming draw nothing; their rows are in `function-hook-events.jsonl`. |
| **Effort routing** | Retired 2026-10-25 (Router ISA R42–R45) | Applied the router's per-turn effort pick to the carrier; nothing has written a pick since the front door left, so the policy and its switch were deleted. |
| **Eval routing** | `LIFEOS/ROUTER/EvalRoute.ts` | Which model an eval uses. The model under test is the carrier (settings.json `model` when pinned, else Opus) on the anthropic vendor with no fallback, and a trial served by another tier is voided. A suite that pins `agent_level` is testing a helper-lane job (a blind judge, a low-tier reader, an echo) and rides the helper lanes at that level. Judges ride the helper lanes in `USER/CONFIG/inference-vendor.json`; Calibration reads that answer from here, so calibration hashes are unchanged. Rule 19. |
| **Freshness** | `ModelSync.ts --daily`, `UpdateModels.ts --check`, `CarrierProbe.ts --check`, `hooks/ModelDriftGuard.hook.ts` | Same class means latest: pins move forward automatically; a pinned ID in prose, a stale lane, or a serving model that is not the configured one is flagged. |
| **Audit + contract** | `LIFEOS/ROUTER/RouteAudit.ts` (`router audit`), `LIFEOS/SOCRATES/adapters/router.ts` | Whether delegation actually happens, measured from the harness transcripts and codex rollout logs: per session the output tokens by model and the dispatches by lane; in aggregate the top-rung token share and the off-carrier rate among heavy sessions (≥40 tool calls). A Socrates question holds that rate against an ideal daily. A heavy session with no delegate dispatch is asked, in the route line's text, to state why in one `🔀 INLINE: <reason>` line under Algorithm § Route. That is advice only: the Stop gate that once held the turn for it, RouteGate, was retired 2026-09-21 in the hook minimization, and Router ISA R9 was closed to match on 2026-10-12. The audit also joins `router-decisions.jsonl` to the transcripts by session and turn and prints `below-carrier picks: F of N followed (dispatched D, INLINE I, ignored X)`: of the turns whose pick was a lane below that turn's own carrier, the share answered in the same turn by a dispatch to the lane or by an INLINE line (the line counts only on its own line with words after the colon, never quoted, fenced or as the bare placeholder). Holdout turns, same-rank or higher picks and turns with an unknown carrier are not counted (R57). Never a forced dispatch. |
| **Shape and checker yield** | `LIFEOS/ROUTER/Shape.ts`, `LIFEOS/ROUTER/CheckerYield.ts`, `Router.ts deadlines`, `Router.ts checker-log` | `Shape.ts` reads the two tokens in the principal's own prompt that set a request's shape: `dw` as the first or last word (the principal's Workflow opt-in) and a time at the end such as `10m` or `by 15:30` (a delivery deadline that also counts as that opt-in). It gives the DA one context line and logs ids and times only, never prompt text; the Router never starts a Workflow. `Router.ts deadlines [--days N]` joins each logged deadline to the transcript and says whether the reply landed in time. `CheckerYield.ts` logs whether a separate checker agent found anything, per trigger (`judged`, `high-risk-path`, `no-review`, `fix-round`, `manual`), through `Router.ts checker-log`; `Router.ts audit` reports the yield and flags a trigger as a drop candidate after 20 runs with no catch (Router ISA F5, R94 to R107). |
| **Written route** | `LIFEOS/ROUTER/RouteCheck.ts`, `LIFEOS/SOCRATES/adapters/router.ts`, the `LifeOSHooks` plugin | Each feature block in a run's ISA carries one `Lane: <Agent> · <effort>` or `Lane: inline` line. `RouteCheck.ts route` prints the one-line `🧭 ROUTE ▸ F1 Sonnet·high · F2 inline` the plugin draws; `check` compares it with `subagent-events.jsonl` after the run (a dispatch belongs to a feature when its description names `F<n>`; checkers are left out except for a feature routed to Sol audit); `fit` asks one Assay judgment-layer question per routed feature (caller `route-fit`, shadow, advisory, fail-open). An unknown agent word is named, never dropped, and no subcommand blocks anything. a Socrates standing question holds the week-over-week target from `Router.ts audit` (`untilMs` windows the prior week, `topModel` names the model the top-rung share measures); it needs at least 20 judged turns and reads unknown when the top model changed (Router ISA F16, R165–R170). |
| **Written thinking** | `LIFEOS/ROUTER/ThinkingCheck.ts`, `LIFEOS/SOCRATES/adapters/thinking.ts`, the `LifeOSHooks` plugin | Each feature block in a run's ISA may carry one `Thinking: <Skill>·<light|full>[, …] ; skipped <Skill>=<phrase>` or `Thinking: none=<phrase>` line (ISAFormat § Feature blocks, 2026-11-14): the thinking skills the run ran and the ones it considered and skipped, with a reason each. `ThinkingCheck.ts line` prints the `🧠 THINKING ▸ F1 RedTeam·light (skipped Council) · F2 none` line the plugin draws beside the route line; `check --session` compares it with the Skill tool calls in that session's transcript (roster words only, no model call); `fit` asks one Assay judgment-layer question per skipped skill (caller `thinking-fit`, shadow, advisory, fail-open): would running it have changed the result. The Socrates `thinking` adapter (ref `thinking-skips[:days]`) folds those rows into the weekly share of skips judged would-have-changed, unknown under 10 judged runs. The line is a record the DA writes by intent (Algorithm § Spend); an unknown skill word is named, never dropped, and no subcommand blocks anything. It brings back, as a measured record, the check PAI v2.5 ran as a six-tool INCLUDE/EXCLUDE walk on every request. |
| **Unattended lanes** | `LIFEOS/TOOLS/AgentJob.ts`, `Inference.ts` | Scheduled jobs and helper inference run on subscriptions, never a LifeOS API key: Haiku for low and Sonnet for medium on the Claude subscription, Sol and Astra for high and max through codex on the ChatGPT plan (principal, 2026-10-12). The `defaults` block in `agent-jobs.json` and a job's own `vendor`, `lane` and `fallback` override this. |

---

## Asking for it by name

| You say | The Router does |
|---|---|
| "Send it to Sol audit" | dispatches Sol read-only (`Worker.ts sol --mode audit`) for an exhaustive sweep or a second opinion; "Send it to Astra" still dispatches the Astra agent because you named it |
| "Max intelligence on this" | resolves the level through `INTELLIGENCE_AGENT` → Fable today |
| "Fable, second look" | the top model, read-only at xhigh effort: an extra evaluation the principal asks for by name |
| "Give it to Haiku" | dispatches the in-process Haiku agent (effort high) |
| "Give it to Sol" | dispatches the OpenAI Sol worker, workspace-write, isolated codex home |
| "Sol, audit" | the read-only cross-vendor audit (`--mode audit`); "Sol, build this" fixes what a sweep found. "Astra, audit" and "Astra, build this" still work when you name Astra |
| "Opus, build this" | the main workhorse: the Anthropic `opus` alias in-process, for any work where judgment is the work |
| nothing about a model | work that needs this session's context inherits the carrier; every other leg goes down the ladder — Opus while judgment is still the work, then Sonnet, Sol or Haiku as the deciding runs out |

```sh
bun LIFEOS/ROUTER/Router.ts lanes                     # every agent → runtime, lane, vendor, effort, sandbox, access; then the work ladder
bun LIFEOS/ROUTER/Router.ts resolve max intelligence  # "max intelligence" → Fable → fable (anthropic, xhigh effort)
bun LIFEOS/ROUTER/Router.ts status                    # exit 1 when an agent has no lane, an alias dangles, or the ladder breaks its policy
bun LIFEOS/ROUTER/Router.ts models [--files]          # every model in use across all vendors: id, upgrade path, and the files that use it
```

---

## The front door, thinking routing and effort routing (retired)

No install routes prompts any more. The per-prompt front door (DispatchAdvisor) was unregistered 2026-10-17 and deleted 2026-10-25 (Router ISA F13). Thinking routing rode on its call and went with it. Effort routing, which raised or lowered the carrier's effort from each turn's pick, had nothing to act on once picks stopped; its policy, report commands and switch were deleted 2026-10-25 (R42–R45). Their manuals are in git history.

What still runs from that era:

- `hooks/lib/prompt-shape.ts` under TimeContext stamps the shape line and deadlines on every prompt, reading `skipReason` from `LIFEOS/ROUTER/FrontDoor.ts`.
- `LaneTrain.ts`, `LaneQuestions.ts`, `LaneConsensus.ts` and `RealPrompts.ts` are reused by Errata's labelling and training; `lane-model.json` and `thinking-model.json` stay as trained.
- `ThinkingRules.ts` holds the thinking-skill rubric and `Depth.ts` the depth-word matcher.

## Width tiers

The width tiers and their rules moved into `LIFEOS/ALGORITHM/AlgorithmReference.md` § Routing on 2026-10-25, the one place every skill, `dw`, the `p` levels and the shared Workflow scripts read them from.

## Fable budget

Fable is the top model, and its window runs out faster than any other. The router spends it gently, reading Fable room from the subscription usage the install polls (Router ISA F9). The principal wants Fable used gently because it runs out so fast.

`LIFEOS/ROUTER/FableBudget.ts` reads the usage poll of the user's own subscriptions and returns one status, so the router budgets the user's own Fable allowance and stops picking Fable when it is spent. `bun LIFEOS/ROUTER/FableBudget.ts` prints it with each subscription's room and pace.

| Status | When | An automatic Fable pick | The principal's `/route fable` |
|---|---|---|---|
| open | some account has at least 10% weekly Fable room and is spending Fable no faster than an even pace through its window, plus 10 points | ✅ stays Fable | ✅ Fable |
| ahead | every account with room is past that pace | ⚠️ Opus at xhigh, or Sol audit for a second look | ✅ Fable |
| low | the best weekly Fable room is under 10% | ⚠️ Opus at xhigh, or Sol audit | ✅ Fable |
| unknown | no poll, or one older than 30 minutes | ⚠️ Opus at xhigh, or Sol audit | ✅ Fable |
| out | no polled subscription under 99% on its 5-hour, weekly and Fable windows | 🔴 Opus at xhigh, or Sol audit | 🔴 Opus at xhigh |

- **The second-look test.** A moved pick goes to Sol audit when the engine answered the `second_look` question yes at 0.5, because a second opinion keeps its value from another vendor's eye. Everything else goes to Opus at xhigh, the max-rung workhorse.
- **What the record shows.** Every decision whose pick was Fable carries `fable: { status, room, to }` in `router-decisions.jsonl`, and a moved pick draws as `Opus (Fable low → Opus)` on the route line.
- **Fable never stalls the work (rule 26).** A Fable leg decides the approach or reviews the result; the building fans out to Sonnet and Opus in parallel, so no part of the run waits behind a chain of Fable legs. One Fable leg per run is the norm (rule 7). `bun LIFEOS/ROUTER/Router.ts fable [--days N]` counts the Fable legs and their minutes from dispatch to completion, the legs that started within 10 minutes of another Fable leg finishing (in series), and the sessions that ran more than one.
- **Muse is not a Fable fallback.** Muse is a side lane that runs only in a scratch workspace outside every private tree, never takes the reasoning, audit or second-look lanes, and is never routed automatically (its agent contract). Since 2026-10-16 it may carry any data class except secret values (Security/DataClassification.md); the router never picks it.

## The router holdout

A randomized slice of turns runs without the Router, so "is the Router helping?" has a causal answer instead of a correlation (execution-evidence ISA, Phase 3).

- **The switch.** `USER/CONFIG/router-holdout.json` (`mode` on|off, `rate`). Absent, off, malformed or a rate of 0 all mean off, and off changes nothing. Only the principal turns it on or changes the rate: `Router.ts holdout on --rate 0.1`, `Router.ts holdout off`, bare `Router.ts holdout` to read it. Rates above 0.5 are refused. The live setting is in the file; read it, not this line.
- **Which turns.** Only turns the Router actually advised: never a skip, never the principal's own lane or depth directive, never a binding or dictated route. A hash of the turn's prompt id picks the arm, so the same id always lands in the same arm (`LIFEOS/ROUTER/Holdout.ts`).
- **What a held-out turn skips.** The route line, the skill list and the Codex dispatch packet. Its pick row is a skip with reason `holdout`, so effort routing leaves the turn at the carrier's own setting. The full decision is still computed and logged with `holdout: true`; routed turns in the experiment carry `holdout: false`.
- **The read.** `bun LIFEOS/EVIDENCE/Project.ts query experiment` prints turns, mean P(bad) and main-loop cost per arm, with a 95% bootstrap interval on each held-out minus routed difference. A positive P(bad) difference means the Router helped.
- **The cards.** The `evidence-weekly` workflow (Mondays 08:23) checks the comparisons pre-registered in `LIFEOS/EVIDENCE/Recommend.ts` and files an Upgrades card (source `evidence`) only when an interval excludes zero with at least 200 turns per arm. Cards recommend; nothing changes the Router without the principal's yes.

## The delegation contract

The Router configures who runs what; whether the carrier hands work off at all was, until 2026-09-16, judgment with no meter. An audit of recent sessions found that few dispatched anything, that most Claude output tokens ran on the top rung, and that two prose nudges that had fired for days without effect. So the contract is now three pieces, two mechanical and one advice:

- `router audit` is the meter. It reads what ran, never what was logged as asked for. It counts an `Agent` dispatch and a direct `Worker.ts` hand-off the same way, through the one `isDirectDispatch` in `hooks/lib/delegation.ts`. It did not until 2026-09-20: the one-call path landed on 2026-09-19 and the guard learned it that day, the audit did not, so real hand-offs read as mechanical calls on the carrier and the rate printed far below the true one. A meter blind to the path doctrine mandates is worse than no meter, because every guard built on it is scored against a window it never saw.
- Socrates asks daily whether at least half of heavy sessions sent work off the carrier (a lower Claude tier or a codex lane). Fable→Fable second looks count as delegation, not as down-motion.
- A heavy, undelegated turn is no longer asked for an `🔀 INLINE: <reason>` line (DriftReminder's DELEGATION line retired 2026-10-16, native-unblock ISC-16); a forced dispatch would Goodhart into token spend (the 2026-07-12 kill stands). The meter still reads any INLINE line written: `router audit` prints how many below-carrier picks were followed by a dispatch or an INLINE reason in the same turn, and how many were ignored (R57).
- Nothing forces a dispatch. From 2026-09-16 to 2026-09-24 DelegationGuard refused the carrier's 31st Bash/Edit/Write call since its last hand-off (R10). Once Opus became the carrier, and Opus was also a lane that reset the count, the cheapest unlock was handing a half-built job to a fresh Opus with none of the context, and one session did it repeatedly. R41 retired the block and the principal's override that lifted it. The per-session counter still runs on every PreToolUse, as a meter for the audit; the statusline's delegation counters were cut with the native work display (Router ISA R13, 2026-10-11). The route line reads the session's model from the transcript and says `inline`, not `delegate`, when the picked lane is that model.

Which model the carrier itself is stays configuration (`settings.json`), and moving it is the principal's call, not the Router's.

---

## The boundary

- **Router vs Algorithm.** There is no boundary any more: the Router is the Algorithm's Route step. The Algorithm decides what to do and whether it is done; its Route step decides who runs each piece and on what. Its verdicts are advisory; only the principal's own depth words bind a route.
- **Router vs Synapse.** Synapse routes *inputs* to where they belong (capture → grade → route). The Router routes *work* to models and agents. Both are routers; they never overlap.
- **Router vs the harness.** Claude Code owns the session carrier and the effort setting. The Router never overrides an active model; it configures dispatches and reports what ran.
- **Router vs security.** Egress class is data in the registry (a lane is PUBLIC-only or RESTRICTED-capable); the guards that enforce it (`EgressClassGuard`, the plugin's data-class ceiling) are the Security system's.

---

## Changing the lineup

**Every model is in the registry, and the Router knows where each one is used (2026-09-22).** `models.ts` lists every model LifeOS runs, across every vendor: Claude tiers in `CURRENT`, and every other model (OpenAI, Google, xAI, Fish Audio, Perplexity, Replicate, Suno, Cloudflare) as a `CROSS_VENDOR` lane. `Router.ts models --files` computes each model's consumers from the tree on every call (`LIFEOS/ROUTER/ModelMap.ts`), so no hand-kept list can drift. A model id typed outside the registry fails `UpdateModels.ts --check`, and `ModelSync --daily` runs that check after its bumps. The Upgrade skill's `Models` intent is the full pass: the deterministic bumps plus researched vendors with no public roster.

- **A new model of the same family and class:** nothing by hand. `ModelSync --daily` and `UpdateModels.ts --cross-vendor --sync` move the pin.
- **A class change or a new vendor:** the principal's call; edit the registry lane, run `Router.ts status` and `UpdateModels.ts --check`.
- **A new agent:** add `agents/<Model>.md` named for its model; its lane key is its name. `Router.ts status` fails until the registry has the key.
- **Moving a rung of the ladder:** edit `WORK_LADDER`; `Router.ts status` holds it to the policy.
- **Moving a level:** edit `INTELLIGENCE_AGENT`. Never rename an agent to satisfy an alias.
- **Renaming an agent (rare):** the file, the registry key, and `settings.json` `Agent(<Name>)` allow rules. Max → Astra on 2026-09-10 is the worked example (`git log -S"Agent(Astra)"`).

---

## The judgment lane (engine: Clef-omni, advisory, shadow-logged)

The engine is Clef-omni (Cloudflare Workers AI on our own account; before it, Jev from TypeSafe, retired 2026-10-10). It is a System One model: it writes no text and answers typed questions (Choice, Score, Noul) with probabilities in about 300 ms for a fraction of a cent, and it can read images, audio and video as well as text. In the Router its answers feed the learned lane and effort heads, which no live caller reads since the per-prompt front door left. This does not reopen the 2026-07-11 retirement: no mode is chosen, and the dispatch decision stays the carrier's. Nothing applies the effort head's verdict to the carrier's effort; effort routing and its measured bar were deleted 2026-10-25 (Router ISA R42–R45).

- **System:** Clef-omni is the engine under Assay's judgment layer (`LIFEOS/DOCUMENTATION/Assay/AssaySystem.md` § Judgment layer), which owns the caller registry, thresholds, budgets, ledger and report. Every caller below asks `LIFEOS/ASSAY/Assay.ts`; only the judgment layer calls the client.
- **Client:** `LIFEOS/ASSAY/Engine.ts` (`probe`, `schema`; `ask`, `report`, `alerts`, `drift`, `callers` forward to `Assay.ts`). The lane is `CROSS_VENDOR.assayEngine` in the registry; the credentials are `CLOUDFLARE_ACCOUNT_ID` and the one master `CLOUDFLARE_API_TOKEN` (`resolveCredentials()` in `Engine.ts` reads no second Cloudflare token, so a `CLOUDFLARE_AI_API_TOKEN` is ignored and the call fails with no key).
- **Second engine:** Assay's extraction engine, Clairic (`CROSS_VENDOR.assayExtract`, client `LIFEOS/ASSAY/Extract.ts`), runs on the same account and the same token. The Router does not call it; it answers fill-in-the-blank fields for `extract()` (`LIFEOS/DOCUMENTATION/Assay/AssaySystem.md` § Extraction).
- **Dispatch advisor (retired 2026-10-25, Router ISA F13):** DispatchAdvisor on UserPromptSubmit asks the judgment layer its eighteen lane and effort questions and six prompt signals (the shadow skill pick, the `skill-router` caller, was retired 2026-10-10, Router ISA F4), then injects one `🧭 ROUTER:` line with the selected lane, effort, decision source and binding status. The judgment layer's learned model supplies the pick. The Opus classifier runs only when it has no pick, or on a depth prompt. Every route advises, MAX included; only the principal's depth words bind (Algorithm § Route). Either `LIFEOS_GLANCE_DISABLED=1` or the one-release legacy `LIFEOS_JEV_DISABLED=1` (named for Jev, retired 2026-10-10) disables it.
- **Codex front door:** no router line and no packet checks (removed 2026-10-16: Codex runs no model router).
- **Shadow log:** every call appends one line to `MEMORY/OBSERVABILITY/assay.jsonl`; all readers merge it with the former `jev-decisions.jsonl` (Jev retired 2026-10-10) by timestamp so history remains visible.
- **Data class:** Cloudflare Workers AI on our own account is restricted-capable under the current vendor policy. The advisor redacts secret shapes, emails, and phones; prompts carrying secret-value shapes are refused before fetch, while USER paths and private content are not categorically excluded. Caller-specific schemas and restrictions still apply.
- **Caller registry:** `LIFEOS/USER/CONFIG/assay-callers.json` is preferred, with `jev-callers.json` as the one-release fallback. Thresholds never live as code literals (`/ic --section glance-thresholds`; `jev-thresholds` is an alias for one release). Both legacy names come from Jev, retired 2026-10-10.
- **ISAs:** the first unit is closed; the adoption program covers every cluster, milestones, and absence-review guarantees.

### Data class per caller

Written before a caller's first call (program ISA ISC-2). Anthropic, OpenAI, Google and Cloudflare Workers AI (the engine) routes are restricted-capable under the current vendor policy; each caller still declares the narrowest data class and payload it needs. "Derived features" means a typed schema of counts, enums and scores; free text is never a feature, and no stable session, person or customer id travels beside a sentiment or satisfaction question.

| caller | state sent | class | redaction | status |
|---|---|---|---|---|
| `probe` | one fixed sentence | PUBLIC | none needed | live |
| `dispatch-advisor` | the prompt text (head and tail, 2000 chars after redaction) and the last 800 chars of the previous reply | own data, permitted on the engine | `redactForEngine` (secret shapes, emails, phones); secret-value shapes are refused before fetch | live, shadow |
| `skill-router` | the same prompt text, no previous reply, with two questions: the skill index, and which of the nine thinking skills fits (or none, since 2026-09-26) | own data, permitted on the engine | `redactForEngine`; the client refuses secret-value shapes | retired 2026-10-10 (Router ISA F4); it was split from `dispatch-advisor` 2026-09-25 and no longer has a registry row or a report |
| `codex-frontdoor` | the prompt text plus the lane rules | own data, permitted on the engine | `redactForEngine`; the client refuses secret-value shapes | retired 2026-10-16 with the Codex model router: the Codex bridge skips the dispatch advisor, so nothing calls it; no registry row |
| `stop-advisor` | the turn's own final assistant text | own data, permitted on the engine | `redactForEngine`; the client refuses secret-value shapes | live, shadow |
| `ideal-pursuit` | the last 800 chars of the turn's reply, only on a turn that changed an ideal-state file | own data, permitted on the engine | `redactForEngine`; the client refuses secret-value shapes | retired 2026-10-17 with IdealPursuitShadow: almost no calls and no labels; no registry row |
| `done-check` | one pinned ask from the principal's request, the last 2,500 chars of a reply that claims done, and a one-line-per-call summary of the turn's tool calls | own data, permitted on the engine | `redactForEngine` on all three fields; the client refuses secret-value shapes | live, only as VerificationGate's veto: it asks `asks_accounted` once before a dropped-ask block, and a yes can only lift the block. The per-stop shadow judging (`ask_fulfilled`, `request_covered`) was unregistered 2026-10-17 after a long run of judged turns with no labels |
| `eval-judge` | the assert output under test plus the rubric's anchored levels | PUBLIC | `classifyText` via `ask()`; non-PUBLIC outputs fall through to the model judge unchanged and are never sent | live, shadow since 2026-09-30 — it was the first caller allowed to act (enforce from 2026-09-21 on a measured same-run agreement, taken on the retired engine), but both its questions have been shadow since 2026-09-23, so the model judge answers; the registry keeps the 2026-09-21 record as history |
| `eval-judge-pairwise` | the two candidate texts plus the comparison question (tournament case) | PUBLIC | as above | live, shadow — split from `eval-judge` on 2026-09-21; no rows yet |
| `surface-rating` | one app story excerpt, stripped of source, author and current score | PUBLIC | `redactForEngine` in the app scripts | live, shadow — runs from your app's scripts; blind human labels are its ground truth |
| `bunker-glance` | one `glance` Test Strategy row: the criterion text plus the state its question file's producer emits, or a kept case file under the ISA's own `Labels/` directory | own data, sent under the 2026-09-17 lift | the producer runs with vendor keys stripped; `redactForEngine` on its output, and the row is refused when a credential shape is found | live, shadow — glance rows under `bunker test`, `bunker label`, `bunker miss`; new questions arrive through `registerQuestion` at `defaults.provisional_threshold`, uncalibrated |
| `guard-calibration` | synthesized write attempts from `LIFEOS/ASSAY/fixtures/guard-cases.jsonl` (not in the public release) | PUBLIC (authored fixtures) | none needed | offline cohort for `tune`; never runs in a hook |
| `judge-calibration` | nothing; the row only holds the `agreement` and `kappa` floors a model-judge calibration record must clear, read by `Calibration.ts calibrationFloors()` | none sent | none needed | registry-only, budget zero; never calls the engine |
| `lane-train` | nothing; the row only holds the learned router's `handoff` cut, read by `LaneTrain.ts handoffThreshold()` and stamped into `lane-model.json` | none sent | none needed | registry-only, budget zero; never calls the engine (the refit asks under the thinking-train caller) |
| `question-design` | synthesized cases for one designed question system (the Assay skill's CreateQuestions intent): each stage's declared state fields, capped per field by the system file | PUBLIC (authored fixtures) | `redactForEngine` in `ask()`; the client refuses secret-value shapes | live, shadow — design-time measurement only, never read by production code |
| `deeds-commit-climb` | real public-repo commits from the deeds commit-classification climb (non-excluded repos only; the private config, user-data, backup, dotfiles and security-advisory repos are refused by the harness): the system file's declared state fields, diff redacted by deeds and capped per field | PUBLIC (public LifeOS repo) to INTERNAL (private code repos) | `redactForEngine` in `ask()`; the client refuses secret-value shapes | live, shadow — design-time measurement only, never read by production code |
| `proof` | structured state derived from one produced artifact (OCR tokens with size, position and prominence, overlay geometry, or the text itself) plus one compiled intent check, asked as one pooled batch per output | own data, sent under the 2026-09-17 lift | output carrying a secret or a private path, or that cannot be scanned for one, is withheld whole and the finding reads unavailable; `redactForEngine` in `ask()` | live, shadow — flags only, code-tier checks decide; principal verdicts on delivered artifacts (`Proof.ts miss` / `label`) are its ground truth |
| `assay-pairwise` | two candidate outputs and the criterion they answer, one `choice` question (candidate / champion / same) asked twice with the order flipped | own data, sent under the 2026-09-17 lift | `redactForEngine` in `ask()`; the client refuses secret-value shapes | live, shadow — first tier of a Tournament side-by-side; the bracket decides while shadow |
| `calibrate-taste` | one stored text output with its judged-assert rubric and the principal's taste note appended | own data, sent under the 2026-09-17 lift | `redactForEngine` in `ask()`; the client refuses secret-value shapes | live, **enforce** since 2026-10-12 under a 30-day principal waiver (2026-10-12 to 2026-11-11): the judgment acts before labels earn it, Haiku checks 1 call in 10, and the caller reverts to shadow under 85% agreement over 20 checks — Haiku swap: the `meets` question acts and the Haiku judge is skipped on Calibrate like/dislike verdicts; a judgment-layer failure falls back to Haiku |
| `commitment-detect` | one outbound message's text | own data, sent under the 2026-09-17 lift | `redactForEngine` in `ask()`; the client refuses secret-value shapes | live, **enforce** since 2026-10-12 under a 30-day principal waiver (2026-10-12 to 2026-11-11): the judgment acts before labels earn it, Haiku checks 1 call in 10, and the caller reverts to shadow under 85% agreement over 20 checks — Haiku swap for `CommitmentDetect.ts`; the `commitment` question acts and Haiku is skipped; a judgment-layer failure falls back to Haiku |
| `newsletter-section` | one newsletter story line (title and summary) | PUBLIC (published links) | `redactForEngine` in `ask()` | live, **enforce** since 2026-10-12 under a 30-day principal waiver (2026-10-12 to 2026-11-11): the judgment acts before labels earn it, Haiku checks 1 call in 10, and the caller reverts to shadow under 85% agreement over 20 checks — Haiku swap for the edition's section choice; the `section` question acts and Haiku is skipped; a judgment-layer failure falls back to Haiku |
| `thinking-train` | one real prompt (head and tail, 2000 chars after redaction) and the previous reply, from the router's sampled prompt set | own data, permitted on the engine | `redactForEngine` before the call; the client refuses secret-value shapes | the `LaneTrain.ts` refit's re-ask (`REASK_CALLER`); the thinking collector and trainer (`ThinkingCollect.ts`, `ThinkingTrain.ts`) were deleted in the window; never decides anything live |
| `vigil-route` | planned: one routed Vigil event, so its route can be logged beside the deterministic severity floor's decision | own data, permitted on the engine | `redactForEngine` in `ask()`; the client refuses secret-value shapes | registered in shadow, no call site yet (Vigil ISA ISC-21); the floor decides every route |
| `mail-label` | typed features of one message: sender class, subject shape, counts — never the body | PUBLIC by schema | schema-enforced | live, shadow; registry row pending |
| `cli`, `image-tags` | ad-hoc `ask` from the shell; image tag candidates | PUBLIC | `redactForEngine` | ad-hoc; registry row pending |
| PostToolUse, SubagentStop | the tool name and exit status | PUBLIC | as above | planned (ISC-12) |
| `guard` | the redacted new content of a SYSTEM-zone Write/Edit/MultiEdit, or the redacted Bash command while the session holds a taint mark, capped at 8000 chars before it leaves PreToolGuard | caller-authorized data | `redactForEngine`; the client refuses secret-value shapes | live, shadow |
| skill and intent router, context loader, memory relevance | the prompt text; skill USE WHEN lines; memory entry titles and tags only | PUBLIC | `redactForEngine`; entry bodies never sent | planned (ISC-13..15, 25) |
| compaction | transcript chunks | PUBLIC only after redaction; chunks naming USER paths are dropped, not sent | `redactForEngine` plus classifyText per chunk | planned (ISC-16) |
| ISA splitting test, doc freshness | criterion text from an ISA; doc headings and referenced file names, never `LIFEOS/USER/` docs | PUBLIC | classifyText per criterion | planned (ISC-23, 24) |
| sessions, Errata enrichment | typed features only: kinds, counts, exit codes, hook line names, scores | PUBLIC by schema (ISC-35) | schema-enforced in `ask()`; no prompt bodies | held on the agreement row (ISC-19..22) |
| `errata-audit` | one Errata entry's complaint plus its requested/doing/response context, capped at 3000 chars, with three entry questions (`defect`, `failure_class`, `cost`); the model owns the final defect verdict and fixes are proposed per cluster; no erratum id, session id or reporter travels with it | own data, sent under the restricted-data decision; Cloudflare Workers AI is restricted-capable in `data-classification.ts` | `redactForEngine` (secret shapes, emails, phones); random per-run key, id join kept local | live, shadow |
| `errata-triage` | one typed exchange: the prompt, the end of the reply before it, the prior ask, and the last three tool calls, with ids, session ids and home paths scrubbed, capped at 3000 chars; 11 detect and blame nouls on every exchange, 18 mode and cost nouls on composed failures | own data, same as `errata-audit` | `redactForEngine` plus the id and home-path scrub | live, shadow |
| `errata-coverage` | Errata M7b, three state shapes, each capped at 3000 chars with ids, rule ids, session ids and home paths scrubbed: one failed exchange plus up to four candidate rule texts (a `rule_covers` noul per rule); two failed exchanges' messages and reply ends (`same_root_cause`); one written recommendation with its rule text, related Upgrade claims, the target file's head and example messages (`rec_already_done`, `rec_more_prose`, `rec_addresses`) | own data, same as `errata-audit` | `redactForEngine` plus the id and home-path scrub | live, shadow — own budget so coverage never starves `errata-triage`; cuts provisional (`calibrated: null`) |
| `cortex-recall` | one recall candidate per call: session name, task, slug, and the passages of its ISA or transcript that best match the question, capped at 1500 chars; `--judge`/`--answer` only | own data, sent under the 2026-09-17 lift, same as `errata-audit` | `redactForEngine` in `ask()`; no session id travels | live, shadow |
| `isc-tier-classify` | one manual Test Strategy row at a time as the named fields `criterion`, `check` and `expected`, capped at 8000 chars; two questions in one call — a `choice` of codable / readable / taste, and a `shell-settles` noul asking whether a shell command reading no prose would settle the criterion | own data, sent under the 2026-09-17 lift, same as `errata-audit` | `redactForEngine` before the call; no ISA path, no criterion id travels | live, shadow — `IscTier.ts propose`, and `IscTier.ts triage --estate`, which pools every unresolved row of one ISA into a single call over the same three fields; the answer is a draft a person ratifies, and a disabled engine falls back to a deterministic keyword pass. The `shell-settles` threshold is the confirmation bar for the codable option, not a per-question threshold: a codable choice the noul does not confirm is recorded as readable. PROVISIONAL (`calibrated: null`) |
| `isc-tier-shadow` | the state one proposed glance question reads: a file under the ISA's own directory, or the JSON a bounded producer prints with every vendor key stripped, capped at 8000 chars — and, for the ISC-30 sensitivity probe, a second copy of that same state with the claimed property deleted or negated, so each question is asked twice over one producer's output and nothing new is sent | own data, sent under the 2026-09-17 lift | `redactForEngine` on the producer's output before the call; the mutation is applied to the already-redacted text | live, shadow — `IscTier.ts shadow` and `IscTier.ts propose`; runs proposed questions once so an agreement rate exists before ratification, and rejects any question whose confidence survives the mutation. Its `mutation-sensitivity` threshold is the ISC-30 bar, not a per-question threshold, and is PROVISIONAL (`calibrated: null`) |
| `newsletter-subtitle` | one newsletter subtitle (the edition's published preview text) per call, with eight questions about how compelling it is; no date, edition number or outcome travels | PUBLIC (published text) | `redactForEngine` in `ask()`; the edition-number join stays local | live, shadow on the maintainer install — `Subtitle.ts study` and `Subtitle.ts judge` (maintainer-side; not in the public release); advisory ranking only, fail-open |
| wake gates (heartbeat, mail-monitor) | the tick's finding summary; sender class, subject | PUBLIC by schema | never a mail body | held on the agreement row (ISC-29) |
| app customer sentiment | the app's own tenant and vendor key; per-interaction features, per-call random key | tenant data, not LifeOS PUBLIC; needs the app's data-processing terms to name the engine's vendor | app-side | held (ISC-32, 46) |
| inbox labeling | sender domain, subject, the 9-stage rule output | PUBLIC by schema | never a body | held on the agreement row (ISC-33) |
> The Bunker CLI is maintainer-private and not in the public release; run code rows with `bun test ./<path>` and suite rows with `bun skills/Assay/Tools/EvalRunner.ts`.

**Zero-retention agreement with TypeSafe: none (2026-09-17).** Their policy named no training on inputs and US hosting, but no retention window and no SLA. TypeSafe stopped being the engine on 2026-10-10, so this line is history; whether the "held" rows above can move now that the engine runs on our own Cloudflare account is the principal's call (program ISA, Open).

---

## History

**2026-09-25: from advice to action.** A comparison with OpenRouter's Jev router led to a full review and upgrade. Two reviewers read six open-source Jev routers and our code. Theirs acted on the live request and ours only advised; ours had one question eating the shared Jev budget, a signal question overwriting the wording the model was trained on, long prompts losing their final ask, a depth word able to carry a key past the secret check, an audit blind to the worker homes, and binding never logged. All of it was fixed with tests, and the carrier's effort is now applied per turn under a measured policy with a cache guard (Router ISA R42–R56). Jev was the engine then; it was retired 2026-10-10.

**2026-09-24: Glance decides, trained on real prompts.** Routing moved fully to Glance, tested on real prompts rather than synthetic ones. The router had been built on synthetic prompts first, and the model trained on them agreed with Opus on well under half of real prompts. Three changes followed. RealPrompts.ts sampled real typed prompts, along with the end of each previous reply. The rules were tightened at three places where the labelers had disagreed: hand-off is its own decision, Opus or Sol depends on whether a pass/fail test can be written up front, and max work goes to Opus at xhigh, with Fable only for second opinions. With the new rules, blind lane agreement rose clearly. Opus, Fable and Astra then labeled the whole sample, and the learned heads were retrained on that majority. FrontDoor 1.2.0 lets Glance decide and keeps the Opus classifier as the fallback.

**2026-07-01 → 2026-07-11: the first Router.** The name originally covered a prompt→posture layer: a classifier hook decided mode (MINIMAL/NATIVE/ALGORITHM) and an effort tier (E1–E5), then selected a model rung and an agent. It was retired on 2026-07-11 when modes and tiers were abolished system-wide. There is one response format and one loop; spend is discovered from the work. The classifier hook was deleted and has no successor. Only the model tables survived.

**2026-09-09 → 2026-09-10: the second Router.** Cross-vendor agent lanes (Astra, the Sol/Terra/Luna workers) made routing the live behavior on most dispatches. Agents were renamed for their models, the spoken level "max intelligence" became a registry alias, the LifeOS Advisor agent was retired (an advisor is a meta-system, not a pickable agent), and the routing that had existed unnamed across five files was named the Router and given this doc, an ISA, and a CLI.

---

**2026-09-18: the ladder.** The top rung became Astra and/or Fable and everything below it the OpenAI workers. The Claude tier alias stopped being the down-motion door, and Opus became an exception lane.

---

**2026-09-21: the third axis.** The bottom two rungs were narrowed to work with no intelligence in it, and Opus and Fable came back as regular dispatch lanes beside Sol and Astra. What decides between the two vendors at a rung is the kind of judgment the work needs: correctness to OpenAI, taste to Anthropic. Sonnet and Haiku stopped being work tiers anywhere, leaving Opus as the Anthropic floor. Written as a rule about the work rather than a list of skills, because the requirement was explicitly that a blog post or an image prompt route to the creative lane with nothing hardcoded.


**2026-09-24: Opus is the workhorse, Astra narrows.** Astra stopped being the analytical max rung and became the lane for one shape of work: an exhaustive pass where missing a single detail is the failure, plus elected second opinions. Opus carries every piece of work where judgment is the work, including most max-level work; Fable is the top model and the second opinion; Sol takes the lower work at the high rung. A depth directive now binds to the opus lane at xhigh effort, unless the classifier reads the work as exhaustive coverage.

**2026-09-24: one Rules section.** The routing rules had spread across seven files, three of them stale, and the classifier read about 1,100 words of prose on every prompt. They became 25 rules of 16 words or fewer, then 13 the same day (a seven-line ladder and six guardrails), then 17 after the real-prompt labeling showed three boundaries were undefined (Opus or Sol, Fable or Opus at max, and whether work leaves the session), stored once in `ROUTING_RULES` and pasted verbatim into § Rules. OPERATIONAL_PREFERENCES § Model selection, which loads every turn, shrank to pointers. The blast-radius floor rose from Terra to Sol, because Terra is now only for work with minimal intelligence in it (the principal approved both).
---

**2026-09-28: Sonnet 5.5 joins the high rung.** Anthropic released Sonnet 5.5: $2/$10 per million tokens, over 30% faster than Sonnet 5, within a few points of Opus 5.5 on agentic coding and computer use (Terminal-Bench 4.0 70.6% vs 66.4%, OSWorld 2.1 80.1% vs 81.8%, GDPval-AA 1844 vs 1846), strongest at well-scoped tasks, bug fixes, documents, slides and UI polish, with Opus "clearly stronger" on sustained judgment. Sonnet moved up to the high rung, in place of Haiku as the cheap Anthropic tier, and took much of the execution work off Opus, with the rule kept broad. The split is the one the release describes and early testers used: Opus sets the approach, Sonnet builds it. The learned lane heads have no sonnet class yet, so FrontDoor applies that split to their Opus pick in code until they are relabeled.

**2026-09-28: the `sonnet` alias is pinned.** In the lane's first hours, most Sonnet dispatches ran on the previous Sonnet: the harness resolves `model: sonnet` itself, and sessions started on Claude Code 2.1.282 or 2.1.283 still mapped it there after 2.1.284 moved it to 5.5. `settings.json` env now carries `ANTHROPIC_DEFAULT_SONNET_MODEL`, which fixes the alias on every build. The pin equals `CURRENT.sonnet` in `models.ts`: `ModelSync.ts --sync` moves it on a bump and `--check` fails when it drifts. The agent files keep the alias. `Router.ts audit` prints a `stale subagent models` line naming any Claude subagent id behind `CURRENT` for its tier, so an alias that resolves behind the registry shows up in the next audit.

---

## Cross-references

- Agents: `LIFEOS/DOCUMENTATION/Agents/AgentSystem.md`
- Codex front door: `LIFEOS/DOCUMENTATION/Codex/CodexFrontDoor.md`
- Stray-process reaper: `LIFEOS/TOOLS/SessionTree.ts`
- Route trail: `LIFEOS/FUNCTIONHOOKS/ISA.md` (maintainer-side; does not ship) (ISC-52 to ISC-56)
- Policy: `LIFEOS/USER/CONFIG/OPERATIONAL_PREFERENCES.md` § Model selection
