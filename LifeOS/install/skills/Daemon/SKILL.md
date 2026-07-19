---
name: Daemon
version: 1.0.15
description: "Manage the public daemon profile — a digital representation of what you're working on. DaemonAggregator reads LifeOS sources (TELOS, KNOWLEDGE, PROJECTS, MEMORY/WORK, identity) → daemon-data.json. SecurityFilter strips names/paths/credentials via deterministic patterns (NOT LLM). Workflows: UpdateDaemon, ReadDaemon, PreviewDaemon, DeployDaemon. USE WHEN daemon, update daemon, daemon profile, deploy daemon, preview daemon, read daemon, public profile, digital presence. NOT FOR LifeOS system management (use _LIFEOS)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/Daemon/`

If this directory exists, load and apply any SecurityOverrides.md or PREFERENCES.md found there. These override default security classification. If the directory does not exist, proceed with skill defaults.

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the Daemon skill to ACTION"}' \
  > /dev/null 2>&1 &
```

# Daemon Skill

## What It Does

Manages your public daemon profile — a living page of what you're working on, thinking about, reading, and building. It pulls data from your LifeOS system, runs it through a deterministic security filter so only publicly safe content survives, and deploys a static site. Workflows cover update, read, preview, and deploy.

## The Problem

You want a public presence that stays current without hand-editing a profile page every week, and without ever leaking private data. Your real context lives in LifeOS — goals, projects, ideas, identity — mixed with things that must never go public: contacts, finances, health, names, paths, credentials. Manually copying the safe parts is slow and one slip publishes something you can't take back. This skill aggregates the safe sources, blocks the sensitive ones at the code level, and gives you a preview-then-approve gate before anything ships.

## How It Works

The DaemonAggregator reads LifeOS sources and merges them into `daemon-data.json`; a deterministic SecurityFilter (pattern matching, not an LLM) strips names, paths, credentials, and internal refs; the deploy step builds a fully static site. Sensitive files are never opened by the aggregator at all.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **UpdateDaemon** | "update daemon", "refresh daemon" | `Workflows/UpdateDaemon.md` |
| **ReadDaemon** | "read daemon", "check daemon", "daemon status" | `Workflows/ReadDaemon.md` |
| **PreviewDaemon** | "preview daemon", "daemon diff" | `Workflows/PreviewDaemon.md` |
| **DeployDaemon** | "deploy daemon", "push daemon", "ship daemon" | `Workflows/DeployDaemon.md` |

## Architecture

Two-repo pattern: public framework + private content.

```
LifeOS SOURCES (private, read-only)
  TELOS/ (missions, goals, books, movies, wisdom)
  KNOWLEDGE/Ideas/ (title + thesis only)
  PROJECTS.md (public projects only)
  MEMORY/WORK/ (abstracted to topic themes)
  PRINCIPAL_IDENTITY.md (public bio data)
    │
    ├──[DaemonAggregator.ts]──→ Reads sources, merges with existing data
    │
    ├──[SecurityFilter.ts]──→ Deterministic code-level allowlist filter
    │                          Strips names, paths, credentials, internal refs
    │                          NOT an LLM filter — enforced by pattern matching
    │
    └──→ daemon-data.json → ~/Projects/daemon-dm/ (PRIVATE repo)
              │
              └──[deploy.sh]──→ Copies JSON into framework → VitePress build → Cloudflare Pages
                                    │
                              ~/Projects/daemon/ (PUBLIC repo — forkable framework)

    STRUCTURALLY EXCLUDED (never read):
          CONTACTS.md, FINANCES/, HEALTH/, TRAUMAS.md,
          KNOWLEDGE/People/, KNOWLEDGE/Companies/,
```

## Skill Structure

```
skills/Daemon/
├── SKILL.md              (this file)
├── Tools/
│   ├── DaemonAggregator.ts   (reads LifeOS sources → daemon-data.json)
│   └── SecurityFilter.ts     (deterministic content sanitizer)
├── Workflows/
│   ├── UpdateDaemon.md       (aggregate → preview → approve → deploy)
│   ├── ReadDaemon.md         (read current daemon-data.json)
│   ├── PreviewDaemon.md      (show diff without deploying)
│   └── DeployDaemon.md       (bash deploy.sh from daemon-dm)
└── Docs/
    └── SecurityClassification.md  (public/private data categories)
```

## Important Paths

| Purpose | Path |
|---------|------|
| **Private data repo** | `~/Projects/daemon-dm/` |
| **daemon-data.json** | `~/Projects/daemon-dm/daemon-data.json` |
| **Deploy script** | `~/Projects/daemon-dm/deploy.sh` |
| **Public framework repo** | `~/Projects/daemon/` |
| **Security classification** | `${LIFEOS_SKILL_DIR}/Docs/SecurityClassification.md` |
| **Security overrides** | `${LIFEOS_USER_DIR}/SKILLCUSTOMIZATIONS/Daemon/SecurityOverrides.md` |

## Live Endpoints

| Endpoint | Purpose |
|----------|---------|
| `daemon.example.com` | Public website (Cloudflare Pages, fully static) |

## Security Philosophy

1. **Private by default:** All data is private until explicitly classified as public
2. **Code-level enforcement:** SecurityFilter.ts is deterministic pattern matching, NOT LLM judgment
3. **Structural exclusion:** Sensitive files (CONTACTS, FINANCES, HEALTH) are never opened by the aggregator
4. **Defense in depth:** Aggregator filter + SecurityFilter + pre-commit hook + manual approval
5. **Fail closed:** If uncertain, exclude the content

## Data Sources

The DaemonAggregator reads from these LifeOS sources:

| Source | What's Extracted | Section |
|--------|-----------------|---------|
| TELOS/MISSION.md | M1, M2 (public missions) | [MISSION] |
| TELOS/GOALS.md | Public project goals | [TELOS] |
| TELOS/BOOKS.md | Book titles | [FAVORITE_BOOKS] |
| TELOS/MOVIES.md | Movie titles | [FAVORITE_MOVIES] |
| TELOS/WISDOM.md | Top 5 quotes | [WISDOM] |
| KNOWLEDGE/Ideas/_index.md | 10 recent Ideas (title + thesis) | [RECENT_IDEAS] |
| PROJECTS.md | Public repos and sites | Projects integration |
| MEMORY/WORK/ | Topic themes (last 14 days) | [CURRENTLY_WORKING_ON] |
| PRINCIPAL_IDENTITY.md | Public bio, role, focus | [ABOUT] |
| Existing daemon.md | Preserved sections (predictions, routine, podcasts, preferences) | Various |

## For Community Forks

This skill is designed to be generic:

1. Fork the public Daemon repo
2. Create your own private data repo with `daemon-data.json`
3. Configure  with your own blocked names/paths
4. The aggregator reads from standard LifeOS directory structure
5. Use `deploy.sh` to build and deploy to your own Cloudflare Pages

## Examples

**Example 1: Full update cycle**
```
User: "update daemon"
→ Aggregates LifeOS data sources
→ Applies security filter (deterministic)
→ Shows preview diff to user
→ User approves
→ Writes daemon-data.json to daemon-dm → deploys static site
```

**Example 2: Check what's current**
```
User: "check daemon"
→ Reads daemon-data.json from daemon-dm
→ Shows section-by-section status
```

**Example 3: Preview before committing**
```
User: "preview daemon"
→ Runs aggregator in preview mode
→ Shows diff against current daemon-data.json
→ No writes, no deploys
```

## Gotchas

- **Two repos:** Public framework (`~/Projects/daemon/`) and private content (`~/Projects/daemon-dm/`). The framework is forkable. The content is yours.
- **deploy.sh copies data into the framework at build time, then cleans up.** Personal data never gets committed to the public repo.
- **SecurityFilter is code, not prompts.** If you need to add new blocked patterns, edit SecurityFilter.ts, not the workflow markdown.
- **Site is fully static.** Data is embedded at build time. Changes require running `deploy.sh`.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Daemon","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```
