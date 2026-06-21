# Social Media Search Workflow

**Purpose:** Systematically search social media platforms to find a person's online presence

**When to Use:**
- User specifically wants to find someone's social media accounts
- Main investigation needs social media component
- User wants to verify someone's online presence
- Cross-platform correlation is needed

**Prerequisites:**
- Subject's full name
- Any known usernames, handles, or email addresses
- Location and/or age for filtering
- Context (profession, interests) for verification

---

## Workflow Steps

### Step 1: LinkedIn Search (Professional Presence)

**Description:** LinkedIn is often the most reliable for professionals

**Method 1: Direct LinkedIn Search**
- Use LinkedIn's search bar with name
- Filter by: Location, Company, School, Industry
- Note: Limited results without Premium

**Method 2: Google X-Ray (Recommended)**
```
site:linkedin.com/in "[Full Name]" "[City]"
site:linkedin.com/in "[Full Name]" "[Company Name]"
site:linkedin.com/in "[Full Name]" "[University]"
```

**Method 3: Alumni Search**
- If you share a school, use LinkedIn Alumni feature
- Filter by graduation year and major

**What to Record:**
- Profile URL
- Current employer and title
- Location
- Education history
- Connection count (for verification)

**Expected Outcome:** LinkedIn profile URL and professional details

---

### Step 2: Facebook Search

**Description:** Most extensive personal network data

**Method 1: Google X-Ray (Bypasses Facebook Limitations)**
```
site:facebook.com "[Full Name]" "[City]"
site:facebook.com "[Full Name]" "[School]"
site:facebook.com "[Full Name]" "[Employer]"
```

**Method 2: Facebook Direct Search**
- Search by name in Facebook search bar
- Filter by: Location, Education, Workplace
- Check "People" tab specifically

**Method 3: Mutual Friends**
- If you have mutual friends, check their friend lists
- Look for tagged photos and mentions

**Advanced Techniques:**
- Search for family member profiles, then check their friends
- Look for group memberships (alumni groups, local groups)
- Check public events they may have RSVP'd to

**What to Record:**
- Profile URL
- Profile photo (for verification)
- Location listed
- Mutual friends if any
- Public posts/check-ins

**Expected Outcome:** Facebook profile URL and personal details

---

### Step 3: Instagram Search

**Description:** Visual platform, often shows current lifestyle

**Method 1: Direct Search**
- Search by name in Instagram
- Search by username variations

**Method 2: Google X-Ray**
```
site:instagram.com "[Full Name]"
site:instagram.com "[Username]"
```

**Method 3: Username Pattern Matching**
Common username patterns to try:
- firstname.lastname
- firstnamelastname
- firstinitial.lastname
- firstname_lastname
- lastname.firstname

**Method 4: Location/Hashtag Search**
- Search location tags in their city
- Search hashtags related to their profession/interests

**What to Record:**
- Username and profile URL
- Bio information
- Location tags in posts
- Cross-references to other platforms

**Expected Outcome:** Instagram handle and profile details

---

### Step 4: Twitter/X Search

**Description:** Public commentary and professional presence

**Method 1: X Advanced Search**
```
from:username - Search specific user's tweets
"[Full Name]" - Search mentions
near:"[City]" within:15mi - Location filter
```

**Method 2: Google X-Ray**
```
site:twitter.com "[Full Name]"
site:x.com "[Full Name]"
```

**Method 3: Username Search**
- Try same username patterns as Instagram
- Check if username from other platforms exists on X

**What to Record:**
- Handle and profile URL
- Bio and location in profile
- Website links in bio
- Tweet activity level

**Expected Outcome:** X/Twitter handle and public profile

---

### Step 5: TikTok Search

**Description:** Increasingly important for younger demographics

**Method 1: Direct Search**
- Search by name or username in TikTok
- Check "Users" tab in search results

**Method 2: Google X-Ray**
```
site:tiktok.com/@"[username]"
site:tiktok.com "[Full Name]"
```

**Method 3: Cross-Platform Username**
- Try usernames found on other platforms

**What to Record:**
- Username and profile URL
- Bio information
- Content themes (helps verify correct person)

**Expected Outcome:** TikTok profile if exists

---

### Step 6: Username Enumeration

**Description:** If you found a username, check across 400+ platforms

**Tool: Sherlock (Command Line)**
```bash
# Install if needed
pip install sherlock-project

# Run enumeration
sherlock [username] --print-found
```

**Alternative: WhatsMyName (Web)**
- URL: https://whatsmyname.app
- Enter discovered username
- Returns all platforms where username exists

**Alternative: Namechk**
- URL: https://namechk.com
- Quick availability check across major platforms

**What to Record:**
- All platforms where username is claimed
- Which accounts appear active
- Profile consistency across platforms

**Expected Outcome:** Complete cross-platform presence map

---

### Step 7: Email Account Discovery

**Description:** Find which services are associated with known email

**Tool: Holehe**
```bash
# Install
pip install holehe

# Run
holehe email@example.com
```

Checks 120+ websites for account existence without sending notification.

**Alternative: Epieos**
- URL: https://epieos.com
- Enter email address
- Returns linked accounts and breach data

**What to Record:**
- Services where email is registered
- Social accounts linked to email
- Any Google account info

**Expected Outcome:** Services associated with email address

---

### Step 8: Cross-Reference and Verify

**Description:** Confirm all found accounts belong to same person

**Verification Points:**
1. **Photo Consistency:** Do profile photos match across platforms?
2. **Bio Consistency:** Similar job titles, locations, descriptions?
3. **Connection Overlap:** Do friends/followers overlap?
4. **Content Themes:** Similar interests and posting patterns?
5. **Timeline Consistency:** Does activity timeline make sense?

**Red Flags (May Be Wrong Person):**
- Drastically different photos
- Conflicting locations/ages
- No connection overlap with known associates
- Different professional background

**Expected Outcome:** Confidence level for each account

---

## Outputs

**What this workflow produces:**
- List of all discovered social media accounts
- Username patterns identified
- Profile URLs for each platform
- Verification confidence for each account

**Report Format:**
```markdown
## Social Media Presence: [Subject Name]

### Confirmed Accounts (HIGH Confidence)
| Platform | URL | Username | Verified By |
|----------|-----|----------|-------------|
| LinkedIn | [URL] | [username] | Photo + employer match |
| Facebook | [URL] | [username] | Mutual friends + location |

### Probable Accounts (MEDIUM Confidence)
| Platform | URL | Username | Notes |
|----------|-----|----------|-------|
| Instagram | [URL] | [username] | Same username, location matches |

### Possible Accounts (LOW Confidence)
| Platform | URL | Username | Notes |
|----------|-----|----------|-------|
| Twitter | [URL] | [username] | Common name, needs verification |

### Username Patterns
- Primary pattern: [firstname.lastname]
- Found on: LinkedIn, Instagram, GitHub
```

---

## Platform-Specific Notes

### LinkedIn
- Most reliable for professionals 30+
- Limited search without Premium
- Google x-ray works better than native search

### Facebook
- Privacy settings vary widely
- Check "About" section for contact info
- Friends list often more revealing than profile

### Instagram
- May be private account
- Stories/highlights visible even if posts hidden
- Location tags are goldmine

### Twitter/X
- Usually public by default
- Check replies and quote tweets
- Bio links often lead to other platforms

### TikTok
- Younger demographics
- Username often matches other platforms
- Comments may reveal real name

---

## Related Workflows

- **find-person.md** - Full investigation workflow
- **reverse-lookup.md** - Reverse email/username lookup
- **verify-identity.md** - Confirming correct person

---

**Last Updated:** 2025-11-25
