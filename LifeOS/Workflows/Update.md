# Update — idempotent re-overlay after a version bump

Brings an existing install up to the current LifeOS version without touching the user's data. Safe to run repeatedly.

## Voice notification (first action)

```bash
curl -s -X POST http://localhost:31337/notify -H "Content-Type: application/json" \
  -d '{"message": "Running the Update workflow in the LifeOS skill to update your install"}' > /dev/null 2>&1 &
```

## Steps

Every tool call in this workflow uses the values returned by DetectEnv: pass
`--config-root <configRoot>` everywhere, plus `--config-dir <configDir>` to
`ScaffoldUser`/`LinkUser`/`SeedPulse`. Never reconstruct either path from
`~/.claude`. A custom session persists its root through `LIFEOS_HOME` and
`LIFEOS_DIR`, but explicit flags keep the update deterministic.

1. **DetectEnv** — `bun Tools/DetectEnv.ts`. Record `configRoot` and `configDir`. If `isDevTree` → STOP (the source repo updates itself via git, not this workflow).
2. **Version diff** — the skill carries no version field and there is no plugin manifest; versioning lives at the distribution layer (the GitHub release tag + `LIFEOS_RELEASES/<version>/` + the `install.sh` fetch's `LIFEOS_VERSION`). Compare the release version being updated to against the user's current install marker. If equal, report "already current" and exit.
3. **Re-overlay system** — re-copy the system templates (CLAUDE, system prompt, `settings.system.json` minus hooks) using `bun Tools/InstallSettings.ts --config-root <configRoot> --config-dir <configDir>` for settings. These are system-owned and safe to overwrite. The settings tool also repairs the legacy `LIFEOS_CONFIG_DIR=<configRoot>/LIFEOS` collision when encountered.
4. **Re-merge hooks** — `bun Tools/InstallHooks.ts --config-root <configRoot>` (idempotent): adds new hook entries, leaves existing ones, never duplicates (normalized-command dedup). Backs up `settings.json` first.
5. **Scaffold new USER templates only** — `bun Tools/ScaffoldUser.ts --config-root <configRoot> --config-dir <configDir>` copyMissing: adds any NEW template files introduced by the version, never overwrites the user's existing files.
6. **Re-activate imports** — `bun Tools/ActivateImports.ts --config-root <configRoot>` for any newly-shipped identity import lines.
7. **Verify** — two evidence classes (hooks fire + imports resolve), same as Setup step 9.

## Rule
Update is **additive and non-destructive**. It never removes user customizations, never overwrites user data, never deletes hooks the user added. The only files it overwrites are system-owned templates.
