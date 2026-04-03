# UpdatePatterns Workflow

Update Fabric patterns from the upstream repository to keep patterns current with latest improvements and additions.

---

## Prerequisites

**Fabric CLI must be installed.** The update pulls from the official fabric repository.

To install fabric:
```bash
go install github.com/danielmiessler/fabric@latest
```

---

## Workflow Steps

### Step 1: Send Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Updating Fabric patterns from upstream repository"}' \
  > /dev/null 2>&1 &
```

### Step 2: Check Current Pattern Count

```bash
CURRENT_COUNT=$(ls -1 ~/.claude/skills/Fabric/Patterns/ 2>/dev/null | wc -l | tr -d ' ')
echo "Current patterns: $CURRENT_COUNT"
```

### Step 3: Update via Fabric CLI

The fabric CLI handles pulling the latest patterns from the upstream repository:

```bash
fabric -U
```

This updates patterns in `~/.config/fabric/patterns/`.

### Step 4: Sync to Skill Directory

Copy updated patterns to the Fabric skill's local storage:

```bash
rsync -av --delete ~/.config/fabric/patterns/ ~/.claude/skills/Fabric/Patterns/
```

### Step 5: Report Results

```bash
NEW_COUNT=$(ls -1 ~/.claude/skills/Fabric/Patterns/ 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "Pattern update complete!"
echo "Previous count: $CURRENT_COUNT"
echo "New count: $NEW_COUNT"
if [ "$NEW_COUNT" -gt "$CURRENT_COUNT" ]; then
  ADDED=$((NEW_COUNT - CURRENT_COUNT))
  echo "Added: $ADDED new patterns"
fi
```

### Step 6: Verify Key Patterns Exist

Confirm critical patterns are present:

```bash
for pattern in extract_wisdom summarize create_threat_model analyze_claims; do
  if [ -d ~/.claude/skills/Fabric/Patterns/$pattern ]; then
    echo "✓ $pattern"
  else
    echo "✗ $pattern MISSING"
  fi
done
```

---

## Alternative: Manual Git Update

If fabric CLI is not available, you can update from the fabric repository directly:

```bash
# Clone or update fabric repo
cd /tmp
if [ -d fabric ]; then
  cd fabric && git pull
else
  git clone https://github.com/danielmiessler/fabric.git
  cd fabric
fi

# Sync patterns
rsync -av --delete patterns/ ~/.claude/skills/Fabric/Patterns/

# Cleanup
cd /tmp && rm -rf fabric
```

---

## Verification

After update, verify with:

```bash
# Count patterns
ls -1 ~/.claude/skills/Fabric/Patterns/ | wc -l

# List recent additions (if patterns have dates)
ls -lt ~/.claude/skills/Fabric/Patterns/ | head -10
```

---

## Output

Report to user:
- Previous pattern count
- New pattern count
- Number of patterns added (if any)
- Confirmation that sync completed successfully
