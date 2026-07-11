# Kokoro Voice Backend - private, local TTS (alternative to ElevenLabs)

LifeOS voice (`PULSE/VoiceServer/voice.ts`) ships with an ElevenLabs backend,
which sends the text of every notification to a cloud API and needs an API key.
This adds a **fully-local** alternative powered by [Kokoro](https://github.com/thewh1teagent/kokoro-onnx):
no API key, and no text or audio ever leaves the machine - a better fit for the
privacy posture many people want from a personal AI.

It also adds two small quality-of-life pieces built on the same state file: a
**live mute toggle** (bindable to a keyboard shortcut) and a **statusline
indicator** (🔊 / 🔇).

---

## How it works

`voice.ts` selects the backend from an env var, in `sendNotification()`:

```
LIFEOS_VOICE_BACKEND=kokoro   → POST http://127.0.0.1:$LIFEOS_KOKORO_PORT/speak   (local)
(unset / anything else)    → ElevenLabs (unchanged; requires elevenlabs_api_key)
```

The Kokoro path POSTs `{ text, voice }` to a small warm daemon
(`kokoro_server.py`) that keeps the model resident and synthesizes + plays the
audio locally, returning `200` on completion. If the daemon is down the request
errors and is logged - voice fails safe, everything else keeps working.

## Setup

1. **Install the Python deps and model files:**
   ```bash
   pip install kokoro-onnx soundfile
   # Download the model into $KOKORO_CACHE (default ~/.cache/lifeos-voice):
   #   kokoro-v0_19.onnx  and  voices.bin   (see the kokoro-onnx repo)
   ```
2. **Run the daemon** (keep it resident - a LaunchAgent on macOS, or a systemd
   user unit on Linux):
   ```bash
   python3 ~/.claude/LIFEOS/PULSE/VoiceServer/kokoro_server.py
   # GET /health → "ok"   POST /speak {"text":"hello"} → speaks
   ```
3. **Point LifeOS at it** by setting these in the Pulse process environment
   (e.g. the `com.lifeos.pulse` LaunchAgent's `EnvironmentVariables`, so the
   running Pulse process actually sees them):
   ```
   LIFEOS_VOICE_BACKEND=kokoro
   LIFEOS_KOKORO_VOICE=af_bella      # any Kokoro voice
   LIFEOS_KOKORO_PORT=7791
   ```
   Restart Pulse. `/notify` now speaks locally.

> Audio plays via `afplay` (macOS) by default. On Linux, set
> `LIFEOS_KOKORO_PLAYER=aplay` (or `paplay`) in the daemon's environment.

## Live mute toggle

`TOOLS/VoiceMute.ts` flips `PULSE/state/voice-mute.json`, which `voice.ts` reads
on **every** notification (no restart) and silences TTS while still returning
normally - desktop notifications are unaffected.

```bash
bun ~/.claude/LIFEOS/TOOLS/VoiceMute.ts toggle   # on | off | toggle | status
```

## Statusline indicator

`LIFEOS_StatusLine.sh` renders a speaker glyph next to the LifeOS header, read
live from the same state file: **🔊** audible / **🔇** muted.

## Optional: a keyboard shortcut (macOS, skhd)

Bind the toggle to a hotkey with [skhd](https://github.com/koekeishiya/skhd):

```
# ~/.config/skhd/skhdrc   (this path takes priority over ~/.skhdrc)
cmd + shift - m : /Users/<you>/.bun/bin/bun /Users/<you>/.claude/LIFEOS/TOOLS/VoiceMute.ts toggle
```

Gotchas worth knowing:
- **Use absolute paths** - skhd runs with a minimal `PATH` (no `~/.bun` or brew).
- **`~/.config/skhd/skhdrc` shadows `~/.skhdrc`** - if a hotkey seems to ignore
  your edits, you're probably editing the wrong file.
- **macOS "Secure Keyboard Entry"** (a checkbox in your terminal's app menu, not
  System Settings) blocks *all* hotkey daemons from capturing keys - turn it off
  if the binding never fires.
- Grant skhd **Accessibility** permission on first use.
