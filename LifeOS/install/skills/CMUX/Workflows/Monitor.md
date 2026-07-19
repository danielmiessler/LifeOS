# Monitor

Poll a workspace's surfaces, classify each agent's state (idle / working / done / awaiting-input), and fire {{DA_NAME}} voice the moment one finishes or needs you. The observe-to-improve loop.

## Why

An agent you can't see is an agent you can't improve. A team of eight running in panes you never look at is eight silent black boxes — you learn they stalled, looped, or finished only when you happen to glance over. `monitor` closes that gap: it watches every surface for you and speaks up on the transitions that matter, so your attention goes to the agent that needs it, not to babysitting the ones that don't.

## The poll-not-event reality

cmux has no push or event-subscribe command. There is no "notify me when done" callback to register. So `monitor` **polls** — every `--interval` seconds it walks each surface, calls `surface-health`, reads the screen tail, and diffs the state against last pass. "Notifications" are transitions the poll loop detects, not events the app emits. This is a deliberate design constraint from the CLI, not a limitation of the wrapper.

## Steps

1. **Start the loop over a workspace:**

   ```bash
   bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts monitor --workspace beta --interval 3
   ```

   Each pass, per surface it runs `surface-health` + `read-screen` (tail) and classifies:
   - **idle** — shell prompt, no active work
   - **working** — output still moving / process running
   - **done** — completion marker in the tail (green tests, "done", finished prompt)
   - **awaiting-input** — a prompt is waiting on you (y/n, password, confirm)

2. **React on transition.** When a surface flips to `done` or `awaiting-input`, `monitor` calls `notifyVoice(msg)` — a fire-and-forget POST to Pulse:

   ```
   POST http://localhost:31337/notify  { message, voice_enabled: true }
   ```

   → {{DA_NAME}} speaks it. `beta/worker-2 finished` or `beta/lead awaiting input` comes over the speakers; you look only when told to.

3. **One pass, no loop.** For a scripted spot-check (e.g. inside another workflow), `--once` does a single classification pass and exits:

   ```bash
   bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts monitor --workspace beta --once
   ```

## How it feeds Pulse and voice

`monitor` doesn't replace the LifeOS dashboard — it feeds it. The classified surface states flow to Pulse (localhost:31337) the same way the old Kitty tab-state layer surfaced working/done/awaiting, and completion messages ride the existing `/notify` → {{DA_NAME}} TTS path. cmux is the new surface being watched; Pulse and voice stay exactly as they were. State in, dashboard + voice out.

## Worked example — babysit a race, hands-free

```bash
# a 5-agent race is running in workspace:7 (see AgentRace.md)
bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts monitor --workspace workspace:7 --interval 2
# ... you go do something else ...
# {{DA_NAME}}: "workspace:7 race-3 finished"   <- first done, voice fires
```

Then pull the winner:

```bash
bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts read --surface surface:32 --lines 80
bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts flash --workspace workspace:7   # mark it visually
```

Teams to monitor come from BootTeam.md (tiered) and Fleet.md (grids); the race pattern that pairs with hands-free monitoring is in AgentRace.md.
