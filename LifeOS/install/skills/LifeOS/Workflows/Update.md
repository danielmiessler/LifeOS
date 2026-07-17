# Update — idempotent re-overlay after a version bump

Brings an existing install up to the current LifeOS version without touching the user's data. Safe to run repeatedly.

## Voice notification (first action)

```bash
curl -s -X POST http://localhost:31337/notify -H "Content-Type: application/json" \
  -d '{"message": "Running the Update workflow in the LifeOS skill to update your install"}' > /dev/null 2>&1 &
```

## Steps

1. **DetectEnv** — `bun Tools/DetectEnv.ts`. If `isDevTree` → STOP (the source repo updates itself via git, not this workflow).
2. **Release check** — the skill carries no version field and there is no plugin manifest; versioning lives at the distribution layer, so BOTH sides of the diff must come from it:
   - **Installed version**: read `<configRoot>/LIFEOS/VERSION` (the install marker, shipped since 7.1.1). Absent → the install predates the marker; treat it as behind and continue.
   - **Latest version**: read `tag_name` from `https://api.github.com/repos/<LIFEOS_REPO>/releases/latest` — the same endpoint the bootstrap resolves against (`LIFEOS_REPO` defaults in `install/install.sh`).
   - **Equal** → report "already current" and exit.
   - **Behind** → fetch the newer payload FIRST: run the shipped bootstrap, `bash <skillRoot>/install/install.sh`. It is additive — it replaces only the LifeOS skill dir and backs up the prior one. Then re-read the NEW skill's `Workflows/Update.md` and continue from its step 3 (steps may have changed between versions).
   - **Network unreachable** → say so and continue with the on-disk payload; re-applying the current version is safe, it just can't deliver anything newer.

   Never diff the on-disk payload's version against the install marker — the payload is what wrote the marker, so that comparison always says "already current" and the update never fetches anything.
3. **Re-overlay system** — re-copy the system templates (CLAUDE, system prompt, `settings.system.json` minus hooks), and overwrite `<configRoot>/LIFEOS/VERSION` with the payload's version — the copyMissing deploys never touch an existing marker, and a stale marker re-trips step 2 forever. These are system-owned and safe to overwrite.
4. **Re-merge hooks** — `bun Tools/InstallHooks.ts` (idempotent): adds new hook entries, leaves existing ones, never duplicates (normalized-command dedup). Backs up `settings.json` first.
5. **Scaffold new USER templates only** — `bun Tools/ScaffoldUser.ts` copyMissing: adds any NEW template files introduced by the version, never overwrites the user's existing files.
6. **Re-activate imports** — `bun Tools/ActivateImports.ts` for any newly-shipped identity import lines.
7. **Verify** — two evidence classes (hooks fire + imports resolve), same as Setup step 9.

## Rule
Update is **additive and non-destructive**. It never removes user customizations, never overwrites user data, never deletes hooks the user added. The only files it overwrites are system-owned templates.
