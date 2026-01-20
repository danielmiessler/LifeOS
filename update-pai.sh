#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# PAI Update Script - Safe upstream sync with customization preservation
# ═══════════════════════════════════════════════════════════════════════════════
#
# USAGE:
#   ./update-pai.sh              # Interactive update with preview
#   ./update-pai.sh --auto       # Automatic update (careful!)
#   ./update-pai.sh --check      # Check for updates without applying
#
# WHAT IT DOES:
#   1. Fetches latest changes from upstream (danielmiessler/PAI)
#   2. Shows you what changed
#   3. Merges changes, preserving your customizations
#   4. Pushes to your fork (HyggeHacker/PAI)
#   5. Updates ~/.claude installation
#
# SAFETY:
#   - Preserves USER/ directories (your customizations)
#   - Checks for uncommitted changes before updating
#   - Creates backup before major operations
#   - Allows review before applying changes
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Configuration
REPO_DIR="$HOME/PAI"
INSTALL_DIR="$HOME/.claude"
UPSTREAM_REMOTE="upstream"
ORIGIN_REMOTE="origin"
BRANCH="main"

# Parse arguments
AUTO_MODE=false
CHECK_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --auto)
      AUTO_MODE=true
      shift
      ;;
    --check)
      CHECK_ONLY=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--auto] [--check]"
      echo ""
      echo "Options:"
      echo "  --auto   Automatic mode (skip confirmations)"
      echo "  --check  Check for updates without applying"
      echo "  --help   Show this help"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${RESET}"
      exit 1
      ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

print_header() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${RESET}"
  echo -e "${CYAN}  $1${RESET}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${RESET}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✓${RESET} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${RESET} $1"
}

print_error() {
  echo -e "${RED}✗${RESET} $1"
}

print_info() {
  echo -e "${BLUE}→${RESET} $1"
}

confirm() {
  if [ "$AUTO_MODE" = true ]; then
    return 0
  fi

  local prompt="$1"
  read -p "$prompt [y/N]: " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]]
}

# ─────────────────────────────────────────────────────────────────────────────
# Pre-flight Checks
# ─────────────────────────────────────────────────────────────────────────────

print_header "PAI Update - Pre-flight Checks"

# Check if we're in the right directory
if [ ! -d "$REPO_DIR" ]; then
  print_error "Repository directory not found: $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"
print_success "Found repository: $REPO_DIR"

# Check if it's a git repo
if [ ! -d ".git" ]; then
  print_error "Not a git repository: $REPO_DIR"
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  print_warning "You have uncommitted changes:"
  git status --short
  echo ""

  if ! confirm "Continue anyway?"; then
    print_info "Commit or stash your changes first, then run again"
    exit 0
  fi
fi

# Verify remotes
if ! git remote | grep -q "^${UPSTREAM_REMOTE}$"; then
  print_error "Upstream remote not configured"
  print_info "Run: git remote add upstream https://github.com/danielmiessler/Personal_AI_Infrastructure"
  exit 1
fi

if ! git remote | grep -q "^${ORIGIN_REMOTE}$"; then
  print_error "Origin remote not configured"
  exit 1
fi

print_success "Git remotes configured correctly"

# ─────────────────────────────────────────────────────────────────────────────
# Fetch Updates
# ─────────────────────────────────────────────────────────────────────────────

print_header "Fetching Updates from Upstream"

print_info "Fetching from upstream (danielmiessler/PAI)..."
git fetch upstream

print_info "Fetching from origin (your fork)..."
git fetch origin

print_success "Fetch complete"

# ─────────────────────────────────────────────────────────────────────────────
# Check for Updates
# ─────────────────────────────────────────────────────────────────────────────

print_header "Checking for Updates"

# Get commit counts
LOCAL_COMMIT=$(git rev-parse HEAD)
UPSTREAM_COMMIT=$(git rev-parse upstream/$BRANCH)
COMMITS_BEHIND=$(git rev-list --count HEAD..upstream/$BRANCH)
COMMITS_AHEAD=$(git rev-list --count upstream/$BRANCH..HEAD)

echo -e "Current commit:  ${YELLOW}$(git rev-parse --short HEAD)${RESET}"
echo -e "Upstream commit: ${YELLOW}$(git rev-parse --short upstream/$BRANCH)${RESET}"
echo ""

if [ "$COMMITS_BEHIND" -eq 0 ]; then
  print_success "Already up to date!"

  if [ "$COMMITS_AHEAD" -gt 0 ]; then
    print_info "You have $COMMITS_AHEAD local commits not in upstream"
    print_info "Your customizations are preserved"
  fi

  exit 0
fi

print_info "Your repository is ${YELLOW}$COMMITS_BEHIND commits${RESET} behind upstream"

if [ "$COMMITS_AHEAD" -gt 0 ]; then
  print_info "You have ${YELLOW}$COMMITS_AHEAD local commits${RESET} not in upstream"
fi

echo ""
print_info "Recent upstream changes:"
echo ""
git log --oneline --decorate --graph HEAD..upstream/$BRANCH | head -20

if [ "$CHECK_ONLY" = true ]; then
  echo ""
  print_info "Check complete. Run without --check to apply updates."
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Show Changed Files
# ─────────────────────────────────────────────────────────────────────────────

echo ""
print_header "Files Changed in Upstream"

echo ""
print_info "Files that will be updated:"
echo ""
git diff --name-status HEAD..upstream/$BRANCH | head -30

TOTAL_CHANGES=$(git diff --name-status HEAD..upstream/$BRANCH | wc -l)
if [ "$TOTAL_CHANGES" -gt 30 ]; then
  echo ""
  print_info "... and $(($TOTAL_CHANGES - 30)) more files"
fi

# Check for USER/ directory conflicts
echo ""
USER_FILE_CONFLICTS=$(git diff --name-status HEAD..upstream/$BRANCH | grep "USER/" | wc -l || true)
if [ "$USER_FILE_CONFLICTS" -gt 0 ]; then
  print_warning "Upstream changed $USER_FILE_CONFLICTS files in USER/ directories"
  print_warning "Your customizations may need manual merge"
  echo ""
  git diff --name-status HEAD..upstream/$BRANCH | grep "USER/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Confirm Update
# ─────────────────────────────────────────────────────────────────────────────

echo ""
if ! confirm "Apply these updates?"; then
  print_info "Update cancelled"
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Create Backup
# ─────────────────────────────────────────────────────────────────────────────

print_header "Creating Backup"

BACKUP_BRANCH="backup-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"
print_success "Created backup branch: $BACKUP_BRANCH"
print_info "Restore with: git reset --hard $BACKUP_BRANCH"

# ─────────────────────────────────────────────────────────────────────────────
# Merge Upstream Changes
# ─────────────────────────────────────────────────────────────────────────────

print_header "Merging Upstream Changes"

print_info "Merging upstream/$BRANCH into local $BRANCH..."

if git merge upstream/$BRANCH --no-edit; then
  print_success "Merge successful!"
else
  print_error "Merge conflicts detected"
  echo ""
  print_info "Conflicts:"
  git status --short | grep "^UU"
  echo ""
  print_info "Resolve conflicts manually:"
  print_info "  1. Edit conflicted files"
  print_info "  2. git add <resolved-files>"
  print_info "  3. git commit"
  print_info "  4. ./update-pai.sh --auto (to complete)"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Push to Fork
# ─────────────────────────────────────────────────────────────────────────────

print_header "Pushing to Your Fork"

if confirm "Push changes to your fork (origin)?"; then
  print_info "Pushing to origin/$BRANCH..."
  git push origin $BRANCH
  print_success "Pushed to your fork"
else
  print_warning "Skipped push to fork"
  print_info "Push manually later with: git push origin $BRANCH"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Update Installation
# ─────────────────────────────────────────────────────────────────────────────

print_header "Updating ~/.claude Installation"

if [ -d "$INSTALL_DIR" ]; then
  print_info "Reinstalling PAI to $INSTALL_DIR..."

  if [ -f "Bundles/Official/install.ts" ]; then
    if confirm "Run PAI installer to update ~/.claude?"; then
      cd Bundles/Official
      bun run install.ts --update
      print_success "Installation updated"
    else
      print_warning "Skipped installation update"
      print_info "Update manually: cd Bundles/Official && bun run install.ts --update"
    fi
  else
    print_warning "Installer not found, skipping installation update"
  fi
else
  print_warning "$INSTALL_DIR not found, skipping installation update"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

print_header "Update Complete!"

echo -e "${GREEN}✓${RESET} Merged ${YELLOW}$COMMITS_BEHIND commits${RESET} from upstream"
echo -e "${GREEN}✓${RESET} Backup created: ${CYAN}$BACKUP_BRANCH${RESET}"

if git remote | grep -q "^origin$"; then
  ORIGIN_STATUS=$(git rev-list --count origin/$BRANCH..HEAD 2>/dev/null || echo "?")
  if [ "$ORIGIN_STATUS" != "0" ] && [ "$ORIGIN_STATUS" != "?" ]; then
    echo -e "${YELLOW}⚠${RESET} Your fork is ${YELLOW}$ORIGIN_STATUS commits${RESET} behind local"
    echo -e "  ${BLUE}→${RESET} Push with: git push origin $BRANCH"
  fi
fi

echo ""
print_info "Your customizations in USER/ directories are preserved"
print_info "SYSTEM/ directories updated from upstream"
echo ""
print_success "PAI is now up to date!"
