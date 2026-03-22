---
name: FleetDump
pack-id: northwoodssentinel-fleetdump-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: Collect daily activity from all AI systems and infrastructure into a single dated markdown summary
type: skill
purpose-type:
  - fleet-observability
  - ai-governance
  - daily-standup
platform: claude-code
dependencies: []
keywords:
  - fleet
  - governance
  - observability
  - git
  - memory
  - dispatches
  - daily-dump
  - ai-infrastructure
---

# FleetDump

> One view of everything your AI fleet did today. Git commits, dispatches, memory changes, flinch logs, work sessions -- all in one report.

## The Problem

When you run multiple AI systems, activity happens across many surfaces. Git repos accumulate commits. Memory files get created and modified. Fleet dispatches fly between agents. Work directories gain new PRDs. Flinch logs capture suppressed signals. Inbox files arrive and get processed.

Nobody has a single view of "what happened today across all my AI infrastructure." You end up asking each AI "what did we do?" or scrolling through git logs manually. The activity is there but it's scattered, and scattered activity is invisible activity. You can't govern what you can't see.

## The Solution

FleetDump collects daily activity from all available sources and writes a single dated markdown file. Git commits from your PAI repo. Cross-repo GitHub activity with commit counts and line deltas. Fleet dispatches from your cross-AI communication channel. New or modified PRDs from work directories. Memory file changes. Flinch log status. Session duration estimates based on commit timestamps.

It also generates pace flags -- automatic warnings when commit volume, code churn, or deletion counts suggest unsustainable patterns. And it closes every report with four governor questions designed to surface blind spots.

## Installation

See [INSTALL.md](INSTALL.md) for guided setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/Tools/fleet-dump.py` | Python CLI that collects activity from all sources |
| `src/SKILL.md` | AI routing skill with USE WHEN triggers |
| `src/Workflows/Dump.md` | Step-by-step workflow for daily fleet capture |
| `src/Workflows/Review.md` | Workflow for reviewing and interpreting a fleet dump |
| `INSTALL.md` | Guided installation with system checks |
| `VERIFY.md` | Post-install verification script |

## What Makes This Different

Most observability tools are built for teams and services. FleetDump is built for one person running multiple AI agents. It treats your AI infrastructure like a fleet -- each agent has its own activity surface, and the dump aggregates them into a single operational picture.

The governor questions at the end of each report aren't decorative. They're adversarial prompts designed for an external oversight AI (like Gemini) to challenge the fleet's assumptions. "What did the fleet agree on today that might be wrong?" forces the governor to look for consensus bias. "Is the operator's self-image shaping output instead of evidence?" checks for confirmation loops.

## Invocation Scenarios

| Scenario | Command |
|----------|---------|
| Dump today's fleet activity | `python3 fleet-dump.py` |
| Dump yesterday's activity | `python3 fleet-dump.py --yesterday` |
| Dump a specific date | `python3 fleet-dump.py --date 2026-03-14` |
| AI gives you the daily standup | "What did the fleet do today?" |
| End-of-day review | "Run the fleet dump and summarize" |
| Governor feed | Scheduled via cron for daily automated capture |

## Example Usage

```bash
# Today's fleet activity
python3 src/Tools/fleet-dump.py

# Yesterday
python3 src/Tools/fleet-dump.py --yesterday

# Specific date
python3 src/Tools/fleet-dump.py --date 2026-03-14
```

Output lands as a dated markdown file (e.g., `2026-03-14.md`) with sections for session estimate, git activity, GitHub activity, fleet dispatches, work sessions, memory changes, flinch log status, and governor questions.

## Configuration

FleetDump reads from local filesystem paths and GitHub APIs. Configuration is done by editing constants at the top of `src/Tools/fleet-dump.py`:

**Paths:**
- `PAI_ROOT` -- root of your PAI installation (default: `/root/.claude`)
- `MEMORY_DIR` -- memory file directory (default: `{PAI_ROOT}/projects/-root--claude/memory`)
- `WORK_DIR` -- work/PRD directory (default: `{MEMORY_DIR}/WORK`)
- `DUMP_DIR` -- output directory (default: `/mnt/g/My Drive/fleet-dumps/`)

**GitHub repos to monitor:**
Edit the `GITHUB_REPOS` list to include your repositories:
```python
GITHUB_REPOS = [
    "YourOrg/repo1",
    "YourOrg/repo2",
]
```

**GitHub CLI:** Requires `gh` (GitHub CLI) authenticated for cross-repo activity checks.

## Origin

Built for a five-AI fleet (Archie, Clive, Mirror, Gemmy, CeeCee). The fleet dump feeds into an external governor (Gemini) that provides oversight across all systems -- like a security operations center for your AI infrastructure. The governor reads the fleet dump alongside vitals data to correlate behavioral patterns with physiological state. Is the operator shipping code at 2am on depleted Body Battery? The fleet dump catches the commits; the vitals dump catches the body state; the governor connects them.

## Works Well With

- **VitalsDump** -- pair fleet activity with biometric data for full behavioral + physiological picture
- Any external AI governor that reads structured markdown
- Cron scheduling for automated daily captures
- Git-based workflows where commit history tells the story of the day

## Changelog

### 1.0.0
- Initial release
- Local git log collection from PAI repo
- Cross-repo GitHub activity via `gh` CLI (commits, line deltas, pace flags)
- Fleet dispatch monitoring from NorthwoodsSentinel/fleet_messages
- Work directory (PRD) change detection
- Memory file change tracking
- Flinch log status reporting
- Session duration estimation from commit timestamps
- Governor questions for external oversight
- Pace flags for unsustainable patterns
