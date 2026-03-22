# Monitor — Session Health Workflow

This document describes how the SessionHealth watchdog operates. The hook runs automatically — this workflow is for understanding and customizing its behavior.

## How It Works

### On Every User Prompt

1. **Read session start time** from `/tmp/pai-session-start.txt`
   - File contains a Unix timestamp in milliseconds
   - Written by your session-start hook/script
   - If missing, session age defaults to 0 (turn counting still works)

2. **Increment turn counter** in `/tmp/pai-session-turns.json`
   - Keyed by session ID — resets when a new session starts
   - Persists across prompts within the same session

3. **Evaluate thresholds** against both metrics:
   - Session age vs. `AGE_WARN_HOURS` (8h) and `AGE_HARD_WARN_HOURS` (12h)
   - Turn count vs. `TURN_WARN` (500) and `TURN_HARD_WARN` (800)

4. **Generate output** based on threshold state:
   - **Below all thresholds:** No output. Every 100 turns, log status to stderr.
   - **Warning threshold:** Inject yellow warning into AI context via `<system-reminder>`.
   - **Critical threshold:** Inject red warning with explicit instruction for AI to advise session closure.

### Warning Escalation

Warnings are graduated, not binary:

| Level | Color | Message Tone | AI Behavior Expected |
|-------|-------|-------------|---------------------|
| Healthy | None | Silent | Normal operation |
| Warning | Yellow | Advisory | Mention to user when natural, suggest wrapping up |
| Critical | Red | Urgent | Actively recommend closing session. Reference degradation risk. |

### What the AI Should Do When Warnings Fire

**On yellow warning:**
- Acknowledge the warning naturally (don't alarm the user)
- Suggest wrapping up current thread before starting new ones
- Mention that a fresh session would be beneficial for complex work

**On red critical:**
- Tell the user directly: "This session is [X] hours old. We should close it and start fresh."
- Do not start new complex work
- If LandingProcedure is installed, suggest running it
- Prioritize saving state over continuing work

## Dependencies

- **Session start timestamp:** Something must write `/tmp/pai-session-start.txt` at session start. Without it, age tracking is disabled but turn counting still works.
- **Bun runtime:** The hook is TypeScript executed by bun.

## Error Handling

All errors are caught and logged to stderr. The hook always exits 0. It will never:
- Block a user prompt
- Crash the session
- Produce visible errors to the user

If the session start file is missing or corrupt, the hook silently skips age tracking. If the turn counter file is corrupt, it resets to 0.

## Customization

To change thresholds, edit the constants in `SessionHealthCheck.hook.ts`. Common adjustments:

- **Short-session workers:** Lower `AGE_WARN_HOURS` to 4, `AGE_HARD_WARN_HOURS` to 8
- **Marathon workers:** Raise `AGE_WARN_HOURS` to 10, `AGE_HARD_WARN_HOURS` to 16
- **High-turn workflows:** Raise `TURN_WARN` to 800, `TURN_HARD_WARN` to 1200
- **Low-turn but long sessions:** Lower `TURN_WARN` to 200 for early warnings on drift
