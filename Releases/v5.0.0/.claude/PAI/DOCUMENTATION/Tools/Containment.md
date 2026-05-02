# PAI Containment Policy

**Status:** Authoritative. Contributors and future Kai sessions read this before adding a new file.
**Enforcement:** `hooks/ContainmentGuard.hook.ts` (prospective, PreToolUse). `skills/_PAI/TOOLS/ShadowRelease.ts` G1-G5 gates (retrospective, pre-release).
**Zone inventory (authoritative):** `hooks/lib/containment-zones.ts` — the runtime source of truth both enforcers import.
**Last updated:** 2026-04-29

---

## The policy in one sentence

**Anything in the PAI tree that is not inside one of the currently-configured containment zones must be clean of personal identity, credentials, and infrastructure IDs.**

That is the rule. Everything else on this page is either a definition, a consequence, or a procedure.

---

## Zones are a living inventory, not a fixed set

There is no magic number of zones. PAI evolves — new sensitive surfaces appear, old ones get retired or relocated — and the zone list must keep up. The snapshot below reflects what's in `hooks/lib/containment-zones.ts` right now; check that file for the truth of the moment.

Today's zones:

| Name             | Pattern(s)                                                                                                                                                                                           | What lives here                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `user-data`      | `PAI/USER/**`                                                                                                                                                                                        | Principal identity, TELOS, credentials, personal infra, contacts, finances, health, business                                                    |
| `config-secrets` | `settings.json`, `settings.local.json`, `.vscode/settings.json`, `.env`, `.env.*`, `PAI/.env`, `PAI/.env.*`                                                                                          | API tokens, allowed command lists, MCP auth                                                                                                     |
| `runtime-memory` | `PAI/MEMORY/**`                                                                                                                                                                                      | Work sessions, learnings, observability, research, raw data, bookmarks, relationship notes                                                      |
| `private-skills` | `skills/_*/**` (underscore prefix)                                                                                                                                                                   | Principal-specific and proprietary skills                                                                                                       |
| `install-state`  | `history.jsonl`, `Plugins/**`, `plugins/installed_plugins.json`, `plugins/known_marketplaces.json`                                                                                                   | Claude Code runtime install state written by the harness                                                                                        |
| `private-infra`  | `PAI/ARBOL/**`, `PAI/PULSE/Assistant/**`, `PAI/PULSE/Plans/**`, `PAI/PULSE/logs/**`, `PAI/PULSE/state/**`, `PAI/PULSE/Observability/out/**`, `PAI/PULSE/.playwright-cli/**`, `PAI/ScheduledTasks/**` | Top-level private infrastructure: cloud worker source, DA-specific assistant, planning docs, runtime logs/state, rendered HTML, scheduled tasks |

The underscore-prefix rule for `private-skills` is the interface contract. If a skill name does NOT start with `_`, that skill directory must be clean enough to ship to strangers.

---

## Mandatory zone review before every shadow release

Zones drift. Before running `ShadowRelease --create <version>`:

1. Open `hooks/lib/containment-zones.ts`.
2. Walk `${CLAUDE_CONFIG_DIR}/` at depth 1-2 (e.g. `ls -la && ls -la PAI/ && ls -la skills/`) and compare against the zone list.
3. Ask, for every new top-level or first-nested dir since the last release:
   - Does it contain anything principal-specific? → **Add a zone or extend an existing one.**
   - Is it runtime state the harness writes? → **Add it to `install-state` or the RSYNC_EXCLUDES in `ShadowRelease.ts`.**
   - Is it clean-by-construction and intended for public? → **Leave it; document via README if its purpose is ambiguous.**
4. Update `CONTAINMENT_ZONES` and/or `PATTERN_ALLOWLIST_FILES` in `hooks/lib/containment-zones.ts` accordingly.
5. Commit the zone change BEFORE the shadow-release commit. The zone file is the contract; the release gates verify against it. Releasing against a stale contract is the failure mode this step exists to prevent.

**Rule of thumb:** if you look at the zone file and you cannot immediately tell that it matches reality, stop and reconcile before building a release.

---

## What "clean" means outside the zones

A file outside every configured zone is a policy violation if it contains any of:

- **Identity** — absolute user paths, personal email, personal domain names, principal-specific hostnames
- **Infrastructure IDs** — Cloudflare account or KV namespace IDs, ElevenLabs voice IDs, launchd bundle IDs, any UUID that identifies a specific account or resource
- **Secrets** — API tokens, private keys (`.pem`, `.key`), session cookies, OAuth refresh tokens

The `hooks/ContainmentGuard.hook.ts` enforces the identity and CF-ID list prospectively on every Edit/Write/MultiEdit. The `ShadowRelease --check` gates enforce all three categories retrospectively before release.

The concrete patterns live in `hooks/ContainmentGuard.hook.ts` (`IDENTITY_PATTERNS` constant) and `skills/_PAI/TOOLS/ShadowRelease.ts` (`IDENTITY_PATTERNS` + `CF_ID_PATTERNS`). When a new principal-specific string enters the threat model, add it to both places.

---

## How to handle common situations

### I am writing a new file and it needs to reference the principal

Use `${HOME}`, `${PAI_DIR}`, `${CLAUDE_PROJECT_DIR}`, or a configurable placeholder. Never hard-code absolute paths containing the principal's username in a public file.

### I am writing a new file and it needs secrets

1. Load from `process.env.X` at runtime.
2. Document the var name in the file itself, no default value that contains the secret.
3. Fallback path: read from `${CLAUDE_CONFIG_DIR}/.env` via the shared `readEnvOrPaiEnv()` helper (see `hooks/lib/observability-transport.ts`). Legacy `PAI/.env` symlink has been retired; the authoritative file is `${CLAUDE_CONFIG_DIR}/.env`.
4. If the secret lookup misses, emit a single stderr warning and degrade gracefully — never silently continue with an empty string.

### I am adding personal notes, work sessions, or memory

Put them under `PAI/MEMORY/**` (`runtime-memory`) or `PAI/USER/**` (`user-data`) depending on whether they're system-captured or principal-authored.

### I am adding a new skill

- If the skill is general-purpose and intended for public users, put it at `skills/{Name}/` (no underscore). All content must follow the clean-outside-zones rule.
- If the skill is principal-specific (private email, calendar, personal finances, private data sources), put it at `skills/_{NAME}/` with the underscore prefix. The `_` is the interface contract — the release pipeline deletes all `skills/_*/` wholesale.

### I am adding a new top-level dir that should be private

Add its pattern to `CONTAINMENT_ZONES` in `hooks/lib/containment-zones.ts` (create a new zone or extend an existing one), then commit. The guard hook and release gates both pick up the new zone automatically.

### I am writing documentation that references the principal as author

Two patterns, pick one:

- **Genericize:** no principal name in the prose. Describe the role, not the person.
- **Frame as example:** explicitly mark principal-authored artifacts as examples the reader can adapt.

Do not write docs that assume the reader IS the principal. The PAI public release has an unknown future user as the reader.

### The file must contain a pattern in order to detect or block it

Examples: `hooks/ContainmentGuard.hook.ts` has to embed principal patterns to scan for them; `hooks/security/inspectors/PatternInspector.ts` similarly. These are legitimate exceptions.

Record them in `PATTERN_ALLOWLIST_FILES` in `hooks/lib/containment-zones.ts` (single source shared with both enforcers), with a note in the living appendix below explaining why the exception exists.

---

## Release pipeline — how the policy is verified

1. **Zone review** — per the mandatory step above. Happens before anything else.
2. **Source audit** — grep the live tree against the identity plus CF-ID pattern list. Every hit outside the configured zones is a policy violation; fix at source (sanitize, relocate, or allowlist with justification).
3. **Staging build** — `bun run skills/_PAI/TOOLS/ShadowRelease.ts --create <version>` clones the live tree with hard rsync exclusions, deletes zone contents (preserving only top-level READMEs as scaffold), overlays the public `settings.json`, `CLAUDE.md`, and `PAI_CONFIG.yaml` templates.
4. **Five gates run against the staging tree:**
   - **G1 — Zone deletion:** required public READMEs survive; forbidden personal files and persona dirs do not.
   - **G2 — Identity grep:** no identity patterns in the staging tree (except allowlisted files).
   - **G3 — CF ID grep:** no hardcoded CF account or KV namespace IDs (except allowlisted files).
   - **G4 — trufflehog:** no live secrets detected.
   - **G5 — .env strays:** no `.env*` files survived rsync exclusion.
5. **Pass all five → READY FOR RELEASE.** Any fail → fix source or refine exclusions; never hide with allowlist unless the file legitimately needs the pattern.
6. **Public publish is a separate step.** The shadow release stays under `PAI/PAI_RELEASES/PAI_Release_v{VERSION}/.claude/` until a deliberate publish action ships it to the public repo.

---

## Shrinking-allowlist discipline

`PATTERN_ALLOWLIST_FILES` in `hooks/lib/containment-zones.ts` lists files the enforcers skip. **Every entry is a TODO**, not a feature. The ideal end state is the minimum set of files that must embed patterns in order to detect or document them.

Every other entry should be removed by sanitizing the source file (preferred) or relocating it into a zone. Before adding a new allowlist entry, add a row to the living appendix below explaining why sanitization is not feasible.

---

## Living appendix — currently-allowlisted files and their disposition

Populated by the audit. Updated as files are sanitized or relocated.

| File                                            | Reason listed                                                    | Disposition                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `hooks/ContainmentGuard.hook.ts`                | Must embed every pattern to detect it                            | **KEEP** — legitimate exception                                                                                     |
| `hooks/lib/containment-zones.ts`                | Single source of truth module both enforcers import from         | **KEEP** — legitimate exception                                                                                     |
| `hooks/security/inspectors/PatternInspector.ts` | Pattern detector embeds patterns                                 | **KEEP** — legitimate exception                                                                                     |
| `skills/_PAI/TOOLS/ShadowRelease.ts`            | Release tool must embed patterns for G2/G3 gates                 | **KEEP** — legitimate exception                                                                                     |
| `PAI/DOCUMENTATION/Tools/Containment.md`        | Policy doc describes zones and references patterns categorically | **KEEP** — legitimate exception                                                                                     |
| `skills/Daemon/Docs/SecurityClassification.md`  | Documents the exact path patterns the Daemon filter should scrub | **KEEP** — legitimate exception                                                                                     |
| `skills/Daemon/Tools/SecurityFilter.ts`         | Pattern inspector test cases embed the patterns they filter      | **KEEP** — legitimate exception                                                                                     |
| `skills/CreateSkill/Workflows/ValidateSkill.md` | Lists example patterns a skill author should NOT hardcode        | **KEEP** — legitimate exception                                                                                     |
| `PAI/TOOLS/SessionHarvester.ts`                 | Comment references derivation, not literal path                  | **KEEP** — uses `CLAUDE_DIR.replace(...)` dynamically                                                               |
| `PAI/TOOLS/gmail.ts`                            | Uses `homedir()` at runtime, not a literal path                  | **KEEP** — dynamic resolution                                                                                       |
| `PAI/PULSE/checks/health.ts`                    | Hardcoded site list for health monitoring                        | **TODO-REFACTOR** — move site list to `PAI_CONFIG.yaml`, read at startup                                            |
| `agents/<agent>.md`                             | Write-permission path literals in agent definitions              | **TODO-REFACTOR** — verify env-expansion support in Claude Code agent spec, then replace with `${HOME}/.claude/...` |

---

## Updating this policy

Edit this file directly. Commit with a message that starts with `policy:` so it's easy to find in git log. After any policy change, re-run `ShadowRelease --create <version>` and verify no gates regress.
