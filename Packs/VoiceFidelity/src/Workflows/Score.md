# Score Workflow

Score a document against a voice profile.

## When to Use

User wants to check if a document sounds like them before sending it. The core use case for VoiceFidelity.

## Step 1: Identify Document

Get the file path or accept piped stdin. Supports .md, .txt, and raw text.

## Step 2: Identify Profile

Use default profile at `~/.claude/tools/voice-profile.json` unless user specifies `--profile`.

If no profile exists, tell the user to run Extract first.

## Step 3: Run Score

```bash
bun ~/.claude/skills/VoiceFidelity/Tools/voice-score.ts <document> --verbose
```

### Intent-to-Flag Mapping

| User Says | Flag | Effect |
|-----------|------|--------|
| "score this" | (default) | Standard output with pass/fail |
| "verbose", "show details" | `--verbose` | Show flagged lines per check |
| "show fixes", "how to fix" | `--fix` | Show specific fix suggestions |
| "json output" | `--json` | Raw JSON for programmatic use |
| "use this profile" | `--profile path.json` | Score against custom profile |

## Step 4: Interpret Results

**Pass (70+):** Document matches the voice profile. Safe to send.

**Fail (<70):** Report the failing checks and their fixes. Common issues:
- Banned words: AI filler the author never uses
- Low burstiness: sentences too uniform in length
- Long paragraphs: exceeding the author's typical max
- Topic-sentence-first: too many paragraphs leading with the conclusion

## Step 5: Fix and Rescore (if needed)

If the document fails, apply the suggested fixes and rescore. Iterate until pass.
