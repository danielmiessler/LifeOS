# DriveRichEditor

You are driving a rich editor: Canva, Google Docs, Google Slides, Sheets, Figma, or any canvas-rendered surface where DOM refs aren't enough. Standard `act` / `click` / `type` won't reach the content because the editor renders its own canvas and intercepts events.

## Preflight Isolation Gate (MANDATORY first step)

```bash
source $LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env
bash $LIFEOS_ROOT/skills/Interceptor/Tools/PreflightIsolation.sh
```

This is the heaviest trusted-input workflow — dispatched events mutate live editor content, so a wrong-profile run can corrupt the operator's real documents. Non-zero exit → STOP and surface the message verbatim. Do not fall back to the Default profile. Every `interceptor` verb below passes `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` (the pinned isolated context from `preferences.env`); the examples show it on the runnable blocks. Screenshots/thumbnails go through `Tools/Capture.sh` where a pixel capture is needed.

## Command Budget

**4 commands base + 1 per text write.**

1. `interceptor open <url>` → 1
2. `interceptor scene profile` → 1 (always first; do not guess)
3. `interceptor scene <primitive>` (the named primitive for the task — see table below) → 1
4. Verify with `interceptor scene text <ref>` or `interceptor scene render` → 1

Every additional `scene insert "..."` adds 1 command. At budget without the answer, re-read once and commit.

## Right primitive per task

| Task | Primitive | Anti-pattern |
|---|---|---|
| Read speaker notes | `interceptor scene notes` | Cycling `scene list` → `scene select` → `scene selected` → `text e3` |
| Read scene-resident text | `interceptor scene text <ref>` | Full `interceptor read` — the tree is irrelevant when you have the scene ref |
| Confirm a write landed | `scene text <ref>` or `scene render` | Reopening the page |
| Discover scene structure | `scene profile` (once) | `scene profile`, then `scene profile --verbose`, then `scene list` — once is enough |

## First step — always

```bash
interceptor scene profile --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

This tells you which scene model the page exposes. **Don't guess.** Empty/unsupported profile = page has no scene support; fall back to DOM reads or `eval --main`. Append `--context "$INTERCEPTOR_TEST_CONTEXT_ID"` to every `scene`/`eval`/`read`/`act` call in this workflow, including the per-task and per-editor commands in the tables below.

## Workflow by editor

### Google Docs
- Strongest structured target — paragraphs, lines, tables.
- Insert text: `interceptor scene insert "..."`
- Navigate selection: `interceptor scene cursor-to <scene-ref>`
- Read current content: `interceptor scene text <scene-ref>`
- Table cells: see "Canvas-rendered editor input" below.

### Google Slides
- Navigation + selection work via scene.
- `interceptor scene slide list` / `slide current` / `slide goto 3`
- Text insertion and table growth often require `eval --main` with dispatched events.
- Read notes: `interceptor scene notes`
- Render thumbnail: `interceptor scene render`

### Canva
- Partial scene support — confirm with `scene profile --verbose`.
- Prefer accessible menus + toolbar (DOM refs) before scene clicks.
- Layer manipulation often needs dispatched events.

### Figma / design tools
- DOM refs cover the side panels.
- Canvas interactions (layer select, zoom, pan) require dispatched `MouseEvent` / `WheelEvent` with `event.__interceptor_trust = true`.

## Canvas-rendered editor input (Docs / Slides / Sheets)

When `scene insert` is not enough — cell-precise writes, paragraph style changes, keyboard shortcuts to surfaces with no scene equivalent — use the pre-load trust override path via `interceptor eval --main`:

1. **Caret positioning:** dispatch `mousedown` / `mouseup` / `click` on `.kix-canvas-tile-content` with `event.__interceptor_trust = true` at the target pixel. Verify via `iwin.getSelection().anchorNode` parent chain.
2. **Text entry:** construct `KeyboardEvent` from the iframe's OWN window (`new iwin.KeyboardEvent(...)`), dispatch on the iframe document (`idoc.dispatchEvent(ev)`).
3. **Printable keys** (letters, digits, symbols, Space, Enter): full `keydown` → `keypress` → `keyup`.
4. **Navigation/control keys** (Tab, Arrow*, Home, End, Escape, Backspace, Delete, modifiers): `keydown` → `keyup` ONLY — never `keypress`. Dispatching `keypress` on a navigation key inserts its ASCII character (Tab=`\t`, ArrowUp=`&`, ArrowLeft=`%`, ArrowRight=`'`).

**Trap:** in Docs tables, **Tab past the last cell of the last row creates a new row.** Fill row N with N writes and N−1 Tabs; exit the table with `ArrowDown`.

## Canvas camera apps (WebGL)

Same `userActivation` override + `__interceptor_trust` pattern drives WebGL camera apps. Pan via dispatched `MouseEvent` (mousedown → mousemove sweep → mouseup) on the canvas; zoom via `WheelEvent { deltaY: ±120 }` or `Minus` / `Equal` keystrokes. Anchor DOM overlays to lat/lng with a Web Mercator projection helper (`pixels per deg lng = 256 * 2^zoom / 360`).

## Native export capture (any client-side-rendering app)

Modern editors render exports client-side: WebGL/Canvas2D → `Blob` → `URL.createObjectURL` → `<a download>.click()`. To capture bytes without a Save dialog:

1. **Patch `URL.createObjectURL`** in MAIN world to record every blob the app stages.
2. **Patch `HTMLAnchorElement.prototype.click`** to swallow programmatic auto-downloads with `download` attribute or `blob:` href.
3. **`fetch(blobUrl).then(r => r.arrayBuffer())`** before the app revokes the URL.

## Verify

```bash
interceptor scene text <scene-ref> --context "$INTERCEPTOR_TEST_CONTEXT_ID"          # Re-read the surface
interceptor scene render --context "$INTERCEPTOR_TEST_CONTEXT_ID"                    # Thumbnail for visual confirm
```

Re-read after every dispatched-event sequence. The selection/caret state can shift in ways the dispatch sequence didn't predict.
