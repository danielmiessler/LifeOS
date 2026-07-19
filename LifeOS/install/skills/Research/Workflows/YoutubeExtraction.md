# YouTube Extraction Workflow

Extract content from YouTube videos using Fabric CLI. Automatically downloads, transcribes, and processes video content with optional pattern application for analysis and summarization.

## When to Activate This Skill
- Extract content from YouTube video
- Get YouTube transcript
- Analyze YouTube video
- Summarize YouTube content
- Process YouTube video text

## The Command

Extract content from any YouTube video:

```bash
fabric -y "YOUTUBE_URL"
```

## With Pattern Processing

Process extracted content through Fabric pattern:

```bash
fabric -y "YOUTUBE_URL" -p extract_wisdom
```

## Critical Facts

- **NEVER** use yt-dlp or youtube-dl
- **NEVER** use web scraping for YouTube
- **NEVER** use transcription APIs directly
- **Fabric handles everything**: Download, transcription, extraction automatically
- **Output**: Clean text content from video

## Common Patterns

- `extract_wisdom` - Extract key insights
- `summarize` - Create concise summary
- `extract_main_idea` - Get core message
- `create_summary` - Detailed summary

## Example Usage

```bash
# Extract raw content
fabric -y "https://www.youtube.com/watch?v=VIDEO_ID"

# Extract wisdom
fabric -y "https://www.youtube.com/watch?v=VIDEO_ID" -p extract_wisdom

# Summarize video
fabric -y "https://www.youtube.com/watch?v=VIDEO_ID" -p summarize
```

## How It Works
1. Fabric downloads video
2. Fabric extracts audio
3. Fabric transcribes audio
4. Fabric returns clean text
5. If pattern specified, processes through pattern

## Supplementary Resources
For Fabric patterns: `read {{LIFEOS_ROOT}}/docs/fabric-patterns.md`
