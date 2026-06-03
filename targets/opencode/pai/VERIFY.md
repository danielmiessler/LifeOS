# PAI OpenCode — Verification Steps

After sourcing `init.sh`, run these checks to confirm everything is working.

## 1. File Structure Validation

Run the init script and confirm **all 4 items** pass:

```bash
cd ~/projects/pai-v5/targets/opencode/pai
source ./init.sh
```

Expected output — all 4 items show a green checkmark:

```
[1/4] Validating PAI structure…
  ✓  SYSTEM.md            (path/SYSTEM.md)
  ✓  ISA.md               (path/ISA.md)
  ✓  MEMORY               (path/MEMORY/)
  ✓  skills               (path/skills/)
```

If any item shows **MISSING**, the init will fail with a clear error.

## 2. Environment Variables

After sourcing, verify these env vars are set in your shell:

```bash
echo "PAI_ACTIVE=$PAI_ACTIVE"
echo "PAI_CONTEXT_DIR=$PAI_CONTEXT_DIR"
echo "PAI_ALGORITHM_VERSION=$PAI_ALGORITHM_VERSION"
```

Expected:

```
PAI_ACTIVE=1
PAI_CONTEXT_DIR=/home/turin/projects/pai-v5/targets/opencode/pai
PAI_ALGORITHM_VERSION=6.3.0
```

## 3. Codex CLI Detection

The init script prints the Codex CLI path and version. Confirm this section shows:

```
[3/4] Checking Codex CLI availability…
  ✓  codex      → /path/to/codex
     Version:   ...
```

If codex is not found, you'll see a warning (not a hard failure).

## 4. Idempotency Test

Source the init script **twice** in the same shell:

```bash
source ./init.sh    # first run — full init
source ./init.sh    # second run — should be skipped
```

The second run should output only:

```
[PAI] Already active (PAI_ACTIVE=1). Skipping re-init.
```

No duplicate variable exports, no repeated validation.

## 5. Context File Contents (Spot Check)

Verify the key files contain expected content:

```bash
# SYSTEM.md — should reference "Algorithm" and "v6.3.0"
head -5 ~/projects/pai-v5/targets/opencode/pai/SYSTEM.md

# ISA.md — should start with ISA template header
head -5 ~/projects/pai-v5/targets/opencode/pai/ISA.md

# MEMORY/ — directory exists with README
ls ~/projects/pai-v5/targets/opencode/pai/MEMORY/

# skills/ — contains thinking and research files
ls ~/projects/pai-v5/targets/opencode/pai/skills/
```

## 6. Codex Launch (Optional)

If you want to launch Codex CLI with PAI context:

```bash
codex --context-dir ~/projects/pai-v5/targets/opencode/pai
```

Or via environment variable:

```bash
export CODEX_CONTEXT_DIR=~/projects/pai-v5/targets/opencode/pai
codex
```

## Acceptance Criteria

All of the following must pass:

| # | Check | Pass/Fail |
|---|-------|-----------|
| 1 | `source ./init.sh` completes without errors | ☐ |
| 2 | All 4 structure items pass validation | ☐ |
| 3 | `PAI_ACTIVE == 1` after sourcing | ☐ |
| 4 | Codex path is reported (or warning if absent) | ☐ |
| 5 | Second `source` is idempotent (skipped) | ☐ |
| 6 | Key files have expected content | ☐ |
