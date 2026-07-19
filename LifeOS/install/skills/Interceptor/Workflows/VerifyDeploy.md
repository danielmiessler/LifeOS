# VerifyDeploy Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the VerifyDeploy workflow in the Interceptor skill to verify a deployment"}' \
  > /dev/null 2>&1 &
```

Running **VerifyDeploy** in **Interceptor**...

---

Verify a deployment by opening the target URL in real Chrome and capturing a **four-probe evidence bundle**: DOM read, console errors, network failures, screenshot. Works with both authenticated and public pages since Interceptor uses your real browser sessions.

**The bundle is conjunctive.** All four probes run on every deploy verification — they are one piece of evidence, not alternatives. A screenshot alone is NOT full verification: pixels cannot show a hydration mismatch, a silent JS exception, or a 404 on a lazy-loaded chunk. Conversely, clean logs alone are not verification either — the page still has to render. Four probes, one bundle, every time. Bonus: the three non-visual probes use independent WebSocket message types, so a screenshot wedge no longer blocks verification evidence.

## When to Use

- After deploying any web project
- When the Algorithm's Verification Doctrine Rule 1 requires live-probe evidence
- After CSS/layout/content changes that need visual confirmation
- When agent-browser can't reach the page (auth wall, bot detection)

## Steps

### 0. Preflight Isolation Gate (MANDATORY first step)

```bash
source "${LIFEOS_DIR}/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/EnsureTestProfile.sh"
```

`EnsureTestProfile.sh` runs the isolation gate AND auto-recovers: if the test profile window just isn't open (exit 5/6) it launches the configured profile, polls until the pinned context connects, and prints `READY`. It only ever succeeds after the gate passes (pinned-UUID match + Default-deny), so a wrong launch can never be driven. Non-zero exit → STOP and surface the message verbatim; do not fall back to the Default profile. (Call `PreflightIsolation.sh` directly when you explicitly want the gate with NO auto-launch.) `INTERCEPTOR_TEST_CONTEXT_ID` is the pinned isolated context; every browser verb below passes it. Screenshots go through `Tools/Capture.sh`, never raw `interceptor screenshot`.

### 1. Open the Target URL (in the isolated profile)

```bash
interceptor open "<DEPLOY_URL>" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

Navigates, waits for DOM stability, returns the element tree + visible text in one call. `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` scopes the action to the pinned, isolated test window so the operator's main Chrome stays untouched. Never the literal `interceptor-test` — that friendly name does not resolve on this machine until set in the extension popup; the pinned UUID lives in `preferences.env`.

For pages that load slowly (heavy SPAs, SSR hydration):

```bash
interceptor open "<DEPLOY_URL>" --context "$INTERCEPTOR_TEST_CONTEXT_ID" --timeout 10000
```

If the page **requires the operator's signed-in session** (verification of their own authenticated tooling), say so explicitly and route to their main profile via `--context <main-id>` after confirming with `interceptor contexts` — never silently.

### 2. Probe A — DOM read (content check)

```bash
interceptor read --markdown --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

Confirm the deployed content is actually present: the heading/copy/component you shipped, no error banners, no blank content areas that should have content, no "404"/"500"/"not found" in visible text.

### 3. Probe B — console errors (inject, act, read back)

There is no pre-installed error collector — you must inject one, then capture FORWARD. (`window.__interceptor_errors` does not exist unless you install it; reading it cold always returns `[]` and proves nothing.)

```bash
# 3a. Install the collector (after the page is loaded)
interceptor eval "window.__errs=[];window.addEventListener('error',e=>window.__errs.push({m:e.message,s:(e.error&&e.error.stack||'').slice(0,300)}));window.addEventListener('unhandledrejection',e=>window.__errs.push({m:String(e.reason).slice(0,300)}));(function(o){console.error=function(){window.__errs.push({c:[...arguments].map(String).join(' ').slice(0,300)});return o.apply(console,arguments)}})(console.error);'installed'" --main --context "$INTERCEPTOR_TEST_CONTEXT_ID"

# 3b. Exercise the page — click the main nav, trigger the changed feature, or wait for lazy loads
interceptor wait-stable --context "$INTERCEPTOR_TEST_CONTEXT_ID"

# 3c. Read back
interceptor eval "JSON.stringify(window.__errs||[])" --main --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

**Gotcha:** a reload wipes the collector AND the errors. Never verify by installing-then-reloading — install after load and capture forward from the next action. Errors that fired during initial load are catchable only via Probe A symptoms (blank areas) and Probe C (failed requests). Installing the collector on `about:blank` first and then navigating is NOT supported — accept the forward-capture boundary and lean on the other probes for load-time failures.

**Noise rule:** pre-existing third-party noise (ad blockers, extensions, known benign warnings) is reported but does not fail verification; errors originating from YOUR origin's scripts do.

### 4. Probe C — network failures

```bash
interceptor net log --context "$INTERCEPTOR_TEST_CONTEXT_ID" --limit 100
```

Fail on:
- 404s on same-origin JS/CSS chunks (missing build artifacts)
- 4xx/5xx on same-origin API endpoints
- CORS errors on resources you control

Third-party 4xx (trackers, ads) is noted, not failing.

### 5. Probe D — screenshot

```bash
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/Capture.sh" "<DEPLOY_URL>"
# long pages:
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/Capture.sh" "<DEPLOY_URL>" --full
```

`Capture.sh` re-runs the isolation gate, routes to the pinned context, prefers the DOM-render path (no foreground needed), and prints the absolute saved-image path on its only stdout line. Read that image to visually confirm rendering. Never call raw `interceptor screenshot` here — it loses the deny-Default guard and CWD-destination handling.

**Flow-gallery (optional, for multi-step flows).** One end-state screenshot proves the last page rendered, not the three screens before it — a broken state mid-flow (a failed validation, an empty intermediate step, a wrong redirect) never gets seen. For a multi-step flow (signup, checkout, vote, onboarding), capture an ORDERED gallery instead: `Capture.sh` at each step, keeping the shots in order with a step label (`01-landing`, `02-form-filled`, `03-confirm`, …). Read them in sequence and confirm every state, not just the end. This extends Probe D; it does not replace probes A–C. For bugs that only exist in *motion* (animation, transition, flicker), use `ScrubFlow` instead — a gallery of stills still can't see a stutter.

### 6. Report — the evidence bundle

Full verification = ALL FOUR probes captured and clean (with the noise rules above). Mark the ISC `[x]` citing the bundle: DOM content confirmed + console clean (or noise-only) + network clean (or noise-only) + screenshot path.

- Screenshot wedged after one auto-heal retry? The other three probes still run — report them, mark the visual portion `[DEFERRED-VERIFY]`, and surface the wedge. Do NOT skip A–C because D failed.
- Any probe shows a real failure: report the specific evidence (console, network, visual) before attempting fixes. Do NOT theorize from code — the browser evidence is primary.

## Notes

- For authenticated pages, Interceptor uses your real Chrome login sessions. No profile setup needed.
- For public pages where speed matters and auth isn't needed, WebFetch (or the BrightData ladder) is fine.
- Always use `http://localhost:PORT` instead of `localhost:PORT` for local dev URLs.
- If Chrome is not running, start it first. Interceptor requires an active Chrome instance with the extension loaded.
