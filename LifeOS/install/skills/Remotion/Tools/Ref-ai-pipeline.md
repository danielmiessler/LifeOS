---
name: ai-pipeline
description: Combine AI image generation, TTS, and captions into a Remotion composition
metadata:
  tags: ai, pipeline, nano-banana, elevenlabs, generation, b-roll, content
---

# AI content → Remotion pipeline

Generate all ingredients (scene images, narration audio, captions) with AI, then compose and render in Remotion. This is the pattern for turning a topic or script into a finished video with no manual asset collection.

## Pipeline

```
Topic/Script
    │
    ├── Art skill (Nano Banana Pro / GPT-Image-1) ──► scene-N.png in /public
    ├── ElevenLabs TTS ───────────────────────────► narration.mp3 in /public
    └── ElevenLabs STT (on narration.mp3) ────────► Caption[]
            │
            └── Remotion composition ──► MP4 via bunx remotion render
```

## Step 1 — Generate scene images

Use the Art skill. Save into the project's `/public` directory so `staticFile()` resolves them.

```bash
# Inside your Remotion project root
bun Tools/Art.ts generate --prompt "Cyberpunk city skyline at dusk, neon" \
  --model nano-banana-pro --out public/scene-1.png
```

## Step 2 — Generate narration (ElevenLabs TTS)

```tsx
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import fs from 'node:fs';

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

const audio = await client.textToSpeech.convert('VOICE_ID', {
  text: 'Your script here.',
  modelId: 'eleven_turbo_v2_5',
});

fs.writeFileSync('public/narration.mp3', Buffer.from(await audio.arrayBuffer()));
```

## Step 3 — Transcribe for captions

Feed the TTS output back through ElevenLabs STT to get word-level timings.

```tsx
import { elevenLabsTranscriptToCaptions } from '@remotion/elevenlabs';

const transcript = await client.speechToText.convert({
  file: fs.createReadStream('public/narration.mp3'),
  modelId: 'scribe_v1',
});

const { captions } = elevenLabsTranscriptToCaptions({ transcript });
fs.writeFileSync('public/captions.json', JSON.stringify(captions));
```

See `Ref-elevenlabs-captions.md` for the caption pipeline details.

## Step 4 — Compose

```tsx
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from 'remotion';
import { Audio, Video } from '@remotion/media';
import { createTikTokStyleCaptions } from '@remotion/captions';
import captionsJson from '../public/captions.json';

export const AiVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  const { pages } = createTikTokStyleCaptions({
    captions: captionsJson,
    combineTokensWithinMilliseconds: 1200,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Sequence from={0} durationInFrames={3 * fps}>
        <img src={staticFile('scene-1.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Sequence>
      <Sequence from={3 * fps} durationInFrames={3 * fps}>
        <img src={staticFile('scene-2.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </Sequence>

      <Audio src={staticFile('narration.mp3')} />

      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 80 }}>
        {pages.map((page, i) => {
          const start = (page.startMs / 1000) * fps;
          const next = pages[i + 1];
          const end = next ? (next.startMs / 1000) * fps : start + 60;
          return (
            <Sequence key={i} from={start} durationInFrames={end - start}>
              <div style={{ fontSize: 72, fontWeight: 700, color: 'white', textAlign: 'center' }}>
                {page.tokens.map((t) => t.text).join('')}
              </div>
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

## Step 5 — Render

```bash
bunx remotion render AiVideo "${LIFEOS_DOWNLOADS_DIR:-$HOME/Downloads}"/ai-video.mp4 --codec=h264
```

## Automation

The full pipeline is wrapped in `Workflows/GeneratedContentVideo.md` — invoke that when a user asks "make a short about X" or "turn this blog into a video."

## Related references

- `Ref-elevenlabs-captions.md` — STT → Caption[] details
- `Ref-display-captions.md` — TikTok-style caption rendering
- `Ref-images.md` — `<Img>` component specifics
- `Ref-audio.md` — audio control (volume, trim, loop)
- `Workflows/GeneratedContentVideo.md` — orchestration workflow
