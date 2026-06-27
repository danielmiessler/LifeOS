## Optimize Loop Protocol v2

Referenced from the Algorithm when `mode: optimize`. This file defines the complete optimization lifecycle: target analysis, the autonomous optimization loop, recommendation, and learning extraction.

### Two Evaluation Modes

| | Metric Mode | Eval Mode |
|---|---|---|
| **Target** | Code files | Prompts, skills, agents, any text |
| **Measurement** | Run shell command, extract number | Run target N times, judge outputs, pass rate % |
| **Scoring** | Single numeric value (lower/higher is better) | `passes / (eval_criteria x runs)` as percentage |
| **ISC role** | Guard rails (invariant assertions) | Guard rails (same) |
| **Eval criteria** | N/A — metric_command is the signal | 3-6 binary yes/no questions judged by LLM |
| **Sandbox** | Git branch `optimize/{metric_name}` | Directory copy in `MEMORY/WORK/{slug}/sandbox/` |

**Mode detection:** If `metric_command` is provided → metric mode. If `eval_mode: eval` is set → eval mode. If neither → infer from target type (code/function → metric, everything else → eval).

### Parameter Integration

Optimize mode accepts tunable parameters that control mutation boldness, regression tolerance, and patience. Full schema: `${PAI_DIR}/ALGORITHM/parameter-schema.md`.

**Optimize parameters:**

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| `stepSize` | 0.0–1.0 | 0.3 | How large a change per experiment. Low = tiny tweaks, high = structural changes. |
| `regressionTolerance` | 0.0–1.0 | 0.1 | Willingness to accept temporary score regression. 0 = never, 1 = freely explore. |
| `earlyStopPatience` | 1–20 | 3 | Consecutive no-improvement experiments before terminating. |
| `maxIterations` | 1–100 | 10 | Maximum total experiments. |

**Named presets:**

| Preset | stepSize | regressionTolerance | earlyStopPatience | maxIterations | Use For |
|--------|----------|--------------------|--------------------|---------------|---------|
| `cautious` | 0.15 | 0.0 | 5 | 20 | Production systems, stability critical |
| `standard-optimize` | 0.3 | 0.1 | 3 | 10 | Default, moderate approach |
| `aggressive` | 0.7 | 0.5 | 2 | 15 | Prototypes, experiments, local optima escape |

**Parameter → loop behavior mapping:**

- `stepSize` → HYPOTHESIZE: Controls mutation taxonomy preference. Low stepSize favors `elimination`/`simplify`/`parameter_tune`. High stepSize favors `algorithmic`/`restructure`/`rewrite`.
- `regressionTolerance` → DECIDE: At 0.0, any regression triggers revert. At 0.1-0.3, minor regressions (<5%) accepted with structural rationale. At 0.4+, simulated annealing behavior — accepts regression to escape local optima.
- `earlyStopPatience` → Termination + Plateau Protocol: Adjusts the stagnation thresholds. Plateau Level 1 at `earlyStopPatience` experiments, Level 2 at `2×earlyStopPatience`, Level 3 at `3×earlyStopPatience`.
- `maxIterations` → Hard stop. Loop exits when experiment count reaches this value.

**ISA frontmatter:**
```yaml
algorithm_config:
  preset: cautious
  params:
    stepSize: 0.15
    regressionTolerance: 0.0
    earlyStopPatience: 5
    maxIterations: 20
```

---

### Phase 0: TARGET ANALYSIS

Runs during the Algorithm's BUILD phase, before the loop begins.

```
TARGET ANALYSIS:
  1. Read target path(s) — single file or directory
  2. Detect target type using rules from target-types.md:
     - skill: has SKILL.md
     - prompt: standalone .md/.txt with prompt content
     - agent: agent definition .md with frontmatter
     - code: source files with metric_command provided
     - function: specific function within source files
  3. Determine evaluation mode:
     - metric_command provided → metric mode
     - eval_mode: eval set → eval mode
     - Otherwise: code/function → metric, skill/prompt/agent → eval
  4. Read target comprehensively per target-types.md "What to read" section
  5. If eval mode:
     a. Extract purpose, inputs, outputs, constraints, edge cases
     b. Auto-generate eval criteria (see below)
     c. Auto-generate diverse test inputs (3-5 representative inputs)
     d. Present criteria + inputs to user for approval via AskUserQuestion
     e. Write approved criteria to ISA frontmatter (eval_criteria field)
     f. Write approved inputs to ISA frontmatter (test_inputs field)
  6. Set up sandbox:
     - Metric mode: git checkout -b optimize/{metric_name}
     - Eval mode: cp -r target sandbox/ (in MEMORY/WORK/{slug}/sandbox/)
  7. Establish baseline measurement:
     - Metric mode: run metric_command, record value
     - Eval mode: run target with each test input, judge outputs, record pass rate
  8. Create results.tsv with header and baseline row
  9. Write baseline to ISA frontmatter
```

**Auto-ISC Generation (eval mode only):**

1. Read target comprehensively per target-types.md
2. Draft 3-6 binary eval criteria using the per-type ISC generation template from target-types.md as a starting point, customized to the specific target's content
3. Draft 1-2 anti-criteria based on common failure modes
4. Apply the 3-question test (from eval-guide.md) to each criterion:
   - Would two judges agree on this judgment?
   - Could the target game this without genuinely improving?
   - Does the user actually care about this?
5. Drop any criterion that fails a question
6. Present to user for approval/modification before starting loop

---

### Prerequisites (completed before the loop starts)

The Algorithm's OBSERVE → THINK → PLAN → BUILD phases plus Phase 0 have already:
1. Defined the optimization target (metric or eval criteria, measurement method, mutable files/target)
2. Generated an initial hypothesis queue
3. Set up sandbox (git branch for metric mode, directory copy for eval mode)
4. Established baseline measurement
5. Created results.tsv with header and baseline row
6. Defined guard rail ISC criteria (assertions that must hold across all experiments)
7. If eval mode: approved eval criteria and test inputs

---

### The Loop

Execute this loop until interrupted or a termination condition is met.

```
LOOP:
  1. ASSESS
     - Read results.tsv: what's been tried, what worked
     - Read mutable files/sandbox: current implementation state
     - Check experiment count against max_experiments (if set)
     - Check current score against target:
       - Metric mode: current metric vs metric_target
       - Eval mode: current pass rate vs target pass rate (default: 95%)
     - If either limit reached → exit loop → proceed to Phase 9

  2. HYPOTHESIZE
     - Form an experimental idea based on:
       a. What hasn't been tried yet
       b. Patterns from successful experiments
       c. Domain knowledge about the target
     - State: "Hypothesis: [description]. Expected: [score] should [improve] because [reasoning]."
     - Classify type using the mutation taxonomy:

       FOR METRIC MODE (code targets):
       elimination | substitution | restructure | parameter_tune | algorithmic

       FOR EVAL MODE (text targets):
       add_instruction | reword_ambiguity | add_anti_pattern | reorder_priority |
       add_example | remove_over_optimization | simplify | constrain_scope

     - Prefer elimination/simplify experiments early, addition experiments late
     - See eval-guide.md "Mutation Taxonomy" for good vs bad mutation guidance

  3. IMPLEMENT
     - Metric mode:
       - Modify ONLY files listed in mutable_files
       - git add [changed files] && git commit -m "experiment {N}: {description}"
     - Eval mode:
       - Modify ONLY files in sandbox/
       - No git commit needed (sandbox is a directory copy)

  4. MEASURE
     - METRIC MODE:
       - Run: {metric_command}
       - Extract metric value from output (see Metric Extraction below)
       - If command fails → status = "crash"
       - If timeout exceeded → status = "timeout"

     - EVAL MODE:
       - For each test input (3-5 inputs):
         - Run target with test input (per target-types.md "How to run" section)
         - Capture output
       - For each output x each eval criterion:
         - Judge: "Given this output, does it satisfy: [criterion]? Answer YES or NO."
         - Record binary result
       - Calculate pass rate: total_passes / (criteria_count x runs_count)
       - If any run crashes → status = "crash"

     - BOTH MODES:
       - Run guard rail checks (ISC assertions)
       - If any guard rail violated → status = "guard_rail_violation"

  5. EVALUATE
     - Compare new score to current best:
       - Metric mode: compare metric values (respect metric_direction)
       - Eval mode: compare pass rates (higher is better)
     - Calculate delta and delta percentage
     - Determine: improved, equal, or worse

  6. DECIDE
     - IMPROVED (score better AND guard rails pass):
       → Compute MAD confidence (see Confidence Gating section) if ≥3 scores in session
       → Update baseline in ISA frontmatter
       → Keep changes (commit for metric mode, preserve sandbox state for eval mode)
       → Log: "KEPT: {old} → {new} ({delta}%, confidence: {mad_score}×)"
       → If confidence is red (<1.0×), tag the row `marginal` in results.tsv and add a line to `## Dead Ends` if the improvement does not survive a re-run

     - SIMPLIFIED (score equal AND target simpler):
       → Keep changes
       → Log: "SIMPLIFIED: score maintained, target reduced"

     - WORSE or VIOLATION or CRASH:
       → Metric mode: git reset --hard HEAD~1
       → Eval mode: restore sandbox from last known good state
       → Append reverted approach to `## Dead Ends` ledger with 1-line reasoning
       → Log: "REVERTED: {reason}"

  7. LOG
     - Append row to results.tsv:
       experiment | commit/snapshot | score | delta | delta_pct | status | type | description | timestamp
     - Update ISA: increment experiment_count, update progress field
     - Update ISA ## Experiments table (keep last 10 rows + summary)

  8. ADAPT
     - 3+ consecutive reverts of same type → switch experiment category
     - Score plateaued → enter Plateau Protocol
     - EVAL MODE ISC ROTATION:
       - If pass rate > 90% but output quality feels stale → refine/tighten eval criteria
       - If one criterion passes 100% for 5+ experiments → it's saturated:
         - Consider graduating it (moving to guard rails since it always passes)
         - Replace with a harder criterion
       - Log criteria changes in ## Decisions section of ISA
     - Otherwise → GOTO 1
```

---

### Metric Extraction (metric mode only)

Parse the metric value from measurement command output:

1. **If metric_extract is specified** — run it against stdout. Must produce one number.
2. **If output is JSON** — look for metric_name as a key, extract its value.
3. **Fallback** — extract the last numeric value from stdout.
4. **Failure** — log "parse_error", revert experiment, continue loop.

---

### Confidence Gating (MAD)

After MEASURE, compute a noise-floor-aware **magnitude-confidence** score for the observed delta. Advisory only — never auto-discards. **MAD does NOT override direction**: the DECIDE step independently judges improvement/regression. MAD answers "is the magnitude above session noise?" — not "was the change good?"

**Formula (guarded):**
- `MAD = median(|score_i - median(all_scores)|)` across every experiment in the current session (baseline + all attempts, kept and reverted alike)
- `confidence = |delta| / max(MAD, ε)` where `ε = 1e-9` prevents division by zero on degenerate sessions

**Gate activation:** only compute `confidence` once the session has **≥ 3 experiments** (baseline + 2 attempts). Before that, MAD is statistically unstable; log `confidence = -` and defer entirely to direction + structural rationale.

**Interpretation:**

| Confidence | Signal | Action |
|------------|--------|--------|
| `≥ 2.0×` | green — magnitude above session noise | DECIDE as normal |
| `1.0 – 2.0×` | yellow — above noise, marginal | keep if structural rationale holds; tag row `marginal` |
| `< 1.0×` | red — within noise floor | recommend re-run or revert unless the change has independent structural justification |

**Edge cases:**
- Fewer than 3 experiments: `confidence = -`, skip gating entirely (see Gate activation above).
- MAD = 0 (all scores identical within measurement precision): the `ε` floor yields very high confidence for any non-zero delta. Log `confidence = ∞` and treat any change as signal; direction still governs keep/revert.
- Regression with high magnitude: `confidence` reads high because it's magnitude-only. This is correct — high-confidence regressions should revert emphatically, not pass. Never read `confidence ≥ 2.0×` as "keep."

Write `confidence` as its own column in `results.tsv` alongside `delta` and `delta_pct` so resume reads see the noise-floor history.

Pattern from pi-autoresearch (davebcn87, MIT), itself inspired by Karpathy's original `autoresearch`.

---

### Eval Judging (eval mode only)

For each output, judge against each eval criterion:

1. Construct judging prompt:
   ```
   Given the following output, answer YES or NO to the question.
   Do not explain. Answer only YES or NO.

   OUTPUT:
   {output_text}

   QUESTION: {eval_criterion}

   ANSWER:
   ```
2. Send to LLM via PAI Inference Tool (`bun TOOLS/Inference.ts fast`)
3. Parse response: starts with "YES" → pass, starts with "NO" → fail
4. Any other response → retry once, then count as fail

For anti-criteria, invert: "YES" means the anti-pattern is present → fail.

---

### Crash Handling

```
ON CRASH:
  1. Capture last 50 lines of output
  2. Revert:
     - Metric mode: git reset --hard HEAD~1
     - Eval mode: restore sandbox from last known good
  3. If trivial fix (typo, missing import) → fix and retry as same experiment
  4. If fundamental → log as crash, move to next hypothesis
  5. If 3+ crashes in a row → pause, present status, ask user
```

---

### Plateau Protocol

When improvement stalls (< 0.5% improvement over last 5 experiments):

**Level 1** (after 5 stagnant experiments):
- Re-read all successful experiments, look for untried combinations
- Try combining 2 successful approaches that were tested independently
- Eval mode: analyze which criteria are hardest to satisfy, focus there

**Level 2** (after 10 stagnant experiments):
- Metric mode: profile the measurement to find the actual bottleneck
- Eval mode: check if criteria are too easy/saturated, consider tightening
- Try approaches from a different paradigm entirely

**Level 3** (after 15 stagnant experiments):
- Pause and report: "Score plateaued at {value} after {N} experiments. Top improvements were: {list}. Options: (1) Continue with aggressive experiments, (2) Accept current result, (3) Expand scope, (4) Rotate eval criteria."

---

### Termination

The loop exits when ANY of these occur:
- **Human interrupt** (Ctrl+C) — complete or discard current experiment, exit cleanly
- **Target reached** — metric_target or pass rate target achieved
- **Max experiments** — experiment_count reaches max_experiments
- **Plateau Level 3** — user chooses to stop

On exit, proceed to Phase 9: RECOMMEND. Do NOT skip Phases 9-10.

---

### Phase 9: RECOMMEND

Runs after the loop exits, during the Algorithm's VERIFY phase.

```
RECOMMEND:
  1. Generate diff between original and optimized version:
     - Metric mode: git diff optimize/{metric_name}..HEAD (or diff against baseline commit)
     - Eval mode: diff sandbox/ against original target files
  2. Summarize results:
     - Baseline → final score
     - Total experiments run, kept count, keep rate
     - Time spent
  3. List top 3-5 changes that drove the most improvement
  4. List remaining failure patterns (what still doesn't work)
  5. Present as recommendation via AskUserQuestion with options:
     - "Apply": copy optimized files back to original location
       - Metric mode: merge optimize branch, delete branch
       - Eval mode: cp sandbox files over originals
     - "Reject": discard all changes, keep original
       - Metric mode: delete optimize branch
       - Eval mode: delete sandbox directory
     - "Partial": cherry-pick specific mutations
       - Present list of kept experiments, let user select which to include
     - "Apply-Fanout": split kept experiments into independent merge-base branches (metric mode only)
       - Read results.tsv kept rows, expand short commit hashes via `git rev-parse`
       - Compute base against the session's trunk branch. Default: `git merge-base HEAD main`. If the ISA frontmatter specifies `trunk_branch:` (e.g., `master`, `develop`), use that. The base is the commit that all fanout branches diverge from — MUST be a single commit, not an arbitrary ancestor.
       - Propose logical groupings to the user. Rules:
         - Preserve application order (group N before N+1)
         - No two groups touch the same file (merge-base conflict) — merge overlapping groups
         - Flag cross-file dependencies ("group 2 calls API added in group 1 — review together")
         - Keep groups small and focused — one idea per group. Don't hardcode count.
       - On user approval: for each group, create `autoresearch/{slug}-{N}-{theme}` from base and cherry-pick the group's commits
       - Edge: 0 kept → skip Fanout (nothing to split); 1 kept → single branch, no grouping prompt
       - Pattern from pi-autoresearch's `autoresearch-finalize` skill (davebcn87, MIT)
  6. On accept → apply changes to real target
  7. On any outcome → proceed to Phase 10
```

---

### Phase 10: EXTRACT LEARNINGS

Runs after recommendation decision, during the Algorithm's LEARN phase.

```
EXTRACT LEARNINGS:
  1. Distill what worked into structured learnings:
     - Which mutation types were most effective for this target type
     - Which eval criteria were most discriminating (eval mode)
     - What patterns emerged across kept experiments
     - What approaches consistently failed
  2. Write learnings to MEMORY/LEARNING/ as a learning signal:
     - File: MEMORY/LEARNING/optimize-{slug}-learnings.md
     - Format: structured list of findings with target type context
  3. Clean up:
     - Keep: results.tsv in ISA directory, changelog in ISA ## Decisions
     - Delete: sandbox directory (eval mode) after accept/reject
     - Keep: git branch history (metric mode) until explicitly cleaned
```

---

### Results Format

**results.tsv** — in the ISA directory (`MEMORY/WORK/{slug}/results.tsv`):

```
experiment	commit	score	delta	delta_pct	confidence	status	type	description	timestamp
0	baseline	1.423	0.000	0.0%	-	baseline	-	Initial measurement	2026-03-13T10:00:00Z
1	a1b2c3d	1.392	-0.031	-2.2%	2.4×	kept	elimination	Removed unused CSS	2026-03-13T10:05:32Z
2	d4e5f6g	1.401	+0.009	+0.6%	0.7×	reverted	substitution	Replaced flexbox with grid	2026-03-13T10:10:45Z
```

`confidence` is the MAD ratio `|delta|/MAD(all_scores)` — `-` until 3+ experiments exist, `∞` when MAD=0.

For eval mode, `score` is the pass rate (0.0-1.0), `commit` is "snapshot-N":

```
experiment	commit	score	delta	delta_pct	confidence	status	type	description	timestamp
0	baseline	0.600	0.000	0.0%	-	baseline	-	Initial measurement	2026-03-18T14:00:00Z
1	snapshot-1	0.733	+0.133	+22.2%	3.1×	kept	add_instruction	Added specificity requirement	2026-03-18T14:05:00Z
2	snapshot-2	0.667	-0.066	-9.1%	1.5×	reverted	reorder_priority	Moved format spec to top	2026-03-18T14:10:00Z
```

### Dead Ends Ledger

Every optimize-mode ISA maintains a `## Dead Ends` section alongside `results.tsv` — a running list of rejected approaches with one-line reasoning. Appended during DECIDE whenever an experiment is reverted or a kept experiment fails to survive a re-run. This is the cold-start recovery fuel: a fresh agent resuming the loop reads `## Dead Ends` to avoid re-trying already-rejected hypotheses.

Format:
```markdown
## Dead Ends

- `substitution`: flexbox → grid — 0.6% regression, no structural gain
- `parameter_tune`: concurrency=8 → 16 — crashed on constrained hardware
- `algorithmic`: pre-compute lookup table — blew memory ceiling, no speed gain
```

Pattern from pi-autoresearch's living-doc `autoresearch.md` (davebcn87, MIT).

---

### Guard Rails

ISC criteria in optimize mode are **assertions**, not convergence goals. They must remain true across ALL experiments:

```markdown
- [x] ISC-1: Test suite passes after every kept change
- [x] ISC-2: No type errors in mutable files
- [x] ISC-3: Anti: No hardcoded values replacing computed values
```

These are checked every experiment cycle. A guard rail violation triggers automatic revert, regardless of score improvement. Guard rails are never "checked off" — they stay checked and must remain checked.

**Eval mode guard rails** (in addition to any custom ones):
```markdown
- [x] ISC-1: Target produces non-empty output for all test inputs
- [x] ISC-2: Target completes without errors for all test inputs
- [x] ISC-3: Anti: No test input produces identical output to another
```

---

### Session Resume

All state lives in files — the loop is resumable across sessions:
- **Metric mode:** Git branch has all successful experiments as commits
- **Eval mode:** Sandbox directory has current optimized state
- **results.tsv** has complete experiment history
- **ISA frontmatter** has current baseline, experiment count, all configuration
- **Resume:** read results.tsv to see what's been tried, check current state, continue loop

---

### Algorithm Phase Mapping

| Optimize Phase | Algorithm Phase | Notes |
|---------------|----------------|-------|
| Phase 0: TARGET ANALYSIS | BUILD | Runs during BUILD, before loop |
| Loop steps 1-8 | EXECUTE | The loop replaces normal EXECUTE |
| Phase 9: RECOMMEND | VERIFY | Replaces normal VERIFY criteria checking |
| Phase 10: EXTRACT LEARNINGS | LEARN | Extends normal LEARN with optimization-specific insights |
