---
name: BitterPillEngineering
version: 1.0.8
description: "Audits any AI instruction set for over-prompting using the core test — would a smarter model make this rule unnecessary? Applies Five Questions to every rule (Claude already does this? Contradiction? Redundant? One-off fix? Vague?) then classifies as CUT/RESOLVE/MERGE/EVALUATE/SHARPEN/MOVE/KEEP. Workflows: Audit (full system, token savings), QuickCheck (single file). Principle: less scaffolding = better output. USE WHEN BPE, bitter pill, audit setup, over-prompting, trim instructions, dead weight, simplify setup, clean up CLAUDE.md. NOT FOR attacking logical flaws in ideas (use RedTeam)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/BitterPillEngineering/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the BitterPillEngineering skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **BitterPillEngineering** skill to ACTION...
   ```

# BitterPillEngineering

## What It Does

Audits any AI instruction set for over-prompting. It runs every rule through Five Questions — does Claude already do this, does it contradict another rule, is it redundant, was it a one-off fix, is it vague — then classifies each as CUT, RESOLVE, MERGE, EVALUATE, SHARPEN, MOVE, or KEEP, with an estimate of the tokens you'd save. Two workflows: Audit (full system) and QuickCheck (single file).

## The Problem

Instruction sets accumulate. Every time the model does something wrong, someone adds a rule, and over months the file fills with instructions that restate default behavior, contradict each other, or fixed one bad output that never recurred. The cost is hidden: every unnecessary rule competes for attention and degrades the rules that actually matter, so a bloated setup produces worse output than a lean one. The hard part is telling load-bearing rules from dead weight — which is what this audit does, rule by rule.

## How It Works

Built on the principle that **less scaffolding = better output**. The core test for every rule: *"Would a smarter model make this unnecessary?"* If yes, it's scaffolding, not architecture, and it's a candidate to cut. The Five Questions and the classification table below drive the verdict for each rule.

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

## The HOW-vs-WHAT Test (sixth question, first-class)

Beyond the Five Questions, audit every rule for **procedural over-prompting**: does it dictate execution methodology or reasoning choreography ("first analyze X, then consider Y, then decide Z") instead of articulating the ideal state (WHAT done looks like) plus the tools? If it scripts the model's HOW rather than naming the WHAT, it is scaffolding — flag it **CUT**.

Exception — four keep-classes are legitimate HOW, never cut them: **safety-gate** (confirmation/destructive-op guard/approval), **verified-gotcha** (a documented non-obvious failure), **tool-contract** (exact CLI/API/path recipe), **output-format-contract** (required deliverable shape). Deterministic tools (`*.ts`) are exempt. This is the positive form of the core test: a rule that survives "would a smarter model make this unnecessary?" is either a keep-class or genuine architecture. Full doctrine: `LIFEOS/RULES/Philosophy.md` § Ideal-State Prompting.

## Classification

| Category | Action |
|----------|--------|
| Restates default behavior | **CUT** — the model already does this |
| Contradicts another rule | **RESOLVE** — pick one, cut the other |
| Duplicates another rule | **MERGE** — one location, one statement |
| One-off fix for past mistake | **EVALUATE** — still relevant or already learned? |
| Vague / unquantifiable | **SHARPEN** — add specific DO/DON'T examples, or cut |
| Loaded but rarely actionable | **MOVE to on-demand** — load via the CLAUDE.md routing table when needed |
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
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"BitterPillEngineering","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/LIFEOS/MEMORY/SKILLS/execution.jsonl
```
