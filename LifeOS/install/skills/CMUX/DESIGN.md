# CMUX — migration + integration design

## Verdict

Switching to cmux gets us one thing Kitty never gave us: **programmatic control of the terminal itself** — send text into any pane, read the screen back, open and close surfaces, all over a socket. That turns a wall of terminals into an agent cockpit we can script. The cost is real but bounded: cmux is Mac-only, young, and has no event stream, so every "notification" is a poll loop we own. The recommended path is **replace the terminal layer only** — swap Kitty tab-state for cmux surface-state — and leave Pulse, voice, the Algorithm, and memory exactly where they are. Do it in phases, keep the Kitty hooks live until the cmux path is proven, and never rip out a working hook on a hunch.

## What cmux is

cmux is a **Mac GUI terminal app** (`com.cmuxterm.app`) you drive over a Unix socket. The socket only exists while the app runs; `cmux <path>` opens a directory and launches the app if it isn't up. Auth is a socket password from `--password`, `CMUX_SOCKET_PASSWORD`, or Settings.

The mental model is a four-level tree:

```
window ⊃ workspace ⊃ pane ⊃ surface
```

- **window** — an OS window.
- **workspace** — a named tab-group. Our convention: **one workspace per agent-team**.
- **pane** — a split region inside a workspace.
- **surface** — a tab inside a pane. A surface is either a **terminal** or an **in-app browser**.

The whole point is the **send / read / open-close loop**:

- `cmux send --surface <ref> "<text>"` types into a surface.
- `cmux send-key --surface <ref> Enter` submits it (send alone often doesn't run — you round-trip through read to confirm).
- `cmux read-screen --surface <ref>` reads the screen back.
- `cmux new-surface` / `close-surface` / `new-pane` open and close.

Two facts shape everything downstream. **Mac-only**: no Linux path, which matters for the remote fleet. **Poll, not event**: there is no subscribe command. "Agent finished" is discovered by polling `surface-health` + `read-screen` and matching idle/done markers. We design the monitor as a poll loop, full stop.

## Feature map — HIS features (the source video) → how we implement

Every wrapper subcommand below is `bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" <subcommand>`.

| # | Feature (his) | cmux mechanism | Our wrapper subcommand | Status |
|---|---------------|----------------|------------------------|--------|
| 1 | Programmatic agentic access (send/read/open-close) | `send` + `send-key` + `read-screen` + `new/close-surface` | `send`, `read` | staged |
| 2 | Three-tier orchestration (orchestrator→leads→workers) | one workspace, panes split lead-left / worker-column-right | `boot-team --tiers orchestrator,lead,worker,worker` | staged |
| 3 | Flat bidirectional comms (any agent prompts any agent) | `send` targets any surface ref by role | `send --surface <role-ref>` | staged |
| 4 | Agent-race / needle-in-haystack (first to solve wins) | N surfaces in one workspace, each running the launch cmd | `race --feature <f> --agents N` | staged |
| 5 | Fleet boot (2x2, named 8-agent teams) | grid of panes, one cmd per cell | `fleet --name <n> --grid 2x2 --cmds "a;b;c;d"` | staged |
| 6 | One-tap team boot (his `just fast cc`) | recipe wrapping new-workspace + splits | `boot-team` / `race` (bun recipes; no `just`) | staged |
| 7 | Notify / idle events → orchestrator | poll `surface-health`, classify, fire on transition | `monitor` → `voice` + Pulse | staged |
| 8 | Per-workspace color / identity / banner / flash | `themes`, `workspace-action`, `trigger-flash` | `flash`; themes via `boot-team` | staged |
| 9 | In-app browser beside the agent | `new-pane --type browser --url <url>` | `boot-team` browser pane option | staged |
| 10 | Reusable session files | cmux persists sessions; our recipes are the reusable boot | recipes = `boot-team`/`race`/`fleet` | staged |

His build system is `just`; we have no `just` and we are bun-always. So `just fast cc <feature>` becomes `bun cmux.ts boot-team` / `race`. Same outcome, our toolchain.

## Feature map — OUR features (LifeOS) → how they survive under cmux

| Our feature | Today | Under cmux | Keep / replace / bridge |
|-------------|-------|------------|-------------------------|
| Pulse dashboard | SSE `/api/algorithm/stream`, work.json registry (localhost:31337) | unchanged; cmux state polled → pushed into Pulse | **keep** + bridge |
| Voice notify | `POST localhost:31337/notify {message,voice_enabled}` → {{DA_NAME}} TTS | `monitor` calls the same endpoint via `voice` subcommand | **keep** |
| Algorithm / ISA phase tracking | `AlgoPhase.ts` + `ISASync.hook.ts` write phase to work.json + tab | phase logic untouched; only the *tab-paint* target changes | **keep** (retarget paint) |
| Model routing (EFFORT_MODEL) | max→fable / high→opus / medium→sonnet / low→haiku | orthogonal to the terminal; nothing changes | **keep** |
| Remote Mac-mini fleet | three hosts over SSH, names in USER config | `mini-fleet` opens one SSH pane per host | **keep** + bridge |
| Memory / learning capture | Stop-hook harvesters → MEMORY | orthogonal; fires regardless of terminal | **keep** |
| Kitty tab-state | `SessionAnalysis` / `SetQuestionTab` hooks paint Kitty tabs | cmux surface color/flash/rename replaces the paint surface | **replace** (staged) |

The load-bearing insight: almost everything we built lives **above** the terminal. Pulse reads work.json, voice hits an HTTP endpoint, the Algorithm writes phase to a registry. None of that knows or cares whether the terminal is Kitty or cmux. Only one subsystem is genuinely coupled to Kitty — the tab-state painter — and that is the only thing we replace.

## The replacement, precisely

The principal chose **replace the terminal layer only**. Here is the exact cut line.

**What gets replaced** — the Kitty tab-state painter:

- `hooks/PromptProcessing.hook.ts` (SessionAnalysis consolidated in) — paints working/completed/error onto the Kitty tab.
- `hooks/TabState.hook.ts` (absorbed SetQuestionTab 2026-07-11) — paints the awaiting-input (bold caps) state.
- `hooks/handlers/TabState.ts` — the Stop-time final-state detector.
- `hooks/lib/tab-setter.ts` — the `kitten @ set-tab-*` calls, `setModeToken`, `setPhaseTab`.

These drive Kitty tab **color / icon / title** to show agent state (working / completed / awaiting / error) plus the `N` / `E1..E5` mode-token owned by `TheRouter.hook.ts`. Under cmux the same signals map to surface-level equivalents: `rename-tab` for the title+token, `trigger-flash` for attention, `workspace-action` / `themes` for color-by-state.

**What stays, untouched:**

- Pulse (SSE, dashboard, work.json) — cmux feeds it, never replaces it.
- Voice (`/notify` → {{DA_NAME}} TTS).
- Algorithm phase logic, ISA phase tracking (the *decision* of what phase we're in).
- Model routing, memory, learning capture.
- `TheRouter.hook.ts` as the single authority for the mode/tier token — it keeps owning the *decision*; only the paint target moves.

**Why the cutover must be staged.** The Kitty hooks work today and are wired through a subtle single-authority contract: `TheRouter` owns the token, `PromptProcessing` owns the description, `AlgoPhase` + `ISASync` own the phase, each preserving the other's field. Ripping that out and repointing four hooks at an immature, poll-only, Mac-only target in one move is how you get a session with no visible state and no idea which layer broke. The safe path keeps both painters alive — Kitty and cmux writing in parallel — until the cmux path is proven across working, completed, awaiting, error, and every phase transition. Then Kitty is removed. A hook that paints state is cheap to run twice and expensive to get wrong once.

## Phased rollout

**Phase 0 — skill + wrapper (this session).**
Ships: the `CMUX/` skill, `Tools/cmux.ts` implementing the wrapper contract (ping, send, read, boot-team, race, fleet, mini-fleet, monitor, list/tree, flash, voice), auto-launch, and env/USER-config for fleet hosts + socket password.
Risk: low — nothing existing changes; the wrapper is additive.
Reversible: fully — delete the skill dir.

**Phase 1 — recipes in daily use.**
Ships: `boot-team` and `race` used by hand for real coding-agent teams; `mini-fleet` for the remote hosts. No hook changes yet.
Risk: low — cmux runs alongside Kitty; the two don't collide.
Reversible: fully — stop invoking the recipes.

**Phase 2 — cmux state → Pulse SSE bridge.**
Ships: `monitor` poll loop classifying each surface idle/working/done/awaiting, firing `voice` on transitions and pushing surface state into Pulse (work.json / SSE) so the dashboard shows cmux agents next to native sessions.
Risk: medium — poll cost and marker-heuristic false positives; a noisy classifier spams voice.
Reversible: high — the bridge is read-only into Pulse; turn off the monitor and Pulse just stops seeing cmux.

**Phase 3 — Kitty → cmux hook cutover.**
Ships: the four tab-state hooks paint cmux surfaces (rename-tab / flash / theme) in parallel with Kitty; after a proof window across all states and phases, Kitty paint is removed.
Risk: medium-high — this touches live, contract-bound hooks. Parallel-paint first is mandatory.
Reversible: medium — keep the Kitty code behind a flag for one release so a regression is a flag flip, not a revert.

**Phase 4 — mini-fleet panes + browser cockpit.**
Ships: `mini-fleet` as the standing fleet view (one SSH pane per host), plus agent+browser side-by-side panes (`new-pane --type browser`) for flows that need a live page next to the agent.
Risk: medium — depends on cmux SSH-pane stability and the browser surface maturing.
Reversible: high — these are additional panes, not replacements.

## Risks & open questions

- **Mac-only.** cmux has no Linux build. The local cockpit is Mac, fine. But the remote fleet is reached *over SSH into* cmux panes — cmux runs on the Mac, the panes hold SSH sessions to the hosts, so the hosts themselves never need cmux. Confirm we never assume cmux on the far side. Any future Linux workstation is a Kitty-or-nothing fallback, which argues for keeping the Kitty painter removable-but-recoverable.
- **Maturity / flakiness.** cmux is young (v0.62.2) and the source video showed a stalled orchestrator. Treat every recipe as needing a health check and a manual-recovery path. Don't build anything load-bearing on top until Phase 1 has logged real uptime.
- **Socket auth.** The socket only exists while the app runs, and auth is a password from env or Settings. The wrapper must auto-launch, poll `ping` to ~15s, and fail loud if the password is missing — never silently run unauthenticated. The password lives in env / USER config, never in the public Tools file.
- **Poll cost of `monitor`.** No event stream means we poll `surface-health` + `read-screen` on an interval. Too tight and we burn CPU and spam voice; too loose and "done" lands late. The interval is a tuning knob (default ~3s), and the classifier needs a debounce so a one-frame flicker doesn't fire a notification.
- **No native event stream — done-detection is heuristic.** We infer idle/done/awaiting from prompt strings and screen markers, which are brittle across shells and agent CLIs. Round-trip verification (send → read-back) is the only reliable confirm; bake it into `send --enter` and into `monitor`'s transition logic.
- **Send-without-submit gotcha.** `send` types but often doesn't run — a `send-key Enter` is required, and the only proof it ran is `read-screen`. Every recipe that submits a prompt round-trips to confirm rather than assuming.

---

**Status:** design only. Phase 0 (skill + `Tools/cmux.ts`) is the buildable unit; everything past Phase 1 is staged and gated on cmux proving out in daily use.

## Advisor risk addenda (2026-07-07 — E5 commitment-boundary review)

Sharp risks the first pass under-priced. Fold into the phase work before the Kitty cutover.

**Integration spine (build-on-claude-teams + session-JSON bridge):**
- **Session JSON is a private, uncontracted interface.** cmux does not promise that schema; it drifts on updates and the Pulse bridge breaks *silently*. Mitigation: pin the cmux version in SKILL.md, add a schema guard that **fails loud** — never let a schema miss degrade quietly into the poll fallback.
- **Torn reads.** Reading `session-*.json` while cmux writes it yields partial JSON. Parse-failure → bounded retry, never crash.

**Hook collision (the "voice says everything twice" bug):** during the staged window there are up to THREE hook sources on the same events — `cmux claude-teams`'s auto-injected Claude Code hooks, LifeOS's own hooks, and the still-live Kitty hooks. Without a dedup layer (keyed by event ID) or a documented precedence rule, you get duplicate Pulse entries and duplicate voice announcements. Staging *creates* this; it is not merely a cutover risk. Address before Phase 2.

**Kitty→cmux cutover blind spots:**
- **Liveness inversion.** Kitty is a terminal (up while you're logged in); cmux is a GUI app whose socket dies on quit/crash. Monitor + Pulse workflows need an explicit "socket gone" state with reconnect/auto-launch, or post-cutover LifeOS goes quietly deaf.
- **Identity mapping.** Anything in memory/Algorithm keyed to Kitty window/session IDs needs a mapping to cmux surface IDs, or Phase 3 orphans historical state.
- **Rehearsed rollback.** "Kitty hooks untouched" preserves the old path, but Phase 3 still needs a tested one-command rollback, not just an intact fallback.

**Security posture (conscious choice required):** setting a cmux socket password converts default-deny into *any local process holding the password can drive your agent fleet*. That is a real posture change — decide it deliberately, and the password must never land in the public skill (the grep passes now, but that is point-in-time).

**Verification honesty:** live-driving (boot-team/race/fleet/monitor) is offline-verified only; the `CMUX_SOCKET_PASSWORD` handshake code has never executed. Minimum bar before calling the cockpit proven: an authenticated `ping` + one `send`/`read` round-trip. Until then SKILL.md carries the "live-driving unproven" status.
