---
name: CMUX
version: 1.0.2
description: "Drives cmux as an agent cockpit to boot, race, and monitor visible agent teams. Mac-only. USE WHEN cmux, agent cockpit, boot an agent team, orchestrate agents, three-tier orchestration, agent race, needle-in-haystack hotfix, agent fleet, 2x2 fleet, watch/monitor my agents, scale compute to scale impact, send a prompt to a running agent, multiplexer, terminal cockpit, orchestrator lead worker. NOT FOR one-shot in-harness subagents with no terminal to watch (use Delegation/Agent/Workflow), the Pulse dashboard itself (cmux feeds it, use Pulse), browser deploy-verification (use Interceptor), or Linux/Windows (cmux is Mac-only — use tmux)."
---

# CMUX

Make cmux the cockpit for every agent — LifeOS's own and your hands-on coding teams. One command boots a named, color-identified workspace of agents you can *see, prompt, and steer*, because an agent you can't see is an agent you can't improve. {{DA_NAME}} drives them through cmux's real send/read/open-close loop; a poll-based monitor speaks up when they finish.

Everything routes through one wrapper: `bun "${CLAUDE_SKILL_DIR}/Tools/cmux.ts" <subcommand>`. It auto-launches the cmux app — but cmux's socket is **default-deny**, so driving it needs auth (see the first Gotcha).

> **Status (2026-07-07):** built and offline-verified — wrapper is type-clean (`tsc`/`bun build`), `voice` works live, public-clean grep passes, Kitty hooks untouched. **Live-driving (boot-team/race/fleet/monitor) is UNPROVEN** — it needs the socket-auth handshake, which has not yet executed. To prove it: run the wrapper *inside a cmux surface* (inherits auth), or set a cmux Settings socket password → `CMUX_SOCKET_PASSWORD`. **Security note:** a socket password lets any local process holding it drive your whole agent fleet — set it deliberately and never commit it to a public file.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "boot a team", "3-tier team", "orchestrator/lead/workers" | `Workflows/BootTeam.md` |
| "race agents", "hotfix race", "throw N agents at this", "needle in a haystack" | `Workflows/AgentRace.md` |
| "fleet", "2x2 fleet", "named teams", "the remote fleet", "mini-fleet" | `Workflows/Fleet.md` |
| "watch/monitor my agents", "tell me when they're done", "observe to improve" | `Workflows/Monitor.md` |

## Quick Reference

```bash
CT="${CLAUDE_SKILL_DIR}/Tools/cmux.ts"
bun $CT ping                                             # ensure cmux is up (auto-launches)
bun $CT boot-team --name debug --tiers orchestrator,lead,worker,worker
bun $CT race --feature login-500 --agents 4             # first-to-solve wins
bun $CT fleet --name alpha --grid 2x2 --cmds "claude;codex;claude;bun test --watch"
bun $CT mini-fleet                                       # SSH panes from USER fleet.json
bun $CT send --surface workspace:1/surface:2 "run the tests" --enter
bun $CT read --surface workspace:1/surface:2 --lines 40
bun $CT monitor --workspace workspace:1                  # poll + {{DA_NAME}} voice on done
bun $CT flash --workspace workspace:1                    # visual attention
```

**The loop that makes it work:** `send` (type a prompt) → `send-key Enter` (submit — `--enter` does both) → `read` (see the result) → `close-surface` (tear down). That send/read/open-close cycle is the whole programmatic-access story; the recipes are just it, composed.

**What stays underneath (not replaced):** Pulse (localhost:31337) is still the dashboard, {{DA_NAME}} voice still fires via `/notify`, the Algorithm/ISA/memory/model-routing are untouched. cmux replaces the *terminal-watching layer*, not the system. See `DESIGN.md` for the full feature map and the staged Kitty→cmux migration.

## Gotchas

- **`send` types but does not submit.** cmux `send` puts text in the surface; it does not press Enter. Always use `--enter` (or a follow `send-key Enter`) when you mean to run the prompt, then `read` to confirm it actually ran. A `send` with no Enter that claims "the agent is working" is a false done-claim.
- **The socket is default-DENY — this is the #1 gotcha.** Even while the app runs, an outside process gets `Access denied — only processes started inside cmux can connect`. Two ways through: (a) **run the orchestrator inside a cmux surface** — it inherits auth via a tagged `CMUX_SOCKET_PATH` env, no password; or (b) set a **socket password** in cmux Settings and export it as `CMUX_SOCKET_PASSWORD` (the wrapper passes `--password`). The socket also only exists while the app runs (`cmux.sock` absent when closed). Pick (a) for agent-driven work, (b) for external scripting.
- **cmux is push-native — prefer hooks over polling.** Launch Claude agents with `cmux claude-teams` and cmux auto-injects Claude Code lifecycle hooks (`SessionStart/Stop/Notification/UserPromptSubmit/... → cmux claude-hook <event>`), so agents report their own status. Also available: tmux-style `set-hook <event> <cmd>`, a blocking `wait-for -S <name>`, `pipe-pane --command`, and OSC `9/99/777` escapes. `monitor`'s `surface-health` + `read-screen` poll is the FALLBACK for non-Claude agents, not the primary path.
- **Sidebar metadata is a no-auth Pulse bridge.** `report_meta` / `report_meta_block` / `set-status` / `set-progress` / `log` write agent status/progress into the workspace sidebar and persist to the session JSON at `~/Library/Application Support/cmux/session-*.json` — which is **readable without the socket**. LifeOS reads that file to mirror cmux agent state into Pulse without touching the auth wall.
- **Mac-only.** cmux is a macOS app. The remote fleet still runs LifeOS, but cmux drives it via local SSH panes, not by running cmux on the minis. No Linux/WSL — that path is tmux.
- **Refs are positional and can shift.** `workspace:1/surface:2` indexes move as you open/close things. For anything long-lived, resolve UUIDs (`--id-format uuids`) from `tree` and hold those.
- **Public skill — private specifics live in USER config.** The remote fleet's hosts come from `{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/CMUX/fleet.json` (`{"hosts":[{"name","ssh"}]}`), never from this skill's files. The socket password comes from `CMUX_SOCKET_PASSWORD`.

## Examples

**Boot a debugging team and drive the lead:**
```
User: "boot a cmux team to chase the flaky test"
→ bun $CT boot-team --name flaky --tiers orchestrator,lead,worker,worker
→ bun $CT send --surface <lead-ref> "find why auth.test.ts flakes; delegate repro to a worker" --enter
→ bun $CT monitor --workspace <ws>   # {{DA_NAME}} voice when the lead reports back
```

**Race a production hotfix:**
```
User: "prod login is 500ing — race it"
→ bun $CT race --feature login-500 --agents 4
→ (four agents attack the same repo; first with a root cause wins)
→ bun $CT read --surface <winner> ; close the losers
```

**Full reference for the migration and feature map:** `DESIGN.md`.
