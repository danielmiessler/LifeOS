# Verify Identity Workflow

**Purpose:** Confirm that discovered information belongs to the correct person

**When to Use:**
- User has common name problem (multiple possible matches)
- User wants to verify findings before making contact
- User needs confidence assessment on investigation results
- Multiple candidates need to be narrowed down

**Prerequisites:**
- Initial investigation completed
- One or more potential matches identified
- Original subject profile for comparison

---

## Workflow Steps

### Step 1: Establish Verification Criteria

**Description:** Define what unique identifiers we have for matching

**Build Comparison Framework:**

| Identifier | Original (Known) | Candidate | Match? |
|------------|------------------|-----------|--------|
| Full Name | [Known name] | [Found name] | |
| Age/DOB | [Known/estimated] | [Found] | |
| Last Known Location | [Known city/state] | [Found] | |
| School | [If known] | [If found] | |
| Employer | [If known] | [If found] | |
| Family Members | [If known] | [If found] | |
| Physical Description | [If known] | [Photo] | |

**Minimum for Confirmation:**
- 3+ independent matches for HIGH confidence
- 2 matches with logical timeline for MEDIUM confidence
- 1 match only = LOW confidence (needs more research)

**Expected Outcome:** Clear criteria for evaluation

---

### Step 2: Timeline Consistency Check

**Description:** Verify the life timeline makes logical sense

**Timeline Analysis:**
1. **Birth Year:** Does approximate age match?
2. **Education Timeline:**
   - High school graduation ~18 years old
   - College graduation ~22 years old
   - Do dates align with age?
3. **Career Timeline:**
   - Does employment history flow logically?
   - Are there unexplained gaps?
4. **Location Timeline:**
   - Do address changes make sense?
   - Can you trace the path from last known to current?

**Red Flags:**
- Age doesn't match graduation dates
- Lives in location that doesn't fit history
- Career path doesn't match known profession
- Unexplainable timeline gaps

**Expected Outcome:** Timeline validation or concerns noted

---

### Step 3: Family/Associate Verification

**Description:** Cross-reference through known connections

**Verification Steps:**
1. If you know subject's family members:
   - Search for those family members
   - Check if candidate is connected to same family
2. If people search shows relatives:
   - Do relative names match any known family?
   - Are relative ages appropriate (parents older, siblings similar)?
3. Social media connections:
   - Do mutual friends match expected network?
   - Are they connected to people from known history?

**Strong Verification:**
- Candidate is listed as relative of known family member
- Mutual friends include known associates
- Social media shows interaction with known people

**Expected Outcome:** Family/network verification result

---

### Step 4: Photo Verification

**Description:** Compare photos across sources

**Visual Comparison:**
1. Collect photos from all discovered sources
2. Compare for consistency:
   - Same person across platforms?
   - Age-appropriate for expected age?
   - Any distinguishing features match?

**Photo Analysis Points:**
- Facial structure consistency
- Approximate age in photos
- Background clues (location, activities)
- Metadata if available (date, location)

**Tools for Comparison:**
- PimEyes (paid) - facial recognition search
- Manual comparison across found profiles
- Google reverse image search on profile photos

**If No Photos Available:**
- Rely on other verification methods
- Note as limitation in confidence assessment

**Expected Outcome:** Photo verification result or limitation noted

---

### Step 5: Cross-Source Verification

**Description:** Confirm data appears in multiple independent sources

**Verification Matrix:**

| Data Point | Source 1 | Source 2 | Source 3 | Consistent? |
|------------|----------|----------|----------|-------------|
| Name | [Source] | [Source] | [Source] | Yes/No |
| Address | [Source] | [Source] | [Source] | Yes/No |
| Age/DOB | [Source] | [Source] | [Source] | Yes/No |
| Phone | [Source] | [Source] | [Source] | Yes/No |
| Email | [Source] | [Source] | [Source] | Yes/No |

**Independence Requirement:**
- Sources should be truly independent
- People search sites often pull from same databases (count as 1 source)
- Best independent sources:
  - Social media (they created it)
  - Public records (government verified)
  - Different people search aggregators with different data sources

**Expected Outcome:** Cross-source verification matrix

---

### Step 6: Common Name Disambiguation

**Description:** Special handling for very common names

**For Common Names (John Smith, etc.):**

1. **Require More Identifiers:**
   - Full DOB, not just age
   - Middle name or initial
   - Specific location history
   - Unique employment/education

2. **Elimination Strategy:**
   - List all candidates found
   - Eliminate based on age mismatch
   - Eliminate based on location impossibility
   - Eliminate based on profession mismatch

3. **Differentiation Points:**
   - Unique middle name
   - Specific employer
   - Exact graduation year
   - Distinctive family names

4. **When Uncertain:**
   - Report all viable candidates
   - Provide distinguishing factors for each
   - Let user determine based on additional knowledge

**Expected Outcome:** Single candidate or ranked candidates with differentiators

---

### Step 7: Calculate Confidence Score

**Description:** Assign formal confidence level to findings

**Scoring Criteria:**

**HIGH Confidence (Safe to Act On):**
- 3+ unique identifiers match from independent sources
- Timeline is fully consistent
- Family/network verification positive
- Photo verification (if applicable) positive
- No red flags or contradictions

**MEDIUM Confidence (Verify Before Acting):**
- 2 identifiers match
- Timeline is generally consistent
- Some network verification
- Minor inconsistencies explainable

**LOW Confidence (Needs More Research):**
- Single source confirmation
- Some timeline questions
- Limited verification options
- Common name with limited differentiation

**UNCONFIRMED (Do Not Act):**
- Name match only
- Contradictory information
- Cannot differentiate from other candidates
- Significant timeline problems

**Expected Outcome:** Confidence score with justification

---

### Step 8: Generate Verification Report

**Description:** Document verification analysis

**Report Template:**

```markdown
# Identity Verification Report

## Subject
**Original Profile:**
- Name: [Known name]
- Age/DOB: [Known/estimated]
- Last Known Location: [City, State]
- Context: [How user knows them]

## Candidate Evaluated
**Discovered Profile:**
- Name: [Found name]
- Age/DOB: [Found]
- Current Location: [Found]
- Sources: [List sources]

## Verification Analysis

### Timeline Check
[Analysis of timeline consistency]
**Result:** [Consistent/Minor Issues/Major Concerns]

### Family/Network Verification
[Analysis of family and connection matches]
**Result:** [Verified/Partial/Unverified]

### Photo Verification
[Analysis of photo comparison, if available]
**Result:** [Match/Possible Match/No Photos Available]

### Cross-Source Verification
| Data Point | Sources Confirming | Consistent |
|------------|-------------------|------------|
| [Point] | [Count] | [Yes/No] |

### Common Name Analysis
[If applicable - how candidate was differentiated]

## Confidence Assessment

**Final Confidence Level:** [HIGH/MEDIUM/LOW/UNCONFIRMED]

**Justification:**
1. [Reason 1]
2. [Reason 2]
3. [Reason 3]

**Limitations:**
- [Any gaps in verification]
- [Information not available]

## Recommendation

[Whether it's safe to proceed with contact/action]

---
*Verification completed: [Date]*
```

**Expected Outcome:** Complete verification report

---

## Outputs

**What this workflow produces:**
- Formal confidence score (HIGH/MEDIUM/LOW/UNCONFIRMED)
- Verification analysis across multiple dimensions
- Clear recommendation on whether to proceed
- Documentation of verification methodology

**Confidence Level Meanings:**

| Level | Meaning | Action |
|-------|---------|--------|
| HIGH | Very likely correct person | Safe to proceed with contact |
| MEDIUM | Probably correct | Proceed with caution; soft verification first |
| LOW | Possibly correct | Need more information before action |
| UNCONFIRMED | Cannot verify | Do not act; need additional investigation |

---

## Special Cases

### Case: Married Name Change
- Search both maiden and married names
- Check marriage records
- Look for social media with relationship status changes

### Case: Deceased Subject
- Check Social Security Death Index
- Search obituaries
- Verify with family before continued search

### Case: Privacy-Conscious Subject
- Limited online presence may be intentional
- Consider whether to respect their privacy choices
- Focus on public records if legitimate need

### Case: Multiple Candidates Remain
- Present all candidates with differentiating factors
- Ask user for additional information to narrow down
- Do not guess if truly uncertain

---

## Related Workflows

- **find-person.md** - Full investigation workflow
- **social-media-search.md** - For additional verification data
- **public-records-search.md** - For official record verification

---

**Last Updated:** 2025-11-25
