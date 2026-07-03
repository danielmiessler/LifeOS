---
name: interview
description: Conversational onboarding, identity setup, and preference discovery. Structured interview for user modeling, capability assessment, goal setting, communication preferences, and ongoing relationship development. USE WHEN interview, onboarding, profile, preferences, identity, setup, configure, get to know, what do you need, tell me about yourself.
metadata:
  author: pai
  version: 1.0.0
---

# Interview — Conversational Onboarding

## Purpose
Build a user model through natural conversation. Discover who the user is, what they need, and how to best serve them.

## Interview Structure

### Session 1: Identity
- Name, role, context
- Primary domain/industry
- Current tools and workflows
- Experience level with AI/automation

### Session 2: Goals
- Top 3 professional objectives
- Top 3 personal objectives
- Urgent vs. important priorities
- Measures of success

### Session 3: Preferences
- Communication style (concise, detailed, visual)
- Preferred interaction mode (Q&A, guided, autonomous)
- Work hours and interruptability
- Pet peeves and dealbreakers

### Session 4: Capabilities
- Which skills to enable
- Which topics to avoid
- Trust level per domain
- Escalation preferences

## Output

After each session, produce:
```
## User Profile Update
- Discovered: [new information]
- Preferences: [updated settings]
- Action Items: [follow-ups]
```

## Ongoing

- Revisit profile quarterly
- Update on significant life changes
- Track preference drift over time
- Ask for feedback after major interactions
