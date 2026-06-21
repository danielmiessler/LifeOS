# Scout Report: Voice Functionality Discovery
**Task**: Remove all signs of voice functionality from release 5.0.0
**Date**: 2026-06-21
**Author**: Antigravity

---

## Findings

We scanned the entire workspace for occurrences of voice features, ElevenLabs integrations, voice synthesis logic, and custom DA voices. Below are the key files and references identified:

### 1. Unified Daemon (Pulse)
- **`PAI/PULSE/checks/notification-governor.ts`**: Implements quiet hours, daily capping of voice notifications (3/day), and handles `Channel = "voice"`. Uses `dispatch("voice", message)`.
- **`README.md`**: Mentions ElevenLabs voice notifications served by Pulse `/notify` endpoint.
- **`PAI/PULSE/Observability/src/app/finances/page.tsx`** & **`PAI/PULSE/Observability/out/_next/static/chunks/app/finances/page-f20436e8a8d6a9cf.js`**: Contains a line category object with a mapping for `elevenlabs: Cpu`.

### 2. Identity & Configuration
- **`PAI/USER/DA_IDENTITY.md`** & **`PAI/USER/DA/README.md`**: Define the DA's identity, voice properties, personality, and references to ElevenLabs voice ID.
- **`PAI/USER/PRONUNCIATIONS.md`**: Notes that the voice subsystem reads this list for pronunciation hints.
- **`hooks/lib/identity.ts`**: Contains types `VoiceProsody` and `VoicePersonality`, and functions `getAlgorithmVoice()`, `getVoiceProsody()`, `getVoicePersonality()`, and `mainDAVoiceID`.
- **`hooks/RestoreContext.hook.ts`**: References DA_IDENTITY.md voice and pronunciation rules.
- **`PAI/PAI_SYSTEM_PROMPT.md`**: Mentions that the name, voice, and personality of the DA reside in `USER/DA_IDENTITY.md`.

### 3. Core Tools
- **`PAI/TOOLS/algorithm.ts`**: Defines a stub `voiceNotify` that prints to `console.error` (the actual audio subsystem notification was previously removed). It still has instructions warning against voice curls.
- **`PAI/TOOLS/TranscriptParser.ts`**: Implements voice line parsing functions: `extractVoiceCompletion`, `extractCompletionPlain`, and variables like `voiceCompletion`.
- **`PAI/TOOLS/DAInterview.ts`**: References setting up the voice configuration and channels (`voice`).
- **`PAI/TOOLS/DASchedule.ts`**: Lists `voice` as a notification channel.
- **`PAI/TOOLS/IntegrityMaintenance.ts`**: Mentions that voice/TTS completion notice was removed.
- **`PAI/TOOLS/CostTracker.ts`**: Mentions that voice/TTS emission was removed.
- **`PAI/TOOLS/pai.ts`**: Mentions that voice/TTS emission via Pulse was removed.

### 4. Skills & Templates
- **`skills/Prompting/Templates/Primitives/Voice.hbs`**: Renders ElevenLabs voice settings for prompting.
- **`skills/Prompting/Templates/Data/VoicePresets.yaml`**: Standard ElevenLabs settings presets.
- **`skills/Agents/Templates/CUSTOMAGENTTEMPLATE.md`**: Contains `voiceId` parameter for custom agents.
- **`skills/Remotion/SKILL.md`**: Explicitly mentions support for `@remotion/elevenlabs` captioning and TTS in workflows.
- **`skills/Remotion/Tools/Ref-elevenlabs-captions.md`**: Documentation/patterns for ElevenLabs STT transcripts to Remotion captions.
- **`skills/Remotion/Tools/Ref-ai-pipeline.md`**: Shows video narration workflow using ElevenLabs TTS.
- **`skills/Remotion/Workflows/GeneratedContentVideo.md`**: Implementation workflow for generating voice using ElevenLabs TTS.

### 5. Build/Installer Scripts
- **`install.sh`**: Mentions ElevenLabs API key input, voice picker setup, and configuring voices.
- **`ISA.md`**: Contains reference to voice ID announcements in ISC-4 and configuring DA voice in ISC-18.

---

## Action Plan Outline
To remove voice functionality, we need to:
1. Strip out voice configurations and defaults from identity settings and templates.
2. Remove the `voice` channel, quiet hours, and daily cap rate limits from the notification governor in Pulse.
3. Clean up the voice line extraction, types, and properties from core tools (e.g., `TranscriptParser.ts`, `DASchedule.ts`, `DAInterview.ts`).
4. Clean up `Remotion` references and skills references to ElevenLabs voice/TTS/STT.
