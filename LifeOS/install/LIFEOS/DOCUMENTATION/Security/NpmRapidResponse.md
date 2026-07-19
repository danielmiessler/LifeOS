---
last_updated: 2026-05-20T20:50:00Z
last_updated_by: kai
convention: pai-freshness-v1
last_reviewed: 2026-05-20T20:50:00Z
last_reviewed_by: kai
version: 1.0.2
---

# npm Supply-Chain Rapid Response

Fire this runbook when ANY new npm supply-chain advisory drops (TanStack-style worm, malicious package, registry compromise). Designed to take ≤5 minutes per project for the cache-and-reinstall pass.

## Standing defense (already in place)

- **`minimumReleaseAge = 86400`** in `~/.bunfig.toml` and `$LIFEOS_ROOT/bunfig.toml` rejects any package published in the last 24 hours. The May 11 Mini Shai-Hulud worm lived 3 hours from publish to npm-pull; this filter neutralizes that attack window without requiring vendor trust.
- **Bun's `trustedDependencies` allowlist** — transitive packages don't get to run lifecycle scripts unless their name is in your `package.json`'s `trustedDependencies` array. Default-deny on transitive scripts.
- **All active CI Actions SHA-pinned** in each project's `.github/workflows/` directory with Dependabot auto-PR'ing bumps weekly.

## Incident response steps

### 1. Read the advisory (1 min)

Pull the named compromised packages and their version ranges into a working note. Sources in order of priority: Wiz Blog, Snyk advisories, the upstream maintainer's postmortem, npm's security advisory feed.

### 2. Direct-IOC scan (2 min per scan)

```bash
# Pattern: every compromised package name, alternation-separated
IOC='@evil/pkg-one|@evil/pkg-two|"some-package":'

# Scan all lockfiles
find ~/Projects ~/LocalProjects $LIFEOS_ROOT -maxdepth 6 \
  \( -name "bun.lock" -o -name "package-lock.json" -o -name "yarn.lock" -o -name "pnpm-lock.yaml" \) \
  -not -path "*/node_modules/*" -not -path "*/LIFEOS_RELEASES/*" -not -path "*/.next/*" \
  2>/dev/null | xargs rg -l "$IOC"

# Scan all package.json (for declared deps that may have lockfile drift)
find ~/Projects ~/LocalProjects $LIFEOS_ROOT -maxdepth 6 -name "package.json" \
  -not -path "*/node_modules/*" -not -path "*/LIFEOS_RELEASES/*" -not -path "*/.next/*" \
  2>/dev/null | xargs rg -l "$IOC"
```

If both return empty → declared-dependency exposure is zero. Proceed to step 3 for transient-install coverage.

If either returns hits → record the project path + version, then per-project remediation: bump to a known-clean version, run cache-nuke (step 4), verify.

### 3. Mtime check for the worm window (1 min)

```bash
# Replace dates with the advisory's worm window
for lf in $(find ~/Projects ~/LocalProjects $LIFEOS_ROOT -maxdepth 6 -name "bun.lock" -not -path "*/node_modules/*" 2>/dev/null); do
  mt=$(stat -f "%Sm" -t "%Y-%m-%d" "$lf" 2>/dev/null)
  case "$mt" in
    YYYY-MM-DD|YYYY-MM-DD)  # <-- replace with worm window dates
      echo "  $mt  $lf"
      ;;
  esac
done
```

Any lockfile modified during the worm window is a candidate for cache-nuke even if direct IOC is clean (defense against transient/cached installs).

### 4. Cache-nuke and reinstall (per project, ≤2 min)

```bash
cd <project>
bun pm cache rm
rm -rf node_modules
bun install --frozen-lockfile
```

`--frozen-lockfile` ensures the lockfile is treated as authoritative; this catches any lockfile/cache drift that may have allowed a transient install.

### 5. Rotate suspect credentials (only if step 2 hit OR step 3 flagged transient-install)

- npm token (if any) — `npm token list`, revoke, regenerate
- GitHub PAT (any token used in CI on the host) — `gh auth refresh`
- AWS / GCP / Azure on dev hosts where install ran during worm window
- See `$LIFEOS_ROOT/skills/_INCIDENT_RESPONSE/SKILL.md` for the full rotation protocol

## Hardening levers (one per attack surface)

| Surface | Lever |
|---------|-------|
| Just-published malicious packages | `minimumReleaseAge` in bunfig (in place) |
| Lifecycle-script execution in CI | `bun install --ignore-scripts` in workflow steps |
| Lifecycle-script execution locally | Add malicious package's name to `trustedDependencies` allowlist only when verified safe |
| GitHub Actions tag-move attacks | SHA-pin all `uses:` lines + Dependabot weekly bumps (in place for Website) |
| Pull-request-target workflow exfil | Ban `pull_request_target` in any workflow that checks out PR code (currently zero use across {{PRINCIPAL_NAME}}'s repos) |
| Credentials in CI | Default-deny `permissions:` block at workflow level; per-job grants |
| Stale npm cache | `bun pm cache rm` before any reinstall during incident response |
| Dev-host credential blast radius | `~/.bun/install/cache` is per-user; install lifecycle scripts run as the user → all reachable credentials are in scope |

## Anti-patterns

- **Don't** `bun install` against a fresh advisory before completing step 2.
- **Don't** rotate every credential reflexively — match rotation scope to actual exposure.
- **Don't** trust `npm audit` / `bun audit` as a primary signal during an active worm; the registry's signal lags by hours.
- **Don't** silence the `minimumReleaseAge` warning globally by emptying the excludes list. Add the specific package name to `minimumReleaseAgeExcludes` and document why.

## Reference

- May 11, 2026 Mini Shai-Hulud worm postmortem: https://tanstack.com/blog/npm-supply-chain-compromise-postmortem
- Audit ISA that produced this runbook: `$LIFEOS_DIR/MEMORY/WORK/20260520-npm-exposure-audit/ISA.md`
- Implementation ISA: `$LIFEOS_DIR/MEMORY/WORK/20260520-npm-hardening-implementation/ISA.md`
- Bun bunfig docs: https://bun.sh/docs/runtime/bunfig
- `_INCIDENT_RESPONSE` skill for the parallel credential rotation protocol.
