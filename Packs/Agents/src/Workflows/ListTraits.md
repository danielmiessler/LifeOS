# ListTraits Workflow

**Shows all available traits that can be composed into custom agents.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ListTraits workflow in the Agents skill to show traits"}' \
  > /dev/null 2>&1 &
```

Running **ListTraits** in **Agents**...

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

```
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

```
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

## Enhanced Presentation (Optional)

If user wants more detail, also explain voice assignment:

```
Each trait combination maps to a unique voice:

ENERGETIC VOICES (enthusiastic, creative, bold):
- Jeremy (excited Irish-American male)
- Fin (energetic Irish storyteller)
- Freya (vibrant dynamic female)
- Dave (youthful British energy)

INTELLECTUAL VOICES (analytical, skeptical, research):
- Default (BBC anchor authority)
- George (academic warm raspy)
- Charlotte (sophisticated Swedish-British)
- Antoni (professorial articulate)

AUTHORITATIVE VOICES (bold, business, cautious):
- Domi (assertive CEO female)
- Bill (documentary trustworthy male)
- Alice (confident news anchor female)
- Joseph (formal British authority)

WARM VOICES (empathetic, consultative):
- Matilda (friendly American storyteller)
- Thomas (calm gentle guide)
- Rachel (calm supportive)

EDGY VOICES (adversarial, contrarian, security):
- Clyde (gravelly war veteran intensity)
- Callum (hoarse hacker character)
- Sam (raspy gritty authentic)
```

## Example Interaction

**User:** "What kinds of agents can you create?"

**System:**
```
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

I'll compose the right agent with a matching voice.
```

## Quick Reference Card (Optional)

For frequent use, provide a condensed version:

```
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
- Voice mappings: Lines 349-794 in Traits.yaml
- ComposeAgent tool: `~/.claude/skills/Agents/Tools/ComposeAgent.ts`
