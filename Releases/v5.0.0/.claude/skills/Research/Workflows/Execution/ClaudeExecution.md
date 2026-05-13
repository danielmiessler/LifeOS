# Claude Researcher Execution

Execution protocol for the Claude researcher. Claude does not call an external provider API; it uses the built-in `WebSearch` tool. This file documents the protocol so the four researchers stay homogeneous (one Execution file per researcher) and so anyone reviewing or extending the architecture sees the same shape across providers.

## Provider

| Field | Value |
|-------|-------|
| Backend | Built-in `WebSearch` tool |
| API key required | No (uses host session credentials) |
| External calls | None from the researcher itself |
| Citation source | Search result blocks returned by `WebSearch` |

## Model selection by research mode

The host session decides the model. This researcher branches by depth instead of by model swap.

| Mode | Behavior |
|------|----------|
| Quick | One `WebSearch` call, top three results, no follow-up reads. |
| Standard | One `WebSearch` call, up to five results, optional follow-up `WebFetch` on the highest-signal page. |
| Extensive | Up to three `WebSearch` calls with reformulated queries, follow-up `WebFetch` on the top two pages. |
| Deep | Iterative `WebSearch` + `WebFetch` passes until the question is answered or three iterations are spent. |

One query per call. Do not bundle multiple questions into a single `WebSearch`.

## Execution shape

```
WebSearch query="<single, focused query>"
# Optionally for higher modes:
WebFetch url="<top result URL>" prompt="<extraction instruction>"
```

The researcher reads search-result blocks directly from tool output. No JSON parsing is required.

## Citations

Each `WebSearch` result block contains a URL and a title. The researcher captures both for the `sources` array of the output schema below. Never paraphrase a result and drop its URL; the URL is the citation.

## URL verification

Every URL included in `sources` must be verified before delivery:

```bash
curl -s -o /dev/null -w "%{http_code}" -L --max-time 8 "<url>"
```

A status code outside `200..399` means the URL fails verification: omit it from the `sources` array entirely, or substitute a verified alternative. Never write an unverified URL to a source object with `verified: true`.

## File-based output

When the researcher is invoked with a `research_dir` argument by the Research skill, it writes its findings to `${research_dir}/claude.json`. A downstream synthesis step (a separate synthesizer agent or the calling workflow's synthesis pass) reads these files to cross-reference findings, score consensus, and surface contrarian signal. The schema is shared by all four researchers so the synthesis layer stays researcher-agnostic.

```json
{
  "agent": "claude",
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

  "provider": "claude-websearch",
  "mode": "quick|standard|extensive|deep",
  "started": "<ISO-8601 timestamp>",
  "finished": "<ISO-8601 timestamp>"
}
```

**Required fields** (the synthesis layer reads only these): `agent`, `query`, `summary` (array of up to 10 short strings), `sources` (array of `{title, url, verified}` objects), `confidence` (numeric `0.0` to `1.0`), `full_findings` (string).

**Optional informational fields** (synthesis layer ignores them): `provider`, `mode`, `started`, `finished`. Useful for debugging and audit.

If `research_dir` is not provided, the researcher returns the same payload inline to its caller and skips file writing.

## Fallback policy

The Claude researcher has no provider to fall back from. If `WebSearch` is unavailable, the researcher writes a stub file with the error recorded in `full_findings` and an empty `summary`. It does NOT attempt a different provider on its own. Switching providers is the Research skill's decision, not the researcher's.

```json
{
  "agent": "claude",
  "query": "<verbatim user query>",
  "summary": [],
  "sources": [],
  "confidence": 0.0,
  "full_findings": "ERROR: WebSearch tool unavailable in current session",
  "status": "error",
  "reason": "WebSearch tool unavailable in current session"
}
```

The synthesis layer treats `summary: []` as agent-unavailable and continues with whichever other researchers produced output.

## Self-verification checklist

Before writing the output file (or returning inline), the researcher confirms:

1. Every URL in `sources` was verified via curl (HTTP `200..399`) and is recorded with `verified: true`.
2. The `summary` array has at most 10 items, each a short self-contained finding.
3. The `confidence` value reflects overall reliability (`0.9` if every claim is solidly sourced and corroborated, `0.5` for mixed signal, `0.0` only when no findings were produced).
4. Every quantitative claim in `full_findings` and `summary` appears in the cited source.
5. No URL was invented or pattern-completed from training data.
6. If file output was requested, the JSON validates against the schema above.

A failed check blocks return; the researcher fixes the issue or lowers the `confidence` value and re-checks.
