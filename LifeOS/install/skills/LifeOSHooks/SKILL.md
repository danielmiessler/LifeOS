---
name: LifeOSHooks
metadata:
  short-description: "Inspect and validate the LifeOS function-hook plugin, banner rendering, type declarations, and core sync. Excludes command-hook edits and Relay diagnostics."
version: 1.0.38
description: "The LifeOS function-hook plugin: check it is armed, explain why a line or banner was or was not drawn, regenerate its types after a Claude Code update, sync pure-core copies, run its probes. USE WHEN function hooks, LifeOSHooks, the plugin, hook-drawn lines, banner missing, memory line missing, plugin types, /plugin-types, plugin validate, is the plugin loaded, hooks module. NOT FOR the command hooks under hooks/ (edit directly), the Pulse dashboard (Pulse), or Relay diagnostics (the relay skill)."
---

# LifeOSHooks

Diagnoses the LifeOS function-hook plugin, the in-process half of the hook system (one hooks module Claude Code's function-hook runtime loads once per interactive session; the command hooks under `hooks/` remain the out-of-process half): whether it is armed, why a line or banner did or did not draw, and keeping its types and pure-core copies current. State of record: `LIFEOS/FUNCTIONHOOKS/ISA.md` (maintainer-side; the ISA does not ship).

## Ideal State

- A status answer ("is the plugin loaded and working") says armed or not, on which build, and names its evidence: this session's stamp in `MEMORY/STATE/function-hooks/<session>.json` (the command hooks read it to go quiet on the lines the plugin draws), `hooks/lib/build.ts`, and for a headless check the probe's debug log. A verdict with no evidence fails.
- The check holds the plugin to its standing properties: armed in every interactive session on the declared build, and in a headless session (`-p`, the SDK, Relay) every hook a passthrough with nothing drawn.
- A "why did or didn't this draw" answer names the surface that owns the line (§ References) and the cause it found; a guess is labelled as one.
- After a Claude Code update, `.claude/types/claude-code.d.ts` was written by the running build, `hooks/lib/build.ts` names that build, and the typecheck and tests pass; the answer names the old and the new build.
- `claude plugin validate <plugin dir>` passes; its hooked-events list matches the ISA's closed criteria (`/ic` checks this).
- The pure-core copies under `hooks/lib/` equal their sources (`tests/parity.test.ts`; source tree only, not in the public release payload).

## Anti-criteria

- No diagnostic `$.ui.log` line is ever added to the live module, not even for one probe run. In any session that loads the edited module (§ Gotchas, reload), every `$.ui.log` line prints into the principal's transcript: one temporary diagnostic line, printed once per tool call, filled the screen (2026-10-02). Probe in a copy run with `claude --plugin-dir <copy>` and `--debug-file`, or put the diagnostic in `pushEvent`, which only reaches the events log.
- A report never tells the principal a save already reloaded an open session; a check of a change in a live session starts with `/reload-plugins` (2026-10-11: a pane removed on disk kept drawing its old text in open sessions until a reload).

## Intent Routing

This skill is its own single intent; its context files:

| File | Read when |
|------|-----------|
| `References/ModuleGotchas.md` | editing the hooks module, or a draw, repaint or hand-over question the § References list below does not answer: engine API shapes, registration rules, scrollback and repaint behaviour |
| `Setup.md` | installing the plugin on a new machine, or filling in this install's loading topology in the USER Config.md |

## Tool contract

- Validate: `claude plugin validate <plugin dir>` (lists every hooked event and `$` call).
- Typecheck: `cd <plugin dir> && bunx tsc --noEmit -p tsconfig.json`.
- Tests (source tree only; they are not in the public release payload): `cd <plugin dir> && bun test ./tests`. Running them from the install root hit EMFILE (2026-10-01).
- Sync cores after editing a source: `bun <plugin dir>/scripts/SyncCores.ts`.
- After a Claude Code update: the plugin declarations are Claude Code's own and never ship with the plugin; each install generates its own from the build it runs. `/plugin-types` is gone since 2.1.287, so the source is the running build's `plugin-authoring` skill, which provides that build's declarations when it loads: put them at `.claude/types/claude-code.d.ts` (their first line names the build), set `TYPES_BUILD` in `hooks/lib/build.ts`, typecheck, and run the tests (2026-10-01). The MCP declarations (`.claude/types/claude-code-mcp.d.ts`) copy connector tool descriptions verbatim, and some connectors (Slack) embed the logged-in account's user id in them; replace any such id with `<slack-user-id>` before the file is committed (2026-10-13).
- Headless probe: `claude -p "Reply OK." --plugin-dir <plugin dir> --debug-file <log> --max-turns 1`, then grep the log for `settled` and `failed to load`.
- Host I/O from the module goes only through `LIFEOS/TOOLS/HookBridge.ts <verb>`.

## Setup

Needs Claude Code at or above the build named in `hooks/lib/build.ts` (`MIN_BUILD`) and bun. The plugin holds no personal data; its one user setting is `forceBackground` in its plugin manifest (`.claude-plugin/plugin.json`, or the marketplace entry when the install keeps the manifest there), off by default.

1. Load it. Either put this folder under the skills directory, where Claude Code loads it as `LifeOSHooks@skills-dir` and hot-reloads it on every save, or list it in a folder marketplace (`claude plugin marketplace add <folder>`, then `claude plugin install <name>@<marketplace>`) and disable the `skills-dir` copy so only one loads.
2. Record how it loads: with a folder marketplace, fill in `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/LifeOSHooks/Config.md` (marketplace, mods loaded from it, disabled `skills-dir` copies, reload consequence); `Setup.md` § Fill in documents every line. Loaded straight from the skills folder, the file is optional.
3. Check it: `claude plugin validate <plugin dir>`, then the headless probe in § Tool contract. Success is a `settled` line and no `failed to load` line in the debug log.

## References

Which surface owns each line and decision. Build-specific numbers live in the ISA (redraw timers, scan counts) and in the module constants (the reaper interval: `hooks/LifeOSHooks.ts` `TREE_MS`).

- Nothing in the answer block is drawn by the plugin: the banner is the model's own first line and the 🗣️ closer its last. Memory and health lines are logged, not drawn (the board pane that showed them was removed 2026-10-11), the interview chip is on the statusline, the ⚙️ ledger is logged, and the band above the prompt carries only the ISA chip.
- The plugin toasts each ascent-state transition (the statusline draws the ascent strip), puts the Security Protocol and a data-class ceiling into every subagent brief. It no longer tags MCP and web results as data or marks the session after an outside read (retired 2026-10-24; the Security Protocol governs outside content, see `LIFEOS/DOCUMENTATION/Hooks/HookSystem.md` § Native enforcement).
- The plugin rewrites a Bash command in five ways, each shown on the tool row's dim mark: npm and npx become bun, an `export LIFEOS_DISPATCH_ID=...;` prefix binds a codex-backed run to its dispatch, git and gh status paths go through `rtk`, `[REDACTED-SECRET-xxxx]` tags are swapped back to the real values the principal's own prompt carried, and a subagent's commands are wrapped in `sandbox-exec` (macOS only, and only with `LIFEOS_SUBAGENT_SANDBOX=on`; otherwise they run unwrapped with a before-and-after detector).
- Refusals: the plugin refuses sweeping `git add`, a plain `git commit` in the private trees, a `gh` comment with no agent attribution, and a WebFetch carrying a secret tag. Taint tracking (TaintGuard and the plugin's mark) retired 2026-10-24: no hook judges outbound Bash after an outside read; native permission rules hold the outbound actions. In a headless session the plugin is not armed and passes every call through.
- Stray processes: every `TREE_MS` the poller hands `LIFEOS/TOOLS/SessionTree.ts` (the `session-tree` bridge verb) the feed's own agent statuses and stop times, plus its record of which subagent ran each Bash command. The reaper kills this session's `orphaned` and `agent-stopped` processes and writes the state file Vigil's `running` adapter reads. The 1 s agent poll writes each agent's one `subagent_stop` row. Nothing in LifeOS draws agents, workflows or running shells: Claude Code's /tasks, /workflows, agent panel, Bash pill and spinner show them (2026-10-11).
- Routes: the DISPATCH line carries provider, model and reasoning effort from `hooks/lib/route-label.ts`. A mark is ✓ only on codex's own session log or the engine-resolved model (`LIFEOS/TOOLS/RouteTrail.ts`), and a helper run carries `LIFEOS_DISPATCH_ID` so it binds to its own dispatch.

## Gotchas

- **Whether an open session runs the current module depends on how the plugin loaded.** This install's loading topology (which marketplace, which mods, which skills-folder copy is disabled) is recorded in `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/LifeOSHooks/Config.md` (`configRoot` is `$CLAUDE_CONFIG_DIR` when set, else `~/.claude`); read it before answering a reload question. A plugin loaded from a folder marketplace reaches no open session until `/reload-plugins` there (2.1.287+); `claude plugin update` reports "nothing to update" because it reads the folder at load (§ Anti-criteria holds the reporting rule). A plugin loaded straight from a skills folder (`LifeOSHooks@skills-dir`) is watched instead (plugin-authoring reference, 2.1.296): every save, from any session, hot-reloads the module in every open session and prints a `<plugin>: reloaded (N hooks: …)` line into each transcript. The marketplace wiring is a folder marketplace listing this folder by relative path (`claude plugin marketplace add <folder>`, then `claude plugin install <name>@<marketplace>`) with the `<name>@skills-dir` copy disabled in settings, so the module never loads twice; `/ic` plugin-load holds it wherever `.claude-plugin/marketplace.json` exists. Because the loaded module can lag the file, a native command hook never fast-exits on the bare stamp: it reads `hookCovers(sid, cap)`, and the cap is written by `HookBridge prompt-context`, which only the module that hands the work over calls. Adding a new hand-over means adding a cap (`hooks/lib/function-hooks.ts` `HookCap`), never a stamp check.
- Transcript redaction (ISC-45) replaces a pasted secret with a tag in every model-facing row. It reduces what reaches disk and is no guarantee, so a secret pasted into a prompt is still treated as exposed and rotated. A plugin reload drops the tag map; a literal tag then runs harmlessly and the tool fails on it, which is the visible signal to paste the value again. Since 2026-09-07 (ISC-49) tool results are walked too: a key that a Bash, Read or WebFetch returns is tagged before the model sees it, and the tag swaps back in Bash, Write and Edit (never WebFetch, which is refused). Shapes only (`SECRET_VALUE_SHAPES`), never entropy, emails or IPs. Since 1.3.1 a tag remembers where it was minted: a value a tool read swaps back into Bash only when it is shell-inert (letters, digits and `._~+=/%:-`), because text an outside author chose must never run as shell through the model's quoting; a pasted value swaps back as before, and the refusal says to paste the value or write it to a file. A brief that carries a tag is refused on the PUBLIC lane, and no tag swaps back inside a PUBLIC-lane agent.
- Module-authoring facts (engine API shapes since 2.1.273 and 2.1.280, registration rules, scrollback and repaint behaviour, the model-call and band rules) live in `References/ModuleGotchas.md`.

## Examples

```
User: "is the plugin loaded and working this session"
→ Verdict: armed on build <N> (or not), with the stamp file's caps for this session and `hooks/lib/build.ts` quoted; a headless probe's `settled` / `failed to load` lines when the question is about a fresh session
```

```
User: "types mismatch 2.1.261 vs build 2.1.263 statusline warning"
→ Declarations for 2.1.263 regenerated from the running build's plugin-authoring skill, `TYPES_BUILD` set to 2.1.263, typecheck and tests pass; the answer names both builds
```

```
User: "why is the memory line missing"
→ The memory line is logged, not drawn anywhere: the 🧠 chip left the statusline on 2026-09-20 and the board pane on 2026-10-11, so the answer points at the per-session lines MemoryTurnStart writes (`HookBridge memory-line <sid>`), not at the plugin or the statusline
```
