# DA — Digital Assistant Identity

This directory holds the identity and personality of every Digital
Assistant (DA) in your PAI. Most users have one DA; advanced users can run
multiple (e.g., a primary DA plus a specialist).

## Files

| File | What it holds |
|------|----------------|
| `_presets.yaml` | Built-in personality presets the interview offers. **Don't edit** — used by `DAInterview.ts`. |
| `_registry.yaml` | The list of DAs you've created. Auto-managed by the interview. |
| `_example/` | A reference DA showing the file shapes (identity.yaml, growth.jsonl, opinions.yaml, diary.jsonl). |
| `<your-da-name>/` | Created by `DAInterview.ts` once you complete the wizard. |

## Creating a DA

The installer launches the DA interview. If you skipped it,
or want to add another DA later:

```bash
bun ~/.claude/PAI/TOOLS/DAInterview.ts                  # Quick mode
bun ~/.claude/PAI/TOOLS/DAInterview.ts --depth standard # More detail
bun ~/.claude/PAI/TOOLS/DAInterview.ts --depth deep     # Every phase
```

The interview asks for:

- **Name** — what you call your DA (and what they call themselves).
- **Personality traits** — twelve sliders (enthusiasm, warmth, precision,
  etc.) that shape how the DA writes.
- **Catchphrase** — the phrase the DA says at session start.

Output lands in `<your-da-name>/`:

```
DA_IDENTITY.yaml   # Structured config (read by hooks via lib/identity.ts)
DA_IDENTITY.md     # Human-readable identity (loaded by CLAUDE.md @-import)
growth.jsonl       # Append-only log of how the DA's understanding evolves
opinions.yaml      # The DA's opinions about you and your work
diary.jsonl        # The DA's session-by-session reflections
```

## Updating later

```bash
bun ~/.claude/PAI/TOOLS/DAInterview.ts --update            # Update primary DA
bun ~/.claude/PAI/TOOLS/DAInterview.ts --update --da kai   # Update specific DA
```

## Privacy

Nothing in this directory ships in a public PAI release. The bootstrap
defaults at `Templates/USER/DA/` give a fresh installer the shape; your
real DA identities stay on your machine.
