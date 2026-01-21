# PAI Hybrid Development Workflow

This documents the hybrid workflow for PAI development: iterate fast in `~/.claude`, formalize to Packs when ready.

## The Two Locations

**Installation Directory (`~/.claude/`):**
- Where PAI actually runs
- Fast iteration and testing
- Changes take effect immediately
- Not version controlled directly

**Repository Directory (`~/PAI/Packs/`):**
- Source code in version control
- Proper Pack structure
- Syncs to `~/.claude` via `update-pai.sh`

## Hybrid Workflow

### Phase 1: Development (Fast Iteration)

Work directly in `~/.claude` for quick iteration:

```bash
# Edit files directly in installation
vim ~/.claude/hooks/SomeHook.ts
vim ~/.claude/skills/SomeSkill/SKILL.md

# Test immediately - changes are live
claude

# Iterate quickly until stable
```

### Phase 2: Formalization (Version Control)

Once stable, copy to Pack structure:

```bash
# 1. Find which Pack owns the file
find ~/PAI/Packs -name "SomeHook.ts"

# 2. Copy from installation to Pack
cp ~/.claude/hooks/SomeHook.ts ~/PAI/Packs/pai-hook-system/src/hooks/

# 3. Stage and commit
cd ~/PAI
git add Packs/
git commit -m "feat: Description of changes"

# 4. Push to your fork
git push origin main
```

### Phase 3: Deployment (Optional)

Deploy Pack changes back to `~/.claude`:

```bash
cd ~/PAI
./update-pai.sh
```

This re-deploys from Packs to `~/.claude`. Useful if:
- You want to test the Pack deployment process
- You've updated from upstream
- You're setting up on a new machine

## File Mapping Reference

Common file locations:

| Installation (`~/.claude`) | Pack Source (`~/PAI/Packs`) |
|---------------------------|----------------------------|
| `hooks/LoadContext.hook.ts` | `pai-hook-system/src/hooks/LoadContext.hook.ts` |
| `skills/CORE/SKILL.md` | `pai-core-install/src/skills/CORE/SKILL.md` |
| `vault-examples/` | `pai-core-install/src/vault-examples/` |

## Finding Which Pack Owns a File

```bash
# Search by filename
find ~/PAI/Packs -name "LoadContext.hook.ts"

# Search by path component
find ~/PAI/Packs -path "*/hooks/*" -name "*.ts"
find ~/PAI/Packs -path "*/skills/CORE/*"
```

## Quick Reference Commands

**Sync installation → Pack:**
```bash
cp ~/.claude/path/to/file.ts ~/PAI/Packs/pack-name/src/path/to/file.ts
```

**Commit to git:**
```bash
cd ~/PAI
git add Packs/
git commit -m "feat: Your change description"
git push origin main
```

**Deploy Pack → installation:**
```bash
cd ~/PAI
./update-pai.sh
```

## Best Practices

1. **Develop in `~/.claude`** - Fast, immediate feedback
2. **Test thoroughly** - Make sure it works before formalizing
3. **Copy to Packs when stable** - Version control the working solution
4. **Commit with good messages** - Describe what and why
5. **Push regularly** - Keep your fork up to date

## Example: Vault Loading Feature

This feature followed the hybrid workflow:

### Development Phase:
- Modified `~/.claude/hooks/LoadContext.hook.ts` directly
- Added vault section to `~/.claude/skills/CORE/SKILL.md`
- Created `~/.claude/vault-examples/`
- Tested with sample vaults
- Iterated on implementation

### Formalization Phase:
- Copied LoadContext.hook.ts to `Packs/pai-hook-system/src/hooks/`
- Copied SKILL.md to `Packs/pai-core-install/src/skills/CORE/`
- Copied vault-examples/ to `Packs/pai-core-install/src/`
- Committed: "feat: Add per-vault context loading"
- Pushed to fork

### Result:
- Working feature in `~/.claude`
- Version controlled in `~/PAI`
- Ready to contribute upstream if desired
- Can be deployed to new machines via `update-pai.sh`

## When to Skip Formalization

Some changes should stay in `~/.claude` only:

- **Personal customizations** - Specific to your workflow
- **Experimental features** - Still iterating, not stable
- **Machine-specific config** - Paths, credentials, etc.
- **USER/ tier content** - Your personal data, not infrastructure

For these, `.gitignore` them or keep them out of Packs entirely.

## Upstream Contribution

To contribute to danielmiessler/PAI:

1. Ensure feature is in Pack structure (formalized)
2. Test with `update-pai.sh` deployment
3. Document in Pack's README.md
4. Create pull request to upstream:
   ```bash
   cd ~/PAI
   git push origin feature-branch
   # Then create PR on GitHub: HyggeHacker/PAI → danielmiessler/PAI
   ```

## Summary

**Hybrid workflow = Best of both worlds:**
- ✅ Fast iteration in `~/.claude`
- ✅ Version control in `~/PAI`
- ✅ Proper architecture when ready
- ✅ Can contribute upstream

**The key:** Don't let perfect be the enemy of good. Iterate fast, formalize when stable.
