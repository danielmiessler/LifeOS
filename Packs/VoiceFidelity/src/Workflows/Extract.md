# Extract Workflow

Extract a voice profile from a writing corpus.

## When to Use

User wants to build a voice profile from their existing writing. First step for any new VoiceFidelity user.

## Step 1: Identify Corpus

Ask the user for their writing directory or specific files. Best corpus:
- 15-20 documents minimum
- Mix of formats (emails, docs, blog posts, transcripts)
- Writing done WITHOUT AI assistance
- Recent writing preferred (voice evolves)

## Step 2: Run Extraction

```bash
bun ~/.claude/skills/VoiceFidelity/Tools/voice-extract.ts \
  --corpus <path> \
  --out ~/.claude/tools/voice-profile.json \
  --verbose
```

Or for specific files:
```bash
bun ~/.claude/skills/VoiceFidelity/Tools/voice-extract.ts \
  --files file1.md file2.md file3.md \
  --out ~/.claude/tools/voice-profile.json
```

## Step 3: Review Profile

Show the user their profile summary:
- Average sentence length and target range
- Burstiness (sentence length variation)
- Fragment rate
- AI words they never use
- Paragraph structure patterns
- Top vocabulary

## Step 4: Generate Voice Card (Optional)

If the user wants a portable voice card for other AI systems, summarize the profile into the VoiceCardTemplate format. This is a markdown file they can paste into any AI's system prompt.

## Output

- JSON profile at specified path (default: `~/.claude/tools/voice-profile.json`)
- Voice card markdown (optional)
