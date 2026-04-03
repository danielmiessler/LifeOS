# DomainSpecific Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the DomainSpecific workflow in the BeCreative skill to apply domain creativity"}' \
  > /dev/null 2>&1 &
```

Running **DomainSpecific** in **BeCreative**...

---

**When to use:** Creativity within specific domains (artistic, business, technical)

---

## Artistic Creativity Template

```markdown
## Instructions

DEEP THINKING - ARTISTIC CREATIVITY

Think deeply about this artistic challenge:
- Explore bold and experimental approaches
- Question conventional aesthetic assumptions
- Make unexpected connections across art forms
- Consider emotional impact and audience experience
- Push boundaries while maintaining coherence

Generate artistically bold and innovative responses.

## Challenge

[Artistic challenge]
```

**Best for:** Visual arts, music, writing, performance, design

---

## Business Innovation Template

```markdown
## Instructions

DEEP THINKING - BUSINESS INNOVATION

Think deeply about this business challenge:
- Question conventional business model assumptions
- Explore approaches from other industries
- Consider customer psychology and behavior
- Evaluate scalability and sustainability
- Balance innovation with practical implementation

Generate innovative business solutions that challenge conventional thinking.

## Challenge

[Business challenge]
```

**Best for:** Strategy, marketing, product, operations, growth

---

## Process

1. **Identify domain** - artistic, business, or other
2. **Select appropriate template** for the domain
3. **Apply domain-specific thinking prompts**
4. **Generate options** that challenge domain conventions
5. **Evaluate against domain criteria** (e.g., scalability for business, emotional impact for art)
6. **Output refined solution** appropriate for the domain
