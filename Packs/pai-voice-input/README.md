---
name: PAI Voice Input
pack-id: hyggahacker-voice-input-core-v0.1.0
version: 0.1.0
author: HyggeHacker
description: Speech-to-text input system with abstracted STT providers and dual activation (wake word + hotkey) - the reverse direction of pai-voice-system
type: feature
purpose-type: [productivity, automation, integration]
platform: claude-code
dependencies: []
keywords: [voice, stt, speech, input, microphone, whisper, elevenlabs, dictation, wake-word, hotkey, hands-free, accessibility]
---

# PAI Voice Input

> Speech-to-text input system that lets you talk to your AI agent — using Whisper, ElevenLabs STT, or macOS Dictation with wake word and hotkey activation

## Installation Prompt

You are receiving a PAI Pack - a modular upgrade for AI agent systems.

**What is PAI?** See: [PAI Project Overview](../README.md#what-is-pai)

**What is a Pack?** See: [Pack System](../README.md#the-journey-pai-v1x--v20)

This pack adds voice **input** capabilities to your AI infrastructure. It is the reverse direction of `pai-voice-system` (which handles voice output/TTS). Together they form a complete bidirectional voice loop:

- **Voice Output** (pai-voice-system): AI speaks to you via ElevenLabs TTS (port 8888)
- **Voice Input** (this pack): You speak to AI via STT providers (port 8889)

**Core principle:** Your AI should listen, not just read.

**Status:** v0.1.0 scaffolding — interfaces, stubs, and documentation only. Not yet functional.

Please follow the installation instructions in INSTALL.md when implementation is ready.

---

## What's Included

| Component | File | Purpose |
|-----------|------|---------|
| Core Types | `src/VoiceInput/types.ts` | Interfaces for STT, activation, and config |
| Provider Interface | `src/VoiceInput/stt-providers/provider.interface.ts` | Abstract STT provider contract with error types |
| Whisper Stub | `src/VoiceInput/stt-providers/whisper.stub.ts` | Local Whisper provider (offline, private) |
| ElevenLabs Stub | `src/VoiceInput/stt-providers/elevenlabs.stub.ts` | Cloud ElevenLabs STT provider |
| macOS Dictation Stub | `src/VoiceInput/stt-providers/macos-dictation.stub.ts` | System-level macOS speech recognition |
| Wake Word Stub | `src/VoiceInput/activation/wake-word.stub.ts` | "Hey JAM" wake word detection |
| Hotkey Stub | `src/VoiceInput/activation/hotkey.stub.ts` | Global hotkey trigger (Fn+V) |
| Server Stub | `src/VoiceInput/server.stub.ts` | HTTP server skeleton (port 8889) |
| Example Config | `src/config/voice-input.example.json` | Default configuration |

**Summary:**
- **Files created:** 12 (9 source + 3 documentation)
- **Hooks registered:** 0 (server-only pack, stubs only)
- **Dependencies:** None yet (stubs only)

---

## The Concept and/or Problem

AI agents are deaf by default. All interaction with Claude Code is keyboard-only — every prompt must be typed, every command must be written. PAI already solved the output half with `pai-voice-system`: your AI speaks to you. But the input half is missing.

This creates real problems:

**For Accessibility:**
- Users with RSI, carpal tunnel, or motor disabilities cannot use keyboard-only interfaces efficiently
- Extended coding sessions cause physical strain from constant typing
- Voice is the most natural human communication interface, yet AI agents ignore it

**For Workflow:**
- You cannot dictate thoughts while your hands are busy (drawing, writing on paper, cooking)
- Walking away from the keyboard means losing the ability to interact with your AI
- Quick questions require context-switching back to the terminal to type

**For the Vision:**
- PAI's voice system is half-complete — output only
- A truly personal AI assistant should have a full conversation loop
- The infrastructure for voice output already exists; input is the missing piece

**The Fundamental Problem:**

Claude Code has no ears. It has a voice (pai-voice-system) but cannot hear you. Every interaction requires you to sit at a keyboard and type. In a world where voice assistants are ubiquitous, this is an unnecessary constraint on how you work with your AI.

---

## The Solution

The PAI Voice Input system solves this through an abstracted speech-to-text pipeline with dual activation methods. It mirrors the architecture of `pai-voice-system` as a companion HTTP server.

**Core Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    PAI Voice Input                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Activation (either/both):                                  │
│   ┌─────────────┐  ┌──────────────────┐                      │
│   │ Wake Word   │  │ Global Hotkey    │                      │
│   │ "Hey JAM"   │  │ Fn+V             │                      │
│   └──────┬──────┘  └───────┬──────────┘                      │
│          │                 │                                  │
│          └────────┬────────┘                                  │
│                   ▼                                           │
│          ┌────────────────┐                                   │
│          │ Audio Capture  │  (microphone → PCM buffer)        │
│          └───────┬────────┘                                   │
│                  ▼                                            │
│          ┌────────────────┐                                   │
│          │ STT Provider   │  (pluggable)                      │
│          │                │                                   │
│          │ • Whisper      │  Local, offline, private           │
│          │ • ElevenLabs   │  Cloud, high accuracy              │
│          │ • macOS Dict.  │  System, zero-cost                 │
│          └───────┬────────┘                                   │
│                  ▼                                            │
│          ┌────────────────┐                                   │
│          │ Transcription  │  text + confidence + duration      │
│          └───────┬────────┘                                   │
│                  ▼                                            │
│   ┌──────────────────────────────┐                            │
│   │ Voice Input Server :8889     │                            │
│   │                              │                            │
│   │ POST /start-listening        │                            │
│   │ POST /stop-listening         │                            │
│   │ GET  /status                 │                            │
│   │ GET  /health                 │                            │
│   └──────────────┬───────────────┘                            │
│                  ▼                                            │
│   claude --prompt "transcribed text"                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Design Principles:**

1. **Provider Abstraction**: Any STT engine plugs in through a common interface — swap providers without changing the pipeline.
2. **Dual Activation**: Wake word for hands-free, hotkey for deliberate — both can be enabled simultaneously.
3. **Mirror Architecture**: Same patterns as voice output (HTTP server, JSON API, localhost-only, Bun runtime).
4. **Fail Gracefully**: Input failures never block the system — keyboard always works as fallback.
5. **Privacy First**: Default provider (Whisper) runs entirely on-device. Cloud providers are opt-in.

---

## What Makes This Different

This sounds similar to macOS Dictation which also does speech-to-text. What makes this approach different?

The PAI Voice Input system is purpose-built for AI agent interaction, not generic text input. It provides a pluggable provider architecture, dual activation methods (wake word + hotkey), and direct integration with Claude Code's CLI. Unlike system dictation, transcribed text flows directly into the AI pipeline with confidence scoring and provider-specific optimization for technical speech.

- Abstracted providers swap without changing any pipeline code.
- Wake word enables fully hands-free AI conversations.
- Direct Claude Code integration bypasses clipboard and UI.
- Mirrors existing voice output for bidirectional symmetry.

---

## Configuration

**Example configuration** (`src/config/voice-input.example.json`):

```json
{
  "provider": "whisper",
  "wakeWord": { "enabled": true, "phrase": "Hey JAM", "engine": "porcupine" },
  "hotkey": { "enabled": true, "combo": "Fn+V" },
  "audio": { "sampleRate": 16000, "channels": 1, "encoding": "pcm_s16le" },
  "port": 8889,
  "autoSubmit": true
}
```

**Provider options:**
| Provider | Mode | Dependencies | Best For |
|----------|------|-------------|----------|
| `whisper` | Local | whisper.cpp, sox | Privacy, offline use, no API costs |
| `elevenlabs` | Cloud | API key | Highest accuracy, language detection |
| `macos-dictation` | System | macOS 10.15+ | Zero-cost fallback, no setup |

---

## Customization

### Recommended Customization

**What to Customize:** Wake word phrase and STT provider selection.

**Why:** The default wake phrase "Hey JAM" is personalized to this installation. Choose a phrase that feels natural and doesn't collide with common speech. Provider selection depends on your privacy requirements and accuracy needs.

**Process:**
1. Edit `voice-input.example.json` to change `wakeWord.phrase` to your preferred trigger
2. Select an STT provider that matches your needs (see provider table above)
3. If using ElevenLabs, add your API key to `~/.env` (same key as TTS)

**Expected Outcome:** Voice input activates with your chosen trigger and transcribes through your preferred provider.

### Optional Customization

| Customization | Config Key | Impact |
|--------------|------------|--------|
| Hotkey combo | `hotkey.combo` | Change from Fn+V to your preferred shortcut |
| Auto-submit | `autoSubmit` | Toggle whether transcriptions auto-send to Claude |
| Audio quality | `audio.sampleRate` | Higher rates for better accuracy (at CPU cost) |

---

## Credits

- **Original concept**: Voice input as the missing half of PAI's voice system
- **Architecture**: Mirrors `pai-voice-system` by Daniel Miessler
- **STT engines**: OpenAI Whisper, ElevenLabs, Apple SFSpeechRecognizer
- **Wake word**: Picovoice Porcupine engine

---

## Relationships

### Sibling Of
- `pai-voice-system` — Voice output (TTS). This pack is the input (STT) counterpart.

### Part Of Collection
- PAI Voice Suite — Together with `pai-voice-system`, forms the complete bidirectional voice loop.

---

## Changelog

### 0.1.0 - 2026-02-10
- Initial scaffolding release
- Abstract STT provider interface with three provider stubs
- Dual activation stubs (wake word + global hotkey)
- Voice Input server skeleton (port 8889)
- Full type definitions and documentation
- **Not yet functional** — stubs and interfaces only
