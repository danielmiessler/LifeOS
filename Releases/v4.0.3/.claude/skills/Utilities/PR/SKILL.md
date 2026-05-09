---
name: PR
description: Create a pull request and babysit it through CodeRabbit review until ready to merge. USE WHEN raise a PR, create a PR, commit and PR, open a PR, submit a PR, push and PR, raise a pull request, commit the changes and raise a PR.
---

<!-- markdownlint-disable MD013 MD032 MD041 -->
## Mandatory Trigger

**When the user says any form of "raise a PR", "create a PR", "commit and PR", or "push and raise a PR", ALWAYS invoke this skill.**

| User Says | Action |
|-----------|--------|
| "raise a PR" / "create a PR" / "open a PR" | → Full workflow (commit, push, create PR, babysit CodeRabbit) |
| "commit and PR" / "commit the changes and raise a PR" | → Full workflow |
| "push and PR" | → Full workflow (skip commit if already committed) |

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PR/`

If this directory exists, load and apply any PREFERENCES.md or configurations found there.

## Workflow

Execute `Workflows/CreateAndBabysit.md` — this is the only workflow in this skill.

## What "Done" Means

The PR is ready to merge ONLY when ALL of these are true:
1. CodeRabbit has completed its review (not pending, not in progress)
2. All Critical/Major/Minor findings have been fixed and CodeRabbit has validated the fixes
3. All Nitpick/Trivial findings have been replied to (skipped with reason) and resolved
4. There are zero unresolved review threads where CodeRabbit is waiting for your response
5. The latest CodeRabbit review state is NOT `CHANGES_REQUESTED` (or stale ones have been dismissed)

**If ANY of those conditions are not met, you are NOT done. Keep iterating.**
