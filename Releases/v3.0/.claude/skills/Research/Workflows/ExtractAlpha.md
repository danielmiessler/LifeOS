# Extract Alpha

Extract the highest-alpha ideas from content using deep deep thinking analysis.

Finds the most surprising, insightful, and novel ideas through systematic deep reasoning.
Focuses on what's genuinely new, counterintuitive, and profound.

USE WHEN analyzing podcasts, videos, articles, essays, or any content where you want to capture
the most important and surprising insights without missing subtle but profound ideas.

# Extract Alpha - Deep Content Analysis

## 🎯 Load Full PAI Context

**Before starting any task with this skill, load complete PAI context:**

`read ~/.claude/skills/PAI/SKILL.md`

## Core Philosophy

Based on Claude Shannon's information theory: **real information is what's different, not what's the same.**

This skill finds:
- Net new ideas and novel presentations
- New frameworks for combining ideas
- Surprising insights that challenge assumptions
- Subtle but profound observations
- Non-obvious connections and implications

**The Problem This Solves:** Standard extraction often misses:
- Subtle philosophical implications
- Non-obvious connections between ideas
- Counterintuitive observations buried in conversation
- Novel frameworks that aren't explicitly stated
- Surprising reframings of common concepts
- Low-probability but brilliant insights

## When to Activate This Skill

- Analyzing YouTube videos, podcasts, interviews
- Processing essays, articles, blog posts
- Deep content analysis where missing insights is unacceptable
- User says "extract the most important ideas"
- Need to find alpha/novelty in dense content
- Standard patterns failed to capture key insights
- User explicitly requests "extract alpha" or "deep analysis"

## The Five-Step Process

### Step 1: Content Extraction

**For YouTube videos:**
```bash
fabric -y "YOUTUBE_URL"
```

**For other content:**
- Paste text directly
- Use WebFetch for articles
- Read from files

### Step 2: Deep deep thinking Analysis

Before extracting anything, engage in extended deep thinking using the deep thinking protocol:

**deep thinking Protocol:**
```
DEEP THINKING DEEP ANALYSIS MODE:

Think deeply and extensively about this content:

1. SURFACE SCAN - What are the obvious main points?
2. DEPTH PROBE - What implications aren't explicitly stated?
3. CONNECTION MAP - What unusual connections exist between ideas?
   - WONDER TRIGGER: What makes you stop and think "wait, how does THAT work?"
   - CROSS-DOMAIN PATTERNS: What seemingly different things (human/AI, biology/ML, physics/economics) share the same underlying principle?
   - PERSONAL RELEVANCE: What applies to YOUR life in a surprising way?
   - AHA MOMENTS: What connections make you see familiar things differently?
4. ASSUMPTION CHALLENGE - What conventional wisdom is being questioned?
5. NOVELTY DETECTION - What's genuinely new or surprising here?
6. FRAMEWORK EXTRACTION - What mental models or frameworks emerge?
7. SUBTLE INSIGHTS - What quiet observations carry profound weight?
8. CONTRARIAN ANGLES - What goes against common thinking?
9. FUTURE IMPLICATIONS - What does this suggest about what's coming?
10. SYNTHESIS - What are the highest-alpha ideas across all dimensions?

Allow thinking to wander and make unexpected connections.
Question every assumption about what's "important."
Look for ideas that make you pause and reconsider.
Prioritize novelty and surprise over comprehensiveness.
```

### Step 3: Extract Insights

After deep thinking, extract the highest-alpha insights:

**Extraction Protocol:**
```
Generate 24-30 highest-alpha ideas from your deep analysis.

For each insight:
- Write in 8-12 word bullets (allow flexibility for clarity)
- Use approachable Paul Graham style
- Prioritize ideas that are:
  * Make you pause and think "wait, WHAT?"
  * Spark curiosity or wonder
  * Reveal cross-domain patterns (same principle across human/AI, biology/ML, etc.)
  * Expose underlying associations that weren't obvious
  * Feel personally relevant or change how you see yourself
  * Challenge how you understand familiar things
  * Make you want to tell someone else
  * Create "holy shit" or "aha!" moments
  * Include specific details WHEN they enhance the surprise/insight
  * Make you reconsider your assumptions about the world

Focus on low-probability insights that are coherent and valuable.
Avoid obvious takeaways and surface-level observations.
Capture the subtle genius buried in the content.
```

### Step 4: File Organization - Scratch → History Pattern

**CRITICAL:** Follow the proper file organization pattern for all extractalpha work:

#### Working Files (Temporary Analysis)

**Use the current work item's scratch/ directory for all working files during analysis:**

```bash
~/.claude/MEMORY/WORK/{current_work}/scratch/
```

**To get the current work directory:**
1. Read `~/.claude/MEMORY/STATE/current-work.json`
2. Extract the `work_dir` value
3. Use `~/.claude/MEMORY/WORK/{work_dir}/scratch/` for temporary artifacts

**What goes in scratch/:**
- Raw transcripts from fabric -y
- Intermediate analysis notes
- deep thinking working thoughts
- Draft versions of insights
- Any temporary files during the extraction process

**Why this pattern:**
- Ties iterative work artifacts to the work item for learning
- System can analyze how research progresses over time
- Scratch artifacts provide context for the final outputs

**Example scratch structure:**
```
~/.claude/MEMORY/WORK/20260111-172408_extract-alpha-analysis/scratch/
├── raw-transcript.txt
├── deep thinking-notes.md
├── draft-insights.md
└── working-analysis.md
```

#### Permanent Output (Final Research)

**Save final outputs to permanent history:**

```bash
~/.claude/History/research/YYYY-MM-DD_description/
```

**What goes in history/research/:**
- **extract_alpha.md** - The final 24-30 insights (formatted output)
- **deep thinking-analysis.md** - Full deep thinking deep analysis (all 10 dimensions)
- **README.md** - Documentation of the research session
- Source metadata (URL, title, date analyzed, content type)

**Example history structure:**
```
~/.claude/History/research/2025-10-26_podcast-analysis/
├── README.md                  # Research session documentation
├── extract_alpha.md           # Final 24-30 insights
├── deep thinking-analysis.md     # Full deep analysis
└── metadata.json              # Source info, timestamps, etc.
```

#### README.md Template

Create a README.md in the history directory documenting the research:

```markdown
# Extract Alpha - [Content Title]

## Source Information
- **URL/Title:** [Source URL or title]
- **Content Type:** [YouTube video / Article / Podcast / Essay]
- **Date Analyzed:** YYYY-MM-DD
- **Analysis Duration:** [Time spent]

## Analysis Method
- deep thinking Deep Analysis (10-dimension framework)
- Focus on low-probability but brilliant insights

## Key Findings Summary
[2-3 sentence summary of the most important insights discovered]

## Output Files
- `extract_alpha.md` - Final 24-30 highest-alpha insights
- `deep thinking-analysis.md` - Complete deep thinking analysis
- `metadata.json` - Structured source and analysis metadata

## Notes
[Any important observations about the analysis process or content]
```

#### Verification Step (MANDATORY)

**ALWAYS verify output is properly captured:**

1. **Check if hooks captured the output:**
   ```bash
   # Check most recent history entries
   ls -lt ~/.claude/History/research/ | head -5

   # Verify your research directory exists
   ls ~/.claude/History/research/YYYY-MM-DD_description/
   ```

2. **If hooks did NOT capture automatically:**
   ```bash
   # Create directory structure manually
   mkdir -p ~/.claude/History/research/YYYY-MM-DD_description/

   # Save extract_alpha.md (final insights)
   # Save deep thinking-analysis.md (full analysis)
   # Create README.md (documentation)
   # Add metadata.json (source info)
   ```

3. **Confirm all files saved:**
   ```bash
   ls -lah ~/.claude/History/research/YYYY-MM-DD_description/
   # Should show: README.md, extract_alpha.md, deep thinking-analysis.md, metadata.json
   ```

#### Complete Workflow Example

```bash
# 1. Get current work directory
WORK_DIR=$(jq -r '.work_dir' ~/.claude/MEMORY/STATE/current-work.json)

# 2. Create scratch workspace in current work item
mkdir -p ~/.claude/MEMORY/WORK/${WORK_DIR}/scratch/
cd ~/.claude/MEMORY/WORK/${WORK_DIR}/scratch/

# 3. Extract content to scratch
fabric -y "YOUTUBE_URL" > raw-transcript.txt

# 4. Perform deep thinking analysis (working notes in scratch)
# [Deep thinking happens here, notes saved to scratch]

# 5. Extract insights
# [Extract 24-30 insights from deep thinking analysis, draft in scratch]

# 6. Create permanent history directory
mkdir -p ~/.claude/History/research/$(date +%Y-%m-%d)_podcast-analysis/

# 7. Save final outputs to history
# - extract_alpha.md (final insights)
# - deep thinking-analysis.md (full deep thinking)
# - README.md (documentation)
# - metadata.json (source info)

# 8. Verify hooks captured it
ls -lah ~/.claude/History/research/$(date +%Y-%m-%d)_podcast-analysis/

# 9. Note: scratch/ artifacts remain tied to work item for learning
# (Don't delete scratch - it provides context for the work item)
```

#### Why This Pattern Matters

1. **Work item integration:** Scratch artifacts are tied to the work item for learning
2. **System intelligence:** PAI can analyze how research progresses over time
3. **Context preservation:** Scratch provides context for final outputs
4. **Proper documentation:** README ensures context is preserved in history
5. **Hook verification:** Ensures nothing is lost if hooks fail
6. **deep thinking preservation:** Full deep analysis is saved, not just final insights
7. **Research continuity:** Can revisit analysis methodology later

## Output Format

Simple markdown list with blank lines between items for readability:

```markdown
# EXTRACT ALPHA

- First high-alpha insight in approachable style

- Second surprising idea that challenges assumptions

- Novel framework or mental model discovered

- Non-obvious connection between concepts

- Counterintuitive observation with implications

- Subtle but profound philosophical point

[... continue for 24-30 items total ...]
```

**Quality over quantity:** If content only has 15 truly novel insights, extract 15. Don't pad with obvious ideas.

## What to Look For

### HIGH-ALPHA SIGNALS:
- Makes you stop and reconsider something you thought you knew
- Connects ideas from different domains unexpectedly
- Challenges industry consensus or common wisdom
- Reframes a familiar concept in a surprising way
- Has second-order implications not explicitly stated
- Feels counterintuitive but makes sense upon reflection
- Represents a novel mental model or framework
- Captures a subtle observation with profound weight

### LOW-ALPHA SIGNALS (avoid):
- Restates common knowledge
- Obvious implications or direct quotes of main points
- Generic advice that could apply to anything
- Surface-level observations without depth
- Ideas you've heard many times before
- Purely factual information without insight

## Comparison to Standard Patterns

**extract_wisdom:**
- Comprehensive: IDEAS, INSIGHTS, QUOTES, HABITS, FACTS, REFERENCES
- Structured 16-word bullets
- Captures breadth
- Can miss subtle depth

**extract_alpha (original):**
- 24 items, 8-word bullets
- Focuses on novelty
- Paul Graham style
- Can miss ideas due to mode collapse

**extractalpha (this skill):**
- 24-30 items, 8-12 word bullets (flexible)
- Deep deep thinking analysis first
- Focuses on low-probability but brilliant insights
- Specifically designed to NOT miss subtle profound ideas
- Prioritizes surprise and novelty over comprehensiveness

## Usage Examples

### Example 1: YouTube Video Analysis

```bash
# Step 1: Extract transcript
fabric -y "https://youtu.be/VIDEO_ID"

# Step 2 & 3: Apply this skill (PAI does this automatically)
# - Deep deep thinking analysis
# - Extract insights
# - Output 24-30 highest-alpha insights
```

### Example 2: Article Analysis

```typescript
// User provides article URL or text
// PAI:
// 1. Fetches content (WebFetch or direct paste)
// 2. Applies deep thinking protocol
// 3. Extracts insights
// 4. Returns high-alpha list
```

## Integration with PAI

When this skill activates, PAI should:

1. **Load content** via appropriate method (fabric -y, WebFetch, Read, or paste)
2. **Get current work directory** - Read `~/.claude/MEMORY/STATE/current-work.json` for `work_dir`
3. **Create scratch workspace** - Work in `~/.claude/MEMORY/WORK/{work_dir}/scratch/`
4. **Engage deep thinking mode** - Deep extended thinking through all 10 dimensions
5. **Extract insights** - Extract 24-30 highest-alpha ideas focusing on low-probability brilliant insights
6. **Save to history** - Final outputs to `~/.claude/History/research/YYYY-MM-DD_description/`
7. **Verify capture** - Ensure hooks captured or manually save all files
8. **Output simple list** - Unformatted markdown, Paul Graham style, 8-12 words each
9. **Prioritize surprise** - Novel ideas over obvious takeaways

### Internal Prompt Pattern

```
<instructions>
STEP 1 - DEEP THINKING DEEP ANALYSIS:
Think deeply and extensively about this content:
- What makes you stop and think "wait, WHAT?"
- What feels personally relevant in a surprising way?
- What changes how you see familiar things?
- What sparks genuine curiosity or wonder?
- What would make you want to tell someone about it?
- What creates "holy shit" or "aha!" moments?
- What cross-domain patterns exist (same principle across human/AI, biology/ML, physics/economics)?
- What underlying associations connect seemingly unrelated things?
- What implications aren't explicitly stated?
- What unusual connections exist between ideas?
- What conventional wisdom is being questioned?
- What's genuinely new or surprising?
- What mental models or frameworks emerge?
- What quiet observations carry profound weight?
- What goes against common thinking?
- What does this suggest about the future?

Explore the full conceptual space. Make unexpected connections.
Question assumptions about what's "important."
Prioritize insights that create WONDER, CURIOSITY, PERSONAL RELEVANCE, and CROSS-DOMAIN PATTERNS.
Focus on what's INTERESTING/SURPRISING/INSIGHTFUL, not just technical or comprehensive.

STEP 2 - EXTRACT INSIGHTS:
Generate 24-30 highest-alpha insights from your deep analysis.

Focus on:
- Low-probability but brilliant insights
- Ideas that make you pause and think "whoa"
- Cross-domain patterns that reveal same principles across fields
- Underlying associations between seemingly unrelated things
- Connections that feel personally relevant
- Observations that spark wonder or curiosity
- Ideas that make you see familiar things differently
- Insights you'd want to share with someone
- Counterintuitive ideas that challenge assumptions
- Subtle observations with profound emotional weight

For each insight:
- Write in approachable 8-12 word bullets (Paul Graham style)
- Avoid surface-level observations
- Capture what's INTERESTING, SURPRISING, and INSIGHTFUL
- Reveal cross-domain patterns and underlying associations
- Include specific details WHEN they enhance the wonder/surprise
- Focus on emotional impact and personal relevance
- Include ideas standard patterns would miss

Output Format:
# EXTRACT ALPHA

- [Insight 1]

- [Insight 2]

[... 24-30 total items with blank lines between each ...]
</instructions>

[CONTENT TO ANALYZE]
```

## Example Output Quality

**What standard extract_alpha might miss:**
- "We're not building animals, we're building ghosts" (profound reframing)
- "Pre-training is like crappy evolution" (novel framework)
- "Context window is working memory, weights are hazy recollection" (powerful analogy)
- "In-context learning might implement gradient descent internally" (deep technical insight)
- "Agents are trying to get the full thing too early" (historical pattern observation)

**What extractalpha (this skill) captures:**
ALL of the above plus more subtle implications and connections.

## Key Principles

1. **Think first, extract second** - deep thinking before output
2. **Focus on low-probability insights** - Don't just grab obvious ideas
3. **Prioritize surprise** - Novel > comprehensive
4. **Capture subtlety** - Profound quiet observations matter
5. **Challenge assumptions** - What's the conventional wisdom being questioned?
6. **Find connections** - Non-obvious links between ideas
7. **Flexible length** - 8-12 words, whatever achieves clarity
8. **Quality threshold** - Better 15 brilliant insights than 30 padded ones
9. **Cross-domain patterns** - Same principles across different fields
10. **Personal relevance** - What changes how you see things?

## Common Failure Modes to Avoid

1. **Mode collapse** - Only extracting high-probability obvious ideas
2. **Surface skimming** - Missing depth for breadth
3. **Quote collection** - Restating without extracting insight
4. **Comprehensiveness trap** - Trying to capture everything instead of highest alpha
5. **Rigid formatting** - Forcing 8 words when 10 would be clearer
6. **Obvious takeaways** - Extracting main points instead of surprising implications

## Success Criteria

You've succeeded with this skill when:
- User says "YES! That's exactly the insight I was thinking about!"
- Extracted ideas include subtle observations you almost missed
- Low-probability but profound insights are captured
- Novel frameworks and mental models are identified
- Reading the extraction makes you reconsider your understanding
- No important surprising ideas are missing from the output

## Quick Reference

**Four-step process:**
1. Extract content (fabric -y, WebFetch, Read, paste)
2. Deep deep thinking (10-dimension analysis) - work in scratch/
3. Extract insights (24-30 highest-alpha ideas, 8-12 words)
4. Save to history (verify hooks captured output) - scratch artifacts stay with work item

**Output format:**
- Simple markdown list with blank lines between items
- Paul Graham approachable style
- 8-12 word bullets (flexible)
- Prioritize novelty and surprise

**Remember:**
- Real information is what's different
- Think deeply before extracting
- Focus on low-probability but brilliant insights
- Capture subtle profound observations
- Novel frameworks over obvious takeaways
- Quality over quantity
