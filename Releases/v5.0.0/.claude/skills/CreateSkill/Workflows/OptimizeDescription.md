# OptimizeDescription Workflow

Optimize a skill's YAML description for accurate triggering — ensuring it fires when it should and doesn't fire when it shouldn't.

The description field in SKILL.md frontmatter is the primary mechanism that determines whether a skill gets invoked. A brilliant skill that never triggers is useless. This workflow systematically tests and improves trigger accuracy.

---

## Step 1: Read the Current Skill

Read the target skill's SKILL.md and note:
- Current `description:` field
- What the skill actually does
- What workflows it contains
- What adjacent skills might compete for the same triggers

---

## Step 2: Generate Trigger Eval Queries

Create 20 eval queries — a mix of should-trigger (10) and should-not-trigger (10).

### Should-Trigger Queries (10)

Think about coverage — different phrasings of the same intent:
- Some formal, some casual
- Cases where the user doesn't name the skill but clearly needs it
- Uncommon use cases the skill handles
- Cases where this skill competes with another but should win

### Should-Not-Trigger Queries (10)

The most valuable are **near-misses** — queries that share keywords or concepts but actually need something different:
- Adjacent domains with overlapping vocabulary
- Ambiguous phrasing where naive keyword matching would trigger but shouldn't
- Tasks that touch on the skill's domain but in a context where another tool is better

**Avoid obviously irrelevant queries** — "write a fibonacci function" as a negative for a PDF skill tests nothing.

### Query Quality

Queries must be realistic — something a user would actually type:
- Include file paths, personal context, specific details
- Mix of lengths and formality levels
- Some with typos or casual speech
- Concrete and specific, not abstract

Bad: `"Format data"`, `"Create a chart"`
Good: `"ok so I have this quarterly report from finance (its the xlsx in my downloads, Q4_revenue_final.xlsx) and my manager wants a comparison chart showing this quarter vs last quarter with the variance highlighted"`

Save as JSON:
```json
[
  {"query": "realistic user prompt here", "should_trigger": true},
  {"query": "near-miss prompt here", "should_trigger": false}
]
```

---

## Step 3: Review Queries with User

Present the eval set and ask the user to:
1. Remove any unrealistic queries
2. Add edge cases they've encountered
3. Flip any should/shouldn't trigger labels they disagree with

This step matters — bad eval queries lead to bad descriptions.

---

## Step 4: Test Current Description

First, collect all skill names and descriptions:

```bash
rg '^(name|description):' ~/.claude/skills/*/SKILL.md ~/.claude/skills/*/*/SKILL.md --no-filename 2>/dev/null | head -200
```

Then spawn a **single** Agent subagent that evaluates ALL queries at once (batching avoids 20+ separate agent spawns):

```
You have access to the following skills (name and description only):

[Paste the collected name/description pairs]

For each of the following user messages, decide if you would invoke a skill.
Reply with ONLY a JSON array — one entry per query:

[
  {"query": "...", "verdict": "TRIGGER: SkillName"},
  {"query": "...", "verdict": "NO_TRIGGER"}
]

Do not explain. Just the verdicts.

Queries:
1. [query 1]
2. [query 2]
...
```

Run this batch **twice** (2 separate subagent calls, in parallel) for reliability — compare the two runs for consistency.

**Score:** For should-trigger queries, count how often the correct skill triggered. For should-not-trigger queries, count how often NO_TRIGGER was returned (or a different skill triggered). Calculate accuracy as: correct verdicts / total verdicts. Flag any queries where the two runs disagreed (inconsistent triggering).

---

## Step 5: Analyze Failures

Identify which queries failed and why:

- **False negatives** (should trigger but didn't) — description is missing key phrases or concepts
- **False positives** (shouldn't trigger but did) — description is too broad or shares vocabulary with the wrong domain
- **Confusion with other skills** — description competes with another skill's territory

---

## Step 6: Improve the Description

Based on the failure analysis, rewrite the description:

- For false negatives: add the missing intent phrases or domain concepts
- For false positives: add specificity to distinguish from adjacent skills
- Keep the `USE WHEN` clause comprehensive but precise
- Stay under 1024 characters (hard limit from SkillSystem.md)

**Writing tips for descriptions:**
- Slightly "pushy" is better than conservative — undertriggering is a bigger problem than overtriggering
- Include both what the skill does AND specific contexts for when to use it
- Name the competing skills implicitly by being specific about YOUR domain

---

## Step 7: Re-Test and Compare

Run the same eval set against the new description (Step 4 again).

Present before/after:
```
### Description Optimization Results

**Before:** [old accuracy]%
  - False negatives: [N] ([which queries])
  - False positives: [N] ([which queries])

**After:** [new accuracy]%
  - False negatives: [N] ([which queries])
  - False positives: [N] ([which queries])

**Improvement:** [delta]%
```

---

## Step 8: Iterate or Apply

- **If accuracy improved but not satisfactory:** Repeat Steps 5-7 (max 3 iterations to avoid overfitting)
- **If accuracy is good (>85%):** Apply the new description to the skill's SKILL.md
- **If accuracy degraded:** Revert to previous description and try a different approach

Show the user the final description before applying it.

---

## Understanding Skill Triggering

Skills appear in the model's context with name + description. The model decides whether to consult a skill based on that description. Important nuance: models tend to **undertrigger** — they don't use skills when they'd be useful. This means descriptions should be slightly pushy, naming specific scenarios where the skill should be used even if the user doesn't explicitly ask for it.

Simple, one-step queries may not trigger a skill even with a perfect description, because the model handles them directly. Test prompts should be substantive enough that a skill would genuinely help.
