# Social Media OSINT Tools

This directory contains social media Open Source Intelligence (OSINT) tools for the PAI webassessment skill. These tools enable username tracking, Instagram analysis, and Twitter/X intelligence gathering for penetration testing and social media reconnaissance.

## 🚀 Quick Start

**All tools are installed in a Python 3.14 virtual environment for maximum compatibility.**

```bash
# Activate the virtual environment
cd OsintTools
source osint-venv/bin/activate

# Now use any tool:
sherlock username_to_search
python Osintgram/main.py target_username
python tinfoleak/tinfoleak.py -u target_username

# Deactivate when done
deactivate
```

**IMPORTANT:** Always activate the virtual environment before using these tools.

---

## 📦 Installed Tools

### 1. Sherlock - Username Search Across 600+ Platforms

**Purpose:** Search for usernames across over 600 social networks and platforms to track digital footprints.

**Location:** `OsintTools/sherlock/`

**Installation Method:**
```bash
# Tools installed in Python 3.14 virtual environment
cd OsintTools
source osint-venv/bin/activate
cd sherlock
pip install -e .
```

**Usage:**
```bash
# Activate virtual environment first!
cd OsintTools
source osint-venv/bin/activate

# Search for username
sherlock username_to_search

# Search for multiple usernames
sherlock user1 user2 user3

# Output to file
sherlock --output results.txt username_to_search

# Export as CSV
sherlock --csv --folderoutput ~/results username_to_search

# Check version
sherlock --version
```

**Configuration:**
- Uses `sherlock_project/resources/data.json` for site definitions
- Supports proxy via `--proxy` flag
- Can filter by site category

**Known Limitations:**
- Some platforms may rate-limit or block automated queries
- Results depend on platform API availability
- Must use virtual environment (Python 3.14) for compatibility

**Version:** 0.16.0
**Status:** ✅ Fully functional - tested and verified

---

### 2. Osintgram - Instagram Data Collection and Analysis

**Purpose:** Collect and analyze Instagram account data including followers, posts, geolocation, hashtags, and metadata for OSINT investigations.

**Location:** `OsintTools/Osintgram/`

**Installation Method:**
```bash
# Tools installed in Python 3.14 virtual environment
cd OsintTools
source osint-venv/bin/activate
cd Osintgram
pip install -r requirements.txt
```

**Dependencies Installed:**
- requests-toolbelt==0.9.1
- geopy>=2.0.0
- prettytable==0.7.2
- instagram-private-api==1.6.0
- gnureadline>=8.0.0
- hikerapi==1.7.1

**Usage:**
```bash
# Activate virtual environment first!
cd OsintTools
source osint-venv/bin/activate

# Run Osintgram
cd Osintgram
python main.py <target_username>

# Interactive mode commands (once running):
list followers       # Get follower list
info                # Get target account info
hashtags            # Get used hashtags
photos              # Get photo URLs
comments            # Get post comments
stories             # Get stories (if available)
geolocation         # Get location data from posts
```

**Configuration:**
1. **Instagram Credentials Required:**
   - Create `config/credentials.ini` with your Instagram login
   - Format:
     ```ini
     [Credentials]
     username = your_instagram_username
     password = your_instagram_password
     ```
   - **Security Warning:** Use a dedicated OSINT account, not your personal account

2. **Authentication:**
   - First run will authenticate and save session
   - Session stored in `config/` directory
   - May require 2FA verification on first login

**Known Limitations:**
- **Instagram API Restrictions:** Instagram heavily rate-limits automated access
- **Account Risk:** Using automation may trigger Instagram security measures
- **Private Accounts:** Limited data available for private accounts
- **Session Expiry:** May need to re-authenticate periodically
- Some features may break with Instagram API changes

**Status:** ✅ Installed and tested - requires Instagram credentials for use

---

### 3. Tinfoleak - Twitter/X Intelligence Analysis

**Purpose:** Extract and analyze Twitter/X user intelligence including tweets, geolocation, social graphs, and metadata for threat intelligence.

**Location:** `OsintTools/tinfoleak/`

**Installation Method:**
```bash
# Tools installed in Python 3.14 virtual environment
cd OsintTools
source osint-venv/bin/activate
pip install tweepy pillow exifread jinja2 oauth2
```

**Dependencies Installed:**
- tweepy (Twitter API library)
- pillow (Image processing)
- exifread (EXIF metadata extraction)
- jinja2 (Template engine for reports)
- oauth2 (OAuth authentication)

**Usage:**
```bash
# Activate virtual environment first!
cd OsintTools
source osint-venv/bin/activate

# Configure Twitter API credentials first (see Configuration below)
cd tinfoleak

# GUI Mode (requires display)
python tinfoleak.py

# Command-line mode
python tinfoleak.py -u target_username
```

**Configuration:**
1. **Twitter API Credentials Required:**
   - Register for Twitter Developer Account: https://developer.twitter.com/
   - Create an App to get API credentials
   - Edit `tinfoleak.conf`:
     ```
     [Twitter OAuth]
     consumer_key = YOUR_CONSUMER_KEY
     consumer_secret = YOUR_CONSUMER_SECRET
     access_token = YOUR_ACCESS_TOKEN
     access_secret = YOUR_ACCESS_SECRET
     ```

2. **Output Reports:**
   - Reports saved to `Output_Reports/` directory
   - HTML reports with visualizations
   - Can export to CSV/JSON

**Known Limitations:**
- **Twitter API Changes:** Twitter/X has severely restricted free API access as of 2023
- **API Costs:** Most functionality now requires paid Twitter API tiers
- **Rate Limits:** Even with API access, strict rate limits apply
- **Legacy Tool:** May not work with current Twitter/X API without modifications
- **Python Warnings:** Has deprecation warnings due to legacy code (still functional)
- Consider this tool **limited functionality** until API access is configured

**Status:** ✅ Installed and tested - requires Twitter API credentials for use

---

## 🔧 Installation Summary

**Date Installed:** 2025-11-11

**Python Environment:** Python 3.14 Virtual Environment (`osint-venv/`)

**Installation Commands Used:**
```bash
# 1. Create osint-tools directory
mkdir -p OsintTools/

# 2. Create Python 3.14 virtual environment
cd OsintTools
/opt/homebrew/bin/python3 -m venv osint-venv
source osint-venv/bin/activate

# 3. Install Sherlock
cd OsintTools
git clone https://github.com/sherlock-project/sherlock.git
cd sherlock
pip install -e .

# 4. Install Osintgram
cd OsintTools
git clone https://github.com/Datalux/Osintgram.git
cd Osintgram
pip install -r requirements.txt

# 5. Install Tinfoleak
cd OsintTools
git clone https://github.com/vaguileradiaz/tinfoleak.git
pip install tweepy pillow exifread jinja2 oauth2
```

**Verification:**
- ✅ Sherlock v0.16.0 tested successfully
- ✅ Osintgram --help verified
- ✅ Tinfoleak invocation tested
- ✅ All dependencies installed in virtual environment

---

## 🚀 Quick Start Guide

### First Time Setup Checklist

1. **Virtual Environment:**
   - ✅ Python 3.14 virtual environment created (`osint-venv/`)
   - ✅ All tools and dependencies installed
   - ℹ️ Always activate with: `source osint-venv/bin/activate`

2. **Sherlock:**
   - ✅ Installed and tested (v0.16.0)
   - ✅ Fully functional - ready to use
   - ℹ️ No API credentials required

3. **Osintgram:**
   - ✅ Dependencies installed and verified
   - ❌ **TODO:** Create `config/credentials.ini` with Instagram credentials
   - ❌ **TODO:** First authentication run
   - ⚠️ Use dedicated OSINT account, not personal

4. **Tinfoleak:**
   - ✅ Dependencies installed and tested
   - ❌ **TODO:** Register for Twitter Developer account
   - ❌ **TODO:** Configure `tinfoleak.conf` with API credentials
   - ⚠️ Note: May have limited functionality due to Twitter API restrictions

---

## 📖 Use Cases

**Username Reconnaissance:**
- Track usernames across multiple platforms (Sherlock)
- Build comprehensive digital footprint profiles
- Discover associated accounts and aliases

**Instagram Intelligence:**
- Profile public Instagram accounts (Osintgram)
- Analyze follower/following relationships
- Extract geolocation data from posts
- Identify patterns in posting behavior

**Twitter/X Analysis:**
- Analyze Twitter user behavior (Tinfoleak - if API access available)
- Extract tweet geolocation and metadata
- Map social connections and interactions
- Generate intelligence reports

---

## ⚠️ Security and Legal Considerations

**IMPORTANT:**
- These tools are for **authorized security assessments only**
- Obtain proper authorization before investigating accounts
- Respect platform Terms of Service
- Use dedicated OSINT accounts, not personal credentials
- Be aware of rate limits and account risks
- Some activities may violate platform policies
- Consult legal counsel for compliance requirements

**Best Practices:**
- Use VPN or proxy for anonymity when appropriate
- Rotate credentials if accounts get flagged
- Document authorization for all investigations
- Store credentials securely (use environment variables or encrypted configs)
- Monitor for API changes that may break tools

---

## 🐛 Troubleshooting

**Virtual Environment Not Activated:**
```
ModuleNotFoundError: No module named 'X'
```
- **Solution:** Activate the virtual environment first
- Command: `source OsintTools/osint-venv/bin/activate`
- Verify activation: prompt should show `(osint-venv)`

**Sherlock Command Not Found:**
- **Solution:** Ensure virtual environment is activated
- Sherlock binary only available within the venv
- Use: `source osint-venv/bin/activate && sherlock username`

**Instagram "Challenge Required" Error:**
- **Solution:** Complete challenge in Instagram app, then retry with Osintgram
- May need to verify login from new device
- Consider using a fresh OSINT-dedicated Instagram account

**Twitter API "Unauthorized" Error:**
- **Solution:** Verify API credentials in `tinfoleak.conf`
- Check if Twitter API tier supports required endpoints
- Consider that free API access is extremely limited (likely requires paid tier)

**"Module Not Found" Despite Venv Activation:**
- **Solution:** Reinstall dependencies in the virtual environment
- `source osint-venv/bin/activate`
- `pip install --force-reinstall <package>`

---

## 📚 Additional Resources

**Sherlock:**
- GitHub: https://github.com/sherlock-project/sherlock
- Documentation: https://github.com/sherlock-project/sherlock#readme

**Osintgram:**
- GitHub: https://github.com/Datalux/Osintgram
- Documentation: https://github.com/Datalux/Osintgram/wiki

**Tinfoleak:**
- GitHub: https://github.com/vaguileradiaz/tinfoleak
- Paper: http://www.vicenteaguileradiaz.com/papers/ieeessp2016.pdf

---

## 🔄 Updates and Maintenance

**Updating Tools:**
```bash
# Activate virtual environment first
cd OsintTools
source osint-venv/bin/activate

# Update Sherlock
cd sherlock
git pull
pip install -e . --upgrade

# Update Osintgram
cd ../Osintgram
git pull
pip install -r requirements.txt --upgrade

# Update Tinfoleak
cd ../tinfoleak
git pull
# Dependencies rarely change, but you can:
pip install tweepy pillow exifread jinja2 oauth2 --upgrade
```

**Checking for Updates:**
- Monitor GitHub repositories for new releases
- Review changelogs for breaking changes
- Test updates in the virtual environment before deploying

---

## 📋 Integration with WebAssessment Skill

These tools are designed to be used by the PAI webassessment skill for social media reconnaissance during security assessments. The skill can:

1. Run Sherlock to enumerate usernames across platforms
2. Analyze Instagram profiles for location and relationship data (when configured)
3. Generate Twitter/X intelligence reports (when API access available)
4. Integrate findings into comprehensive security reports

**Workflow Integration:**
- Tools available via `osint-tools/` directory in webassessment skill
- Can be called programmatically or via command-line
- Results can be parsed and integrated into assessment reports
- Supports automation and scripting for large-scale investigations

---

**Last Updated:** 2025-11-11 by Engineer Agent (Forge)
