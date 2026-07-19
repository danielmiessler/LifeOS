---
status: RETIRED 2026-07-11 — historical doctrine. Modes/tiers were abolished with Algorithm v8 and system prompt v3.0.0 (one adaptive format). Kept as record only; nothing routes here.
last_updated: 2026-05-13
last_updated_by: kai
convention: pai-freshness-v1
mode: loop
status: doctrine-shipped-runtime-pending
---

# Loop Mode — The Goal-Absorbed Iteration Primitive

> **Loop is the unified primitive for "iterate toward a stated end-state."** It absorbed what used to be called "Goal" — they were the same thing under different vocabulary. Every Loop run has a mandatory `principal_stated_goal:` anchor. The classifier auto-detects loop-shape; OBSERVE confirms via one density-gate question; `LoopRunner.ts` (next ISA) is the fresh-context substrate.

---

## Status

- **Doctrine: shipped** (this file).
- **Runtime: pending** — a future LIFEOS/TOOLS/LoopRunner.ts tool is the next ISA. Until it ships, `/loop` and `/loop --autoresearch` continue to operate on the current same-session-accumulating substrate.
- **v6.6.0 Algorithm doctrine bump** will be paired with the LoopRunner ship.

## What Loop is

Loop = Algorithm + continuation behavior + mandatory goal anchor.

A Loop run:
1. Has a stated goal (`principal_stated_goal:` — captured at OBSERVE via the v6.4.0 four-signal detector; minimum-content rule applies).
2. Runs the Algorithm as the iteration body — each iteration is a full or bounded Algorithm pass.
3. Continues across iterations until halt conditions are met. Halt = `phase: complete` set on the ISA.
4. Uses one of three substrates: same-session, fresh-subprocess (local), or fresh-Worker (Arbol Flow).

## What Loop is NOT

- **Not a separate primitive from the Algorithm.** Loop is the Algorithm with continuation behavior. The Algorithm IS the iteration body.
- **Not a "Goal mode" peer to Ideate / Optimize.** Goal is a frontmatter anchor, not a mode. Loop is the continuation behavior that uses the anchor.
- **Not a replacement for one-shot Algorithm.** 95% of work doesn't need Loop. Loop is reserved for goal-shaped + horizon-language work.

## When Loop engages

Auto-detection by `TheRouter.hook.ts` (retired 2026-07-11) (extended classifier):

```
LOOP_HINT: yes | no
  yes IFF GOAL_SIGNAL ∈ {1, 3}  (named metric+threshold OR "until X" predicate)
        AND horizon-language present  ("until", "keep iterating", "indefinitely",
                                       "for as long as", "asymptote", "ongoing",
                                       "across many cycles", "until I tell you to stop")
        AND minimum-content rule passes on the goal literal
```

When `LOOP_HINT: yes`, the Algorithm OBSERVE phase asks ONE question (density-gate pattern):

> *"This is loop-shaped (goal + horizon). Run as Loop or one-shot? [loop / once / proceed = once]"*

`proceed` defaults to `once` (safer; no surprise multi-hour runs). Explicit `loop` opts in. The gate is the human-affirmation layer that prevents high-blast-radius silent auto-engage.

Explicit invocation also engages Loop directly:

```bash
/loop --target "<path>" --goal "<goal text>" --iterations N
/loop --autoresearch --target "<path>" --goal "<goal text>"
```

## Loop config (ISA frontmatter)

When `mode: loop`, the ISA gains a `loop_config:` block plus v2.10 journey metadata:

```yaml
mode: loop
response_mode: algorithm                                       # v2.10
algorithm_mode: loop                                           # v2.10
principal_stated_goal: "<verbatim — mandatory>"                # v6.4.0
principal_stated_goal_source: prompt
principal_stated_goal_signal: 1
principal_stated_goal_locked: <ISO-8601>
current_state: "<one-line: where we're starting>"              # v2.10 — mandatory for loop
ideal_state: "<one-line: where we're going>"                   # v2.10 — mandatory for loop, aligns with goal
capabilities_invoked:                                          # v2.10 — append-only
  - ISA
  - SystemsThinking
  - LoopRunner.ts                                              # runtime substrate, not a thinking capability
loop_config:
  halt:
    - count: 20                                                # iteration cap
    - condition: "all ISCs pass"                               # Haiku-evaluable predicate
    - asymptote: { metric: score, threshold: 0.01 }            # no-improvement detection
    - budget: { turns: 100, minutes: 360 }                     # time/turn ceiling
    - user_halt: true                                          # always-on
  context_discipline: accumulating | fresh-per-iteration | hybrid
  substrate: same-session | fresh-subprocess | arbol
  supervision: human-between | autonomous
  iteration_body: full-algorithm | bounded-algorithm | single-action
iteration: 7                                                    # current iteration number
loop_state: running | halted | completed
```

`current_state:` and `ideal_state:` are **mandatory for Loop** (vs optional for other modes) because the JourneyStrip on the Loop tab visualizes the multi-iteration journey between them. Without these one-liners, the strip falls back to ISC dots only, losing the headline framing.

Defaults when classifier auto-detects Loop:
- `halt: { count: 20, budget: { minutes: 60 } }` — conservative
- `context_discipline: fresh-per-iteration` (once LoopRunner.ts ships)
- `substrate: fresh-subprocess` (once LoopRunner.ts ships)
- `supervision: autonomous`
- `iteration_body: full-algorithm`

Defaults when invoked via `/loop` (today's substrate):
- `context_discipline: accumulating`
- `substrate: same-session`

## Iteration history (the new ISA section)

When `mode: loop`, the ISA gains a `## Iteration History` section. Each iteration appends a bounded summary that fresh subprocesses can read instead of the full transcript:

```markdown
## Iteration History

### Iter 6 (2026-05-13T14:23Z)
- Closed: ISC-11, ISC-14
- Open: ISC-12, ISC-13, ISC-17, ISC-22
- Delta: +2 ISCs passing
- Summary (80 tokens): Migrated callsite A to new API; tests green. Found edge case
  in callsite B requiring auth retry — deferred to next iteration.

### Iter 7 (2026-05-13T14:31Z)
- Closed: ISC-12
- Open: ISC-13, ISC-17, ISC-22
- Delta: +1 ISC passing
- Summary (80 tokens): Auth retry implemented and verified for callsite B. ...
```

This section is what makes fresh-context-per-iteration work — each fresh `claude -p` subprocess reads the last 1-2 entries from THIS section, not the full transcript.

## The fresh-context substrate (LoopRunner.ts — next ISA)

A new LIFEOS/TOOLS/LoopRunner.ts (planned, not yet on disk) will be the supervisor:

```
while not halted:
  1. read ISA at <path>
  2. check halt conditions in loop_config → exit if any met
  3. build bounded directive:
     - principal_stated_goal (verbatim)
     - current ISC state (open vs closed)
     - last 1-2 iteration summaries from ## Iteration History
     - dead ends (if any)
     - explicit instruction to do ONE iteration at bounded budget
  4. spawn fresh `claude -p <directive>` subprocess (via Inference.ts pattern)
  5. parse subprocess output for ISA updates
  6. apply updates: tick ISCs, append iteration summary, increment iteration, write
  7. halt detection: Haiku call (fast tier) reading ISA state
  8. loop
```

Context budget per iteration: ~12k input tokens. After 100 iterations, ~1.2M tokens total — manageable. Same-session accumulating would saturate the context window long before then.

## ISA invariance

Across all substrates — one-shot Algorithm, supervised Loop, autonomous LoopRunner, Arbol Flow — the ISA is the same artifact. Same path. Same slug. Same canonical structure. Loop additions are purely additive (`loop_config`, `iteration`, `loop_state` frontmatter; `## Iteration History` section). Nothing is replaced or branched.

The ID-stability rule (v6.5.0) is preserved across iterations: ISC IDs never re-number. Closing ISC-11 at iteration 7 means it was open at iteration 6 and is closed at iteration 7. Same ID through life.

`principal_stated_goal:` is locked at iteration 1 (v6.4.0 immutability rule). Subsequent iterations cannot mutate it; goal drift requires explicit user revision.

## Halt conditions

| Halt | Detection | Action |
|------|-----------|--------|
| `count` reached | iteration count == cap | set `loop_state: halted`, `phase: complete`, append halt reason to Decisions |
| `condition` met | Haiku predicate eval (fast tier, 15s timeout) reading ISA state | set `loop_state: completed`, `phase: complete` |
| `asymptote` detected | last N iterations' delta < threshold (MAD-style from `/loop --autoresearch`) | set `loop_state: halted`, log to Decisions |
| `budget` exhausted | turns OR minutes exceeded | set `loop_state: halted`, log overflow |
| `user_halt` | user interrupts (Ctrl-C, `/loop clear`, explicit message) | set `loop_state: halted` immediately |

## Migration from `/loop` and `/goal`

| Pre-2026-05-13 | Post-2026-05-13 |
|----------------|-----------------|
| `/loop --target X --goal "<text>"` | `mode: loop` ISA with `principal_stated_goal: "<text>"` (same substrate until LoopRunner.ts ships) |
| `/loop --autoresearch` | `mode: loop` with `supervision: autonomous`, `halt.asymptote` set |
| Claude Code's native `/goal` | aliased to Loop mode with `halt.condition` filled from /goal text |
| Concept "Goal mode" | deleted — never exists; Loop with a goal IS goal mode |

## Cross-references

- All modes: [`README.md`](README.md)
- Goal anchor mechanism: `../v6.5.0.md` § "Principal-Stated Goal"
- Density gate (one-question pattern): `../v6.5.0.md` § "Density × Tier Gate"
- Loop skill (router): `$LIFEOS_ROOT/skills/Loop/SKILL.md`
- LoopRunner.ts (pending): LIFEOS/TOOLS/LoopRunner.ts — next ISA, not yet on disk
- Algorithm v6.6.0 doctrine bump (pending): `../v6.6.0.md` — paired with LoopRunner ship
