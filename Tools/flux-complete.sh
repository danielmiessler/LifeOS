#!/usr/bin/env bash
# flux-complete.sh — Vikunja unblocking sweep + exit code for flux-loop.sh
#
# Usage: flux-complete.sh [--project <name>]
#
# Exit 0: Ready tasks exist — loop should continue invoking Bea
# Exit 1: No Ready tasks — loop is done
# Exit 2: API or config error — loop should abort

set -uo pipefail

VIKUNJA_URL="http://192.168.3.130:3456/api/v1"
PROJECT_NAME="Marvin"

# --- token ---
TOKEN="${VIKUNJA_TOKEN:-}"
if [[ -z "$TOKEN" ]] && [[ -f "$HOME/.config/pai/.env" ]]; then
    TOKEN=$(grep 'VIKUNJA_API_KEY' "$HOME/.config/pai/.env" 2>/dev/null | cut -d= -f2)
fi
if [[ -z "$TOKEN" ]] && [[ -f "$HOME/.env" ]]; then
    TOKEN=$(grep 'VIKUNJA_TOKEN' "$HOME/.env" 2>/dev/null | cut -d= -f2)
fi
if [[ -z "$TOKEN" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: VIKUNJA_TOKEN not set and not in ~/.config/pai/.env or ~/.env"
    exit 2
fi

# --- args ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --project) PROJECT_NAME="${2:?--project requires a name}"; shift 2;;
        *) shift;;
    esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

_api() {
    local method="$1" path="$2" body="${3:-}"
    local args=(-s -w '\n%{http_code}'
        -X "$method"
        -H "Authorization: Bearer $TOKEN"
        -H "Content-Type: application/json"
        "$VIKUNJA_URL$path")
    [[ -n "$body" ]] && args+=(-d "$body")
    curl "${args[@]}"
}

api() {
    local method="$1" path="$2" body="${3:-}"
    local raw response http_code
    raw=$(_api "$method" "$path" "$body") || { log "ERROR: curl failed: $method $path"; exit 2; }
    http_code=$(echo "$raw" | tail -1)
    response=$(echo "$raw" | head -n -1)
    if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
        log "ERROR: API $method $path returned HTTP $http_code: $(echo "$response" | head -c 200)"
        exit 2
    fi
    echo "$response"
}

log "flux-complete.sh starting: project='$PROJECT_NAME'"

# 1. Resolve project ID by name
log "Resolving project..."
projects=$(api GET /projects)
project_id=$(echo "$projects" | python3 -c "
import json, sys
projects = json.load(sys.stdin)
name = sys.argv[1]
for p in projects:
    if p['title'].lower() == name.lower():
        print(p['id'])
        break
" "$PROJECT_NAME" 2>/dev/null)
[[ -z "$project_id" ]] && { log "ERROR: Project '$PROJECT_NAME' not found"; exit 2; }
log "  project_id=$project_id"

# 2. Find kanban view ID
log "Finding kanban view..."
views=$(api GET "/projects/$project_id/views")
view_id=$(echo "$views" | python3 -c "
import json, sys
views = json.load(sys.stdin)
for v in views:
    if v.get('view_kind') == 'kanban':
        print(v['id'])
        break
" 2>/dev/null)
[[ -z "$view_id" ]] && { log "ERROR: No kanban view found for project $project_id"; exit 2; }
log "  view_id=$view_id"

# 3. Get full kanban state — buckets with tasks embedded
log "Fetching kanban state..."
kanban_json=$(api GET "/projects/$project_id/views/$view_id/tasks")

# Parse: emit backlog tasks with unblock status, write bucket IDs to temp file
tmp_cfg=$(mktemp)
tmp_json=$(mktemp)
trap 'rm -f "$tmp_cfg" "$tmp_json"' EXIT
echo "$kanban_json" > "$tmp_json"

task_lines=$(python3 - "$tmp_cfg" "$tmp_json" << 'PYEOF'
import json, sys

with open(sys.argv[2]) as _f:
    kanban = json.load(_f)
cfg_path = sys.argv[1]

# Build task_id -> bucket_id map from kanban state
task_bucket = {}
backlog_id = None
ready_id = None
review_done_ids = set()

for b in kanban:
    bname = b['title'].lower()
    bid = b['id']
    if bname == 'backlog':
        backlog_id = bid
    elif bname == 'ready':
        ready_id = bid
    elif bname in ('review', 'done'):
        review_done_ids.add(bid)
    for t in (b.get('tasks') or []):
        task_bucket[t['id']] = bid

if not backlog_id or not ready_id:
    sys.stderr.write("ERROR: Could not find Backlog or Ready bucket\n")
    sys.exit(1)

with open(cfg_path, 'w') as f:
    f.write(f"backlog_id={backlog_id}\n")
    f.write(f"ready_id={ready_id}\n")
    f.write(f"view_id=\n")

# Emit backlog tasks
for b in kanban:
    if b['title'].lower() != 'backlog':
        continue
    for t in (b.get('tasks') or []):
        blockers = [x['id'] for x in t.get('related_tasks', {}).get('blocked', [])]
        if not blockers:
            status = 'no_blockers'
        elif all(task_bucket.get(bl) in review_done_ids for bl in blockers):
            status = 'unblocked'
        else:
            status = 'blocked'
        # Escape pipe chars in title for safe field splitting
        title = t['title'][:60].replace('|', '-')
        print(f"{t['id']}|{status}|{title}")
PYEOF
)

backlog_id=$(grep '^backlog_id=' "$tmp_cfg" | cut -d= -f2)
ready_id=$(grep '^ready_id=' "$tmp_cfg" | cut -d= -f2)
[[ -z "$backlog_id" || -z "$ready_id" ]] && { log "ERROR: Could not resolve bucket IDs"; exit 2; }
log "  backlog=$backlog_id ready=$ready_id"

# 4. Unblocking sweep
log "Running unblocking sweep..."
unblocked=0
if [[ -n "$task_lines" ]]; then
    while IFS='|' read -r task_id status task_title; do
        [[ -z "$task_id" ]] && continue
        case "$status" in
            unblocked)
                log "  → Moving to Ready: $task_id ($task_title)"
                api POST "/projects/$project_id/views/$view_id/buckets/$ready_id/tasks" \
                    "{\"task_id\": $task_id}" > /dev/null
                unblocked=$((unblocked + 1))
                ;;
            no_blockers)
                log "  ? Ambiguous (no blockers): $task_id ($task_title) — leaving in Backlog"
                ;;
            blocked)
                log "  ✗ Blocked: $task_id ($task_title)"
                ;;
        esac
    done <<< "$task_lines"
fi
log "Sweep complete. Moved $unblocked task(s) to Ready."

# 5. Count Ready tasks (re-fetch after sweep)
log "Counting Ready tasks..."
ready_count=$(api GET "/projects/$project_id/views/$view_id/tasks" | python3 -c "
import json, sys
kanban = json.load(sys.stdin)
for b in kanban:
    if b['title'].lower() == 'ready':
        print(len(b.get('tasks') or []))
        break
" 2>/dev/null)
ready_count="${ready_count:-0}"
log "  Ready count: $ready_count"

if [[ "$ready_count" -gt 0 ]]; then
    log "Work available — exiting 0 (loop continues)"
    exit 0
else
    log "No Ready tasks — exiting 1 (loop done)"
    exit 1
fi
