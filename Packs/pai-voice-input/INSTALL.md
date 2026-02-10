# PAI Voice Input — Installation

> **Status: Scaffolding Only (v0.1.0)**
>
> This pack is not yet functional. The files contain interfaces, type definitions,
> and stub implementations that define the architecture for future development.
> This document describes what will be needed when the stubs are implemented.

---

## Future Prerequisites

When implementation is complete, this pack will require:

### Runtime
- **Bun** >= 1.0: `curl -fsSL https://bun.sh/install | bash`
- **macOS** 10.15+ (Catalina or later) for audio capture and speech APIs

### Microphone Access
- macOS will prompt for Microphone permission on first run
- Grant permission in: System Settings > Privacy & Security > Microphone

### Provider-Specific Dependencies

**Whisper (local, offline):**
- `whisper.cpp`: `brew install whisper-cpp`
- GGML model file: Download from [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp)
  - Recommended: `ggml-base.en.bin` (~142 MB) for English
  - Higher accuracy: `ggml-medium.en.bin` (~1.5 GB)
- `sox` for audio capture: `brew install sox`

**ElevenLabs (cloud):**
- ElevenLabs API key (same key used for TTS in pai-voice-system)
- Add to `~/.env`: `ELEVENLABS_API_KEY=your_key_here`
- `sox` for local audio capture: `brew install sox`

**macOS Dictation (system, zero-cost):**
- Speech Recognition permission: System Settings > Privacy & Security > Speech Recognition
- Swift toolchain for building the helper binary (included with Xcode or Xcode CLT)

### Wake Word (optional)
- Picovoice access key: Free at [console.picovoice.ai](https://console.picovoice.ai)
- Custom "Hey JAM" keyword model (trained at Picovoice console)

### Hotkey (optional)
- Accessibility permission: System Settings > Privacy & Security > Accessibility
- `node-global-key-listener`: `bun add node-global-key-listener`

---

## Future Installation Steps

When stubs are replaced with implementations:

1. Copy config: `cp src/config/voice-input.example.json ~/.claude/voice-input.json`
2. Install dependencies based on chosen provider (see above)
3. Start the voice input server: `bun run src/VoiceInput/server.stub.ts`
4. Test with: `curl http://localhost:8889/health`

---

## Current State

All files in `src/` are stubs with `TODO` comments and `throw new Error("not yet implemented")`. They define:

- Complete TypeScript interfaces for the STT provider contract
- Three provider stubs (Whisper, ElevenLabs, macOS Dictation)
- Two activation stubs (wake word, hotkey)
- Server skeleton with endpoint definitions
- Example configuration

These serve as a development foundation and feature specification.
