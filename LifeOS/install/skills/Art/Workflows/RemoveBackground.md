# Remove Background Workflow

**Remove backgrounds from existing images using local rembg (no external API).**

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the RemoveBackground workflow in the Art skill to remove image backgrounds"}' \
  > /dev/null 2>&1 &
```

Running **RemoveBackground** in **Art**...

---

## Purpose

Remove backgrounds from existing images to create transparent PNGs. Useful for:
- Converting diagrams to transparent backgrounds
- Preparing images for web display (composites cleanly over the cream blog background)
- Creating icons with transparent backgrounds
- Cleaning up screenshots

---

## Tooling

Local `rembg` (Python, ONNX-based, runs offline). No external API, no rate limits, no API keys.

**Default binary path:** `~/.local/bin/rembg` (override with `REMBG_BIN` env var).

**Install if missing:**
```bash
pipx install rembg          # preferred
# or
uv tool install rembg       # if you use uv
```

---

## Workflow Steps

### Step 1: Verify Input File

Confirm the image file exists and note its current size.

```bash
ls -lh /path/to/image.png
```

### Step 2: Remove Background

Use the LifeOS `RemoveBg.ts` wrapper, which calls local `rembg` and handles the `.jpg → .png` rename automatically (rembg always emits PNG):

```bash
# Single file (overwrites; renames .jpg→.png)
bun "${LIFEOS_DIR}/TOOLS/RemoveBg.ts" input-image.png

# Single file with explicit output path
bun "${LIFEOS_DIR}/TOOLS/RemoveBg.ts" input-image.jpg output-image.png

# Batch (overwrites each in place)
bun "${LIFEOS_DIR}/TOOLS/RemoveBg.ts" img1.png img2.png img3.png
```

If you need to call `rembg` directly:

```bash
~/.local/bin/rembg i input-image.png output-image.png
```

### Step 3: Verify Transparency

Confirm the output is real PNG with an alpha channel:

```bash
# MUST report "PNG image data, ... RGBA"
file output-image.png

# Sanity-check alpha via ImageMagick
magick identify -format "%[channels]" output-image.png
# → "srgba" (or contains "a") = alpha present
# → "srgb" without "a" = NO alpha — transparency failed
```

### Step 4: Replace or Copy to Destination

Either replace the original or copy to the intended destination:

```bash
# Replace original (after verification)
mv output-image.png input-image.png

# Or copy to specific destination
cp output-image.png /destination/path/transparent-image.png
```

---

## Examples

### Example 1: Remove background from a diagram

```bash
bun "${LIFEOS_DIR}/TOOLS/RemoveBg.ts" ~/Downloads/TheAlgorithm.png
```

### Example 2: Remove background and save with new name

```bash
bun "${LIFEOS_DIR}/TOOLS/RemoveBg.ts" \
  ~/your-site/public/images/logo-with-bg.png \
  ~/your-site/public/images/logo-transparent.png
```

### Example 3: Process multiple images

```bash
cd ~/Downloads
bun "${LIFEOS_DIR}/TOOLS/RemoveBg.ts" diagram-*.png
```

---

## Troubleshooting

**Problem:** `rembg not found at ~/.local/bin/rembg`
**Solution:** `pipx install rembg` (or set `REMBG_BIN` env var to your installed path).

**Problem:** First run is slow (downloads ONNX model)
**Solution:** Expected. The default `u2net` model (~176MB) is fetched once into `~/.u2net/`, then cached forever. Subsequent runs are fast.

**Problem:** Output file looks identical to input
**Solution:** rembg failed to detect a clear subject. Try a model better suited to the content:
```bash
~/.local/bin/rembg i -m u2netp input.png output.png       # smaller/faster
~/.local/bin/rembg i -m isnet-general-use input.png output.png   # general-purpose, often better edges
~/.local/bin/rembg i -m birefnet-general input.png output.png    # higher quality, slower
```

**Problem:** Edges are jagged or hair/fine detail is lost
**Solution:** Use `birefnet-general` (or `birefnet-portrait` for people) — both produce noticeably better edges than the default `u2net`.

---

## Related Workflows

- `Workflows/CreateLifeosPackIcon.md` — uses `--remove-bg` flag in Generate.ts (now backed by local rembg)
- `Workflows/Essay.md` — `--thumbnail` flag in Generate.ts implicitly removes background via local rembg

---

**Last Updated:** 2026-04-27 — switched from poof.bg to local rembg
