# Reverse Lookup Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ReverseLookup workflow in the PrivateInvestigator skill to trace identifiers"}' \
  > /dev/null 2>&1 &
```

Running the **ReverseLookup** workflow in the **PrivateInvestigator** skill to trace identifiers...

**Purpose:** Identify a person from partial information (phone, email, image, username)

**When to Use:**
- User has a phone number and wants to know who it belongs to
- User has an email and wants to find the person
- User has a photo and wants to identify the person
- User has a username and wants to find the real identity
- Any "reverse" search scenario

**Prerequisites:**
- At least one identifier (phone, email, image, username)
- Legitimate purpose for the search

---

## Reverse Phone Lookup

### Step 1: Free Phone Lookup Services

**CallerID Test:**
- URL: https://calleridtest.com
- Enter phone number
- Returns: Name, carrier, location

**NumLookup:**
- URL: https://www.numlookup.com
- Free carrier and location lookup
- Limited name information

**USPhoneBook:**
- URL: https://www.usphonebook.com
- Free reverse phone search
- Shows name, address, relatives

### Step 2: People Search Aggregator Reverse Lookup

**TruePeopleSearch:**
- Has reverse phone lookup feature
- Enter number in search
- Often provides full contact record

**That's Them:**
- URL: https://thatsthem.com
- Reverse phone feature
- Shows associated names and addresses

### Step 3: Additional Phone Research

**Check Carrier Type:**
- Mobile vs. landline
- VoIP (may be harder to trace)
- Prepaid (limited registration data)

**Search Phone Number in Google:**
```
"512-555-1234"
"5125551234"
```
May find:
- Business listings
- Online classified ads
- Public posts with number

**Check Whitepages/Yellow Pages:**
- Landlines especially
- Business associations

### Phone Lookup Output:
```markdown
## Reverse Phone Results: [Phone Number]

**Carrier:** [Carrier name]
**Type:** [Mobile/Landline/VoIP]
**Location:** [City, State]

**Associated Names:**
- [Name 1] - [Confidence level]
- [Name 2] - [Confidence level]

**Associated Addresses:**
- [Address 1]
- [Address 2]

**Sources Checked:**
- CallerID Test
- NumLookup
- TruePeopleSearch
- Google search
```

---

## Reverse Email Lookup

### Step 1: Email Account Discovery with Holehe

**Tool:** Holehe (checks 120+ services)
```bash
# Install
pip install holehe

# Run
holehe target@example.com
```

**Output Shows:**
- Services where email is registered
- Social media accounts
- Dating sites
- Forums and communities

### Step 2: Epieos Email Lookup

**URL:** https://epieos.com
**Features:**
- Links email to social accounts
- Shows Google account info (name, photo)
- Breach data associations

### Step 3: Hunter.io

**URL:** https://hunter.io
**Best For:**
- Corporate email patterns
- Finding all emails at a domain
- Verifying email validity

**Use Case:** If you have company domain, can find other employees and patterns

### Step 4: Google the Email

```
"target@example.com"
```

**May Find:**
- Forum posts
- Public profiles
- Documents with email listed
- Business directories

### Step 5: Check Social Media Registration

Manually check if email might be used for:
- Facebook (via forgot password - shows partial email)
- LinkedIn
- Twitter
- Instagram

**Note:** Do not attempt to reset passwords or gain access

### Email Lookup Output:
```markdown
## Reverse Email Results: [Email]

**Email Provider:** [Gmail/Yahoo/Corporate]
**Validity:** [Valid/Invalid/Catch-all]

**Linked Accounts (Holehe):**
- [Service 1]: Registered
- [Service 2]: Registered
- [Service 3]: Not found

**Google Account Info (Epieos):**
- Name: [If available]
- Photo: [If available]

**Other Findings:**
- [Any forum posts, profiles, etc.]
```

---

## Reverse Image Search

### Step 1: Google Images

**URL:** https://images.google.com
**Method:**
- Click camera icon
- Upload image or paste URL
- Review matching images

**Best For:** Finding image across websites, identifying public figures

### Step 2: TinEye

**URL:** https://tineye.com
**Features:**
- 79.5+ billion indexed images
- Shows where image appears online
- Finds modified versions of image
- Sort by oldest (find original source)

**Best For:** Finding image origin, detecting photo manipulation

### Step 3: Yandex Images

**URL:** https://yandex.com/images
**Features:**
- Excellent for faces
- Strong European/Russian coverage
- Often finds what Google misses

**Best For:** Face matching, Eastern European sources

### Step 4: PimEyes (Paid)

**URL:** https://pimeyes.com
**Features:**
- Dedicated facial recognition
- Billions of indexed faces
- Finds social media profiles

**Legal Note:** Verify legality in your jurisdiction; some areas restrict facial recognition

### Step 5: FaceCheck.id

**URL:** https://facecheck.id
**Features:**
- Alternative to PimEyes
- Social media focused
- Browser extension available

### Image Search Output:
```markdown
## Reverse Image Results

**Image Analyzed:** [Description/filename]

**Google Images:**
- [Number] results found
- Key matches: [URLs]

**TinEye:**
- [Number] results
- Oldest source: [URL, date]

**Yandex:**
- [Number] face matches
- Notable matches: [URLs]

**Identified Person:**
- Name: [If determined]
- Confidence: [HIGH/MEDIUM/LOW]
- Source: [How determined]
```

---

## Reverse Username Search

### Step 1: Sherlock (Command Line)

```bash
# Install
pip install sherlock-project

# Run
sherlock target_username --print-found

# Output to file
sherlock target_username -o results.txt
```

**Checks 400+ platforms** for username registration

### Step 2: WhatsMyName (Web)

**URL:** https://whatsmyname.app
**Features:**
- Web-based alternative to Sherlock
- Hundreds of sites checked
- Shows direct profile URLs

### Step 3: Namechk

**URL:** https://namechk.com
**Features:**
- Quick availability check
- Major platforms covered
- Social and domain availability

### Step 4: Search Username in Google

```
"target_username"
inurl:"target_username"
```

**May Find:**
- Profiles not in database
- Forum posts
- Comments on websites
- Code repositories

### Step 5: Check Common Patterns

If you found one username, try variations:
- target_username → targetusername → target.username
- target_username1 → target_username2
- Check if matches real name pattern

### Username Lookup Output:
```markdown
## Reverse Username Results: [username]

**Platforms Found (Sherlock):**
| Platform | URL | Status |
|----------|-----|--------|
| GitHub | github.com/[username] | Found |
| Instagram | instagram.com/[username] | Found |
| Reddit | reddit.com/u/[username] | Not Found |

**Profile Analysis:**
- Most active: [Platform]
- Consistent identity: [Yes/No]
- Real name indicators: [Any found]

**Cross-Reference:**
- Email pattern: [If discovered]
- Location indicators: [From bios]
- Other usernames used: [Variations found]
```

---

## Outputs

**What this workflow produces:**
- Identity information from partial identifier
- Associated accounts and profiles
- Cross-reference data for verification
- Confidence assessment

**Deliverable Format:**
- Structured report per identifier type
- All sources documented
- Confidence level stated

---

## API Options (For Automation)

### Phone APIs:
| Provider | Cost | Notes |
|----------|------|-------|
| Telnyx | $0.003/query | Carrier, LRN |
| Twilio Lookup | $0.02/query | Name, carrier |
| NumVerify | Free tier | Basic validation |

### Email APIs:
| Provider | Cost | Notes |
|----------|------|-------|
| Hunter.io | $49+/mo | Verification + discovery |
| FullContact | Enterprise | Identity enrichment |

### Use Apify MCP for social scraping automation

---

## Related Workflows

- **find-person.md** - Full investigation workflow
- **social-media-search.md** - After identifying username
- **verify-identity.md** - Confirming findings

---

**Last Updated:** 2025-11-25
