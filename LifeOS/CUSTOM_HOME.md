# Custom LifeOS Home — design & implementation notes

This document summarizes how LifeOS supports installing into a **custom home**
(a config root other than `~/.claude`, e.g. a project-scoped `~/Project/.claude`
so an isolated second LifeOS can live beside the global one), and how the
codebase was made root-agnostic. It is a reviewer-facing companion to the PR;
`INSTALL.md § 2.5` covers the user-facing launch story.

## The override

- **Env var `LIFEOS_HOME`** (highest priority) and **`install.sh --home <dir>`**
  (which exports it) select the config root. `detectEnv()` resolves
  `configRoot = LIFEOS_HOME || harness.configRoot || ~/.claude`.
- `configDir` (private USER data) follows the custom home
  (`<configRoot>/USER-data`), overridable with `--config-dir`, so two instances
  never share USER data — isolation is the whole point.

## Two layers had to become root-aware

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
- **Scenario B** — self-symlink guard (the `LIFEOS_CONFIG_DIR` double-meaning bug).
- **Scenario C** — default-install regression: with no `LIFEOS_HOME`, everything
  lands in `~/.claude` and the template ships byte-identical.
- **Scenario D** — Pulse runtime + launchd wiring: the resolver ships under the
  custom root, a PULSE module routes through it, and `manage.sh render` emits a
  plist with **zero** `.claude`, `WorkingDirectory` and `LIFEOS_DIR` pointing at
  the custom root, and no unresolved placeholder.
