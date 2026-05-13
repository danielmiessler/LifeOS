# Grok Researcher Execution

Execution protocol for the Grok researcher. Uses the xAI Chat Completions API with live search enabled. Never falls back silently to `WebSearch`: if the API is unreachable or rate-limited, the researcher writes a stub error file (or returns a structured error inline) and the Research skill decides the next step.

## Provider

| Field | Value |
|-------|-------|
| Backend | xAI Chat Completions API |
| Endpoint | `https://api.x.ai/v1/chat/completions` |
| API key | `XAI_API_KEY` in environment (loaded from `~/.claude/.env`) |
| Live search | Enabled by setting `search_parameters.mode = "on"` |
| Differentiator | Real-time data including X (Twitter) signal; strong on STEM, math, current events |

## Model selection by research mode

| Mode | Model | Rationale |
|------|-------|-----------|
| Quick | `grok-3-mini` | Fast and cheap for narrow single-query lookups |
| Standard | `grok-3` | Balanced reasoning, default for general research |
| Extensive | `grok-4` | Deep reasoning, more search iterations per call |
| Deep | `grok-4` | Same model, used across multiple iterative calls |

Model names are pinned per tier. Do not auto-upgrade mid-call.

## Execution shape

One query per call. Build the JSON request body with `jq -n --arg` to safely escape the user query (never string-concatenate user input into a shell-quoted JSON):

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
    search_parameters: { mode: "on" },
    max_tokens: 2048,
    temperature: 0.2
  }')

curl -sS --max-time 60 \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST "https://api.x.ai/v1/chat/completions" \
  -d "$BODY"
```

The researcher captures the response, parses it as JSON, and treats HTTP 200 as success. Any non-200 status triggers the fallback policy below.

## Citation extraction

xAI live search returns citations in the response. Two patterns must be handled depending on the API version returned at runtime:

1. A top-level `citations` array of URLs.
2. A per-message `citations` object inside the `choices[].message` field.

The researcher reads whichever field is populated and maps it to the `sources` array of the output schema (`title`, `url`, `verified: true` after URL verification). When the API returns only URLs, the title field is populated from a follow-up `WebFetch` of the page if title context is needed; otherwise the host part of the URL is used as a minimal placeholder title.

Inline numbered citation markers (`[1]`, `[2]`, ...) in the assistant's content map to the citation array by position.

If a finding cannot be tied to any citation, lower the overall `confidence` value and note the gap in `full_findings`.

## URL verification

Every URL extracted from citations must be verified before delivery:

```bash
curl -s -o /dev/null -w "%{http_code}" -L --max-time 8 "<url>"
```

Status codes outside `200..399` fail verification: omit the URL or substitute a verified alternative. Never write an unverified URL with `verified: true`.

## File-based output

When invoked with `research_dir`, write `${research_dir}/grok.json`. A downstream synthesis step reads this file to cross-reference findings and to detect contrarian signal (Grok's distinguishing role); the schema is shared by all four researchers.

```json
{
  "agent": "grok",
  "query": "<verbatim user query>",
  "summary": [
    "<key finding 1, short and self-contained>",
    "<key finding 2>",
    "<a clearly-flagged contrarian finding when the data supports one>",
    "..."
  ],
  "sources": [
    { "title": "<source title>", "url": "<verified URL>", "verified": true }
  ],
  "confidence": 0.0,
  "full_findings": "<complete detailed research output, no length limit>",

  "provider": "xai-grok",
  "model": "<model name used>",
  "mode": "quick|standard|extensive|deep",
  "live_search": true,
  "x_signal_count": 0,
  "started": "<ISO-8601 timestamp>",
  "finished": "<ISO-8601 timestamp>"
}
```

**Required fields** (the synthesis layer reads only these): `agent`, `query`, `summary` (array of up to 10 short strings), `sources` (array of `{title, url, verified}` objects), `confidence` (numeric `0.0` to `1.0`), `full_findings` (string).

**Optional informational fields** (synthesis layer ignores them): `provider`, `model`, `mode`, `live_search`, `x_signal_count` (number of summary items that came from X / Twitter sources), `started`, `finished`.

If `research_dir` is not provided, the researcher returns the same payload inline to its caller and skips file writing.

## Fallback policy

If the API call returns a 429, a 5xx, a network timeout, or an authentication error:

1. Drop one model tier (for example `grok-4` -> `grok-3`) and retry once.
2. If the retry also fails, write a stub file with the error recorded in `full_findings` and an empty `summary`. Do NOT fall back to `WebSearch`.

```json
{
  "agent": "grok",
  "query": "<verbatim user query>",
  "summary": [],
  "sources": [],
  "confidence": 0.0,
  "full_findings": "ERROR: xAI API HTTP 429 after one retry at lower tier",
  "status": "error",
  "reason": "xAI API HTTP 429 after one retry at lower tier",
  "model_attempts": ["grok-4", "grok-3"]
}
```

A missing or empty `XAI_API_KEY` is reported the same way (`full_findings: "ERROR: XAI_API_KEY not set in environment"`, `status: "error"`).

The synthesis layer treats `summary: []` as agent-unavailable and continues with whichever other researchers produced output.

## Self-verification checklist

Before writing the output file (or returning inline), the researcher confirms:

1. Every URL in `sources` was verified via curl (HTTP `200..399`) and is recorded with `verified: true`.
2. The `summary` array has at most 10 items, each a short self-contained finding.
3. Contrarian findings (where the data plausibly disagrees with consensus) are flagged in `summary` rather than dropped; this preserves the agent's distinguishing role.
4. The `confidence` value reflects overall reliability (drop it when citation mapping was incomplete).
5. Every quantitative claim in `full_findings` and `summary` appears in the cited source.
6. The HTTP status was 200, or the structured error path was taken.
7. The request body was built via `jq -n --arg` (no raw string concatenation of user input).
8. If `research_dir` was provided, the JSON validates against the schema.

A failed check blocks return.
