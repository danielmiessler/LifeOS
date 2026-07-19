# Custom LifeOS Home — design & implementation notes

This document summarizes how LifeOS supports installing into a **custom home**
(a config root other than `~/.claude`, e.g. a project-scoped `~/Project/.claude`
so an isolated second LifeOS can live beside the global one), and how the
codebase was made root-agnostic. It is a reviewer-facing companion to the PR;
`INSTALL.md § 2.5` covers the user-facing launch story.

## The override

- **Env var `LIFEOS_HOME`** (highest priority) and **`install.sh --home <dir>`**
  (which exports it) select the config root. `detectEnv()` resolves
  `configRoot = --config-root || LIFEOS_HOME || CLAUDE_CONFIG_DIR ||
  dirname(LIFEOS_DIR) || ~/.claude`. `LIFEOS_DIR` is the persisted recovery path
  for later sessions after the bootstrap shell exits.
- `configDir` (private USER data) follows the custom home
  (`<configRoot>/USER-data`), overridable with `--config-dir`, so two instances
  never share USER data — isolation is the whole point. A direct custom
  `--config-root` or `CLAUDE_CONFIG_DIR` gets the same isolated default. The legacy poisoned
  `LIFEOS_CONFIG_DIR=<configRoot>/LIFEOS` value is ignored and repaired.

The bootstrap temporarily launches Claude Code with
`CLAUDE_CONFIG_DIR=<configRoot>` so `/lifeos-setup` can discover the staged skill
from any caller directory. The installed `lifeos` launcher preserves normal
global+project merging for `<project>/.claude` roots by starting from the project
parent; arbitrary custom roots use `CLAUDE_CONFIG_DIR` for the spawned process.

## Three layers had to become root-aware

**1. The install / deploy pipeline** (DetectEnv, DeployCore, InstallSettings,
InstallHooks, ScaffoldUser, LinkUser, DeployComponents). These already accept
`--config-root` / `--config-dir`; `InstallSettings` retargets the settings
template's `~/.claude` strings (env values, permission globs, guidance) and
`InstallHooks` retargets the payload's hook commands to `<configRoot>`. The
written `settings.json` must contain **zero** `~/.claude` references.

**2. The runtime layer** (the ~230 files under `LIFEOS/PULSE`, `LIFEOS/TOOLS`,
`hooks/`, `skills/*`, plus service plists and shell scripts). Historically each
computed `join(homedir(), ".claude")` inline, so a custom-home install would
still read/write `~/.claude` at runtime — leaking state (e.g. `MEMORY/STATE/…`)
into the wrong tree. This is the layer the PR makes root-agnostic.

**3. The instruction layer** — the model-read markdown (SKILL.md files, skill
workflows, `LIFEOS/DOCUMENTATION`, agents). These files carry literal shell
commands and file references like `bun ~/.claude/LIFEOS/TOOLS/Foo.ts`, and the
model executes them verbatim — on a custom-home install they fail (or worse,
touch a parallel default install). The payload markdown uses semantic path
placeholders in model-facing prose and tool instructions:

- `{{LIFEOS_DIR}}` → `<configRoot>/LIFEOS` — for everything under `LIFEOS/`.
- `{{LIFEOS_ROOT}}` → `<configRoot>` — for root-level paths (`skills/`,
  `hooks/`, `agents/`, `History/`, `Pulse/`, `settings.json`, `.env`, …).
- `{{LIFEOS_CONFIG_DIR}}` → the private USER-data home.

`LoadContext.hook.ts` grounds all three placeholders with their concrete values
at every `SessionStart`, including subagent sessions, and instructs the model to
resolve them before invoking Read/Edit/Write/Glob/Grep/Bash. Claude Code does
not natively substitute arbitrary `{{...}}` tokens; this is an explicit LifeOS
model-context contract. The settings template still carries `LIFEOS_ROOT`,
`LIFEOS_DIR`, and `LIFEOS_CONFIG_DIR` as environment variables for executable
shell code and runtime processes. As a fail-safe, `PreToolGuard.hook.ts` rejects
unresolved LifeOS placeholders in Bash commands and Read/Write/Edit/Glob/Grep
path fields before a tool can touch the wrong tree; placeholder text in document
content remains allowed.

The two layers stay deliberately distinct: prose and model tool paths use
`{{LIFEOS_*}}`; executable shell snippets use quoted variables such as
`"${LIFEOS_DIR}/TOOLS/Doctor.ts"`. A skill's own `SKILL.md` may use Claude
Code's native `${CLAUDE_SKILL_DIR}` substitution. Supporting workflow/reference
files do not rely on that substitution because they are loaded later through
Read rather than rendered as the skill entrypoint. Harness session storage is
rooted at `{{LIFEOS_ROOT}}/projects/`, so arbitrary `CLAUDE_CONFIG_DIR` installs
do not fall back to the real `~/.claude` tree.

## How we changed all the paths — one pattern, applied mechanically

There is a single source of truth for "where does LifeOS live", resolved in this
order (never a bare hardcode):

1. `CLAUDE_PLUGIN_ROOT` — packed-plugin install (flattened root plays `~/.claude`).
2. `LIFEOS_DIR` env → `dirname()` — set in `settings.json` env and every service
   plist, so all harness-spawned contexts resolve correctly.
3. **Self-location** — walk up from the module's own file location to the ancestor
   containing a `LIFEOS/` child. Covers a bare `bun Tool.ts` with no env, and is
   what stops hook state leaking into `~/.claude` when a hook runs detached.
4. `~/.claude` — plain-install default; byte-identical to the old behavior.

Concretely:

- **TypeScript runtime** — a dependency-free resolver `LIFEOS/TOOLS/lifeos-root.ts`
  (exports `claudeDir()`, `lifeosDir()`, `claudePath()`, …). The hooks tree keeps
  its own `hooks/lib/paths.ts` (`getClaudeDir()` / `getLifeosDir()`) so it survives
  the plugin packer's tree flattening; both share the same 4-step logic incl. the
  self-location fallback. Every file that hardcoded `join(HOME, ".claude", …)` was
  rewritten to route through the resolver via an **idempotent codemod** covering
  the idiom set (`join`/`resolve`/`path.join`/aliases, `${HOME}/.claude` template
  literals, `HOME + "/.claude"` concatenation). The codemod is conservative: it
  rewrites only well-defined path-building idioms and leaves comments, user-facing
  prose, string comparisons (`entry === ".claude"`), and regexes untouched.
- **launchd / systemd services** (Pulse, deriver, menu-bar) — the plist/service
  templates use a `__LIFEOS_DIR__` / `__CLAUDE_DIR__` placeholder (not
  `__HOME__/.claude`), and `manage.sh` / `manage-deriver.sh` / `MenuBar/install.sh`
  derive their target from the **script's own location** (they ship inside
  `<configRoot>/LIFEOS/PULSE`) and substitute it in. Plists also carry `LIFEOS_DIR`
  in their environment so the spawned process resolves the same root. `manage.sh
  render` prints the substituted unit without loading it (dry-run + test hook).
- **Shell scripts** — hardcoded `$HOME/.claude/LIFEOS` became
  `"${LIFEOS_DIR:-$HOME/.claude/LIFEOS}"` (env with default), or self-location
  where the script sits in the tree.
- **`Services.ts`** — the launchd control surface resolves its base via the
  canonical resolver instead of `join(HOME, ".claude")`.

## Backward compatibility

For a default install (`LIFEOS_HOME` unset), every path resolves to `~/.claude`
exactly as before — the resolver's default branch is byte-identical, the settings
template's `~/.claude` globs are left untouched, and hook commands still emit
`$HOME/.claude/...`.

## Verification

`Tools/InstallIntegrationTest.ts` (bun, throwaway `$HOME` under `mktemp`) proves it
end-to-end:

- **Scenario A** — full custom-home install; asserts everything lands under the
  custom root and the written `settings.json` has **zero** `.claude` references,
  the symlink contract holds, and nothing leaks to `<home>/.claude`.
- **Scenario B** — ambient legacy config-dir recovery plus explicit self-symlink guard.
- **Scenario C** — default-install regression: with no `LIFEOS_HOME`, everything
  lands in `~/.claude`; default permission globs and hook commands remain unchanged.
- **Scenario D** — Pulse runtime + launchd wiring: the resolver ships under the
  custom root, a PULSE module routes through it, and `manage.sh render` emits a
  plist with **zero** `.claude`, `WorkingDirectory` and `LIFEOS_DIR` pointing at
  the custom root, and no unresolved placeholder.
- **Lifecycle/edge checks** — execute both deployed resolvers with root env vars
  scrubbed, launch a fake Claude process through both the bootstrap and installed
  launcher, recover a later session from `LIFEOS_DIR`, repair the legacy default
  config-dir collision, verify direct `--config-root` / `CLAUDE_CONFIG_DIR`
  isolation, exercise a root containing spaces, audit statusline/runtime commands,
  and assert the packaged nested LifeOS installer matches the authoritative skill.

The current suite passes **93/93** checks.
