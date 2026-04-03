---
name: SECUpdates
description: Security news from tldrsec, no.security, Krebs, Schneier, and other sources. USE WHEN security news, security updates, what's new in security, breaches, security research, sec updates, tldrsec, Krebs, Schneier.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/SECUpdates/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Voice Notification (REQUIRED)

**Send this notification BEFORE doing anything else:**

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Checking security updates from sources"}' \
  > /dev/null 2>&1 &
```

---

# SECUpdates Skill

**Purpose:** Aggregate security news from multiple sources into crisp, ranked updates across three categories.

## Sources

| Source | URL | Type |
|--------|-----|------|
| **tl;dr sec** | https://tldrsec.com | Newsletter/RSS - comprehensive security roundup |
| **No Security** | https://no.security | Caleb Sima's security insights |
| **Krebs on Security** | https://krebsonsecurity.com | Investigative security journalism |
| **The Hacker News** | https://thehackernews.com | Security news and analysis |
| **Schneier on Security** | https://schneier.com | Bruce Schneier's security blog |
| **Risky Business** | https://risky.biz | Security podcast/news |

**Custom sources:** Add to `USER/SKILLCUSTOMIZATIONS/SECUpdates/sources.json`

---

## Output Format

**Maximum 32 items total across all categories, ranked by importance within each.**

```markdown
# Security Updates
**Generated:** [timestamp]
**Sources Checked:** [list]
**Period:** Since [last check date]

---

## 🔴 Security News (Breaches & Incidents)
*Hacks, breaches, exploits in the wild, incidents*

1. **[Headline]** - [1-2 sentence summary]. [Source]
2. **[Headline]** - [1-2 sentence summary]. [Source]
...

---

## 🔬 Security Research
*New vulnerabilities, CVEs, techniques, papers*

1. **[Title]** - [1-2 sentence summary]. [Source]
2. **[Title]** - [1-2 sentence summary]. [Source]
...

---

## 💡 Security Ideas
*Opinions, strategies, industry trends, career*

1. **[Title]** - [1-2 sentence summary]. [Source]
2. **[Title]** - [1-2 sentence summary]. [Source]
...

---

## 📊 Summary
| Category | Count | Top Item |
|----------|-------|----------|
| News | X | [headline] |
| Research | X | [title] |
| Ideas | X | [title] |

**Total:** X/32 items | **Next check:** Run `/secupdates` anytime
```

---

## Category Definitions

### 🔴 Security News (Breaches & Incidents)
- Data breaches and leaks
- Active exploits and attacks
- Ransomware incidents
- State-sponsored attacks
- Major vulnerability exploitations
- Company security incidents

### 🔬 Security Research
- New CVEs and vulnerabilities
- Security research papers
- New attack techniques
- Tool releases
- Vulnerability disclosures
- Bug bounty findings

### 💡 Security Ideas
- Industry trends and analysis
- Security strategy and opinions
- Career and hiring trends
- Regulatory and compliance news
- Security culture and practices
- Predictions and forecasts

---

## Ranking Criteria

Within each category, rank items by:

1. **Impact** - How many people/systems affected?
2. **Recency** - How new is this?
3. **Actionability** - Can reader do something about it?
4. **Novelty** - Is this genuinely new information?

---

## State Tracking

**State file:** `State/last-check.json`

```json
{
  "last_check_timestamp": "2026-01-22T12:00:00.000Z",
  "sources": {
    "tldrsec": {
      "last_hash": "abc123",
      "last_checked": "2026-01-22T12:00:00.000Z",
      "last_title": "tl;dr sec #XXX"
    },
    "nosecurity": {
      "last_hash": "def456",
      "last_checked": "2026-01-22T12:00:00.000Z"
    }
  }
}
```

**On each run:**
1. Load last-check.json
2. Fetch each source
3. Compare content hash to detect new items
4. Only include items newer than last check
5. Update state file after successful run

---

## Process Flow

### Step 1: Check State
```bash
# Read last check timestamp
cat State/last-check.json
```

### Step 2: Fetch Sources (Parallel)

Launch parallel agents to fetch each source:

| Agent | Source | Method |
|-------|--------|--------|
| Agent 1 | tldrsec.com | WebFetch latest newsletter |
| Agent 2 | no.security | WebFetch recent posts |
| Agent 3 | krebsonsecurity.com | WebFetch recent articles |
| Agent 4 | thehackernews.com | WebFetch headlines |
| Agent 5 | schneier.com | WebFetch recent posts |

### Step 3: Parse & Categorize

For each item found:
1. Determine category (News/Research/Ideas)
2. Extract headline and 1-2 sentence summary
3. Note source
4. Assess importance score

### Step 4: Rank & Limit

1. Sort each category by importance
2. Take top items until 32 total
3. Distribute reasonably (aim for ~10-12 per category if available)

### Step 5: Output & Update State

1. Generate formatted output
2. Write updated state to last-check.json

---

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Update** | "security updates", "sec updates", "/secupdates", "what's new in security" | `Workflows/Update.md` |

**Default:** Run the Update workflow.

---

## Key Principles

1. **Crisp** - 1-2 sentences per item, no fluff
2. **Ranked** - Most important first within each category
3. **Categorized** - Clear separation of News/Research/Ideas
4. **Deduplicated** - Same story from multiple sources = one entry
5. **Limited** - Max 32 items total, quality over quantity
6. **Stateful** - Track what's been seen, only show new items

---

## Example Output

```markdown
# Security Updates
**Generated:** 2026-01-22 12:09 PST
**Sources Checked:** tldrsec, no.security, Krebs, THN, Schneier
**Period:** Since 2026-01-20

---

## 🔴 Security News (Breaches & Incidents)

1. **Microsoft Azure Breach Exposes 2M Customer Records** - Misconfigured storage blob allowed unauthorized access to customer data including emails and phone numbers. [Krebs]
2. **LockBit 4.0 Ransomware Hits Healthcare Chain** - 15 hospitals affected, patient data encrypted, $10M ransom demanded. [THN]
3. **Ivanti VPN Zero-Day Actively Exploited** - CVE-2026-XXXX being used by Chinese APT groups against government targets. [tldrsec]

---

## 🔬 Security Research

1. **New Spectre Variant Bypasses All Mitigations** - Researchers demonstrate "Spectre-NG" affecting Intel and AMD processors, no patch available. [tldrsec]
2. **OAuth Token Theft via Browser Extension** - Novel technique allows stealing tokens from any site using malicious extension. [no.security]
3. **SSRF in AWS IMDSv2** - Bypass discovered in metadata service protections. [tldrsec]

---

## 💡 Security Ideas

1. **The Death of Perimeter Security** - Caleb Sima argues zero-trust is no longer optional after recent breaches. [no.security]
2. **CISO Burnout at All-Time High** - Survey shows 70% considering leaving the field within 2 years. [tldrsec]
3. **AI-Generated Phishing Now Indistinguishable** - Schneier on the implications of LLM-powered social engineering. [Schneier]

---

## 📊 Summary
| Category | Count | Top Item |
|----------|-------|----------|
| News | 3 | Microsoft Azure Breach |
| Research | 3 | New Spectre Variant |
| Ideas | 3 | Death of Perimeter Security |

**Total:** 9/32 items | **Next check:** Run `/secupdates` anytime
```

---

## Anti-Patterns

| ❌ Bad | ✅ Good |
|--------|---------|
| Long paragraph summaries | 1-2 crisp sentences |
| "Read more at..." | Summary + source attribution |
| Unranked list dumps | Importance-ordered items |
| 50+ items | Max 32, quality curated |
| Mixing categories | Clear News/Research/Ideas separation |
| Old news mixed with new | Only items since last check |
