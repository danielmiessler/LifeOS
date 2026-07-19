# TokenXray

TypeScript port of [`claude-code-token-xray`](https://github.com/Coral-Bricks-AI/coral-ai/tree/main/claude-code-token-xray)
(Apache 2.0, Coral Bricks AI). Reads only `{{LIFEOS_ROOT}}/projects/*/*.jsonl` —
nothing leaves the machine.

## Quickstart

```bash
bun install                    # one-time (installs js-tiktoken)
bun TokenXray.ts cost          # billed totals at Opus 4.7 rates (exact)
bun TokenXray.ts breakdown     # headline: tokens × wall-clock per activity
bun TokenXray.ts split         # main thread vs sidecar subagents
bun TokenXray.ts reread        # cumulative re-read per activity
bun TokenXray.ts actual        # subscription counterfactual vs real API spend
```

Add `--json` to any subcommand for structured output.

## What each subcommand answers

| Subcommand | Question |
|---|---|
| `cost` | What did this month cost at Opus 4.7 list rates, and what's the no-caching counterfactual? |
| `breakdown` | Where do my tokens AND wall-clock go (reasoning, bash, tool calls, subagents, summaries, reads, edits, system, attachments, prompts, reminders)? |
| `split` | Main thread vs subagents — billed tokens, per-model mix, cache-hit rate, cost. |
| `reread` | Per-activity *cumulative* input — what each kind of context costs once re-read every turn. |
| `actual` | What did I *really* pay? Splits subscription-billed (counterfactual) from API-keyed (real $ from LifeOS's `anthropic-cost.jsonl` snapshot). |

### `actual` — subscription vs API

The other subcommands price every call at Opus 4.7 list rates. That's what your bill *would* be on the API. If you're on Claude Max, most of `{{LIFEOS_ROOT}}/projects/` is OAuth-billed (subscription), so the marginal cost is zero — the Max fee is fixed. Real API spend comes from LifeOS's separate channels (Inference.ts, bridge bots, admin tools), tracked in `LIFEOS/MEMORY/OBSERVABILITY/anthropic-cost.jsonl`. `actual` shows both side-by-side.

## Caveats

- `tiktoken` is OpenAI's tokenizer, not Claude's. Token proportions are ±15%, not Claude-exact. Billed counts (`cost`) come from API `usage` blocks and are exact.
- Generation-time gaps include the model reading its context before writing.
- The `system+tools` row is estimated from each session's first cache write.

## License

Apache 2.0. Faithful port of the original Python by Coral Bricks AI.
