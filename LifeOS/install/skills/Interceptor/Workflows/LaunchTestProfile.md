# LaunchTestProfile

Open Chrome's dedicated non-default profile in its own window for Interceptor live testing. Same Chrome installation, same root cert store, **separate cookie jar / separate tabs / separate window**. The profile is signed into the operator's accounts so live testing of authenticated tooling works — but lives in a completely different window from the operator's Default-profile work.

## When to use

- Any live-testing command (VerifyDeploy, Reproduce, TestForm, ReadAndExtract, RecordFlow, MultiPageCompare, OverrideXhr) that touches a page.
- Default for everything the agent does in a browser.
- Especially anything that needs to be signed in to the operator's services (blog admin, Cloudflare dashboard, Gmail, GitHub, your admin dashboards, etc.) — that's why this isn't a `--user-data-dir` sandbox.

## Why not a `--user-data-dir` sandbox

A `--user-data-dir=<fresh>` sandbox is a Chrome installation with zero auth — you'd be a useless tester because you can't reach any of the operator's signed-in services. The correct isolation is **separate Chrome profile inside the same user-data-dir**: separate cookies, separate tabs, separate window, but the operator signs the profile into their accounts once so sessions persist.

## One-Time Setup (operator action)

### 1. Create the test profile in Chrome

In the operator's main Chrome window:

1. Click the **avatar/profile picture in the top-right corner**.
2. Click **"Add"** (or **"+ Add Profile"** depending on Chrome version).
3. Choose **"Sign in"** (recommended — pulls bookmarks/extensions automatically) or **"Continue without an account"**.
4. Name it something obvious: `{{DA_NAME}}`, `Interceptor-Test`, or similar.
5. Pick an avatar so the window's clearly distinguishable from the Default one.

Chrome creates a new profile directory inside the existing user-data-dir, typically named `Profile 1` (or `Profile 2` if `Profile 1` already exists). You can confirm the directory name by reading `~/Library/Application Support/Google/Chrome/Local State` and looking at `profile.info_cache` — each profile entry's key is its directory name.

### 2. Sign the profile into the operator's accounts

In the new profile window:

- Sign into Google with the operator's account (or a delegated account that has access to whatever you need to test).
- Sign into other services the agent will be verifying: GitHub, Cloudflare, Substack, Beehiiv, blog admin, your admin dashboards, etc.
- 2FA each one once — sessions persist in this profile thereafter.

This is the **one-time auth tax**. After this, the agent's testing has the same access as the operator's Default profile, without ever opening tabs there.

### 3. Load the Interceptor extension into this profile

In the new profile window:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select `{{LIFEOS_ROOT}}/skills/Interceptor/Extension` — a **pinned copy** (not a symlink) of upstream `extension/dist`, captured by `Tools/Pin.sh`; provenance in `Extension/PINNED_FROM.txt`. Chrome disables unpacked extensions on every manifest bump, so re-pin and reload after any binary upgrade — the copy does NOT auto-follow upstream.
5. Confirm the Interceptor card appears in this profile.

The extension's deterministic `key` field means the extension ID matches the one already in the Default profile — that's fine; the daemon allowlist already includes it.

### 4. Name the context

Click the Interceptor toolbar icon in the new profile window. Set **Context ID** to:

```
interceptor-test
```

Save. The daemon now sees this connection as `interceptor-test` and routes commands with `--context interceptor-test` to this window.

### 5. (If your profile dir isn't the configured one)

Set the directory name in `preferences.env` — the single canonical home for it. Do NOT write it to `~/.zshrc` (that creates a second, unsynced source of truth the launcher and preflight can disagree with):

```bash
# Edit {{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env:
#   export INTERCEPTOR_TEST_CHROME_PROFILE="Profile 4"   # whichever profile dir Chrome made
```

Or set it inline for a one-off launch (still keep `preferences.env` authoritative for daily use):

```bash
INTERCEPTOR_TEST_CHROME_PROFILE="Profile 4" bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/LaunchTestProfile.sh"
```

### 6. Verify (via the canonical preflight)

The single verification step is the **Preflight Isolation Gate**. It checks binary version, daemon connection, and context registration in one shot — anything that would let a browser command leak into the Default profile.

```bash
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/LaunchTestProfile.sh" "https://example.com"
# A new Chrome window opens for the test profile, navigates to example.com.

bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/PreflightIsolation.sh"
# Expect:
#   [PreflightIsolation] OK — interceptor 0.16.9, context "<pinned-id>" connected.
```

If the preflight fails, read the structured remediation message it prints and address that exact failure mode (extension not loaded, context ID not set, binary too old, daemon not connected). Do not proceed to live browser commands until the preflight returns exit 0.

```bash
# Only after preflight passes (source preferences.env so $INTERCEPTOR_TEST_CONTEXT_ID resolves):
source "${LIFEOS_DIR}/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"
interceptor open "https://example.com" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
# Lands in the test profile's window only.
```

## Daily Operation

After the one-time setup, every session starts with the preflight gate. It runs as the very first browser-touching step — for read-only public-page fetches, authenticated tooling verification, screenshots, everything.

```bash
# Operator launches the test window once per session (or leaves it running)
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/LaunchTestProfile.sh"

# Agent's first action before any browser command:
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/PreflightIsolation.sh" \
  || { echo "Preflight failed — STOP and surface to operator. Do not fall back."; exit 1; }

# Only after the preflight returns exit 0 (preferences.env sourced for $INTERCEPTOR_TEST_CONTEXT_ID):
interceptor open "https://example.com" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor read --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor act e5 --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor inspect --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

The launcher uses `open -a` (no `-n` flag), which delegates to the existing Chrome process. Chrome opens a new window for the requested profile.

## Standing Behavior (agent-side rule)

Once the test profile is set up and pinned:

- **All live-testing commands route via `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` by default.** Every `open`, `read`, `act`, `inspect`, `monitor start`, `tab new`, `navigate`. Screenshots go through `Tools/Capture.sh`. The pinned ID lives in `preferences.env`; the literal `interceptor-test` friendly name only resolves once it's set in the extension popup.
- **The operator's Default profile is read-only.** The agent never opens a tab, clicks, types, navigates, or records in the Default profile unless the operator explicitly says so ("verify in my Default profile", "use the main window").
- **If the pinned context is not connected** (test window closed, UUID rot), the agent surfaces the preflight remediation and stops — never falls back to Default silently. A missing pinned context is a hard stop, not a fallback.
- **Multi-context safety net.** With 2+ contexts connected, bare commands (no `--context`) hard-error. That fail-fast is a structural backstop, not the primary safety mechanism — the primary is passing the pinned `--context` on every verb. With one context left, a bare command silently auto-routes to whatever remains, including Default — which is exactly why `--context` is mandatory, not optional.

## Pitfalls

- **Don't use `--user-data-dir` here.** That gives you a fully-sandboxed Chrome with no auth, which is useless for testing the operator's authenticated tooling. The right boundary is profile, not user-data-dir.
- **Extension reload after a bump.** The `{{LIFEOS_ROOT}}/skills/Interceptor/Extension/` copy is pinned, not a symlink — after any binary upgrade, re-pin via `Tools/Pin.sh` (per the Update workflow), then Load Unpacked again in **both** profiles (Default + test). Chrome disables unpacked extensions on every manifest version bump and never auto-refreshes them.
- **Context ID must be unique.** Two contexts named `interceptor-test` makes `--context` routing ambiguous. One test profile per context name.
- **Profile dir name confusion.** Chrome names the on-disk directories `Profile 1`, `Profile 2`, … even though you give the profile a friendly name like "{{DA_NAME}}". The launcher needs the on-disk name (default `Profile 1`); override via `INTERCEPTOR_TEST_CHROME_PROFILE` if needed.
- **Lock conflict if you force `-n`.** Don't add `-n` (new instance) to the `open` command — two Chrome processes can't share the same user-data-dir. The launcher relies on the existing Chrome handling `--profile-directory` natively.
- **Sign-in cookies expire.** Re-sign-in periodically. If a command fails with a 401/302-to-login, re-auth in the test profile and continue.

## Output format

Report:
- Whether the test profile window appeared (PID, profile dir)
- Whether `interceptor contexts` shows `interceptor-test`
- Whether the first `open --context interceptor-test` returned tree + text
- If anything failed: the exact mode (profile not created yet, extension not loaded, context name not set, daemon doesn't see it)
