# Update Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Update workflow in the Interceptor skill to rebuild interceptor"}' \
  > /dev/null 2>&1 &
```

Running **Update** in **Interceptor**...

---

Rebuild interceptor from latest source and verify the full pipeline. Defaults to **full Computer Use** install (CLI + daemon + Chrome extension + macOS bridge); pass `--browser-only` mode where noted to skip the bridge.

## When to Use

- After pulling new commits from upstream
- First-time install on a fresh machine
- If interceptor commands fail unexpectedly
- Periodic capability check
- Promoting `--browser-only` → `--full`

## Install Modes (v0.9.0+)

| Channel | Result |
|---------|--------|
| `Interceptor-Browser-<v>.pkg` (signed installer) | `mode: browser-only` |
| `Interceptor-Full-<v>.pkg` (signed installer) | `mode: full` |
| `bash scripts/install.sh --browser-only` (dev path) | `mode: browser-only` |
| `bash scripts/install.sh --full` (dev path) | `mode: full` |
| `interceptor upgrade --full` | Promote any browser-only install to full |

Mode is recorded in `~/.config/interceptor/config.toml`. `interceptor status` echoes the active `mode:` line. As of v0.13.4, browser-only also supports Microsoft Edge + Vivaldi and Linux hosts.

## Steps

### 1. Pull Latest

```bash
cd ~/Projects/interceptor && git fetch origin && git status -uno
```

If you have local diffs, stash before pulling:

```bash
cd ~/Projects/interceptor && \
  git stash push -m "kai-local patches" -- '<paths>' && \
  git pull --ff-only origin main && \
  git stash pop
```

**Note (v0.13.0+):** the historical 10M-slice patch on `extension/src/content/data/extract.ts` is obsolete. Upstream rewrote extract to use `withTruncationMarker` + per-action `maxChars` + a `--full` flag (200 K cap when set). The new behavior is more correct than the old hard slice — `read` now appends `... (truncated: showed X of Y chars ...)` when capped, and `read --full` widens to 200 K. Drop the local patch if it's still in your stash.

If upstream force-pushed (rarer now post-v0.10), inspect what would be lost, then:

```bash
cd ~/Projects/interceptor && git reset --hard origin/main
```

### 2. Install Dependencies

```bash
cd ~/Projects/interceptor && bun install
```

Always run before build — upstream may add deps. Build fails with "Could not resolve" otherwise.

### 3. Build

```bash
cd ~/Projects/interceptor && bun run build       # or: bash scripts/build.sh
```

Produces:
- `dist/interceptor` — CLI
- `daemon/interceptor-daemon` — native messaging host
- `extension/dist/` — Chrome extension (manifest reflects upstream version)
- `dist/interceptor-bridge` — bare Swift binary (macOS only, full mode)
- `dist/interceptor-bridge.app` — `.app` bundle with Sparkle.framework embedded

### 4. Install Binaries

```bash
cp ~/Projects/interceptor/dist/interceptor /opt/homebrew/bin/
cp ~/Projects/interceptor/daemon/interceptor-daemon /opt/homebrew/bin/
```

### 4a. Pin the Extension into the skill

`$LIFEOS_ROOT/skills/Interceptor/Extension/` is a **pinned copy** of the built `extension/dist/`, not a symlink. Two reasons: Chrome disables unpacked extensions on every manifest version bump (a stable copy survives that), and the public LifeOS release ships this skill — a symlink to a local build dir is useless to other users.

Re-pin after every build:

```bash
bash $LIFEOS_ROOT/skills/Interceptor/Tools/Pin.sh
```

`Pin.sh` rsyncs `dist/` → `Extension/`, **scrubs absolute home paths** that esbuild bakes into bundled JS (the `__dirname` literal in CommonJS wrappers → `"."`), regenerates `PINNED_FROM.txt` with a relative source path, and exits non-zero if any absolute home path survives. Set `INTERCEPTOR_SRC` to override the source repo location.

### 5. Re-register Native Messaging

```bash
cd ~/Projects/interceptor && bash scripts/install.sh --chrome --skip-extension
```

`--skip-extension` is the right path for Chrome — branded Chrome ignores `--load-extension` and the extension reload is a manual step (see "Extension Reload" below). The script regenerates `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.interceptor.host.json` with the current allowed extension IDs.

### 6. Bridge — macOS Native Helper (Computer Use)

**Required for `--full` mode.** Skip only when explicitly running `--browser-only`. The bridge unlocks Computer Use: OS-level trusted input, native app control via the accessibility tree, ScreenCaptureKit, Vision OCR, Speech, NLP, Apple Events, OSLogStore, file watching, **VM lifecycle**, container runtime.

#### 6a. Install (Apple-Silicon-correct sequence — `.app`-bundle topology)

The LaunchAgent that actually runs on this machine points at the **`.app`-bundle** binary, NOT a bare copy in `/usr/local/bin`:

```
ProgramArguments[0] = ~/.local/share/interceptor/interceptor-bridge.app/Contents/MacOS/interceptor-bridge
```

The signed-`.pkg` install path lands the `.app` bundle there (Sparkle.framework embedded in `Contents/Frameworks/`, no separate `/usr/local/Frameworks` copy needed). The old `/usr/local/bin/interceptor-bridge` copy is **stale** — do not install it, do not point a plist at it, do not re-sign it. For a dev build, stage the freshly-built `.app` bundle into place instead:

```bash
# 1. Stage the .app bundle (no sudo — lives under $HOME)
mkdir -p ~/.local/share/interceptor
rm -rf ~/.local/share/interceptor/interceptor-bridge.app
cp -R ~/Projects/interceptor/dist/interceptor-bridge.app \
      ~/.local/share/interceptor/interceptor-bridge.app

# 2. Write LaunchAgent plist into $HOME (no sudo) — points at the .app MacOS binary
cat > ~/Library/LaunchAgents/com.interceptor.bridge.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.interceptor.bridge</string>
    <key>ProgramArguments</key><array><string>$HOME/.local/share/interceptor/interceptor-bridge.app/Contents/MacOS/interceptor-bridge</string></array>
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

`launchctl bootstrap` exits 1 on success — that's fine; verify with the next step.

If you SIGKILL the bridge and it restart-loops every ~5s (`ThrottleInterval`), the cause is a stale ad-hoc signature on the binary the agent actually runs. **Re-sign the `.app` MacOS binary** (`~/.local/share/interceptor/interceptor-bridge.app/Contents/MacOS/interceptor-bridge`), NOT the stale `/usr/local/bin` copy.

#### 6b. Verify — and detect/restart a dead bridge

"Loaded" ≠ "running". `launchctl list` showing the label only proves the agent is loaded; probe the actual process via `interceptor status`.

```bash
interceptor status | grep -A2 '^bridge:'          # running + pid/socket, or not running
launchctl print "gui/$(id -u)/com.interceptor.bridge" 2>&1 | grep -E 'state|program|pid'
ls -la /tmp/interceptor-bridge.sock               # → srwxr-xr-x <user> staff
```

Restart a loaded-but-dead bridge:

```bash
launchctl kickstart -k "gui/$(id -u)/com.interceptor.bridge"
```

`interceptor status --verbose` reports extension **reachability** only — it does NOT expose an extension-build version field, so don't try to key a freshness check off it. With 2+ contexts connected it will nag `not reachable — multiple extensions connected` even with `--context` passed; that's expected, not a failure.

If `interceptor status` shows `bridge: not running` despite `launchctl print` showing the agent loaded, the helper crashed on startup — check `/tmp/interceptor-bridge.stderr.log`, confirm the plist points at the `.app` MacOS binary (not the stale `/usr/local/bin` copy), then `kickstart -k`.

#### 6c. First-run config

```bash
interceptor init                       # Writes starter ~/.config/interceptor/config.toml
interceptor contexts                   # Lists connected browser contexts
interceptor macos trust                # Probes TCC grants for the bridge
interceptor macos trust --walkthrough  # Deep-links to System Settings for missing grants
```

#### 6d. Security model — read before installing

- **Transport is a UNIX domain socket** at `/tmp/interceptor-bridge.sock` — local only, no network listener.
- **No authentication on the socket.** Any local process running as your user can connect and execute every bridge action. macOS TCC permissions (Accessibility, Screen Recording, Microphone) are granted to the bridge once and inherited by every socket client. (The `trust` probe exposes exactly three keys — `accessibility`, `screenRecording`, `microphone` — there is no `inputMonitoring` field.)
- **Marginal risk is supply-chain:** a malicious local package gains a one-step path to OS-level input/screen/clipboard without needing its own permission grants.
- Single-user Mac threat model: acceptable. Multi-user Macs need socket hardening (chmod 700 of the socket as a post-start plist hook).
- **Binary provenance:** built locally from `~/Projects/interceptor/interceptor-bridge/Sources/`, ad-hoc signed for dev. v0.9.0+ ships a Developer-ID-signed `.pkg` for distribution — we build from source for fast iteration.

#### 6e. Troubleshoot

| Symptom | Cause | Fix |
|---------|-------|-----|
| `launchctl bootstrap` says "service already loaded" | Prior install lingering | `launchctl bootout "gui/$(id -u)/com.interceptor.bridge"` then re-bootstrap |
| `interceptor status` shows bridge not running | First-action TCC prompt blocked | Trigger any `act --trusted` once, accept macOS prompts in System Settings → Privacy & Security (Accessibility) |
| Socket exists but writes fail | macOS quarantine on the binary | `xattr -dr com.apple.quarantine ~/.local/share/interceptor/interceptor-bridge.app` |
| Bridge restart-loops every ~5s | Crash on launch | `tail /tmp/interceptor-bridge.stderr.log`; usually missing entitlement or a stale ad-hoc signature — re-sign the `.app` MacOS binary (`~/.local/share/interceptor/interceptor-bridge.app/Contents/MacOS/interceptor-bridge`), NOT the `/usr/local/bin` copy, then `launchctl kickstart -k "gui/$(id -u)/com.interceptor.bridge"` |
| `dyld[*]: Library not loaded: @rpath/Sparkle.framework/...` in stderr | Sparkle.framework missing | Run step 1b above, then `launchctl kickstart -k "gui/$(id -u)/com.interceptor.bridge"` |
| `setup_required: virtualization entitlement missing` on VM commands | Bridge needs `com.apple.security.virtualization` | Rebuild with `scripts/build-bridge.sh`; verify entitlement is present |
| `setup_required: bridge install location` on VM commands | Bridge installed under `~/Documents` or `~/Desktop` | Move bridge `.app` outside cloud-synced dirs |

#### 6f. Uninstall

```bash
launchctl bootout "gui/$(id -u)/com.interceptor.bridge"
rm ~/Library/LaunchAgents/com.interceptor.bridge.plist
rm -rf ~/.local/share/interceptor/interceptor-bridge.app   # the bundle the agent actually runs
sudo rm -f /usr/local/bin/interceptor-bridge               # remove the stale copy if a prior install left one
sudo rm -rf /usr/local/Frameworks/Sparkle.framework        # only if a prior install staged it here
rm -f /tmp/interceptor-bridge.sock /tmp/interceptor-bridge.pid
rm -f /tmp/interceptor-bridge.stdout.log /tmp/interceptor-bridge.stderr.log
```

Optional: revoke macOS permissions in System Settings → Privacy & Security (Accessibility, Screen Recording, Microphone) by removing the `interceptor-bridge` entry from each list.

### 7. Extension Reload (manual — Chrome won't auto-refresh unpacked extensions)

If `Extension/manifest.json` changed (especially `version` or `key`):

1. Open `chrome://extensions`, enable Developer Mode.
2. **Delete** the existing Interceptor card (don't just hit reload — if the manifest `key` changed, the extension ID changed and the old card is dead).
3. **Load unpacked** → `$LIFEOS_ROOT/skills/Interceptor/Extension` (a pinned copy of the built `extension/dist`, captured by `Tools/Pin.sh` — NOT a symlink; it does not auto-follow upstream, so it must be re-pinned after every build).
4. Quit Chrome fully (⌘Q, not just close window) and relaunch — service worker needs a clean restart, especially with `userScripts` permission added.
5. Accept any new permission prompts (`userScripts`, etc.).

If only JS/HTML inside the extension dir changed (no manifest changes), clicking the reload arrow on the existing card is enough.

### 8. Verify End-to-End

```bash
interceptor --version
interceptor status
interceptor status --verbose
interceptor contexts
interceptor diagnose --no-skills-hint    # 0.22.2+: daemon exec path, per-context probe, split-brain check
interceptor open "https://example.com"
```

`status` reports both `daemon` and `bridge` lines (bridge shows "not running" if you skipped step 6 — that's fine for `--browser-only`). `open` should return tree + extracted text. **`diagnose` is the new must-run check** — it prints the daemon's real exec path and flags a **binary split-brain** (Chrome spawns one daemon binary while the CLI talks to another). If it reports a mismatch, point the NMH manifest `path` at `/opt/homebrew/bin/interceptor-daemon` and `pkill -f interceptor-daemon`. See SKILL.md Gotchas for the full bridge-signing / iCloud / launchd-throttle recovery sequence.

## Notes

- **Force-push** from upstream is now rare (was common pre-v0.10). Plain `git pull --ff-only` works in most cases.
- **`AXEnhancedUserInterface` was removed** in v0.11+ — the bridge uses `AXManualAccessibility` exclusively for Electron wake-up. Stale guidance from old code that sets `AXEnhancedUserInterface` should be ignored.
- **Sparkle auto-update** (v0.10.0+) — the `.app` bundle includes Sparkle for in-place updates. The bridge polls upstream feed on launch.
- **VM lifecycle** (v0.13+) — requires `com.apple.security.virtualization` entitlement on the bridge. State lives under `~/Library/Application Support/Interceptor/vms/` (override with `--state-dir` or `INTERCEPTOR_VM_STATE_DIR`).
