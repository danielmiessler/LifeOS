<!-- markdownlint-disable MD013 MD026 MD031 MD032 -->
# Create PR and Babysit CodeRabbit

**Mode:** Background agent — runs autonomously until CodeRabbit is satisfied
**Timeout:** Up to 60 minutes (multiple CodeRabbit review cycles)

## Overview

This workflow creates a PR and then iterates with CodeRabbit until the PR is genuinely ready to merge. "Ready to merge" means zero open conversations, no pending reviews, and no `CHANGES_REQUESTED` state.

**This is NOT a one-pass process.** CodeRabbit reviews, you fix, CodeRabbit re-reviews, you fix again. Repeat until clean. Typically 2-4 cycles.

---

## Phase 1: Create the PR

### Step 1.1: Commit (if needed)

If there are uncommitted changes, commit them following the standard git commit process:
- `git status` to see changes
- `git diff` to review
- `git log --oneline -5` for commit message style
- Stage specific files (not `git add -A`)
- Write a descriptive commit message
- Include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

### Step 1.2: Push

```bash
git push -u origin HEAD
```

### Step 1.3: Create the PR with auto-merge enabled

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<bullets>

## Test plan
<checklist>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then enable auto-merge so the PR merges as soon as all checks pass and the user approves:

```bash
PR_NUMBER=$(gh pr view --json number --jq '.number')
gh pr merge "$PR_NUMBER" --auto --merge 2>/dev/null || true
```

This means once the user clicks "Approve", GitHub merges automatically without needing a second click.

Capture the PR number:
```bash
PR_NUMBER=$(gh pr view --json number --jq '.number')
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
OWNER=${REPO%/*}
NAME=${REPO#*/}
```

### Step 1.4: Launch babysitter

Launch a **background agent** to handle the CodeRabbit iteration loop. The agent runs Phase 2 below autonomously. The main conversation reports: "PR #N created. CodeRabbit babysitter running in the background — I'll tell you when it's ready to merge."

---

## Phase 2: CodeRabbit Babysitter Loop

This phase runs as a background agent. It polls, waits, fixes, and iterates until CodeRabbit is satisfied.

### Step 2.1: Wait for CodeRabbit's first review

Poll every 30 seconds for up to 10 minutes:

```bash
for i in $(seq 1 20); do
  count=$(gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
    --jq "[.[] | select(.user.login == \"coderabbitai[bot]\")] | length")
  echo "[poll] iter $i/20 — CR reviews: $count"
  if [ "$count" -gt 0 ]; then echo "REVIEW_FOUND"; break; fi
  sleep 30
done
```

If no review after 10 minutes, check for rate-limit comment:

```bash
rate_limit=$(gh api "repos/$REPO/issues/$PR_NUMBER/comments" \
  --jq '[.[] | select(.user.login == "coderabbitai[bot]" and (.body | test("come back in|rate.?limit"; "i")))] | length')
```

If rate-limited: wait 15 minutes, then retrigger with `@coderabbitai review` comment, then poll again.

If still no review after 30 minutes total: report "CodeRabbit didn't review — PR ready for manual review" and stop.

### Step 2.2: Read review threads

Use GraphQL to get unresolved threads where CodeRabbit is waiting for your response:

```bash
gh api graphql -f query='{
  repository(owner: "'"$OWNER"'", name: "'"$NAME"'") {
    pullRequest(number: '"$PR_NUMBER"') {
      reviewThreads(first: 100) {
        nodes {
          isResolved
          id
          firstComment: comments(first: 1) {
            nodes { author { login } body path line }
          }
          lastComment: comments(last: 1) {
            nodes { author { login } }
          }
        }
      }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads.nodes[]
  | select(.isResolved == false)
  | select(.firstComment.nodes[0].author.login == "coderabbitai")
  | select(.lastComment.nodes[0].author.login == "coderabbitai")'
```

Also check latest review state:

```bash
LATEST_STATE=$(gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
  --jq '[.[] | select(.user.login == "coderabbitai[bot]")] | last | .state')
```

**Exit condition:** If zero threads pending your response AND `$LATEST_STATE` is not `CHANGES_REQUESTED` → go to Step 2.5 (done).

### Step 2.3: Fix and respond to each thread

For each thread from Step 2.2, classify by severity marker in the comment body:

| Marker | Action |
|--------|--------|
| Critical, Major, Minor (any severity icon) | **Fix the code.** Then reply: `Fixed in <SHA>: <summary>`. Do NOT resolve the thread — let CodeRabbit validate on re-review. |
| Nitpick, Trivial (🧹, 🔵) | **Skip.** Reply: `Skipping per project convention: nitpicks not auto-applied.` Then **resolve the thread manually** (CodeRabbit won't close these). |

For fixes:
1. Edit the files
2. Run the repo's verify commands (check CLAUDE.md or package.json for the right command — typically `npm run check` or similar)
3. Commit: `git add <files> && git commit -m "fix: address CodeRabbit review findings"`
4. Push: `git push origin HEAD`

Reply to each thread using GraphQL:

```bash
gh api graphql \
  -f query='mutation($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: {
      pullRequestReviewThreadId: $threadId,
      body: $body
    }) { comment { id } }
  }' \
  -F threadId="$THREAD_ID" \
  -F body="$REPLY_BODY"
```

For skipped threads, also resolve:

```bash
gh api graphql \
  -f query='mutation($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread { isResolved }
    }
  }' \
  -F threadId="$THREAD_ID"
```

### Step 2.4: Wait for CodeRabbit to re-review

**This is the critical step that must NOT be skipped.** After pushing fixes and replying, CodeRabbit needs time to re-review. You are NOT done yet.

First, do a fast-exit check — if there are zero threads pending your response and state is not CHANGES_REQUESTED, skip waiting:

```bash
pending=$(gh api graphql -f query='{
  repository(owner: "'"$OWNER"'", name: "'"$NAME"'") {
    pullRequest(number: '"$PR_NUMBER"') {
      reviewThreads(first: 100) {
        nodes {
          isResolved
          firstComment: comments(first: 1) { nodes { author { login } } }
          lastComment: comments(last: 1) { nodes { author { login } } }
        }
      }
    }
  }
}' --jq '[.data.repository.pullRequest.reviewThreads.nodes[]
  | select(.isResolved == false)
  | select(.firstComment.nodes[0].author.login == "coderabbitai")
  | select(.lastComment.nodes[0].author.login == "coderabbitai")] | length')

latest_state=$(gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
  --jq '[.[] | select(.user.login == "coderabbitai[bot]")] | last | .state // "NONE"')

if [ "$pending" = "0" ] && [ "$latest_state" != "CHANGES_REQUESTED" ]; then
  echo "SKIP_WAIT"
fi
```

If NOT skip: capture baseline review count, then poll every 30 seconds for up to 10 minutes for a new review. If rate-limited, wait 15 minutes and retrigger. If no new review after 25 minutes, proceed with current state.

**Then go back to Step 2.2.** This is a LOOP. Repeat until the exit condition is met.

**Maximum iterations: 10.** If still not clean after 10 cycles, report what's remaining and stop.

### Step 2.5: Rebase onto base branch if needed

Before declaring ready, check if the PR branch has diverged from the base branch (other PRs may have merged while you were iterating). Merge conflicts will block the merge button.

```bash
BASE=$(gh pr view "$PR_NUMBER" --json baseRefName --jq '.baseRefName')
git fetch origin "$BASE"

# Check if rebase is needed
BEHIND=$(git rev-list --count HEAD..origin/$BASE)
echo "Branch is $BEHIND commits behind $BASE"

if [ "$BEHIND" -gt 0 ]; then
  if git rebase "origin/$BASE"; then
    git push --force-with-lease origin HEAD
    echo "Rebased successfully onto $BASE"
  else
    # Rebase conflict — try to resolve
    echo "Rebase conflict detected. Attempting resolution..."
    
    # Check which files conflict
    CONFLICTS=$(git diff --name-only --diff-filter=U)
    echo "Conflicting files: $CONFLICTS"
    
    # For each conflicting file, try to resolve
    RESOLVED=true
    for f in $CONFLICTS; do
      # Accept our version for files we modified, theirs for files we didn't
      if git log --oneline HEAD...ORIG_HEAD -- "$f" | grep -q .; then
        git checkout --theirs "$f" && git add "$f"
      else
        git checkout --ours "$f" && git add "$f"
      fi
    done
    
    if git rebase --continue 2>/dev/null; then
      git push --force-with-lease origin HEAD
      echo "Rebase conflict resolved and pushed"
    else
      git rebase --abort
      echo "REBASE_FAILED: Could not auto-resolve conflicts. Needs human attention."
      gh pr comment "$PR_NUMBER" --body "Rebase conflict with \`$BASE\` that couldn't be auto-resolved. Files: $CONFLICTS. Needs manual resolution."
    fi
  fi
fi
```

If REBASE_FAILED, report to user with the conflicting files and stop. Do not claim ready to merge.

After a successful rebase, CodeRabbit may re-review. If so, wait for it and handle any new threads (back to Step 2.2).

### Step 2.6: Dismiss stale CHANGES_REQUESTED reviews (renumbered from 2.5)

If the latest CodeRabbit review is NOT `CHANGES_REQUESTED` but an older one is, dismiss the stale ones:

```bash
LATEST_CR_STATE=$(gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
  --jq '[.[] | select(.user.login == "coderabbitai[bot]")] | last | .state // "NONE"')

if [ "$LATEST_CR_STATE" != "CHANGES_REQUESTED" ]; then
  STALE_IDS=$(gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
    --jq '[.[] | select(.user.login == "coderabbitai[bot]" and .state == "CHANGES_REQUESTED") | .id] | .[]')
  for rid in $STALE_IDS; do
    gh api -X PUT "repos/$REPO/pulls/$PR_NUMBER/reviews/$rid/dismissals" \
      -f message="Superseded by subsequent CodeRabbit reviews after fix commits."
  done
fi
```

### Step 2.7: Report ready

Report to the user: "PR #N is ready to merge: {URL}. All CodeRabbit findings addressed, no open conversations." Always include the full PR URL.

---

## Rules

1. **Never dismiss a review to make it go away.** Only dismiss stale CHANGES_REQUESTED reviews after the latest review is clean.
2. **Never claim "ready to merge" while `reviewDecision == CHANGES_REQUESTED`.** This is the binding invariant — see Rule 9 below.
3. **Never skip the re-review wait.** After fixing, you MUST wait for CodeRabbit to re-review before checking if you're done.
4. **Always reply to every thread** — fixes get "Fixed in SHA" replies, nitpicks get "Skipping" replies. Unreplied threads mean CodeRabbit is waiting for you.
5. **Resolve only nitpick/trivial/disputed threads.** Let CodeRabbit resolve fix threads after it validates your changes.
6. **The loop repeats until clean.** Two or three cycles is normal. Don't report done after one cycle.
7. **Use GraphQL for thread operations.** REST API doesn't support thread-level replies and resolutions properly.
8. **Poll in short batches.** The Bash tool has a ~10 minute timeout, so use 10×30s or 20×30s loops, not one long sleep.

### Rule 9: When `reviewDecision == CHANGES_REQUESTED`, ALWAYS check for unresolved threads first.

**Never assume `CHANGES_REQUESTED` is "stale."** That word is reserved for one narrow case:

> **Stale CHANGES_REQUESTED** = the original CHANGES_REQUESTED review was on an earlier commit, ALL its findings have since been resolved (zero unresolved CR threads on the latest commit), AND a subsequent CR review on a newer commit is non-CHANGES_REQUESTED.

If `reviewDecision == CHANGES_REQUESTED`, the babysitter (or any orchestrator picking up mid-cycle) MUST in this order:

1. **Query unresolved CR-pending threads** (the GraphQL query in Step 2.2). If any exist → those are the requested changes; address them via Step 2.3 and loop. **Never dismiss while threads are unresolved.**
2. **If zero unresolved threads** → check the latest CR submitted review state. If it's still `CHANGES_REQUESTED` on the current HEAD with no pending threads, this is a CR rendering quirk; comment `@coderabbitai review` to retrigger and wait one more cycle.
3. **Only after both checks**: if the latest CR review state on the current HEAD is non-CHANGES_REQUESTED AND zero pending threads exist, the older CHANGES_REQUESTED reviews are genuinely stale and may be dismissed.

This rule exists because babysitters can be killed mid-cycle (quota, timeout, error). When the next agent picks up, the safe assumption is "there are real outstanding findings" — verify by query, never by ageing/dismissal heuristics.

**Failure mode this prevents:** a partially-completed babysit leaves CR threads unresolved → orchestrator sees `CHANGES_REQUESTED` → assumes stale → dismisses → the actual findings are silently buried in a closed merge. Once observed (PR #9, F013-AppStarter); rule added.
