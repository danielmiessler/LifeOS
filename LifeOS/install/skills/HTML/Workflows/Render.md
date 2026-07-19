# Render Workflow

Turn the current session's output into a published, verified HTML artifact.

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Render workflow in the HTML skill to build a designed HTML artifact"}' \
  > /dev/null 2>&1 &
```

Running **Render** in **HTML**...

## Step 0 — Sufficiency Check

If the session contains no substantive output to render (nothing analyzed, researched, or produced yet), say so and ask what to render — don't invent content. If multiple candidate outputs exist, flag which one you picked (`⚠️ Rendering X, not Y; redirect if wrong.`) and proceed.

## Ideal State

- One self-contained HTML file rendering the session's actual output — real content, verbatim quotes kept verbatim, sources preserved, verification flags preserved.
- Rendered by `Tools/Render.ts` from a content JSON. No hand-authored one-off CSS. If the content genuinely doesn't fit the block types, extend Render.ts (new block type or register) so the next run benefits.
- Published as an Artifact and pixel-verified before the URL is handed over.

## Tool Contract

```bash
bun $LIFEOS_ROOT/skills/HTML/Tools/Render.ts --schema      # content JSON shape + example
bun $LIFEOS_ROOT/skills/HTML/Tools/Render.ts --registers   # available registers
bun $LIFEOS_ROOT/skills/HTML/Tools/Render.ts \
  --json <content.json> \
  --register <dossier|ledger> \
  --out <artifact.html>
```

Block types: `prose`, `callout`, `quote` (id + badge + quote/text + note + source), `list` (bold lead-ins), `cut` (strikethrough + stamp — for disclosed rejections), `table`, `group` (era/category separators). Badges listed in the register's `badgeSolid` render filled; others outlined.

### Register choice

| Content | Register |
|---------|----------|
| Evidence file, red team, investigation, claim testing | `dossier` |
| Report, plan, comparison, metrics, finance | `ledger` |
| Same register as the previous artifact this week | pick the other one |

## Publish + Verify (output contract)

1. Load the `artifact-design` skill (required before any Artifact publish), then publish the rendered file with the Artifact tool. Reuse the same file path to update an existing artifact's URL.
2. Verify BOTH legs before handing over the URL:
   - **Publication:** Artifact `list` action shows the artifact.
   - **Render:** serve the HTML file locally (`bunx serve`) and capture it with the Interceptor skill's sanctioned screenshot path; view the pixels. (The artifact URL itself 404s in any browser session not signed into the owner's account — see Gotchas.)
3. Hand over the artifact URL with a one-line description of what it contains.
