# ListTraits Workflow

**Shows all available traits that can be composed into custom agents.**

---

## When to Use

User says:

- "What agent personalities can you create?"
- "Show me available traits"
- "List agent types"
- "What expertise areas do you have?"

## The Workflow

### Step 1: Run ComposeAgent with --list Flag

```bash
bun run ~/.claude/skills/Agents/Tools/ComposeAgent.ts --list
```

### Step 2: Present Results to User

The tool outputs:

```text
AVAILABLE TRAITS

EXPERTISE (domain knowledge):
  security        - Security Expert
  legal           - Legal Analyst
  finance         - Financial Analyst
  medical         - Medical/Health Expert
  technical       - Technical Specialist
  research        - Research Specialist
  creative        - Creative Specialist
  business        - Business Strategist
  data            - Data Analyst
  communications  - Communications Expert

PERSONALITY (behavior style):
  skeptical       - Skeptical
  enthusiastic    - Enthusiastic
  cautious        - Cautious
  bold            - Bold
  analytical      - Analytical
  creative        - Creative
  empathetic      - Empathetic
  contrarian      - Contrarian
  pragmatic       - Pragmatic
  meticulous      - Meticulous

APPROACH (work style):
  thorough        - Thorough
  rapid           - Rapid
  systematic      - Systematic
  exploratory     - Exploratory
  comparative     - Comparative
  synthesizing    - Synthesizing
  adversarial     - Adversarial
  consultative    - Consultative

EXAMPLE COMPOSITIONS:
  security_audit       - Security architecture review
                         traits: security, skeptical, thorough, adversarial
  contract_review      - Legal contract analysis
                         traits: legal, cautious, meticulous, systematic
  market_analysis      - Competitive market research
                         traits: business, analytical, comparative, thorough
  code_review          - Technical code review
                         traits: technical, meticulous, systematic
  creative_brief       - Creative content development
                         traits: creative, enthusiastic, exploratory
  red_team             - Adversarial idea testing
                         traits: contrarian, skeptical, adversarial, bold
  user_research        - User experience research
                         traits: research, empathetic, synthesizing
  quick_assessment     - Rapid evaluation needed
                         traits: analytical, pragmatic, rapid
```

### Step 3: Explain Composition System

Add context for user:

```text
You can combine these traits to create custom agents:

EXPERTISE + PERSONALITY + APPROACH = Custom Agent

Examples:
- "Create a security expert who's skeptical and thorough"
  → security + skeptical + thorough

- "I need someone with legal knowledge who's really careful"
  → legal + cautious + meticulous

- "Get me a creative thinker who works fast"
  → creative + enthusiastic + rapid

Just describe what you need naturally, and I'll compose the right agent.
```

## Example Interaction

**User:** "What kinds of agents can you create?"

**System:**

```text
I can compose agents from 28 traits across three categories:

EXPERTISE (what they know):
security, legal, finance, medical, technical, research, creative,
business, data, communications

PERSONALITY (how they think):
skeptical, enthusiastic, cautious, bold, analytical, creative,
empathetic, contrarian, pragmatic, meticulous

APPROACH (how they work):
thorough, rapid, systematic, exploratory, comparative, synthesizing,
adversarial, consultative

Just tell me what you need:
- "I need a legal expert who's really thorough"
- "Create a skeptical security analyst"
- "Get me someone creative and fast"

I'll compose the right agent for the task.
```

## Quick Reference Card (Optional)

For frequent use, provide a condensed version:

```text
QUICK TRAIT REFERENCE

Expertise:     security | legal | finance | medical | technical |
               research | creative | business | data | communications

Personality:   skeptical | enthusiastic | cautious | bold | analytical |
               creative | empathetic | contrarian | pragmatic | meticulous

Approach:      thorough | rapid | systematic | exploratory | comparative |
               synthesizing | adversarial | consultative

Popular Combos:
- Security audit:     security + skeptical + adversarial
- Contract review:    legal + cautious + meticulous
- Creative brief:     creative + enthusiastic + exploratory
- Code review:        technical + meticulous + systematic
- Red team:           contrarian + skeptical + bold
```

## Related Workflows

- **CreateCustomAgent** - Actually create agents with these traits
- **SpawnParallelAgents** - Launch generic agents (no trait customization)

## References

- Full trait definitions: `~/.claude/skills/Agents/Data/Traits.yaml`
- ComposeAgent tool: `~/.claude/skills/Agents/Tools/ComposeAgent.ts`
