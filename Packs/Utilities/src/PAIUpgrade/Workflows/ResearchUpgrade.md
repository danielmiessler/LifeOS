# Research Upgrade Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ResearchUpgrade workflow in the PAIUpgrade skill to research upgrades"}' \
  > /dev/null 2>&1 &
```

Running the **ResearchUpgrade** workflow in the **PAIUpgrade** skill to research upgrades...

Deep dive on a specific upgrade opportunity to understand implementation details and create an actionable plan.

**Trigger:** "research this upgrade", "deep dive on [feature]", "dig deeper", "further research"

---

## Overview

When the Upgrade workflow discovers something interesting, use this workflow to:
1. Research the feature across authoritative sources
2. Understand implementation details and best practices
3. Map to the user's PAI architecture
4. Generate a detailed implementation plan

---

## Execution

### Step 1: Identify Research Target

Accept input as:
- Feature name from Upgrade workflow results
- URL (blog post, documentation, release notes)
- Video transcript excerpt
- Changelog entry

### Step 2: Launch Parallel Research Agents

Spawn 4 parallel agents to research the feature:

```
Use Task tool with subagent_type=general-purpose, run 4 agents in parallel:

Agent 1 - Official Documentation:
"Research [FEATURE] in official Anthropic documentation:
- Search docs.claude.com
- Check support.claude.com
- Look in modelcontextprotocol.io (if MCP-related)

Return: Official description, usage examples, any caveats or limitations."

Agent 2 - GitHub Sources:
"Research [FEATURE] in Anthropic GitHub repositories:
- anthropics/claude-code (README, CHANGELOG, docs/, examples/)
- anthropics/anthropic-sdk-python
- anthropics/anthropic-sdk-typescript
- modelcontextprotocol/ repositories

Return: Code examples, commit history mentioning feature, any discussions."

Agent 3 - Blog and Announcements:
"Search for [FEATURE] in Anthropic communications:
- anthropic.com/news
- anthropic.com/research
- Twitter/X @AnthropicAI

Return: Announcement context, intended use cases, any demos."

Agent 4 - Community Usage:
"Search for [FEATURE] in community resources:
- GitHub Discussions
- Stack Overflow
- Developer forums

Return: Real-world usage examples, common issues, tips from practitioners."
```

### Step 3: Synthesize Research

Compile findings into structured analysis:

| Aspect | Details |
|--------|---------|
| **What It Does** | Clear explanation from official sources |
| **How It Works** | Technical implementation details |
| **Use Cases** | Documented examples and patterns |
| **Limitations** | Known constraints or caveats |
| **Best Practices** | Recommended usage patterns |

### Step 4: Map to User's PAI

Using the user context from the Upgrade workflow (or gather fresh if not available):

| PAI Component | Potential Impact |
|---------------|------------------|
| Skills System | New capabilities, better patterns |
| Hooks System | New triggers, better event handling |
| Agent System | New delegation patterns |
| Tools | New CLI capabilities |
| Configuration | Settings changes |

### Step 5: Generate Implementation Plan

```markdown
# Upgrade Research: [Feature Name]
**Research Date:** [timestamp]

## Executive Summary
[2-3 sentences: what this is, why it matters, recommendation]

## Feature Analysis

### What It Does
[Clear explanation]

### Technical Details
[How it works under the hood]

### Use Cases
[Where and when to use it]

### Limitations
[What it can't do or edge cases]

## PAI Implementation

### Opportunity
[What this enables in your PAI setup]

### Implementation Steps
- [ ] Step 1: [specific action]
- [ ] Step 2: [specific action]
- [ ] Step 3: [specific action]

### Files to Modify
- `path/to/file.md` - [what changes]
- `path/to/another.ts` - [what changes]

### Effort Estimate
[Low/Medium/High with brief rationale]

### Dependencies
[What needs to be in place first]

## Research Sources
- [URL 1] - [what we learned]
- [URL 2] - [what we learned]

## Next Steps
- [ ] [Specific action to take]
```

---

## Special Case: Release Notes Deep Dive

When researching release notes specifically:

1. Run `/release-notes` or fetch latest CHANGELOG
2. Extract each significant feature
3. Launch parallel research for each feature
4. Compile into comprehensive upgrade roadmap

This replaces the former ReleaseNotesDeepDive workflow.

---

## Error Handling

- If research agents return sparse results: Note "limited documentation available"
- If feature is too new: Check GitHub commits/PRs directly
- If conflicting information: Prefer official docs > GitHub > community

---

## Example

```
User: "research the context forking feature"

[Spawn 4 research agents in parallel]

Agent 1: Found in docs.claude.com - context: fork allows skills to run isolated
Agent 2: Found in anthropics/claude-code CHANGELOG - introduced v1.0.15
Agent 3: Found in Anthropic blog - designed for complex skill workflows
Agent 4: Found in GitHub discussions - users report 40% latency reduction

# Upgrade Research: Context Forking
**Research Date:** 2026-01-15

## Executive Summary
Context forking allows skills to execute in isolated contexts, preventing prompt
bloat and improving latency. Highly relevant for your security hooks refactor.

## Feature Analysis

### What It Does
Creates a clean context when a skill executes, inheriting only specified context...

[continues with full analysis]
```

---

**This workflow takes a single upgrade opportunity and turns it into an actionable implementation plan with full research backing.**
