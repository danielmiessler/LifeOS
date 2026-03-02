# StandardCreativity Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the StandardCreativity workflow in the BeCreative skill to apply creative thinking"}' \
  > /dev/null 2>&1 &
```

Running **StandardCreativity** in **BeCreative**...

---

**When to use:** Most creative tasks requiring depth and quality

---

## Template

```markdown
## Instructions

DEEP THINKING + VERBALIZED SAMPLING

In your thinking, generate 5 diverse responses with probabilities (p<0.10 each).

For each option, think deeply about:
- Unique perspectives and angles
- Unconventional assumptions to question
- Unexpected cross-domain connections
- Counterintuitive possibilities

Then select and output the most innovative approach.

## Request

[User's creative request]
```

---

## Best For

- Creative writing (stories, poems, dialogue)
- High-stakes creative work
- Single best solution needed
- Polished, refined output

---

## Process

1. **Receive creative request** from user
2. **Apply template** with user's specific request
3. **Generate internally** 5 diverse options (p<0.10 each) in thinking blocks
4. **Think deeply** about each option's unique angles
5. **Select best** option based on innovation and quality
6. **Output single response** - polished and refined
