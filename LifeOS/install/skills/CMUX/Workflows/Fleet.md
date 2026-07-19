# Fleet

Stand up named agent fleets — a local 2x2 (or larger) grid in one workspace, or a remote mini-fleet of SSH panes across your configured hosts. Each fleet is a reusable boot recipe.

## When

You want several agents laid out as a persistent, named team — `alpha`/`beta`/`gamma`/`delta` — either all on this machine in a grid, or spread across remote boxes over SSH.

## Local grid

1. **Boot a 2x2.** One cmd per cell, semicolon-separated:

   ```bash
   bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" fleet \
     --name alpha --grid 2x2 \
     --cmds "claude 'watch src/api';claude 'watch src/web';bun test --watch;btop"
   ```

   Creates workspace `alpha`, builds a 2x2 grid of surfaces, runs one cmd per cell, returns their refs. Fewer cmds than cells leaves the extras as empty shells; larger grids (`--grid 3x3`) scale the same way.

2. **Give it an identity.** Color, banner, and flash make a workspace recognizable at a glance:

   ```bash
   # visual attention pulse
   bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" flash --workspace alpha
   # theme/banner via the raw CLI when you want a named look
   cmux workspace-action --action set-theme --workspace alpha --title "ALPHA · API team"
   ```

3. **Add a browser pane.** Put an agent and a live browser side-by-side in the same workspace — the agent edits, the browser shows the result:

   ```bash
   cmux new-pane --type browser --direction right --workspace alpha --url http://localhost:5173
   ```

## Remote mini-fleet

Open one SSH pane per configured host — one workspace watching the whole fleet of remote boxes:

```bash
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" mini-fleet
```

Hosts come from `{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/CMUX/fleet.json`
(shape `{"hosts":[{"name":"box-a","ssh":"user@box-a"}]}`). No hostnames live in the skill itself — the config is private and user-owned. Override ad hoc with `--hosts`:

```bash
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" mini-fleet --hosts "user@box-a,user@box-b"
```

Each host becomes its own SSH pane; from there you `send`/`read` exactly like a local surface.

## Reusable boot recipes

A fleet command IS the recipe — save the exact `fleet` / `mini-fleet` invocation as a shell alias or a one-line script and re-run it to rebuild the same team. cmux also persists sessions on its own, so a rebuilt workspace can reattach rather than start cold. This replaces any `just`-style task runner: the bun command is the one-tap boot.

## Worked example — full-stack feature team

```bash
# 1. local 2x2: api agent, web agent, test watcher, logs
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" fleet \
  --name beta --grid 2x2 \
  --cmds "claude 'implement /orders API';claude 'build orders UI';bun test --watch;tail -f dev.log"

# 2. brand it + add a live preview browser
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" flash --workspace beta
cmux new-pane --type browser --direction right --workspace beta --url http://localhost:5173

# 3. spin up the remote mini-fleet to run the same feature on the fleet boxes
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" mini-fleet

# 4. watch all of it
bun "${LIFEOS_ROOT}/skills/CMUX/Tools/cmux.ts" monitor --workspace beta --interval 3
```

Three-tier teams (lead/worker layout) live in BootTeam.md; the observe loop lives in Monitor.md.
