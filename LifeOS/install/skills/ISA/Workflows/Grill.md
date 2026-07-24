# Grill Workflow

Relentless, checkpointed discovery interview that interrogates a half-formed idea until its shape is clear, then hands off to Scaffold to build the ISA. Where Interview FILLS a known ISA structure, Grill DISCOVERS a structure that doesn't exist yet. Human-invoked and exploratory; never Algorithm-automatic.

## When to invoke

- User directly: `Skill("ISA", "grill me on <topic>")` or `/grill-me <topic>`
- Before Scaffold when the idea is too unformed to scaffold a strong ISA.
- To refresh a spec: "grill me again on <slug>, here's new findings."

NOT for filling an existing ISA's thin sections — that's Interview.

## Inputs

| Input | Required | Description |
|-------|----------|--------------|
| topic | yes | The idea/plan/decision to interrogate |
| slug | no | WORK dir to use; derived from topic if absent |
| max_questions | no | Default 12 |

## Procedure

### Step 1 — Voice notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Grill workflow in the ISA skill"}' \
  > /dev/null 2>&1 &
```

### Step 2 — Establish the WORK dir

Resolve the canonical LifeOS work dir — **`~/.claude/LIFEOS/MEMORY/WORK/{slug}/`** (absolute; the same dir Scaffold writes the ISA to, so the handoff stays co-located). Use this path even when `/grill-me` is invoked from another repo's cwd — it is NOT project-relative, and it is NOT a bare `~/.claude/MEMORY/WORK/` outside the `LIFEOS/` tree. Create `grill.md` there with three sections: **Shape & Key Decisions**, **Q&A Log**, **Open Flags**. This file is the checkpoint target — never a project-root `brainstorms/` folder.

### Step 3 — Shape check (only if the category is ambiguous)

If it's unclear what *kind* of thing this is (skill vs hook vs CLI vs doc, etc.), propose 2-3 candidate shapes up front and ask discriminating questions to prune to one before walking the tree. Skip when the shape is already obvious.

### Step 4 — Walk the design tree

Resolve dependencies in order — never a leaf before its parent. Per decision:

- Ask one question at a time via **AskUserQuestion** — one question per call, never batch. Present your recommended answer as the first option (mark it "(Recommended)") alongside the real alternatives, so the user confirms or overrides in one step; they can always pick "Other" to redirect. Fall back to a free-text question only when the answer space is genuinely open-ended and won't bound into options.
- Never a bare open ask — always lead with where you'd land and why.
- Explore the codebase instead of asking when the answer is discoverable (Grep/Read first; ask only if code can't answer it).
- On a low-confidence or high-stakes call, add a one-line strongest-objection to your own recommendation before the user answers.

### Step 5 — Checkpoint after every turn

Immediately write to `grill.md`: append the Q&A pair to Q&A Log, promote settled decisions into Shape & Key Decisions, record "needs external input" items under Open Flags. Survives context-window degradation on long sessions.

### Step 6 — Pre-mortem → draft ISCs

Before closing, run one failure-mode pass: "imagine this shipped and failed — what went wrong?" Convert each failure mode into a draft binary criterion (ISC) under Shape & Key Decisions. This is what makes the resulting ISA hard-to-vary.

### Step 7 — Stop conditions

End when the shape is clear enough to scaffold, max_questions is hit, or two consecutive answers are low-signal ("I don't know" / "skip").

### Step 8 — Handoff

Offer, in order: (1) hand the shape to Scaffold — `Skill("ISA", "scaffold from prompt: <Shape & Key Decisions + draft ISCs from grill.md>")`, targeting the same WORK dir; (2) `TaskCreate` for each Open Flag; (3) sync related skills/guides this session touched, via CreateSkill — Grill's job, not Interview's.

## Output format (grill.md)

```
# Grill: <topic>
## Shape & Key Decisions
- <settled decision> — <rationale>
- ISC: <binary criterion from pre-mortem>
## Q&A Log
### Q1: <question>
**Recommended:** <rec>  **Answer:** <user answer>
## Open Flags
- [ ] <unknown> — needs <who/what>
```

## Failure modes

- **User abandons mid-grill:** partial grill.md is still valuable; leave an Open Flag noting where it paused.
- **Answers stay aspirational:** push for the concrete ("what would prove that?"); if they can't, log an Open Flag, not a settled decision.
- **Topic is already well-formed:** say so and route straight to Scaffold — don't manufacture questions to hit max_questions.

## Interaction with Scaffold

Scaffold has no dedicated grill mode — the handoff is the grill.md content passed as Scaffold's prompt. Feed the **Shape & Key Decisions** (and the pre-mortem draft ISCs) into `Skill("ISA", "scaffold from prompt: …")`: Scaffold's goal-detection preserves the stated goal from that prompt and derives Vision / Out of Scope / Constraints / Principles, and the draft ISCs carry into `## Criteria`. Grill's value is front-loading the discovery so Scaffold's prompt is already hard-to-vary.

---

_Adapted from Matt Pocock's `grilling` / `grill-me` skills — [github.com/mattpocock/skills](https://github.com/mattpocock/skills) (MIT, © 2026 Matt Pocock). Independent implementation: it checkpoints each turn to `MEMORY/WORK/{slug}/grill.md` (rather than a project-root `brainstorms/` folder) and adds a pre-mortem→ISC pass before the Scaffold handoff._
