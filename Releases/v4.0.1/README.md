<div align="center">

# PAI v4.0.1 — Upgrade Path & Preferences

**Patch release: better upgrade experience, configurable temperature units, spinner tips sync, FAQ fixes.**

[![Skills](https://img.shields.io/badge/Skills-63-22C55E?style=flat)](../../skills/)
[![Categories](https://img.shields.io/badge/Categories-13-3B82F6?style=flat)](../../skills/)
[![Hooks](https://img.shields.io/badge/Hooks-21-F97316?style=flat)](../../hooks/)
[![Workflows](https://img.shields.io/badge/Workflows-338-8B5CF6?style=flat)](../../skills/)
[![Tips](https://img.shields.io/badge/Tips-202-10B981?style=flat)](../../)
[![Algorithm](https://img.shields.io/badge/Algorithm-v3.6.0-D97706?style=flat)](../../PAI/Algorithm/)

</div>

---

## What Changed

This is a patch release addressing community feedback from [Discussion #754](https://github.com/danielmiessler/Personal_AI_Infrastructure/discussions/754) about upgrade difficulties and missing preferences.

### 1. Upgrade Path Documentation

The main README now has separate **Fresh Install** and **Upgrading from a Previous Version** sections with explicit steps:

- Back up before upgrading
- The installer auto-detects existing installations
- `settings.json` merges intelligently (only installer-managed fields are updated)
- `USER/` files are never touched
- Post-upgrade checklist included

### 2. Temperature Unit Preference

New `preferences` section in `settings.json`:

```json
"preferences": {
  "temperatureUnit": "fahrenheit"
}
```

- **Installer asks** during the identity step — choose Fahrenheit or Celsius
- **Statusline honors the setting** — reads from `settings.json`, passes to Open-Meteo API, displays the correct °F or °C symbol
- **Existing users** can change it manually in `settings.json` at any time
- Default: `fahrenheit` (configurable during install)

### 3. Statusline Bug Fixes

Community-reported fixes from PRs [#762](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/762), [#780](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/780), and [#806](https://github.com/danielmiessler/Personal_AI_Infrastructure/pull/806):

- **Hardcoded timezone removed** — now reads `principal.timezone` from `settings.json` instead of hardcoded `America/Los_Angeles`
- **Broken context fallback removed** — the `/clear` command produced stale context percentages from a manual token calculation
- **Startup estimate removed** — the self-calibrating startup estimate cached previous session data, inflating fresh session context %
- **f-string syntax fix** — nested escaped double quotes inside Python f-strings caused parse errors on some shells

### 4. Spinner Tips Sync with Algorithm v3.6.0

Full audit and update of all 202 spinner tips in `settings.json` against the current system state:

- **21 stale tips fixed** — wrong counts (15→14 agents, 20→21 hooks, 77→21 skill categories), removed effort tiers (Instant/Fast no longer exist), non-existent agents (Intern), outdated ISC scales, wrong phase thresholds
- **14 new tips added** — Components system, LoadContext.hook.ts, hierarchical skill architecture, PRD format (8 frontmatter fields, 4 body sections), voice announcements, context compaction, SkillGuard/AgentExecutionGuard hooks, pack elimination
- **Algorithm version bumped** — v3.5.0 → v3.6.0 throughout
- **Zero sensitive data** — all template variables preserved (`{DAIDENTITY.NAME}`, `{PRINCIPAL.NAME}`, etc.)

### 5. FAQ Fixes

- **Removed stale Python reference** — PAI v4.0 is TypeScript and Bash, not Python
- **Improved "What if I break something?" answer** — Now explains that USER/ is preserved, settings merge not overwrite, and backup strategy

---

## Files Changed (from v4.0.0)

| File | Change |
|------|--------|
| `settings.json` | Added `preferences.temperatureUnit`, synced 202 spinner tips, Algorithm v3.6.0 |
| `statusline-command.sh` | Temp unit pref, dynamic timezone, context/startup/f-string fixes |
| `PAI-Install/engine/types.ts` | Added `temperatureUnit` to collected data and PAIConfig |
| `PAI-Install/engine/config-gen.ts` | Outputs `preferences` section |
| `PAI-Install/engine/actions.ts` | Temp unit prompt in identity step, preserves preferences on upgrade |

---

## Installation

### Fresh Install

```bash
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure/Releases/v4.0.1

cp -r .claude ~/ && cd ~/.claude && bash install.sh
```

### Upgrading from v4.0.0

```bash
# 1. Back up
cp -r ~/.claude ~/.claude-backup-$(date +%Y%m%d)

# 2. Clone and copy
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure/Releases/v4.0.1
cp -r .claude ~/

# 3. Run the installer
cd ~/.claude && bash install.sh

# 4. Rebuild CLAUDE.md
bun ~/.claude/PAI/Tools/BuildCLAUDE.ts
```

### Quick Manual Upgrade (from v4.0.0)

If you just want the temperature unit fix without re-running the installer:

1. Add to your `~/.claude/settings.json`:
```json
"preferences": {
  "temperatureUnit": "celsius"
}
```

2. Copy the updated `statusline-command.sh` from this release over your existing one.

3. Delete your weather cache to force a refresh:
```bash
rm -f ~/.claude/MEMORY/STATE/weather-cache.json
```

---

## Upgrading from Older Versions

See the [main README](../../README.md#upgrading-from-a-previous-version) for the general upgrade procedure. The installer auto-detects existing installations regardless of which version you're upgrading from.
