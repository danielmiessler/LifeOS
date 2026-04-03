# Browser Extension Security Analysis Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ExtractBrowserExtension workflow in the Parser skill to analyze extensions"}' \
  > /dev/null 2>&1 &
```

Running the **ExtractBrowserExtension** workflow in the **Parser** skill to analyze browser extensions...

**Purpose:** Analyze browser extensions for security risks, clone detection, and malicious patterns

**When to Use:**
- Security assessment of unknown extensions
- Incident response involving browser-based malware
- Vetting extensions before enterprise deployment
- Analyzing suspicious "Click Fix" or "Crash Fix" style attacks

---

## Extraction Steps

### 1. Extension Acquisition

**For Chrome Web Store extensions:**
```bash
# Get CRX from Chrome Web Store
# Extension ID is the last part of the store URL
EXTENSION_ID="abcdefghijklmnop"
CRX_URL="https://clients2.google.com/service/update2/crx?response=redirect&prodversion=49.0&acceptformat=crx3&x=id%3D${EXTENSION_ID}%26installsource%3Dondemand%26uc"

curl -L -o extension.crx "$CRX_URL"
```

**For local/sideloaded extensions:**
```bash
# Chrome extensions directory
~/.config/google-chrome/Default/Extensions/

# Extract from CRX (it's a ZIP with extra header)
unzip extension.crx -d extension_unpacked/
```

---

### 2. Manifest Analysis

**Parse manifest.json for red flags:**

```json
{
  "manifest_version": 3,
  "permissions": ["<all_urls>", "clipboardWrite", "clipboardRead"],
  "host_permissions": ["*://*/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

**High-Risk Permission Indicators:**

| Permission | Risk Level | Why |
|------------|------------|-----|
| `<all_urls>` | HIGH | Access to all websites |
| `clipboardWrite/Read` | HIGH | Clipboard manipulation (Click Fix) |
| `tabs` | MEDIUM | Tab enumeration |
| `webRequest` | HIGH | Intercept/modify traffic |
| `nativeMessaging` | HIGH | Communicate with native apps |
| `management` | HIGH | Control other extensions |
| `debugger` | CRITICAL | Debug other tabs |

---

### 3. Clone Detection

**Compare against known legitimate extensions:**

```bash
# Download known-good version
# For example, uBlock Origin Light
git clone https://github.com/AykutSarac/ublock-origin-lite.git legitimate/

# Diff against suspect
diff -r suspect_extension/ legitimate/

# Key indicators:
# - Brand name replacements ("uBlock" -> "NextShield")
# - Broken URLs from find/replace
# - Additional JS files not in original
# - Modified permissions in manifest
```

**Clone Detection Checklist:**
- [ ] Compare file structure to claimed origin extension
- [ ] Check for find/replace artifacts in comments/URLs
- [ ] Verify manifest permissions match original
- [ ] Look for additional obfuscated files
- [ ] Check author/publisher information

---

### 4. Alarms API Analysis

**Detect delayed execution (evasion technique):**

```bash
# Search for Chrome Alarms usage
grep -r "chrome.alarms" extension_unpacked/

# Red flag patterns:
# - delayInMinutes > 30 (decoupling from install)
# - periodInMinutes with network callbacks
```

**Example malicious pattern:**
```javascript
// SUSPICIOUS: 60-minute delay then 10-minute intervals
chrome.alarms.create('update', {
  delayInMinutes: 60,
  periodInMinutes: 10
});

chrome.alarms.onAlarm.addListener((alarm) => {
  // Malicious activity starts HERE, long after install
  checkCommand();
});
```

---

### 5. Background Script Analysis

**Analyze service worker/background scripts:**

```bash
# Deobfuscate if needed
npm install -g js-beautify
js-beautify background.js > background_pretty.js

# Search for indicators
grep -E "(clipboard|fetch|XMLHttpRequest|eval|atob|fromCharCode)" background_pretty.js
```

**Malicious Indicators:**
- Clipboard manipulation (`navigator.clipboard.writeText`)
- Obfuscated strings (`atob`, `String.fromCharCode`)
- External C2 connections (`fetch` to unknown domains)
- `eval()` or `new Function()` execution
- DOM manipulation on all pages

---

### 6. Network Analysis

**Identify C2 domains and external connections:**

```bash
# Extract all URLs/domains from extension
grep -rhoE 'https?://[^"'\''>\s]+' extension_unpacked/ | sort -u

# Check domains against threat intel
# - VirusTotal
# - URLhaus
# - AbuseIPDB
```

**C2 Indicators:**
- Newly registered domains (< 30 days)
- DGA-looking domains
- IP addresses instead of domains
- Base64/encoded URLs
- POST requests with system info

---

### 7. Content Script Analysis

**Check what runs on web pages:**

```bash
# Find content scripts
grep -l "content_scripts" manifest.json
cat manifest.json | jq '.content_scripts'

# Analyze injection patterns
grep -E "(keylogger|password|credit|ssn|inject)" content.js
```

**Risk Patterns:**
- Form field interception
- Keyboard event listeners
- DOM modification
- Screenshot capabilities
- Cookie theft

---

### 8. Fingerprinting Detection

**Check for environment fingerprinting:**

```bash
# Search for system enumeration
grep -E "(navigator|screen|platform|userAgent|plugins)" extension_unpacked/*.js
```

**Targeting Indicators (from Crash Fix):**
```javascript
// Corporate vs consumer targeting
(Get-WmiObject -Class Win32_ComputerSystem).PartOfDomain
[System.DirectoryServices.ActiveDirectory.Domain]::GetCurrentDomain()

// Malware checks these to serve different payloads:
// - Domain-joined = corporate = high-value target
// - Standalone = consumer = lower priority
```

---

### 9. Schema Population

**Output security analysis:**

```json
{
  "extension": {
    "id": "extension-id",
    "name": "Claimed Name",
    "version": "1.0.0",
    "analysis_date": "2026-01-23"
  },
  "security_assessment": {
    "risk_level": "HIGH|MEDIUM|LOW|CRITICAL",
    "is_clone": true,
    "clone_of": "uBlock Origin Light",
    "confidence": 0.95
  },
  "indicators": {
    "permissions": {
      "high_risk": ["<all_urls>", "clipboardWrite"],
      "medium_risk": ["tabs"]
    },
    "evasion_techniques": [
      "Chrome Alarms delay (60 min)",
      "Obfuscated code"
    ],
    "c2_domains": [
      "malicious-domain.com"
    ],
    "lotl_binaries": [
      "finger.exe"
    ]
  },
  "recommendations": [
    "Remove extension immediately",
    "Check clipboard for malicious content",
    "Monitor for persistence mechanisms"
  ]
}
```

---

## Error Handling

**Extension not available:**
- Log error: "Extension not found or removed from store"
- Check Wayback Machine for cached version
- Note: Removal may indicate detection

**Obfuscated code:**
- Attempt deobfuscation with js-beautify
- Use AST analysis for complex obfuscation
- Lower confidence score if analysis incomplete

**Manifest V3 restrictions:**
- Service workers instead of background pages
- Note: Some malicious capabilities limited in V3
- Still check for workarounds

---

## Output Example

**Malicious extension detected:**
```
CRITICAL: Malicious browser extension detected

Extension: "NextShield Ad Blocker" v1.2.3
Clone Of: uBlock Origin Light (95% code match)

Risk Level: CRITICAL

Indicators Found:
- Clone of legitimate extension with brand replacement
- Chrome Alarms delay: 60 minutes (evasion)
- Clipboard manipulation capability
- C2 domain: malicious-server[.]com
- Targets domain-joined machines (corporate targeting)

Attack Chain: "Crash Fix" variant
1. User installs fake extension
2. 60-minute delay before activation
3. Simulates browser crash
4. Injects payload into clipboard
5. Social engineers Win+R, Ctrl+V execution
6. Uses finger.exe for C2 communication

Recommendations:
1. Remove extension immediately
2. Clear clipboard
3. Check for persistence (scheduled tasks, registry)
4. Review browsing history during delay period
5. Report to Chrome Web Store
```

---

## Related Workflows

- **EntityLookup** - For C2 domain investigation
- **LOTLBinaries.md** - For LOTL technique reference

---

**Last Updated:** 2026-01-23
**Source:** Matt Johansen security research, Huntress "Crash Fix" analysis
