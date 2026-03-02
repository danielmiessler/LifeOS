# Discover New OSINT Sources Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the DiscoverOSINTSources workflow to find new OSINT sources and update the collection"}' \
  > /dev/null 2>&1 &
```

Running the **DiscoverOSINTSources** workflow in the **OSINT** skill to discover and catalog new OSINT sources...

**Purpose:** Discover, evaluate, and integrate new OSINT sources into the skill's SOURCES.JSON and SOURCES.md collection using parallel research agents.

---

## Phase 1: Load Current Source Inventory

**Read existing sources:**
- Load `~/.claude/skills/Investigation/OSINT/SOURCES.JSON` to get current source count and categories
- Note the `last_updated` date to understand staleness
- Build a list of all existing source URLs for deduplication

**Identify gaps:**
- Check each category for sources with `"status": "stale"` or `"status": "unknown"`
- Note categories with fewer than 10 sources (potential gaps)
- Record the timestamp for this discovery run

---

## Phase 2: Deploy Research Fleet

**Launch 4-6 parallel research agents across these search domains:**

1. **GitHub Discovery Agent** (ClaudeResearcher)
   - Search GitHub topics: osint, osint-tools, reconnaissance, threat-intelligence, people-search
   - Search for repos created or significantly updated since last_updated date
   - Check starred repos of known OSINT GitHub organizations (cipher387, The-Osint-Toolbox, bellingcat, projectdiscovery)
   - Filter: >50 stars OR created within last 90 days with meaningful content

2. **Web Directory Agent** (PerplexityResearcher)
   - Check Week in OSINT (sector035.nl) for recently featured tools
   - Search for new start.me OSINT pages
   - Check Bellingcat toolkit for recent additions
   - Search "new OSINT tool 2026" and similar queries
   - Check OSINT subreddit for trending tools/resources

3. **Threat Intel Agent** (GeminiResearcher)
   - Search for new threat intelligence platforms and feeds
   - Check for new vulnerability databases
   - Look for new IP/domain reputation services
   - Check CISA, NCSC, ENISA for new resources
   - Search for new malware analysis sandboxes

4. **People/Business Agent** (GrokResearcher)
   - Search for new people search engines or username tools
   - Check for new business intelligence platforms
   - Look for new corporate registry APIs
   - Search for new social media OSINT tools (especially for newer platforms)
   - Check for new email/phone investigation tools

5. **Training/Community Agent** (PerplexityResearcher)
   - Search for new OSINT courses, CTFs, or training platforms
   - Check for new OSINT podcasts or newsletters
   - Look for new OSINT conferences or community events
   - Search for new OSINT practitioners gaining prominence

6. **Specialty Agent** (ClaudeResearcher)
   - Search for new geolocation/GEOINT tools
   - Check for new cryptocurrency/blockchain OSINT tools
   - Look for new dark web monitoring tools
   - Search for new AI-powered OSINT tools
   - Check for region-specific OSINT resources (non-English)

---

## Phase 3: Evaluate & Deduplicate Results

**For each discovered source:**

1. **Deduplication check:**
   - Compare URL against existing SOURCES.JSON entries
   - Check for renamed/rebranded versions of existing sources
   - Skip exact duplicates

2. **Quality evaluation:**
   - Is the source actively maintained? (Updated within 12 months)
   - Does it provide unique value not covered by existing sources?
   - Is it from a reputable author/organization?
   - Is the content freely accessible or does it have a usable free tier?

3. **Classification:**
   - Assign primary category and subcategory
   - Determine OSINT domains: people, company, entity, threat
   - Set cost tier: free, freemium, paid
   - Set status: active, stale, unknown

**Quality gate:** Only sources meeting ALL of these criteria pass:
- [ ] Not a duplicate of an existing source
- [ ] Actively maintained OR canonical reference
- [ ] Provides unique investigative value
- [ ] From a credible source

---

## Phase 4: Update Source Files

**Update SOURCES.JSON:**
- Add new sources to their appropriate category arrays
- Update `last_updated` to today's date
- Increment `total_sources` count
- Update any existing sources whose status has changed (active → stale, etc.)

**Update SOURCES.md:**
- Add new entries to the appropriate section tables
- Maintain alphabetical or logical ordering within sections
- Update the source statistics table at the bottom
- Keep formatting consistent with existing entries

**Generate discovery report:**
- List all newly added sources with their categories
- List any sources whose status changed
- Note any categories that remain thin
- Recommend follow-up searches for gap areas

---

## Phase 5: Verify & Report

**Verify file integrity:**
- Read back SOURCES.JSON and validate it parses as valid JSON
- Read back SOURCES.md and verify markdown formatting
- Confirm new source count matches expected additions
- Verify no existing sources were accidentally removed

**Report results:**
```
## OSINT Source Discovery Report

**Run date:** [date]
**Previous source count:** [N]
**New sources discovered:** [N]
**Updated source count:** [N+new]
**Sources status-changed:** [N]

### New Sources by Category
[List each new source with name, URL, category]

### Gap Analysis
[Categories still below 10 sources or with stale coverage]

### Recommended Follow-ups
[Specific searches to run next time]
```

---

## Scheduling

This workflow should be run:
- **Monthly** for routine source discovery
- **After major OSINT conferences** (SANS OSINT Summit, DEFCON Recon Village, OSMOSIS)
- **When a new OSINT domain emerges** (e.g., new social platform, new threat category)
- **On request** when building investigation capability in a specific domain
