# TestSkill Workflow

Test a skill's effectiveness by running it against real prompts and comparing with a no-skill baseline.

Inspired by Anthropic's skill-creator methodology: the only way to know if a skill works is to run it on real prompts and compare outputs with and without the skill.

---

## Step 1: Identify the Skill Under Test

Read the target skill's SKILL.md:

```
~/.claude/skills/[path]/SKILL.md
```

Note the skill's:
- Name and description
- Key workflows and what they do
- Expected behavior changes

---

## Step 2: Create Test Prompts

Generate 2-4 realistic test prompts — the kind of thing a real user would actually say that should invoke this skill. Share them with the user for review before running.

Good test prompts are:
- **Realistic** — something a user would actually type, not an abstract request
- **Substantive** — complex enough that a skill would actually help (simple one-liners may not trigger skill usage)
- **Diverse** — cover different aspects of the skill's functionality
- **Specific** — include concrete details (file paths, names, context) like real requests do

Bad: `"Format this data"`
Good: `"I have a CSV in ~/Downloads/q4-sales.csv with revenue in column C and costs in column D — add a profit margin percentage column and highlight any margins below 15%"`

---

## Step 3: Run Test Prompts (With-Skill + Baseline)

**Workspace:** `MEMORY/WORK/skill-test-[skillname]/iteration-[N]/`

For each test prompt, spawn TWO Agent subagents **in the same turn** so they run in parallel:

### With-Skill Agent

```
You are testing a skill. Read the following skill file FIRST, then use its instructions to accomplish the task.

Skill file: [absolute path to SKILL.md]

Task: [test prompt]

Save your final output to: [workspace]/test-[N]/with-skill/output.md

After completing the task, also save a brief transcript of your approach to: [workspace]/test-[N]/with-skill/transcript.md
Include: what steps you took, what tools you used, any decisions you made.
```

### Baseline Agent (No Skill)

```
Accomplish this task using your general capabilities. Do NOT read any skill files.

Task: [test prompt]

Save your final output to: [workspace]/test-[N]/baseline/output.md

After completing the task, also save a brief transcript of your approach to: [workspace]/test-[N]/baseline/transcript.md
Include: what steps you took, what tools you used, any decisions you made.
```

Use `run_in_background: true` for all agents. Launch all with-skill + baseline pairs at once.

---

## Step 4: Compare Results

Once all agents complete, for each test prompt:

1. **Read both outputs** (with-skill and baseline)
2. **Read both transcripts** to understand approach differences
3. **Assess the delta** — did the skill actually help?

Present a comparison to the user for each test:

```
### Test [N]: "[prompt summary]"

**With Skill:**
- Approach: [how it handled the task]
- Quality: [assessment]

**Baseline (No Skill):**
- Approach: [how it handled the task]
- Quality: [assessment]

**Verdict:** [Skill helped significantly / Skill helped marginally / No meaningful difference / Baseline was better]
**Why:** [specific reasons]
```

---

## Step 5: Collect Feedback

Ask the user:
1. Which outputs did you prefer and why?
2. What did the skill get wrong?
3. What should the skill do differently?

Empty feedback on a test = the user thought it was fine.

---

## Step 6: Iterate or Complete

Based on feedback:

- **If improvements needed:** Invoke the `Workflows/ImproveSkill.md` workflow with the feedback, then rerun tests into a new `iteration-[N+1]/` directory. Compare against the previous iteration.
- **If skill looks good:** Report the results and suggest running `Workflows/OptimizeDescription.md` to ensure the skill triggers reliably.
- **If skill shows no improvement over baseline:** The skill may not be needed for this use case, or needs fundamental rethinking. Discuss with the user.

---

**Writing philosophy:** When improving skills based on test results, see `Workflows/ImproveSkill.md` Step 3 for the full guidance (explain the why, keep lean, generalize, bundle repeated work).
