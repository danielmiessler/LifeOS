---
name: Remotion
version: 1.2.10
description: "Creates programmatic video with React via Remotion — compositions, sequences, and motion graphics animated with useCurrentFrame() and rendered to MP4. USE WHEN video, animation, motion graphics, video rendering, React video, render video, animate content, make a short, create animations, video overlay, explainer video, animated explainer, content to video, programmatic video. NOT FOR static images, diagrams, or illustrations (use Art), tight-cut filler removal from raw recordings (use Video), or audio-only podcast cleaning (use AudioEditor)."
effort: medium
---

## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Remotion skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Remotion** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Remotion

## What It Does

Creates video programmatically with React. You describe the composition in code; Remotion renders it to MP4. Every frame is driven by `useCurrentFrame()` rather than CSS animation, so the output is deterministic and reproducible. It pulls LifeOS theme constants and Art-skill aesthetics for visual consistency, and stages output to `~/Downloads/` for preview first.

## The Problem

Making a short explainer or motion-graphics clip the usual way means a video editor, a timeline, and a lot of manual keyframing — slow, hard to version, and impossible to regenerate when the content changes. If the script changes, you redo the edit by hand. Building video as code fixes that: the composition is a React component, animation is a function of the frame number, and re-rendering after an edit is one command. This skill is the code path for video, the way the Art skill is the code path for images.

## How It Works

Define a composition as React, animate with `useCurrentFrame()`, render with `bunx remotion render`. Rendering is CPU-intensive, so it runs in the background. See the Quick Reference and Tools below for the render command, theme integration, and pattern files.

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/Remotion/`

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| ContentToAnimation | "animate this", "create animations for", "video overlay" | `Workflows/ContentToAnimation.md` |
| GeneratedContentVideo | "generate video", "AI video", "content to video", "make a short" | `Workflows/GeneratedContentVideo.md` |

## Quick Reference

- **Theme:** Always use LIFEOS_THEME from `Tools/Theme.ts`
- **Art Integration:** Load Art preferences before creating content
- **Critical:** NO CSS animations - use `useCurrentFrame()` only
- **Output:** Always to `~/Downloads/` first
- **CLI:** `bunx` always (never `npx`)

**Render command:**
```bash
bunx remotion render {composition-id} ~/Downloads/{name}.mp4
```

## Full Documentation

- **Art integration:** `ArtIntegration.md` - theme constants, color mapping
- **Common patterns:** `Patterns.md` - code examples, presets
- **Critical rules:** `CriticalRules.md` - what NOT to do
- **Detailed reference:** `Tools/Ref-*.md` - 31 pattern files covering core Remotion + Lambda + ElevenLabs captions + AI pipeline

## Tools

| Tool | Purpose |
|------|---------|
| `Tools/Render.ts` | Render, list compositions, create projects |
| `Tools/Theme.ts` | LifeOS theme constants derived from Art |

## Links

- Remotion Docs: https://remotion.dev/docs
- GitHub: https://github.com/remotion-dev/remotion

## Gotchas

- **React-based video — component patterns differ from web React.** Remotion has specific composition, sequence, and timing APIs.
- **Rendering is CPU-intensive.** Use `run_in_background: true` for render commands.
- **Output goes to ~/Downloads/ first** for preview. Same as images.
- **NOT for static images** — use Art skill for illustrations, diagrams, thumbnails.

## Examples

**Example 1: Create animated explainer**
```
User: "create a video showing how the Algorithm works"
→ Builds React composition with Remotion
→ Defines sequences, animations, timing
→ Renders to MP4 in background
→ Output to ~/Downloads/ for preview
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Remotion","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
