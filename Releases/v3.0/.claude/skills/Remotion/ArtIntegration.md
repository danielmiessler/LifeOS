# Art Skill Integration

**MANDATORY:** This skill inherits visual theming from the Art skill.

## Before Creating Any Video Content

1. **Load Art preferences:**
   ```
   ~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md
   ```

2. **Apply the PAI Theme** derived from Art preferences:

| Art Preference | Remotion Application |
|----------------|---------------------|
| Core aesthetic (charcoal architectural) | Dark backgrounds, sketch-like feel |
| Primary accent (purple/violet) | Accent colors, highlights, CTAs |
| Cool atmospheric washes | Background gradients, overlays |
| Paper ground (#F5F5F0) | Light text, subtle backgrounds |
| Human-scale in vast spaces | Typography hierarchy, spacing |

3. **Use Theme Constants:**
   ```
   ~/.claude/skills/Remotion/Tools/Theme.ts
   ```

4. **Reference images** (when visual style reference needed):
   ```
   ~/.claude/skills/Art/Examples/
   ```

## PAI Theme Quick Reference

```typescript
import { PAI_THEME } from '~/.claude/skills/Remotion/Tools/Theme'

// Colors
PAI_THEME.colors.background    // #0f172a - Deep slate
PAI_THEME.colors.accent        // #8b5cf6 - Purple/violet
PAI_THEME.colors.text          // #f1f5f9 - Light text
PAI_THEME.colors.textMuted     // #94a3b8 - Muted text

// Typography
PAI_THEME.typography.title     // { fontSize: 72, fontWeight: 'bold' }
PAI_THEME.typography.subtitle  // { fontSize: 36 }
PAI_THEME.typography.body      // { fontSize: 24 }

// Animation
PAI_THEME.animation.springDefault  // { damping: 12, stiffness: 100 }
PAI_THEME.animation.fadeFrames     // 30 frames (~1 second)
PAI_THEME.animation.staggerDelay   // 10 frames

// Spacing
PAI_THEME.spacing.page         // 100px edge padding
PAI_THEME.spacing.section      // 60px between sections
PAI_THEME.spacing.element      // 30px between elements
```

## Using the Theme in Components

```typescript
import { PAI_THEME, titleScreenStyle, fadeInterpolation } from '~/.claude/skills/Remotion/Tools/Theme'

export const MyScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(
    frame,
    fadeInterpolation().inputRange,
    fadeInterpolation().outputRange,
    { extrapolateRight: 'clamp' }
  )

  const scale = spring({
    frame, fps,
    config: PAI_THEME.animation.springDefault
  })

  return (
    <AbsoluteFill style={titleScreenStyle}>
      <h1 style={{
        ...PAI_THEME.typography.title,
        color: PAI_THEME.colors.text,
        opacity,
        transform: `scale(${scale})`
      }}>
        Title Here
      </h1>
    </AbsoluteFill>
  )
}
```

**All videos MUST use this theme unless explicitly overridden.**
