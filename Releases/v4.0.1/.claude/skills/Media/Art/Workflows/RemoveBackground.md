# Remove Background Workflow

**Remove backgrounds from existing images using remove.bg API.**

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the RemoveBackground workflow in the Art skill to remove image backgrounds"}' \
  > /dev/null 2>&1 &
```

Running **RemoveBackground** in **Art**...

---

## Purpose

Remove backgrounds from existing images to create transparent PNGs. Useful for:
- Converting diagrams to transparent backgrounds
- Preparing images for web display
- Creating icons with transparent backgrounds
- Cleaning up screenshots

---

## Workflow Steps

### Step 1: Verify Input File

Confirm the image file exists and note its current size.

```bash
ls -lh /path/to/image.png
```

### Step 2: Remove Background

Use the remove.bg API to remove the background:

```bash
cd /path/to/directory

curl -X POST https://api.remove.bg/v1.0/removebg \
  -H "X-Api-Key: ${REMOVEBG_API_KEY}" \
  -F "image_file=@input-image.png" \
  -F "size=auto" \
  -o output-image.png
```

**API Key:** Stored in `~/.config/PAI/.env` as `REMOVEBG_API_KEY`

**Parameters:**
- `size=auto` - Automatic size detection (recommended)
- `size=preview` - Smaller preview size (0.25 megapixels)
- `size=full` - Full resolution (up to 25 megapixels)

### Step 3: Verify Transparency

Check that the output file has transparency:

```bash
# Check file size (should be different from original)
ls -lh output-image.png

# Verify transparency with ImageMagick (if needed)
magick identify -verbose output-image.png | grep -A 5 "Alpha"
```

### Step 4: Replace or Copy to Destination

Either replace the original or copy to the intended destination:

```bash
# Replace original
cp output-image.png input-image.png

# Or copy to specific destination
cp output-image.png /destination/path/transparent-image.png
```

---

## API Credentials

The remove.bg API key is stored in `~/.config/PAI/.env`:

```bash
REMOVEBG_API_KEY=your_key_here
```

**Never hardcode the API key in commands.** Always use `${REMOVEBG_API_KEY}` or load from .env.

---

## Examples

### Example 1: Remove background from diagram

```bash
cd ~/Downloads

curl -X POST https://api.remove.bg/v1.0/removebg \
  -H "X-Api-Key: ${REMOVEBG_API_KEY}" \
  -F "image_file=@TheAlgorithm.png" \
  -F "size=auto" \
  -o TheAlgorithm.png
```

### Example 2: Remove background and save with new name

```bash
cd ${PROJECTS_DIR}/YourWebsite/cms/public/images

curl -X POST https://api.remove.bg/v1.0/removebg \
  -H "X-Api-Key: ${REMOVEBG_API_KEY}" \
  -F "image_file=@logo-with-bg.png" \
  -F "size=auto" \
  -o logo-transparent.png
```

### Example 3: Process multiple images

```bash
cd ~/Downloads

for img in diagram-*.png; do
  curl -X POST https://api.remove.bg/v1.0/removebg \
    -H "X-Api-Key: ${REMOVEBG_API_KEY}" \
    -F "image_file=@$img" \
    -F "size=auto" \
    -o "transparent-$img"
done
```

---

## API Rate Limits

Free tier: 50 API calls per month

Check usage at: https://www.remove.bg/dashboard

---

## Troubleshooting

**Problem:** "No onnxruntime backend found"
**Solution:** Don't use local rembg. Use the remove.bg API via curl.

**Problem:** "API key invalid"
**Solution:** Verify `REMOVEBG_API_KEY` is set correctly in `~/.config/PAI/.env`

**Problem:** "Output file is same size as input"
**Solution:** Background removal may have failed. Check API response for errors.

---

## Related Workflows

- `Workflows/CreatePAIPackIcon.md` - Uses `--remove-bg` flag in Generate.ts
- `Workflows/Essay.md` - May need background removal for thumbnails
- `Workflows/YouTubeThumbnail.md` - May need transparent overlays

---

**Last Updated:** 2026-01-24
