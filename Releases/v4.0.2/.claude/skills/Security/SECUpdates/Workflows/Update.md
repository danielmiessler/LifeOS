# Update Workflow

**Trigger:** "security updates", "sec updates", "/secupdates", "what's new in security"

## Process

### 1. Load State

```bash
cat ../State/last-check.json
```

Determine the last check timestamp to filter for new content only.

### 2. Fetch Sources (Parallel)

Launch parallel WebFetch requests to all sources:

```
Source 1: https://tldrsec.com
Source 2: https://no.security
Source 3: https://krebsonsecurity.com
Source 4: https://thehackernews.com
Source 5: https://schneier.com
Source 6: https://risky.biz
```

**WebFetch prompt for each:**
> "Extract all article headlines and summaries from this security site. For each item, provide: title, 1-2 sentence summary, publication date if available. Focus on content from the last 7 days."

### 3. Categorize Items

For each extracted item, categorize into:

| Category | Criteria |
|----------|----------|
| **🔴 News** | Breaches, incidents, active attacks, exploitations |
| **🔬 Research** | CVEs, vulnerabilities, techniques, tools, papers |
| **💡 Ideas** | Opinions, trends, strategy, predictions, career |

### 4. Rank by Importance

Within each category, score items 1-10 based on:
- **Impact (0-3):** How many affected? How severe?
- **Recency (0-3):** How new?
- **Actionability (0-2):** Can reader act on this?
- **Novelty (0-2):** Is this genuinely new info?

Sort descending by score.

### 5. Apply Limits

- Max 32 items total
- Target ~10-12 per category if content available
- If one category is sparse, allow others to expand
- Never exceed 32 total

### 6. Generate Output

Use the format from SKILL.md:
- Header with timestamp and sources
- Three category sections with ranked items
- Summary table
- Update state file

### 7. Update State

Write new state to `State/last-check.json`:
- Update `last_check_timestamp`
- Update per-source `last_hash` and `last_checked`

---

## Output Template

```markdown
# Security Updates
**Generated:** [YYYY-MM-DD HH:MM TZ]
**Sources Checked:** [list of sources that responded]
**Period:** Since [last check date or "First run"]

---

## 🔴 Security News (Breaches & Incidents)

[Ranked items, 1-2 sentences each, source attribution]

---

## 🔬 Security Research

[Ranked items, 1-2 sentences each, source attribution]

---

## 💡 Security Ideas

[Ranked items, 1-2 sentences each, source attribution]

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

## First Run Behavior

If `last_check_timestamp` is null:
- Treat as first run
- Fetch last 7 days of content
- Set period as "Last 7 days (first run)"
- Initialize state after completion
