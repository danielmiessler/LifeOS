# Headshot

Status: bun ~/.claude/skills/Headshot/Tools/Headshot.ts check · optional

## What it does

Generates professional AI headshots of you with Google's Gemini image model (the `geminiImage` entry in `LIFEOS/TOOLS/models.ts`). You give it a few real, approved photos of your face; each is tagged with the mood it shows, so the skill can pick references whose energy matches the shot you want (a warm photo for a warm result, a neutral one for a neutral result). It builds a studio-portrait prompt from your default look (attire, backdrop, mood), generates at 2K or 4K in the ratio you need, and saves every result to a folder in your USER tree so nothing lands in the skill itself. For anything public it makes two to four variants and a pick sheet so you choose before anything ships.

It needs a Google AI API key, a folder of your own approved photos, and one config file that lists them.

## Fill in

One file: `LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Headshot/Config.md`. Smallest working example:

```markdown
# Headshot Config

## Reference photos

Directory: `~/Pictures/headshot-references`

| File | Sentiment | Notes |
|------|-----------|-------|
| `alex-front.jpg` | neutral | steady, straight to camera |
| `alex-smile.jpg` | positive | warm, relaxed smile |
```

| Section | Required | What goes in it |
|---------|----------|-----------------|
| `## Reference photos` | yes | A `Directory:` line with the folder path in backticks, then a table of `File`, `Sentiment` and `Notes`. Files are relative to that directory (PNG, JPEG or WebP). Use one sentiment word per photo, such as neutral, positive, casual, curious, thinking, skeptical or surprise. Only real photos you approve belong here, never generated or rejected images. |
| `## Default look` | no | Table of `Key` and `Value` with the keys `attire`, `backdrop` and `mood`. Without it the skill uses a dark blazer on a neutral gray gradient. Describe mood as a scene, for example `the relaxed confidence of explaining something you know well`, never as facial mechanics. |
| `## Scene plates` | no | Table of `Name`, `Path` and `Description` for real background photos (an empty studio or office) to composite you into. |
| `## Notes` | no | Free text; the skill does not read it. |

Generated headshots are written to `LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Headshot/generated-headshots/`, which the skill creates when it first saves one.

## Accounts and secrets

- A Google AI Studio account. Create an API key at https://aistudio.google.com/apikey and make sure the project can use the Gemini image model (billing may be required).
- Env key `GOOGLE_API_KEY` in `~/.claude/.env`, set to that key.
- Tool dependencies: run `bun install` in `~/.claude/skills/Headshot/Tools` (installs `@google/genai`).
- Optional: ImageMagick (`magick`) for the pick-sheet montage.

## Prove it works

```bash
cd ~/.claude/skills/Headshot/Tools && bun install
bun ~/.claude/skills/Headshot/Tools/Headshot.ts check
bun ~/.claude/skills/Headshot/Tools/Headshot.ts references --sentiment neutral
```

The first prints `OK: <n> reference photo(s) in <dir>; GOOGLE_API_KEY set; ...` and exits 0. If `Config.md` is missing, lists no photos, none of the listed files exist, or the key is unset, it exits 1 and says which, pointing at this guide. The second prints a JSON list with the photo's `path` and `"exists": true`; it exits 1 when no existing photo carries that sentiment. To see a real result, ask the assistant for a headshot: it saves a PNG under `generated-headshots/` and, once the ArtDirection critique passes, delivers a copy to `~/Downloads/` through `Deliver.ts`.