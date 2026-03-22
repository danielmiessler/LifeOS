# Mine Workflow

Scan AI conversation history for tagged insights and breakthrough moments.

## Step 1: Identify Source

Ask for the conversation export directory. Common locations:
- ChatGPT: exported via Settings → Data Controls → Export data (JSON)
- Claude: session exports (JSONL)
- Any folder of markdown/text conversation logs

## Step 2: Run Mining

```bash
bun ~/.claude/skills/BreadcrumbMining/Tools/breadcrumb-mine.ts \
  --dir <path> \
  --out ~/.claude/breadcrumb-index.md \
  --verbose
```

### Intent-to-Flag Mapping

| User Says | Flag | Effect |
|-----------|------|--------|
| "mine my history" | --dir <path> | Scan all files in directory |
| "verbose", "show matches" | --verbose | Show each match per file |
| "add custom tags" | --tags "phrase1,phrase2" | Add user-specific tag patterns |
| "json output" | --json | Raw JSON for programmatic use |
| "save to" | --out <path> | Custom output location |

## Step 3: Present Results

Show the user:
1. Total breadcrumbs found vs files scanned
2. Category distribution (what they think about most)
3. The heaviest hits (highest-weight matches)
4. Tag distribution (how they naturally mark insights)

## Step 4: Pattern Analysis (Optional)

If the user wants deeper analysis, note patterns:
- Which category is densest? That's their primary discovery channel.
- Are there categories with zero hits? That might be a blind spot.
- Do product ideas emerge from experiences or ideation? (Check product-idea count vs healing/flow counts)
- Is the relational category thin? That could signal an important gap.
