# Interview Workflow

Adaptive question-and-answer that fills in or deepens an ISA's prose sections. Used when the prompt alone doesn't carry enough signal to scaffold a strong ISA, or when the user wants to deliberately deepen an existing ISA.

## When to invoke

- After Scaffold at E5 (mandatory before BUILD per the tier completeness gate).
- After Scaffold at any tier if CheckCompleteness flags thin sections.
- User directly: `Skill("ISA", "interview me on <isa-path>")`
- User directly with a specific section: `Skill("ISA", "interview me on the Vision section of <isa-path>")`

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| isa_path | yes | Path to the ISA to deepen |
| section | no | If supplied, only interview that section; otherwise walk all thin sections |
| max_questions | no | Default 8; cap to keep interview tight |

## Procedure

### Step 2 — Read the ISA

Load the ISA at `isa_path` and identify which sections are populated, thin, or missing.

### Step 3 — Build the question queue

Walk sections in priority order. For each section, ask zero or more questions only when the existing content is thin or missing.

| Section | Probe questions (use when section is thin) |
|---------|-------------------------------------------|
| **Problem** | "What's broken right now?" / "Who feels this most acutely?" / "What does the cost of the broken state look like?" |
| **Vision** | "When this is done, what does the user feel?" / "What does euphoric surprise look like for this work?" / "If a friend used it, what would make them tell another friend?" |
| **Out of Scope** | "What would be tempting to add but distract from the core?" / "What scope decisions do you want to lock down so they don't drift?" |
| **Principles** | "What truths must this work respect regardless of implementation choices?" / "What would you say to a future maintainer about how to think?" |
| **Constraints** | "What are the architectural mandates that bound the solution space?" / "What do you not want anyone to ever try?" |
| **Goal** | "In one or two sentences, what is the verifiable done state?" |
| **Criteria** | "Walk me through the test that would prove ISC-N." / "Is this ISC actually one binary probe, or could it be split?" |
| **Test Strategy** | "How would you actually verify ISC-N? What command, tool, or probe?" |
| **Features** | "What feature units would you split this into?" / "What can run in parallel? What blocks the critical path?" |

### Step 4 — Ask questions one at a time

Each question is a single Output → wait for user answer → write the answer back into the ISA section (preserving prior content; appending or replacing as appropriate).

Use plain text, no fancy formatting — this is conversation, not a form. Lead with the most foundational question first.

### Step 5 — Write back to ISA after each answer

After every user response, immediately Edit the ISA file. The user should feel the document filling up as they answer.

### Step 6 — Stop conditions

End the interview when any of:
- All required sections per tier are populated to non-thin depth.
- `max_questions` reached.
- User says "that's enough" / "skip the rest" / "done."
- The user's answers stop adding signal (two answers in a row are "I don't know" or "skip").

### Step 7 — Final CheckCompleteness pass

Run `Workflows/CheckCompleteness.md` after the interview. Surface any remaining gaps but do not block — the user can iterate later.

## Tone

- Conversational, not formal. No "Question 1 of 8."
- One question per turn. Never batch.
- Use the user's own words from earlier answers when framing later questions.
- If the user is rushed, drop to E2/E3 required sections only and flag the rest as "fill in later."

## Failure modes

- **User abandons mid-interview:** the partial population is still valuable. Save what you have, leave a Decisions entry: "interview paused at <section> — N questions answered, M skipped."
- **User answers contradict the existing ISA:** treat new answers as the canonical source. Log the contradiction in Decisions with a `refined:` prefix.
- **User answers are aspirational rather than concrete:** push gently — "what would a test that proves that look like?" If the user can't articulate, the ISC is not yet hard-to-vary; flag in Decisions.
