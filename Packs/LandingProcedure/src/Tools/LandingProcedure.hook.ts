#!/usr/bin/env bun

/**
 * LandingProcedure — Safe exit from flow states
 *
 * Triggered when Rob says "stepping away", "landing", "I'm done",
 * "shutting down", "taking a break", or similar exit signals.
 *
 * This is NOT a hook that fires automatically. It's invoked by the AI
 * when it detects flow-exit language. The AI runs the checklist inline.
 *
 * Usage: The AI reads this file and executes the checklist as output.
 */

/*
LANDING PROCEDURE — Flow Exit Checklist

When Rob signals exit ("stepping away", "I'm done", "landing", "taking a break",
"need to stop", "that's enough", "I'm flat"), run this checklist BEFORE he leaves:

━━━ LANDING CHECKLIST ━━━

1. FIRES
   - Any meetings in the next 2 hours? (Check if calendar access available)
   - Any unanswered messages that need a response today?
   - Any deadlines today? (Friday = timecard in Dynamics)
   - Any sends Rob promised that haven't gone out?

2. OPEN THREADS
   - List every thread that was active this session
   - Mark which ones are paused vs blocked vs done
   - Note which ones have external dependencies (waiting on someone)

3. SESSION STATE
   - Save session highlights to memory if session produced insights worth keeping
   - Update flinch log if any new flinches emerged
   - Note session duration and intensity level

4. TIME-SENSITIVE
   - Friday = timecard reminder (always)
   - Check for RSVPs, approvals, or replies Rob committed to
   - Flag anything that will expire or escalate if not handled before next session

5. LANDING CONFIRMATION
   - Tell Rob it's ok to stop
   - Don't add new threads
   - Don't ask questions that re-engage cognitive load
   - Keep it short

━━━ FORMAT ━━━

Present as a compact checklist, not a wall of text.
Rob is already exiting. Don't make him read a document.

Example output:

  LANDING CHECKLIST
  =================
  FIRES: None. Calendar clear next 2hrs. Timecard not done (Friday).
  OPEN: 4 threads paused, 2 done, 1 waiting on Josh.
  SAVES: Session highlights captured. Flinch log updated.
  DO BEFORE NEXT SESSION: Timecard. Reply to RockSalt.

  Clear to land.

━━━ RULES ━━━

- If Rob says "flat" or "discharged" — he's post-flow. Minimal output only.
- If Rob says "pineapplepony" — this is NOT a landing procedure. That's the
  overwhelm protocol. Drop everything and help him land emotionally first.
- Never re-engage with "one more thing" or "while you're here."
- The landing procedure exists to release, not to capture.
*/
