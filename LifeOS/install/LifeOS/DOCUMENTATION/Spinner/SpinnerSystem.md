---
last_updated: 2026-07-02
last_updated_by: kai
last_reviewed: 2026-07-02
last_reviewed_by: kai
convention: pai-freshness-v1
---

# Custom Spinner Verbs

While LifeOS works, the statusline doesn't just show a generic spinner — it shows a custom animated **working-verb** with your own vocabulary, icon, color, and animation. It's a small thing that makes the system feel like yours instead of a stock tool. Alongside the verb, a rotating set of **tips** surfaces short, current facts about the system while you wait.

Verbs and tips are two distinct features that share the statusline:

- **Spinner verbs** — the animated working word ("Composing", "Forging", "Climbing") plus its icon, color, and animation.
- **Spinner tips** — the informational strings that rotate during longer work, kept in sync with the system's real state.

## Spinner verbs

The verb vocabulary and its styling are defined once as customization assets and pushed to the live config.

- **Source of truth:** `LIFEOS/USER/CUSTOMIZATIONS/Spinner/` — `verbs.json` (the working words), `icons.json`, `colors.json`, `anims.json`, plus a `README.md`.
- **Live config:** `settings.json` → `spinnerVerbs.verbs`.
- **Sync tool:** `LIFEOS/TOOLS/SyncSpinnerAssets.ts` pushes verbs/icons/colors/anims from the customization dir out to the live config and to downstream projects.
- **Statusline renderer:** `LIFEOS/LIFEOS_StatusLine.sh`.

To change the vocabulary, edit the customization JSON and re-run the sync tool — never hand-edit the live config, so the source stays canonical.

## Spinner tips

The tips are short informational strings shown during longer operations. They're kept accurate against the current system — skill counts, hook counts, version strings — by a dedicated maintenance workflow.

- **Live config:** `settings.json` → `spinnerTipsOverride.tips`.
- **Maintenance:** the `/ut` (UpdateTips) workflow in the `<your-release-skill>` skill audits and refreshes the tips against the current skill/hook/agent counts and versions. Run `/ut` after a system change so the tips never go stale.

## Related

- The statusline these render in is part of the overall system surface.
- Pulse — the Life Dashboard: `LIFEOS/DOCUMENTATION/Pulse/PulseSystem.md`
- LifeOS maintenance (the `/ut` workflow lives here): the `<your-release-skill>` skill.
