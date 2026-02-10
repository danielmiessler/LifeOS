# PAI Voice Input — Verification Checklist

> **Status: Scaffolding Only (v0.1.0)**
>
> These checks are for future verification when the stubs are implemented.
> Currently, only the structure and type checks apply.

---

## Scaffolding Verification (Current)

- [ ] All 12 files exist in the pack directory
- [ ] `types.ts` exports all core interfaces (STTProvider, WakeWordDetector, HotkeyTrigger, VoiceInputConfig, TranscriptionResult)
- [ ] `provider.interface.ts` exports BaseSTTProvider and error classes
- [ ] Three provider stubs each implement STTProvider interface
- [ ] Two activation stubs implement their respective interfaces
- [ ] `server.stub.ts` documents all four endpoints
- [ ] `voice-input.example.json` is valid JSON matching VoiceInputConfig shape
- [ ] TypeScript compiles without errors: `bun run --bun tsc --noEmit src/VoiceInput/types.ts`

---

## Implementation Verification (Future)

When stubs are replaced with working code:

### Server
- [ ] Server starts on port 8889: `bun run src/VoiceInput/server.stub.ts`
- [ ] Health check responds: `curl http://localhost:8889/health` returns JSON with `status: "healthy"`
- [ ] Status endpoint works: `curl http://localhost:8889/status` shows provider and listening state

### STT Provider
- [ ] Selected provider initializes without errors
- [ ] `POST /start-listening` begins audio capture (mic LED activates)
- [ ] `POST /stop-listening` returns transcription with text and confidence
- [ ] Transcription accuracy is acceptable for technical speech

### Wake Word
- [ ] Wake word detector starts without errors
- [ ] Saying "Hey JAM" triggers the listening pipeline
- [ ] False positive rate is acceptably low (< 1 per hour of ambient audio)

### Hotkey
- [ ] Global hotkey (Fn+V) registers successfully
- [ ] Pressing hotkey triggers the listening pipeline
- [ ] Hotkey works regardless of focused application

### Integration
- [ ] Transcribed text successfully pipes into Claude Code
- [ ] Full loop works: speak → transcribe → Claude processes → Claude speaks response (via pai-voice-system)

### Bidirectional Voice Loop
- [ ] Voice output server (8888) and voice input server (8889) run simultaneously
- [ ] Speaking a question → transcription → Claude response → spoken answer
