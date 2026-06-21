# Public Records Search Workflow

**Purpose:** Search government and official records databases for person information

**When to Use:**
- User needs official/verified information about a person
- Social media and people search haven't yielded results
- User needs to verify identity through official records
- Property, court, or business records are specifically needed

**Prerequisites:**
- Subject's full name
- Location (state at minimum)
- Approximate age or DOB (helpful for filtering)

---

## Workflow Steps

### Step 1: Property Records Search

**Description:** Real estate ownership is public record in all US states

**How to Search:**
1. Identify the county where subject lives/lived
2. Find County Assessor or County Recorder website
3. Search by owner name

**Multi-County Aggregators:**
- **NETR Online:** https://publicrecords.netronline.com
  - Links to property records for every US county
- **ParcelQuest (California):** https://parcelquest.com

**What to Search:**
- Current county of residence
- Previous counties from address history
- Counties where family members own property

**Information Available:**
- Property address
- Owner name(s)
- Property value/assessment
- Purchase date and price
- Deed history
- Liens and mortgages

**Expected Outcome:** Current/historical addresses, property ownership confirmation

---

### Step 2: Voter Registration Records

**Description:** Voter rolls are public in most states (varies by state)

**State Availability:**

| Access Level | States |
|--------------|--------|
| **Open Access** | NC, FL, OH, WI, MI, PA, GA (most data public) |
| **Restricted** | CA, NY, TX (limited access/purpose required) |
| **Closed** | Some states don't allow public access |

**How to Search:**
1. Visit state Secretary of State or Board of Elections website
2. Look for "Voter Registration Lookup" or "Am I Registered?"
3. Search by name + county or DOB

**Information Available:**
- Full name
- Address
- Date of birth
- Party affiliation (some states)
- Voting history (when they voted, not how)

**Expected Outcome:** Address confirmation, DOB verification

---

### Step 3: Court Records Search

**Description:** Civil and criminal court records are generally public

**Federal Courts - PACER:**
- URL: https://pacer.uscourts.gov
- Registration required
- Fees: $0.10/page (max $3/document), waived if under $30/quarter
- Covers: Federal civil, criminal, bankruptcy, appeals

**FREE Alternative - CourtListener:**
- URL: https://www.courtlistener.com
- Free access to federal court opinions and filings
- Maintained by Free Law Project

**State Courts:**
- Search "[State] court records search" for state portal
- Many states have unified case search systems
- Some require county-by-county searching

**What to Search:**
- Civil cases (lawsuits, divorces, name changes)
- Criminal cases (arrests, convictions)
- Family court (if publicly accessible)
- Bankruptcy filings

**Information Available:**
- Case parties and addresses
- Case type and status
- Filing dates
- Attorney information
- Some case documents

**Expected Outcome:** Legal history, name changes, address confirmation from filings

---

### Step 4: Business Registration Records

**Description:** Business entity filings are public in all states

**How to Search:**
1. Go to state Secretary of State website
2. Find "Business Entity Search" or "Corporation Search"
3. Search by individual name (as registered agent or officer)

**Key State Portals:**
- California: https://bizfileonline.sos.ca.gov
- Texas: https://mycpa.cpa.state.tx.us/coa/
- New York: https://apps.dos.ny.gov/publicInquiry/
- Florida: https://search.sunbiz.org

**What to Search:**
- Subject's name as officer/director
- Subject's name as registered agent
- Business names they may be associated with

**Information Available:**
- Business name and type
- Registered agent name and address
- Officer/director names
- Formation date
- Status (active/inactive)
- Annual reports (some states)

**Expected Outcome:** Business affiliations, registered agent addresses, professional connections

---

### Step 5: Professional License Search

**Description:** Licenses for regulated professions are public record

**Professions to Check:**
- Medical (doctors, nurses, dentists)
- Legal (attorneys)
- Financial (CPAs, financial advisors)
- Real estate (agents, brokers)
- Contractors and trades
- Teachers and educators

**How to Search:**
1. Identify relevant licensing board for profession
2. Search by name on board's website

**Multi-State Resources:**
- **Attorneys:** State bar associations have public directories
- **Doctors:** State medical board, also NPDB
- **Real Estate:** ARELLO for national search

**Example State Portals:**
- California DCA: https://search.dca.ca.gov
- Texas Licensing: Various by profession

**Information Available:**
- License number and type
- License status (active/expired)
- Address of record
- Disciplinary actions
- Education/training records

**Expected Outcome:** Professional credentials, business address, disciplinary history

---

### Step 6: Death Records / Obituaries

**Description:** Confirm if subject is deceased; find family connections

**Resources:**
- **Social Security Death Index:** Via Ancestry.com or FamilySearch
- **Obituary Search:** Legacy.com, newspapers.com
- **FindAGrave:** https://www.findagrave.com

**Why Search:**
- Confirm subject is still living
- Find family members mentioned in obituaries
- Identify maiden names or married names

**Expected Outcome:** Death confirmation or family/associate leads

---

### Step 7: UCC Filings (Liens and Secured Transactions)

**Description:** Commercial financing records are public

**How to Search:**
- State Secretary of State UCC search
- Search by debtor name

**Information Available:**
- Secured party (lender)
- Debtor name and address
- Collateral described
- Filing date

**When Useful:**
- Looking for someone with business assets
- Verifying financial relationships
- Finding registered addresses

**Expected Outcome:** Business addresses, financial relationships

---

### Step 8: Compile Public Records Findings

**Description:** Organize all discovered official records

**Report Template:**
```markdown
## Public Records Report: [Subject Name]

### Property Records
| County | Address | Owner Name | Purchase Date |
|--------|---------|------------|---------------|
| [County] | [Address] | [Name] | [Date] |

### Voter Registration
- **State:** [State]
- **Address:** [Address]
- **DOB:** [If available]
- **Status:** [Active/Inactive]

### Court Records
| Court | Case Type | Case Number | Status |
|-------|-----------|-------------|--------|
| [Court] | [Type] | [Number] | [Status] |

### Business Affiliations
| Business Name | Role | State | Status |
|---------------|------|-------|--------|
| [Business] | [Officer/Agent] | [State] | [Active] |

### Professional Licenses
| License Type | Number | Status | State |
|--------------|--------|--------|-------|
| [Type] | [Number] | [Active/Expired] | [State] |

### Verification Summary
- Official records confirm address at: [Address]
- DOB confirmed/estimated: [DOB]
- Professional status: [Description]
```

**Expected Outcome:** Comprehensive public records summary

---

## State-Specific Notes

### California
- Strong privacy protections
- Voter data restricted
- Good business entity search
- DCA license lookup comprehensive

### Texas
- More open public records
- Good business entity portal
- County-by-county for many records

### Florida
- Very open public records (Sunshine Law)
- Voter data readily accessible
- Court records widely available online

### New York
- Moderate access
- Good court records system (eCourts)
- Business entity search available

---

## Outputs

**What this workflow produces:**
- Verified addresses from official sources
- DOB confirmation
- Legal history overview
- Business affiliations
- Professional credentials

**Quality Notes:**
- Official records provide highest confidence data
- Cross-reference with people search results
- Note date of records (may be outdated)

---

## Related Workflows

- **find-person.md** - Full investigation workflow
- **verify-identity.md** - Using records for verification

---

**Last Updated:** 2025-11-25
