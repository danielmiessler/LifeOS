<div align="center">

# PAI v4.0.3 — Community PR Patch

**4 community-contributed fixes: JSON parsing, dead references, portability, upgrade migration.**

[![Skills](https://img.shields.io/badge/Skills-63-22C55E?style=flat)](../../skills/)
[![Categories](https://img.shields.io/badge/Categories-13-3B82F6?style=flat)](../../skills/)
[![Hooks](https://img.shields.io/badge/Hooks-21-F97316?style=flat)](../../hooks/)
[![Workflows](https://img.shields.io/badge/Workflows-338-8B5CF6?style=flat)](../../skills/)
[![Tips](https://img.shields.io/badge/Tips-202-10B981?style=flat)](../../)
[![Algorithm](https://img.shields.io/badge/Algorithm-v3.6.0-D97706?style=flat)](../../PAI/Algorithm/)

</div>

---

## What Changed

Community-contributed fixes from open PRs — no new features, no breaking changes.

### Inference & Parsing

| PR | Fix |
|----|-----|
| [#800](https://github.com/danielmiessler/PAI/pull/800) | `Inference.ts` JSON parsing only matched objects `{}` — now handles arrays `[]` too, with validation via `JSON.parse` |

### Documentation & Portability

| PR | Fix |
|----|-----|
| [#836](https://github.com/danielmiessler/PAI/pull/836) | `CONTEXT_ROUTING.md` had 29 dead references to files removed in v4.0 — consolidated to 4 README pointers |
| [#817](https://github.com/danielmiessler/PAI/pull/817) | `WorldThreatModelHarness` hardcoded `~/.claude/` path — now uses `$PAI_DIR` for portability |

### Installer

| PR | Fix |
|----|-----|
| [#846](https://github.com/danielmiessler/PAI/pull/846) | Upgrading from v2.5/v3.0 stranded user context at `skills/PAI/USER/` — installer now migrates files to `PAI/USER/` and creates symlinks for backwards compatibility |

---

## Files Changed (from v4.0.2)

| File | Fixes |
|------|-------|
| `PAI/Tools/Inference.ts` | #800 (JSON array parsing) |
| `PAI/CONTEXT_ROUTING.md` | #836 (dead reference cleanup) |
| `skills/Thinking/WorldThreatModelHarness/SKILL.md` | #817 (PAI_DIR portability) |
| `PAI-Install/engine/actions.ts` | #846 (user context migration) |

---

## Installation

### Fresh Install

```bash
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure/Releases/v4.0.3

cp -r .claude ~/ && cd ~/.claude && bash install.sh
```

### Upgrading from v4.0.x

```bash
# 1. Back up
cp -r ~/.claude ~/.claude-backup-$(date +%Y%m%d)

# 2. Clone and copy
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure/Releases/v4.0.3
cp -r .claude ~/

# 3. Run the installer
cd ~/.claude && bash install.sh

# 4. Rebuild CLAUDE.md
bun ~/.claude/PAI/Tools/BuildCLAUDE.ts
```

### Quick Manual Upgrade (from v4.0.2)

Copy these files from this release over your existing ones:

- `PAI/Tools/Inference.ts` — JSON array parsing fix
- `PAI/CONTEXT_ROUTING.md` — dead reference cleanup
- `skills/Thinking/WorldThreatModelHarness/SKILL.md` — PAI_DIR portability
- `PAI-Install/engine/actions.ts` — user context migration for upgrades

---

## Upgrading from Older Versions

See the [main README](../../README.md#upgrading-from-a-previous-version) for the general upgrade procedure. The installer auto-detects existing installations regardless of which version you're upgrading from.
