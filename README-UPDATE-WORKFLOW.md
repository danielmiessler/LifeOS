# PAI Update Workflow

**Your Setup:**
- **Private Fork:** https://github.com/HyggeHacker/Personal_AI_Infrastructure
- **Upstream:** https://github.com/danielmiessler/Personal_AI_Infrastructure
- **Local Repo:** `~/PAI`
- **Installation:** `~/.claude`

---

## Quick Start

**Check for updates:**
```bash
cd ~/PAI
./update-pai.sh --check
```

**Update PAI (interactive):**
```bash
cd ~/PAI
./update-pai.sh
```

**Update PAI (automatic):**
```bash
cd ~/PAI
./update-pai.sh --auto
```

---

## How the Update System Works

### Git Remote Configuration

```
origin   → HyggeHacker/Personal_AI_Infrastructure (your private fork)
upstream → danielmiessler/Personal_AI_Infrastructure (original PAI)
```

**Your workflow:**
1. Make customizations locally
2. Commit to your fork (origin)
3. Pull updates from upstream
4. Merge upstream into your fork
5. Push to your fork

### What Gets Updated vs. Preserved

**Updated from Upstream (SYSTEM directories):**
- `~/.claude/skills/CORE/SYSTEM/` - PAI infrastructure
- `~/.claude/skills/[CORE_SKILLS]/` - PAI-provided skills
- `~/.claude/hooks/` - Hook implementations
- `~/.claude/tools/` - System tools

**Preserved (USER directories):**
- `~/.claude/skills/CORE/USER/` - Your customizations
- `~/.claude/skills/azure-*/` - Your custom skills
- `~/.claude/skills/bbot-helper/` - Your custom skills
- `~/.claude/settings.json` - Your configuration
- `~/.claude/.env` - Your API keys

---

## Update Script Features

### Safety Mechanisms

1. **Pre-flight Checks:**
   - Verifies git repo exists
   - Checks for uncommitted changes
   - Validates remote configuration

2. **Backup Creation:**
   - Creates timestamped backup branch before merge
   - Format: `backup-YYYYMMDD-HHMMSS`
   - Restore: `git reset --hard backup-YYYYMMDD-HHMMSS`

3. **Conflict Detection:**
   - Warns about USER/ directory conflicts
   - Lists conflicted files
   - Provides resolution instructions

4. **Review Before Apply:**
   - Shows commit log of upstream changes
   - Lists files that will be modified
   - Asks for confirmation (unless --auto)

### Update Process

```
1. Fetch upstream changes
   ↓
2. Compare with local
   ↓
3. Show what will change
   ↓
4. Confirm with user
   ↓
5. Create backup branch
   ↓
6. Merge upstream → local
   ↓
7. Push to your fork
   ↓
8. Update ~/.claude installation
```

---

## Manual Update (Advanced)

If you prefer manual control:

```bash
cd ~/PAI

# 1. Check current status
git status
git log --oneline -5

# 2. Fetch upstream
git fetch upstream
git fetch origin

# 3. See what's new
git log --oneline HEAD..upstream/main

# 4. See changed files
git diff --name-status HEAD..upstream/main

# 5. Create backup
git branch backup-manual-$(date +%Y%m%d)

# 6. Merge upstream
git merge upstream/main

# 7. Resolve conflicts (if any)
git status
# Edit conflicted files
git add <resolved-files>
git commit

# 8. Push to your fork
git push origin main

# 9. Update installation
cd Bundles/Official
bun run install.ts --update
```

---

## Handling Merge Conflicts

### Common Conflict Scenarios

**Scenario 1: USER/ directory conflicts**
```bash
# Upstream changed a USER/ file you customized
# Resolution: Keep your version
git checkout --ours ~/.claude/skills/CORE/USER/ABOUTME.md
git add ~/.claude/skills/CORE/USER/ABOUTME.md
```

**Scenario 2: settings.json conflicts**
```bash
# Both you and upstream modified settings.json
# Resolution: Manual merge
vim ~/.claude/settings.json  # Combine changes carefully
git add ~/.claude/settings.json
```

**Scenario 3: Skill SKILL.md conflicts**
```bash
# Upstream updated a skill you customized
# Resolution: Review diff and merge manually
git diff HEAD upstream/main -- ~/.claude/skills/Browser/SKILL.md
vim ~/.claude/skills/Browser/SKILL.md  # Merge manually
git add ~/.claude/skills/Browser/SKILL.md
```

### Conflict Resolution Workflow

```bash
# 1. List conflicts
git status | grep "both modified"

# 2. For each conflict, choose strategy:

# Keep your version:
git checkout --ours <file>

# Keep upstream version:
git checkout --theirs <file>

# Manual merge:
vim <file>  # Edit manually

# 3. Mark as resolved
git add <file>

# 4. Complete merge
git commit
```

---

## Automation Options

### Option 1: Cron Job (Daily Check)

Add to crontab (`crontab -e`):
```bash
# Check for PAI updates daily at 9am
0 9 * * * cd ~/PAI && ./update-pai.sh --check >> ~/pai-update-check.log 2>&1
```

### Option 2: Git Hook (On Pull)

Create `.git/hooks/post-merge`:
```bash
#!/bin/bash
# Auto-update ~/.claude after merging upstream
cd ~/PAI/Bundles/Official
bun run install.ts --update
```

Make executable:
```bash
chmod +x ~/PAI/.git/hooks/post-merge
```

### Option 3: Alias (Quick Command)

Add to `~/.zshrc` or `~/.bashrc`:
```bash
# PAI update aliases
alias pai-check='cd ~/PAI && ./update-pai.sh --check'
alias pai-update='cd ~/PAI && ./update-pai.sh'
alias pai-update-auto='cd ~/PAI && ./update-pai.sh --auto'
```

Then use:
```bash
pai-check      # Check for updates
pai-update     # Interactive update
pai-update-auto # Automatic update
```

---

## Update Strategy Recommendations

### Conservative (Recommended)

**When:** You have heavy customizations
**How:** Manual updates with review

```bash
# Weekly: Check for updates
pai-check

# Monthly: Apply updates when significant changes available
pai-update  # Review each step
```

### Moderate

**When:** You follow PAI patterns, minimal customization
**How:** Automated checks, manual apply

```bash
# Daily cron: Check for updates (notify only)
# Weekly: Apply updates interactively
pai-update
```

### Aggressive

**When:** You trust upstream, minimal customization
**How:** Fully automated

```bash
# Daily cron: Auto-apply updates
0 9 * * * cd ~/PAI && ./update-pai.sh --auto
```

---

## Troubleshooting

### Update script fails with "Not a git repository"

```bash
cd ~/PAI
git status
# If not a repo, re-clone:
cd ~/Tools
git clone https://github.com/HyggeHacker/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure
git remote add upstream https://github.com/danielmiessler/Personal_AI_Infrastructure
```

### Update creates conflicts I can't resolve

```bash
# Abort merge and restore backup
git merge --abort
git reset --hard backup-YYYYMMDD-HHMMSS

# OR reset to origin (your fork)
git reset --hard origin/main
```

### Installation update fails

```bash
# Manually reinstall
cd ~/PAI/Bundles/Official
bun run install.ts --update

# Check logs for errors
cat ~/.claude/install.log
```

### Lost custom skills after update

```bash
# Your custom skills should survive updates
# Check if they're still there:
ls ~/.claude/skills/azure-*/
ls ~/.claude/skills/bbot-helper/

# If missing, restore from backup branch:
git checkout backup-YYYYMMDD-HHMMSS -- ~/.claude/skills/azure-enum/
```

---

## Best Practices

### Before Updating

1. **Commit your changes:**
   ```bash
   cd ~/PAI
   git status
   git add .
   git commit -m "Save my customizations before update"
   ```

2. **Review what will change:**
   ```bash
   ./update-pai.sh --check
   ```

3. **Backup important customizations:**
   ```bash
   cp -r ~/.claude/skills/CORE/USER/ ~/PAI-USER-BACKUP-$(date +%Y%m%d)
   ```

### After Updating

1. **Test PAI works:**
   ```bash
   claude  # Start new session
   # Try basic commands
   ```

2. **Check your customizations:**
   ```bash
   cat ~/.claude/skills/CORE/USER/ABOUTME.md
   cat ~/.claude/settings.json
   ```

3. **Review CHANGELOG:**
   ```bash
   cd ~/PAI
   git log --oneline -10
   ```

### Regular Maintenance

**Weekly:**
- Check for updates: `pai-check`
- Review upstream changes

**Monthly:**
- Apply updates: `pai-update`
- Clean old backup branches: `git branch | grep backup- | xargs git branch -d`

**Quarterly:**
- Review your customizations vs. upstream changes
- Consolidate learnings into USER/ directories
- Update documentation

---

## Quick Reference

**Check for updates:**
```bash
cd ~/PAI && ./update-pai.sh --check
```

**Update (interactive):**
```bash
cd ~/PAI && ./update-pai.sh
```

**Update (auto):**
```bash
cd ~/PAI && ./update-pai.sh --auto
```

**Restore from backup:**
```bash
git reset --hard backup-YYYYMMDD-HHMMSS
```

**View recent upstream changes:**
```bash
git log --oneline upstream/main -10
```

**See what's different from upstream:**
```bash
git diff upstream/main
```
