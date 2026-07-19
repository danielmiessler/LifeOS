---
name: Interceptor
description: "Real Chrome/Brave + macOS Computer Use from inside the browser — zero CDP fingerprint, real sessions; mandatory for visual deploy verification. Drive clickwork yourself. USE WHEN verify deploy, confirm UI, screenshot verification, computer use, macos automation, debug web, troubleshoot, visual check, motion/animation bug, jank, transition stutter, scrub a flow, console logs/errors, runtime/JS/react errors, mismatch warning, network traffic/log, HAR/pcapng export, hydration/blank-page debug, flash then blank/page broken, why is this not working/what's happening on the page, authenticated page, bot detection bypass, reproduce bug, drive native app, about to ask the operator to click/navigate/fill a form/log in/approve OAuth, OAuth consent flow, complete a web login, do this in your browser. NOT FOR residential-proxy crawling (BrightData) or social actor scraping (Apify)."
version: 4.3.2
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Interceptor/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Interceptor skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Interceptor** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Interceptor — Real-Browser Automation + macOS Computer Use

> **First rule, above everything else: if you catch yourself about to ask the operator to do something in a browser — open a URL, click, fill a form, log in, paste a value, approve an OAuth/consent page — that urge IS the trigger to use Interceptor. Drive it yourself. The only exception is a step that needs a secret you genuinely don't hold (an unknown password, a hardware 2FA tap); even then, drive the flow up to that exact point, then surface only the one human-only action. Narrating clickwork a human has to perform is the precise failure this skill exists to prevent.**

## What It Does

Interceptor drives the real Chrome/Brave browser from inside it, and drives native macOS apps when the bridge is installed. Six capability classes, each its own verb tree: visual capture, DOM read, JS eval, network capture, input, and record/replay. It stays logged into your real sessions, passes every major bot-detection check, and is the mandatory tool for visual deploy verification.

## The Problem

Headless browser tools speak CDP, which sites can fingerprint and block — so the automated browser sees a different page than a logged-in human does, or gets blocked outright. They also run as a separate browser instance with no auth, so they can't reach anything you're signed into. And when a page breaks — a blank screen after mount, a hydration mismatch, cards that flash and vanish — a screenshot tells you nothing about why. Interceptor solves all three: it operates through the actual browser UI (zero CDP fingerprint), uses your real signed-in sessions, and reads the live DOM, console errors, and network traffic to explain failures a screenshot can't.

## How It Works

Interceptor is a Chrome extension that operates through the actual browser UI plus an optional macOS bridge that extends the same control surface to native apps, OS-level input, and on-device VMs.

**Tool:** `interceptor` CLI — Chrome/Brave extension that controls the real browser from inside, plus a macOS bridge that drives native apps, OS-level input, and full VM lifecycle.
**Repo:** https://github.com/Hacker-Valley-Media/Interceptor
**Install:** `~/Projects/interceptor` (built from source — see `Workflows/Update.md`)
**Chrome "Load unpacked" target:** `$LIFEOS_ROOT/skills/Interceptor/Extension/` — a **pinned copy** (not a symlink) of upstream `extension/dist`, captured by `Tools/Pin.sh`; provenance recorded in `Extension/PINNED_FROM.txt` (source path, manifest version, content SHA256, timestamp). Chrome disables unpacked extensions on every manifest bump, so after any binary upgrade the copy must be **re-pinned and reloaded**. It does NOT auto-follow upstream.
**Pinned binary:** `0.22.2` — `interceptor --version` reports `0.22.2 (580a7de, 2026-07-04)`. Upstream is now a **three-surface** control plane: **Browser** + **macOS** + **iOS** (drive an owned, Developer-Mode iPhone via an on-device XCUITest runner over WiFi — `interceptor ios *`).

### Capabilities Overview — Six Verb Trees

Each row is an independent capability class. Each one uses a different WebSocket message type at the daemon→extension boundary, so a wedge on one rarely affects the others. **When debugging a broken page, every row is a separate diagnostic path — never bail on Interceptor because `screenshot` hangs without trying `eval`, `net log`, or `monitor` first.**

| Verb tree | Top-level verbs | What you get |
|-----------|-----------------|--------------|
| **VISUAL** | `screenshot` (DOM-render default — works backgrounded), `screenshot --region`, `screenshot --pixel --full` (window must be visible) | PNG/WebP at any size, selector, region, or scroll-and-stitch full page. Route through `Tools/Capture.sh`, never raw `interceptor screenshot`. |
| **DOM READ** | `read [--markdown]`, `tree`, `text`, `html <ref>`, `find` | Accessibility tree, structured markdown, raw markup, refs |
| **JS EVAL** | `eval <code>`, `eval --main` | Run JavaScript in isolated or main world — **the way you read console errors, runtime exceptions, hydration warnings, and DOM state at runtime** |
| **NETWORK** | `net log`, `net headers`, `net export --format har\|pcapng\|json`, `override`, `headers add/remove` | Passive request capture with zero CDP fingerprint; HAR 1.2 + pcapng for Wireshark |
| **INPUT** | `click`, `type`, `keys`, `act <ref> [--trusted]`, `drag`, `scroll`, `select`, `focus` | Browser + native macOS input; `--trusted` for OS-level HID source state |
| **RECORD/REPLAY** | `monitor start/stop`, `monitor export --plan`, `monitor export --format har` | Real user-flow capture as deterministic replay scripts; multi-session, browser + macOS AX events |

**Reading console errors** is a recipe, not a separate verb: inject a `console.error` / `window.error` listener via `eval --main`, store events on `window.__errs`, then `eval` again to read them back. Useful for hydration mismatches, React error boundaries, JS exceptions on load, and any silent runtime failure. **Triggering a reload between install and read loses the captured errors** — capture happens after load, so reproduce-by-reload doesn't help; instead capture forward from the next user action, or poll `getEventListeners(window)` / DOM mutation observers for evidence of failure.

**Why this matters in practice.** Hydration failures on Astro pages, blank-page after React mount, "cards flash and disappear" — all of these surface through `eval` reading the live DOM state and console captures, not through screenshots. A `screenshot` wedge does not block diagnosis; the page is still inspectable through every other verb tree.

### New surfaces & verbs (0.17 → 0.22.2)

The six browser verb trees above are still the core. What the jump from 0.16.9 added:

- **iOS** (`interceptor ios *`) — drive an owned, unlocked, Developer-Mode iPhone over WiFi via an on-device XCUITest runner (not WebDriverAgent). Verbs: `tree`, `find`, `click`, `type`, `scroll`, `screenshot`, `app launch|activate|terminate`. Setup is Xcode self-service or a no-Xcode `login` that re-signs the runner with your Apple ID.
- **`interceptor diagnose`** — one post-failure snapshot: daemon (with its real exec path), every connected context probed in parallel, monitor state. **Catches the daemon split-brain** — Chrome spawns one daemon binary while the CLI talks to another, previously a silent 15s timeout. Run it first when anything acts wedged.
- **`interceptor manifest`** — machine-readable specs for 50+ verbs (usage, flags, returns semantics). Discover the contract without scraping help text.
- **Per-agent tab groups** (`--group <label>` / `INTERCEPTOR_GROUP`) — pen each agent into its own colored, hard-isolated tab group so several agents share one browser with no cross-bleed. `interceptor group list|close <label>`. A second isolation layer alongside `--context`.
- **`interceptor save`** — pull raw bytes (Blob / ArrayBuffer / `blob:`) straight off a live page to disk without a downloads folder; returns a sha256.
- **`interceptor ocr`** / **`canvas ocr`** — offline Tesseract pixel OCR, bundled into the extension (no bridge, no macOS needed).
- **`interceptor macos cdp *`** — drive the web contents of Electron / Chromium desktop apps (Slack, VS Code, Notion, Descript) the same way as a browser tab.

**CLI contract (0.22.1):** arguments are now order-independent (`open --text-only <url>` parses correctly), and browser-only installs hide the macOS/iOS verbs (`--all-surfaces` / `INTERCEPTOR_ALL_SURFACES` overrides). Bare `interceptor` / `--help` print a concise capability card; use `help <cmd>` or `interceptor manifest` for the full contract.

### Why Interceptor?

CDP-based browser automation gets detected by sites. Interceptor is a Chrome extension that operates through the actual browser UI. No debugger, no automation flags, no separate browser instance. You stay logged in, you pass bot detection, the agent sees what you see. The optional macOS bridge extends the same control surface to native applications, OS-level input, and on-device VMs — that combination is what "Computer Use" means in this skill.

### Hard Prohibitions — Operative on Every Invocation

**Visual verification goes through Interceptor only. The following are FORBIDDEN with zero exceptions:**

- **`screencapture`** — the raw macOS screenshot binary. Not as a primary tool, not as a fallback when Interceptor wedges, not "just for one screenshot." Forbidden.
- **`osascript` for Chrome control** — no `tell application "Google Chrome" to activate`, no `set frontmost of process`, no `set bounds of window`, no `set active tab index`, no `set index of window`, no other window-state mutation. Forbidden.
- **`osascript` System Events keystrokes** — no `key code`, no `keystroke`, no `key down`. These send input to whatever is focused, which steals from the operator. Forbidden.
- **Any focus pull in service of automation** — bringing Chrome (or any app) to the front so a screenshot will land is forbidden. The bridge's CGS / DOM-render paths capture without focus change.
- **Any window-state mutation** — moving, resizing, repositioning, or reordering Chrome windows is forbidden. The operator owns their window arrangement; the agent never touches it.
- **AppleScript-driven tab switching** — `set active tab index of window N` is doubly forbidden: it both pulls focus and changes which tab the operator is looking at.

**These rules survive Interceptor failures.** A wedged Interceptor is NOT a license to use raw OS tools. When Interceptor cannot deliver evidence, the recovery is to fix Interceptor (see WebSocket-wedge gotcha below) or to STOP and tell the operator the verification cannot be captured this run — never to fall back.

**Bridge-routed Computer Use is separate.** `interceptor macos open <app>`, `interceptor macos act <ref>`, `interceptor act <ref> --trusted` (formerly `--os`) and other bridge-routed actions go through the sanctioned bridge surface and are allowed when a workflow explicitly requires native app control. The prohibition above is on (a) raw OS-level paths that bypass Interceptor entirely AND (b) focus-pulling purely in service of a screenshot.

### Preflight Isolation Gate (MANDATORY)

**Every browser workflow's first step. No exceptions.**

Before any `interceptor open|read|act|inspect|screenshot|navigate|tab|monitor|net|cookies|scroll|click|type` lands in Chrome, the workflow runs the gate. Prefer the **auto-recovering entry point** — it runs the gate and, if the test profile window just isn't open, launches it and re-verifies before returning:

```bash
bash $LIFEOS_ROOT/skills/Interceptor/Tools/EnsureTestProfile.sh   # runs the gate; auto-launches the test profile on exit 5/6; prints READY on success
```

`EnsureTestProfile.sh` wraps `PreflightIsolation.sh` (the raw gate — still callable directly when you want no auto-launch). Both exit non-zero on any unrecoverable failure; on non-zero, STOP and surface — never fall back to Default. The gate asserts these invariants:

1. **Binary version >= 0.16.0** — older builds silently ignore `--context` and fall back to whichever Chrome connection the daemon can find. That fallback is how a tab lands in the operator's Default window.
2. **The pinned test context is connected** — matched whole-field against the UUID column (not a substring grep, so a header or partial collision can't false-pass). Without it, the operator's Default profile is the only available target.
3. **Target is not Default.** The context the next command will hit is resolved and checked against Default and the `INTERCEPTOR_WORKING_PROFILE_IDS` deny-list before any tab is touched. A Default/working-profile match is a hard stop (exit 7).
4. **Extension freshness (graceful).** `Extension/PINNED_FROM.txt` (manifest version + content SHA256) is compared against the upstream `~/Projects/interceptor/extension/dist` **if present**. Mismatch → fail with re-pin remediation. Upstream absent (currently true) → WARN and continue. This does NOT key off `status --verbose` (that command exposes no extension-build field).

If any check fails, the script exits non-zero with a structured remediation message to stderr. **The workflow MUST STOP on a non-zero exit.** Surface the message. **Do not fall back to operating against the Default profile, ever.** Do not "try anyway." Do not use `screencapture` or `osascript` as a substitute.

Exit codes (for handlers that need to discriminate):
- `2` — interceptor binary not on PATH
- `3` — version string unparseable
- `4` — version below minimum (upgrade via `Workflows/Update.md`)
- `5` — no browser contexts connected (Chrome closed or extension dead)
- `6` — pinned test context missing (one-time profile setup needed)
- `7` — resolved target is Default or a working profile (hard stop)

The gate is doctrine. It runs unconditionally — for read-only public-page fetches, for authenticated tooling verification, for screenshot capture, for everything. There is no "safe to skip" case, because every silent fallback to Default is a violation of the operator's window.

### Isolation Doctrine (CRITICAL — hard rule, enforced in code)

**Every browser command runs against the pinned, isolated Interceptor test context — ALWAYS that context, NEVER the operator's Default profile, NEVER their working/monitoring profiles.** This is a constitutional rule, not a preference.

- **The target context is `INTERCEPTOR_TEST_CONTEXT_ID`** from `preferences.env`. The pinned value on this machine is the raw UUID `f439ca4c-e7f4-4940-a32b-ea54592844ab`. Durable fix: replace the raw UUID with the friendly name `interceptor-test` set in the extension popup — friendly names survive reloads; raw UUIDs rot on every extension reload (see UUID-rot below).
- **The isolation boundary is Chrome PROFILE, not user-data-dir.** The test profile lives inside the same Chrome installation as the operator's Default profile but with separate cookies, tabs, and window. It IS signed into the operator's accounts (Google, GitHub, Cloudflare, blog admin, other admin dashboards) — that's the whole point. A `--user-data-dir` sandbox would be useless because it has zero auth and can't reach any of the operator's signed-in tooling.
- **The operator's Default profile is read-only by default.** Never open a tab, click, type, navigate, or record in Default unless the operator explicitly says so ("verify in my Default profile", "use the main window"). When they do, route via `--context <default-id>` after `interceptor contexts` confirms the connection.
- **One-time setup lives in `Workflows/LaunchTestProfile.md`** — operator clicks Chrome's avatar menu → Add profile → signs in → loads the Interceptor extension → names the context in the popup.

**RETIRED behavior — never re-derive it.** The old "fall back to the first available / Default context when the pinned context isn't found" rule is DELETED. A missing or stale pinned context is a **hard stop with remediation**, never a fallback. There is no code path that auto-routes to Default.

**Why bare commands are unsafe.** With 2+ contexts connected the daemon hard-errors `multiple extensions connected, use --context <id>` — that fail-fast is the only thing protecting bare commands today. The moment the operator closes their other browser window (1 context left), a bare command silently auto-routes to whatever single context remains. So `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` (or routing through `Tools/Capture.sh`) is mandatory on every browser verb, not optional.

**UUID rot — durable fix.** Context IDs are profile-stable `chrome.storage.local` UUIDs that change ONLY on extension reinstall/reload (not on Chrome restart). The durable fix is to set the friendly name `interceptor-test` in the extension popup once and pin that name. Until then, `Tools/Capture.sh` performs a **guarded** auto-rebind — only when exactly one non-Default test context is connected AND Default is provably excluded. A stale pin NEVER falls through to Default.

**Why this is doctrine, not preference.** The operator's Default profile holds the tabs they're actively working in and the tabs their DA has been driving. The cost of one extra flag on every command is zero. The cost of one stray test tab in their working window — a click, an unexpected redirect — is permanent and disruptive.

**Auto-recovery is sanctioned for context-not-connected — via `EnsureTestProfile.sh`, never a bare launch.** When the test profile window simply isn't open (`PreflightIsolation.sh` exits 5 = no contexts, or 6 = pinned context not connected), `Tools/EnsureTestProfile.sh` launches the CONFIGURED test profile and re-runs the gate, polling until the pinned context connects. This is safe because of one invariant: **it only ever proceeds after `PreflightIsolation.sh` itself exits 0** — which whole-field-matches the connected context against `INTERCEPTOR_TEST_CONTEXT_ID` and hard-denies Default/working profiles. Launching the wrong `--profile-directory` therefore can never cause the agent to drive it; preflight would still fail and `EnsureTestProfile` would still stop. The safety lives in the post-launch re-verification loop, NOT in trusting the profile arg. **Exit 7 (resolved target IS Default/working) and exit 8 (test context unset) NEVER trigger a launch** — those surface and stop. And a *bare* `LaunchTestProfile.sh` with no re-verification is still unsafe on its own: always go through `EnsureTestProfile.sh`. If the launch succeeds but the pinned context never connects (UUID rot after an extension reload), `EnsureTestProfile` surfaces the one-time durable fix (name the context `interceptor-test` in the popup) and stops — it does not guess.

### Install Modes (0.16.x)

Two install modes, same CLI binary. Confirm with `interceptor status` and read the `mode:` line:

| Mode | What's installed | What unlocks |
|------|------------------|--------------|
| **`mode: full`** (default for this skill) | CLI + daemon + extension + Swift bridge `.app` + LaunchAgent | Browser automation **plus** Computer Use: AX tree, OS-level trusted input, ScreenCaptureKit, Vision OCR, Speech, NLP, Apple Events, OSLogStore, file watching, container runtime, **VM lifecycle** |
| **`mode: browser-only`** | CLI + daemon + extension | Browser automation only. `interceptor macos *` returns a structured `setup_required` error in under 1s. No TCC prompts. |

Promote a browser-only install with `interceptor upgrade --full`. Downgrade with `bash scripts/uninstall.sh --bridge-only`.

**Install channels** (pkg installers landed v0.11+):
- `Interceptor-Browser-<v>.pkg` → `mode: browser-only`
- `Interceptor-Full-<v>.pkg` → `mode: full`
- `bash scripts/install.sh --browser-only|--full` → dev path
- Linux browser-only supported (Microsoft Edge + Vivaldi also recognized as of v0.13.4)

Operating rule: if the user asks for native and `status` reports `mode: browser-only`, respond *"I'm on a browser-only install. Run `interceptor upgrade --full` to enable that."* Don't run the macos command anyway to see what happens — the preflight short-circuits, but it wastes turns.

### Prerequisites

- Chrome or Brave (or Edge/Vivaldi on supported platforms) running with the Interceptor extension loaded — load it once via `chrome://extensions/` → Developer Mode → "Load unpacked" → `$LIFEOS_ROOT/skills/Interceptor/Extension/`
- `interceptor` CLI in PATH (`/opt/homebrew/bin/interceptor`)
- `interceptor-daemon` in PATH (`/opt/homebrew/bin/interceptor-daemon`)
- Native messaging manifest registered (`bash ~/Projects/interceptor/scripts/install.sh --chrome --skip-extension`)
- **macOS bridge** as a LaunchAgent (full mode only) — see `Workflows/Update.md`
- **Sparkle.framework** at `/usr/local/Frameworks/Sparkle.framework` (full mode, v0.10.0+) — bridge depends on it for auto-update

Quick health check:

```bash
interceptor --version          # → "interceptor 0.22.2 (580a7de, 2026-07-04)"
interceptor status             # → daemon: running, bridge: running, mode: full|browser-only
interceptor status --verbose   # → adds extension reachability (NO extension-build field; with 2+ contexts it nags "multiple extensions connected" even with --context)
interceptor contexts           # → list of connected browser contexts (multi-profile)
interceptor init               # → one-time write of ~/.config/interceptor/config.toml
```

### Background-First Contract (0.16.x)

The whole product is background-first. Routine work never moves the user's focus.

| Surface | Verbs that move focus | Everything else |
|---|---|---|
| **Browser** | `open --activate`, `tab new --activate`, `tab switch <id>`, `window focus <id>` | Stays on whatever the operator was looking at — `click`, `type`, `read`, `inspect`, `screenshot`, `net`, `cookies`, `scroll`, `act`. New tabs land in the background by default. |
| **macOS** | `app activate <app>`, `open <app> --activate` | Stays on whatever was frontmost — `open` (no `--activate`), all input verbs, AX reads, capture, menu, intent dispatch, vision, overlays. |

If you call any verb not listed in the "moves focus" column and the frontmost changes, that's a bug.

**Reuse path:** `open --reuse` navigates the existing managed tab without leaving dead tabs behind. Preserves the reused tab's focus state — pair with `--activate` only when the user explicitly says to bring it forward.

### Multi-Context Routing (0.16.x)

When multiple browser profiles are connected (e.g., personal Chrome + isolated test profile + work Brave), commands need to know which one to drive.

```bash
interceptor contexts                                          # List connected context IDs
interceptor open <url> --context "$INTERCEPTOR_TEST_CONTEXT_ID"  # Route to the isolated test profile (DEFAULT)
interceptor open <url> --context <main-id>                    # Route to the operator's personal Chrome (only when explicitly requested)
```

Without `--context`, browser commands auto-route only when exactly one context is connected — and with one context left that means a bare command silently hits whatever remains. Zero or 2+ contexts fail fast with a structured error. Always pass `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` (or route through `Tools/Capture.sh`); never rely on auto-route.

Context IDs are set via the Interceptor extension popup (click the toolbar icon → Context ID field → Save). One-time setup; the daemon remembers across restarts. Set the friendly name `interceptor-test` here to end UUID rot.

**Standing default:** `--context "$INTERCEPTOR_TEST_CONTEXT_ID"`. See `Workflows/LaunchTestProfile.md` for one-time setup.

### Computer Use — macOS Native Helper

The bridge is a Swift LaunchAgent that runs as the user and exposes capabilities the Chrome extension cannot provide on its own:

- **OS-level trusted input** (`interceptor act <ref> --trusted`, `macos type --trusted`, `macos keys --trusted` — bypasses `isTrusted` checks via HID source state)
- **Native macOS app control** (`interceptor macos open/read/act/inspect` — same surface as the browser, against any running app)
- **Accessibility tree** of any running app for inspection without screenshots
- **Screen capture beyond Chrome** (full-screen, off-tab, multi-display, occluded windows)
- **VM lifecycle** (`interceptor macos vm create/clone/start/exec/snapshot/restore/stop/delete` — Linux + macOS guests, replaces Lume/Tart/UTM)
- **Clipboard r/w**, audio listen + speech recognition, system notifications, Vision OCR, NLP, Apple Intelligence, HealthKit, display info
- **Apple Events dispatch** to named bundle IDs without activation
- **OSLogStore predicate queries**, filesystem search/watching, URL fetch
- **Monitor** (cross-app workflow recording with optional clipboard/files/network/log/notifications/speech channels and `--frames` screenshot capture)

**Status check:** `interceptor status` reports `bridge: running` with PID + socket when it's up, or `bridge: not running` with a hint when it isn't.

**Lifecycle (install / verify / troubleshoot / uninstall) lives in `Workflows/Update.md`.** The Update workflow handles binary placement, Sparkle framework install, LaunchAgent plist, `launchctl bootstrap`, and TCC prompts in the right order.

**Security model — read before installing:**

- Transport is a **UNIX domain socket** at `/tmp/interceptor-bridge.sock`. Local-only; no network listener.
- **No authentication on the socket.** Any local process running as your user can connect and execute every bridge action. macOS TCC permissions (Accessibility, Screen Recording, Microphone — the `trust` probe keys are `accessibility` / `screenRecording` / `microphone`, no `inputMonitoring` field) are granted to the bridge once and inherited by every socket client.
- **Marginal risk is supply-chain:** a malicious local package gains a one-step path to OS-level input/screen/clipboard without needing its own permission grants.
- Single-user Mac threat model: acceptable, since anything running as you can already do this with effort. Multi-user Macs need socket hardening.

---

## Compound Commands (Preferred)

These collapse multi-step patterns into single invocations — fewer tool calls, fewer tokens:

```bash
interceptor open <url>                              # Open + wait + return tree + text
interceptor open <url> --reuse                      # Navigate existing managed tab
interceptor open <url> --activate                   # Bring new/reused tab to front (explicit opt-in)
interceptor open <url> --tree-only|--text-only|--full|--no-wait|--include-frames
interceptor read                                    # Tree + text for active tab
interceptor read <ref>                              # Subtree
interceptor read --markdown                         # Render page as markdown (preserves headings/tables/emphasis)
interceptor read --markdown --text-only             # Markdown prose only, no tree
interceptor read --tree-only --tree-format compact  # Actionable refs only
interceptor read --include-style|--include-frames
interceptor act <ref>                               # Click + wait + return updated tree + diff
interceptor act <ref> "value"                       # Type + wait + return updated tree
interceptor act <ref> --trusted                     # OS-level HID-sourced input (was --os; --os is deprecated alias)
interceptor act <ref> --keys "Enter"                # Send keyboard shortcut
interceptor act <ref> --no-read                     # Skip post-action tree read
interceptor inspect                                 # Tree + text + network log + headers
interceptor inspect --net-only|--filter <pattern>
```

**`--trusted` vs `--os`:** v0.13.3 renamed `--os` to `--trusted` (canonical). `--os` is kept as a deprecated alias and emits a warning. Lead with `--trusted` in new code.

## Command Reference (moved)

The full per-verb CLI listing — macOS Native (Computer Use), VM Lifecycle, Core Browser Commands, Network/Exports, Recording (Session Monitor), Canvas, Scene Graph, LinkedIn, ChatGPT Agentic Bridge, Batch + Meta — lives in `References/CommandReference.md`. Quick pointers:

| Verb tree | Reference section |
|-----------|-------------------|
| `interceptor macos *` (native apps, AX, trusted input, Vision/Speech/NLP, Apple Events, logs, fs, overlay) | macOS Native (Computer Use) |
| `interceptor macos vm *` (Linux + macOS guests, gold image, clone/snapshot) | VM Lifecycle — plus `Workflows/VmLifecycle.md` |
| `state`, `tree`, `find`, `click`, `type`, `navigate`, `tabs`, `screenshot`, `eval`, `style`, `cookies` | Core Browser Commands |
| `net log/headers/export`, `override`, `network *`, `sse *`, `headers *` | Network — Passive, CDP, and Exports |
| `monitor *` (record/replay) | Recording (Session Monitor) |
| `canvas *`, `scene *` | Canvas / Scene Graph |
| `linkedin *`, `chatgpt *`, `batch`, `status`, `contexts`, `init`, `upgrade` | LinkedIn / ChatGPT Bridge / Batch + Meta |

## Key Rules

- **Requires Chrome/Brave running** for browser commands — it's an extension, not a standalone binary.
- **Requires bridge running** for `act --trusted`, `macos *`, full-screen capture, VM lifecycle — `interceptor status` confirms.
- **Refs use eN syntax** — `e12` not `@e12`. Treat refs as short-lived; re-`read` or `find` after navigation, rerenders, or DOM mutations.
- **Cross-frame refs** — `read --include-frames` returns refs like `e<frameId>_<n>` for non-top frames.
- **Plain text by default.** `--json` only when piping into a script. Prose-trained models comprehend tree/text output better than dense JSON.
- **Daemon auto-starts** — first command launches it; no manual start needed.
- **Prefer compound commands** (`open`, `read`, `act`, `inspect`) over manual `tab new` + `wait` + `tree` chains.
- **Prefer structured reads over screenshots** unless the task is explicitly visual or pixel-based — tree/text/network/scene/AX data is faster, smaller, and more deterministic.
- **`--trusted` is canonical; `--os` is a deprecated alias.** v0.13.3+. New code uses `--trusted`.
- **`--markdown` is the structured-prose surface** — preserves headings, tables, emphasis. Use instead of `--text-only` when visual hierarchy disambiguates the answer.
- **Background-first by contract.** Only `--activate` / `app activate` / explicit `tab switch` move focus.
- **Verify with `frontmost` before/after.** Native workflows that promise no focus change should prove it.
- **Never `screencapture`. Never `osascript` for Chrome focus, bounds, tabs, or windows.** Forbidden under Hard Prohibitions. Survives Interceptor failures.
- **Screenshots go through `Tools/Capture.sh`, never raw `interceptor screenshot`.** Capture.sh runs the preflight gate, enforces the not-Default target check, handles UUID-rot rebind, prefers the DOM-render path, and writes review artifacts to `~/Downloads/`.

## Delegating to Agents

When spawning agents for Interceptor work:

```
Agent(subagent_type="general-purpose", prompt="
  Use interceptor CLI for all browser and macOS automation work.
  Browser: open <url> --context "$INTERCEPTOR_TEST_CONTEXT_ID", read [--markdown], act eN, inspect. Screenshots go through Tools/Capture.sh, never raw screenshot.
  Native (macOS): macos open <app>, macos read, macos act <ref>, macos inspect, macos vm *.
  Compound commands preferred — they return tree + text in one call.
  Refs use eN syntax (no @ prefix) from tree output. Treat refs as short-lived.
  Background-first: only --activate and app activate move focus.
  PROFILE ISOLATION (MANDATORY GATE): the FIRST action of this task is
    bash $LIFEOS_ROOT/skills/Interceptor/Tools/PreflightIsolation.sh
  If that script exits non-zero, STOP and surface the message verbatim — do NOT
  fall back to operating against the Default profile, and do NOT use screencapture
  or osascript as substitutes. After the preflight returns OK, every browser
  command carries `--context "$INTERCEPTOR_TEST_CONTEXT_ID"`. Never operate in the
  operator's main profile unless the parent agent explicitly says so.
  `act --trusted` for OS-level HID input (was --os).
  [your specific task instructions here]
")
```

## Workflow Routing

| Workflow | Trigger | File | Notes |
|----------|---------|------|-------|
| LaunchTestProfile | "test profile", "launch test profile", "isolated browser", "isolated browser profile", "separate Chrome window", "start interceptor-test" | `Workflows/LaunchTestProfile.md` | One-time setup + daily launch of the isolated Chrome profile via `--profile-directory`, extension load, context-ID naming |
| VerifyDeploy | "verify deploy", "check deploy", "confirm deploy", "deploy verification" | `Workflows/VerifyDeploy.md` | Open URL in real Chrome (via `--context interceptor-test`), structured read, check errors, evidence |
| ScrubFlow | "scrub flow", "record flow to video", "motion bug", "animation jank", "transition stutter", "flicker", "flow gallery", "catch motion a screenshot misses" | `Workflows/ScrubFlow.md` | Record a web flow to video, extract SSIM-scored frames (survey/scrub via `Tools/FrameScrub.ts`), catch motion/animation/flow bugs a still screenshot misses |
| Reproduce | "reproduce", "reproduce bug", "debug page", "check page", "blank screen" | `Workflows/Reproduce.md` | Open affected page BEFORE code analysis, capture console errors and network 404s |
| ReadAndExtract | "extract value", "read page", "pull a fact", "SPA state" | `Workflows/ReadAndExtract.md` | Compound read + SPA state extraction; right surface per task; mode-swap rule |
| DriveRichEditor | "drive Canva", "drive Docs", "drive Slides", "rich editor", "scene", "scene graph", "canvas-rendered" | `Workflows/DriveRichEditor.md` | Scene graph + dispatched-event recipes for canvas-rendered editors |
| OverrideXhr | "override request", "request override", "force 500", "rewrite response", "mutate XHR" | `Workflows/OverrideXhr.md` | Install passive override, trigger, verify, clear |
| ScreenshotForVlm | "screenshot for VLM", "VLM screenshot", "agent screenshot", "WebP 1568" | `Workflows/ScreenshotForVlm.md` | VLM-budgeted screenshot recipe; 1-command budget; --save --format webp --target-max-long-edge |
| MultiPageCompare | "compare pages", "multi-page compare", "facts across N pages", "designed by X vs Y" | `Workflows/MultiPageCompare.md` | Sequential `open --text-only` per page, no tab thrashing |
| CaptureBackgroundedApp | "screenshot of Brave / Signal / Mail / X", "capture backgrounded app", "capture occluded window" | `Workflows/CaptureBackgroundedApp.md` | CGS capture of named app's window without activating it |
| DriveBackgroundedApp | "scroll Mail / type into TextEdit", "drive backgrounded app", "click without focus" | `Workflows/DriveBackgroundedApp.md` | AX press + value-set + `postToPid` for non-frontmost input |
| DispatchAppleEvent | "open URL in Brave", "Apple Event", "apple events", "intent dispatch", "named app open" | `Workflows/DispatchAppleEvent.md` | `intent dispatch --bundle <id> --script` — no `activate` in scripts |
| ReadAxTree | "AX tree", "accessibility tree", "what's in Cursor / Slack", "find a button in app" | `Workflows/ReadAxTree.md` | `macos tree` with Electron wake-up via `AXManualAccessibility` |
| TrustedInputGate | "trusted input", "OS-level input", "isTrusted", "site rejects synthetic input", "HID-source state" | `Workflows/TrustedInputGate.md` | `--trusted` escalation; browser-side `__interceptor_trust` marker; when to use which |
| VmLifecycle | "create VM", "VM lifecycle", "linux VM", "macos VM", "gold image", "clone VM", "snapshot VM" | `Workflows/VmLifecycle.md` | `interceptor macos vm *` full lifecycle + Lume migration table |
| RecordFlow | "record flow", "record workflow", "capture flow", "monitor start" | `Workflows/RecordFlow.md` | Record browser actions via monitor system, export replayable plan script |
| RecordAndReplayMacFlow | "record mac flow", "record native flow", "watch me do X in Cursor/Mail/Finder" | `Workflows/RecordAndReplayMacFlow.md` | `macos monitor` AX-event recording + export + replay |
| ReplayFlow | "replay flow", "replay", "regression check", "run flow" | `Workflows/ReplayFlow.md` | Execute a recorded plan script step-by-step, verify each step, report regressions |
| TestForm | "test form", "fill form", "form test", "check form" | `Workflows/TestForm.md` | Discover form fields, fill with test data, submit, verify result |
| Update | "update", "check version", "rebuild", "install bridge", "enable computer use" | `Workflows/Update.md` | Pull, rebuild, reinstall, install bridge for Computer Use, verify end-to-end |

## Examples

- "Verify the blog deploy" → VerifyDeploy: preflight isolation gate, `interceptor open <url> --context "$INTERCEPTOR_TEST_CONTEXT_ID"`, `read --markdown`, capture via `Tools/Capture.sh`, report with evidence.
- "The menu animation looks off / does the checkout flow render clean" → ScrubFlow: record the flow to video, `bun Tools/FrameScrub.ts <recording> scrub --at <sec>`, Read the auto-flagged frame, cite the manifest. Motion/interaction ISCs require this or a flow-gallery, not a single still (Algorithm Rule 1).
- "Why is this page blank after deploy?" → Reproduce: open the page FIRST, `eval --main` console-error capture, `net log` for failed requests, then code analysis.
- "Record me approving this flow, then replay it nightly" → RecordFlow + ReplayFlow: `monitor start`, operator acts, `monitor export <sid> --plan`, replay the plan script later.

## Gotchas

- **`interceptor` dying instantly with rc=137 and ZERO output = invalid code signature, not a wedge.** The kernel SIGKILLs adhoc-signed binaries whose signature went stale (observed 2026-06-10 after a system event; both binaries affected). Diagnose: `cp` the binary to /tmp, `codesign -s - -f` the copy, run it — if the copy works, re-sign the real ones: `codesign -s - -f /opt/homebrew/bin/interceptor && codesign -s - -f /opt/homebrew/bin/interceptor-daemon`. BOTH must be re-signed — the CLI spawns `interceptor-daemon --standalone` and a still-broken daemon yields "daemon failed to start. Check /tmp/interceptor.log" with the log never created. *(2026-06-10.)*
- **Screenshot — how it actually works (0.22.2).** Route every capture through `Tools/Capture.sh`; the raw behavior below is what it wraps.
  - **Default `interceptor screenshot` is the DOM-render path** — a **dependency-free native renderer since v0.18.3** (`html-to-image` was removed; injected on demand via `executeScript`). It renders from the live DOM tree and does **NOT** require a foreground/visible tab — a backgrounded tab on another macOS Space is fine, and it's fail-fast (no more full-timeout hang on a backgrounded tab).
  - **`--pixel` is the opt-out** → legacy `captureVisibleTab`. It captures the window's *active* tab, so to capture a specific background tab it briefly activates it and restores focus — **the visible flash is by design**. `--pixel` REQUIRES the window non-minimized and visible; minimized → fast honest failure. Full-page `--pixel` rate-limits strips at 1100ms (Chrome's 2/sec cap) and stitches in the service worker.
  - **Reliability is the default path, not a flag.** There is no "reliable mode" toggle. The robustness today is the in-extension minimized-window preflight (fails fast instead of hanging ~30s) plus the CLI's 45s screenshot timeout. The `cli/lib/screenshot-selfheal.ts` wrapper is **dormant/unwired** — do not cite it.
  - **`--save` writes to the CLI's current working directory** and returns `filePath` (omits `dataUrl`). It does NOT write to `/tmp/pai-screenshots/` — workflows `cd` there precisely because `--save` targets CWD. There is no `--output <path>` flag; positional path args are silently ignored. Per OPERATIONAL_RULES, review artifacts belong in `~/Downloads/`, pipeline intermediates in `/tmp/`; `Tools/Capture.sh` standardizes this.
  - **Without `--save`, `screenshot` returns the full base64 `dataUrl` inline** — 10MB+ of PNG flooding the transcript. Always `--save` from an agent context.
  - Flags `--target-max-long-edge N` (clamp long edge, dodges the 16384 Skia ceiling), `--scale`, `--selector`, `--element N`, `--region X,Y,W,H` run inside DOM-render; `--clip` is a deprecated alias for `--region`.
- **DOM-render screenshots drop CSS pseudo-element generated content.** `::before`/`::after` content — CSS counters especially — renders in the live browser but vanishes from the default DOM-render capture, so a page can look broken in the screenshot while fine on screen. Confirm via `eval --main` geometry/computed-style before "fixing" the page; for content you author, prefer real DOM text over CSS counters. *(2026-07-11, found via a missing numbered rail that eval proved present.)*
- **DOM-render screenshot ignores scroll position by default.** `interceptor screenshot` captures from y=0 of the document — `window.scrollTo` / `scrollIntoView` / `keys End` do not move the screenshot frame. For tall pages, use `--region X,Y,W,H`, `--selector <css>`, `--element <ref>`, or `--pixel --full` (scroll-and-stitch, requires window visible). *(2026-04-27, still relevant 2026-06-17.)*
- **Multiple tabs at the same URL confuse routing without `--context`.** When two tabs both load `localhost:5180/`, `tab switch <id>` reports `ok` but the visually-active Chrome tab may not change. Either close duplicates, work from a freshly-opened single tab, or pass `--context <id>` to scope unambiguously.
- **`eval` is CSP-blocked on most sites.** Use `eval --main` to run in the page's main world. Even with `--main`, strict CSP (`script-src 'self'`) still blocks string-eval; pass small expressions, avoid `Function`-constructor patterns.
- **Bridge needs Sparkle.framework.** When rebuilding from source on Apple Silicon, the bridge won't load until `Sparkle.framework` is installed at `/usr/local/Frameworks/`. The running bridge is the `.app`-bundle binary at `~/.local/share/interceptor/interceptor-bridge.app/Contents/MacOS/interceptor-bridge` (LaunchAgent `com.interceptor.bridge`, plist `~/Library/LaunchAgents/com.interceptor.bridge.plist`), NOT `/usr/local/bin/interceptor-bridge` (stale copy). The Update workflow handles this; symptom of forgetting is `bridge: not running` with `dyld[*]: Library not loaded: @rpath/Sparkle.framework/...` in `/tmp/interceptor-bridge.stderr.log`. *(2026-05-03, bridge topology corrected 2026-06-17.)*
- **Manifest version bump = manual extension reload + re-pin required.** Chrome does not auto-reload unpacked extensions. `$LIFEOS_ROOT/skills/Interceptor/Extension/` is a pinned COPY, not a symlink — it does not auto-follow upstream. After a binary upgrade, re-pin via the Update workflow, then delete the existing extension card in `chrome://extensions` and Load Unpacked again from `$LIFEOS_ROOT/skills/Interceptor/Extension/`. The extension `key` is deterministic so the extension ID stays stable across reloads.
- **"native port disconnected" is NOT a screenshot error.** It's the daemon logging that Chrome's Native-Messaging stdio port dropped (extension SW recycled / Chrome closed); the daemon survives and falls through to its WebSocket transport. If neither WS nor relay is up, commands queue (cap 50) and time out. **Fix = reconnect the extension** (reload the tab / re-open the configured browser), not restarting the daemon.
- **"screenshot-runner.js could not load" = per-frame injection failure.** (The old "html-to-image library not loaded" error is gone — v0.18.3 replaced the library with a native renderer.) The page disallows script injection (`chrome://`, Web Store, PDF viewer, strict-CSP frame), the tab navigated mid-inject, OR — most common after a binary upgrade — a **stale loaded extension** whose bundled runner doesn't match the daemon. **Fix = reload/re-pin the extension** (Load Unpacked from `$LIFEOS_ROOT/skills/Interceptor/Extension/`).
- **Daemon↔extension WebSocket can wedge in a half-alive state — try other verb trees BEFORE declaring Interceptor unusable.** Symptom: `status`/`contexts`/`tabs` answer (control-plane message types) while `screenshot`/`eval` hang at timeout (data-plane types). Each verb in the Capabilities Overview uses a different WebSocket message type, so a wedge on `screenshot` rarely affects `eval`, `net log`, `tree`, `read --markdown`, `monitor`, or `inspect`. Recovery ladder: (1) **swap the capture path** (pixel↔DOM-render — a different message type often unwedges) or substitute a verb from another capability class — `read --markdown` / `eval --main document.body.innerText` instead of `screenshot`, `net log` for failed requests; (2) one `pkill -f interceptor-daemon` + a single retry; (3) reload the extension (surface: *"Interceptor extension is wedged — please reload it from chrome://extensions/."*) and STOP. Only after all three fail, tell the operator verification cannot be captured — **never fall back to `screencapture` / `osascript`.** **The recurring mistake this catches: claiming "Interceptor is broken" after a single `screenshot` timeout when `eval` would have answered the question in one tool call.** *(2026-05-13, sharpened 2026-06-17.)*
- **Dead-bridge self-heal (macOS `macos_*` paths only — browser screenshot does NOT need the bridge).** "Loaded" ≠ "running" — probe the process via `interceptor status`, not just `launchctl list`:
  ```bash
  interceptor status | grep -A2 '^bridge:'                         # running + pid/socket, or not running
  launchctl print "gui/$(id -u)/com.interceptor.bridge" 2>&1 | grep -E 'state|program|pid'
  launchctl kickstart -k "gui/$(id -u)/com.interceptor.bridge"     # restart (loaded-but-dead)
  ```
  The agent runs the `.app`-bundle binary (`~/.local/share/interceptor/interceptor-bridge.app/Contents/MacOS/interceptor-bridge`), NOT `/usr/local/bin/interceptor-bridge` (that copy is stale). A SIGKILLed bridge with a stale ad-hoc signature restart-loops every ~5s (`ThrottleInterval`) — re-sign the `.app` MacOS binary, not the `/usr/local/bin` copy. `Tools/HealBridge.sh` wraps the loaded-but-dead detect + single kickstart. *(2026-06-17.)*
- **`AXEnhancedUserInterface` was removed from the bridge** (it foregrounded AppKit apps as a side effect of being interpreted as "VoiceOver active"). The bridge uses `AXManualAccessibility` exclusively for Electron wake-up. Stale guidance from old code that sets `AXEnhancedUserInterface` should be ignored.
- **`screenshot --pixel --tab <id>` can capture the WRONG page — `--pixel` follows the active tab.** `--pixel` is `captureVisibleTab`; it shoots whatever tab is visually active, and if the preceding tab activation didn't land, that's the operator's foreground tab, not your target (observed 2026-06-11: requested a localhost site under test, captured the operator's unrelated foreground site instead). Always Read the returned image and confirm it's the page you asked for before citing it as evidence — this is why `Tools/Capture.sh` reads back on the `--pixel` fallback path. Do NOT reach for AppleScript tab activation — banned under Hard Prohibitions. Instead answer through a non-visual verb tree (`read --markdown`, `eval --main`, `net log`), or follow the WebSocket-wedge recovery ladder above. *(2026-06-11; AppleScript workaround removed 2026-06-13.)*
- **Sensitive-app gate.** The bridge rejects `type`/`keys`/`click x,y`/`drag` when frontmost is a denylisted bundle (Keychain, 1Password, Dashlane, LastPass, Bitwarden, System Settings, Chase, Bank of America, Wells Fargo). Surface the rejection — do not bypass.
- **VM `paused-state` snapshots are gated.** `--paused-state` requires `validateSaveRestoreSupport()` to return true on the VM config. macOS guests support it; some Linux configurations don't. `--disk-only` always works.
- **TCC grants for VM hosts:** the bridge needs `com.apple.security.virtualization` entitlement. Move the bridge out of `~/Documents` or `~/Desktop` if `setup_required` complains about the install location.
- **Local extract.ts customization is obsolete.** The pre-v0.13 patch that bumped slice limits to 10M is no longer needed — upstream's `withTruncationMarker` + `--full` flag + per-action `maxChars` does it correctly with explicit truncation markers (`... (truncated: showed X of Y chars ...)`).
- **Stale binary silently routes to Default — the fallback incident (2026-05-23).** A rebuild that lands at `~/Projects/interceptor/dist/` but never gets copied into `/opt/homebrew/bin/` leaves the CLI at an old version. Old binaries do not recognize `--context` or the `contexts` subcommand — they accept the flag without error and proceed to route the command through whichever Chrome connection the daemon can find, which is normally the operator's Default profile. Symptom: agent calls `interceptor open <url> --context "$INTERCEPTOR_TEST_CONTEXT_ID"`, expects an isolated tab, gets a tab in the operator's working window. Detection: `interceptor --version` reports a version older than `0.16.0`, AND/OR `interceptor open --help` shows no `--context`-related flag, AND/OR `interceptor contexts` returns "unknown command". Mitigation: the **Preflight Isolation Gate** (above) hard-fails on version mismatch with exit code 4 — every workflow runs it as step zero. Recovery is `Workflows/Update.md` followed by `pkill -f interceptor-daemon` so the next call respawns the new daemon.

- **Upgrading the bridge from an iCloud-synced source repo — the full signing dance (2026-07-04, 0.16.9→0.22.2).** `~/Projects/interceptor` symlinks into `~/Library/Mobile Documents/com~apple~CloudDocs/`, and iCloud sync **strips the built `.app`'s code-signature envelope** (`codesign -v` → "code has no resources but signature indicates they must be present"). Copying that bundle into place propagates the break and the bridge SIGKILL-loops (`launchctl print` → `last exit reason = OS_REASON_CODESIGNING`). Fix, in order, on the LOCAL staged copy (`~/.local/share/interceptor/interceptor-bridge.app`): `xattr -cr` it → `codesign --force --deep --sign - .../Contents/Frameworks/Sparkle.framework` → `codesign --force --sign - --entitlements ~/Projects/interceptor/scripts/entitlements-bridge.plist` on **the MacOS binary, then the .app** (this is exactly build-bridge.sh's dev-signing fallback). Do NOT `codesign --deep` the whole app — it mis-signs nested Sparkle so `codesign -v` passes while the kernel still kills it.
- **`bash scripts/install.sh --chrome` re-clobbers a freshly-fixed bridge.** It chains into install-bridge.sh, which re-copies the broken iCloud bundle over your fixed one. Re-sign AFTER running it — or don't run it again once the bridge is signed.
- **launchd `job state = spawn failed` after repeated `kickstart -k`.** Rapid restart cycles throttle launchd into a failed state (`runs` climbs; the binary runs fine when launched directly). Recovery is `launchctl bootout "gui/$(id -u)/com.interceptor.bridge"` then a fresh `launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.interceptor.bridge.plist` — NOT another kickstart.
- **The daemon runs as a persistent LaunchAgent (`com.interceptor.daemon`, added 2026-07-04) — this is the durable fix for the extension's "native keepalive ping failed / forcing reconnect" console spam.** That spam fires when the daemon is momentarily *down* (an upgrade, a crash, a `pkill`): the drop kills the extension's native-messaging relay port, and the SW logs `ping failed` until it reconnects. The relay architecture is otherwise healthy — one singleton owns the socket, each Chrome profile spawns a thin relay that bridges to it (`relay: registered with singleton` → `received ping, sending pong`). Keeping the singleton ALWAYS up (`RunAtLoad` + `KeepAlive`, plist `~/Library/LaunchAgents/com.interceptor.daemon.plist` → `/opt/homebrew/bin/interceptor-daemon --standalone`) means relays always find a live singleton, so reconnects succeed instantly instead of erroring. **On a daemon-binary upgrade, `launchctl kickstart -k "gui/$(id -u)/com.interceptor.daemon"`** to pick up the new binary (same pattern as the bridge). Verify: `interceptor status` daemon pid == the launchd pid, and a steady-state `/tmp/interceptor.log` window shows 0 `ping failed` / `forcing reconnect`.
- **Ad-hoc re-signing the bridge resets its TCC grants.** A new ad-hoc signature is a new code identity, so Accessibility / Screen Recording / Microphone drop to `denied` and Computer Use stops until re-granted (`interceptor macos trust --walkthrough`, or System Settings → Privacy & Security). The browser surface is unaffected (extension-based, no TCC). The notarized `Interceptor-Full-<v>.pkg` keeps a stable Developer-ID identity across Sparkle updates and sidesteps all of this — prefer it for the bridge when TCC churn hurts.
- **`interceptor diagnose` is the first move when anything's wedged (0.22.2+).** It flags the daemon **split-brain**: the socket daemon (what the CLI talks to) vs the NMH manifest path (what Chrome spawns). Fix by pointing the manifest `path` at the canonical binary — `jq '.path="/opt/homebrew/bin/interceptor-daemon"'` over `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.interceptor.host.json` (+ the Brave one) — then `pkill -f interceptor-daemon` and run one active command (`interceptor contexts`) to respawn from the right place.
- **`Tools/Pin.sh` on bash 5.2+ — the tilde scrub was silently a no-op (fixed 2026-07-04).** `${SRC/#$HOME/~}` started tilde-expanding the replacement back to `/Users/<name>`, so `PINNED_FROM.txt` shipped an absolute home path and Pin.sh's own leak guard FATAL'd. Fixed to a quoted `~${SRC#$HOME}` form (`rel_home()`). If a re-pin FATALs on "absolute home path survived the scrub," check the bash version and that helper.

- **Auto-launch recovery (`EnsureTestProfile.sh`) — safety is the re-verification loop, not the profile arg (2026-07-07).** When the test profile window isn't open, `EnsureTestProfile.sh` launches the configured `--profile-directory` and polls `PreflightIsolation.sh` until the PINNED context connects, then proceeds. It can auto-launch the *wrong* profile with zero risk, because it only ever exits 0 after preflight whole-field-matches `INTERCEPTOR_TEST_CONTEXT_ID` and hard-denies Default — a wrong launch just keeps failing preflight, so the agent never drives it. Two real limits: (1) macOS `open -a "Google Chrome" --args --profile-directory=…` is a **no-op for the args when Chrome is already running** (it just activates) — `LaunchTestProfile.sh` sidesteps this via its direct-`CHROME_BIN` branch, which opens a new profile window even against a running Chrome; if a launch "succeeds" but no new window appears, that's the `open`-already-running case and the direct-binary branch is what actually works. (2) If the launch connects a NEW context UUID (extension was reloaded → UUID rot), preflight won't match the pin and `EnsureTestProfile` STOPS with the durable fix (name the context `interceptor-test` in the popup) — it never rebinds to an unidentified UUID. Only exit 5/6 auto-launch; exit 7 (Default/working target) and 8 (unset config) never do.

## Stealth Verification

Passes all major bot detection:

| Check | Result |
|-------|--------|
| BrowserScan | Normal |
| Pixelscan | Definitely Human |
| Sannysoft | All pass |
| CreepJS | 0% headless |
| Fingerprint.com | notDetected |
| AreyouHeadless | Not headless |

---

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Interceptor","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```
