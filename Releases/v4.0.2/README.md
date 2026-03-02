<div align="center">

# PAI v4.0.2 — Bug Fix Patch

**13 surgical fixes: Linux compatibility, performance, installer, statusline, hooks.**

[![Skills](https://img.shields.io/badge/Skills-63-22C55E?style=flat)](../../skills/)
[![Categories](https://img.shields.io/badge/Categories-13-3B82F6?style=flat)](../../skills/)
[![Hooks](https://img.shields.io/badge/Hooks-21-F97316?style=flat)](../../hooks/)
[![Workflows](https://img.shields.io/badge/Workflows-338-8B5CF6?style=flat)](../../skills/)
[![Tips](https://img.shields.io/badge/Tips-202-10B981?style=flat)](../../)
[![Algorithm](https://img.shields.io/badge/Algorithm-v3.6.0-D97706?style=flat)](../../PAI/Algorithm/)

</div>

---

## What Changed

Pure bug-fix release — no new features, no breaking changes. All fixes are surgical (1–8 lines each).

### Installer Fixes

| Issue | Fix |
|-------|-----|
| [#825](https://github.com/danielmiessler/PAI/issues/825) | `pai` alias pointed to removed `skills/PAI/Tools/pai.ts` — corrected to `PAI/Tools/pai.ts` |
| [#757](https://github.com/danielmiessler/PAI/issues/757) | Alias written to `.zshrc` only — now detects `$SHELL` and writes to `.bashrc`, `.config/fish/config.fish`, or `.zshrc` |
| [#755](https://github.com/danielmiessler/PAI/issues/755) | Installer hardcoded `--mode gui` — now auto-detects headless/SSH and falls back to CLI mode |

### Statusline Fixes

| Issue | Fix |
|-------|-----|
| [#747](https://github.com/danielmiessler/PAI/issues/747) | Terminal width dropped on re-render — added persistent width cache to prevent mini mode flicker |
| [#819](https://github.com/danielmiessler/PAI/issues/819) | ALG field always showed `—` — `UpdateCounts.ts` now extracts algorithm version from CLAUDE.md |
| [#849](https://github.com/danielmiessler/PAI/issues/849) | OAuth token extraction was macOS-only — now reads `~/.claude/.credentials.json` on Linux |
| [#849](https://github.com/danielmiessler/PAI/issues/849) | `tr ' ' '─'` produced garbled output on GNU coreutils — replaced with `sed 's/ /─/g'` |

### Hook Fixes

| Issue | Fix |
|-------|-----|
| [#832](https://github.com/danielmiessler/PAI/issues/832) | DocCrossRefIntegrity ran inference unconditionally — now skips when 0 drift detected (saves ~15s/response) |
| [#767](https://github.com/danielmiessler/PAI/issues/767) | WorkCompletionLearning `.pop()` always returned `agents_spawned` — replaced with tracked `lineageSubKey` |
| [#769](https://github.com/danielmiessler/PAI/issues/769) | Dead `TrendingAnalysis.ts` reference — removed constant, function, and all 4 call sites |
| [#772](https://github.com/danielmiessler/PAI/issues/772) | Explicit ratings missing `source` field — added `'explicit'` to union type |
| [#768](https://github.com/danielmiessler/PAI/issues/768) | LoadContext exited with code 1 on error — changed to exit 0 (non-fatal, don't block startup) |
| [#766](https://github.com/danielmiessler/PAI/issues/766) | DocCrossRefIntegrity used hardcoded voice ID — now reads from `getIdentity().mainDAVoiceID` |

---

## Files Changed (from v4.0.1)

| File | Fixes |
|------|-------|
| `PAI-Install/engine/actions.ts` | #825 (alias path), #757 (shell detection) |
| `PAI-Install/install.sh` | #755 (headless CLI fallback) |
| `statusline-command.sh` | #747 (width cache), #849 (OAuth cross-platform, sed for multibyte) |
| `hooks/handlers/UpdateCounts.ts` | #819 (algorithmVersion), #849 (OAuth cross-platform) |
| `hooks/handlers/DocCrossRefIntegrity.ts` | #832 (inference guard), #766 (voice ID from config) |
| `hooks/WorkCompletionLearning.hook.ts` | #767 (lineageSubKey tracking) |
| `hooks/RatingCapture.hook.ts` | #769 (dead code removal), #772 (source field) |
| `hooks/LoadContext.hook.ts` | #768 (exit 0) |

---

## Installation

### Fresh Install

```bash
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure/Releases/v4.0.2

cp -r .claude ~/ && cd ~/.claude && bash install.sh
```

### Upgrading from v4.0.0 or v4.0.1

```bash
# 1. Back up
cp -r ~/.claude ~/.claude-backup-$(date +%Y%m%d)

# 2. Clone and copy
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure/Releases/v4.0.2
cp -r .claude ~/

# 3. Run the installer
cd ~/.claude && bash install.sh

# 4. Rebuild CLAUDE.md
bun ~/.claude/PAI/Tools/BuildCLAUDE.ts
```

### Quick Manual Upgrade (from v4.0.1)

If you just want the bug fixes without re-running the installer, copy these files from this release over your existing ones:

- `statusline-command.sh` — width cache, OAuth cross-platform, GNU tr fix
- `hooks/handlers/DocCrossRefIntegrity.ts` — inference guard, voice ID from config
- `hooks/handlers/UpdateCounts.ts` — algorithmVersion, OAuth cross-platform
- `hooks/WorkCompletionLearning.hook.ts` — lineageSubKey fix
- `hooks/RatingCapture.hook.ts` — dead code removal, source field
- `hooks/LoadContext.hook.ts` — exit 0 on error
- `PAI-Install/install.sh` — headless/SSH auto-detection
- `PAI-Install/engine/actions.ts` — alias path fix, shell detection

---

## Upgrading from Older Versions

See the [main README](../../README.md#upgrading-from-a-previous-version) for the general upgrade procedure. The installer auto-detects existing installations regardless of which version you're upgrading from.
