# PAI Skills for GitHub Copilot CLI

Ported from [Personal AI Infrastructure](https://github.com/danielmiessler/Personal_AI_Infrastructure) v4.0.3.

## Available Skills

| Skill | Trigger | File |
|-------|---------|------|
| **Thinking** | "think about", "first principles", "red team", "council debate", "brainstorm" | `pai/thinking.md` |
| **Research** | "research", "investigate topic", "find information", "deep dive" | `pai/research.md` |
| **Investigation** | "OSINT", "investigate person/company", "due diligence", "domain intel" | `pai/investigation.md` |
| **Agents** | "compose agent", "spin up agents", "custom agent", "parallel agents" | `pai/agents.md` |

## How to Use

Reference a skill file to activate it:

```
@pai/thinking.md red team this architecture decision
@pai/research.md research the Azure ARM failure attribution landscape
@pai/investigation.md do an OSINT investigation on company X
@pai/agents.md compose a security reviewer agent
```

## Integration with Pitcrew

PAI skills compose naturally with pitcrew:
- Use **Thinking/FirstPrinciples** to decompose a problem before creating pit calls
- Use **Thinking/RedTeam** to validate a pit stop's output
- Use **Research** to gather context before starting a feature
- Use **Agents** to compose custom mechanic personas for specialized pit calls
