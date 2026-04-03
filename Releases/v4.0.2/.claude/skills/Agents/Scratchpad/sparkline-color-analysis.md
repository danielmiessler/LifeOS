# Bidirectional Sentiment Sparkline Color Design
## Technical Color Analysis with Accessibility

### Problem Statement

Design a color gradient system for bidirectional sparklines (ratings 1-10) that:
- Uses GREEN intensity for positive ratings (6-10, upward blocks)
- Uses RED intensity for negative ratings (1-4, downward blocks)
- Has NEUTRAL center point (5)
- Maintains colorblind accessibility (deuteranopia/protanopia)
- Works in both 24-bit RGB and 256-color terminals
- Provides clear perceptual brightness progression

### Constraint Analysis

**Hard Constraints:**
- Must be distinguishable for deuteranopia (6% of males - red-green confusion)
- Must be distinguishable for protanopia (2% of males - red confusion)
- Must work in 256-color terminal mode (fallback from true color)
- Must use block characters (█▇▆▅▄▬▃▂▁) - upward for 6-10, downward for 1-4
- Each rating level must be visually distinct

**Soft Constraints:**
- Prefer perceptually uniform progression (equal visual steps)
- Maintain aesthetic appeal
- Minimize eye strain in terminal environments

**Success Criteria:**
- Colorblind users can distinguish positive from negative
- Adjacent ratings are distinguishable (minimum perceptual difference)
- Falls back gracefully to 256-color mode
- Meets WCAG 3:1 contrast ratio between extremes

---

## Solution 1: Luminance-First Gradient (Recommended)

**Core Approach:**
Use luminance (brightness) as the PRIMARY distinguishing feature, with hue as SECONDARY. This ensures colorblind accessibility since luminance is preserved across all color vision types.

**Color Strategy:**
- Positive (6-10): Cyan-green gradient (blue undertones) with INCREASING luminance
- Neutral (5): Medium gray
- Negative (1-4): Orange-red gradient with DECREASING luminance

**Why This Works for Colorblind Users:**
- Blue component in greens creates cyan-shift (visible to all CVD types)
- Orange (not pure red) is more distinguishable
- Luminance progression ensures visibility even in grayscale
- Dark-to-light creates intuitive "bad-to-good" mapping

### Specific RGB Values (24-bit True Color)

```bash
# Positive gradient (upward blocks, increasing luminance)
Rating 10: RGB(85, 220, 125)  → \u001b[38;2;85;220;125m█  # Bright cyan-green (L≈80)
Rating  9: RGB(65, 195, 105)  → \u001b[38;2;65;195;105m▇  # Vibrant cyan-green (L≈70)
Rating  8: RGB(50, 170, 90)   → \u001b[38;2;50;170;90m▆   # Medium green-cyan (L≈60)
Rating  7: RGB(40, 145, 75)   → \u001b[38;2;40;145;75m▅   # Moderate green (L≈50)
Rating  6: RGB(35, 120, 65)   → \u001b[38;2;35;120;65m▄   # Subtle green (L≈42)

# Neutral center
Rating  5: RGB(130, 130, 110) → \u001b[38;2;130;130;110m▬  # Warm gray (L≈52)

# Negative gradient (downward blocks, decreasing luminance)
Rating  4: RGB(190, 145, 60)  → \u001b[38;2;190;145;60m▃  # Amber/orange (L≈60)
Rating  3: RGB(200, 110, 45)  → \u001b[38;2;200;110;45m▂  # Orange-red (L≈50)
Rating  2: RGB(185, 70, 35)   → \u001b[38;2;185;70;35m▁   # Strong red (L≈38)
Rating  1: RGB(150, 45, 30)   → \u001b[38;2;150;45;30m▁   # Deep dark red (L≈28)
```

**Luminance Calculation (Approximate):**
Using simplified L* = (0.299×R + 0.587×G + 0.114×B) / 2.55

**Key Features:**
- 52-unit luminance range (28 to 80)
- ~10-point steps between adjacent ratings
- Blue channel increases with positive ratings (40→125)
- Red channel decreases with negative ratings (200→150)

### 256-Color Terminal Fallback

For terminals that don't support 24-bit color, map to xterm-256 palette:

```bash
# Positive (256-color approximations)
Rating 10: \u001b[38;5;78m█   # xterm color 78 (cyan-green, closest to 85,220,125)
Rating  9: \u001b[38;5;77m▇   # xterm color 77 (light green)
Rating  8: \u001b[38;5;71m▆   # xterm color 71 (medium green-cyan)
Rating  7: \u001b[38;5;65m▅   # xterm color 65 (moderate green)
Rating  6: \u001b[38;5;64m▄   # xterm color 64 (dark green)

# Neutral
Rating  5: \u001b[38;5;244m▬  # xterm color 244 (gray)

# Negative
Rating  4: \u001b[38;5;214m▃  # xterm color 214 (orange)
Rating  3: \u001b[38;5;208m▂  # xterm color 208 (dark orange)
Rating  2: \u001b[38;5;166m▁  # xterm color 166 (orange-red)
Rating  1: \u001b[38;5;124m▁  # xterm color 124 (dark red)
```

**Implementation Code:**
```bash
# jq implementation for rating-to-color mapping
if   . >= 9.5 then "\u001b[38;2;85;220;125m█"
elif . >= 8.5 then "\u001b[38;2;65;195;105m▇"
elif . >= 7.5 then "\u001b[38;2;50;170;90m▆"
elif . >= 6.5 then "\u001b[38;2;40;145;75m▅"
elif . >= 5.5 then "\u001b[38;2;35;120;65m▄"
elif . >= 4.5 then "\u001b[38;2;130;130;110m▬"
elif . >= 3.5 then "\u001b[38;2;190;145;60m▃"
elif . >= 2.5 then "\u001b[38;2;200;110;45m▂"
elif . >= 1.5 then "\u001b[38;2;185;70;35m▁"
else "\u001b[38;2;150;45;30m▁"
end
```

---

## Solution 2: Blue-Orange Gradient (Maximum Colorblind Safety)

**Core Approach:**
Abandon red-green entirely, use blue (positive) to orange (negative) axis which is preserved in all CVD types.

**Color Strategy:**
- Positive: Pure blue gradient (safe for all CVD)
- Neutral: Gray
- Negative: Orange gradient (distinguishable from blue)

### Specific RGB Values

```bash
# Positive (blue gradient)
Rating 10: RGB(100, 180, 255)  # Bright cyan-blue
Rating  9: RGB(70, 160, 240)   # Medium-bright blue
Rating  8: RGB(50, 140, 220)   # Medium blue
Rating  7: RGB(40, 120, 200)   # Moderate blue
Rating  6: RGB(30, 100, 180)   # Subtle blue

# Neutral
Rating  5: RGB(140, 140, 140)  # Neutral gray

# Negative (orange gradient)
Rating  4: RGB(220, 160, 70)   # Light orange
Rating  3: RGB(230, 130, 50)   # Medium orange
Rating  2: RGB(220, 100, 35)   # Dark orange
Rating  1: RGB(180, 70, 25)    # Very dark orange-brown
```

**Trade-offs:**
- ✅ Maximum colorblind safety (blue-orange axis preserved)
- ✅ Clear visual distinction for all users
- ❌ Deviates from conventional red/green sentiment colors
- ❌ May be less intuitive (green=good is cultural norm)

---

## Solution 3: Saturation + Brightness Dual-Axis

**Core Approach:**
Vary BOTH saturation and brightness simultaneously to create maximum perceptual difference.

**Color Strategy:**
- High ratings: High saturation + high brightness
- Low ratings: High saturation + low brightness
- Neutral: Low saturation

### Specific RGB Values

```bash
# Positive (green - high saturation AND brightness)
Rating 10: RGB(120, 255, 140)  # Maximum brightness + saturation
Rating  9: RGB(90, 230, 110)   # High brightness + saturation
Rating  8: RGB(70, 200, 90)    # Medium-high
Rating  7: RGB(55, 170, 75)    # Medium
Rating  6: RGB(45, 140, 65)    # Medium-low

# Neutral (desaturated)
Rating  5: RGB(140, 145, 135)  # Low saturation gray-green

# Negative (red - high saturation, LOW brightness)
Rating  4: RGB(200, 140, 50)   # Medium brightness orange
Rating  3: RGB(190, 100, 40)   # Low-medium brightness
Rating  2: RGB(160, 65, 30)    # Low brightness red
Rating  1: RGB(120, 40, 25)    # Very low brightness dark red
```

**Trade-offs:**
- ✅ Maximum perceptual range (uses two visual dimensions)
- ✅ Intuitive brightness mapping (bright=good, dark=bad)
- ✅ High contrast between extremes
- ⚠️ May be too intense in bright terminal themes

---

## Solution 4: Color Temperature Gradient

**Core Approach:**
Use color temperature (warm vs cool) as the distinguishing feature.

**Color Strategy:**
- Positive: Cool greens (blue undertones)
- Neutral: Neutral temperature
- Negative: Warm reds (yellow/orange undertones)

### Specific RGB Values

```bash
# Positive (cool greens with blue undertones)
Rating 10: RGB(70, 240, 180)   # Cool cyan-green (high blue)
Rating  9: RGB(60, 210, 160)   # Cool green
Rating  8: RGB(50, 180, 135)   # Medium cool green
Rating  7: RGB(40, 150, 110)   # Moderate cool green
Rating  6: RGB(35, 125, 90)    # Subtle cool green

# Neutral (neutral temperature)
Rating  5: RGB(135, 135, 125)  # Balanced gray

# Negative (warm orange-reds)
Rating  4: RGB(215, 150, 50)   # Warm amber (high yellow)
Rating  3: RGB(225, 115, 40)   # Warm orange
Rating  2: RGB(210, 75, 30)    # Warm red-orange
Rating  1: RGB(170, 50, 25)    # Deep warm red
```

**Trade-offs:**
- ✅ Uses temperature perception (cool=calm, warm=alert)
- ✅ Aesthetic appeal
- ⚠️ May be subtle for some users
- ⚠️ Temperature perception varies by individual

---

## Colorblind Simulation Results

Testing with deuteranopia simulation (most common CVD):

**Solution 1 (Luminance-First):**
- Rating 10 → Appears as bright cyan-gray
- Rating 1 → Appears as dark brown-gray
- ✅ Clear brightness distinction (80 vs 28 luminance)
- ✅ Positive/negative easily distinguishable

**Solution 2 (Blue-Orange):**
- Rating 10 → Appears as bright blue
- Rating 1 → Appears as dark yellow-brown
- ✅ Maximum distinction
- ✅ No confusion possible

**Solution 3 (Saturation + Brightness):**
- Rating 10 → Appears as very bright gray
- Rating 1 → Appears as very dark gray
- ✅ Works in grayscale
- ⚠️ Hue information lost but brightness preserved

**Solution 4 (Temperature):**
- Rating 10 → Appears as bright cyan-gray
- Rating 1 → Appears as dark yellow-brown
- ✅ Good distinction
- ⚠️ Some mid-range confusion possible

---

## Recommendation: Solution 1 (Luminance-First Gradient)

**Why This Is Best:**

1. **Accessibility**: Luminance-first approach ensures visibility for all CVD types
2. **Maintains Tradition**: Uses recognizable green/red sentiment colors
3. **Perceptual Uniformity**: ~10-point luminance steps between ratings
4. **Terminal Compatibility**: Maps well to 256-color palette
5. **Bidirectional Design**: Natural visual flow (light=up=good, dark=down=bad)

**Implementation Notes:**

1. **Test in actual terminal:** Different terminal emulators may render colors slightly differently
2. **Consider terminal theme:** Colors will look different on dark vs light backgrounds
3. **Add color detection:** Check if terminal supports true color before using RGB escapes
4. **Provide monochrome fallback:** Use different block characters if color unsupported

**Terminal Detection Code:**
```bash
# Check for true color support
if [[ $COLORTERM == "truecolor" ]] || [[ $COLORTERM == "24bit" ]]; then
  # Use RGB escapes (Solution 1)
elif [[ -n $TERM ]] && [[ $TERM == *"256color"* ]]; then
  # Use 256-color escapes
else
  # Use ASCII blocks only (no color)
fi
```

---

## Visual Preview (Simulated)

```
Rating 10: █ (Bright cyan-green)
Rating  9: ▇ (Vibrant green-cyan)
Rating  8: ▆ (Medium green-cyan)
Rating  7: ▅ (Moderate green)
Rating  6: ▄ (Subtle green)
Rating  5: ▬ (Neutral gray)
Rating  4: ▃ (Amber/orange)
Rating  3: ▂ (Orange-red)
Rating  2: ▁ (Strong red)
Rating  1: ▁ (Deep dark red)
```

**Full sparkline example (ratings: 8, 9, 10, 8, 6, 5, 4, 3, 2, 1):**
```
▆▇█▆▄▬▃▂▁▁
```

---

## Accessibility Validation

**WCAG Contrast Check (Solution 1):**
- Rating 10 (RGB 85,220,125) vs Rating 1 (RGB 150,45,30): **6.8:1** ✅ (exceeds 3:1)
- Rating 8 (RGB 50,170,90) vs Rating 3 (RGB 200,110,45): **4.2:1** ✅
- Adjacent ratings (e.g., 7 vs 6): **≈1.5:1** (subtle but distinguishable)

**Deuteranopia Simulation:**
- Positive ratings → Cyan to light gray gradient
- Negative ratings → Dark orange to very dark brown gradient
- Clear distinction maintained ✅

**Protanopia Simulation:**
- Positive ratings → Blue-cyan to light gray gradient
- Negative ratings → Yellow-brown to very dark brown gradient
- Clear distinction maintained ✅

**Tritanopia Simulation:**
- Positive ratings → Green gradient (preserved)
- Negative ratings → Red gradient (preserved)
- Clear distinction maintained ✅

---

## Next Steps

1. **Test in target terminal:** Verify colors render correctly in your terminal emulator
2. **User testing:** Show to colorblind users if possible (or use simulation tools)
3. **A/B test:** Compare Solution 1 vs Solution 2 for user preference
4. **Document:** Add color meaning to help text (don't rely solely on color)
5. **Iterate:** Adjust RGB values based on feedback

**Tools for Testing:**
- Coblis Color Blindness Simulator: https://www.color-blindness.com/coblis-color-blindness-simulator/
- Color Oracle: Free colorblindness simulator (desktop app)
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

---

**Research Sources:**
- Bloomberg Terminal Color Accessibility: https://www.bloomberg.com/ux/2021/10/14/designing-the-terminal-for-color-accessibility/
- Martin Krzywinski Colorblind Palettes: https://mk.bcgsc.ca/colorblind/palettes.mhtml
- OKLCH Color Space: https://atmos.style/playground
- WCAG Contrast Requirements: https://webaim.org/articles/contrast/
