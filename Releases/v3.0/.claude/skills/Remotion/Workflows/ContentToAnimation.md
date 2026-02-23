# ContentToAnimation Workflow

Transform any content into professional PAI-themed animations.

## Triggers

- "animate this content"
- "create animations for"
- "video overlay for"
- "animate my blog post"
- "animate this YouTube video"

## Input Types

This workflow handles ANY input via the Parser skill:

| Input Type | Detection | Extraction Method |
|------------|-----------|-------------------|
| YouTube URL | `youtube.com`, `youtu.be` | Parser: ExtractYoutube → transcript |
| Article URL | HTTP(S) URL | Parser: ExtractArticle → text |
| Blog file | `.md` file path | Direct read → markdown content |
| PDF file | `.pdf` file path | Parser: ExtractPdf → text |
| Tweet/Thread | `twitter.com`, `x.com` | Parser: ExtractTwitter → thread |
| Raw text | No URL/path detected | Use directly |

## Execution Steps

### 1. Extract Content

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: CONTENT EXTRACTION                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Detect input type (URL, file path, or raw text)                         │
│ 2. Route to appropriate Parser workflow OR read directly                    │
│ 3. Extract: title, sections, key points, quotes, data                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**For YouTube:**
```bash
# Get transcript via Parser skill
# Load: ~/.claude/skills/Parser/Workflows/ExtractYoutube.md
```

**For articles/blogs:**
```bash
# Read file directly for .md
# Or use Parser: ExtractArticle for URLs
```

### 2. Analyze Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: STRUCTURE ANALYSIS                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Extract these elements for animation:                                       │
│                                                                             │
│ • Title & subtitle                                                          │
│ • Section headers (H2, H3)                                                  │
│ • Key points (3-7 main takeaways)                                          │
│ • Quotes or callouts                                                        │
│ • Data/statistics (numbers, percentages)                                    │
│ • Lists or steps                                                            │
│ • Conclusion/summary                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Output structure:**
```typescript
interface ContentStructure {
  title: string
  subtitle?: string
  sections: {
    heading: string
    keyPoints: string[]
    quotes?: string[]
    data?: { label: string; value: string }[]
  }[]
  conclusion?: string
  duration: number  // Calculated based on content length
}
```

### 3. Generate Animation Plan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: ANIMATION PLANNING                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Map content to animation scenes:                                            │
│                                                                             │
│ Scene 1: Title Card (3 seconds)                                            │
│   → Title fade in with spring scale                                        │
│   → Subtitle fade in with delay                                            │
│                                                                             │
│ Scene 2-N: Content Sections (4-6 seconds each)                             │
│   → Section header slide in                                                │
│   → Key points stagger in                                                  │
│   → Data visualizations animate                                            │
│                                                                             │
│ Scene N+1: Conclusion (3 seconds)                                          │
│   → Summary points                                                          │
│   → Call to action                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Timing formula:**
- Title: 90 frames (3 seconds at 30fps)
- Per section: 120-180 frames (4-6 seconds)
- Conclusion: 90 frames (3 seconds)
- Total = 90 + (sections × 150) + 90

### 3.5 Verify Logical Coherence ⚠️ CRITICAL GATE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3.5: LOGICAL COHERENCE VERIFICATION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ BEFORE generating React components, verify the animation plan makes sense.  │
│                                                                             │
│ This checks LOGICAL coherence, not just functional capability.              │
│                                                                             │
│ If these checks FAIL, the video would render but be confusing/wrong.        │
│ Block early to save compute and prevent bad outputs.                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**1. NARRATIVE COHERENCE CHECKS**

Verify the story flows logically:

| Check | What It Tests | Failure Example |
|-------|---------------|-----------------|
| **Section connectivity** | Adjacent sections share ≥15% concepts | Section 2 "Authentication" → Section 3 "Database Schema" with 0% overlap |
| **Context completeness** | No forward references to undefined concepts | Scene 2 uses "ISC" acronym before defining it in Scene 4 |
| **Transition bridges** | Last point of section N relates to first point of section N+1 | Jarring topic jump with no conceptual bridge |
| **Story arc validity** | Sections follow recognizable narrative pattern | Random sequence with no setup→development→resolution |
| **Title-content alignment** | Content delivers what title promises | Title: "5 Ways to..." but only 3 covered |
| **Conclusion validity** | Conclusion only references introduced concepts | Conclusion mentions "OWASP" never discussed in content |

**Test method:**
```typescript
// Pseudo-code for verification
const narrativeChecks = {
  sectionConnectivity: verifySectionOverlap(sections) >= 0.15,
  contextCompleteness: noForwardReferences(sections),
  transitionBridges: hasConceptualBridges(sections),
  storyArc: matchesValidPattern(sections),
  titleAlignment: contentMatchesTitle(title, sections),
  conclusionValidity: conclusionReferencesContent(conclusion, sections)
}

if (Object.values(narrativeChecks).some(check => !check)) {
  throw new Error('Narrative coherence check failed - see details above')
}
```

**2. TIMING VERIFICATION CHECKS**

Verify timing adapts to content density:

| Check | What It Tests | Failure Example |
|-------|---------------|-----------------|
| **Reading speed validation** | Text duration allows comfortable reading (≤4 words/second) | 47-word paragraph shown for 2 seconds (23.5 wps) |
| **Content-density adaptation** | Duration scales with word count, key points, data items | Simple 2-word title gets same 3s as complex 15-word title |
| **Data comprehension time** | Statistics get 1-2 seconds per item for mental processing | 5 data points crammed into 3 seconds |
| **Content-type multipliers** | Quotes get 1.5x, data gets 1.3x base duration | Reflective quote rushed at same pace as simple list |
| **Duration bounds** | Timing stays within 2-10 seconds per point | Critical concept: 1s, Minor detail: 12s |

**Test method:**
```typescript
// Calculate adaptive timing based on content density
function calculateSectionDuration(section: Section): number {
  const WORDS_PER_SECOND = 3.5  // Research: 200-250 WPM
  const SECONDS_PER_POINT = 2
  const SECONDS_PER_DATA = 1.5

  const wordCount = countWords(section.keyPoints)
  const baseDuration = (
    wordCount / WORDS_PER_SECOND +
    section.keyPoints.length * SECONDS_PER_POINT +
    (section.data?.length || 0) * SECONDS_PER_DATA
  )

  // Apply content-type multiplier
  const typeMultiplier = section.quotes ? 1.5 : 1.0
  const duration = baseDuration * typeMultiplier

  // Enforce bounds
  const minDuration = section.keyPoints.length * 2
  const maxDuration = section.keyPoints.length * 10

  return Math.max(minDuration, Math.min(maxDuration, duration))
}
```

**3. SCENE TYPE SELECTION VALIDATION**

Verify correct scene template chosen for content:

| Check | What It Tests | Failure Example |
|-------|---------------|-----------------|
| **Data scene validation** | DataScene only used when `data` array exists with items | DataScene receives empty data array → blank screen |
| **Numeric content detection** | Statistics in text trigger DataScene, not KeyPointsScene | "10M users, 95% accuracy" shown as bullet points |
| **KeyPoints scene validation** | KeyPointsScene used for 2+ text items without numeric data | Single quote forced into KeyPointsScene template |
| **Quote handling** | Quotes get appropriate visual treatment | Quote buried in bullet list with no emphasis |

**Selection logic:**
```typescript
function selectSceneType(section: Section): SceneType {
  // Priority 1: Has structured data? → DataScene
  if (section.data && section.data.length > 0) {
    return 'DataScene'
  }

  // Priority 2: Detect numeric patterns in text → extract to DataScene
  if (hasNumericPatterns(section.keyPoints)) {
    section.data = extractDataFromText(section.keyPoints)
    return 'DataScene'
  }

  // Priority 3: Has quote and few/no key points? → QuoteScene
  if (section.quotes && section.keyPoints.length < 2) {
    return 'QuoteScene'
  }

  // Default: Key points list
  if (section.keyPoints.length >= 2) {
    return 'KeyPointsScene'
  }

  // Fallback: Simple text
  return 'TitleScene'
}

// Validation guards
function validateSceneSelection(scene: SceneType, section: Section): void {
  if (scene === 'DataScene') {
    assert(section.data && section.data.length > 0,
      'DataScene requires data array with at least 1 item')
  }

  if (scene === 'KeyPointsScene') {
    assert(section.keyPoints.length >= 2,
      'KeyPointsScene requires at least 2 key points')
    assert(!hasNumericPatterns(section.keyPoints),
      'Numeric data should use DataScene, not KeyPointsScene')
  }
}
```

**4. DECISION LOGIC: FAIL FAST OR WARN**

```typescript
interface VerificationResult {
  passed: boolean
  errors: string[]    // Block rendering
  warnings: string[]  // Show but allow proceeding
}

function verifyAnimationPlan(
  structure: ContentStructure,
  plan: AnimationPlan
): VerificationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Run all verification checks
  const narrativeResult = verifyNarrativeCoherence(structure)
  const timingResult = verifyTimingLogic(plan)
  const sceneResult = verifySceneSelection(plan)

  errors.push(...narrativeResult.errors, ...timingResult.errors, ...sceneResult.errors)
  warnings.push(...narrativeResult.warnings, ...timingResult.warnings, ...sceneResult.warnings)

  return { passed: errors.length === 0, errors, warnings }
}

// In workflow execution:
const verification = verifyAnimationPlan(structure, plan)

if (!verification.passed) {
  console.error('❌ LOGICAL COHERENCE CHECK FAILED:')
  verification.errors.forEach(err => console.error(`  - ${err}`))
  throw new Error('Cannot proceed - fix logical issues before rendering')
}

if (verification.warnings.length > 0) {
  console.warn('⚠️  COHERENCE WARNINGS (review recommended):')
  verification.warnings.forEach(warn => console.warn(`  - ${warn}`))
}

console.log('✅ Logical coherence verified - proceeding to component generation')
```

**Example output:**

**PASS:**
```
✅ Logical coherence verified - proceeding to component generation

Checks passed:
  ✓ Narrative flow: All sections connect logically
  ✓ Timing: Adapted to content density (avg 3.8 words/sec)
  ✓ Scene selection: All templates match content types
```

**FAIL:**
```
❌ LOGICAL COHERENCE CHECK FAILED:

  - Narrative: Section 2 → 3 weak connection (5% overlap, need ≥15%)
  - Timing: Scene 3 text too fast to read (6.2 words/sec, max 4.0)
  - Scene selection: DataScene assigned but section.data is empty
  - Conclusion: References "ISC methodology" never introduced in content

Cannot proceed - fix logical issues before rendering
```

**WARN:**
```
⚠️  COHERENCE WARNINGS (review recommended):

  - Narrative: Section 3 → 4 transition lacks bridge concept
  - Timing: Scene 2 duration near minimum bound (2.1s per point)

✅ Logical coherence verified - proceeding to component generation
```

**Why this matters:**

| Without Verification | With Verification |
|---------------------|-------------------|
| Video renders successfully | Video renders successfully |
| 47-word text shown for 2s → unreadable | Timing adapted to 13s → readable |
| Conclusion references undefined "ISC" → confusing | Blocked: "ISC mentioned but never defined" |
| Statistics shown as bullet points → wrong format | Converted to DataScene → proper visualization |
| Section jump from auth to database → jarring | Blocked: "5% overlap, need transitional content" |

**Bottom line:** Verification prevents technically-correct but logically-broken videos from being generated.

### 4. Generate Remotion Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: COMPONENT GENERATION                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Create project at: /tmp/remotion-{timestamp}/                              │
│                                                                             │
│ Files to generate:                                                          │
│ • package.json                                                              │
│ • src/Root.tsx (composition registration)                                   │
│ • src/Video.tsx (main composition)                                          │
│ • src/scenes/TitleScene.tsx                                                │
│ • src/scenes/SectionScene.tsx                                              │
│ • src/scenes/ConclusionScene.tsx                                           │
│ • src/theme.ts (copy from skill)                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**MANDATORY: Apply PAI Theme**
```typescript
import { PAI_THEME } from '~/.claude/skills/Remotion/theme'

// All components MUST use:
// - PAI_THEME.colors for all colors
// - PAI_THEME.typography for text styles
// - PAI_THEME.animation for spring configs
// - PAI_THEME.spacing for layout
```

### 5. Render Output

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: RENDER                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Install dependencies: npm install                                        │
│ 2. Render: npx remotion render {composition-id} ~/Downloads/{name}.mp4     │
│ 3. Open for preview: open ~/Downloads/{name}.mp4                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Scene Templates

### TitleScene

```typescript
const TitleScene: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' })
  const titleScale = spring({ frame, fps, config: PAI_THEME.animation.springDefault })
  const subtitleOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{
      backgroundColor: PAI_THEME.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <h1 style={{
        ...PAI_THEME.typography.title,
        color: PAI_THEME.colors.accent,
        opacity: titleOpacity,
        transform: `scale(${titleScale})`,
        textAlign: 'center',
        maxWidth: '80%',
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{
          ...PAI_THEME.typography.subtitle,
          color: PAI_THEME.colors.textMuted,
          opacity: subtitleOpacity,
          marginTop: 20,
        }}>
          {subtitle}
        </p>
      )}
    </AbsoluteFill>
  )
}
```

### KeyPointsScene

```typescript
const KeyPointsScene: React.FC<{ heading: string; points: string[] }> = ({ heading, points }) => {
  const frame = useCurrentFrame()

  return (
    <AbsoluteFill style={{
      backgroundColor: PAI_THEME.colors.background,
      padding: PAI_THEME.spacing.page,
    }}>
      <h2 style={{
        ...PAI_THEME.typography.heading,
        color: PAI_THEME.colors.text,
        opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        marginBottom: PAI_THEME.spacing.section,
      }}>
        {heading}
      </h2>

      {points.map((point, i) => {
        const delay = 20 + (i * PAI_THEME.animation.staggerDelay)
        const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp' })
        const x = interpolate(frame, [delay, delay + 20], [-30, 0], { extrapolateRight: 'clamp' })

        return (
          <div key={i} style={{
            ...PAI_THEME.typography.body,
            color: PAI_THEME.colors.text,
            opacity,
            transform: `translateX(${x}px)`,
            marginBottom: PAI_THEME.spacing.element,
            display: 'flex',
            alignItems: 'flex-start',
          }}>
            <span style={{ color: PAI_THEME.colors.accent, marginRight: 16 }}>✓</span>
            {point}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}
```

### DataScene

```typescript
const DataScene: React.FC<{ data: { label: string; value: string }[] }> = ({ data }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <AbsoluteFill style={{
      backgroundColor: PAI_THEME.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: PAI_THEME.spacing.section,
    }}>
      {data.map((item, i) => {
        const delay = i * 15
        const scale = spring({ frame: Math.max(0, frame - delay), fps, config: PAI_THEME.animation.springBouncy })

        return (
          <div key={i} style={{
            textAlign: 'center',
            transform: `scale(${scale})`,
          }}>
            <div style={{
              fontSize: 96,
              fontWeight: 'bold',
              color: PAI_THEME.colors.accent,
            }}>
              {item.value}
            </div>
            <div style={{
              ...PAI_THEME.typography.body,
              color: PAI_THEME.colors.textMuted,
            }}>
              {item.label}
            </div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}
```

## Output Formats

| Format | Dimensions | Use Case |
|--------|------------|----------|
| YouTube landscape | 1920x1080 | Default, blog content |
| YouTube Shorts | 1080x1920 | Vertical clips |
| Square | 1080x1080 | Instagram, social |

## Example Usage

**Blog post:**
```
User: animate my blog post at ${PROJECTS_DIR}/your-site/cms/blog/skills-vs-agents.md
```

**YouTube video:**
```
User: create animations for https://youtube.com/watch?v=xyz123
```

**Raw text:**
```
User: animate this content: "The three pillars of AI safety are..."
```

## Integration with Art Skill

This workflow inherits visual theming from Art preferences:
- Load: `~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md`
- Apply: Charcoal aesthetic, purple accents, organic animations
- Reference: `~/.claude/skills/Remotion/theme.ts`
