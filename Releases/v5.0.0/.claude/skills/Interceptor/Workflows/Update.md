# Update Workflow

---

Rebuild interceptor from latest source and verify the full pipeline.

## When to Use

- After pulling new commits from slop-browser repo
- If interceptor commands fail unexpectedly
- Periodic capability check

## Steps

### 1. Pull Latest

```bash
cd ~/Projects/interceptor && git fetch origin && git status -uno
```

If upstream force-pushed (common with this repo), `git pull` will refuse. Check
for local modifications first (`git status`), preserve any patches by hand, then:

```bash
cd ~/Projects/interceptor && git reset --hard origin/main
```

### 2. Install New Dependencies

```bash
cd ~/Projects/interceptor && bun install
```

Always run before build — upstream may add deps (e.g. `ocrad.js` for canvas OCR
arrived in v0.8.0). Build will fail with "Could not resolve" otherwise.

### 3. Build

```bash
cd ~/Projects/interceptor && bash scripts/build.sh
```

Produces:
- `dist/interceptor` — CLI
- `daemon/interceptor-daemon` — native messaging host
- `extension/dist/` — Chrome extension (manifest reflects upstream version)
- `dist/interceptor-bridge` — Swift binary for OS-level input simulation (macOS only, optional)

### 4. Install Binaries

```bash
cp ~/Projects/interceptor/dist/interceptor /opt/homebrew/bin/
cp ~/Projects/interceptor/daemon/interceptor-daemon /opt/homebrew/bin/
```

### 5. Re-register Native Messaging

```bash
cd ~/Projects/interceptor && bash scripts/install.sh --chrome --skip-extension
```

`--skip-extension` is the right path for Chrome — branded Chrome ignores
`--load-extension` anyway, and the extension reload is a manual step (see
"Extension Reload" below). The script regenerates
`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.interceptor.host.json`
with the current allowed extension IDs.

### 6. (Optional) Bridge — macOS Native Helper App

The bridge is the macOS-native helper that gives Interceptor capabilities the
Chrome extension cannot provide on its own. Documented end-to-end here so the
skill owns the full lifecycle — install, verify, security model, troubleshoot,
uninstall — without referencing the upstream README.

**What it adds (35 actions across 23 domains):** OS-level synthetic input
(`act --os` keystrokes/mouse/scroll/drag), accessibility tree of native macOS
apps, app control, screen capture beyond Chrome, clipboard read/write, audio
listen + speech recognition, file ops, system notifications, vision, NLP,
Apple Intelligence, HealthKit access, display info, monitor (event subscription).

**Skip the bridge entirely if** all you do is in-page web automation — the
extension covers ~95% of typical work without it.

#### 6a. Install (use this procedure, not upstream `install-bridge.sh`)

The upstream script breaks on Apple Silicon: `/usr/local/bin` requires sudo,
but invoking the whole script with sudo makes `launchctl bootstrap "gui/$(id -u)"`
target uid 0 instead of the user. Three commands handle it correctly:

```bash
# 1. Binary into /usr/local/bin (needs sudo — root:wheel 755)
sudo cp ~/Projects/interceptor/dist/interceptor-bridge /usr/local/bin/interceptor-bridge
sudo chmod +x /usr/local/bin/interceptor-bridge

# 2. Write LaunchAgent plist into $HOME (no sudo)
cat > ~/Library/LaunchAgents/com.interceptor.bridge.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.interceptor.bridge</string>
    <key>ProgramArguments</key><array><string>/usr/local/bin/interceptor-bridge</string></array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
    <key>StandardOutPath</key><string>/tmp/interceptor-bridge.stdout.log</string>
    <key>StandardErrorPath</key><string>/tmp/interceptor-bridge.stderr.log</string>
    <key>ThrottleInterval</key><integer>5</integer>
</dict>
</plist>
PLIST

# 3. Load it as the user (no sudo — uid is captured at script-call time)
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.interceptor.bridge.plist
```

`launchctl bootstrap` exits 1 on success (its diagnostic output is on stderr) —
that's fine; verify with the next step.

#### 6b. Verify

```bash
launchctl list | grep com.interceptor.bridge   # → expect: <PID>  0  com.interceptor.bridge
ls -la /tmp/interceptor-bridge.sock            # → expect: srwxr-xr-x <user> staff
interceptor status                              # → expect: bridge: running with pid + socket
```

If `interceptor status` shows `bridge: not running` despite launchctl listing
the agent, the helper crashed on startup — check `/tmp/interceptor-bridge.stderr.log`.

#### 6c. Security model — read this before you install

Honest disclosure, not reassurance:

- **Transport is a UNIX domain socket** at `/tmp/interceptor-bridge.sock` — local
  only, no network listener. Cannot be reached from another machine.
- **There is ZERO authentication on the socket.** `Transport.swift` accepts any
  client connection and processes any framed JSON payload. The socket is created
  with mode `755` (the default umask result), meaning **any local process — your
  shell scripts, any installed app, anything you run as your user — can connect
  and execute every bridge action.**
- **Action surface includes:** synthetic keystrokes/mouse, screenshots, clipboard
  read/write, audio capture/listen, file ops, system notifications, accessibility
  tree of every running app. macOS will prompt for Accessibility / Input
  Monitoring / Screen Recording / Microphone the first time those are exercised;
  once granted, every client of the socket inherits them.
- **Threat model on a single-user Mac:** anything running as you can already
  keylog you and read your clipboard with sufficient effort. The bridge makes
  this scriptable from anything that can write to `/tmp`. The marginal risk is
  supply-chain — a malicious package installed by `bun`, `brew`, or `npm` no
  longer needs its own Accessibility grant; the bridge has the grants for it.
- **Multi-user Macs:** the socket's `o+rx` bit means other local users can
  connect. If this matters, harden by either (a) running the bridge with a
  restrictive umask, or (b) adding a `chmod 700` of the socket as a post-start
  hook in the plist. the principal's Mac is single-user; not addressed here.
- **Binary provenance:** built locally from the slop-browser source we just
  pulled. Not a downloaded prebuilt — provenance is the Swift source under
  `~/Projects/interceptor/interceptor-bridge/Sources/`.

#### 6d. Troubleshoot

| Symptom | Cause | Fix |
|---------|-------|-----|
| `launchctl bootstrap` says "service already loaded" | Prior install lingering | `launchctl bootout "gui/$(id -u)/com.interceptor.bridge"` then re-bootstrap |
| `interceptor status` shows bridge not running | First-action TCC prompt blocked | Trigger any `act --os` once, accept macOS prompts in System Settings → Privacy & Security |
| Socket exists but writes fail | macOS quarantine on the binary | `xattr -d com.apple.quarantine /usr/local/bin/interceptor-bridge` |
| Bridge restart-loops every ~5s | Crash on launch | `tail /tmp/interceptor-bridge.stderr.log`; usually missing entitlement or unsigned-binary block |

#### 6e. Uninstall

```bash
launchctl bootout "gui/$(id -u)/com.interceptor.bridge"
rm ~/Library/LaunchAgents/com.interceptor.bridge.plist
sudo rm /usr/local/bin/interceptor-bridge
rm -f /tmp/interceptor-bridge.sock /tmp/interceptor-bridge.pid
rm -f /tmp/interceptor-bridge.stdout.log /tmp/interceptor-bridge.stderr.log
```

Optional: revoke macOS permissions in System Settings → Privacy & Security
(Accessibility, Input Monitoring, Screen Recording, Microphone, etc.) by
removing the `interceptor-bridge` entry from each list.

### 7. Extension Reload (manual — Chrome won't auto-refresh unpacked extensions)

If `extension/dist/manifest.json` changed (especially `version` or `key`):

1. Open `chrome://extensions`, enable Developer Mode
2. **Delete** the existing Interceptor card (don't just hit reload — if the
   manifest `key` changed, the extension ID changed and the old card is dead)
3. **Load unpacked** → `~/Projects/interceptor/extension/dist`
4. Quit Chrome fully (⌘Q, not just close window) and relaunch — service worker
   needs a clean restart, especially with `userScripts` permission added
5. Accept any new permission prompts (e.g. `userScripts`)

If only JS/HTML inside `extension/dist/` changed (no manifest changes),
clicking the reload arrow on the existing card is enough.

### 8. Verify

```bash
interceptor status
interceptor open "https://example.com"
```

`status` reports both `daemon` and `bridge` lines (bridge shows "not running"
if you skipped step 6 — that's fine). `open` should return tree + extracted text.

## Notes

- Native messaging manifest's `allowed_origins` is regenerated by `install.sh` —
  the current build allows three extension IDs including the keyed
  `hkjbaciefhhgekldhncknbjkofbpenng` (the deterministic ID baked in by
  `extension/manifest.json`'s `key` field).
- Force-push from upstream is normal — `slop-browser` rewrites main on releases
  (v0.5.0 → v0.8.0 was a single force-push touching 155 files).
- Watch `extension/src/content/data/extract.ts` — the body/HTML extract limits
  default to 10K/10K/50K. We patch them to 10M to support large-page reads;
  re-apply after each upstream pull.
