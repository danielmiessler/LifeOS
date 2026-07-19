# LocalIntelligence — Universal Data Sources

Every source listed here is keyed off `{city, state}` (and occasionally `county`) — no per-city configuration. When a source is unavailable for a given city, the fetcher returns `source_status: "unavailable"` rather than failing.

## Construction (FetchConstruction)

| Source | Pattern | Notes |
|--------|---------|-------|
| US Census Building Permits Survey | `https://www2.census.gov/econ/bps/Place/...` | Monthly. MSA + place-level. Most uniform US source. |
| City open-data permits portal | `<city-domain>/permits.json`, `<city-domain>/api/permits` | Best-effort discovery. Many cities use Accela `apo/...` endpoints. |
| Planning commission agendas | Granicus / Legistar discovery | Typically `https://<city>.granicus.com/...` |

## Crime (FetchCrime)

**Delegates to `_CRIMESTATS`. No direct sources from this skill.**

## Business (FetchBusiness)

| Source | Pattern |
|--------|---------|
| City open-data business-license dataset | `<city-data-portal>/business-licenses` discovery |
| County clerk DBA filings | County clerk recorder pages |
| Chamber of Commerce member announcements | Local chamber RSS where present |

## Officials (FetchOfficials)

| Source | Pattern |
|--------|---------|
| Ballotpedia API | `https://ballotpedia.org/api/v3/...` keyed on city + state |
| Google News topic search | per officeholder |
| City press releases | `<city-domain>/news/feed` discovery |

## Legislation (FetchLegislation)

| Source | Coverage |
|--------|----------|
| OpenStates API (`https://v3.openstates.org/`) | State-level pending + enacted bills |
| Granicus / Legistar | City council agenda items via well-known URL patterns |
| City council meeting calendar | Where exposed as iCal or RSS |

Items carry `metadata.status = "pending" | "enacted"`.

## Elections (FetchElections)

| Source | Pattern |
|--------|---------|
| Ballotpedia API | upcoming elections, candidates, ballot measures |
| Vote.gov | state registration + polling info links |
| County registrar of voters | best-effort URL discovery for polling places |

## Arrests (FetchArrests)

| Source | Pattern |
|--------|---------|
| County sheriff booking log | `<sheriff-domain>/booking-log` discovery |
| City PD daily blotter | `<pd-domain>/blotter` discovery |
| Patch crime tag | soft fallback |

Public-data only. No paid people-search aggregators, no bypassing CAPTCHAs.

## News (FetchNews)

| Source | Pattern |
|--------|---------|
| Patch RSS | `https://patch.com/<state-slug>/<city-slug>/feed` |
| Google News topic search | `"<city>, <state>"` |
| Optional regional outlets | via `LIFEOS/USER/CUSTOMIZATIONS/SKILLS/LocalIntelligence/PREFERENCES.md` |

## Optional Customization Layer

Per-user source overrides go in `$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/LocalIntelligence/PREFERENCES.md`. Examples: an OpenStates API key for higher rate limits, a Google News topic ID, additional regional newspaper RSS feeds. The skill body never hardcodes any of this.
