# Standard Research Workflow

**Mode:** 2 different researcher types, 1 query each | **Timeout:** 1 minute

## 🚨 CRITICAL: URL Verification Required

**BEFORE delivering any research results with URLs:**
1. Verify EVERY URL using WebFetch or curl
2. Confirm the content matches what you're citing
3. NEVER include unverified URLs - research agents HALLUCINATE URLs
4. A single broken link is a CATASTROPHIC FAILURE

See `SKILL.md` for full URL Verification Protocol.

## When to Use

- Default mode for most research requests
- User says "do research" or "research this"
- Need multiple perspectives quickly

## Workflow

### Step 0.5: Check Research Vault for Prior Work

Before spawning agents, check if the research vault already has relevant coverage:

```
1. List files in MEMORY/RESEARCH/ (recursive, .md files only)
2. Match file names and directory names against the research topic keywords
3. If matches found: read the matched file's frontmatter/first 20 lines for a summary
```

**If relevant prior research exists:**
- Include a brief summary in each agent's prompt as context: "Prior research on this topic found: [summary]. Build on these findings."
- If prior research is comprehensive and recent (<30 days), suggest to the user: "We have existing research on this topic from [date]. Want to extend it rather than start fresh?"

**If no relevant research:** Proceed normally.

### Step 1: Craft One Query Per Researcher

Create ONE focused query optimized for each researcher's strengths:
- **Claude**: Academic depth, detailed analysis, scholarly sources
- **Gemini**: Multi-perspective synthesis, cross-domain connections

### Step 2: Launch 2 Agents in Parallel (1 of each type)

**SINGLE message with 2 Task calls:**

```typescript
Task({
  subagent_type: "ClaudeResearcher",
  description: "[topic] analysis",
  prompt: "Do ONE search for: [query optimized for depth/analysis]. Return findings immediately."
})

Task({
  subagent_type: "GeminiResearcher",
  description: "[topic] perspectives",
  prompt: "Do ONE search for: [query optimized for breadth/perspectives]. Return findings immediately."
})
```

**Each agent:**
- Gets ONE query
- Does ONE search
- Returns immediately

### Step 3: Quick Synthesis

Combine the two perspectives:
- Note where they agree (high confidence)
- Note unique contributions from each
- Flag any conflicts

### Step 4: VERIFY ALL URLs (MANDATORY)

**Before delivering results, verify EVERY URL:**

```bash
# For each URL returned by agents:
curl -s -o /dev/null -w "%{http_code}" -L "URL"
# Must return 200

# Then verify content:
WebFetch(url, "Confirm article exists and summarize main point")
# Must return actual content, not error
```

**If URL fails verification:**
- Remove it from results
- Find alternative source via WebSearch
- Verify the replacement URL
- NEVER include unverified URLs

### Step 5: Return Results

```markdown
📋 SUMMARY: Research on [topic]
🔍 ANALYSIS: [Key findings from 2 perspectives]
⚡ ACTIONS: 2 researchers × 1 query each
✅ RESULTS: [Synthesized answer]
📊 STATUS: Standard mode - 2 agents, 1 query each
📁 CAPTURE: [Key facts]
➡️ NEXT: [Suggest extensive if more depth needed]
📖 STORY EXPLANATION: [5-8 numbered points]
🎯 COMPLETED: Research on [topic] complete
```

## Speed Target

~15-30 seconds for results
