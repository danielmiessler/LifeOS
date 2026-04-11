# Piper Local TTS Setup

PAI v4.0.3+ supports local text-to-speech using [Piper](https://github.com/rhasspy/piper). This provides a fast, private, and zero-cost alternative to cloud TTS services like ElevenLabs.

## Installation

### 1. Install Piper Binary

Download the static binary for your architecture from the [Piper Releases](https://github.com/rhasspy/piper/releases).

```bash
mkdir -p ~/.local/opt/piper
cd ~/.local/opt/piper
# Example for Linux x86_64
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_x86_64.tar.gz
tar -xf piper_linux_x86_64.tar.gz
# Ensure the binary is at ~/.local/opt/piper/piper
```

### 2. Download Voice Models

Piper uses ONNX models. Download a voice (e.g., `en_US-amy-medium`) from the [Piper Voice Hub](https://github.com/rhasspy/piper/blob/master/VOICES.md).

```bash
mkdir -p ~/.local/opt/piper/models
cd ~/.local/opt/piper/models
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json
```

### 3. Configure Environment

Add the following to your `~/.env` file:

```bash
PIPER_PATH=~/.local/opt/piper/piper
PIPER_MODELS_DIR=~/.local/opt/piper/models
```

### 4. Update settings.json

In your `~/.claude/settings.json`, update your voice entries to use the `piper` provider:

```json
"daidentity": {
  "voices": {
    "main": {
      "voiceId": "en_US-amy-medium",
      "voiceName": "Amy",
      "provider": "piper",
      "speed": 1.0,
      "volume": 1.0
    }
  }
}
```

The `voiceId` must match the filename of your `.onnx` model (without the extension).

## Dependencies

- **Linux:** `mpv` (recommended) or `aplay`.
- **macOS:** `afplay` (built-in).

The VoiceServer will automatically detect and use the available player.
