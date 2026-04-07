# Quick Research Workflow

**Mode:** Single Claude researcher, 1 query | **Timeout:** 30 seconds

## When to Use

- User says "quick research" or "minor research"
- Simple, straightforward queries
- Time-sensitive requests
- Just need a fast answer

## Workflow

### Step 0.5: Check Research Vault for Prior Work

Before spawning the agent, do a fast check of the research vault:

```
1. List files in MEMORY/RESEARCH/ (recursive, .md files only)
2. Match file names and directory names against the research topic keywords
3. If matches found: read the matched file's frontmatter/first 20 lines for a summary
```

**If relevant prior research exists:**
- Include a brief summary in the agent's prompt: "Prior research on this topic found: [summary]. Build on these findings."
- If prior research is comprehensive and recent (<30 days), suggest: "We have existing research on this topic from [date]. Want to extend it rather than start fresh?"

**If no relevant research:** Proceed normally.

### Step 1: Launch Single Claude Agent

**ONE Task call - Claude researcher with a single focused query:**

```typescript
Task({
  subagent_type: "ClaudeResearcher",
  description: "[topic] quick lookup",
  prompt: "Do ONE web search for: [query]. Return the key findings immediately. Keep it brief and factual."
})
```

**Prompt requirements:**
- Single, well-crafted query
- Instruct to return immediately after first search
- No multi-query exploration

### Step 2: Return Results

Report findings using standard format:

```markdown
📋 SUMMARY: Quick research on [topic]
🔍 ANALYSIS: [Key findings from Claude]
⚡ ACTIONS: 1 Claude query
✅ RESULTS: [Answer]
📊 STATUS: Quick mode - 1 agent, 1 query
📁 CAPTURE: [Key facts]
➡️ NEXT: [Suggest standard research if more depth needed]
📖 STORY EXPLANATION: [3-5 numbered points - keep brief]
🎯 COMPLETED: Quick answer on [topic]
```

## Speed Target

~10-15 seconds for results
