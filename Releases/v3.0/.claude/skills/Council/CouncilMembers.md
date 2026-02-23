# Council Members

Reference for council member roles, perspectives, and voice assignments.

## Default Council Members

| Agent | Perspective | Voice |
|-------|-------------|-------|
| **Architect** | System design, patterns, long-term | Serena Blackwood |
| **Designer** | UX, user needs, accessibility | Aditi Sharma |
| **Engineer** | Implementation reality, tech debt | Marcus Webb |
| **Researcher** | Data, precedent, external examples | Ava Chen |

## Optional Members

Add these as needed based on the topic:

| Agent | Perspective | When to Add |
|-------|-------------|-------------|
| **Security** | Risk, attack surface, compliance | Auth, data, APIs |
| **Intern** | Fresh eyes, naive questions | Complex UX, onboarding |
| **Writer** | Communication, documentation | Public-facing, docs |

## Agent Type Mapping

| Council Role | Task subagent_type | Personality |
|--------------|-------------------|-------------|
| Architect | Architect | Serena Blackwood |
| Designer | Designer | Aditi Sharma |
| Engineer | Engineer | Marcus Webb |
| Researcher | PerplexityResearcher | Ava Chen |
| Security | Pentester | Rook Blackburn |
| Intern | Intern | Dev Patel |
| Writer | (use Intern with writer prompt) | Emma Hartley |

## Custom Council Composition

- "Council with security" - Add pentester agent
- "Council with intern" - Add intern for fresh perspective
- "Just architect and engineer" - Only specified members
