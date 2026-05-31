---
name: voice
description: TTS integration, notification patterns, and voice pipelines. Text-to-speech synthesis, voice selection, SSML markup, audio pipeline configuration, speech event handling, multi-modal output, and accessibility patterns. USE WHEN voice, TTS, speech, notification, audio, speak, announce, text to speech, SSML, accessibility.
metadata:
  author: pai
  version: 1.0.0
---

# Voice — TTS & Notifications

## TTS Integration

| Component | Options |
|-----------|---------|
| **Engine** | System TTS, cloud API, local model |
| **Voice** | Gender, accent, language, speed |
| **Format** | WAV, MP3, OGG, streaming |
| **Markup** | SSML for prosody control |

## SSML Markup

```
<speak>
  <voice name="en-US-JennyNeural">
    <prosody rate="medium" pitch="+10%">
      Hello. <break time="500ms"/>
      This is an <emphasis>important</emphasis> announcement.
    </prosody>
  </voice>
</speak>
```

## Notification Patterns

| Priority | Style | Interrupt? |
|----------|-------|------------|
| Silent | No sound, badge only | No |
| Subtle | Short chime, brief | Low |
| Normal | Full TTS message | Medium |
| Critical | Persistent alert, repeat | Yes |
| Emergency | Loud, overrides all | Yes |

## Voice Pipeline

1. **Input** — Text or structured data
2. **Prepare** — SSML wrap, voice selection, filter content
3. **Synthesize** — Generate audio
4. **Output** — Play, save, or stream
5. **Fallback** — Display text if audio fails

## Accessibility

- Always offer text fallback alongside audio
- Allow user to set preferred voice and speed
- Respect system silent/do-not-disturb settings
- Test with screen readers for compatibility
