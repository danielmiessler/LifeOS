#!/usr/bin/env python3
"""Warm Kokoro TTS daemon - a fully-local, private voice backend for LifeOS.

Loads the Kokoro ONNX model ONCE at startup and keeps it resident, then serves
synthesis over localhost so each utterance skips model cold-start. This is the
private alternative to the cloud ElevenLabs path: no API key, and no audio or
text ever leaves the machine.

  GET  /health           -> "ok"
  POST /speak {text, voice?, speed?} -> synthesize + play (afplay); 200 on completion

Single model, serialized playback (one utterance at a time) via a lock.
PULSE/VoiceServer/voice.ts POSTs here when LIFEOS_VOICE_BACKEND=kokoro.

Setup: DOCUMENTATION/Notifications/KokoroVoiceBackend.md.
Requires: pip install kokoro-onnx soundfile; the model files
(kokoro-v0_19.onnx, voices.bin) in $KOKORO_CACHE. Plays via `afplay` (macOS) by
default; set LIFEOS_KOKORO_PLAYER (e.g. "aplay" / "paplay") on Linux.
"""
import os
import json
import tempfile
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from kokoro_onnx import Kokoro
import soundfile as sf

CACHE = os.environ.get("KOKORO_CACHE", os.path.expanduser("~/.cache/lifeos-voice"))
PORT = int(os.environ.get("LIFEOS_KOKORO_PORT", "7791"))
DEFAULT_VOICE = os.environ.get("LIFEOS_KOKORO_VOICE", "af_bella")
# Audio player, env-overridable for non-macOS (e.g. "aplay" / "paplay" on Linux).
PLAYER = os.environ.get("LIFEOS_KOKORO_PLAYER", "afplay").split()

print("[kokoro-server] loading model (one time)...", flush=True)
KOKORO = Kokoro(f"{CACHE}/kokoro-v0_19.onnx", f"{CACHE}/voices.bin")
print(f"[kokoro-server] model warm; listening on 127.0.0.1:{PORT}", flush=True)

_speak_lock = threading.Lock()


def speak(text: str, voice: str, speed: float) -> None:
    with _speak_lock:  # model isn't thread-safe; one synth+play at a time
        samples, sr = KOKORO.create(text, voice=voice, speed=speed, lang="en-us")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            out = f.name
        try:
            sf.write(out, samples, sr)
            subprocess.run([*PLAYER, out], check=True)
        finally:
            try:
                os.unlink(out)
            except OSError:
                pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # silence default request logging
        pass

    def _reply(self, code: int, body: bytes = b""):
        self.send_response(code)
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        self._reply(200, b"ok") if self.path == "/health" else self._reply(404)

    def do_POST(self):
        if self.path != "/speak":
            self._reply(404)
            return
        try:
            n = int(self.headers.get("content-length", 0) or 0)
            payload = json.loads(self.rfile.read(n) or b"{}")
            text = (payload.get("text") or "").strip()
            if not text:
                self._reply(400, b"no text")
                return
            voice = payload.get("voice") or DEFAULT_VOICE
            speed = float(payload.get("speed") or 1.0)
            speak(text, voice, speed)
            self._reply(200, b"ok")
        except Exception as e:  # noqa: BLE001 - report so voice.ts can handle it
            self._reply(500, str(e).encode())


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
