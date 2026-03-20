---
name: sec-updates
description: "Security news from tldrsec, no.security, Krebs, Schneier, and other sources. USE WHEN security news, security updates, what's new in security, breaches, security research, sec updates, tldrsec, Krebs, Schneier."
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/SECUpdates/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SECUpdates

**Purpose:** Aggregate security news from multiple sources into crisp, ranked updates across three categories. Max 32 items total.

## Sources

| Source | URL |
|--------|-----|
| tl;dr sec | https://tldrsec.com |
| No Security | https://no.security |
| Krebs on Security | https://krebsonsecurity.com |
| The Hacker News | https://thehackernews.com |
| Schneier on Security | https://schneier.com |
| Risky Business | https://risky.biz |

Custom sources: `USER/SKILLCUSTOMIZATIONS/SECUpdates/sources.json`

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Update** | "security updates", "sec updates", "/secupdates", "what's new in security" | `Workflows/Update.md` |

---

## Process Flow

1. **Check state** — Load `State/last-check.json` for last check timestamp
2. **Fetch sources (parallel)** — Launch agents per source via WebFetch
3. **Parse & categorize** — Assign each item to News/Research/Ideas, extract headline + 1-2 sentence summary
4. **Rank & limit** — Sort by importance within category, cap at 32 total (~10-12 per category)
5. **Output & update state** — Generate formatted report, write updated `last-check.json`

**Validation checkpoint:** Compare content hashes against `last-check.json` — only include genuinely new items since last check.

---

## Categories

- **Security News** — Breaches, active exploits, ransomware, state-sponsored attacks, major incidents
- **Security Research** — New CVEs, attack techniques, tool releases, vulnerability disclosures, bug bounty findings
- **Security Ideas** — Industry trends, strategy/opinions, regulatory news, career trends, predictions

**Ranking criteria (within each category):** Impact > Recency > Actionability > Novelty

---

## Output Format

```markdown
# Security Updates
**Generated:** [timestamp]
**Sources Checked:** [list]
**Period:** Since [last check date]

## Security News (Breaches & Incidents)
1. **[Headline]** - [1-2 sentence summary]. [Source]

## Security Research
1. **[Title]** - [1-2 sentence summary]. [Source]

## Security Ideas
1. **[Title]** - [1-2 sentence summary]. [Source]

## Summary
| Category | Count | Top Item |
|----------|-------|----------|
| News | X | [headline] |
| Research | X | [title] |
| Ideas | X | [title] |

**Total:** X/32 items | **Next check:** Run `/secupdates` anytime
```

---

## State Tracking

**File:** `State/last-check.json`

```json
{
  "last_check_timestamp": "2026-01-22T12:00:00.000Z",
  "sources": {
    "tldrsec": { "last_hash": "abc123", "last_checked": "...", "last_title": "tl;dr sec #XXX" }
  }
}
```

---

## Anti-Patterns

| Bad | Good |
|-----|------|
| Long paragraph summaries | 1-2 crisp sentences |
| "Read more at..." | Summary + source attribution |
| Unranked list dumps | Importance-ordered items |
| 50+ items | Max 32, quality curated |
| Mixing categories | Clear News/Research/Ideas separation |
| Old news mixed with new | Only items since last check |
