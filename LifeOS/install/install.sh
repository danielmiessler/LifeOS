#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#   LifeOS — One-Line Bootstrap Installer
#   curl -fsSL https://ourlifeos.ai/install.sh | bash
#
#   Unlike a whole-harness install, this does NOT clobber your setup.
#   It drops the LifeOS skill into your existing harness, then hands off
#   to the agentic `/lifeos-setup`, which (with your permission) does the
#   conflict detection, the principal conversation, the TELOS interview
#   (current state + ideal state), pulls in any sources you provide, and
#   wires hooks — adapting to YOUR OS and harness as it goes.
#
#   What this script does (the bootstrap only):
#     1. Verifies prerequisites (curl, bash, tar; offers to install bun)
#     2. Detects your harness + any existing LifeOS install (no clobber)
#     3. Fetches the latest LifeOS release (or uses $LIFEOS_SRC locally)
#     4. Places the LifeOS skill additively into your skills dir
#     5. Hands off to `/lifeos-setup` (the agentic onboarding)
#
#   Local/offline install (no network):
#     LIFEOS_SRC=/path/to/LIFEOS_RELEASES/<version> bash install.sh
#
#   Custom LifeOS home (install somewhere other than ~/.claude — e.g. a
#   project-scoped `.claude` so a second, isolated LifeOS can live beside
#   your global one):
#     bash install.sh --home ~/MyProject/.claude
#     LIFEOS_HOME=~/MyProject/.claude bash install.sh        # equivalent
#   The var is exported so the agentic `/lifeos-setup` (launched below in
#   the same shell) installs into it too — without it, the setup offers
#   the location choice interactively. See INSTALL.md § 2.5 for how a
#   custom home is LOADED at runtime.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Args ─────────────────────────────────────────────────────────
# --home <dir> sets LIFEOS_HOME (the custom LifeOS home). Env var form works too.
while [ $# -gt 0 ]; do
  case "$1" in
    --home)   LIFEOS_HOME="${2:?--home needs a directory}"; shift 2 ;;
    --home=*) LIFEOS_HOME="${1#--home=}"; shift ;;
    *)        echo "unknown argument: $1 (supported: --home <dir>)" >&2; exit 1 ;;
  esac
done
LIFEOS_HOME="${LIFEOS_HOME:-}"
if [ -n "$LIFEOS_HOME" ]; then
  case "$LIFEOS_HOME" in "~"*) LIFEOS_HOME="${HOME}${LIFEOS_HOME#\~}" ;; esac
  export LIFEOS_HOME
fi

# ─── Release resolution — always the latest published release ─────
# No pin: this resolves the newest GitHub Release at run time, so every new
# release reaches every installer with zero edits here. Override with
# LIFEOS_VERSION=x.y.z (or LIFEOS_TAG=vx.y.z) to force a specific version.
# Falls back to a known-good tag if the GitHub API is unreachable, so the
# install never hard-fails on a network hiccup.
# Repo owner/name is parameterized — set at publish time, never hard-coded here.
LIFEOS_REPO="${LIFEOS_REPO:-danielmiessler/LifeOS}"
LIFEOS_FALLBACK_TAG="v7.0.0"
if [ -n "${LIFEOS_VERSION:-}" ]; then
  LIFEOS_TAG="v${LIFEOS_VERSION}"
elif [ -z "${LIFEOS_TAG:-}" ]; then
  LIFEOS_TAG="$(curl -fsSL "https://api.github.com/repos/${LIFEOS_REPO}/releases/latest" 2>/dev/null \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1 || true)"
  LIFEOS_TAG="${LIFEOS_TAG:-$LIFEOS_FALLBACK_TAG}"
fi
LIFEOS_VERSION="${LIFEOS_TAG#v}"
LIFEOS_TARBALL_URL="${LIFEOS_TARBALL_URL:-https://github.com/${LIFEOS_REPO}/archive/refs/tags/${LIFEOS_TAG}.tar.gz}"
# Where the LifeOS skill dir lives inside the release tree:
LIFEOS_RELEASE_SUBPATH="${LIFEOS_RELEASE_SUBPATH:-LifeOS}"
# Local source override — point at a LIFEOS_RELEASES/<version> dir to install offline.
LIFEOS_SRC="${LIFEOS_SRC:-}"
# Target skills dir (auto-detected below; override to force).
LIFEOS_SKILLS_DIR="${LIFEOS_SKILLS_DIR:-}"
DRY_RUN="${DRY_RUN:-0}"

# ─── Colors / helpers ────────────────────────────────────────────
if [ -t 1 ]; then
  BLUE='\033[38;2;59;130;246m'; LIGHT_BLUE='\033[38;2;147;197;253m'
  DARK_BLUE='\033[38;2;29;78;216m'; GREEN='\033[38;2;34;197;94m'; YELLOW='\033[38;2;234;179;8m'
  RED='\033[38;2;239;68;68m'; DIM='\033[38;2;71;85;105m'; RESET='\033[0m'; BOLD='\033[1m'
else
  BLUE='' LIGHT_BLUE='' DARK_BLUE='' GREEN='' YELLOW='' RED='' DIM='' RESET='' BOLD=''
fi
info()    { printf "  ${BLUE}ℹ${RESET} %b\n" "$1"; }
success() { printf "  ${GREEN}✓${RESET} %b\n" "$1"; }
warn()    { printf "  ${YELLOW}⚠${RESET} %b\n" "$1"; }
error()   { printf "  ${RED}✗${RESET} %b\n" "$1" >&2; }
step()    { printf "\n${BOLD}${LIGHT_BLUE}▸ %s${RESET}\n" "$1"; }
run()     { if [ "$DRY_RUN" = "1" ]; then echo "  [DRY-RUN] $*"; else "$@"; fi; }

printf "\n  ${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
printf "  ${BOLD}${DARK_BLUE}Life${BLUE}O${LIGHT_BLUE}S${RESET}   ${BOLD}the Life Operating System${RESET}      ${DIM}current state ${BLUE}→${DIM} ideal state${RESET}   ${DIM}·${RESET}   ${LIGHT_BLUE}v%s bootstrap${RESET}\n" "$LIFEOS_VERSION"
printf "  ${LIGHT_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n\n"
[ "$DRY_RUN" = "1" ] && warn "DRY-RUN mode — no changes will be made."

# ─── Step 1: Prereqs ─────────────────────────────────────────────
step "1/5  Checking prerequisites"
OS="$(uname -s)"
case "$OS" in
  Darwin) info "Platform: macOS" ;;
  Linux)  info "Platform: Linux" ;;
  *)      warn "Unrecognized OS: $OS — proceeding; the setup will adapt." ;;
esac

need() { command -v "$1" >/dev/null 2>&1 && success "$1 ($(command -v "$1"))" || { error "Required: $1"; return 1; }; }
FAIL=0
need curl || FAIL=1
need bash || FAIL=1
need tar  || FAIL=1
[ $FAIL -ne 0 ] && { error "Install the missing prerequisites and re-run."; exit 1; }

# LifeOS's bun.lock uses the v6 lockfile format, which bun < 1.2 cannot parse.
# So we require bun AND a modern-enough bun — auto-installing (which pulls the
# latest) via the same official installer whether bun is absent OR too old.
BUN_MIN_MAJOR=1
BUN_MIN_MINOR=2
bun_too_old() {
  # returns 0 (true) when the installed bun is older than $BUN_MIN_MAJOR.$BUN_MIN_MINOR
  local v major minor
  v="$(bun --version 2>/dev/null | head -n1 | tr -d '[:space:]' || true)"
  [ -z "$v" ] && return 0
  major="${v%%.*}"; minor="${v#*.}"; minor="${minor%%.*}"
  case "$major" in ''|*[!0-9]*) return 0 ;; esac
  case "$minor" in ''|*[!0-9]*) minor=0 ;; esac
  [ "$major" -gt "$BUN_MIN_MAJOR" ] && return 1
  [ "$major" -lt "$BUN_MIN_MAJOR" ] && return 0
  [ "$minor" -lt "$BUN_MIN_MINOR" ] && return 0 || return 1
}
install_bun() {
  if [ "${LIFEOS_AUTO_INSTALL_BUN:-1}" = "1" ] && [ -z "${CI:-}" ] && [ -t 0 ]; then
    info "Installing bun..."
    run bash -c "curl -fsSL https://bun.sh/install | bash"
    [ -f "$HOME/.bun/bin/bun" ] && export PATH="$HOME/.bun/bin:$PATH" && hash -r && success "bun installed" \
      || { error "bun install failed"; exit 1; }
  else
    error "Install bun ≥ ${BUN_MIN_MAJOR}.${BUN_MIN_MINOR} first:  ${BOLD}curl -fsSL https://bun.sh/install | bash${RESET}"; exit 1
  fi
}

if ! command -v bun >/dev/null 2>&1; then
  warn "bun not found — LifeOS tools need it."
  install_bun
elif bun_too_old; then
  warn "bun $(bun --version 2>/dev/null) is too old — LifeOS needs bun ≥ ${BUN_MIN_MAJOR}.${BUN_MIN_MINOR} (v6 bun.lock format)."
  install_bun
fi
if [ "$DRY_RUN" != "1" ] && bun_too_old; then
  error "bun is still older than ${BUN_MIN_MAJOR}.${BUN_MIN_MINOR} ($(bun --version 2>/dev/null)). Upgrade with ${BOLD}bun upgrade${RESET} and re-run."; exit 1
fi
success "bun ($(command -v bun), v$(bun --version 2>/dev/null))"

# ─── Step 2: Detect harness (no clobber) ─────────────────────────
step "2/5  Detecting your harness"
if [ -z "$LIFEOS_SKILLS_DIR" ]; then
  if [ -n "$LIFEOS_HOME" ]; then LIFEOS_SKILLS_DIR="$LIFEOS_HOME/skills"
  elif [ -d "$HOME/.claude" ]; then LIFEOS_SKILLS_DIR="$HOME/.claude/skills"
  elif [ -d "$HOME/.config/claude" ]; then LIFEOS_SKILLS_DIR="$HOME/.config/claude/skills"
  else LIFEOS_SKILLS_DIR="$HOME/.claude/skills"; fi
fi
[ -n "$LIFEOS_HOME" ] && info "Custom LifeOS home: ${BOLD}${LIFEOS_HOME/#$HOME/~}${RESET} (LIFEOS_HOME exported for the setup)"
info "Skills dir: ${BOLD}${LIFEOS_SKILLS_DIR/#$HOME/~}${RESET}"
TARGET="$LIFEOS_SKILLS_DIR/LifeOS"
if [ -e "$TARGET" ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  warn "Existing LifeOS skill — backing up ONLY it to LifeOS.backup-$TS (your other files are untouched)."
  run mv "$TARGET" "$TARGET.backup-$TS"
else
  success "No existing LifeOS skill — clean drop-in."
fi

# ─── Step 3: Fetch the LifeOS release ────────────────────────────
step "3/5  Fetching LifeOS ${LIFEOS_TAG}"
TMP_DIR="$(mktemp -d -t lifeos-install-XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT
if [ -n "$LIFEOS_SRC" ]; then
  info "Local source: ${LIFEOS_SRC/#$HOME/~}"
  SRC_SKILL="$LIFEOS_SRC/$LIFEOS_RELEASE_SUBPATH"
  [ -d "$SRC_SKILL" ] || { error "LifeOS skill not found at $SRC_SKILL"; exit 1; }
else
  info "Downloading ${LIFEOS_TAG} (HTTPS, no auth)..."
  if [ "$LIFEOS_REPO" = "OWNER/REPO" ]; then
    error "Network install needs LIFEOS_REPO set (owner/name), or use LIFEOS_SRC for a local install."; exit 1
  fi
  run bash -c "curl -fsSL '$LIFEOS_TARBALL_URL' | tar -xzf - -C '$TMP_DIR'"
  EXTRACTED="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  SRC_SKILL="$EXTRACTED/$LIFEOS_RELEASE_SUBPATH"
  [ -d "$SRC_SKILL" ] || { error "LifeOS skill not in tarball at $LIFEOS_RELEASE_SUBPATH"; exit 1; }
fi
success "Fetched ${LIFEOS_TAG}"

# ─── Step 4: Place the skill (additive) ──────────────────────────
step "4/5  Installing the LifeOS skill (additive — nothing else touched)"
run mkdir -p "$LIFEOS_SKILLS_DIR"
run cp -R "$SRC_SKILL" "$TARGET"
success "LifeOS skill placed at ${TARGET/#$HOME/~}"

# ─── Step 5: Hand off to the agentic setup ───────────────────────
step "5/5  Onboarding"
if [ "$DRY_RUN" = "1" ]; then info "[DRY-RUN] Would launch /lifeos-setup"; exit 0; fi
echo
success "LifeOS is installed. Now let's set it up for YOU."
info "The rest is a conversation — it detects conflicts, asks about your TELOS"
info "(current state + ideal state), pulls in any sources you provide, and wires"
info "hooks with your permission. Nothing changes without you saying yes."
echo
if command -v claude >/dev/null 2>&1 && [ -z "${CLAUDECODE:-}" ]; then
  info "Launching setup..."
  exec claude "/lifeos-setup"
else
  printf "  ${BOLD}Open your harness and run:${RESET}  ${LIGHT_BLUE}/lifeos-setup${RESET}\n\n"
fi
