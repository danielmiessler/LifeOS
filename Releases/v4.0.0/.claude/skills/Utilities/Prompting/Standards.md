---
type: documentation
category: methodology
description: Prompt engineering standards based on Anthropic's Claude 4.x best practices (November 2025), context engineering principles, and the Fabric system. Universal principles for semantic clarity, multi-context workflows, and agentic coding patterns. Validated by empirical research showing 10-90% performance impact from structure choices.
---

# Prompt Engineering Standards

**Foundation:** Based on Anthropic's Claude 4.x Best Practices (November 2025), context engineering principles, and the Fabric system. Validated by empirical research across 1,500+ academic papers and production systems.

**Philosophy:** Universal principles of semantic clarity and structure that work regardless of model implementation, with specific optimizations for Claude 4.x behavioral patterns.

---

# Core Philosophy

**Context engineering** is the set of strategies for curating and maintaining the optimal set of tokens (information) during LLM inference.

**Primary Goal:** Find the smallest possible set of high-signal tokens that maximize the likelihood of desired outcomes.

---

# Claude 4.x Behavioral Characteristics

**Critical Understanding:** Claude 4.x models have distinct behavioral patterns that affect prompting strategy.

## Communication Style Changes

- **More direct reporting:** Claude 4.5 provides fact-based progress updates, may skip detailed summaries
- **Conversational efficiency:** Natural language without unnecessary elaboration
- **Request verbosity explicitly:** Add "After completing a task that involves tool use, provide a quick summary of the work you've done"

## Attention to Detail

- **Example sensitivity:** Claude 4.x pays close attention to details in examples—ensure examples match desired outcomes exactly
- **Misaligned examples encourage unintended behaviors**
- **Be vigilant:** Every example shapes behavior

## Tool Usage Patterns

- **Opus 4.5 may overtrigger tools:** Dial back aggressive language
- **Change:** "CRITICAL: You MUST use this tool" → "Use this tool when..."
- **Softer framing:** Reduces excessive tool invocation

## Extended Thinking Sensitivity

When extended thinking is disabled:
- **Avoid:** "think", "think about", "think through"
- **Use instead:** "consider", "believe", "evaluate", "reflect", "assess"
- **Guide reflection:** "After receiving tool results, carefully reflect on their quality and determine optimal next steps before proceeding"

---

# Key Principles

## 0. Markdown Only - NO XML Tags

**CRITICAL: We use markdown for ALL prompt structure. Never use XML tags.**

❌ **NEVER use XML-style tags:**
```
<instructions>Do something</instructions>
<context>Some context</context>
<output_format>JSON</output_format>
```

✅ **ALWAYS use markdown headers:**
```markdown
## Instructions

Do something

## Context

Some context

## Output Format

JSON
```

**Why markdown over XML:**
- Maximum readability for creators and users
- Consistent with our markdown-zealot philosophy
- Clear structure emphasizes what AI should do and in what order
- No special parsing required - just standard markdown

This applies to: skill files, workflow files, prompt templates, and all documentation.

## 1. Be Explicit with Instructions

Claude 4.x requires clear, specific direction rather than vague requests.

**Previous behavior may need explicit requesting:**
- "Include as many relevant features and interactions as possible"
- "Go beyond basics"
- Quality modifiers enhance results

## 2. Add Context and Motivation

Explain *why* certain behavior matters to help Claude understand goals.

✅ **Good:**
```
Your response will be read aloud by text-to-speech, so never use ellipses or incomplete sentences.
```

❌ **Bad:**
```
NEVER use ellipses.
```

Claude generalizes well from reasoning provided in context.

## 3. Tell Instead of Forbid

Frame instructions positively rather than as prohibitions.

✅ **Good:**
```
Compose smoothly flowing prose paragraphs with natural transitions.
```

❌ **Bad:**
```
Do not use markdown or bullet points.
```

**Why it works:** Positive framing gives Claude a clear target rather than a void to avoid.

## 4. Context is a Finite Resource

- LLMs have a limited "attention budget"
- As context length increases, model performance degrades
- Every token depletes attention capacity
- Treat context as precious and finite

## 5. Optimize for Signal-to-Noise Ratio

- Prefer clear, direct language over verbose explanations
- Remove redundant or overlapping information
- Focus on high-value tokens that drive desired outcomes

## 6. Match Prompt Style to Output Style

- Removing markdown from prompts reduces markdown in responses
- Prompt formatting influences output formatting
- Use markdown headers to indicate desired output format (e.g., `## Prose Output`)

---

# Multi-Context Window Workflows

**New in Claude 4.x:** Optimized patterns for long-horizon tasks spanning multiple context windows.

## First Context Setup

Establish framework before iterative work:
- Create test structures
- Set up validation scripts
- Define success criteria

## State Tracking Approaches

**Structured formats (JSON):** For schema-dependent data like tests

```json
{
  "tests": [
    {"name": "auth_flow", "status": "passing"},
    {"name": "data_export", "status": "failing", "reason": "timeout"}
  ]
}
```

**Unstructured text:** For progress notes and general tracking

**Git:** For checkpoints and historical logs across sessions

## Quality of Life Tools

Create setup scripts (`init.sh`) for:
- Graceful server startup
- Test environment initialization
- State restoration

## Starting Fresh vs. Compacting

- **Claude 4.5 excels at discovering state from filesystem**
- Consider full context resets rather than aggressive compaction
- Fresh context can be more effective than degraded long context

## Verification Without Human Feedback

Provide testing capabilities:
- Playwright for browser validation
- Computer use for visual verification
- Automated test suites
- Self-checking mechanisms

## Complete Context Usage

For complex tasks:
```
Spend your entire output context working on the task.
```

## Context Window Awareness

Claude 4.5 tracks remaining context throughout conversations:
```
Your context window will be automatically compacted as it approaches its limit, allowing you to continue working indefinitely.
```

Pair with memory tools for seamless transitions.

---

# Proactive vs. Conservative Action Patterns

## Default to Action (Implementation-Focused)

```markdown
## Action Bias

By default, implement changes rather than only suggesting them. Infer likely useful actions when intent is unclear, using tools to discover missing details instead of guessing.
```

**Less effective:** "Can you suggest some changes?"
**More effective:** "Change this function to improve performance"

## Conservative Action (Research-Focused)

```markdown
## Action Bias

Do not jump into implementation unless clearly instructed. Default to information, research, and recommendations rather than taking action.
```

---

# Parallel Tool Calling

## Maximize Parallel Efficiency

```markdown
## Parallel Execution

If calling multiple tools with no dependencies, make all independent calls in parallel. Prioritize simultaneous execution. For example, read 3 files in 3 parallel calls. Maximize parallel tool use for speed. If calls depend on previous results, call sequentially. Never use placeholders or guess parameters.
```

## Reduce Parallel Execution (When Needed)

```
Execute operations sequentially with brief pauses between steps to ensure stability.
```

---

# Agentic Coding Best Practices

## Read Before Edit

```markdown
## Verification

Never speculate about code you haven't opened. If a specific file is referenced, READ it before answering. Investigate relevant files BEFORE answering codebase questions. Give grounded, hallucination-free answers based on actual code inspection.
```

## Encourage Code Exploration

```
ALWAYS read and understand relevant files before proposing edits. Do not speculate about code you haven't inspected. If a specific file is referenced, you MUST open and inspect it before explaining or proposing fixes. Be rigorous in code searches and thoroughly review codebase style before implementing new features.
```

## Prevent Overengineering

```
Avoid over-engineering. Only make directly requested or clearly necessary changes. Keep solutions simple and focused. Don't add unrequested features, refactor surrounding code, or build hypothetical flexibility. Implement minimum complexity needed for current task. Reuse existing abstractions and follow DRY principles.
```

## Minimize File Creation

```
If you create temporary files, scripts, or helpers, remove them at task end.
```

## Avoid Test-Focused Hard-Coding

```
Write high-quality, general-purpose solutions using standard tools. Don't create helper scripts or workarounds. Implement logic working for all valid inputs, not just test cases. Don't hard-code values. Focus on understanding requirements and implementing correct algorithms. Provide principled, maintainable, extendable implementations following best practices.
```

---

# Subagent Orchestration

**Claude 4.5 naturally recognizes when tasks benefit from specialized subagent delegation.**

## Best Practices

- Ensure well-defined subagent tools with clear descriptions
- Model orchestrates naturally without explicit instruction
- To restrict delegation: "Only delegate when tasks clearly benefit from a separate agent with new context window"

## Subagent Context Design

Each subagent should receive:
- Minimal, task-specific context
- Clear success criteria
- Structured interfaces for communication

---

# Output Format Control

## Tell Instead of Forbid

```markdown
## Output Format

Write in clear, flowing prose using complete paragraphs. Use markdown for `inline code`, code blocks, and simple headings. Avoid **bold** and *italics*. Don't use lists unless truly discrete items or explicitly requested. Incorporate information naturally into sentences.
```

## Format Indicators

Use markdown headers to indicate desired output format:
- `## Prose Output` - for flowing paragraphs
- `## JSON Output` - for structured data
- `## Bullet Summary` - for concise lists

---

# Research & Information Gathering

For complex research tasks:

- **Provide clear success criteria** defining what constitutes a successful answer
- **Encourage source verification** across multiple sources
- **Develop competing hypotheses** and track confidence levels
- **Use structured notes** or hypothesis trees to persist findings

**Claude 4.5 excels at synthesizing information from large corpora.**

---

# Frontend Development (Avoiding "AI Slop")

## Typography
- Choose distinctive fonts
- Avoid: Inter, Arial, generic system fonts

## Color
- Commit to cohesive color palettes using CSS variables
- Sharp accents complement dominant colors

## Animation
- Use for high-impact moments
- Staggered reveals with animation-delay
- Purposeful motion

## Atmosphere
- Create atmospheric backgrounds with gradients or patterns
- Vary aesthetics across projects

```markdown
## Frontend Aesthetics

Avoid generic, on-distribution outputs. Make creative, distinctive frontends that surprise and delight. Focus on unique typography, cohesive color themes with dominant colors and sharp accents, purposeful motion, and atmospheric backgrounds. Avoid clichéd patterns like purple gradients on white backgrounds or predictable layouts.
```

---

# Vision Capabilities

- **Opus 4.5 has improved image processing and data extraction**
- Particularly strong with multiple images in context
- Enhanced computer use with reliable screenshot interpretation
- Analyze videos by breaking into frames
- Provide crop tools or skills to "zoom" into relevant image regions for performance boost

---

# Empirical Foundation

**Research validates that prompt structure has measurable, significant impact:**

- **Performance Range:** 10-90% variation based on structure choices
- **Few-Shot Examples:** +25% to +90% improvement (optimal: 1-3 examples)
- **Structured Organization:** Consistent performance gains across reasoning tasks
- **Full Component Integration:** +25% improvement on complex tasks
- **Clear Instructions:** Reduces ambiguity and improves task completion
- **Production Impact:** +23% conversion, +31% satisfaction (production A/B testing, 50K users)

**Sources:** 1,500+ academic papers, Microsoft PromptBench, Amazon Alexa production testing, PMC clinical NLP studies.

---

# Markdown Structure Standards

## Use Markdown Headers for Organization

Organize prompts into distinct semantic sections using standard Markdown headers.

**Essential Sections (Empirically Validated):**

```markdown
## Background Information
Essential context about the domain, system, or task

## Instructions
Clear, actionable directives for the agent

## Examples
Concrete examples demonstrating expected behavior (1-3 optimal)

## Constraints
Boundaries, limitations, and requirements

## Output Format
Explicit specification of desired response structure
```

**Research Validation:**
- Background/Context: Required - reduces ambiguity
- Instructions: Required - baseline performance component
- Examples: +25-90% improvement (1-3 examples optimal, diminishing returns after 3)
- Constraints: Improves quality, reduces hallucination
- Output Format: Improves compliance and reduces format errors

## Section Guidelines

**Background Information:**
- Provide minimal essential context
- Avoid historical details unless critical
- Focus on "what" and "why", not "how we got here"

**Instructions:**
- Use imperative voice ("Do X", not "You should do X")
- Be specific and actionable
- Order by priority or logical flow

**Examples:**
- Show, don't tell
- Include both correct and incorrect examples when useful
- Keep examples concise and representative
- **Claude 4.x pays close attention—ensure examples match desired outcomes exactly**

**Constraints:**
- Clearly state boundaries and limitations
- Specify what NOT to do
- Define success/failure criteria

**Output Format:**
- Specify exact structure (JSON, Markdown, lists, etc.)
- Include format examples when helpful
- Define length constraints if applicable

---

# Writing Style Guidelines

## Clarity Over Completeness

✅ **Good:**
```markdown
## Instructions
- Validate user input before processing
- Return errors in JSON format
- Log all failed attempts
```

❌ **Bad:**
```markdown
## Instructions
You should always make sure to validate the user's input before you process it because invalid input could cause problems. When you encounter errors, you should return them in JSON format so that the calling system can parse them properly.
```

## Be Direct and Specific

✅ **Good:**
```markdown
Use the `calculate_tax` tool with amount and jurisdiction parameters.
```

❌ **Bad:**
```markdown
You might want to consider using the calculate_tax tool if you need to determine tax amounts, and you should probably pass in the amount and jurisdiction if you have them available.
```

---

# Context Management Strategies

## 1. Just-in-Time Context Loading

**Instead of:**
```markdown
## Available Products
Product 1: Widget A - $10.99 - In stock: 500 units...
[100 more products...]
```

**Use:**
```markdown
## Available Products
Use `get_product(sku)` to retrieve product details when needed.
```

## 2. Compaction for Long Conversations

When context grows too large:
- Summarize older conversation segments
- Preserve critical decisions and state
- Discard resolved sub-tasks
- Keep recent context verbatim
- **Consider full context reset—Claude 4.5 excels at discovering state from filesystem**

## 3. Structured Note-Taking

For multi-step tasks:
- Persist important information outside context window
- Use external storage (files, databases) for state
- Reference stored information with lightweight identifiers

## 4. Sub-Agent Architectures

For complex tasks:
- Delegate subtasks to specialized agents
- Each agent gets minimal, task-specific context
- Parent agent coordinates and synthesizes results
- **Claude 4.5 naturally recognizes delegation opportunities**

---

# Tool Design Principles

## Self-Contained Tools

Each tool should:
- Have a single, clear purpose
- Include all necessary parameters in its definition
- Return complete, actionable results
- Handle errors gracefully

## Clear Purpose and Scope

✅ **Good:** `calculate_shipping_cost(origin, destination, weight, service_level)`

❌ **Bad:** `process_order(order_data)` - Too broad, unclear what it does

## Tool Description Language (Claude 4.5 Specific)

- **Avoid:** "CRITICAL: You MUST use this tool"
- **Prefer:** "Use this tool when..."
- Softer framing reduces overtriggering in Opus 4.5

---

# Context File Templates

## Basic Context Template

```markdown
# [Domain/Feature Name]

## Background Information
[Minimal essential context about the domain]

## Instructions
- [Clear, actionable directive 1]
- [Clear, actionable directive 2]
- [Clear, actionable directive 3]

## Examples
**Example 1: [Scenario]**
Input: [Example input]
Expected Output: [Example output]

## Constraints
- [Boundary or limitation 1]
- [Boundary or limitation 2]

## Output Format
[Specific structure specification]
```

## Agent-Specific Context Template

```markdown
# [Agent Name] - [Primary Function]

## Role
You are a [role description] responsible for [core responsibility].

## Capabilities
- [Capability 1]
- [Capability 2]

## Available Tools
- `tool_name(params)` - [Brief description - avoid "MUST use" language]

## Workflow
1. [Step 1]
2. [Step 2]

## Output Format
[Specify exact format for agent responses]

## Constraints
- [Constraint 1]
- [Constraint 2]
```

---

# Best Practices Checklist

When creating or reviewing prompts:

- [ ] Uses Markdown headers for semantic organization
- [ ] Language is clear, direct, and minimal
- [ ] Instructions tell what TO do (not just what NOT to do)
- [ ] Examples match desired outcomes exactly
- [ ] Constraints are clearly defined
- [ ] Uses just-in-time loading when appropriate
- [ ] Tool descriptions use soft language (avoid "MUST")
- [ ] Extended thinking alternatives used ("consider" not "think")
- [ ] Explains WHY when behavior motivation helps

---

# Anti-Patterns to Avoid

❌ **Verbose Explanations**
Don't explain reasoning behind every instruction. Be direct.

❌ **Negative-Only Constraints**
Don't just say what NOT to do—tell what TO do instead.

❌ **Aggressive Tool Language**
"CRITICAL: You MUST use this tool" causes overtriggering in Claude 4.5.

❌ **Misaligned Examples**
Examples shape behavior—misaligned examples cause unintended outcomes.

❌ **Historical Context Dumping**
Don't include how things evolved unless critical.

❌ **Premature Information Loading**
Don't load detailed data until actually needed.

❌ **Vague Instructions**
Don't use "might", "could", "should consider"—be direct.

❌ **Example Overload**
Don't provide 10 examples when 2 would suffice.

❌ **Using "Think" with Extended Thinking Disabled**
Use "consider", "evaluate", "reflect" instead.

---

# The Fabric System (January 2024)

An **open-source framework** for augmenting humans using AI.

## Core Architecture

**Philosophy:** UNIX principles applied to prompting
- Solve each problem exactly once
- Turn solutions into reusable modules (Patterns)
- Make modules chainable

**Components:**
- **Patterns:** Granular AI use cases (242+ prompts)
- **Stitches:** Chained patterns for advanced functionality
- **Looms:** Client-side apps calling specific Patterns
- **Mills:** Hosting infrastructure for patterns

## Key Principles

**Markdown-First Design:**
- Maximum readability for creators and users
- Clear structure emphasizes what AI should do and in what order

**Clarity in Instructions:**
- Extremely clear, specific directives
- Markdown structure for order and priority
- Chain of Thought and Chain of Draft strategies

**Location:** github.com/danielmiessler/Fabric

## Native Fabric Patterns in PAI

**Location:** `~/.claude/skills/Utilities/Fabric/Patterns/`

PAI maintains a local copy of all Fabric patterns for native execution. Instead of spawning the `fabric` CLI for every pattern-based task, the system reads and applies patterns directly as prompts.

### When to Use Native Patterns (Default)

For any pattern-based processing, the system will:
1. Read `tools/fabric/Patterns/{pattern_name}/system.md`
2. Apply the pattern instructions directly to the content
3. Execute without external CLI calls

**Examples:**
- `extract_wisdom` → Read and apply `tools/fabric/Patterns/extract_wisdom/system.md`
- `summarize` → Read and apply `tools/fabric/Patterns/summarize/system.md`
- `analyze_claims` → Read and apply `tools/fabric/Patterns/analyze_claims/system.md`

### When to Still Use the Fabric CLI

Only use the `fabric` command for:
- **`-U`** - Update patterns: `fabric -U`
- **`-y`** - Extract YouTube transcripts: `fabric -y "https://youtube.com/..."`
- **`-l`** - List available patterns: `fabric -l`

These operations require the CLI because they access external services or configuration.

### Updating Patterns

Run the update script to sync latest patterns:
```bash
~/.claude/skills/Utilities/Fabric/Tools/update-patterns.sh
```

This pulls upstream updates via `fabric -U` and syncs to PAI's local copy.

---

# Migration to Claude 4.x

When updating prompts for Claude 4.x:

1. **Be specific** about desired behavior in descriptions
2. **Add quality modifiers:** "Include as many relevant features as possible. Go beyond basics"
3. **Request explicitly:** Interactive elements, animations, detailed summaries
4. **Soften tool language:** Change "MUST" to "when..."
5. **Review examples:** Ensure they match desired outcomes exactly
6. **Add motivation:** Explain WHY certain behavior matters
7. **Replace "think":** Use "consider", "evaluate", "reflect" when extended thinking is disabled

---

# References

**Primary Sources:**
- Anthropic: "Claude 4.x Best Practices" (November 2025)
  https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices
- Anthropic: "Effective Context Engineering for AI Agents"
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- The Fabric System (January 2024)
  https://github.com/danielmiessler/fabric
- "The Prompt Report" - arXiv:2406.06608 (systematic survey, 58 techniques)
- "The Prompt Canvas" - arXiv:2412.05127 (100+ papers reviewed)
- Microsoft PromptBench - Comprehensive benchmarking framework
- Amazon Alexa Production Testing - Real-world A/B testing (50K users)

**Philosophy:** These standards focus on universal principles of semantic clarity and structure while incorporating Claude 4.x-specific optimizations for behavioral patterns, tool usage, and multi-context workflows.

---

# The Ultimate Prompt Template

**Synthesized from:** Anthropic's Claude 4.x Best Practices, context engineering principles, 1,500+ academic papers, and production-validated patterns.

**Design Philosophy:** Modular sections—include only what your task requires. Every section is optimized for Claude 4.x behavioral patterns.

---

## Full Template

```markdown
# [Task Name]

## Context & Motivation
[WHY this matters - Claude generalizes from reasoning provided]
[Explain the purpose and why specific behaviors matter. One to three sentences.]

Example: "This output drives a text-to-speech system, so natural sentence flow without ellipses or fragments is critical for listener comprehension."

## Background
[Minimal essential context - every token costs attention]
[Domain-specific information the model needs. Keep minimal.]

## Instructions
[Positive framing: tell what TO do. Imperative voice. Ordered by priority.]

1. [First clear, actionable directive]
2. [Second directive]
3. [Third directive]

## Examples
[1-3 examples optimal. Claude 4.x is HIGHLY sensitive to details.]
[Examples MUST exactly match desired outcomes - misalignment causes unintended behavior]

**Example 1: [Scenario]**
- Input: [Representative input]
- Output: [Exact desired output - Claude will match this closely]

**Example 2: [Edge Case]**
- Input: [Edge case input]
- Output: [Exact desired output for edge case]

## Constraints
[Positive framing preferred. Define success/failure criteria.]

- [What TO do, not just what NOT to do]
- [Boundary or limitation]
- **Success:** [What defines successful completion]
- **Failure:** [What defines failure]

## Output Format
[Explicit specification reduces format errors significantly]

[Exact structure: JSON schema, markdown format, prose style]
[Length constraints if applicable]
[Format example if helpful]

## Tools
[SOFT LANGUAGE - avoid "MUST use" which causes overtriggering]

- `tool_name(params)` - Use when [specific condition]. [Brief description]
- `another_tool(params)` - Use when [condition]. [Description]

## Action Bias
[Choose ONE based on task type]

### For Implementation Tasks
Implement changes rather than suggesting. Use tools to discover missing details instead of guessing. Infer useful actions when intent is unclear.

### For Research/Analysis Tasks
Default to information gathering and recommendations. Verify across multiple sources. Develop competing hypotheses before concluding.

## Execution Patterns
[Include relevant subsections]

### Parallel Execution
Make independent tool calls in parallel. Call sequentially only when results depend on previous calls. Never guess parameters.

### Verification
Investigate files before proposing changes. Verify changes work before reporting completion. Read before edit.

### Reflection
After receiving results, carefully consider their quality and evaluate optimal next steps before proceeding.

## State Tracking
[For multi-step or multi-context tasks]

Track progress using:
- JSON for structured data (tests, schemas)
- Text for progress notes
- Git for checkpoints across sessions

[Specific state schema if applicable]
```

---

## Section Selection Matrix

| Task Type | Required Sections | Recommended | Optional |
|-----------|------------------|-------------|----------|
| **Simple Query** | Instructions, Output Format | Context | — |
| **Complex Implementation** | Context, Instructions, Output Format, Tools | Examples, Constraints, Verification | Action Bias, Parallel |
| **Research/Analysis** | Context, Instructions, Constraints | Examples, Research Mode | State Tracking |
| **Agentic Coding** | Context, Instructions, Tools, Verification | Constraints, Parallel | State Tracking |
| **Long-Horizon Multi-Context** | Context, Instructions, State Tracking | Verification, Parallel | All others as needed |

---

## Quick Reference: Claude 4.x Transformations

| ❌ Avoid | ✅ Use Instead |
|----------|---------------|
| "CRITICAL: You MUST use this tool" | "Use this tool when..." |
| "Don't use markdown" | "Write in flowing prose paragraphs" |
| "NEVER do X" | "Do Y instead" (positive framing) |
| "Think about this carefully" | "Consider this carefully" / "Evaluate" |
| "You should probably..." | "Do X" (imperative, direct) |
| 10 examples | 1-3 examples (diminishing returns) |
| Vague: "make it better" | Specific: "Change X to achieve Y" |
| "Here's everything about the domain..." | Minimal context, just-in-time loading |

---

## Minimal Template (Simple Tasks)

```markdown
# [Task Name]

## Context
[Why this matters - one sentence]

## Instructions
[Clear directives in imperative voice]

## Output Format
[Exact format specification]
```

---

## Agentic Template (Coding Tasks)

```markdown
# [Task Name]

## Context
[Purpose and why specific behaviors matter]

## Instructions
1. [Primary objective]
2. [Secondary requirements]

### Verification
Read and understand relevant files before proposing changes. Verify changes work before reporting completion.

### Parallel Execution
Make independent tool calls in parallel. Sequential only when dependent.

## Tools
- `tool(params)` - Use when [condition]

## Constraints
- Implement minimum complexity needed
- Reuse existing abstractions
- Clean up temporary files when done

## Output Format
[Format specification]
```

---

## Research Template

```markdown
# [Research Task]

## Context
[What question needs answering and why it matters]

## Instructions
1. [Primary research objective]
2. [Scope boundaries]

### Research Mode
Verify across multiple sources. Develop competing hypotheses. Track confidence levels. Synthesize findings.

## Success Criteria
- **Success:** [What constitutes a complete answer]
- **Sources:** [Verification requirements]

## Output Format
[Structure for findings - summary, evidence, confidence, sources]
```

---

## Why This Template Works

**Empirically Validated Structure:**
- Background + Instructions + Output Format = baseline performance
- Examples add +25-90% improvement (1-3 optimal, diminishing returns after)
- Constraints reduce hallucination
- Output format specification improves compliance

**Claude 4.x Optimized:**
- Soft tool language prevents overtriggering
- Positive framing ("do X" not "don't do Y") provides clear targets
- Motivation/context enables generalization
- "Consider"/"evaluate" avoids extended thinking sensitivity
- Example warnings prevent misalignment

**Context Engineering Principles:**
- Minimal context preserves attention budget
- Modular design—include only what's needed
- Markdown headers provide semantic clarity without token waste

**Production Proven:**
- Multi-context state tracking patterns from Anthropic's agentic workflows
- Parallel execution patterns reduce latency
- Verification patterns catch errors before human review

---

# Prompt Templating System

**Foundation:** Based on Anthropic's official `{{variable}}` syntax, industry patterns (LangChain, Handlebars, DSPy), and PAI's unique skill architecture.

**Philosophy:** Templates enable prompts to write prompts—dynamic composition where structure is fixed but content is parameterized. This is core PAI DNA.

---

## Core Syntax

PAI uses Handlebars notation for template variables:

| Syntax | Purpose | Example |
|--------|---------|---------|
| `{{variable}}` | Simple interpolation | `Hello {{name}}` |
| `{{object.property}}` | Nested access | `{{agent.voice_id}}` |
| `{{#each items}}...{{/each}}` | Iteration | List generation |
| `{{#if condition}}...{{/if}}` | Conditional | Optional sections |
| `{{> partial}}` | Include partial | Reusable components |

**Why Handlebars:**
- Anthropic's official Claude Console syntax
- Industry standard (Microsoft Semantic Kernel, LangChain)
- Logic-less templates (business logic stays in code)
- Cross-platform compatibility

---

## Five Templating Primitives

### 1. ROSTER — Agent & Skill Definitions

Data-driven generation of structured definitions from YAML.

**Use Cases:**
- Agent personality definitions (32 RedTeam analysts, 10 core agents)
- Skill frontmatter generation (83 skills)
- Voice configuration presets

**Example:**
```yaml
# Data: agents.yaml
agents:
  - id: "EN-1"
    name: "The Skeptical Systems Thinker"
    trait: "30 years building distributed systems"
    perspective: "Where does this break at scale?"
```

```handlebars
{{!-- Template: agent_roster.hbs --}}
{{#each agents}}
### {{id}}: {{name}}
**Trait:** {{trait}}
**Perspective:** "{{perspective}}"
{{/each}}
```

### 2. VOICE — Personality Calibration

Parameterized voice and tone settings for agents.

**Use Cases:**
- Voice parameters (stability, similarity_boost, rate_wpm)
- Character archetype mapping
- Personality trait presets

**Example:**
```yaml
# Data: voice_presets.yaml
presets:
  enthusiast:
    stability: 0.38
    similarity_boost: 0.70
    archetype: "Eager, celebratory, partner energy"
  analyst:
    stability: 0.60
    similarity_boost: 0.92
    archetype: "Confident, authoritative, evidence-based"
```

```handlebars
{{!-- Template: voice_config.hbs --}}
"{{agent.id}}": {
  "stability": {{presets.[agent.archetype].stability}},
  "similarity_boost": {{presets.[agent.archetype].similarity_boost}}
}
```

### 3. STRUCTURE — Workflow Patterns

Standardized multi-step execution patterns.

**Use Cases:**
- Phased analysis (RedTeam 5-phase, OSINT 5-phase)
- Round-based debate (Council 3-round)
- Sequential pipeline (Development 7-gate)

**Example:**
```handlebars
{{!-- Template: phased_workflow.hbs --}}
{{#each phases}}
## Phase {{@index}}: {{name}}

**Purpose:** {{purpose}}

{{#each steps}}
### Step {{@index}}: {{action}}
{{instructions}}
{{/each}}

---
{{/each}}
```

### 4. BRIEFING — Agent Context Handoff

How agents receive tasks and context for delegation.

**Use Cases:**
- Research agent queries
- RedTeam analyst prompts
- Development phase handoffs

**Example:**
```handlebars
{{!-- Template: agent_briefing.hbs --}}
# {{briefing.type}} — {{agent.id}}: {{agent.name}}

You are {{agent.personality}}. Your perspective is: "{{agent.perspective}}"

## Context
{{context.summary}}

## Your Task
{{#each briefing.questions}}
{{@index}}. {{this}}
{{/each}}

## Output Format
{{briefing.output_format}}
```

### 5. GATE — Validation Checklists

Reusable quality and completion checks.

**Use Cases:**
- Art mandatory elements
- Development completion gates
- Research source verification
- OSINT ethical boundaries

**Example:**
```handlebars
{{!-- Template: validation_gate.hbs --}}
### {{gate.name}} Checklist

{{#if gate.mandatory}}
**🚨 MANDATORY (if ANY missing, {{gate.action_on_fail}}):**
{{/if}}

{{#each gate.items}}
- [ ] **{{name}}** — {{description}}
{{/each}}
```

---

## Template Location

All templates live in `~/.claude/skills/Utilities/Prompting/Templates/`:

```
skills/Utilities/Prompting/
├── Templates/
│   ├── Primitives/       # Core template files (.hbs)
│   │   ├── Roster.hbs
│   │   ├── Voice.hbs
│   │   ├── Structure.hbs
│   │   ├── Briefing.hbs
│   │   └── Gate.hbs
│   ├── Data/             # YAML data sources
│   │   ├── Agents.yaml
│   │   ├── Skills.yaml
│   │   ├── VoicePresets.yaml
│   │   └── ValidationGates.yaml
│   └── Compiled/         # Generated output
└── Tools/                # Rendering utilities
    └── RenderTemplate.ts
```

---

## Rendering Templates

**CLI Usage:**
```bash
bun ~/.claude/skills/Utilities/Prompting/Tools/RenderTemplate.ts \
  --template Primitives/Roster.hbs \
  --data Data/Agents.yaml \
  --output Compiled/AgentRoster.md
```

**Programmatic Usage:**
```typescript
import { renderTemplate } from '~/.claude/skills/Utilities/Prompting/Tools/RenderTemplate.ts';

const output = renderTemplate('Primitives/Briefing.hbs', {
  agent: { id: 'EN-1', name: 'Skeptical Thinker', personality: '...' },
  briefing: { type: 'Analysis', questions: ['...'], output_format: '...' },
  context: { summary: '...' }
});
```

---

## Best Practices

### 1. Separation of Concerns
- **Templates:** Structure and formatting only
- **Data:** Content and parameters (YAML/JSON)
- **Logic:** Rendering and validation (TypeScript)

### 2. Keep Templates Simple
- Avoid complex logic in templates
- Use Handlebars helpers for transformations
- Business logic belongs in TypeScript, not templates

### 3. Version Control
- Templates and data in separate files
- Track changes independently
- Enable A/B testing of structures

### 4. DRY Principle
- Extract repeated patterns into partials
- Use presets for common configurations
- Single source of truth for definitions

### 5. Validate Before Rendering
- Check all required variables exist
- Validate data against schema
- Test with edge cases

---

## Integration with PAI Systems

| System | Template Use |
|--------|--------------|
| **Agent Delegation** | BRIEFING templates standardize context handoff |
| **Skill System** | ROSTER templates generate SKILL.md files |
| **Voice Server** | VOICE templates configure agent personalities |
| **Validation** | GATE templates standardize quality checks |
| **Fabric Patterns** | Templates can generate pattern-specific prompts |

---

## Token Savings

The templating system reduces duplication by ~65% across the skill system:

| Area | Before | After | Savings |
|------|--------|-------|---------|
| Agent Briefings | 6,400 tokens | 1,900 tokens | 70% |
| Voice Notifications | 6,225 tokens | 725 tokens | 88% |
| SKILL.md Files | 20,750 tokens | 8,300 tokens | 60% |
| Workflow Steps | 7,500 tokens | 3,000 tokens | 60% |

**Total: ~35,000 tokens saved across 83 skills.**

---

## References

**Anthropic Official:**
- [Prompt Templates and Variables](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompt-templates-and-variables)
- [Prompt Generator](https://claude.com/blog/prompt-generator)

**Industry:**
- [LangChain PromptTemplate](https://python.langchain.com/docs/concepts/prompt_templates/)
- [Handlebars.js](https://handlebarsjs.com/)
- [DSPy Signatures](https://dspy.ai/)
