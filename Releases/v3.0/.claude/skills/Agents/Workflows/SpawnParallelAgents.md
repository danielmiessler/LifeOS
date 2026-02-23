# SpawnParallelAgents Workflow

**Launches multiple parallel agents for grunt work - same task, different inputs.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the SpawnParallelAgents workflow in the Agents skill to launch agents"}' \
  > /dev/null 2>&1 &
```

Running **SpawnParallelAgents** in **Agents**...

---

## When to Use

{PRINCIPAL.NAME} says:
- "Launch 5 agents to research these companies"
- "Spin up agents to process this list"
- "Create agents to analyze these files" (no "custom")

**KEY: No "custom" keyword = simple parallel workers for grunt work (fast execution)**

**NOT the same as custom agents** - for unique personalities/voices/colors, use the CreateCustomAgent workflow.

## The Workflow

### Step 1: Identify Task List

Extract what needs to be done in parallel:
- List of companies to research
- Files to analyze
- URLs to check
- Data points to investigate

### Step 2: Create Task-Specific Prompts

**Each agent gets a DETAILED prompt with FULL CONTEXT and TIMING SCOPE:**

```typescript
const agent1Prompt = `
## Context
We're researching competitors in the AI security space for strategic planning.

## Current State
We have 10 companies identified. You're analyzing Company A.

## Task
1. Research Company A's recent product launches (last 6 months)
2. Identify their target market and positioning
3. Note any key partnerships or acquisitions
4. Assess their technical approach

## Success Criteria
- Specific product names and launch dates
- Clear target market definition
- List of partnerships with dates
- Technical stack/approach summary

## Scope
Timing: STANDARD — focused implementation.
- Under 1500 words
- Stay on task, minimal tangents
- Deliver the work, verify it works

Company A: Acme AI Security Corp
`;
```

### Step 3: Launch ALL Agents in SINGLE Message

**CRITICAL: Use ONE message with MULTIPLE Task calls for true parallel execution:**

```typescript
// Send as a SINGLE message with all Task calls:
Task({
  description: "Research Company A",
  prompt: agent1Prompt,
  subagent_type: "Intern",
  model: "haiku"  // or "sonnet" depending on complexity
})
Task({
  description: "Research Company B",
  prompt: agent2Prompt,
  subagent_type: "Intern",
  model: "haiku"
})
Task({
  description: "Research Company C",
  prompt: agent3Prompt,
  subagent_type: "Intern",
  model: "haiku"
})
// ... up to N agents
```

**All agents run simultaneously and return results together.**

### Step 4: Spotcheck Results (Mandatory)

**ALWAYS launch a spotcheck agent after parallel work completes:**

```typescript
Task({
  description: "Spotcheck parallel results",
  prompt: `Review these research results for consistency and completeness:

Company A: [results]
Company B: [results]
Company C: [results]

Check for:
1. Missing information across any companies
2. Inconsistent data formats
3. Obvious gaps or errors
4. Recommendations for follow-up research

Provide a brief assessment and any issues found.`,
  subagent_type: "Intern",
  model: "haiku"
})
```

## Timing & Model Selection

**Timing flows from the Algorithm.** The main agent validates a timing tier (fast|standard|deep) in the THINK phase. Every agent prompt MUST include a `## Scope` section:

| Timing | Model | Scope |
|--------|-------|-------|
| `fast` | `haiku` | Under 500 words, direct answer only |
| `standard` | `sonnet` | Focused work, under 1500 words |
| `deep` | `opus` | Comprehensive analysis, no limit |

**Choose model based on timing tier AND task complexity:**

| Task Type | Model | Reason |
|-----------|-------|--------|
| Simple checks (URL validation, file existence, basic lookups) | `haiku` | 10-20x faster, more than sufficient |
| Standard research/analysis (company research, code review) | `sonnet` | Balanced capability and speed |
| Deep reasoning (strategic analysis, architectural decisions) | `opus` | Maximum intelligence required |

**Parallel execution especially benefits from `haiku` - spawning 10 haiku agents is both faster AND cheaper than 1 opus agent doing sequential work.**

## Example: Research 5 Companies

**{PRINCIPAL.NAME}:** "Launch agents to research these 5 AI security companies"

**{DAIDENTITY.NAME}'s Execution:**
```typescript
// Single message with 5 Task calls:
Task({
  description: "Research Acme AI Security",
  prompt: "Research Acme AI Security Corp: products, market, partnerships, tech stack",
  subagent_type: "Intern",
  model: "sonnet"
})
Task({
  description: "Research Bolt Security AI",
  prompt: "Research Bolt Security AI: products, market, partnerships, tech stack",
  subagent_type: "Intern",
  model: "sonnet"
})
Task({
  description: "Research Cipher AI Defense",
  prompt: "Research Cipher AI Defense: products, market, partnerships, tech stack",
  subagent_type: "Intern",
  model: "sonnet"
})
Task({
  description: "Research Delta Threat Intel",
  prompt: "Research Delta Threat Intelligence: products, market, partnerships, tech stack",
  subagent_type: "Intern",
  model: "sonnet"
})
Task({
  description: "Research Echo AI Protection",
  prompt: "Research Echo AI Protection Systems: products, market, partnerships, tech stack",
  subagent_type: "Intern",
  model: "sonnet"
})

// After results return, spotcheck:
Task({
  description: "Spotcheck company research",
  prompt: "Review these 5 company research results for consistency and gaps: [results]",
  subagent_type: "Intern",
  model: "haiku"
})
```

**Result:** 5 agents research in parallel, spotcheck validates consistency.

## Common Patterns

### Pattern 1: List Processing

**Input:** List of items (companies, files, URLs, people)
**Action:** Create one agent per item, identical task structure
**Model:** `haiku` for simple tasks, `sonnet` for analysis

```typescript
const items = ["Item1", "Item2", "Item3", "Item4", "Item5"];

// Single message with all agents:
items.forEach(item => {
  Task({
    description: `Process ${item}`,
    prompt: `Analyze ${item} for: [criteria]`,
    subagent_type: "Intern",
    model: "haiku"
  });
});
```

### Pattern 2: Multi-File Analysis

**Input:** Multiple files to analyze
**Action:** One agent per file, same analysis criteria
**Model:** `sonnet` for code analysis, `haiku` for simple checks

```typescript
const files = ["src/auth.ts", "src/db.ts", "src/api.ts"];

// Single message:
files.forEach(file => {
  Task({
    description: `Analyze ${file}`,
    prompt: `Review ${file} for security issues, focusing on: [checklist]`,
    subagent_type: "Intern",
    model: "sonnet"
  });
});
```

### Pattern 3: Data Point Investigation

**Input:** Multiple data points/questions
**Action:** One agent per question, independent research
**Model:** `sonnet` for research, `haiku` for fact-checking

```typescript
const questions = [
  "What is OpenAI's current revenue?",
  "How many employees does Anthropic have?",
  "What's Google's AI chip roadmap?",
  "When is GPT-5 releasing?",
  "What's the latest on AI regulation in EU?"
];

// Single message:
questions.forEach(q => {
  Task({
    description: `Research: ${q}`,
    prompt: `Find reliable answer to: ${q}. Include sources.`,
    subagent_type: "Intern",
    model: "haiku"
  });
});
```

## Spotcheck Pattern (Mandatory)

**WHY:** Parallel agents may produce inconsistent formats, miss details, or have conflicting information.

**WHEN:** After EVERY parallel agent batch completes

**HOW:**
```typescript
Task({
  description: "Spotcheck results",
  prompt: `Review these parallel results:

[Agent 1 results]
[Agent 2 results]
[Agent N results]

Verify:
- Consistent formatting
- No missing information
- No obvious errors
- No conflicting data

Flag any issues for follow-up.`,
  subagent_type: "Intern",
  model: "haiku"  // Fast spotcheck
})
```

## Common Mistakes to Avoid

**❌ WRONG: Sequential execution**
```typescript
await Task({ ... }); // Agent 1 (blocks)
await Task({ ... }); // Agent 2 (waits for 1)
await Task({ ... }); // Agent 3 (waits for 2)
// Takes 3x as long!
```

**✅ RIGHT: Parallel execution**
```typescript
// Send ONE message with multiple Task calls:
Task({ ... })  // Agent 1
Task({ ... })  // Agent 2
Task({ ... })  // Agent 3
// All run simultaneously
```

**❌ WRONG: Using ComposeAgent for generic agents**
```bash
# Overkill for simple parallel work
bun run ComposeAgent.ts --traits "research,analytical"
```

**✅ RIGHT: Direct Intern launch**
```typescript
// Simple and fast
Task({
  description: "Research X",
  prompt: "Research X and report findings",
  subagent_type: "Intern",
  model: "haiku"
})
```

**❌ WRONG: Skipping spotcheck**
```typescript
// Launch agents, get results, done
// No validation = potential inconsistencies
```

**✅ RIGHT: Always spotcheck**
```typescript
// Launch agents
// Get results
// Spotcheck for consistency
// THEN report as complete
```

**❌ WRONG: Using opus for simple parallel tasks**
```typescript
// Each agent uses opus = slow + expensive
Task({ ..., model: "opus" })
Task({ ..., model: "opus" })
Task({ ..., model: "opus" })
```

**✅ RIGHT: Use haiku for grunt work**
```typescript
// 10-20x faster, sufficient for simple tasks
Task({ ..., model: "haiku" })
Task({ ..., model: "haiku" })
Task({ ..., model: "haiku" })
```

## Voice Output

## Voice Output

For grunt work, voice output is optional. If enabled, all parallel agents use the default voice configuration.

This is intentional - for parallel grunt work, we prioritize speed over personality diversity. **For unique voices and identities, use the CreateCustomAgent workflow instead.**

## When to Use Custom Agents Instead

Use **CreateCustomAgent workflow** when:
- User says "custom agents" (the key trigger)
- You need distinct personalities/perspectives
- Voice and color diversity matters
- Different analytical approaches required
- Each agent brings unique expertise

Use **SpawnParallelAgents workflow** when:
- Simple parallel processing (no "custom" keyword)
- Same task, different inputs
- Speed matters more than personality
- Identity diversity not needed

## Related Workflows

- **CreateCustomAgent** - For agents with unique personalities, voices, and colors
- **ListTraits** - Show available traits for custom agents

## References

- Agent personalities: `~/.claude/skills/Agents/AgentPersonalities.md`
