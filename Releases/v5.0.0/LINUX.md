# PAI v5.0.0 on Linux / Ubuntu

PAI v5.0.0 was primarily packaged around macOS assumptions. Linux exposes those assumptions because common Linux filesystems are case-sensitive and headless/server installs do not always have `zsh`, Electron desktop libraries, or launchd.

## Recommended Ubuntu/headless install

From `Releases/v5.0.0/.claude`:

```bash
bash install-linux.sh
```

This wrapper forces the TypeScript installer into CLI mode, avoids the macOS/zsh-oriented post-install handoff, and runs the Linux hotfix script after the wizard completes.

## Repair an existing v5 install

```bash
bash ~/.claude/PAI/TOOLS/linux-hotfix.sh
```

The hotfix is idempotent. It can be run more than once.

It repairs the known v5.0.0 Linux runtime issues:

- creates compatibility symlinks such as `Pulse -> PULSE` and `Tools -> TOOLS`;
- patches `PAI/PULSE/run-job.ts` to use the shipped `PULSE` directory;
- creates missing root and Pulse `package.json` files when absent;
- removes a known self-referential Observability `.cursor` symlink;
- fixes shell aliases that point at `PAI/Tools` or `PAI/Pulse`;
- expands literal `$HOME` / `${HOME}` values in `settings.json` env values when `jq` is available;
- runs best-effort `bun install` in the root `.claude` and `PAI/PULSE` directories.

## Health check

```bash
bash ~/.claude/PAI/TOOLS/pai-v5-doctor.sh
```

The doctor script does not mutate the installation. It checks for the known release-contract failures and exits non-zero if hard failures remain.

## Pulse smoke test

```bash
cd ~/.claude/PAI/PULSE
bun install
bun run run-job.ts cost-aggregation
bun run pulse.ts
```

Then in another terminal:

```bash
curl -s http://localhost:31337/api/pulse/health || curl -s http://localhost:31337/healthz
```

## Notes

`git config core.ignorecase true` is not a runtime fix. It may change how Git detects case-only renames, but it does not make Linux resolve `PAI/Pulse` when only `PAI/PULSE` exists.

For a clean upstream fix, every path should use one canonical casing and the release should be smoke-tested in a fresh Ubuntu container before publishing.
