# Hermes Pulse — Minimal MCP Notification Server

A lightweight MCP server for desktop notifications, health checks, and
notification history. Designed to be the Pulse daemon for Hermes Agent users
who want voice/desktop notifications without the full PAI v5 Pulse stack.

## Features

- **POST /notify** — Accepts `{"message": "...", "emotion": "..."}` JSON and
  plays a desktop notification (via `notify-send` on Linux, `osascript` on macOS).
- **GET /healthz** — Returns `{"status": "ok"}` (used by all 38 Hermes skills'
  `curl` health checks).
- **MCP tools** — Hermes can call `notify()` and `get_recent_notifications()` directly
  via the MCP protocol.
- **Persistent history** — All notifications are logged to
  `pai/MEMORY/OBSERVABILITY/notifications.jsonl`.
- **Configurable** — Port and host via CLI flags or `PULSE_PORT` / `PULSE_HOST` env vars.
- **Production quality** — Structured logging, error handling, graceful shutdown.

## Quick Start

### 1. Install

```bash
pip install -r requirements.txt
```

Or install fastmcp directly:

```bash
pip install fastmcp
```

### 2. Run

```bash
python pulse_mcp.py
```

The server starts on `127.0.0.1:31337` by default.

### 3. Test

```bash
# Health check
curl http://127.0.0.1:31337/healthz
# → {"status":"ok","timestamp":"..."}

# Send a notification
curl -X POST http://127.0.0.1:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Build complete!", "emotion": "success"}'
# → {"status":"delivered","desktop_notified":true}
```

## CLI Options

| Flag          | Default       | Env Variable   | Description          |
|---------------|---------------|----------------|----------------------|
| `--port`      | `31337`       | `PULSE_PORT`   | TCP port to bind to  |
| `--host`      | `127.0.0.1`   | `PULSE_HOST`   | Host address to bind |

```bash
python pulse_mcp.py --port 31338 --host 0.0.0.0
```

## Auto-Start with Hermes

### Option A: Systemd User Service (recommended)

```bash
./install.sh
```

This copies the server to `~/.hermes/pulse/` and installs a systemd user service
at `~/.config/systemd/user/hermes-pulse.service`.

Then:

```bash
systemctl --user daemon-reload
systemctl --user enable --now hermes-pulse
```

Check status:

```bash
systemctl --user status hermes-pulse
journalctl --user -u hermes-pulse -f
```

### Option B: Hermes Cron / Startup Hook

Add to your Hermes profile's `cron/` or startup scripts:

```bash
@reboot python ~/.hermes/pulse/pulse_mcp.py &
```

### Option C: Manual Background

```bash
nohup python ~/projects/pai-v5/targets/hermes/pulse/pulse_mcp.py \
  > ~/.hermes/pulse/pulse.log 2>&1 &
```

## Notification History

All notifications are written to:

```
pai/MEMORY/OBSERVABILITY/notifications.jsonl
```

Each line is a JSON object:

```json
{
  "timestamp": "2026-05-30T12:34:56+00:00",
  "message": "Build complete!",
  "emotion": "success",
  "desktop_notified": true,
  "source": "http"
}
```

## Supported Emotions

happy, sad, angry, excited, neutral, warning, error, info, success, question,
love, thinking.

## MCP Integration

When running with `transport="http"` (default), Hermes can connect to Pulse
via MCP's standard SSE or Streamable HTTP transport at:

```
http://127.0.0.1:31337/mcp/sse
http://127.0.0.1:31337/mcp/messages
```

The following MCP tools are registered:

- `notify(message, emotion?)` — Send a notification through Pulse.
- `get_recent_notifications(count=10)` — Retrieve recent notification history.

## Files

```
~/projects/pai-v5/targets/hermes/pulse/
├── pulse_mcp.py       # MCP server implementation
├── requirements.txt   # Python dependencies
├── README.md          # This file
└── install.sh         # Systemd service installer
```
