# Steal — STEAL Phase Only (Cross-Domain Pattern Transfer)

**Use when:** you want to scavenge solutions from foreign domains and map them onto your problem. Pure cross-pollination — no scoring, no breeding, no iteration.

**Phase invoked:** STEAL only.

## Inputs

- **Problem statement** (required): defines what to look for in foreign domains
- **Domains** (optional): explicit list of domains to scavenge from. If omitted, drawn via weighted random lottery from the standard 50+ candidate pool.
- **Patterns per domain** (optional, default 3): how many patterns each agent extracts from its assigned domain
- **Agent count** (optional, default 3-5): one agent per domain

## Steps

1. **Domain selection:**
   - If user supplied domains: use those
   - Otherwise: weighted random lottery from the 50+ candidate pool (defined in `../SKILL.md` § Structural Randomness Engine)
   - Force constraint: at least 1 domain must be DISTANT from the problem's native field (biology for software, jazz for military, etc.)

2. **Spawn one Thief agent per domain in parallel** via Task tool. Each receives:
   - Problem statement
   - Its assigned foreign domain
   - Trait composition: `resourceful + cross-domain + opportunistic`
   - Instruction: *"In your assigned domain, find 2-3 patterns/solutions/approaches that solve problems analogous to ours. For each, write the mapping: 'In [foreign domain], they solve [analogous problem] by [technique]. Applied to our problem: [mapping].'"*
   - Each agent invokes `Skill("Research")` to gather domain-specific material

3. **Aggregate the borrowed patterns** into a single output. Each pattern includes:
   - Foreign domain name
   - The analogous problem in the foreign domain
   - The technique that solves it
   - The mapped application to our problem
   - Strength of analogy (1-5, agent's self-assessment)

## Output

```markdown
## Borrowed Patterns

### From Mycology (Agent: The Thief)

1. **Mycelial network consensus** (analogy strength: 5)
   - Foreign problem: distributed nutrient allocation across forest floor
   - Foreign technique: chemical gradient signaling, no central coordinator
   - Mapped: distributed system consensus via gossip protocol with bias-vector signals

2. **Sclerotia dormancy** (analogy strength: 3)
   - ...

### From Jazz Performance (Agent: The Thief)

1. **Trading fours** (analogy strength: 4)
   - ...
```

## Distinguishing Notes

- **Domain selection is structurally random.** Don't ask the LLM to "pick interesting domains" — the lottery defeats LLM bias toward training-distribution-favored domains.
- **The mapping IS the creative act.** The pattern exists in the foreign domain; the cross-domain application is novel. If a pattern can't be mapped, it's not borrowed — it's noise.
- **No scoring here.** Steal produces raw cross-pollination material. Use Test (or FullCycle) to score these against fitness criteria.

## Execution Log

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Ideate","workflow":"Steal","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```
