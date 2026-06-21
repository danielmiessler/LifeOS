# RecordFlow Workflow

---

Record a user workflow by capturing browser actions into a replayable script. Uses Interceptor's monitor system to observe clicks, typing, navigation, and network requests, then exports a replay plan using semantic selectors.

## When to Use

- Capturing a critical user flow for regression testing (signup, payment, onboarding)
- Creating a repeatable QA check from a manual walkthrough
- Building a baseline for API contract verification (which endpoints fire during a flow)
- Documenting a complex multi-step interaction for future replay

## Steps

### 1. Navigate to the Starting Page

```bash
interceptor open "<START_URL>"
```

Confirm you're on the correct starting page before recording.

### 2. Start Recording

```bash
interceptor monitor start --instruction "<FLOW_DESCRIPTION>"
```

The instruction is stored with the session and appears in exports. Be specific: "Signup flow from landing page through onboarding" is better than "signup test".

### 3. Walk Through the Flow

Execute the flow manually using interceptor commands:

```bash
interceptor act e5                    # Click a button
interceptor act e12 "user@example.com"  # Type into a field
interceptor act e8 --keys "Enter"     # Press Enter
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
interceptor monitor stop
```

Returns a session summary with event counts (events, mutations, network requests, duration).

### 5. Export the Replay Plan

```bash
interceptor monitor list
```

Find the session ID from the list, then:

```bash
interceptor monitor export <SESSION_ID> --plan
```

This generates a replayable script using semantic selectors (`role:name` format) that survive DOM changes better than ref IDs. The script includes `wait-stable` commands between actions that trigger DOM mutations.

To include network verification cues:

```bash
interceptor monitor export <SESSION_ID> --plan --with-bodies
```

### 6. Save the Plan

Save the exported plan to `skills/Interceptor/Flows/<flow-name>.sh` for future replay via the ReplayFlow workflow.

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
