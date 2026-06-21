# Test — TEST Phase Only (Multi-Judge Fitness Evaluation)

**Use when:** you have a pool of candidate ideas and want them scored on the standard 4 dimensions (Feasibility, Novelty, Impact, Elegance). No breeding, no selection, no iteration — just scoring.

**Phase invoked:** TEST only. Optionally invokes RedTeam for adversarial pass.

## Inputs

- **Candidates** (required): list of idea texts to score
- **Problem statement** (required): defines the fitness function
- **Judge count** (optional, default 3): number of judge agents per candidate
- **RedTeam pass** (optional, default true): adversarial attack on candidates before scoring
- **External validation hooks** (optional): see `../SKILL.md` § External Validation Hooks

## Steps

1. **Optional adversarial pass:** if `redteam_pass` is true, invoke `Skill("RedTeam")` to attack each candidate. Surfaced fatal flaws are appended to the candidate metadata before scoring (judges see them).

2. **Spawn `judge_count` Judge agents in parallel** via Task tool. Each judge independently scores ALL candidates. Trait composition: `critical + analytical + skeptical`.

3. **Each judge scores each candidate on 4 dimensions (0-100 each):**

   | Dimension | What it measures | 0 | 100 |
   |-----------|------------------|---|-----|
   | **Feasibility** | Can this actually be built/done? | Violates physics | Proven tech, clear path |
   | **Novelty** | Is this genuinely new? | Already exists as described | Never been tried |
   | **Impact** | If it works, how much does it matter? | Marginal | Paradigm shift |
   | **Elegance** | Is the solution beautiful/simple? | Rube Goldberg | Obvious in retrospect |

   For each dimension, the judge provides:
   - Score (0-100)
   - 1-sentence supporting argument
   - 1-sentence counterargument

4. **Aggregate across judges:**
   - Final score per dimension = average across judges
   - Composite score = average of 4 dimension scores
   - Confidence = inverse of judge variance (high variance = low confidence)

5. **External validation (optional):** if any hooks are enabled, run them on each candidate. Hook returns `{ modifier: -20..+20, evidence: string }`. Adjusted composite = base composite + sum of modifiers (capped to ±20).

## Output

```json
[
  {
    "id": "candidate-001",
    "text": "Apply mycelial chemical-gradient signaling to API rate limiting",
    "scores": {
      "feasibility": 68,
      "novelty": 84,
      "impact": 72,
      "elegance": 79,
      "composite": 75.75,
      "confidence": 0.81,
      "judge_variance": 9.2
    },
    "arguments": {
      "supporting": "Mycelial networks solve consensus without coordinator using gradients — directly analogous to gossip protocols",
      "counter": "Chemical gradient propagation is O(n) — may not scale beyond biological distances"
    },
    "redteam_findings": ["Latency spikes under partition", "No clear primary for write path"],
    "external_validation": {
      "market_search": { "modifier": -5, "evidence": "Partial prior art in gossip protocols" }
    },
    "adjusted_composite": 70.75
  }
]
```

## Distinguishing Notes

- **Multi-judge defeats single-judge bias.** One judge's ceiling becomes the system's ceiling. Three or more judges with averaging neutralizes this.
- **Variance IS information.** High inter-judge variance means the idea is polarizing — judges legitimately disagree. Low variance means consensus. Both are signal.
- **Skip external validation for fast iteration.** Hooks add real-world signal but cost latency. For brainstorming, internal scoring alone is fine.

## Execution Log

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Ideate","workflow":"Test","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```
