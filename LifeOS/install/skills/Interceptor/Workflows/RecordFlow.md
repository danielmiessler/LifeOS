# RecordFlow Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the RecordFlow workflow in the Interceptor skill to record a user flow"}' \
  > /dev/null 2>&1 &
```

Running **RecordFlow** in **Interceptor**...

---

Record a user workflow by capturing browser actions into a replayable script. Uses Interceptor's monitor system to observe clicks, typing, navigation, and network requests, then exports a replay plan using semantic selectors.

## Preflight Isolation Gate (MANDATORY first step)

```bash
source "${LIFEOS_DIR}/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/PreflightIsolation.sh"
```

Non-zero exit → STOP and surface the message verbatim. Do not fall back to the Default profile. Recording in the operator's main profile would capture their real session events and credentials — record only in the pinned isolated context. Every `interceptor` verb below passes `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` (from `preferences.env`).

## When to Use

- Capturing a critical user flow for regression testing (signup, payment, onboarding)
- Creating a repeatable QA check from a manual walkthrough
- Building a baseline for API contract verification (which endpoints fire during a flow)
- Documenting a complex multi-step interaction for future replay

## Steps

### 1. Navigate to the Starting Page

```bash
interceptor open "<START_URL>" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

Confirm you're on the correct starting page before recording.

### 2. Start Recording

```bash
interceptor monitor start --instruction "<FLOW_DESCRIPTION>" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

The instruction is stored with the session and appears in exports. Be specific: "Signup flow from landing page through onboarding" is better than "signup test".

### 3. Walk Through the Flow

Execute the flow manually using interceptor commands:

```bash
interceptor act e5 --context "$INTERCEPTOR_TEST_CONTEXT_ID"                    # Click a button
interceptor act e12 "user@example.com" --context "$INTERCEPTOR_TEST_CONTEXT_ID"  # Type into a field
interceptor act e8 --keys "Enter" --context "$INTERCEPTOR_TEST_CONTEXT_ID"     # Press Enter
```

Or walk through the flow manually in Chrome — the monitor captures real user actions too (clicks, typing, scrolling, form submissions).

The monitor records:
- Every click, double-click, right-click (with element ref, role, and accessible name)
- Every input/change event (with values — passwords are auto-masked)
- Keyboard shortcuts (Enter, Tab, Escape, arrows)
- Form submissions
- Network requests correlated to the user action that triggered them
- DOM mutations caused by each action

### 4. Stop Recording

```bash
interceptor monitor stop --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

Returns a session summary with event counts (events, mutations, network requests, duration).

### 5. Export the Replay Plan

```bash
interceptor monitor list --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

Find the session ID from the list, then:

```bash
interceptor monitor export <SESSION_ID> --plan --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

This generates a replayable script using semantic selectors (`role:name` format) that survive DOM changes better than ref IDs. The script includes `wait-stable` commands between actions that trigger DOM mutations.

To include network verification cues:

```bash
interceptor monitor export <SESSION_ID> --plan --with-bodies --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

### 6. Save the Plan

Save the exported plan to `skills/Interceptor/Flows/<flow-name>.sh` for future replay via the ReplayFlow workflow. (The `Flows/` directory currently holds only a README — recorded plans are the first artifacts you add there.)

### 7. Review the Plan

Read the generated script. Check for:
- `# TODO` comments where password fields were masked — these need manual value substitution
- `# ref eN (no accessible name)` fallbacks — these may be fragile; consider adding accessible names to the UI
- Commented network cues showing which API calls each action triggered

## Notes

- The monitor records from Chrome's content script — it sees real user events, not just interceptor-injected ones.
- Password and credit card fields are automatically masked in recordings (`***N***` format).
- Recordings are stored in JSONL format at the interceptor events path. Use `interceptor monitor export <sid> --json` for raw data.
- Session recordings persist across interceptor restarts but are per-machine (not synced).
- For live observation during recording: `interceptor monitor tail` streams events in real time.
