# BootTeam

Boot a 3-tier orchestrator → lead → worker agent team in one fresh cmux workspace, then drive it with send/read.

## When

You want a hands-on coding team (or a LifeOS agent team) laid out so you can watch every agent at once: a lead pane on the left, a worker column on the right, all in one workspace named after the team.

## Steps

1. **Boot the workspace.** One command lays out the whole team:

   ```bash
   bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts boot-team \
     --name auth-fix --cwd ~/Projects/App \
     --tiers orchestrator,lead,worker,worker
   ```

   This creates a workspace `auth-fix`, splits a lead pane on the left and a worker column on the right (one surface per `worker` in `--tiers`), and returns the ref + role of every surface. Auto-launches the app if it isn't running.

2. **Capture the refs.** The JSON is your address book — one `surface` ref per agent:

   ```json
   {"ok":true,"workspace":"workspace:3",
    "surfaces":[
      {"role":"orchestrator","surface":"surface:10"},
      {"role":"lead","surface":"surface:11"},
      {"role":"worker","surface":"surface:12"},
      {"role":"worker","surface":"surface:13"}]}
   ```

3. **Prompt the lead.** Send text and submit in one shot with `--enter`:

   ```bash
   bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts send --surface surface:11 --enter \
     "You lead this team. Break the JWT refresh bug into two tasks, hand one to each worker."
   ```

   Without `--enter`, text lands in the surface but doesn't run (send types, it doesn't submit). Always pass `--enter` for prompts.

4. **Fan out to workers.** Same pattern, one per worker surface:

   ```bash
   bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts send --surface surface:12 --enter \
     "Fix the token expiry check in src/auth/refresh.ts. Report back when green."
   ```

5. **Read them back.** Round-trip to see what any agent said or is waiting on:

   ```bash
   bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts read --surface surface:12 --lines 40
   ```

   Returns `{ok:true,text:"..."}` — the tail of that surface's screen.

## Flat comms

Every agent is just a surface, so **any agent can prompt any other agent** — there's no fixed hierarchy in the plumbing. A worker that finishes early can hand results straight to a peer:

```bash
# worker-1's own shell, pinging the lead that it's done
cmux send --surface surface:11 --enter "Task A merged, tests green. Free for more."
```

The tiers are a convention for how you lay out and think about the team, not a routing constraint. Orchestrator → lead → worker is the default flow; sideways and upward sends are always available.

## Worked example — fix a failing test suite

```bash
# 1. boot a 3-worker team over the repo
bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts boot-team \
  --name testfix --cwd ~/Projects/App --tiers lead,worker,worker,worker

# 2. tell the lead to triage (surface refs from the boot JSON)
bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts send --surface surface:21 --enter \
  "Read the 3 failing suites, assign one per worker (surfaces 22/23/24), track their status."

# 3. later, watch the whole team without switching windows
bun $LIFEOS_ROOT/skills/CMUX/Tools/cmux.ts monitor --workspace workspace:5 --once
```

Hand off long-running watching to `monitor` (see Monitor.md); boot a fleet of parallel teams with Fleet.md.
