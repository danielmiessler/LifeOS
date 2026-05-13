# Perplexity Researcher Execution

Execution protocol for the Perplexity researcher. Uses the Perplexity Sonar API; live web retrieval is built into every Sonar call before generation, with citations bundled in the response. Never falls back silently to `WebSearch`: if the API is unreachable or rate-limited, the researcher writes a stub error file (or returns a structured error inline) and the Research skill decides the next step.

## Provider

| Field | Value |
|-------|-------|
| Backend | Perplexity Sonar Chat Completions API |
| Endpoint | `https://api.perplexity.ai/chat/completions` |
| API key | `PERPLEXITY_API_KEY` in environment (loaded from `~/.claude/.env`) |
| Retrieval | Live web retrieval runs before each generation |
| Citation source | `citations` array on the response, plus inline numbered markers in content |
| Differentiator | Retrieval-first architecture; citations included by default at no extra cost |

## Model selection by research mode

| Mode | Model | Rationale |
|------|-------|-----------|
| Quick | `sonar` | Fast online model, top results, single pass |
| Standard | `sonar-pro` | Richer citation metadata, deeper synthesis |
| Extensive | `sonar-reasoning` | Chain-of-thought style reasoning over retrieved sources |
| Deep | `sonar-reasoning-pro` | Highest-fidelity reasoning, multi-step retrieval |

Model names are pinned per tier. Do not auto-upgrade mid-call.

## Execution shape

One query per call. Build the JSON request body with `jq -n --arg` to safely escape the user query:

```bash
BODY=$(jq -n \
  --arg model "$MODEL" \
  --arg q "$QUERY" \
  '{
    model: $model,
    messages: [
      { role: "system", content: "You are a research assistant. Return findings with inline citations." },
      { role: "user", content: $q }
    ],
    max_tokens: 2048,
    temperature: 0.2,
    return_citations: true
  }')

curl -sS --max-time 60 \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST "https://api.perplexity.ai/chat/completions" \
  -d "$BODY"
```

The researcher captures the response, parses it as JSON, and treats HTTP 200 as success. Any non-200 status triggers the fallback policy below.

## Citation extraction

Sonar responses include citations in two places, both of which the researcher reads:

1. A top-level `citations` array of URLs in delivery order.
2. Inline numbered markers (`[1]`, `[2]`, ...) inside the assistant's content; markers map to the citation array by position.

`sonar-pro` and higher tiers return additional metadata per citation (title, snippet, sometimes publication date). The researcher captures the title into the `sources` array of the output schema when present; otherwise it derives a minimal title from the URL's host.

If a finding cannot be tied to a citation index, lower the overall `confidence` value and note the gap in `full_findings`.

## URL verification

Every citation URL must be verified before delivery:

```bash
curl -s -o /dev/null -w "%{http_code}" -L --max-time 8 "<url>"
```

Status codes outside `200..399` fail verification: omit the URL or substitute a verified alternative. Never write an unverified URL with `verified: true`.

## File-based output

When invoked with `research_dir`, write `${research_dir}/perplexity.json`. A downstream synthesis step reads this file to cross-reference findings; the schema is shared by all four researchers.

```json
{
  "agent": "perplexity",
  "query": "<verbatim user query>",
  "summary": [
    "<key finding 1, short and self-contained>",
    "<key finding 2>",
    "..."
  ],
  "sources": [
    { "title": "<source title>", "url": "<verified URL>", "verified": true }
  ],
  "confidence": 0.0,
  "full_findings": "<complete detailed research output, no length limit>",

  "provider": "perplexity-sonar",
  "model": "<model name used>",
  "mode": "quick|standard|extensive|deep",
  "started": "<ISO-8601 timestamp>",
  "finished": "<ISO-8601 timestamp>"
}
```

**Required fields** (the synthesis layer reads only these): `agent`, `query`, `summary` (array of up to 10 short strings), `sources` (array of `{title, url, verified}` objects), `confidence` (numeric `0.0` to `1.0`), `full_findings` (string).

**Optional informational fields** (synthesis layer ignores them): `provider`, `model`, `mode`, `started`, `finished`. The researcher MAY also include a `published` field per source object when Sonar returns publication dates; the synthesis layer is free to ignore it.

If `research_dir` is not provided, the researcher returns the same payload inline to its caller and skips file writing.

## Fallback policy

If the API call returns a 429, a 5xx, a network timeout, or an authentication error:

1. Drop one model tier (for example `sonar-reasoning-pro` -> `sonar-pro` -> `sonar`) and retry once.
2. If the retry also fails, write a stub file with the error recorded in `full_findings` and an empty `summary`. Do NOT fall back to `WebSearch`.

```json
{
  "agent": "perplexity",
  "query": "<verbatim user query>",
  "summary": [],
  "sources": [],
  "confidence": 0.0,
  "full_findings": "ERROR: Perplexity API HTTP 429 after one retry at lower tier",
  "status": "error",
  "reason": "Perplexity API HTTP 429 after one retry at lower tier",
  "model_attempts": ["sonar-reasoning-pro", "sonar-pro"]
}
```

A missing or empty `PERPLEXITY_API_KEY` is reported the same way (`full_findings: "ERROR: PERPLEXITY_API_KEY not set in environment"`, `status: "error"`).

The synthesis layer treats `summary: []` as agent-unavailable and continues with whichever other researchers produced output.

## Self-verification checklist

Before writing the output file (or returning inline), the researcher confirms:

1. Every URL in `sources` was verified via curl (HTTP `200..399`) and is recorded with `verified: true`.
2. The `summary` array has at most 10 items, each a short self-contained finding.
3. The `confidence` value reflects overall reliability (drop it when citation mapping was incomplete).
4. Every quantitative claim in `full_findings` and `summary` appears in the cited source.
5. The HTTP status was 200, or the structured error path was taken.
6. The request body was built via `jq -n --arg` (no raw string concatenation of user input).
7. If `research_dir` was provided, the JSON validates against the schema.

A failed check blocks return.
