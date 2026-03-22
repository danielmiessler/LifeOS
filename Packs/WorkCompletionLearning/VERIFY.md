# Verifying WorkCompletionLearning

## File Existence Checks

```bash
# All required files should exist
echo "Checking hook file..."
test -f ~/.claude/hooks/WorkCompletionLearning.hook.ts && echo "PASS: Hook file exists" || echo "FAIL: Hook file missing"

echo "Checking learning-utils library..."
test -f ~/.claude/hooks/lib/learning-utils.ts && echo "PASS: learning-utils exists" || echo "FAIL: learning-utils missing"

echo "Checking time library..."
test -f ~/.claude/hooks/lib/time.ts && echo "PASS: time.ts exists" || echo "FAIL: time.ts missing"

echo "Checking LEARNING directories..."
test -d ~/.claude/MEMORY/LEARNING/ALGORITHM && echo "PASS: ALGORITHM dir exists" || echo "FAIL: ALGORITHM dir missing"
test -d ~/.claude/MEMORY/LEARNING/SYSTEM && echo "PASS: SYSTEM dir exists" || echo "FAIL: SYSTEM dir missing"

echo "Checking hook is executable..."
test -x ~/.claude/hooks/WorkCompletionLearning.hook.ts && echo "PASS: Hook is executable" || echo "FAIL: Hook not executable"
```

## Runtime Check

```bash
# The hook should exit cleanly with no active work session
echo '{}' | bun run ~/.claude/hooks/WorkCompletionLearning.hook.ts 2>&1
# Expected: "[WorkCompletionLearning] No active work session" on stderr, exit code 0
echo "Exit code: $?"
```

## Functional Test

Create a temporary work session and verify the hook captures a learning file:

```bash
# Create a test work state
mkdir -p ~/.claude/MEMORY/STATE
mkdir -p ~/.claude/MEMORY/WORK/test-session

cat > ~/.claude/MEMORY/STATE/current-work.json << 'EOF'
{
  "session_id": "test-verify",
  "session_dir": "test-session",
  "created_at": "2026-01-01T10:00:00-06:00"
}
EOF

cat > ~/.claude/MEMORY/WORK/test-session/META.yaml << 'EOF'
id: test-verify
title: Verification Test Session
created_at: "2026-01-01T10:00:00-06:00"
completed_at: null
source: MANUAL
status: active
session_id: test-verify
lineage:
  tools_used:
    - Read
    - Write
  files_changed:
    - test-file.ts
  agents_spawned: []
EOF

# Run the hook
echo '{"session_id": "test-verify"}' | bun run ~/.claude/hooks/WorkCompletionLearning.hook.ts 2>&1

# Check for created learning file
echo "Looking for learning files..."
find ~/.claude/MEMORY/LEARNING -name "*verification-test*" -type f 2>/dev/null
# Expected: One file in ALGORITHM/{current-month}/

# Cleanup test data
rm -f ~/.claude/MEMORY/STATE/current-work.json
rm -rf ~/.claude/MEMORY/WORK/test-session
# Optionally remove the test learning file
```

## Expected Results

- All file existence checks pass
- Runtime check exits with code 0 and prints "No active work session"
- Functional test creates a learning file in `MEMORY/LEARNING/ALGORITHM/{YYYY-MM}/`
- The learning file contains the title "Verification Test Session"
