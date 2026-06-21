---
name: BitterPillEngineering
description: "Audits any AI instruction set for over-prompting using the core test: would a smarter model make this rule unnecessary? Applies Five Questions to every rule — Does Claude already do this? Contradiction? Redundant? One-off fix? Vague? — then classifies each as CUT / RESOLVE / MERGE / EVALUATE / SHARPEN / MOVE / KEEP. Two workflows: Audit (full system — reads all force-loaded files from settings.json, reports token savings estimate) and QuickCheck (single file, fast keep/cut/sharpen verdict). Outputs categorized report with estimated line and token savings. Core principle: less scaffolding = better output — every unnecessary rule competes for attention and degrades the rules that matter. Anti-fragile rules to KEEP: verification harnesses, ISC, data pipelines, specific DO/DON'T examples, tool preferences, routing rules. Fragile rules to CUT: CoT orchestrators, format parsers, retry cascades, numeric personality scales, abstract value statements. Requires loadAtStartup and postCompactRestore.fullFiles to stay in sync in settings.json — removing a file from one requires checking the other. NOT FOR general code simplification or refactoring (use simplify skill). NOT FOR attacking logical or strategic flaws in ideas (use RedTeam for that). USE WHEN BPE, bitter pill, audit setup, over-prompting, trim instructions, audit rules, dead weight, redundant rules, simplify setup, instruction audit, prompt hygiene, check these rules, clean up CLAUDE.md."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/BitterPillEngineering/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# BitterPillEngineering

Audit any AI instruction set for over-prompting. Based on the principle that **less scaffolding = better output** — every unnecessary rule competes for attention and degrades the rules that matter.

The core test: *"Would a smarter model make this unnecessary?"* If yes, it's scaffolding, not architecture.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Audit** | "audit setup", "full audit", "check all rules" | `Workflows/Audit.md` |
| **QuickCheck** | "quick check", "check this file", "check these rules" | `Workflows/QuickCheck.md` |

## Examples

**Example 1: Full system audit**
```
User: "Run BPE on my setup"
→ Invokes Audit workflow
→ Reads all force-loaded files from settings.json
→ Evaluates each rule against the Five Questions
→ Returns categorized report with estimated token savings
```

**Example 2: Check a single file**
```
User: "Quick check this CLAUDE.md"
→ Invokes QuickCheck workflow
→ Reads the target file
→ Returns concise keep/cut/sharpen verdict
```

**Example 3: Post-cleanup validation**
```
User: "I trimmed my rules, check if anything's still redundant"
→ Invokes Audit workflow
→ Compares remaining rules against Claude defaults
→ Flags any surviving dead weight
```

## Gotchas

- Claude's built-in system prompt changes across versions — what was "default behavior" 3 months ago may not be now. When in doubt, test rather than assume.
- Rules that seem redundant with defaults may have been added because Claude was inconsistent about following the default. Check failure history before cutting.
- "One-off fix" rules sometimes prevent recurring failures. Check if the failure pattern is truly gone before removing.
- The `loadAtStartup` list in settings.json and `postCompactRestore.fullFiles` must stay in sync — if you remove a file from one, check the other.

## The Five Questions

For every rule, instruction, or preference found, evaluate:

1. **Default behavior?** Does Claude already do this without being told?
2. **Contradiction?** Does this conflict with another rule in the same or different file?
3. **Redundancy?** Is this already covered by a different rule or file?
4. **One-off fix?** Was this added to fix one specific bad output rather than improve outputs generally?
5. **Vague?** Would Claude interpret this differently every time? (e.g., "be more natural", numeric personality scales)

## Classification

| Category | Action |
|----------|--------|
| Restates default behavior | **CUT** — the model already does this |
| Contradicts another rule | **RESOLVE** — pick one, cut the other |
| Duplicates another rule | **MERGE** — one location, one statement |
| One-off fix for past mistake | **EVALUATE** — still relevant or already learned? |
| Vague / unquantifiable | **SHARPEN** — add specific DO/DON'T examples, or cut |
| Loaded but rarely actionable | **MOVE to on-demand** — load via CONTEXT_ROUTING when needed |
| Specific, actionable, non-default | **KEEP** — this is what good instructions look like |

## Anti-Fragile vs Fragile

**Keep (anti-fragile):** Verification harnesses, ISC, data pipelines, specific DO/DON'T examples, tool preferences, routing rules.

**Cut (fragile):** CoT orchestrators, format parsers, retry cascades, numeric personality scales, abstract value statements, process descriptions that aren't followed.

## Output Format

```
## BitterPillEngineering Audit

**Scope:** [what was audited]
**Files read:** [count]
**Rules evaluated:** [count]

### CUT (restating defaults)
- [rule] — [reason]

### RESOLVE (contradictions)
- [rule A] vs [rule B] — [which to keep and why]

### MERGE (redundancies)
- [locations] — [merge into where]

### EVALUATE (one-off fixes)
- [rule] — [still needed? verdict]

### SHARPEN or CUT (vague)
- [rule] — [sharpen how, or cut why]

### MOVE to on-demand
- [content] — [how often it's actually needed]

### KEEP (carrying weight)
- [rule] — [why it matters]

**Estimated savings:** [lines] lines, ~[tokens] tokens
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"BitterPillEngineering","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```
