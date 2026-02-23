# Find Person - Complete Investigation Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the FindPerson workflow in the PrivateInvestigator skill to locate individuals"}' \
  > /dev/null 2>&1 &
```

Running the **FindPerson** workflow in the **PrivateInvestigator** skill to locate individuals...

**Purpose:** Systematically locate a person using all available public data sources

**When to Use:**
- User wants to find a specific person by name
- User wants to reconnect with an old friend, classmate, or contact
- User needs to locate someone for legitimate purposes
- Comprehensive people search is required

**Prerequisites:**
- Subject's name (ideally full name)
- Any additional context (location, age, workplace, school, how they know them)
- Legitimate purpose for the search

---

## Workflow Steps

### Step 1: Gather Initial Information

**Description:** Collect all available starting data from the user

**Questions to Ask:**
1. What is the person's full name? (including maiden name, nicknames, variations)
2. What is their approximate age or date of birth?
3. Where did you last know them to be located?
4. How do you know this person? (school, work, family, etc.)
5. When did you last have contact?
6. Do you have any old phone numbers, emails, or addresses?
7. Do you know any family members or mutual contacts?
8. Do you have any photos of them?

**Build Subject Profile:**
```
Name: [Full name]
Aliases/Variations: [Maiden name, nicknames]
Age/DOB: [Approximate or exact]
Last Known Location: [City, State]
Connection Context: [How user knows them]
Last Contact: [Year/timeframe]
Known Associates: [Family, friends, colleagues]
Additional Identifiers: [Old phone, email, employer, school]
```

**Expected Outcome:** Complete subject profile for investigation

---

### Step 2: LAUNCH PARALLEL INVESTIGATION (9+ Agents)

**CRITICAL: Launch ALL agents in a SINGLE message with multiple Task tool calls**

This is the main investigation step. Deploy 9+ agents across 3 categories simultaneously.

---

#### CATEGORY 1: People Search Aggregators (3 agents minimum)

**Agent 1: ClaudeResearcher - Primary Name Search**
```
Prompt: Search for [FULL NAME] with these exact spelling variations: [list all].
Location: [CITY, STATE]. Age approximately [AGE].
Search TruePeopleSearch, FastPeopleSearch, Spokeo concepts.
Return: current address, phone, relatives, associates, email.
```

**Agent 2: ClaudeResearcher - Comprehensive Search**
```
Prompt: Comprehensive people search for [NAME] from [LOCATION].
Try phonetic and ethnic spelling variations of the surname.
Focus on: address history, family tree, employment history.
Return all possible matches with confidence assessment.
```

**Agent 3: GeminiResearcher - Alternative Spellings**
```
Prompt: Find person whose name sounds like [NAME] from [LOCATION].
The surname is likely Eastern European - try: [variations].
Search for family members who might have similar surname.
Return any matches with spelling variations that worked.
```

---

#### CATEGORY 2: Social Media Search (3 agents minimum)

**Agent 4: ClaudeResearcher - LinkedIn/Facebook**
```
Prompt: Search LinkedIn and Facebook for [NAME] from [LOCATION].
Use Google x-ray: site:linkedin.com/in "[NAME]" "[LOCATION]"
Also search: site:facebook.com "[NAME]" "[SCHOOL/CONTEXT]"
Return profile URLs and any contact information visible.
```

**Agent 5: GrokResearcher - Twitter/X Deep Search**
```
Prompt: Search Twitter/X for [NAME] or username variations.
Try handles like: [firstname][lastname], [first]_[last], etc.
Search for mentions, tagged posts, location-based posts.
Check for any public posts mentioning [LOCATION] or [CONTEXT].
```

**Agent 6: CodexResearcher - Username Enumeration**
```
Prompt: If we find any username, enumerate across platforms.
Try common patterns: [first][last], [first].[last], [first][last][birthyear]
Conceptually search: Instagram, TikTok, Reddit, GitHub.
Cross-reference any found usernames across platforms.
```

---

#### CATEGORY 3: Public Records & News (3 agents minimum)

**Agent 7: ClaudeResearcher - Property/Voter Records**
```
Prompt: Search California public records for [NAME].
Focus on: Alameda County property records, CA voter registration.
Also check neighboring counties: Santa Clara, Contra Costa.
Return any official records with addresses or DOB.
```

**Agent 8: GeminiResearcher - Court/Business Records**
```
Prompt: Search for [NAME] in California court records and business filings.
Check: CA Secretary of State business search, court records.
Look for any legal filings, business registrations, professional licenses.
```

**Agent 9: ClaudeResearcher - News & Mentions**
```
Prompt: Search for news articles, obituaries, or public mentions of [NAME].
Check: local Newark/Fremont news archives, alumni mentions.
Search for family members that might lead to subject.
Include any professional or community involvement.
```

---

**What to Compile from ALL Agent Results:**
- All addresses found (current and historical)
- All phone numbers discovered
- All relatives/associates mentioned
- All social media profiles/URLs
- All official records found
- Best spelling variations that returned results
- Confidence level for each finding

**Expected Outcome:** Comprehensive parallel search results to synthesize

---

### Step 5: Reverse Lookups on Discovered Info

**Description:** Use discovered phone/email/username for additional data

**Invoke:** Read ~/.claude/skills/PrivateInvestigator/Workflows/Reverse-lookup.md

**For Each Phone Number Found:**
- Run through CallerID, NumLookup
- Cross-reference with people search sites

**For Each Email Found:**
- Run through Holehe (account discovery)
- Check Hunter.io for company email patterns

**For Each Username Found:**
- Run through Sherlock or WhatsMyName
- Check for cross-platform usage

**Expected Outcome:** Additional accounts and verification data

---

### Step 6: Associate Network Mapping

**Description:** Investigate known relatives and associates for additional leads

**Actions:**
1. Search each relative/associate name found in Step 2
2. Check their social media for subject mentions/tags
3. Look for mutual connections on LinkedIn
4. Search for family events (weddings, obituaries) that may mention subject

**Associate Search Strategy:**
- Parents often have more stable addresses
- Siblings may be connected on social media
- Spouse/partner records may show current address
- Colleagues may have professional network connections

**Expected Outcome:** Indirect paths to subject through network

---

### Step 7: Verification & Confidence Assessment

**Description:** Confirm you've found the correct person

**Invoke:** Read ~/.claude/skills/PrivateInvestigator/Workflows/Verify-identity.md

**Verification Checklist:**
- [ ] Age/DOB matches expected range
- [ ] Location history makes sense chronologically
- [ ] Family connections match known information
- [ ] Employment/education aligns with context
- [ ] Photos (if available) match known appearance
- [ ] Multiple independent sources confirm same data

**Confidence Scoring:**
| Score | Criteria |
|-------|----------|
| HIGH | 3+ unique identifiers match from independent sources |
| MEDIUM | 2 identifiers match, timeline consistent |
| LOW | Single source or name-only match |

**Expected Outcome:** Confidence level for findings

---

### Step 8: Compile Investigation Report

**Description:** Present findings in structured format

**Report Template:**
```markdown
# People Search Report: [Subject Name]

**Search Date:** [Date]
**Requested By:** [User]
**Confidence Level:** [HIGH/MEDIUM/LOW]

## Subject Profile
- **Name:** [Full name]
- **Age:** [Approximate/confirmed]
- **Last Known Location:** [From original request]

## Findings

### Current Contact Information
- **Address:** [Current address if found]
- **Phone:** [Phone numbers found]
- **Email:** [Email addresses found]

### Social Media Presence
- **LinkedIn:** [URL or "Not found"]
- **Facebook:** [URL or "Not found"]
- **Instagram:** [URL or "Not found"]
- **Other:** [Any additional platforms]

### Verification Points
- [Point 1 that confirms identity]
- [Point 2 that confirms identity]
- [Point 3 that confirms identity]

### Investigation Path
1. [Source 1] → [What was found]
2. [Source 2] → [What was found]
3. [Source 3] → [What was found]

## Confidence Assessment
[Explanation of why confidence level was assigned]

## Recommended Next Steps
- [Suggested action 1]
- [Suggested action 2]

## Sources Used
- TruePeopleSearch
- [Other sources]

---
*This investigation used only publicly available information*
```

**Expected Outcome:** Complete investigation report

---

## Outputs

**What this workflow produces:**
- Comprehensive subject profile with all discovered information
- Contact information (address, phone, email) if available
- Social media account URLs
- Confidence assessment
- Investigation report

**Deliverable Format:**
- Markdown report as shown in Step 8
- All sources documented
- Confidence level clearly stated

---

## Common Challenges

### Challenge: Common Name
**Solution:** Add specificity - require location + age + additional identifier. See Verify-identity.md for detailed guidance.

### Challenge: No Results in People Search
**Solution:** Try variations (maiden name, nickname), expand location search, focus on social media and public records.

### Challenge: Subject Appears to Have Intentionally Hidden
**Solution:** Respect their privacy. Report finding to user with ethical guidance about whether to pursue.

### Challenge: Multiple Possible Matches
**Solution:** Use verification workflow to eliminate candidates based on timeline, family, and corroborating data.

---

## Related Workflows

- **Social-media-search.md** - Deep dive on social platforms
- **Public-records-search.md** - Government record searches
- **Reverse-lookup.md** - Phone, email, image lookups
- **Verify-identity.md** - Confirming correct person

---

**Last Updated:** 2025-11-25
