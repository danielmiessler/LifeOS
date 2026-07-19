# SyntheticDataExpansion Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the SyntheticDataExpansion workflow in the BeCreative skill to expand a seed corpus"}' \
  > /dev/null 2>&1 &
```

Running **SyntheticDataExpansion** in **BeCreative**...

---

**When to use:** You have a small seed corpus (5–20 examples) and need to expand it into a diverse N-example dataset for evals, training, prompt-injection test sets, writing-style corpora, or any downstream task that benefits from variety.

**Why it works:** Verbalized Sampling Multi-turn (VS-Multi) — Zhang et al. 2025, arXiv:2510.01171. The paper demonstrated that VS-Multi-generated synthetic math training data raised downstream model accuracy from 30.6% → 37.5% averaged across MATH500, OlympiadBench, and Minerva Math. Each turn samples from progressively rarer regions of the response distribution that aligned models encode but no longer surface by default.

**Word choice:** Use **"confidence"** not "probability" in the prompts. Paper §H.3 found this elicitation word outperforms "probability" specifically for VS-Multi.

---

## Inputs

- **Seed corpus** — 5–20 anchor examples, paste in full
- **Schema** — what each example must contain (fields, format, constraints)
- **Target N** — how many examples the final corpus should have
- **Optional: domain hints** — let the user steer the distribution

## Outputs

Written to `$LIFEOS_DIR/MEMORY/WORK/{slug}/synthetic-data/`:

- `seed.json` — the original seed corpus
- `schema.json` — the validation schema
- `generations.jsonl` — every accepted example with provenance (turn, confidence, generation-time)
- `rejected.jsonl` — every rejected example with reason (schema-fail, semantic-dup, low-quality)
- `summary.md` — final stats (N achieved, dedupe rate, diversity index, turn count)

---

## Multi-Turn Loop

Run inside extended thinking. Each turn is a fresh generation request, but the model sees all previously accepted examples to enforce non-duplication.

### Turn 1

```markdown
You are expanding a seed corpus into a diverse training set via Verbalized
Sampling.

SCHEMA:
{paste schema}

SEED CORPUS:
{paste seed examples}

Generate 5 NEW examples matching the schema, with their confidences. Sample
from the tails where confidence < 0.10 — pull from regions of the distribution
that the seed corpus does NOT cover. Each example must:
- Match the schema exactly
- Be semantically distinct from EVERY seed example
- Be plausible, not absurd

Return as JSON: [{"example": <object>, "confidence": <number>, "rationale":
"<one sentence on what region of the distribution this comes from>"}].
```

### Turn 2 onward

```markdown
Continue expanding. Here are all examples accepted so far ({k_so_far} total):

{paste accepted corpus}

Generate 5 MORE examples with their confidences, sampling from confidence < 0.10.
Each must be semantically distinct from EVERY example above. As the corpus
grows, push further into the tails — earlier turns covered the obvious novel
regions, this turn must reach rarer ground.

Same JSON return shape.
```

### Acceptance check (per generated example)

1. **Schema validation** — must satisfy the JSON schema. Reject otherwise.
2. **Semantic dedupe** — compare to all accepted examples. If >85% similar to any, reject.
3. **Confidence sanity** — drop examples where the model assigned `confidence > 0.20` (too typical, probably a rephrased seed).

### Termination

Stop when **any** of these are true:

- Target N reached
- Last turn rejected ≥40% of generations as semantic duplicates (diversity collapse)
- Three consecutive turns produce <2 accepted examples (model is stuck)

When termination fires due to diversity collapse, write a clear note to `summary.md` so the user knows the actual diversity ceiling for this seed.

---

## Best For

- Eval set expansion (Evals skill consumes the output)
- Prompt-injection test corpora (_HELIOS_PROMPT_INJECTION consumes the output)
- Writing-style fine-tuning sets (the user's voice samples → expanded corpus)
- Synthetic Q&A pairs for retrieval evals
- Any task where N>20 examples are needed and only ~10 exist

## NOT For

- Tasks where there is one objectively correct answer (paper §3.2: VS provides no lift on factually-constrained tasks)
- Generating a single best example (use StandardCreativity instead)
- Creative writing where the user wants ONE polished output (use StandardCreativity / MaximumCreativity)

## Gotchas

- **Confidence inflation across turns is normal.** The model will sometimes claim `confidence: 0.05` for examples that are only mildly novel. Trust the dedupe check, not the self-reported confidence.
- **Seed quality dominates.** If the seed corpus is itself narrow, no amount of VS-Multi expansion will reach a region the seed didn't hint at. Garbage in, mediocre out.
- **Don't combine with TreeOfThoughts.** That workflow is for branching exploration of a single problem, not corpus expansion. Pick one.
- **The output JSONL files are the durable artifact.** Don't summarize them inline in the response — point the user at the files.
