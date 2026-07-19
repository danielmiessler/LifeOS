# OverrideXhr

You are mutating an HTTP request before it hits the server, or rewriting a response before the page sees it. Use this when:
- The page does the right thing, but you need to test what happens when the API returns 500 / 404 / slow.
- You need to change request parameters without rebuilding the UI.
- You need to inject test data the backend can't produce.

## Preflight Isolation Gate (MANDATORY first step)

```bash
source "${LIFEOS_DIR}/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/PreflightIsolation.sh"
```

Non-zero exit → STOP and surface the message verbatim. Do not fall back to the Default profile. This workflow mutates live network traffic; a wrong-profile run would rewrite requests in the operator's real session. Every `interceptor` verb below passes `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` (the pinned isolated context from `preferences.env`). **Mandatory cleanup:** install a cleanup so overrides are always cleared, even if a step fails:

```bash
trap 'interceptor override clear --context "$INTERCEPTOR_TEST_CONTEXT_ID" 2>/dev/null' EXIT
```

Overrides persist across `open` calls and survive a crashed run — an uncleared override silently mutates the next session's traffic. The trap is the backstop for the explicit `override clear` step.

## Command Budget

**5 commands.**

1. `interceptor net log --filter <pattern> --context "$INTERCEPTOR_TEST_CONTEXT_ID"` — observe real traffic first; don't override blind
2. `interceptor override "<pattern>" status=... --context "$INTERCEPTOR_TEST_CONTEXT_ID"` — install
3. Trigger the request (`act`, `click`, `type`, `navigate` — each with `--context "$INTERCEPTOR_TEST_CONTEXT_ID"`)
4. `interceptor net log --filter <pattern> --since 30s --context "$INTERCEPTOR_TEST_CONTEXT_ID"` — verify the override fired (NOT a fresh `read` — response data lives in the network log)
5. `interceptor override clear --context "$INTERCEPTOR_TEST_CONTEXT_ID"` — always clear; overrides persist across `open` calls

If verification at step 4 shows the override didn't fire, refine the pattern and retry 2-4 once. Don't reach for a fresh `read` to "check the page" before confirming the network override fired.

## Steps

1. **Open the page.**
   ```bash
   interceptor open <url> --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   ```

2. **Observe real traffic first.**
   ```bash
   interceptor net log --filter <pattern> --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   interceptor net headers --filter <pattern> --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   ```
   Pick a unique substring of the URL — that's your override key.

3. **Install the override.**
   ```bash
   interceptor override "*api/search*" status=500 --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   interceptor override "*api/search*" delay=1000 --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   interceptor override "*api/search*" status=200 body='{"results":[]}' --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   interceptor override "*api/items*" params=count:5 --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   ```

4. **Trigger the request** — click, type, navigate, whatever causes the page to make the call (each verb with `--context "$INTERCEPTOR_TEST_CONTEXT_ID"`).

5. **Verify.**
   ```bash
   interceptor net log --filter <pattern> --since 30s --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   ```
   The response should match what you forced. If not, your pattern probably missed.

6. **Clear (always — the EXIT trap above is the backstop, this is the explicit step).**
   ```bash
   interceptor override clear --context "$INTERCEPTOR_TEST_CONTEXT_ID"
   ```

## When to use CDP `network` instead

`interceptor override` uses the extension's declarativeNetRequest path — no debugger banner, no DevTools fingerprint. Reach for `interceptor network on` + `interceptor network override` (each with `--context "$INTERCEPTOR_TEST_CONTEXT_ID"`) only when:
- You need request-body rewriting (extension overrides are URL/header-only for some sites).
- You need WebSocket frame inspection (passive `net` doesn't capture WS — see canvas-rendered notes for the MAIN-world WS patch).
- You need to observe raw bytes pre-decode.

CDP attach shows a "DevTools is debugging this tab" banner. Pages that watch for it will behave differently. Default to extension overrides.

## Network exports (0.16.9)

For debrief / regression testing, export the captured traffic:

```bash
interceptor net export --format har --context "$INTERCEPTOR_TEST_CONTEXT_ID"                  # HAR 1.2 (any HAR viewer / DevTools import)
interceptor net export --format pcapng --context "$INTERCEPTOR_TEST_CONTEXT_ID"               # pcapng for Wireshark
interceptor net export --format json --out trace.json --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

## Pitfalls

- **Pattern too broad.** `*` alone overrides everything including extension traffic — pages can hang. Use a substring that uniquely identifies the request.
- **Forgetting `override clear`.** Override rules survive across `open` calls until explicitly cleared. A test that "passed last run" may be reading a stale override.
- **Override + cache.** Browsers cache. If you override `GET /api/foo` but the page reads from a `Cache-Control: max-age` response, the override doesn't fire. Reload with `?cb=<timestamp>` or use `interceptor navigate`.

## Output format

Report:
- The override key (URL pattern + what was changed)
- Observed response after triggering
- Whether the page's behavior matched expectations
- Whether `override clear` was called
