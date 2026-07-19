# AgentRace

Race N agents at the same problem in one workspace, first to solve wins, close the rest. The needle-in-haystack hotfix pattern: when you don't know which approach lands, launch several and keep the winner.

## When

A production bug where any one agent might solve it — but you can't predict which framing works. Instead of serial guessing, fan out N agents at once and take the first correct answer.

## Steps

1. **Launch the race.** One workspace, N surfaces, each running the same launch command against the same problem:

   ```bash
   bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" race \
     --feature checkout-500 --agents 4 --cwd ~/Projects/App \
     --cmd "claude 'The /checkout endpoint 500s on empty cart. Find and fix it.'"
   ```

   Creates the workspace, opens 4 surfaces, renames tabs `race-1`..`race-4`, starts `--cmd` in each, and returns their refs. If `--cmd` is omitted it uses a generic agent-launch placeholder you then `send` into.

2. **Capture the refs.**

   ```json
   {"ok":true,"workspace":"workspace:7",
    "surfaces":[
      {"tab":"race-1","surface":"surface:30"},
      {"tab":"race-2","surface":"surface:31"},
      {"tab":"race-3","surface":"surface:32"},
      {"tab":"race-4","surface":"surface:33"}]}
   ```

3. **Poll for a winner.** Watch all four; `monitor` classifies each surface idle/working/done/awaiting and fires {{DA_NAME}} voice the moment one hits `done`:

   ```bash
   bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" monitor --workspace workspace:7 --interval 3
   ```

4. **Capture the winning answer.** Read the surface that finished first:

   ```bash
   bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" read --surface surface:32 --lines 80
   ```

   Save the diff / explanation from `text`. That's the keeper.

5. **Close the losers.** Free the machine — pass each remaining surface to `close-surface`, or close the whole workspace once you've pulled the winner out:

   ```bash
   cmux close-surface --surface surface:30
   cmux close-surface --surface surface:31
   cmux close-surface --surface surface:33
   ```

## Why race instead of retry

Serial retries pay the full latency of each failed attempt before you learn anything. A race pays one attempt's latency total and lets the problem's own shape pick the winner — the agent whose framing fit the bug finishes first. You spend compute, not wall-clock.

## Worked example — production hotfix, users locked out

```bash
# 1. six agents at the login regression, each free to pick its own theory
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" race \
  --feature login-lockout --agents 6 --cwd ~/Projects/App \
  --cmd "claude 'Prod: all logins fail with 401 since the last deploy. Root-cause and patch.'"

# 2. watch; voice fires on first done
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" monitor --workspace workspace:9 --interval 2

# 3. race-4 solved it first — grab the fix
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" read --surface surface:44 --lines 100

# 4. close the other five, ship race-4's patch
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" flash --workspace workspace:9   # mark the winner visually
```

Watching mechanics live in Monitor.md; named parallel teams (not racing the same problem) live in Fleet.md.
