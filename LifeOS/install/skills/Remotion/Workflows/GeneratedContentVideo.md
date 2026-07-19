# GeneratedContentVideo Workflow

End-to-end AI video generation: topic or script → scene images + narration + captions → composed and rendered MP4.

## Triggers

- "generate a video about X"
- "make a short about Y"
- "AI video"
- "content to video"
- "turn this blog into a video"
- "turn this tweet into a short"

## Difference from ContentToAnimation

- `ContentToAnimation.md` — typography/motion-graphics for an existing piece of content. No AI image generation.
- `GeneratedContentVideo.md` — produces the entire video INCLUDING scene b-roll, narration, and captions from scratch via AI.

## Prerequisites

- `ELEVENLABS_API_KEY` in environment
- Art skill configured (Nano Banana Pro or GPT-Image-1)
- Existing Remotion project OR this workflow will create one

## Execution Steps

### 1. Parse input

Detect input type — topic string, URL (blog/tweet/YouTube), or file path. Route to Parser skill if extraction needed. Output: a clean script of 60-300 words and a scene outline.

### 2. Write the narration script

If input is a topic, write a 30-90 second script in the user's voice (load `USER/PRINCIPAL/WRITINGSTYLE.md`). If input is already content, compress to 60-90 seconds targeting the platform (Shorts/Reels/TikTok = 9:16, X/YouTube = 16:9).

Output: `script.txt` and a parallel `scenes.json` with 4-8 entries describing visual b-roll per section.

### 3. Generate scene images (parallel)

For each scene in `scenes.json`, invoke the Art skill in parallel:

```bash
bun $LIFEOS_ROOT/skills/Art/Tools/Generate.ts \
  --prompt "<scene description, LifeOS theme>" \
  --model nano-banana-pro \
  --aspect 9:16 \
  --out public/scene-${N}.png
```

Launch 4-8 agents concurrently if scene count > 3.

### 4. Generate narration (ElevenLabs TTS)

Use the voice the user has configured for DA narration. Save to `public/narration.mp3`.

```tsx
const audio = await elevenlabs.textToSpeech.convert(VOICE_ID, {
  text: script,
  modelId: 'eleven_turbo_v2_5',
});
fs.writeFileSync('public/narration.mp3', Buffer.from(await audio.arrayBuffer()));
```

### 5. Transcribe for captions (ElevenLabs STT)

Feed the narration back through STT for word-level timing. See `Tools/Ref-elevenlabs-captions.md`.

```tsx
const transcript = await elevenlabs.speechToText.convert({
  file: fs.createReadStream('public/narration.mp3'),
  modelId: 'scribe_v1',
});
const { captions } = elevenLabsTranscriptToCaptions({ transcript });
fs.writeFileSync('public/captions.json', JSON.stringify(captions));
```

### 6. Compose

Follow the pattern in `Tools/Ref-ai-pipeline.md`:

- Scenes in sequenced `<Img>` fills
- `<Audio>` track with the narration
- TikTok-style captions via `createTikTokStyleCaptions()`
- LifeOS theme constants from `Tools/Theme.ts`

Calculate `durationInFrames` from narration length: `audioDurationSec * fps`.

### 7. Render

Default to local:

```bash
bunx remotion render GeneratedVideo ~/Downloads/video.mp4 --codec=h264
```

For batch/production, use Lambda (see `Tools/Ref-lambda.md`).

### 8. Preview

Show the file path and play via `open` on macOS:

```bash
open ~/Downloads/video.mp4
```

## Output

- `~/Downloads/<slug>.mp4` — final video
- Project kept in your local Remotion projects directory for iteration (same location Remotion studio uses)

## Related

- `Tools/Ref-ai-pipeline.md` — per-step technical reference
- `Tools/Ref-elevenlabs-captions.md` — caption pipeline
- `Tools/Ref-lambda.md` — cloud rendering
- `ArtIntegration.md` — theme + color integration
- `Workflows/ContentToAnimation.md` — the non-AI variant

## Gotchas

- **Audio length drives duration** — always set `durationInFrames` from the actual narration length, not estimated.
- **Image aspect ratio must match composition** — generate scenes at 9:16 for Shorts, 16:9 for YouTube. Passing `objectFit="cover"` hides mismatch but crops.
- **STT on TTS output works but is redundant if script is known** — for known scripts, skip STT and time tokens manually against audio duration. Only use STT when the audio source is unknown.
- **Lambda has no AV1** — use h264 for Lambda renders; AV1 only for local.
