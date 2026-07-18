# ScreenshotForVlm

Taking a screenshot of a webpage for a vision-language model (VLM) to read. Use this when pixels are genuinely the answer — visual layout, color, a chart artifact, a rendered glyph — and no structured read (`read`, `text`, `inspect`, `scene text`, `canvas log`, `macos tree`) can produce the same information.

**Screenshots are a last-resort read surface.** Structured reads cost ~10× fewer tokens per turn and survive DOM churn better than pixels. Try every other read first.

## Preflight Isolation Gate (MANDATORY first step)

```bash
source ~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env
bash ~/.claude/skills/Interceptor/Tools/PreflightIsolation.sh
```

Non-zero exit → STOP and surface the message verbatim. Do not fall back to the Default profile. Capture goes through `Tools/Capture.sh`, which re-runs this gate, routes to `INTERCEPTOR_TEST_CONTEXT_ID`, and resolves the destination to `$LIFEOS_DOWNLOADS_DIR` (fallback `~/Downloads/`) for review artifacts — never raw `interceptor screenshot`.

## Command Budget

**1 command.** The agent-default recipe below IS the budget.

```bash
bash ~/.claude/skills/Interceptor/Tools/Capture.sh --current
```

If the first screenshot doesn't answer the question, do NOT take a second exploratory screenshot — re-evaluate whether pixels are actually the answer. The "exploratory then second screenshot" pattern is the failure mode this budget exists to prevent. If you need a second capture, scope it tightly with the underlying `--selector`, `--element <ref>`, or `--region X,Y,W,H` flags — still 1 command, not a re-take.

## The agent-default recipe

```bash
bash ~/.claude/skills/Interceptor/Tools/Capture.sh --current
```

`Capture.sh` runs `interceptor screenshot` under the hood with the DOM-render path, the pinned `--context`, `--save`, and a `$LIFEOS_DOWNLOADS_DIR` destination (fallback `~/Downloads/`), then prints the absolute saved-image path on its only stdout line. No inline base64; the path re-reads on demand and never bloats your context. The defaults it applies are load-bearing:

- **`--save`** — writes bytes to disk (Capture.sh stages the write and moves it to `$LIFEOS_DOWNLOADS_DIR`, fallback `~/Downloads/`) and strips `dataUrl` from the result. Without it the WebP rides the response inline.
- **`--format webp`** — re-encodes at the SW boundary via OffscreenCanvas. ~5–8× smaller than PNG at q=85 with no measurable VLM accuracy loss. Default WebP quality is 85; PNG/JPEG default to 92.
- **`--target-max-long-edge 1568`** — clamps the rasterized canvas long edge to 1568 px, Anthropic Sonnet's auto-resize ceiling. Pixels above that ceiling get downscaled by the API anyway. Vendor ceilings:
  - Sonnet — 1568 px
  - Opus — 2576 px
  - OpenAI — normalizes to 2048-then-768
- **`--quality 85`** — WebP quality. Empirically no measurable VLM accuracy loss vs PNG.

## When to override the default

Pass these through Capture.sh's underlying flags (Capture.sh forwards extra args to `interceptor screenshot`):

- `--target-max-long-edge 2576` — Opus or higher-fidelity consumer.
- `--selector <css>` — capture a single matching element. Off-screen supported.
- `--element <ref>` — capture a refRegistry-tracked element (`e5`, `e2_7`).
- `--region X,Y,W,H` — arbitrary page rectangle (`--clip` is a deprecated alias).
- `--scale <n>` — override pixel ratio. `--target-max-long-edge` wins when both are set.
- `--pixel` — opt out of DOM-render to the legacy `captureVisibleTab` compositor path. Captures the window's *active* tab, so to shoot a specific background tab it briefly activates it and restores focus — **the visible flash is by design**. Requires the window non-minimized and visible; minimized → fast honest failure. Use only when DOM-render fidelity is insufficient (compositor effects, hardware video frames, browser chrome itself). `--pixel --tab` can capture the WRONG page (it follows the active tab) — read the saved image back and confirm it's the target before trusting it.
- `--pixel --full` — scroll-and-stitch full page. Rate-limited at ~1100ms per viewport strip to clear Chrome's 2/sec `captureVisibleTab` cap; stitched in the SW.

Default DOM-render works from a backgrounded Chrome on a different macOS Space — no focus required. This is the engineered-robust path; `--pixel` is the fragile, flash-inducing opt-out.

## Before reaching for a screenshot

Try these first:

- `interceptor read --text-only --context "$INTERCEPTOR_TEST_CONTEXT_ID"` — cheapest read.
- `interceptor read --tree-only --context "$INTERCEPTOR_TEST_CONTEXT_ID"` — actionable refs.
- `interceptor inspect --context "$INTERCEPTOR_TEST_CONTEXT_ID"` — tree + text + passive network.
- `interceptor scene text <ref> --context "$INTERCEPTOR_TEST_CONTEXT_ID"` — text inside a rich editor.
- `interceptor canvas log <n> --context "$INTERCEPTOR_TEST_CONTEXT_ID"` — observer log of canvas draw calls.
- `interceptor macos tree --app "X"` — when the target is outside the page (macOS computer-use path; no browser context).

If any returns the answer, you don't need pixels.

## Output format

Report:
- The path written (Capture.sh's single stdout line, e.g. `$LIFEOS_DOWNLOADS_DIR/interceptor-capture-<ts>-<rand>.png`)
- Dimensions and on-disk size
- What you saw in the image (the actual visual finding, not "the page rendered")
- Whether the pixel evidence answered the question, or whether you still need another read
