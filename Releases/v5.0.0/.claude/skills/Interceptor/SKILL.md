---
name: Interceptor
description: "Real Chrome browser automation via Interceptor extension — controls the actual browser from inside (zero CDP fingerprint, passes all major bot detection checks including BrowserScan, Pixelscan, CreepJS, Fingerprint.com). Stays logged in, uses your real sessions. Compound commands (open, read, act, inspect) collapse multi-step flows into single calls. Unique capabilities: monitor/replay system (record user actions → export replayable plan scripts for regression), network log (auto-captures all fetch/XHR), scene graph for rich editors (Google Docs, Canva, Slides). Workflows: VerifyDeploy, Reproduce (open affected page BEFORE code analysis — mandatory per rules), RecordFlow, ReplayFlow, TestForm, Update. MANDATORY for all visual verification — never use agent-browser for deploy confirmation. USE WHEN verify deploy, confirm UI, check page, screenshot verification, interceptor, debug web, troubleshoot, visual check, authenticated page, bot detection bypass, agent-browser failing, reproduce bug, record flow, replay flow, test form, QA test, regression check. NOT FOR batch headless automation (use Browser). NOT FOR multi-page crawling or scraping at scale with residential proxy needs (use BrightData)."
version: 2.0.0
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Interceptor/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Interceptor — Stealth Browser Automation

**Tool:** `interceptor` CLI — Chrome extension that controls the real browser from the inside.
**Repo:** https://github.com/Hacker-Valley-Media/slop-browser
**Install:** `~/Projects/interceptor` (built from source — see `Workflows/Update.md`)

### Why Interceptor?

agent-browser (the Browser skill) uses CDP — sites can detect it. Interceptor is a Chrome extension that operates through the actual browser UI. No debugger, no automation flags, no separate browser instance. You stay logged in, you pass bot detection, the agent sees what you see.

### Prerequisites

- Chrome or Brave running with the Interceptor extension loaded
- `interceptor` CLI in PATH (`/opt/homebrew/bin/interceptor`)
- `interceptor-daemon` in PATH (`/opt/homebrew/bin/interceptor-daemon`)
- Native messaging manifest registered (`bash ~/Projects/interceptor/scripts/install.sh --chrome --skip-extension`)
- (Optional, macOS) `interceptor-bridge` helper app — see "Bridge" section below

### Bridge — macOS Native Helper App

The bridge is an optional Swift helper that runs as a LaunchAgent and unlocks
capabilities the Chrome extension can't provide on its own: OS-level synthetic
input (`act --os`), accessibility tree of native macOS apps, app control,
clipboard, screen capture beyond Chrome, audio/speech, files, notifications,
HealthKit, Apple Intelligence. ~95% of typical work doesn't need it.

**Status check:** `interceptor status` reports `bridge: running` with PID + socket
when it's up, or `bridge: not running` when it isn't.

**Lifecycle (install / verify / troubleshoot / uninstall) lives entirely in
`Workflows/Update.md` section 6.** Future updates flow through the Update
workflow — never reach for the upstream `install-bridge.sh` directly; that
script breaks on Apple Silicon (`/usr/local/bin` needs sudo, but sudoing the
whole script makes `launchctl bootstrap` target uid 0 instead of the user).
The skill's procedure is the canonical one.

**Security model — read before installing:**

- Transport is a **UNIX domain socket** at `/tmp/interceptor-bridge.sock`.
  Local-only; no network listener; not reachable from another machine.
- **No authentication on the socket.** Any local process running as your user
  can connect and execute every bridge action — including synthetic input,
  clipboard read, audio capture, screenshots. macOS TCC permissions
  (Accessibility, Input Monitoring, Screen Recording, Microphone) are granted
  to the bridge once and inherited by every socket client.
- **Marginal risk is supply-chain:** a malicious package installed via
  bun/brew/npm gains a one-step path to OS-level input/screen/clipboard without
  needing its own permission grants — the bridge has them.
- Single-user Mac threat model: acceptable, since anything running as you can
  already do this with effort. Multi-user Macs need socket hardening (see
  Update.md section 6c).
- Binary built locally from `~/Projects/interceptor/interceptor-bridge/Sources/`,
  not a downloaded prebuilt. Provenance is Swift source we just compiled.

---

## Compound Commands (Preferred)

These collapse multi-step patterns into single invocations — fewer tool calls, fewer tokens:

```bash
interceptor open "https://example.com"              # Open URL, wait, return tree + text
interceptor open <url> --tree-only|--text-only|--full|--no-wait
interceptor read                                     # Tree + text for active tab
interceptor read <ref>                               # Tree + text for element subtree
interceptor read --include-style|--include-frames
interceptor act <ref>                                # Click + wait + return updated tree + diff
interceptor act <ref> "value"                        # Type + wait + return updated tree
interceptor act <ref> --os                           # OS-level trusted input (requires bridge)
interceptor act <ref> --keys "Enter"                 # Send keyboard shortcut
interceptor inspect                                  # Tree + text + network log + headers
interceptor inspect --net-only                       # Network only
```

## Core Commands

```bash
# State + discovery
interceptor state [--full]              # DOM tree + metadata
interceptor tree [--filter all] [--depth N] [--max-chars N]
interceptor diff                         # Changes since last state/tree read
interceptor find "query" [--role button] # Find elements by name
interceptor text [<index|ref>]
interceptor html <index|ref>

# Element interaction
interceptor click <ref>                  # Click by ref (eN)
interceptor click <ref> --at X,Y         # Click at coordinates
interceptor dblclick <ref> --at X,Y
interceptor rightclick <ref> --at X,Y
interceptor type <ref> <text> [--append]
interceptor type "role:name" <text>      # Semantic selector
interceptor select <ref> <value>         # Dropdown
interceptor focus|hover <ref>
interceptor drag <ref> --from X,Y --to X,Y [--steps N] [--duration MS]
interceptor keys "<combo>"               # e.g. "Control+A"

# Navigation + tabs
interceptor navigate <url>
interceptor back | forward
interceptor scroll <up|down|top|bottom>
interceptor wait <ms> | wait-stable [--ms N] [--timeout N]
interceptor tabs
interceptor tab new [url] | tab close [id] | tab switch <id>

# Capture
interceptor screenshot [--save] [--format png|jpeg] [--full] [--clip X,Y,W,H] [--element N]
interceptor eval <code> [--main]         # JS in isolated or main world
interceptor capture start | frame | stop # tabCapture stream

# Style injection (test redesigns live)
interceptor style inject --css "<rules>" [--top-only]
interceptor style remove <handle>

# Cookies
interceptor cookies <domain>
interceptor cookies set <json>
interceptor cookies delete <url> <name>
```

## Network

```bash
# Passive capture (always-on, no CDP fingerprint)
interceptor net log [--filter <pat>] [--limit N] [--since <ts>]
interceptor net headers [--filter <pat>]   # CSRF, auth headers
interceptor net clear

# Request override (passive, no CDP)
interceptor override "*pattern*" key=value
interceptor override clear

# CDP-attached interception (explicit opt-in — leaves debugger banner)
interceptor network on [patterns...]
interceptor network off
interceptor network log
interceptor network override on '<json>'
interceptor network override off

# SSE streams (LLM responses, live feeds)
interceptor sse log [--filter <pat>] [--limit N]
interceptor sse streams
interceptor sse tail [--filter <pat>]

# Header rewriting
interceptor headers add <name> <value>
interceptor headers remove <name>
interceptor headers clear
```

## Recording (Session Monitor)

Record real user actions on the active tab, replay as a deterministic plan script.

```bash
interceptor monitor start ["instruction"]   # Start recording
interceptor monitor pause | resume
interceptor monitor stop                     # End + emit summary
interceptor monitor status [--all]
interceptor monitor list                     # All sessions
interceptor monitor tail [--current] [--raw] # Live tail
interceptor monitor export <sessionId>       # Aligned text
interceptor monitor export <sessionId> --plan # Replay script
interceptor monitor export <sessionId> --json
```

## Canvas (Rich Web Apps)

For apps that render to `<canvas>` (Figma, Excalidraw, in-house editors):

```bash
interceptor canvas list | status
interceptor canvas log [N] [--kind fillText]
interceptor canvas objects [N] [--kind text]
interceptor canvas model | routes
interceptor canvas ocr N [--region X,Y,W,H]
interceptor canvas read N [--format png] [--region X,Y,W,H] [--webgl]
interceptor canvas diff <url1> <url2> [--threshold 10] [--image]
```

## Scene Graph (Rich Editors — Google Docs/Slides, Canva)

```bash
interceptor scene profile [--verbose]
interceptor scene list [--type shape|text|image|page|embed|slide]
interceptor scene click <id> | dblclick <id> | select <id>
interceptor scene hit <x> <y>                # ID object at coordinates
interceptor scene selected | text [--with-html]
interceptor scene insert "<text>"
interceptor scene cursor-to <x> <y>
interceptor scene slide list | current | goto <index> | notes [--slide N]
interceptor scene render <id> [--save]
interceptor scene zoom
interceptor scene ... --profile <name>       # Force profile, bypass detection
```

## LinkedIn

```bash
interceptor linkedin event [url]             # Event + post data via DOM + network
interceptor linkedin attendees [url]         # Attendees with override + enrichment
```

## ChatGPT Agentic Bridge

Drive chatgpt.com from CLI without an API key:

```bash
interceptor chatgpt send "<prompt>" [--stream]
interceptor chatgpt read | status
interceptor chatgpt conversations | switch <id>
interceptor chatgpt model [name]
interceptor chatgpt stop
```

## Batch + Meta

```bash
interceptor batch '<json_array>' [--stop-on-error] [--timeout MS]
interceptor status                    # Daemon + bridge state (local check)
interceptor help
```

## Key Rules

- **Requires Chrome running** — it's an extension, not a standalone binary.
- **Refs use eN syntax** — `e12` not `@e12`. No `@` prefix.
- **Cross-frame refs** — `read --include-frames` returns refs like `e<frameId>_<n>` for non-top frames.
- **`--json`** is a global flag for structured output.
- **Daemon auto-starts** — first command launches it; no manual start needed.
- **Bridge is optional** — only needed for `act --os` and OS-trusted input. Without it, interceptor falls back to in-page synthetic events.

## Delegating to Agents

When spawning agents for Interceptor work:

```
Agent(subagent_type="general-purpose", prompt="
  Use interceptor CLI for all browser work.
  Commands: open <url>, read, act eN, act eN 'text', inspect, screenshot.
  Compound commands preferred — they return tree + text in one call.
  Refs use eN syntax (no @ prefix) from tree output.
  Use --json for structured output.
  [your specific task instructions here]
")
```

## Gotchas

- **Screenshot ignores scroll position.** `interceptor screenshot` (with or without `--full`) captures from y=0 of the document — it does not honor `window.scrollTo`, `scrollIntoView`, `scroll bottom`, or `keys End`. For tall pages, content below the fold is unreachable through screenshot. Workaround: render the section of interest at its own short URL (`/problems.html`, `/section-3.html`) and screenshot that page directly. The `--clip "x,y,w,h"` flag returns "Cannot read properties of undefined" — broken in the current build. *(2026-04-27)*
- **Multiple tabs at the same URL confuse routing.** When two tabs both load `localhost:5180/`, `tab switch <id>` reports `ok` but the visually-active Chrome tab may not change, and `screenshot` captures whatever Chrome is showing — not what `interceptor text` and `interceptor navigate` are routing to. Close duplicate tabs before screenshotting, or always work from a freshly-opened single tab.
- **`eval` is CSP-blocked on most sites.** Use `eval --main` to run in the page's main world instead of the isolated extension world. Even with `--main`, sites with strict CSP (`script-src 'self'`) will still block string-eval; pass small expressions only and avoid `Function`-constructor patterns.

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

## Workflow Routing

| Trigger Words | Workflow | What It Does |
|--------------|----------|-------------|
| "verify deploy", "check deploy", "confirm deploy", "deploy verification" | `Workflows/VerifyDeploy.md` | Open URL in real Chrome, check for errors, capture screenshot evidence |
| "reproduce", "reproduce bug", "debug page", "check page", "blank screen" | `Workflows/Reproduce.md` | Open affected page BEFORE code analysis, capture console errors and network 404s |
| "record flow", "record workflow", "capture flow", "monitor start" | `Workflows/RecordFlow.md` | Record user actions via monitor system, export replayable plan script |
| "replay flow", "replay", "regression check", "run flow" | `Workflows/ReplayFlow.md` | Execute a recorded plan script step-by-step, verify each step, report regressions |
| "test form", "fill form", "form test", "check form" | `Workflows/TestForm.md` | Discover form fields, fill with test data, submit, verify result |
| "update", "check version", "rebuild" | `Workflows/Update.md` | Rebuild interceptor from source and verify |

---

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Interceptor","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```
