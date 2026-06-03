#!/usr/bin/env python3
"""
Hermes Pulse — Minimal MCP server for desktop notifications and health checks.

Provides:
  - POST /notify  : receive {message, emotion?} JSON, play desktop notification,
                    log to pai/MEMORY/OBSERVABILITY/notifications.jsonl
  - GET  /healthz : return {status: ok}
  - Standard MCP protocol endpoints for Hermes native integration

Usage:
  python pulse_mcp.py                          # default port 31337
  python pulse_mcp.py --port 31338             # custom port
  python pulse_mcp.py --host 0.0.0.0 --port 31337
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import platform
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_PORT = 31337
DEFAULT_HOST = "127.0.0.1"
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent  # ~/projects/pai-v5
NOTIFICATION_LOG = PROJECT_ROOT / "pai" / "MEMORY" / "OBSERVABILITY" / "notifications.jsonl"
EMOTION_ICONS = {
    "happy": "😊",
    "sad": "😢",
    "angry": "😠",
    "excited": "🎉",
    "neutral": "📢",
    "warning": "⚠️",
    "error": "❌",
    "info": "ℹ️",
    "success": "✅",
    "question": "❓",
    "love": "❤️",
    "thinking": "🤔",
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
logger = logging.getLogger("pulse")


# ---------------------------------------------------------------------------
# Desktop notification helper
# ---------------------------------------------------------------------------

def play_desktop_notification(message: str, emotion: str | None = None) -> bool:
    """Send a desktop notification via notify-send (Linux) or osascript (macOS)."""
    system = platform.system()
    icon = EMOTION_ICONS.get(emotion, "📢") if emotion else "📢"
    title = f"Hermes Pulse {icon}"

    try:
        if system == "Linux":
            urgency = "NORMAL"
            if emotion in ("error", "warning"):
                urgency = "CRITICAL"
            elif emotion == "info":
                urgency = "LOW"
            subprocess.run(
                ["notify-send", "-u", urgency, title, message],
                timeout=5,
                capture_output=True,
            )
            return True
        elif system == "Darwin":
            script = f'display notification "{message}" with title "{title}"'
            subprocess.run(["osascript", "-e", script], timeout=5, capture_output=True)
            return True
        else:
            logger.warning("Desktop notifications not supported on %s", system)
            return False
    except FileNotFoundError:
        logger.warning("notify-send not found — desktop notifications unavailable")
        return False
    except subprocess.TimeoutExpired:
        logger.warning("Desktop notification timed out")
        return False
    except Exception as exc:
        logger.error("Desktop notification failed: %s", exc)
        return False


def append_notification_log(entry: dict) -> None:
    """Append a JSON line to the notification history file.

    Creates the directory and file if they don't exist.
    """
    try:
        NOTIFICATION_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(NOTIFICATION_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError as exc:
        logger.error("Failed to write notification log: %s", exc)


# ---------------------------------------------------------------------------
# Server creation
# ---------------------------------------------------------------------------

def create_server(*, port: int, host: str) -> FastMCP:
    """Build and return the configured FastMCP server instance."""
    server = FastMCP(
        "Hermes Pulse",
    )

    # ---- GET /healthz -----------------------------------------------------

    @server.custom_route("/healthz", methods=["GET"])
    async def healthz(request: Request) -> JSONResponse:
        return JSONResponse(
            {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
        )

    # ---- POST /notify -----------------------------------------------------

    @server.custom_route("/notify", methods=["POST"])
    async def notify_endpoint(request: Request) -> JSONResponse:
        try:
            body = await request.json()
        except json.JSONDecodeError:
            return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

        message = body.get("message")
        if not message or not isinstance(message, str) or not message.strip():
            return JSONResponse(
                {"error": "Missing or invalid 'message' (must be non-empty string)"},
                status_code=400,
            )

        message = message.strip()
        emotion = body.get("emotion")
        if emotion is not None and emotion not in EMOTION_ICONS:
            return JSONResponse(
                {
                    "error": f"Unknown emotion '{emotion}'. Valid: {', '.join(sorted(EMOTION_ICONS))}"
                },
                status_code=400,
            )

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": message,
            "emotion": emotion,
        }

        # Desktop notification (non-blocking best-effort)
        notify_ok = play_desktop_notification(message, emotion)
        entry["desktop_notified"] = notify_ok

        # Persist to JSONL
        append_notification_log(entry)

        logger.info(
            "Notification%s: %s (emotion=%s)",
            " [ok]" if notify_ok else " [no-desktop]",
            message,
            emotion or "none",
        )

        return JSONResponse(
            {"status": "delivered", "desktop_notified": notify_ok}, status_code=200
        )

    # ---- MCP tools (for Hermes native integration) ------------------------

    @server.tool()
    async def notify(message: str, emotion: str | None = None) -> str:
        """Send a pulse notification (accessible via MCP protocol).

        Args:
            message: The notification message text.
            emotion: Optional emotion hint (happy, sad, angry, excited, info,
                     warning, error, success, etc.).
        """
        trimmed = message.strip()
        if not trimmed:
            return "Error: message cannot be empty"

        if emotion and emotion not in EMOTION_ICONS:
            return f"Error: unknown emotion '{emotion}'"

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": trimmed,
            "emotion": emotion,
            "source": "mcp_tool",
        }

        notify_ok = play_desktop_notification(trimmed, emotion)
        entry["desktop_notified"] = notify_ok
        append_notification_log(entry)

        logger.info("MCP notification: %s (emotion=%s)", trimmed, emotion or "none")
        return f"Delivered (desktop_notified={notify_ok})"

    @server.tool()
    async def get_recent_notifications(count: int = 10) -> str:
        """Return the most recent notifications from the log.

        Args:
            count: Number of recent entries to return (default 10, max 50).
        """
        count = max(1, min(count, 50))
        if not NOTIFICATION_LOG.exists():
            return "[]"

        try:
            with open(NOTIFICATION_LOG, "r", encoding="utf-8") as f:
                lines = f.readlines()
            recent = [json.loads(l) for l in lines[-count:] if l.strip()]
            return json.dumps(recent, indent=2, ensure_ascii=False)
        except Exception as exc:
            logger.error("Failed to read notification log: %s", exc)
            return f"Error: {exc}"

    return server


# ---------------------------------------------------------------------------
# Signal handling for graceful shutdown
# ---------------------------------------------------------------------------

_shutting_down = False


def _signal_handler(signum: int, frame) -> None:
    global _shutting_down
    if _shutting_down:
        logger.warning("Forced exit")
        sys.exit(1)
    _shutting_down = True
    sig_name = signal.Signals(signum).name
    logger.info("Received %s — shutting down gracefully...", sig_name)
    # uvicorn / anyio will handle the actual shutdown; give it a moment
    time.sleep(0.5)
    sys.exit(0)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Hermes Pulse — notification and health MCP server",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PULSE_PORT", DEFAULT_PORT)),
        help=f"Port to listen on (default: {DEFAULT_PORT}, env: PULSE_PORT)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default=os.environ.get("PULSE_HOST", DEFAULT_HOST),
        help=f"Host to bind to (default: {DEFAULT_HOST}, env: PULSE_HOST)",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()

    # Register signal handlers
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    port = args.port
    host = args.host

    logger.info("Hermes Pulse starting on %s:%s", host, port)
    logger.info("Notification log: %s", NOTIFICATION_LOG)

    server = create_server(port=port, host=host)

    try:
        server.run(
            transport="http",
            host=host,
            port=port,
            log_level="INFO",
        )
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    except Exception as exc:
        logger.error("Fatal error: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
