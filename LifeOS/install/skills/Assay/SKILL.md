---
name: Assay
metadata:
  short-description: "Evaluates prompts, models and agents with code asserts, calibrated judges, pass@k and A/B tests; designs judgment questions and code-extract-decide-write pipelines."
version: 2.9.3
evals:
  suites: [core-dispositions]
  deterministic:
    - command: "bun LIFEOS/ASSAY/QuestionSystem.ts validate LIFEOS/ASSAY/fixtures/question-system.example.json"
      falsifier: "the clean example question system exits nonzero"
description: "Assertion-first eval framework: code asserts, calibrated judges, pass@k, A/B comparison, agentic evals, judgment-layer question systems and code-extract-decide-write pipelines. USE WHEN eval, evaluate, benchmark, judge, judge prompt, judge panel, regression test, assert, llm-rubric, calibrate judge, judged residue, pass@k, pass^k, grade output, compare prompts or models, A/B test, which model did we like, model retro, ablation, with/without, test agent, agentic eval, noul/choice/score question, glance row, judged miss, proof this, check the output, did it come out as asked, design judgment questions, question system, design a pipeline, extract values, Clairic, LLM-only baseline, judgment layer status/report/tune, is this caller ready to enforce. NOT FOR scientific-method framing (Science), property/mutation testing (Hardening), live UI verification (Interceptor), non-eval prompts (Prompting), TypeSafe apps outside LifeOS (typesafe-ai)."
---

# Assay — Assertion-First AI Evaluation

**Contents:** Ideal State · Intent Routing · The taxonomy · Choosing a check: tier first, then shape · Selection, acceptance, and unavailable evidence · The canonical path · Doctrine (from Anthropic; encode, don't restate) · The image lane (visual evals) · Harness integration · Judgment-layer question systems · Data & Config · Gotchas · Examples

An eval gives an AI an input, then applies **assertions** to its output to measure success (Anthropic's definition). A case is `{id, prompt, assert:[...]}`. Each assertion is either deterministic (code, free) or model-graded (a calibrated judge). Cases run multiple trials and report **pass^k** (every trial passes; the reliability metric and the regression gate) and **pass@k** (any trial passes). Proof applies the same tiers to one run's output (the film, image, page, email or document it made) against what was asked, before the principal sees it: `Intents/Proof.md`, with the whole system in `LIFEOS/DOCUMENTATION/Assay/AssaySystem.md`. CreateQuestions designs the fast tier itself: it turns a fuzzy decision into a measured judgment-layer question system (`LIFEOS/DOCUMENTATION/Assay/AssaySystem.md` § Judgment layer).

Sources: [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (2026-01), [A Statistical Approach to Model Evaluations](https://www.anthropic.com/research/statistical-approach-to-model-evals) (2024-11), [develop tests](https://platform.claude.com/docs/en/docs/build-with-claude/develop-tests), the eval-awareness contamination post (2026-03), and the live `claude plugin eval` surface.

**Freshness contract:** "aligned to Anthropic's doctrine" is a live claim. When designing a new suite class or touching `## Doctrine`, re-fetch the demystifying-evals post and flag where it has moved. Report divergence, never auto-adopt; an unreachable URL never blocks a run.

## Ideal State

- Every check sits at the lowest tier that can honestly answer it (code, glance, judge, human), and only code runs on a blocking path.
- Every score ships with pass^k, SEM and a 95% CI from the trials that completed, with the requested and completed trial counts beside it; fewer completed trials than requested never claims pass^k.
- A judged check is calibrated against the principal's labels or reads PROVISIONAL wherever it shows, and a judged suite keeps an adversarial fixture its judge must fail.
- A produced artifact is checked by Proof against what was asked before the principal sees it, and the receipt is bound to its bytes.
- Transport failures, malformed verdicts and missing observations are reported as unavailable evidence, never as a pass, a quality failure or an adversarial catch.
- A fuzzy decision handed to CreateQuestions leaves as a validated question system whose accuracy was measured on held-out cases the designer never saw, with its margin over one holistic baseline question, or as a stated finding that the judgment layer does not fit and what does; a design ends at a saved shadow registry row and never moves a caller toward enforce.
- When an ISA names a `golden_set`, `Tools/GoldenPin.ts check <ISA.md>` reports whether those expected cases still match their content at the parent of the first build commit, read from git history. No runner reads `golden_set` and nothing calls the check automatically; the owning ISA runs it before close.
- When Assay builds the eval system for a project, the project's ISA ends current: every criterion it checks names its suite or glance question in Test Strategy, and the hand-rolled eval code, rows and stale criteria it replaced are removed in the same change.

## Intent Routing

| Intent | Trigger | File |
|----------|---------|------|
| **Proof** | "proof this", "check the output", "did it come out as asked", before showing any produced artifact | `Intents/Proof.md` |
| **RunEval** | "run the eval", "run suite", "evaluate this" | `Intents/RunEval.md` |
| **CreateSuite** | "new eval", "create a suite", "eval for X" | `Intents/CreateSuite.md` |
| **CreateJudge** | "write a judge", "llm-rubric", "grading criteria", "noul, choice or score", "glance question" | `Intents/CreateJudge.md` |
| **Calibrate** | "calibrate the judge", "judge agreement", "judged residue", "shrink the judges", "judged miss", "bunker miss" | `Intents/Calibrate.md` |
| **Compare** | "compare prompts", "compare models", "A/B this", "with/without", "ablation" | `Intents/Compare.md` |
| **ModelRetro** | "which model did we like", "model retro", "compare models looking back", "how did model X do historically" | `Intents/ModelRetro.md` |
| **RunAgentic** | "multi-turn eval", "agentic eval", "eval with tools", "plugin eval" | `Intents/RunAgentic.md` |
| **ViewResults** | "eval results", "how did it score", "saturation" | `Intents/ViewResults.md` |
| **CreateQuestions** | "design judgment questions for X", "turn this fuzzy call into a question system", "what should the engine ask about X", "question system for X", "design a pipeline for X", "extract fields from X", "cheapest way to do X vs an LLM" | `Intents/CreateQuestions.md` |
> The Bunker CLI is maintainer-private and not in the public release; run code rows with `bun test ./<path>` and suite rows with `bun skills/Assay/Tools/EvalRunner.ts`.

| File | Read when |
|------|-----------|
| `References/Progressive.md` | timing, depth, skill coverage, the engine-then-judge escalation, and actual harness context |
| `References/QuestionDesign.md` | designing or reviewing any judgment-layer question system: the design doctrine every CreateQuestions designer and second opinion reads in full, and the home of the engine-behaviour facts (independent questions, negation, choice and score confidence, option names, secret-shaped state) |
| `References/VisionJudgeProviders.md` | grading images: provider selection per suite, private-image consent, capability probes, failure behavior |
| `EvalState.md` | reading this skill's own current suite scores and iteration log (machine-written by `Tools/EvalState.ts`; never hand-edited) |
| `Tools/Proof.help.md` | the `Proof.ts` commands and flags |
| `Tools/IntentRubric.help.md` | turning an intent's Ideal State and Anti-criteria into a suite rubric |
| `Tools/Tournament.help.md` | the `Tournament.ts` flags |
| `Tools/VideoEval.help.md` | evaluating a rendered video (watermark, voice, script, typography, animation): the check ids, bars, memo and `VideoEval.ts` flags |
| `Suites/` | the skill's eval suites; eval data, never edited as prose |
| `Libraries/` | the shared checks every output of a type inherits when compile builds its evals |
| `Tools/Compile.help.md` | the `Compile.ts` flags |
| `Tools/CompileEstate.help.md` | compiling every in-scope ISA (`projects,recent:14d`) before a `Compile.ts merge` pass |
| `Setup.md` | first-time setup: the judge accounts (Claude, OpenAI, Cloudflare), the optional config files, and a proof that needs no key |

## The taxonomy

`eval` is the parent word for every check a criterion carries. Its two branches are the **assert** (a tool says no: `Assertions.ts`, `bun test`, a curl probe) and the **judged** check (a model or Assay's judgment layer says no, bound to content derived from the ideal state). A judged check takes one of three harness shapes: a **glance** row (one typed question to the judgment layer over state that already exists), a **rubric** run from an `eval` suite (`Judge.ts`, one output scored against anchored levels), or a **tournament** on a `pairwise` row (`Tournament.ts`, every pair judged in both orders, then a shuffled-seed rerun). `manual` is not a class; it is the top of the ladder below, and every attestation the principal gives is a label for the rung beneath it. What makes a judge good is its content, derived from the ISA's articulated ideal state. The same words appear in ISAFormat § *Verifier classes, lanes, and stages*, TestingDoctrine, the Bunker doc, the Algorithm, and the ISA skill; change them everywhere or nowhere.

**The four-tier ladder.** Every check sits on one of four tiers, ordered by speed and by how much intelligence the verifier needs: `code`, `glance`, `judge`, `human`. Code is a tool that exits zero. The `glance` tier is one typed question to Assay's judgment layer, answered with a probability, far faster than a model judge (the sub-second figure was measured on the engine retired 2026-10-10 and not re-measured; `skills/Assay/References/QuestionDesign.md`). Judge is a model reading an output against anchored levels or a flipped bracket, in seconds to minutes. Human is the principal recognizing the thing on encounter. The tier is derived from the row's `type` and is never authored: the deterministic types give `code`, a `glance` row gives `glance`, `eval` and `pairwise` give `judge`, and `manual` gives `human`. A check sits at the lowest tier that can honestly answer it, and it drifts down the ladder as it earns labels: a human row becomes a `glance` row once the criterion carries labels, and a `glance` row becomes a code row once the question is sharp enough to be a tool. Two guards hold this in place. Only code runs on the blocking path, so no `glance`, `eval`, or `pairwise` row runs on the liveness lane or inside a deploy or close gate, and a judged row never gates a deterministic row of the same criterion. A gate runs no judge, but it reads recorded results: an earned judged row's latest fail keeps the criterion open at close. Every Feature also keeps at least one spanning criterion over the whole artifact at the consumer boundary, and the maintainer-side `bunker test --tiers` flags a Feature whose leaves are all `glance` rows as `unspanned`. The `glance` row contract is fixed: type `glance`, a tool cell of the form `glance:<question-file>#<question-id>`, and a JSON question file beside the ISA under `Questions/`. That file carries one typed question and a bounded producer command that emits the structured state to judge. The registry threshold means confidence for every question type, so a noul resolves two-sided and carries a verdict plus the confidence behind it. A row under a shadow caller reports `shadow`, its own status, which counts as neither a pass nor a fail and cannot close a criterion. Every verdict records the sha256 of the artifact it judged, and the call is skipped when the artifact hash, the question, the threshold, and the engine model are all unchanged since the last verdict. Labels that came from a model or from the deterministic layer put the calibration record in the `proxy` state, which never reads earned.

## Choosing a check: tier first, then shape

Tier first. If code can answer, write the assert and stop. If reading is needed and the state already exists (a file, a rendered page, a diff, a log tail, a query result), write a `glance` row that asks one typed question about it. If the output is generated fresh on every trial (a prompt's answer, an agent's run), write an `eval` suite, because pass^k needs trials and the judgment layer cannot generate. A `manual` row holds taste until labels exist.

Shape second, for anything that has to be read. Every engine answer is a probability, so the probability is not what separates the shapes. The question type is, and each one becomes a different piece of code:

| Question | Shape | What the code does with it | Where it lives here |
|---|---|---|---|
| Is this true? | `noul` | an `if` | `llm-assert` in a suite; `kind: noul` in a question file |
| Which of these? (an unordered set) | `choice` | a `switch` | `kind: choice` in a question file; A/B/tie inside a tournament |
| How much? (an ordered ladder) | `score` | a sort, or a threshold | anchored `llm-rubric` in a suite; `kind: score` in a question file |

Critical, high, medium, low is a ladder and can be sorted. Korean, Mexican, Thai cannot, so a question over them is a choice. Ask many small questions rather than one big rubric. A rubric whose levels mix dimensions is several questions crushed into one call, the same failure as a system message packed with instructions in the hope that every one lands. Fall back to a multi-level anchored rubric or a tournament only when the property will not split.

An unearned judgment only flags; an earned confident no fails like a code check. In `Judge.ts` an `llm-assert` goes to the judgment layer as a noul and an anchored `llm-rubric` as a score before any model judge is paid for. A confident answer from a caller in enforce mode resolves the assert, the middle band escalates to the model judge as UNKNOWN, and an unanchored rubric never reaches the engine (it escalates and counts as residue with reason `unanchored`). The full escalation rule is in `References/Progressive.md`.

On the maintainer install a judged miss is one command (the Bunker CLI is maintainer-private and not in the public release; a public install calibrates through a suite with a judged assert and `Tools/Calibrate.ts`). `bunker miss` adds the missing question to the criterion's question file, registers it in shadow, and keeps the state as a labelled case, so the fix is one more question and a kept case rather than a longer prompt. `bunker label` adds a labelled case to a question that exists; `bunker attest` labels a `manual` row. Commands and flags: `Intents/Calibrate.md` § Tool contract, The miss loop.

## Selection, acceptance, and unavailable evidence

A tournament answers which candidate is preferred under a written definition. It never proves the winner meets an absolute bar. A quality criterion carries its own asserts and rubric, or a named principal attestation when calibration is unavailable. Both definitions derive from the owning ISA; neither the word "best" nor a number supplies the standard.

`Tournament.ts` needs at least two distinct candidates and a completed shuffled rerun to verify; `--no-rerun` is diagnostic only. Identical content under different paths is not candidate diversity.

Semantic UNKNOWN stays a miss even under negation. Unavailable evidence and trial counts follow the Ideal State above.

## The canonical path

| Tool | Role |
|------|------|
| `Tools/Assertions.ts` | Deterministic assert engine: 12 types + `not-` negation. Sync, free, no model call. |
| `Tools/Judge.ts` | Model-graded asserts `llm-rubric` (anchored 1–5 → 0–1) and `llm-assert` (TRUE/FALSE/UNKNOWN), plus `judgeTextPairwise`. Asks the judgment layer first (noul for `llm-assert`, score for an anchored `llm-rubric`). System prompts live in `LIFEOS/TOOLS/lib/JudgePrompts.ts`, shared with the vision judge and hashed into every calibration record. UNKNOWN is a miss; an unparseable cheap verdict gets one retry at 'high'. |
| `Tools/Tournament.ts` | The tournament: a bracket in code over an injected pairwise judge (images → VisionJudge pairwise, which runs on Gemini alone (see Gotchas); text → Judge.ts). A flipped winner is position bias and reads as a tie; a different winner on the shuffled rerun reads unstable. The result names generator and judge ids and flags a same-family pair. Exit 0 stable · 1 unstable/all tied · 2 verifier unavailable. `pairwise` rows dispatch here when the maintainer-side `bunker test` row engine or Development Test executes them. |
| `Tools/JudgeLevel.ts` | judge_model alias/id → inference level, capped at 'high' (grading never rides the top rung). |
| `Tools/EvalRunner.ts` | Suite runner: trials, pass^k/pass@k + SEM/CI, calibrated-cheap judge default, regression gates on pass^k, judged-residue metric, transcripts persisted per run. Shared suite validation precedes inference. Exit 0 passed · 1 regressed · 2 verifier unavailable (no run verdict; run.json kept as history; latest.json and EvalState untouched, so the last valid result stays visible). |
| `Tools/Stats.ts` | SEM, 95% CI, paired differences, clustered SEs, power analysis (pure functions). |
| `Tools/Compare.ts` | Paired A/B on one suite: prompts, levels, with/without ablation. Verdict from the paired CI. |
| `LIFEOS/ASSAY/Panel.ts` | The judge panel for comparing producers (models, prompts, lanes) on the same inputs. It handles blinding, word-budget cuts, cross-vendor judges with vendor exclusion, verdict repair and retries, pairwise preferences from rankings, and the length check. The rubric comes from the caller's ISA. `AssaySystem.md` § Judge panel. |
| `Tools/Calibrate.ts` | Judge calibration vs principal labels. EARNED has one definition, `LabelStore.earnedStatus` (`LIFEOS/TOOLS/lib/LabelStore.ts`): the principal's right/wrong labels at agreement ≥ 85% (the registry's bar) with at least the registry's label floor (default 10), and, where labels carry the true class, at least 2 labels per class at ≥ 50% agreement; Cohen's kappa is a reported diagnostic, never part of earned. A record goes STALE when any model in the judge chain, the rubric text, or the label file changes (the one rule: `LIFEOS/TOOLS/lib/Calibration.ts`). Labels from a model or the deterministic layer make the record `proxy`, which never reads earned. `--append-log` appends the Articulation Log block to the owning ISA; `--recheck` re-runs stale records (ModelSync daily, pages only on a drop); `--residue` reports judged residue, judged asserts with no `derived_from`, and judge-ready attested seeds. |
| `Tools/PairwiseCalibrate.ts` | Calibrates one tournament criterion against flipped A/B/tie labels; `Tournament.ts --calibration <set.yaml>` reads its record. |
| `Tools/SuiteManager.ts` | Suite inventory (`list`, `show <suite> [--json]`), `validate [suite]` (a judged suite must keep an adversarial fixture), saturation detection, capability→regression graduation. |
| `Tools/FailureToCase.ts` | One real failure → one draft case skeleton. |
| `Tools/IntentRubric.ts` | A skill intent's `## Ideal State` and `## Anti-criteria` → a suite rubric: one `llm-assert` per Ideal State bullet, one `not-llm-assert` must-not per Anti-criteria bullet, each with `derived_from: <intent>#IS-n|#AC-n`. `suite` builds and validates a whole suite from real prompts. Deterministic. See `Tools/IntentRubric.help.md`. |
| `Tools/Compile.ts` | Compiles an ISA's criteria into staged evals (code, then the judgment layer, then a judge or tournament) written to the ISA's `## Evals` section; `bun Compile.ts <ISA.md> [--dry-run] [--write]`; `bun Compile.ts merge <ISA.md>` folds the proposal in (main session only). See `Tools/Compile.help.md`. |
| `Tools/NarrationMatch.ts` | A narrated video judged shot by shot against the words spoken over it: code tier (blank frames, cross-beat repeats by dHash and asset, sentence coverage, silent shots), then every shot's rest frame plus its words to the VisionJudge panel (provisional). Exit 0 pass · 1 fail · 2 unavailable · 64 usage. See `Tools/NarrationMatch.help.md`. |
| `Tools/VideoEval.ts` | The video eval set: 27 checks over a DA-narrated or HyperFrames video (format, watermark, voice, script, typography, animation quantity and quality, PII), code tier first and judges only on a clean code tier, each memoized by the bytes it reads, one assay receipt bound to the video's sha256. `run --run <slug> | --video <file> [--check id,id] [--judges auto\|always\|never]`. See `Tools/VideoEval.help.md`. |
| `Tools/CompileEstate.ts` | Runs Compile --write on every in-scope ISA (`--scope projects,recent:14d`, shared with `EvalCensus.ts --without-eval`), skipping dirty, pending-merge and current ones; never merges. See `Tools/CompileEstate.help.md`. |

```bash
bun run ${LIFEOS_SKILL_DIR}/Tools/EvalRunner.ts -s <suite> [-t trials] [--json]
bun run ${LIFEOS_SKILL_DIR}/Tools/Assertions.ts   # 16-case self-test
bun run ${LIFEOS_SKILL_DIR}/Tools/Stats.ts        # 6-case self-test
bun run ${LIFEOS_SKILL_DIR}/Tools/Judge.ts        # good-vs-bad discrimination (live inference)
```

## Doctrine (from Anthropic; encode, don't restate)

- Deterministic first; judges are debt. "Prefer deterministic graders where possible, use LLM graders where necessary." Every judged assert carries a retirement plan: calibration against principal labels, disagreements mined into deterministic asserts, and a per-suite judged residue reported every run and expected to fall. (Shrinkage doctrine: principal directive 2026-08-25.)
- Grade outcomes, not paths. Agents find valid approaches designers did not anticipate. Transcript analysis is for quality signals only, never pass/fail.
- Capability suites start low and graduate; regression suites target ~100% and gate on pass^k. SuiteManager tracks saturation.
- Statistics or it didn't happen. Every score ships with SEM and a 95% CI, never a bare mean; comparisons are paired-difference only; null results check power first; clustered cases use clustered SEs.
- Judge discipline: the judge is never the generator, one dimension per judge, anchored scales, reason before score, UNKNOWN is a miss, and a suite earns the cheap judge only on an EARNED record (thresholds in the Calibrate.ts row above; authoring rules in CreateJudge). Raw agreement alone rewards a constant judge on a skewed set, which is why each class needs its own labels at better-than-coin agreement.
- A judged suite with no earned record is PROVISIONAL and says so everywhere. EvalRunner's report carries `provisional`, its age in days, and the reason; the maintainer-side `bunker test` prints `PROVISIONAL (Nd: reason)`; Pulse shows an amber pill, red past 30 days; a Socrates standing question asks daily whether any judged suite runs uncalibrated. Nothing blocks, but the count stays in sight.
- Eval integrity is adversarial (contamination post, 2026-03). Never publish suite cases as examples; identity-bound suites stay in the USER layer; assume anything published is trained on.
- Never trust a score until you read the transcripts. Every run persists them to `MEMORY/STATE/Evals-Results/<suite>/<run>/run.json`.

## The image lane (visual evals)

Suite-scoped rubric provider selection, private-image consent, capability probes and failure behavior follow [Vision judge providers](References/VisionJudgeProviders.md). The default rubric judge is the OpenAI + Anthropic panel (see Gotchas); any other provider requires its own current calibration. Image cases share the text runner's prerequisite contract (see Gotchas), and a skipped judgment can never count as catching an adversarial fixture.

Images are graded, never generated, by `Tools/ImageEvalRunner.ts -s <suite>` over the same suite roots and result shape as text. Deterministic layer (`Tools/ImageAsserts.ts`, magick + tesseract, local, no egress): dimensions, aspect, format, max-bytes, luminance bands (dark-ground rule), `ocr-contains`, and `ocr-word-ratio`, the mechanical garbled-text catch. Judged layer (`Tools/VisionJudge.ts`, the OpenAI + Anthropic panel by default; Gemini only when a suite's config entry names Google, on `--public`, or for pairwise): anchored `vision-rubric` asserts (trials apply to judged asserts only; deterministic image checks run once), a `pairwise` CLI for which-of-two verdicts (Gemini only; see Gotchas), and the meaning ladder (`meaning-ladder` asserts; `VisionJudge.ts describe` then `ladder`). The ladder's blind describer sees the image and nothing else (no article, thesis, or title); a text judge then grades the description against the case's `reference:` argument summary on four anchored rungs (unrelated · topic only · argument · specific claim) and never sees the image. Worked example: Art Essay Step 8 (assert gate → blind describer → meaning ladder → flipped `Tournament.ts`), suite `art-meaning-recovery`. A result records generator, describer, and judge ids and flags a same-family pair.

Identity guard: images carrying the principal's likeness are not sent to the vision judge pending explicit clearance. VisionJudge refuses `/headshot/i` paths without `--allow-identity`, suites default `allow_identity: false`, and deterministic asserts remain available for everything. Taste guard: pure-taste dimensions ride pairwise plus principal ratification, never absolute auto-grades.

## Harness integration

- Config-change regression: run `bun LIFEOS/TOOLS/ConfigEvalOnChange.ts` by hand to execute the configured dispositions suite after a behaviour-defining file changes (default `core-dispositions`; override via `LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Assay/config.json` `config_change_suite`).
- ISA and Algorithm: every ISC carries an executable check as a Test Strategy row that Assay resolves at the cheapest honest tier (code assert, then the judgment layer, then a model judge, then the principal); the maintainer-side `bunker test` row engine executes those rows (a public install runs code rows with `bun test ./<path>` and suite rows with `Tools/EvalRunner.ts`), and Development Test and the post-deploy probes call it. A row typed `eval` with a `suite:` dispatches to EvalRunner and its pass^k verdict is the criterion's evidence; `pairwise` dispatches to `Tournament.ts` and its stable winner is the evidence; `glance` stays in the Bunker runner and never enters this skill's runner. A per-ISC `eval` row is required for behavioral, quality, and regression criteria; a separate second-look suite stays elective. Judged rows default to stage 2, so the criterion's asserts run first and a failing one gates the judge; a gated row is never dispatched and never a pass (ISAFormat v2.27.0).
- USER layer: identity-bound suites live in `LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Assay/Suites/`, calibration sets in `.../Calibration/`, never in the public tree.

## Judgment-layer question systems

The runtime is `LIFEOS/ASSAY/`. Status, reports and tuning need no intent; they are direct commands on `Assay.ts`. A readiness question ("is this caller ready to enforce?") is answered from `tune` and `report`, with balanced accuracy, label counts and each blocker by name.

| Command | Answers |
|---|---|
| `bun LIFEOS/ASSAY/Assay.ts status` | every caller's mode, rows and error rate, and whether agreement is computable; exits 1 when an enforced question is under its label floor or rests on proxy ground truth |
| `bun LIFEOS/ASSAY/Assay.ts report --caller <name> [--days N]` | agreement, balanced accuracy and separation per question against the caller's ground truth |
| `bun LIFEOS/ASSAY/Assay.ts tune --caller <name> [--days N] [--step S] [--json]` | threshold sweep, recommended thresholds, and what blocks enforce |
| `bun LIFEOS/ASSAY/Assay.ts alerts` | any caller whose error rate is over its floor (exit 1) |
| `bun LIFEOS/ASSAY/Assay.ts drift` | enforce rows reverted because the engine's model changed |
| `bun LIFEOS/ASSAY/Assay.ts callers [--check-docs]` | the registry, and with `--check-docs` any caller missing its Router data-class row |
| `bun LIFEOS/ASSAY/Assay.ts ask --state <text> --questions <json> [--caller name]` | one ad-hoc call |
| `bun LIFEOS/ASSAY/Assay.ts ask-many --states <jsonl> --questions <json> [--caller name] [--concurrency N]` | the same questions over many states, as a pool |

The question-system tool is `bun LIFEOS/ASSAY/QuestionSystem.ts validate | cases | run | registry-row`; its contract and flags are in `Intents/CreateQuestions.md` § Tools.

## Data & Config

Before executing, check `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Assay/` (configRoot is `$CLAUDE_CONFIG_DIR` when set, else `~/.claude`) and apply any PREFERENCES.md and `config.json` found there; identity-bound suites and calibration sets live there too (Harness integration). If the directory does not exist, use the skill defaults. First-time setup (accounts, keys, config, a proof it works) is in [Setup.md](Setup.md).

## Gotchas

- Frequent liveness probes run with `LIFEOS_INFERENCE_DISABLED`; both the shared text inference path and the vision judge refuse calls under that flag before loading credentials or contacting a provider.
- A lane-liveness suite needs its own `system_prompt`. Under the live DA prompt the assistant treats "reply with exactly one word" as a constitutional format conflict and refuses (Bunker `bunker-eval-lane`, 2026-09-03), a real answer to the wrong question. Suites that test plumbing rather than behavior set a minimal echo `system_prompt`.
- The single-shot agent under test narrates tool calls. EvalRunner injects an `[EVALUATION CONTEXT] no tools, answer directly` suffix; keep it when authoring output-graded cases. Tool-dependent properties belong in RunAgentic.
- The judge default is dynamic. No judge keys in the suite → the level measured by its current EARNED calibration record, else 'high'. Explicit `judge_model`/`judge_level` always wins. A model bump, rubric edit or label edit makes the old record provisional until Calibrate re-runs; earning at medium or high never certifies low.
- Regression pass/fail changed at v2.0.0: the gate is pass^k ≥ threshold (was mean ≥ threshold). Historical `passed` values are not comparable across the boundary.
- A judged suite keeps an adversarial fixture, and the runner grades it every run. Text: `adversarial_output:` on a case, a canned output that passes every deterministic assert on that case; the judge must fail it or the suite fails (`adversarial.missed` in the result). Image: a case with `expect: fail`, an unrelated image that passes the deterministic asserts and must land below the judged threshold. `SuiteManager.ts validate` rejects a judged suite with neither, and rejects a fixture that fails its own deterministic asserts. Without one, a green suite proves nothing about the judge.
- An `llm-rubric` reaches the judgment layer only when every level from 1 to `scale` has an anchor; a partial set such as 1/3/5 reads `unanchored` and goes straight to the model judge (`rubricToScoreQuestion`). Which rubrics reached the judgment layer is each run's `jev.escalate_reason`, a stored field named for the engine retired 2026-10-10 (RunEval § Output format).
- Order matters to a pairwise judge. `judgeTextPairwise` and `VisionJudge pairwise` judge one ordering; only `Tournament.ts` flips. A single unflipped pairwise call is a position-bias measurement, not a preference.
- Deterministic asserts are prerequisites, for text and image alike. They default to `required: true`, run before any judge whatever the YAML order, and a failure skips the judges and zeroes the trial. Suites that relied on deterministic partial credit must opt in with `required: false`, and their scores before and after that change are two series. `is-json` checks the whole output; `contains-json` checks an embedded fragment.
- A judge, rubric, or anchor edit breaks score comparability. Recalibrate and treat the trend as two series.
- `claude plugin eval` is a newer Claude Code command whose flags and schema can change between releases. Wrap it, never bind our suite format to its schema, and re-probe `--help` before relying on flags.
- Legacy v1 suites (`tasks:` format) are diagnosed, not run. EvalRunner returns a named error result so callers (ConfigEvalOnChange) degrade loudly, never silently.
- Image suites with no entry in `USER/CONFIG/vision-judge.json` are judged by the OpenAI + Anthropic panel: both vendors judge each trial, it passes only when both pass, the score is the lower, and a missing vendor gives no verdict. Google is never the default seat; a suite reaches Google only when its config entry names it. The install's provider rulings and their history are in `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Assay/PREFERENCES.md`.
- A perfect dev number after question iteration is a warning, not a result. A CreateQuestions pilot reached a perfect dev score while its holdout landed below both the bar and the baseline question. Only the holdout number and the judged-only margin decide anything, and holdout runs once.
- `decide()` is two-sided: it returns `act: true` for a confident no as well as a confident yes, so a consumer always reads `verdict` before acting. `Chain.ts` `keepWhere` and `judgeThenEscalate` treat only a confident yes as actionable and send a confident no to drop or escalate; a system whose confident no is an answer composes through the policy evaluator (`LIFEOS/ASSAY/Assay.ts`, `LIFEOS/ASSAY/Chain.ts`, read 2026-09-28).
- A new judgment caller needs a row in `LIFEOS/DOCUMENTATION/Router/RouterSystem.md` § Data class per caller, or `Assay.ts callers --check-docs` names it as a missing doc row and exits 1 (`LIFEOS/ASSAY/Assay.ts`, 2026-09-28).
- `bun test` with a bare relative path silently drops every child process's stdout and stderr in Bun 1.3.6, so spawn-based tests fail with empty output. Always prefix the path with `./` (observed 2026-09-11).
- Image tournaments and `VisionJudge.ts pairwise` judge on Gemini alone (`judgeImagePairwise` in `Tools/VisionJudge.ts`), private material included. Whether private material may go to Google is decided by the shared egress check (`LIFEOS/TOOLS/lib/EvaluatorEgress.ts`, its approved-vendor set); when that set excludes Google, every private image tournament exits 2 verifier unavailable. The install's provider rulings and their dates are in `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Assay/PREFERENCES.md` § Judge providers. A pairwise run needs `GOOGLE_API_KEY`; without it the tournament exits 2 (read in code 2026-10-13).

## Examples

**Example 1: Check a produced artifact before handing it over**
```
User: "proof this film against the brief"
→ Proof intent
→ Proof.ts run --artifact film.mp4 --ask brief.md --destination handoff
→ a receipt bound to the film's sha256, with each code fail, flag and unavailable check listed
```

**Example 2: Ask whether a judge can be trusted**
```
User: "is the art-meaning judge any good?"
→ Calibrate intent
→ Calibrate.ts against the principal's labels for that suite
→ an earned, proxy or stale record with agreement per class and the label count against the floor
```

**Example 3: Turn a fuzzy call into judgment-layer questions**
```
User: "turn this inbox triage call into a question system"
→ CreateQuestions intent
→ QuestionSystem.ts validate, then run on dev and once on holdout against one holistic baseline question
→ holdout accuracy, the margin over the baseline, and a saved shadow registry row
```
