# Mode & Parameter Detection (Algorithm v6.2.0)

Loaded by OBSERVE on demand when ideate, optimize, fast-path, or effort override modes are detected.

---

## Effort Override Detection

**Triggers:** `/e[1-5]` or `E[1-5]` as standalone token in message (case-insensitive)

**Mapping:** E1=Standard, E2=Extended, E3=Advanced, E4=Deep, E5=Comprehensive

When detected:
1. Set effort level to corresponding tier — this is an override, not a hint
2. Add `effort_source: explicit` to ISA frontmatter
3. Skip "Set effort level" auto-detection in OBSERVE
4. E1 additionally forces fast-path mode (OBSERVE→EXECUTE→VERIFY) when task structure allows
5. AI may note complexity mismatch in ISA but MUST proceed at specified level

**Interaction with modes:** E-level and mode (ideate/optimize/research) are orthogonal. Both can be set simultaneously. E-level sets the tier; mode sets the execution pattern.

---

## Ideate Mode

**Triggers:** `ideate [problem]` | `id8 [problem]` | `generate ideas for` | `dream up solutions for`

1. Set `mode: ideate` in ISA frontmatter
2. Load `${PAI_DIR}/ALGORITHM/ideate-loop.md`
3. Map effort tier to `time_scale` per ideate-loop.md

## Optimize Mode

**Trigger:** `optimize [target]`

1. Determine `eval_mode`:
   - `metric_command` provided or code target → `eval_mode: metric`
   - Prompt/skill/agent target or explicit `eval_mode: eval` → `eval_mode: eval`
2. Set `mode: optimize` and `eval_mode` in ISA frontmatter

## Parameter Detection (Ideate & Optimize)

**Resolution order:** Preset → Focus → Individual overrides → Meta-Learner (ideate only)

1. Check for explicit **preset name** → `algorithm_config.preset`
2. Check for **focus value** (0.0–1.0) → `algorithm_config.focus`
3. Check for **individual param specs** → overrides
4. If no explicit params, infer from **tone**:

| Preset | Tone keywords |
|--------|---------------|
| `dream` | wild, dream, free-form, surprise me, hallucinate |
| `explore` | explore, broad, brainstorm |
| `directed` | focused, practical, actionable |
| `surgical` | precise, surgical, optimal |
| `cautious` (optimize) | careful, safe, production |
| `aggressive` (optimize) | bold, aggressive, fast |

5. Resolve via `parameter-schema.md`
6. Write resolved `algorithm_config:` block to ISA frontmatter

## Fast-Path Detection (revised v6.2.0)

Available at **Standard tier (E1) only.** Compresses phases for simple tasks AND skips the mandatory `Skill("ISA")` invocation that would otherwise fire at OBSERVE for E2+.

**The fast-path is a whitelist, not a heuristic.** A task qualifies for fast-path ONLY if every condition below holds. This is deliberate — the v5.0.0 BPE concern is that any heuristic-shaped bypass becomes a doctrine-evasion route. The whitelist closes that.

**Execute-and-verify archetype (E1 fast-path):**
ALL must hold:
- Effort tier is E1 (auto-detected or explicit `/e1`).
- Task is one of: rename a symbol, fix a typo, run a command, read-and-report-on a file, append a single line, format/lint, single-package install, single test run.
- Single file or single command in scope.
- No multi-step transformation.
- No new architecture, no new endpoints, no new dependencies, no migrations.
- `MODE: ALGORITHM` AND `TIER: E1` in additionalContext (written by `ModeClassifier.hook.ts`).

If ALL whitelist conditions hold:
- Set `mode: fast-path` in ISA frontmatter.
- Inline-write the minimal ISA (Goal + Criteria only — the E1 tier completeness floor) without invoking `Skill("ISA")`.
- Compress to: OBSERVE → EXECUTE → VERIFY (skip THINK/PLAN/BUILD).

If ANY whitelist condition fails:
- Fast-path does NOT apply.
- Proceed with standard 7-phase Algorithm at the resolved tier (E2+ requires `Skill("ISA")` invocation at OBSERVE).

**Research-only archetype:**
Analysis, review, or investigation with no code changes.
- Set `mode: research` in ISA frontmatter.
- Skip ISA creation only at E1 with the same whitelist conditions; otherwise scaffold via `Skill("ISA")`.
- Compress to: OBSERVE → THINK → EXECUTE → VERIFY → LEARN.

**v6.2.0 doctrine note:** the whitelist exists because the new twelve-section ISA frame and `Skill("ISA")` invocation pattern raise the OBSERVE-phase floor. Without an explicit whitelist, an E1 task could "feel like" a fast-path candidate to the model and bypass the skill silently — recreating the v5.0.0 BPE under-cut {{PRINCIPAL_NAME}} and {{DA_NAME}} already closed at the mode-selection layer in v6.0.0. The whitelist is the same enforcement pattern, applied one level deeper.
