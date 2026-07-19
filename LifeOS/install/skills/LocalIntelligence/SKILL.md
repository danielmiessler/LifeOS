---
name: LocalIntelligence
version: 1.0.4
description: "Generic civic intelligence aggregator for any US city — daily local digest of construction permits, crime, new businesses, public officials, legislation, elections, arrests, and local news, keyed off principal's Hometown. Writes JSON consumed by Pulse LOCAL tab. Crime delegates to _CRIMESTATS. Workflows: DailyBrief, Construction, Crime, Business, Officials, Legislation, Elections, Arrests, News. USE WHEN local news, hometown news, council meeting, building permits, mayor, ballot measures, ordinance, recent arrests, civic intel, local digest. NOT FOR national news or arbitrary-city crime."
effort: medium
---

# LocalIntelligence

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/LocalIntelligence/`

If this directory exists, load and apply any `PREFERENCES.md`, optional source-list overrides, or per-source API keys (e.g., OpenStates, Google News topic ID). These override defaults. If the directory does not exist, proceed with skill defaults — universal sources only.

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running WORKFLOWNAME in LocalIntelligence"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running **WorkflowName** in **LocalIntelligence**...
   ```

## What It Does

LocalIntelligence is a civic intelligence aggregator for any US city. It pulls eight categories of local data — construction permits, crime, new businesses, public officials, legislation, elections, arrests, and local news — into a single daily JSON digest, keyed off the city in the principal's identity file and served to the Pulse LOCAL tab. Crime delegates to the dedicated crime-stats skill.

## The Problem

What's actually happening where you live is scattered across a dozen sites that nobody checks — the city's permit portal, the council agenda system, the sheriff's blotter, a local paper, the elections office. No single feed tells you a new ordinance is up for a vote, a building is going up down the street, or an election is coming. Most "local news" tools either cover one city, hardcode endpoints that break, or paywall the good stories. This skill stays generic across every US city, resolves the target city at runtime, and degrades gracefully when a source has no data instead of blanking the whole digest.

## How It Works

Local civic intelligence for whatever city the principal lists in `PRINCIPAL_IDENTITY.md` Hometown. Generic across all US cities — no per-city profiles, no hardcoded endpoints. Eight fetchers run in parallel and write one JSON digest, served to the Pulse `LOCAL` tab.

## Default Hometown — Always Dynamic

The principal's hometown is **never hardcoded in this skill**. Every workflow and tool resolves it at runtime via:

```typescript
import { readHometown } from "./Tools/Hometown.ts"
const { city, state, zip, county } = await readHometown()
```

`Tools/Hometown.ts` parses the `**Hometown:**` line from `{{LIFEOS_DIR}}/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md`. If absent, every workflow surfaces a clear "no hometown set" message and refuses to fetch. There is no fallback city.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **DailyBrief** | "daily local digest", "what's happening in my city", "refresh local intel" | `Workflows/DailyBrief.md` |
| **Construction** | "new construction", "building permits", "what's being built" | `Workflows/Construction.md` |
| **Crime** | "crime stats", "is my city safer", "crime trend" | `Workflows/Crime.md` |
| **Business** | "new businesses", "business openings", "business closures" | `Workflows/Business.md` |
| **Officials** | "city council", "mayor", "school board", "public officials" | `Workflows/Officials.md` |
| **Legislation** | "pending laws", "council agenda", "ordinance vote", "new laws in effect" | `Workflows/Legislation.md` |
| **Elections** | "upcoming election", "ballot measures", "who's running", "polling location" | `Workflows/Elections.md` |
| **Arrests** | "recent arrests", "police blotter", "sheriff blotter" | `Workflows/Arrests.md` |
| **News** | "local news", "hometown news", "headlines from my city" | `Workflows/News.md` |

## Architecture

```
LocalIntelligence/
├── SKILL.md                  this file
├── Workflows/
│   ├── DailyBrief.md         orchestrator — runs Refresh.ts and summarizes
│   ├── Construction.md
│   ├── Crime.md              fetches city crime stats via the configured crime-data adapter
│   ├── Business.md
│   ├── Officials.md
│   ├── Legislation.md
│   ├── Elections.md
│   ├── Arrests.md
│   └── News.md
├── Tools/
│   ├── Hometown.ts           parser + types — sole source of city info
│   ├── Refresh.ts            orchestrator — calls 8 fetchers, writes latest.json
│   ├── FetchConstruction.ts
│   ├── FetchBusiness.ts
│   ├── FetchOfficials.ts
│   ├── FetchLegislation.ts
│   ├── FetchElections.ts
│   ├── FetchArrests.ts
│   ├── FetchNews.ts
│   └── FetchCrime.ts         shells to _CRIMESTATS workflow output
└── References/
    └── DataSources.md        catalog of universal civic sources keyed off {city,state}
```

Output: `{{LIFEOS_DIR}}/MEMORY/DATA/LocalIntelligence/<YYYY-MM-DD>_<city>_<state>_digest.json` plus a copy at `latest.json` for Pulse to read.

## Fetcher Contract

Every fetcher exports a single function:

```typescript
type Item = { title: string; source: string; url: string; date: string; summary?: string }
type FetchResult = { items: Item[]; source_status: "ok" | "unavailable" | "empty"; errors?: string[] }
export async function fetch(home: Hometown): Promise<FetchResult>
```

Fetchers return the empty/unavailable case rather than throwing. `Refresh.ts` runs all eight via `Promise.allSettled` so a dead source never blanks the digest. Errors land in `meta.errors` with the failing source label.

## Pulse Integration

The skill writes JSON; Pulse reads it. Coupling lives in two places:

1. **Pulse module** at `{{LIFEOS_DIR}}/PULSE/modules/local-intelligence.ts` — read-only over `MEMORY/DATA/LocalIntelligence/latest.json`. Endpoints: `GET /api/local-intelligence`, `POST /api/local-intelligence/refresh`.
2. **Pulse dashboard tab** at `{{LIFEOS_DIR}}/PULSE/Observability/src/app/local/page.tsx` — fetches the JSON and renders nine section cards. Nav entry in `AppHeader.tsx` `lifeNav` between `LIFE` and `WORK`.

Daily refresh: `[[job]]` in `PULSE.toml` at `0 6 * * *` running `bun run skills/LocalIntelligence/Tools/Refresh.ts`.

## Examples

**Example 1: Run the daily digest**
```
User: "What's happening in my city today?"
→ Invokes DailyBrief workflow
→ Reads hometown from PRINCIPAL_IDENTITY.md
→ Runs Tools/Refresh.ts orchestrator
→ Writes latest.json
→ Summarizes top-3 items per category in chat
```

**Example 2: Council agenda check**
```
User: "Anything on the council agenda this week?"
→ Invokes Legislation workflow
→ Calls Tools/FetchLegislation.ts for hometown
→ Returns pending council items with source links
```

**Example 3: Refresh from the dashboard**
```
User clicks "Refresh now" on the LOCAL tab
→ Pulse POSTs /api/local-intelligence/refresh
→ Pulse module spawns Tools/Refresh.ts
→ latest.json is regenerated and the tab re-renders
```

## Gotchas

- **No hometown line = no fetch.** If `PRINCIPAL_IDENTITY.md` lacks a `Hometown:` line, every workflow returns a clear setup-help message and exits zero. Do not invent a city.
- **Per-city API quality varies wildly.** Some cities have rich Granicus/OpenStates coverage; others publish PDFs only. Each fetcher must return `source_status: "unavailable"` rather than fail when a universal source has no data for the resolved city.
- **Census Building Permits Survey is monthly, not daily.** Construction signal is medium-latency by nature; do not promise "today's permits."
- **OpenStates covers state legislatures, not city councils.** For council pending/enacted laws, fetchers attempt Granicus/Legistar discovery via well-known URL patterns. Coverage is best-effort.
- **Patch RSS path varies by state.** `https://patch.com/<state-slug>/<city-slug>/feed` works for most cities but a few have legacy slugs. The News fetcher tries the canonical path first and falls back to a Google News topic search keyed on `"<city>, <state>"`.
- **Sheriff blotter scraping is jurisdiction-specific.** Fetchers attempt the county sheriff's blotter page if discoverable; if not, they return `unavailable`. No bypassing CAPTCHA, no paid scraping services in v1.
- **Crime never duplicates `_CRIMESTATS`.** `FetchCrime.ts` invokes `_CRIMESTATS` and shapes the result into the digest. Direct calls to CitizenRIMS, FBI UCR, or AreaVibes from inside this skill are forbidden — see ISC-12 in the design ISA.
- **Daily JSON files accumulate.** Old digests stay in `MEMORY/DATA/LocalIntelligence/` for trend retrieval; only `latest.json` is the read target for Pulse. Periodic prune is the user's call.
- **Local newspapers paywall the good stories.** RSS feeds usually surface headlines + summaries; the dashboard links to the source. The skill never bypasses paywalls.
- **`source_status: "empty"` is not the same as `"unavailable"`.** `empty` = source returned 200 with zero matching items (common for small towns). `unavailable` = source 4xx/5xx or DNS failure. The dashboard renders different empty states for each.

## Public Release Readiness

This skill body is generic by design. Pre-flight grep:

```bash
rg -i "<your-city>|<your-zip>|<your-county>|/Users/[a-z]+/" "${CLAUDE_SKILL_DIR}/"
```

Zero matches required before treating the skill as releasable. The principal's actual hometown lives in `PRINCIPAL_IDENTITY.md`, never here.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"LocalIntelligence","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```
