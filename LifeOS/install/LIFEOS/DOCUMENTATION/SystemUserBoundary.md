---
last_updated: 2026-09-27
last_updated_by: "da (write-time guard roots: resolved config root plus the HOME profile)"
convention: lifeos-freshness-v1
applies_to: LifeOS v6.0.0+ (proposed)
version: 1.3.9
---

# System / User Boundary

> This boundary is the thesis's deepest structural commitment (`LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`): LifeOS the OS is universal and public; the life it runs is singular and private. The four zones below are how one repo can be everyone's Life OS without ever containing anyone's life.

> The structural contract that makes the LifeOS live tree publishable by construction rather than by scrub.

## Why this document exists

Through LifeOS v4 and v5, the live LifeOS tree and the public release artifact diverged because there was no enforced architectural separation between system code (intended to ship) and user data (must never ship). Defenses were exclusively build-time: a fourteen-gate scrubber (since grown to twenty-six), a deny-list pattern grep, and a containment-zone path inventory. The runtime guard hook was removed in the 2026-05-06 security simplification, leaving no write-time enforcement at all. Drift accumulated between releases; every release required a re-sanitization sweep; the community ran a different artifact than the maintainer.

This document declares the canonical boundary. Every file in `~/.claude/` falls into exactly one of four zones. The boundary is enforced at three layers: at write time by a runtime hook, at PR time by GitHub Actions, at release time by the existing build-time gates as a backstop.

## The four zones

### SYSTEM

Public-by-construction code, documentation, and templates that ship in every LifeOS release. SYSTEM files contain **zero references to any specific user, project, identity, hostname, credential, or personal artifact**. SYSTEM files use only generic placeholders (`{PRINCIPAL.NAME}`, `{DA_IDENTITY.NAME}`, `${LIFEOS_USER_DIR}`, `${HOME}`, "the principal", "your DA").

| Path | Status |
|------|--------|
| `~/.claude/CLAUDE.md` | SYSTEM (after Phase C — split into system router + user @-imports) |
| `~/.claude/settings.json` | SYSTEM (after Phase B — split into system defaults + user overlay merged at startup) |
| `~/.claude/skills/LifeOS/install/install.sh` | SYSTEM (installer bootstrap — ships inside the `LifeOS/` skill; there is no root-level `install.sh` in a release) |
| `~/.claude/LICENSE` (source tree only; not in the release payload) | SYSTEM |
| `~/.claude/.gitignore`, `.gitattributes`, `.gitmodules`, `.mcp.json`, `.lsp.json`, `bunfig.toml` | SYSTEM (config) |
| `~/.claude/LIFEOS/LIFEOS_SYSTEM_PROMPT.md` | SYSTEM (after Phase C — operational rules with user-specific content move out) |
| `~/.claude/LIFEOS/VERSION` | SYSTEM |
| `~/.claude/LIFEOS/LIFEOS_StatusLine.sh` | SYSTEM |
| `~/.claude/LIFEOS/ALGORITHM/**` | SYSTEM |
| `~/.claude/LIFEOS/DOCUMENTATION/**` | SYSTEM (after Phase D — categorical placeholders only) |
| `~/.claude/LIFEOS/PULSE/` (source code only — excludes `Assistant/state/`, `state/`, `logs/`, `Plans/`, `Observability/out/`) | SYSTEM (after Phase F — parameterized via LifeosConfig) |
| `~/.claude/LIFEOS/TOOLS/**` (after the few user-path leaks are scrubbed) | SYSTEM |
| `~/.claude/hooks/**` | SYSTEM |
| `~/.claude/skills/<name>/**` where `<name>` does NOT start with `_` | SYSTEM |
| `~/.claude/commands/**` | SYSTEM |
| `~/.claude/agents/**` (shipped agent definitions) | SYSTEM |

This table names the main trees. The per-path authority for what ships is the release allowlist kept in the maintainer-side release skill: one rule per path, the longest literal rule wins, and a unit with no rule is unclassified until one is added. Newer `LIFEOS/` subsystem trees (`RULES/`, `ROUTER/`, `ASSAY/`, `VIGIL/`, `LOCATION/` and others) are classified there.

### USER

Private, user-owned data that ships in the user's own private repo and is mounted into the LifeOS tree via symlink or git submodule. USER files may contain anything — they are never inspected by the public release pipeline because they live outside the system tree.

**Physical mount (post-Phase-G, 2026-05-22):** `~/.claude/LIFEOS/USER/` is a symlink to `~/.config/LIFEOS/USER/` (XDG-style data location). The actual git working tree for the user's private USER-data repo lives at `~/.config/LIFEOS/USER/` — the symlink at `~/.claude/LIFEOS/USER/` exists only so Claude Code's `@`-import resolver (which evaluates paths relative to `~/.claude/`) can reach identity / TELOS / config files at session start. Boundary semantics are unchanged: the "USER zone" still refers to anything under `~/.claude/LIFEOS/USER/**` logically; the only difference is that the bytes live at the XDG path on disk.

| Path | Status |
|------|--------|
| `~/.claude/.env`, `.env.*` | USER (secrets) |
| `~/.claude/LIFEOS/USER/**` (symlink → `~/.config/LIFEOS/USER/**`) | USER (identity, TELOS, projects, integrations, contacts, finances, health, business, customizations) |
| `~/.claude/LIFEOS/MEMORY/**` (symlink → `~/.config/LIFEOS/USER/MEMORY/**`, post-Phase-G.2, 2026-05-23) | USER (work history, knowledge graph, learning signals, observability logs, research, reflections, relationships). Durable subset (KNOWLEDGE, WORK/<slug>/ISA.md, RELATIONSHIP, WISDOM, PLANS, RESEARCH, STATE/work.json, BOOKMARKS, REFERENCE, SKILLS, PROJECT, TEAMS, SYSTEMUPDATES, VERIFICATION) is git-tracked in the user's private USER-data repo; ephemeral subset (OBSERVABILITY JSONLs, LEARNING signals, SECURITY artifacts, VOICE event log, STATE caches, per-skill runtime state and browser profiles under the underscore-prefixed `MEMORY/_*/` convention, PULSE_DATA, SCRATCHPAD, RAW, AUTO, CALLS, INBOX, ARCHIVE, DATA, WORK/<slug>/* intermediates) gitignored from the private repo, local-only. **The split's implementation of record is the `.gitignore` the installer seeds into the repo** — `USER_DATA_GITIGNORE` in `skills/LifeOS/Tools/InstallEngine.ts`; durable subtrees are tracked by having no entry there. |
| `~/.claude/LIFEOS/WORKFLOWS/**` | SYSTEM (the Workflows engine, CLI, inventory and the v1 action runner; ships in the release. Reclassified 2026-09-09 for v1, widened with the v2 engine. A user's own definitions live in `LIFEOS/USER/WORKFLOWS/` and worker code in `LIFEOS/USER/CUSTOMIZATIONS/WORKFLOWS/`, both USER) |
| `~/.claude/LIFEOS/Backups/**` | USER (backup state) |
| `~/.claude/skills/_<name>/**` (underscore-prefixed) | USER (private/proprietary skills) |
| `~/.claude/daemon/`, `daemon.log` | USER (private daemon profile state) |
| `~/.claude/jobs/**` (user-instance scheduled tasks) | USER |
| `~/.claude/downloads/**` | USER (working files) |
| `~/.claude/MEMORY/**` (root-level; migrated to `LIFEOS/MEMORY/` and absent since Phase A — classified here so a harness that recreates it lands on the right side of the boundary) | USER |

### INTERFACE

The boundary itself — the documented contract by which SYSTEM code reads USER data. The schema ships in SYSTEM; the values ship in USER. New SYSTEM features that need new user data must extend the INTERFACE explicitly with an ISA entry.

| Path | Status |
|------|--------|
| `~/.claude/LIFEOS/TOOLS/LifeosConfig.ts` | INTERFACE — typed loader, ships in SYSTEM (after Phase F) |
| `~/.claude/LIFEOS/USER/CONFIG/LIFEOS_CONFIG.{json\|yaml\|toml}` | INTERFACE — user-supplied implementation (after Phase F; format pending ISC-56.1) |
| `~/.claude/LIFEOS/USER/CONFIG/settings.user.json` | INTERFACE — user settings overlay (after Phase B) |
| `~/.claude/LIFEOS/USER/CONFIG/OPERATIONAL_PREFERENCES.md` | INTERFACE — user-specific operational rules (after Phase C); @-imported directly from `~/.claude/CLAUDE.md` so the startup set is explicit in one place (CC follows nested @-imports only to a limited depth) |
| `~/.claude/LIFEOS/USER/INTEGRATIONS/*.yaml` | INTERFACE — typed config for integrations (unifi, airgradient, work-system, etc.) |

### RUNTIME-STATE

Harness-owned or LifeOS-runtime-owned ephemeral files. Never shipped, never user-edited. Already excluded from git via `.gitignore` in most cases.

| Path | Status | Gitignored |
|------|--------|------------|
| `~/.claude/sessions/`, `todos/`, `tasks/`, `teams/` | RUNTIME (Claude Code harness) | yes |
| `~/.claude/history.jsonl` | RUNTIME (Claude Code) | yes (under root anchors) |
| `~/.claude/cache/`, `shell-snapshots/`, `session-env/`, `paste-cache/`, `file-history/` | RUNTIME (harness/LifeOS) | yes |
| `~/.claude/.next/` (build runtime; not shipped), `.wrangler/`, `.venv/`, `coverage/`, `test-results/`, `telemetry/` | RUNTIME (build/test) | yes — telemetry/ holds identity-bearing event data and is gitignored |
| `~/.claude/plugins/`, `Plugins/` | RUNTIME (Claude Code plugin install state) | partial |
| `~/.claude/ide/` | RUNTIME (Claude Code IDE state) | implied |
| `~/.claude/.DS_Store` (OS runtime; not shipped), `.last-cleanup`, `.quote-cache` | RUNTIME (OS / harness) | yes |
| `~/.claude/interceptor-screenshot-*.{png,jpg}` (root) | RUNTIME (debug captures) | yes |
| `~/.claude/LIFEOS/PULSE/{state,logs,Assistant/state,.playwright-cli,Observability/out}/**` | RUNTIME (Pulse runtime) | implied |

## The four allowed access patterns

System code reaches user data via exactly four mechanisms. Any fifth pattern is a boundary violation.

1. **`LifeosConfig.load()` typed loader.** The primary access channel for identity, voice, integrations, paths. Returns a typed object; the schema is the contract.
2. **Path computed from LifeosConfig values.** When system code reads a USER file at a path, that path must be built from `LifeosConfig.paths.userDir + relative` — never from a literal `LIFEOS/USER/` string.
3. **At-startup @-imports declared in CLAUDE.md (system half).** The harness's @-import mechanism loads user identity files at session start. Declared once at the top of CLAUDE.md as `@LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md` etc., which resolve through the `LIFEOS/USER` symlink.
4. **HTTP/IPC via the Pulse server.** When a hook or tool needs runtime state, it queries `http://localhost:31337` — Pulse is the only legal aggregator of cross-zone data.

Anything else — direct `Read('LIFEOS/USER/...')`, hardcoded voice IDs in module source, identity strings in operational rules — is a boundary violation. The `pre-commit` leak scan (Phase E, formerly the write-time `SystemFileGuard` hook) refuses new violations at commit.

## Two-repo sync (post-Phase-G.1, 2026-05-22)

The USER tree is its own private git repo: `~/.config/LIFEOS/USER/` → the user's `<your-username>/<your-user-data-repo>` (PRIVATE GitHub). A fresh install creates that repo — `setupUserSeparation()` in `skills/LifeOS/Tools/InstallEngine.ts` lays the two symlinks and then `git init`s the data home with the durable/ephemeral `.gitignore` and a seed commit. It no-ops on a directory that is already a repo (and refuses to nest one inside an existing checkout), and degrades to a recorded skip rather than failing the install when git is unavailable. The remote is the user's to add; the installer never pushes. The SYSTEM tree is `~/.claude/` → the user's `<your-username>/.claude` (PRIVATE GitHub). There is no pre-push auto-sync git hook (a stale claim corrected 2026-07-04; the `pre-push` hook added 2026-10-24 only refuses a remote GitHub does not confirm private and syncs nothing): both repos are committed, pushed, and version-tagged together by the UpdateKaiRepo intent ("push both repos"), which runs its boundary gates: (G1) USER-zone leak check on pending `~/.claude` changes, (G1B) foreign-data boundary, (G1C) sealed `.env` freshness, (G2) `DenyListCheck.ts` (maintainer-internal; users scan with `SecretScan.ts`) must return 0 real-leaks, (G3) both remotes confirmed private via `gh repo view --json isPrivate`, (G3B) no unpushed blob over GitHub's 100 MB limit, (G4) post-push HEAD verification on both repos via `git ls-remote`. **Pre-flight refuses to proceed if the public LifeOS repo appears in either remote** — this intent is explicit private-only. Public LifeOS release is cut by `release.ts cut` from a pinned commit, with the legacy `ShadowRelease.ts` 26 gates beside it as an advisory parity check; the shipped distribution unit is the single `LifeOS/` skill, not the `.claude/` clone.

## Enforcement layers

The boundary is enforced at three independent layers; each catches different drift modes.

1. **Commit-time (the `pre-commit` leak scan, Phase E).** Each private tree's git `pre-commit` hook runs `LIFEOS/TOOLS/githooks/StagedLeakScan.ts` on the staged bytes and refuses a SYSTEM file whose content matches deny-list patterns, whatever tool wrote it, a Bash write included. It fails closed: a deny list that exists but cannot be used refuses the commit instead of letting it through (a missing deny list, as on a public install, is not an error). Primary defense. Until 2026-10-24 the same deny-list core also ran at write time as the `SystemFileGuard` and `BashSystemWriteGuard` hooks behind the PreToolUse dispatcher; those were retired (`Hooks/HookSystem.md` § Native enforcement). Paths are judged with `isWithin`/`rootRelativeKey` from `hooks/lib/portable-path.ts`: the earlier `root + "/"` prefix test placed no Windows path inside any guarded tree or zone.
2. **PR-time (GitHub Actions, Phase H).** The public repo's security workflow runs gitleaks and `.github/scripts/leak-scan.ts` on every push and pull request, and the release cut runs the same two scanners over its payload before anything is pushed. (`DenyListCheck.ts` is maintainer-internal; users scan with `SecretScan.ts`.)
3. **Release-time (`release.ts cut` scan, references and contract rules; the legacy `ShadowRelease.ts` 26 gates run beside it as an advisory parity check).** Final backstop. Should consistently return zero findings if layers 1 and 2 are healthy.

<!-- public issue #2146, @mefsnef -->
## Migration phases

This document is the Phase A deliverable. Phases B–H land progressively. Each phase ships standalone-functional state and is rollback-able via the `pre-separation-2026-05-20` git tag or per-phase tags.

| Phase | Lands | Boundary impact |
|------:|---|---|
| A | This doc + classification CSV + violations.md | Boundary becomes legible |
| B | `settings.json` split into system + user overlay | settings.json moves to SYSTEM, leaks → user file |
| C | `CLAUDE.md` + `LIFEOS_SYSTEM_PROMPT.md` split | Constitutional files move to SYSTEM, leaks → user/OPERATIONAL_PREFERENCES.md |
| D | Sanitize the 9 leak-source files | DOCUMENTATION + skills become SYSTEM-clean |
| E | `SystemFileGuard` (now the `pre-commit` leak scan) | Runtime enforcement begins |
| F | `LifeosConfig.ts` + migrate Pulse/hooks/skills | One-way dependency direction established |
| G | User-dir extracted to private repo, mounted via symlink | Live tree == public release modulo symlink |
| H | `CONTRIBUTING.md` + CI + PR workflow | The principal and community use same flow |

## The boundary's success criterion

The deny-list precheck (`DenyListCheck.ts ~/.claude`) returns:

```
Real-leak: 0
```

on the live tree, without any scrubbing step having been run. When this passes — and the runtime hook has prevented new leaks from landing for a sustained period — the question "is the system tree publishable?" stops being a question. The answer is structurally yes.

---

## Examples

### The boundary in miniature

Picture a contributor improving a shipped doc. They want a real-looking example, so they paste a line like `host: workstation-7.home.lan` into a file under `LIFEOS/DOCUMENTATION/`. That file is a SYSTEM file — it ships to everyone. The write-time guard sees a SYSTEM path about to receive a deny-list pattern (a hostname) and refuses the write before a single byte lands.

The contributor gets a clear rejection, not a silent leak that surfaces three releases later. The fix isn't to weaken the guard — it's to use a categorical placeholder like `host: <your-workstation>.lan` in the SYSTEM doc, and let the real hostname live in a USER config file where it belongs.

### Same bytes, different zone

The zone is the whole decision — the content is often identical.

- **Blocked:** a real `voiceId: "a1b2c3..."` hardcoded into a module under `hooks/`. That's SYSTEM; a credential can never ship. The guard blocks it.
- **Allowed:** the same `voiceId` written to `LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml`. That's USER; it never enters the release pipeline. The write goes through.

The rule the guard encodes is the rule a careful contributor would follow anyway: real values live in USER, schemas and placeholders live in SYSTEM, and SYSTEM code reaches USER values only through the typed loader. The guard turns "would follow anyway" into "cannot forget."

### A write, decided at the boundary

```mermaid
flowchart TD
    A[Write or Edit to a file] --> B{Which zone is the target?}
    B -->|USER or RUNTIME| C[Allow: never ships]
    B -->|SYSTEM| D{Content matches a deny-list pattern?}
    D -->|no| E[Allow: publishable by construction]
    D -->|yes| F[Block the write]
    F --> G[Move the value into a USER file]
    F --> H[Or replace it with a placeholder]
    G --> A
    H --> A
```

Every write to the tree passes this one gate. Because the check runs at write time and not at release time, the question "is the system tree publishable?" is answered continuously instead of re-answered by a scrub before every release. A blocked write is the boundary doing its job: catching drift the moment it would land, while the fix is still one line.

---
