# Remotion Patterns

Common patterns and examples for Remotion video creation.

## Basic Component Structure

```typescript
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from 'remotion'

export const MyVideo: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames, width, height } = useVideoConfig()

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp'
  })

  return (
    <AbsoluteFill style={{ backgroundColor: 'white' }}>
      <h1 style={{ opacity }}>Hello World</h1>
    </AbsoluteFill>
  )
}
```

## Register Composition

```typescript
// src/Root.tsx
import { Composition } from 'remotion'
import { MyVideo } from './MyVideo'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="my-video"
      component={MyVideo}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  )
}
```

## Fade In Text

```typescript
const frame = useCurrentFrame()
const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' })

<h1 style={{ opacity }}>Fade In</h1>
```

## Spring Animation

```typescript
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

const frame = useCurrentFrame()
const { fps } = useVideoConfig()

const scale = spring({
  frame,
  fps,
  from: 0,
  to: 1,
  config: { damping: 10, stiffness: 100 }
})

<div style={{ transform: `scale(${scale})` }}>Bounce In</div>
```

## Sequence Multiple Elements

```typescript
import { Sequence } from 'remotion'

<Sequence from={0} durationInFrames={60}>
  <Title />
</Sequence>
<Sequence from={60} durationInFrames={90}>
  <Content />
</Sequence>
<Sequence from={150}>
  <Outro />
</Sequence>
```

## Audio with Video

```typescript
import { Audio, Video, staticFile } from 'remotion'

<Video src={staticFile('video.mp4')} volume={0.5} />
<Audio src={staticFile('music.mp3')} volume={0.3} startFrom={30} />
```

## Video Size Presets

```typescript
// YouTube
{ width: 1920, height: 1080 }  // 16:9 landscape
{ width: 1080, height: 1920 }  // 9:16 Shorts

// TikTok/Reels
{ width: 1080, height: 1920 }  // 9:16 portrait

// Instagram
{ width: 1080, height: 1080 }  // 1:1 square
{ width: 1080, height: 1350 }  // 4:5 portrait

// Twitter/X
{ width: 1280, height: 720 }   // 16:9 landscape
```

## Critical Rules

1. **NO CSS animations** - They won't render. Use `useCurrentFrame()` for all animations.
2. **NO third-party animation libraries** - They cause flickering. Drive animations from frame.
3. **Use `staticFile()`** - For assets in `/public` directory.
4. **Extrapolate carefully** - Use `extrapolateRight: 'clamp'` to prevent overflow.
5. **Props with Zod** - Define schemas for type-safe, configurable compositions.

## Reference Documentation

For detailed patterns on specific topics, see:
```
~/.claude/skills/Remotion/Tools/Reference/
```

Topics include: animations, audio, 3d, charts, captions, fonts, transitions, and more.
