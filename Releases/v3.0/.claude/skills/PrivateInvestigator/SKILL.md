---
name: PrivateInvestigator
description: Ethical people-finding. USE WHEN find person, locate, reconnect, people search, skip trace. SkillSearch('privateinvestigator') for docs.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/PrivateInvestigator/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the PrivateInvestigator skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **PrivateInvestigator** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# PrivateInvestigator - Ethical People Finding

## Core Principle

**PUBLIC DATA ONLY** - No hacking, pretexting, or authentication bypass. All techniques are legal and ethical.


## Workflow Routing

**When executing a workflow, output this notification:**
```
Running the **WorkflowName** workflow in the **PrivateInvestigator** skill to ACTION...
```

## When to Activate

### Direct People-Finding
- "find [person]", "locate [person]", "search for [person]"
- "reconnect with [person]", "looking for lost contact"
- "find an old friend", "locate a former coworker"

### Reverse Lookup
- "reverse phone lookup", "who owns this email"
- "reverse image search", "find person by username"

### Investigation
- "background check" (public data only)
- "what can you find about [person]"
- "research [person]"

## Available Workflows

| Trigger | Workflow | Action |
|---------|----------|--------|
| "find person", "locate" | `FindPerson.md` | Full investigation using parallel research agents |
| "social media search" | `SocialMediaSearch.md` | Cross-platform social media investigation |
| "public records" | `PublicRecordsSearch.md` | Government and official records search |
| "reverse lookup" | `ReverseLookup.md` | Phone, email, image, username searches |
| "verify identity" | `VerifyIdentity.md` | Confirm correct person match |

## Research Strategy

**MANDATORY: Extensive Parallel Research**

Every investigation uses **15 parallel research agents** (5 types × 3 each):

**Agent Types:**
1. **ClaudeResearcher** (3 agents) - People search aggregators, professional records, location intelligence, comprehensive identity, public records, education/alumni
2. **GeminiResearcher** (3 agents) - Alternative identities, multi-perspective synthesis, historical context
3. **GrokResearcher** (3 agents) - Social media deep search, contrarian analysis, real-time intelligence
4. **CodexResearcher** (3 agents) - Username enumeration, Google dorking, technical profiles

**Each agent executes 3 sub-searches** = **45 parallel search threads** per investigation

**Launch Pattern:** All 15 agents launch in a SINGLE message with multiple Task tool calls.

## Core Capabilities

### 1. People Search Aggregators
| Service | Type | Best For |
|---------|------|----------|
| TruePeopleSearch | Free | Best free option, fresh data |
| FastPeopleSearch | Free | Basic lookups, no signup |
| Spokeo | Freemium | Social media aggregation (120+ networks) |
| BeenVerified | Paid | Comprehensive background data |

### 2. Social Media Investigation
- **Facebook:** Google x-ray searches, mutual friends, groups
- **LinkedIn:** Boolean search, alumni networks
- **Instagram/Twitter/TikTok:** Username patterns, cross-platform correlation

### 3. Public Records
- **Voter Registration:** Most states publicly available
- **Property Records:** County assessor/recorder sites
- **Court Records:** PACER (federal), state court portals, CourtListener
- **Business Filings:** Secretary of State websites
- **Professional Licenses:** State licensing boards

### 4. Reverse Lookup
- **Phone:** CallerID, NumLookup, carrier lookup
- **Email:** Epieos, Holehe, Hunter.io
- **Image:** PimEyes, TinEye, Google/Yandex Images
- **Username:** Sherlock, WhatsMyName, Namechk

### 5. Google Dorking
```
site:linkedin.com "John Smith" "Software Engineer"
site:facebook.com "lives in" "Austin" "marketing"
filetype:pdf resume "Jane Doe" "San Francisco"
```

## Investigation Methodology

### Information Hierarchy

**Tier 1: Foundation Data**
- Full name (and variations/maiden names)
- Approximate age or date of birth
- Last known location
- Context (school, workplace, relationship)

**Tier 2: Primary Research**
- People search aggregators
- Social media presence scan
- Google dorking

**Tier 3: Deep Investigation**
- Public records searches
- Reverse lookups on discovered info
- Cross-platform correlation
- Associate/family network mapping

**Tier 4: Verification**
- Multi-source confirmation
- Timeline consistency check
- Photo verification
- Confidence scoring

## Confidence Scoring

| Level | Criteria | Action |
|-------|----------|--------|
| **HIGH** | 3+ unique identifiers match across independent sources | Safe to contact |
| **MEDIUM** | 2 identifiers match, timeline consistent | Verify before contact |
| **LOW** | Single source or name-only match | Needs more investigation |
| **POSSIBLE** | Partial match, requires verification | Do not act without more data |

## Dealing with Common Names

1. **Add Specificity** - Include location, age, employer, school
2. **Cross-Reference** - Match DOB + address patterns across sources
3. **Family Connections** - Verify through known relatives
4. **Timeline Analysis** - Does the life history make sense?
5. **Multiple Identifiers** - Require 3+ matching data points

## Legal & Ethical Boundaries

### GREEN ZONE (Allowed)
✅ Search public records (property, court, voter, business)
✅ Access publicly posted social media content
✅ Use people search aggregator sites
✅ Perform reverse lookups on public data
✅ Google dorking with public search operators

### RED ZONE (Never Cross)
❌ Access data behind login walls without authorization
❌ Bypass authentication or security measures
❌ Use pretexting or impersonation
❌ Access private databases (credit, financial, medical)
❌ Stalk, harass, or intimidate subjects
❌ Access PI-only databases without license

## When to STOP

- If the purpose shifts to harassment or stalking
- If the subject has clearly opted out of contact
- If investigation requires illegal methods
- If you suspect the requestor has malicious intent

## Examples

**Example 1: Finding an Old College Friend**
```
User: "Help me find my college roommate from 2005, John Smith from Austin"
→ Routes to FindPerson.md
→ Launches 15 parallel research agents
→ Cross-references people search + LinkedIn alumni + property records
→ Verifies identity through timeline analysis
→ Reports findings with HIGH confidence
```

**Example 2: Reverse Phone Lookup**
```
User: "Who called from 512-555-1234?"
→ Routes to ReverseLookup.md
→ Runs phone through CallerID, NumLookup
→ Cross-references with people search aggregators
→ Reports owner name, location, carrier
```

**Example 3: Social Media Investigation**
```
User: "Find Jane Doe's social media, she's a marketing professional in Denver"
→ Routes to SocialMediaSearch.md
→ LinkedIn Boolean search + Google x-ray
→ Username enumeration if handle discovered
→ Reports all accounts with MEDIUM/HIGH confidence
```

---

**Related Documentation:**
- Complete workflow details in `Workflows/` directory
- Integration with Research skill for parallel agent orchestration
