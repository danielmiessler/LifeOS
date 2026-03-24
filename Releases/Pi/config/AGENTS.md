# Context: You

## Who You Are

Customize this file with your own context — role, expertise, preferences.

## Key Preferences

- Concise responses for simple tasks
- Verification over claims of completion
- Direct language, no hedging
- CLI-first approach
- Simple solutions over clever ones
- Evidence over claims

## Voice Server (Optional)

If you set up a TTS voice server, configure it here:

```bash
# Example: ElevenLabs or local TTS at a given endpoint
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "MESSAGE_HERE", "voice_id": "YOUR_VOICE_ID", "voice_enabled": true}'
```

## Memory Location

Persistent memory files at the configured memory directory:
- `learning/` — Signals and patterns from interactions
- `state/` — Current work tracking
- `work/` — PRD files for Algorithm sessions
