# Installing PAI on Pi — Step by Step

> **Note:** This is v1.0.0 (alpha) — an early release. Expect rough edges as this evolves.

This guide takes you from zero to a working PAI system on Pi. Total time: ~15 minutes.

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org/) or via your package manager
- **A model provider** — at least one of:
  - [Ollama](https://ollama.ai/) for local models (free, private)
  - An API key for Anthropic, OpenAI, or OpenRouter

## Step 1: Install Pi

```bash
npm install -g @mariozechner/pi-coding-agent
```

Verify it's installed:

```bash
pi --version
```

## Step 2: Set Up a Model Provider

### Option A: Ollama (Local Models — Free)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model (pick one)
ollama pull llama3.1:8b      # Fast, good for simple tasks (~4.7GB)
ollama pull llama3.1:70b     # Powerful, needs 48GB+ RAM (~40GB)
ollama pull qwen2.5:32b      # Good balance of speed and quality (~19GB)
ollama pull deepseek-r1:32b   # Strong reasoning (~19GB)

# Ollama runs automatically at http://localhost:11434
```

### Option B: Cloud API (Anthropic, OpenAI, OpenRouter)

Get an API key from your provider and have it ready for Step 4.

## Step 3: Copy the PAI Scaffold

```bash
# Create the config directory
mkdir -p ~/.config/PAI-pi

# From this directory (Releases/Pi/), copy everything
cp -r config/* ~/.config/PAI-pi/
mkdir -p ~/.config/PAI-pi/extensions
cp -r extensions/* ~/.config/PAI-pi/extensions/
mkdir -p ~/.config/PAI-pi/skills
cp -r skills/* ~/.config/PAI-pi/skills/
mkdir -p ~/.config/PAI-pi/memory
cp -r memory/* ~/.config/PAI-pi/memory/
```

## Step 4: Configure Your Model Provider

Edit `~/.config/PAI-pi/models.json`. Here are working examples:

### Ollama (Local)

```json
{
  "providers": {
    "ollama": {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "models": {
        "default": "llama3.1:8b"
      }
    }
  }
}
```

### Anthropic

```json
{
  "providers": {
    "anthropic": {
      "type": "anthropic",
      "apiKey": "sk-ant-...",
      "models": {
        "default": "claude-sonnet-4-6"
      }
    }
  }
}
```

### OpenRouter (Access Many Models)

```json
{
  "providers": {
    "openrouter": {
      "type": "openai",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "sk-or-...",
      "models": {
        "default": "anthropic/claude-sonnet-4-6"
      }
    }
  }
}
```

### Multiple Providers

```json
{
  "providers": {
    "local": {
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "models": {
        "default": "llama3.1:8b",
        "thinking": "qwen2.5:32b"
      }
    },
    "cloud": {
      "type": "anthropic",
      "apiKey": "sk-ant-...",
      "models": {
        "default": "claude-sonnet-4-6"
      }
    }
  }
}
```

## Step 5: Customize Your Identity

Edit `~/.config/PAI-pi/SYSTEM.md` and replace the placeholders:

- `{{YOUR_NAME}}` → Your name (e.g., "Alex")
- `{{YOUR_AI_NAME}}` → Your AI's name (e.g., "Nova", "Atlas", "Friday")

Also update:
- The **Projects** table with your actual projects
- The **Environment** section with your setup
- Any **Behavioral Rules** you want to add or modify

Edit `~/.config/PAI-pi/AGENTS.md` with your context and preferences.

## Step 6: Launch

```bash
pi
```

You should see the PAI status line and your AI is ready.

### Test the Algorithm

Try a complex request to see the 7-phase Algorithm in action:

```
Create a TypeScript function that parses CSV files with proper error handling
```

Your AI should enter Algorithm mode, generate ISC criteria, and work through all 7 phases.

### Test Skills

```
/status          # Check PAI system status
/algorithm       # Force Algorithm mode for next task
research quick: what is Pi coding agent
```

## Step 7: Optional — Voice Notifications

If you want your AI to speak:

1. Set up a TTS server (ElevenLabs, Coqui, or any HTTP-based TTS)
2. Set environment variables:

```bash
export PAI_VOICE_ENABLED=true
export PAI_VOICE_ENDPOINT=http://localhost:8888/notify
export PAI_VOICE_ID=your-voice-id
```

3. Restart Pi. Voice will announce Algorithm phase transitions.

## Troubleshooting

### Pi can't find the extension

Make sure the extension is at `~/.config/PAI-pi/extensions/pai-core/index.ts`. Pi looks for extensions in the `extensions/` subdirectory of its config path.

### Ollama connection refused

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start it if not
ollama serve
```

### Model too slow

Use a smaller model for everyday tasks and a larger one for complex work. Configure multiple models in `models.json` and switch between them.

### Skills not loading

Skills are loaded from `~/.config/PAI-pi/skills/`. Each skill needs a `SKILL.md` file with proper frontmatter (the `---` delimited header).

## Next Steps

1. **Add your own skills** — Create new directories in `skills/` for your domains
2. **Build your memory** — The `memory/` directory grows with usage
3. **Customize the Algorithm** — Adjust effort levels and ISC rules in SYSTEM.md
4. **Explore full PAI** — For the complete experience with 63+ skills, try [PAI v4.0.3 on Claude Code](../v4.0.3/)
