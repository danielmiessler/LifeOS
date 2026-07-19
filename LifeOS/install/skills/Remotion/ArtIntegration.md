# Art Skill Integration

**MANDATORY:** This skill inherits visual theming from the Art skill.

## Before Creating Any Video Content

1. **Load Art preferences:**
   ```
   $LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Art/PREFERENCES.md
   ```

2. **Apply the LifeOS Theme** derived from Art preferences:

| Art Preference | Remotion Application |
|----------------|---------------------|
| Core aesthetic (charcoal architectural) | Dark backgrounds, sketch-like feel |
| Primary accent (purple/violet) | Accent colors, highlights, CTAs |
| Cool atmospheric washes | Background gradients, overlays |
| Paper ground (#F5F5F0) | Light text, subtle backgrounds |
| Human-scale in vast spaces | Typography hierarchy, spacing |

3. **Use Theme Constants:**
   ```
   $LIFEOS_ROOT/skills/Remotion/Tools/Theme.ts
   ```

4. **Reference images** (when visual style reference needed):
   ```
   $LIFEOS_ROOT/skills/Art/Examples/
   ```

## LifeOS Theme Quick Reference

```typescript
import { LIFEOS_THEME } from '$LIFEOS_ROOT/skills/Remotion/Tools/Theme'

// Colors
LIFEOS_THEME.colors.background    // #0f172a - Deep slate
LIFEOS_THEME.colors.accent        // #8b5cf6 - Purple/violet
LIFEOS_THEME.colors.text          // #f1f5f9 - Light text
LIFEOS_THEME.colors.textMuted     // #94a3b8 - Muted text

// Typography
LIFEOS_THEME.typography.title     // { fontSize: 72, fontWeight: 'bold' }
LIFEOS_THEME.typography.subtitle  // { fontSize: 36 }
LIFEOS_THEME.typography.body      // { fontSize: 24 }

// Animation
LIFEOS_THEME.animation.springDefault  // { damping: 12, stiffness: 100 }
LIFEOS_THEME.animation.fadeFrames     // 30 frames (~1 second)
LIFEOS_THEME.animation.staggerDelay   // 10 frames

// Spacing
LIFEOS_THEME.spacing.page         // 100px edge padding
LIFEOS_THEME.spacing.section      // 60px between sections
LIFEOS_THEME.spacing.element      // 30px between elements
```

## Using the Theme in Components

```typescript
import { LIFEOS_THEME, titleScreenStyle, fadeInterpolation } from '$LIFEOS_ROOT/skills/Remotion/Tools/Theme'

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
    config: LIFEOS_THEME.animation.springDefault
  })

  return (
    <AbsoluteFill style={titleScreenStyle}>
      <h1 style={{
        ...LIFEOS_THEME.typography.title,
        color: LIFEOS_THEME.colors.text,
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
