# Land — Flow Exit Workflow

When the user signals exit, run this workflow. Do not skip sections. Do not add new threads.

## Pre-Check

Determine the user's state:
- If they said "flat," "discharged," or similar depletion language: go to **Minimal Landing** below.
- Otherwise: run the **Full Checklist**.

---

## Full Checklist

### 1. FIRES
Check for anything time-sensitive that can't wait:
- Any meetings in the next 2 hours?
- Any unanswered messages that need a response today?
- Any deadlines today?
- Any sends the user promised that haven't gone out?

If nothing: report "None."

### 2. OPEN THREADS
List every thread that was active this session:
- Mark each as: **paused**, **blocked** (waiting on someone), or **done**
- Note external dependencies (who/what is it waiting on)

### 3. SESSION STATE
- Save session highlights to memory/handoff if the session produced insights worth keeping
- Note any breadcrumbs or half-formed ideas worth capturing
- Note session duration and intensity level

### 4. TIME-SENSITIVE
- Check for commitments the user made (RSVPs, approvals, replies)
- Flag anything that will expire or escalate before the next session
- Day-of-week reminders (e.g., Friday timecards, Monday standups)

### 5. LANDING CONFIRMATION
- Tell the user it's OK to stop
- Do NOT add new threads
- Do NOT ask questions that re-engage cognitive load
- Keep it short

---

## Minimal Landing

For users who are post-flow depleted ("flat," "discharged"):

- One line confirming session is saved
- One line on urgent items (or "nothing urgent")
- "Clear to land."

Nothing else. They don't have the bandwidth to process more.

---

## Output Format

Present as a compact checklist. The user is already exiting. Don't make them read a document.

```
LANDING CHECKLIST
=================
FIRES: [one line summary or "None"]
OPEN: [count] threads paused, [count] done, [count] waiting on [who].
SAVES: [what was captured]
DO BEFORE NEXT SESSION: [action items, if any]

Clear to land.
```

---

## Rules

- Never re-engage with "one more thing" or "while you're here."
- The landing procedure exists to release, not to capture.
- If the user seems reluctant to stop, don't encourage them to keep going. Support the exit.
- Save the handoff state so the next session can pick up cleanly.
