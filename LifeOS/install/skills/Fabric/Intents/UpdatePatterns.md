# UpdatePatterns

Brings the skill's local Patterns/ directory up to date with the upstream fabric repository and reports what changed.

## Ideal State

- `~/.claude/skills/Fabric/Patterns/` holds every pattern in the latest upstream fabric repository's `data/patterns/`, at its upstream content, copied from a fresh clone of that repository and never from `~/.config/fabric/patterns/`.
- Local-only patterns (present in Patterns/ but absent upstream) are kept and listed in the report; removing one is the principal's call.
- The release scrub survives the sync: where the release content scan is installed, its findings after the sync are a subset of its findings before, and any scrubbed file the sync overwrote is re-scrubbed before the sync is reported complete.
- The report gives the previous count (captured before the update), the new count, the number of patterns added (if any), and confirmation that the sync completed successfully.
- The report marks each key pattern `extract_wisdom`, `summarize`, `create_threat_model` and `analyze_claims` present or MISSING, as checked after the sync.
- `Patterns/catalog.yaml` is rebuilt after the copy, so it holds one current entry per pattern directory, and the report gives its added and changed entry counts. The copy never touches it: upstream ships no file of that name and the copy has no `--delete`.

## Anti-criteria

- A missing key pattern is never left unreported.
- A failed clone or copy is never reported as a completed sync.
- No metadata is ever written into a pattern's `system.md`; it lives only in the generated catalog.
- No pattern from `~/.config/fabric/patterns/` or any other non-upstream source enters Patterns/; the skill ships publicly.
- The upstream clone is never left behind after the sync.

## Inputs

The upstream repository is `https://github.com/danielmiessler/fabric.git`; its patterns live under `data/patterns/` (a top-level `patterns/` existed only in old releases, last seen in v1.4.195). The fabric CLI is not needed for this intent.

## Safety gates

- `fabric -U` and `~/.config/fabric/patterns/` are never the source: that directory mixes upstream with the principal's local patterns.
- No `--delete` on the copy: Patterns/ keeps patterns upstream has dropped, including the key pattern `create_threat_model` (SKILL.md § Gotchas).

## Tool contract

The steps run in this order and stop at the first failure: count and scan before, clone upstream, copy `data/patterns/`, rebuild the catalog, scan after, check, clean up.

```bash
set -euo pipefail
P=~/.claude/skills/Fabric/Patterns
CHECK=~/.claude/skills/Fabric/Tools/CheckPatterns.ts
CATALOG=~/.claude/skills/Fabric/Tools/PatternCatalog.ts
CFG=~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Fabric/Config.md   # optional; scan_tool: <path under ~/.claude>
T=$(sed -n "s/^scan_tool: *//p" "$CFG" 2>/dev/null || true)
SCAN="${FABRIC_SCAN_TOOL:-${T:+$HOME/.claude/$T}}"   # optional content scanner; unset skips the scan
WORK=$(mktemp -d)                               # scan snapshots; kept when a check fails
echo "Scan snapshots: $WORK"
trap 'rm -rf "$WORK/fabric"' EXIT               # the clone never outlives the run

CURRENT_COUNT=$(find "$P" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')   # directories only: catalog.yaml and pattern_explanations.md sit beside them
[ -n "$SCAN" ] && [ -f "$SCAN" ] && { bun "$SCAN" "$P" --json > "$WORK/before.json" || true; }

git clone --depth 1 https://github.com/danielmiessler/fabric.git "$WORK/fabric"
[ -d "$WORK/fabric/data/patterns" ] || { echo "Upstream has no data/patterns/: sync NOT done"; exit 1; }
rsync -a "$WORK/fabric/data/patterns/" "$P/"
bun "$CATALOG" build                            # prints: Catalog: N entries (added A, changed C, removed R), model calls: M

NEW_COUNT=$(find "$P" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
echo "Previous count: $CURRENT_COUNT"
echo "New count: $NEW_COUNT"
[ "$NEW_COUNT" -gt "$CURRENT_COUNT" ] && echo "Added: $((NEW_COUNT - CURRENT_COUNT)) new patterns"

if [ -n "$SCAN" ] && [ -f "$SCAN" ]; then
  bun "$SCAN" "$P" --json > "$WORK/after.json" || true
  bun "$CHECK" --upstream "$WORK/fabric/data/patterns" --scan-before "$WORK/before.json" --scan-after "$WORK/after.json"
else
  bun "$CHECK" --upstream "$WORK/fabric/data/patterns"
fi
rm -rf "$WORK"
echo "Pattern update complete!"
```

### Intent-to-Flag Mapping

| Situation | Command |
|-----------|---------|
| every sync: rebuild the catalog after the copy | `bun "$CATALOG" build` |
| no model available (offline): purposes for uncovered patterns from their IDENTITY section | `bun "$CATALOG" build --no-model` |
| confirm the catalog alone | `bun "$CATALOG" check --complete` |

`PatternCatalog.ts build` prints the catalog line with the added, changed and removed entry names, and makes one cached model call only for a new pattern with no line in `pattern_explanations.md`. `CheckPatterns.ts` prints the ✓ / ✗ MISSING line for each key pattern, the catalog's ✓ current or ✗ stale line, the upstream patterns still missing locally, the local-only patterns, and any new release-scan finding; it exits 1 when a key pattern or an upstream pattern is missing, the catalog is stale, or a new finding appeared. A new finding means the sync overwrote a scrubbed file: re-apply the scrub edit to that file (`git diff -- skills/Fabric/Patterns` shows what the sync changed), then re-run the scan and the check against the kept snapshot before reporting. Shell state does not carry between Bash calls, so the recovery redefines its paths; set `WORK` to the `Scan snapshots:` path the script printed:

```bash
set -euo pipefail
P=~/.claude/skills/Fabric/Patterns
CHECK=~/.claude/skills/Fabric/Tools/CheckPatterns.ts
CATALOG=~/.claude/skills/Fabric/Tools/PatternCatalog.ts
CFG=~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Fabric/Config.md
T=$(sed -n "s/^scan_tool: *//p" "$CFG" 2>/dev/null || true)
SCAN="${FABRIC_SCAN_TOOL:-${T:+$HOME/.claude/$T}}"   # the same optional scanner as above
WORK=<the Scan snapshots: path printed above>
[ -f "$WORK/before.json" ] || { echo "No snapshot at $WORK: set WORK first"; exit 1; }
bun "$CATALOG" build                            # the re-scrub changed a system.md, so its hash moved: rebuild before the check
[ -n "$SCAN" ] && [ -f "$SCAN" ] && { bun "$SCAN" "$P" --json > "$WORK/after.json" || true; }
bun "$CHECK" --scan-before "$WORK/before.json" --scan-after "$WORK/after.json" && rm -rf "$WORK"
```

## Output format

The report is the count block the update script prints (previous, new, added), the catalog line (entries, added, changed, removed, model calls), then the CheckPatterns output: the ✓ / ✗ MISSING key-pattern lines, the local-only list, and the release-scan result.
