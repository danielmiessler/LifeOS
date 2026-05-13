# Gemini Researcher Execution

Execution protocol for the Gemini researcher. Uses the `gemini` CLI (Google Generative AI CLI) for real provider calls with Google Search grounding. Never falls back silently to `WebSearch`: if the CLI is unavailable or rate-limited, the researcher writes a stub error file (or returns a structured error inline) and the Research skill decides the next step.

## Provider

| Field | Value |
|-------|-------|
| Backend | `gemini` CLI (Google Generative AI CLI) |
| API key | `GEMINI_API_KEY` in environment (loaded from `~/.claude/.env`) |
| Grounding | Google Search grounding enabled by default for online modes |
| Citation source | `grounding_metadata.web_search_queries` and inline citation markers in CLI output |

## Model selection by research mode

| Mode | Model | Rationale |
|------|-------|-----------|
| Quick | `gemini-2.5-flash` | Fast, single-pass, high recall on common queries |
| Standard | `gemini-2.5-flash` | Same model; the depth comes from query decomposition, not model swap |
| Extensive | `gemini-3-pro` | Deeper reasoning for stress-testing across 3-10 query variations |
| Deep | `gemini-3-pro` | Long-context, multi-iteration synthesis |

Replace the model name only at the configured tier boundary. Do not auto-upgrade mid-call.

## Execution shape

One query per call. No multi-query bundling.

```bash
gemini -m "$MODEL" -p "$QUERY" --grounding google_search
```

The researcher captures stdout, parses citation markers, and treats CLI exit code zero as success. Any non-zero exit code triggers the fallback policy below.

### Multi-perspective decomposition

For Standard and higher modes, the researcher generates query variations before invocation:

```
Original: "AI impact on labor markets"
Variations:
  1. AI impact on labor markets, optimistic tech-adoption view
  2. AI impact on labor markets, displacement and skill-mismatch view
  3. AI impact on labor markets, sector-specific (manufacturing, services, knowledge work)
  4. Historical precedents for technological labor displacement
```

Each variation runs as a separate `gemini` invocation. Results are merged by the researcher into a single output (one summary array, one sources array, one confidence value).

## Citations

Gemini CLI returns inline citation markers (`[1]`, `[2]`, ...) and a citation list at the end of its response. The researcher maps each marker to its URL and writes both to the `sources` array of the output schema (`title`, `url`, `verified: true` after URL verification).

If a finding cannot be tied to a specific citation, lower the overall `confidence` value and note the gap in `full_findings`.

## URL verification

Every URL produced by Gemini citation extraction must be verified before delivery:

```bash
curl -s -o /dev/null -w "%{http_code}" -L --max-time 8 "<url>"
```

Status codes outside `200..399` fail verification: omit the URL or substitute a verified alternative. Never write an unverified URL with `verified: true`.

## File-based output

When invoked with `research_dir`, write `${research_dir}/gemini.json`. A downstream synthesis step reads this file to cross-reference findings; the schema is shared by all four researchers.

```json
{
  "agent": "gemini",
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

  "provider": "gemini-cli",
  "model": "<model name used>",
  "mode": "quick|standard|extensive|deep",
  "query_variations": ["<variation 1>", "<variation 2>", "..."],
  "started": "<ISO-8601 timestamp>",
  "finished": "<ISO-8601 timestamp>"
}
```

**Required fields** (the synthesis layer reads only these): `agent`, `query`, `summary` (array of up to 10 short strings), `sources` (array of `{title, url, verified}` objects), `confidence` (numeric `0.0` to `1.0`), `full_findings` (string).

**Optional informational fields** (synthesis layer ignores them): `provider`, `model`, `mode`, `query_variations`, `started`, `finished`.

If `research_dir` is not provided, the researcher returns the same payload inline to its caller and skips file writing.

## Fallback policy

If the `gemini` CLI is missing, the API key is absent, or the call returns a 429 or a timeout:

1. Drop one model tier (for example `gemini-3-pro` -> `gemini-2.5-flash`) and retry once.
2. If the retry also fails, write a stub file with the error recorded in `full_findings` and an empty `summary`. Do NOT fall back to `WebSearch`.

```json
{
  "agent": "gemini",
  "query": "<verbatim user query>",
  "summary": [],
  "sources": [],
  "confidence": 0.0,
  "full_findings": "ERROR: gemini CLI exit 429 after one retry at lower tier",
  "status": "error",
  "reason": "gemini CLI exit 429 after one retry at lower tier",
  "model_attempts": ["gemini-3-pro", "gemini-2.5-flash"]
}
```

The synthesis layer treats `summary: []` as agent-unavailable and continues with whichever other researchers produced output.

## Self-verification checklist

Before writing the output file (or returning inline), the researcher confirms:

1. Every URL in `sources` was verified via curl (HTTP `200..399`) and is recorded with `verified: true`.
2. The `summary` array has at most 10 items, each a short self-contained finding.
3. The `confidence` value reflects overall reliability (drop it when citation markers were unmapped or when CLI grounding metadata was incomplete).
4. Every quantitative claim in `full_findings` and `summary` appears in the cited source.
5. The CLI exit code was zero, or the structured error path was taken.
6. If `research_dir` was provided, the JSON validates against the schema.

A failed check blocks return.
