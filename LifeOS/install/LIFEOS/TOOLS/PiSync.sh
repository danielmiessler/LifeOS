#!/usr/bin/env bash
# PiSync.sh — bring ~/.pi/agent/ in line with current ~/.claude/LIFEOS/
#
# v2 — matches existing Pi skills by frontmatter `name:` field rather than
# regex on dir name. Avoids the ALLCAPS/ArXiv duplicate problem in v1.

set -euo pipefail

LifeOS="$(dirname "${LIFEOS_DIR:-$HOME/.claude/LIFEOS}")"
PI=~/.pi/agent

[ -d "$PI" ] || { echo "✗ ~/.pi/agent missing"; exit 1; }
[ -d "$LifeOS/LIFEOS" ] || { echo "✗ ~/.claude/LIFEOS missing"; exit 1; }

echo "→ PiSync v2"

# ─── 1. LIFEOS_SYSTEM_PROMPT.md ───────────────────────────
echo "[1/4] Sync LIFEOS_SYSTEM_PROMPT.md"
awk 'NR==1 && /^---$/ {fm=1; next} fm && /^---$/ {fm=0; next} !fm' \
  "$LifeOS/LIFEOS/LIFEOS_SYSTEM_PROMPT.md" > "$PI/LIFEOS_SYSTEM_PROMPT.md"
echo "  $(wc -l < "$PI/LIFEOS_SYSTEM_PROMPT.md") lines"

# ─── 2. AGENTS.md ─────────────────────────────────────
echo "[2/4] Regenerate AGENTS.md"
ALG=$(tr -d '[:space:]' < "$LifeOS/LIFEOS/ALGORITHM/LATEST")
{
  echo "# LifeOS on Pi"
  echo "Auto-regenerated $(date -u +%Y-%m-%dT%H:%M:%SZ) | Algorithm v${ALG}"
  echo
  echo "---"
  echo "# Constitutional rules"
  echo
  cat "$PI/LIFEOS_SYSTEM_PROMPT.md"
  echo
  echo "---"
  echo "# Routing table (CLAUDE.md)"
  echo
  awk 'NR==1 && /^---$/ {fm=1; next} fm && /^---$/ {fm=0; next} !fm && !/^@/' \
    "$LifeOS/CLAUDE.md"
  echo
  for f in \
    "$LifeOS/LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md" \
    "$LifeOS/LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md" \
    "$LifeOS/LIFEOS/USER/PROJECTS.md" \
    "$LifeOS/LIFEOS/USER/TELOS/PRINCIPAL_TELOS.md" \
    "$LifeOS/LIFEOS/DOCUMENTATION/ARCHITECTURE_SUMMARY.md"; do
    [ -f "$f" ] || continue
    echo "---"; echo "# $(basename "$f" .md)"; echo
    awk 'NR==1 && /^---$/ {fm=1; next} fm && /^---$/ {fm=0; next} !fm' "$f"
    echo
  done
  echo "---"; echo "# Algorithm v${ALG}"; echo
  awk 'NR==1 && /^---$/ {fm=1; next} fm && /^---$/ {fm=0; next} !fm' \
    "$LifeOS/LIFEOS/ALGORITHM/v${ALG}.md"
} > "$PI/AGENTS.md"
echo "  $(wc -l < "$PI/AGENTS.md") lines"

# ─── 3. Skill sync (match by frontmatter name:) ────────
echo "[3/4] Sync skills (match by name: field)"

# Helper: extract `name:` field from SKILL.md frontmatter, normalize
# (lowercase, strip non-alnum) for matching
norm_name() {
  awk '
    NR==1 && /^---$/ { fm=1; next }
    fm && /^---$/ { exit }
    fm && /^name:/ { sub(/^name:[[:space:]]*/, ""); gsub(/["'\'']/, ""); print; exit }
  ' "$1" | tr '[:upper:]' '[:lower:]' | tr -d -- '-_ '
}

# Build map of existing Pi skills: norm_name → dir
declare -A pi_by_name
for d in "$PI/skills"/*/; do
  [ -f "$d/SKILL.md" ] || continue
  n="$(norm_name "$d/SKILL.md")"
  [ -n "$n" ] && pi_by_name["$n"]="$(basename "$d")"
done

# Simple kebab-case for new skills (LifeOS dir name is canonical)
to_kebab() {
  local n="${1#_}"
  echo "$n" | sed -E 's/([a-z0-9])([A-Z])/\1-\2/g' | tr '[:upper:]' '[:lower:]'
}

added=0
refreshed=0
for pai_dir in "$LifeOS/skills"/*/; do
  [ -d "$pai_dir" ] || continue
  pai_skill="$pai_dir/SKILL.md"
  [ -f "$pai_skill" ] || continue

  pai_name="$(basename "$pai_dir")"
  pai_norm="$(norm_name "$pai_skill")"
  [ -z "$pai_norm" ] && pai_norm="$(echo "${pai_name#_}" | tr '[:upper:]' '[:lower:]' | tr -d -- '-_')"

  # Match by normalized name
  if [ -n "${pi_by_name[$pai_norm]:-}" ]; then
    # Existing — refresh in place
    pi_target_dir="${pi_by_name[$pai_norm]}"
    pi_skill_field="$pi_target_dir"
    pi_path="$PI/skills/$pi_target_dir"
    refreshed=$((refreshed+1))
  else
    # New — create with kebab name
    pi_target_dir="$(to_kebab "$pai_name")"
    pi_skill_field="$pi_target_dir"
    pi_path="$PI/skills/$pi_target_dir"
    [ -d "$pi_path" ] || mkdir -p "$pi_path"
    added=$((added+1))
  fi

  # Write SKILL.md, set name: to Pi-side dir convention
  awk -v name="$pi_skill_field" '
    BEGIN { fm=0 }
    NR==1 && /^---$/ { fm=1; print; next }
    fm && /^---$/ { fm=0; print; next }
    fm && /^name:/ { print "name: " name; next }
    { print }
  ' "$pai_skill" > "$pi_path/SKILL.md"
done

echo "  refreshed $refreshed existing, added $added new"

# ─── 4. Summary ───────────────────────────────────────
echo "[4/4] Summary"
echo "  Pi skills : $(ls "$PI/skills" 2>/dev/null | wc -l | tr -d ' ')"
echo "  LifeOS skills: $(find "$LifeOS/skills" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')"
echo "  Pi system prompt: $(wc -l < "$PI/LIFEOS_SYSTEM_PROMPT.md" | tr -d ' ') lines"
echo "  Pi AGENTS.md   : $(wc -l < "$PI/AGENTS.md" | tr -d ' ') lines"
echo
echo "✓ PiSync v2 complete"
