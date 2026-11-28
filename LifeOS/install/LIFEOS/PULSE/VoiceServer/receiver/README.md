# Remote voice: hear the DA on the machine you are sitting at

LifeOS can run on a headless box (a home server or an inference host) while you work from another machine over SSH.
`VoiceReceiver.ts` lets that box speak through the speakers of the machine you SSH in from.

```
 your workstation (receiver)                  LifeOS host (Pulse voice server)
 ┌──────────────────────────┐   ssh :22      ┌──────────────────────────────┐
 │ terminal ────────────────┼───────────────▶│ sshd                         │
 │ VoiceReceiver :7790 ◀────┼── POST /play ──│ voice.ts findSink():         │
 │   mpv / ffplay / afplay  │   (MP3 clip)   │  SSH peers ∩ trusted ranges  │
 └──────────────────────────┘                │  → GET /health → play there  │
                                             └──────────────────────────────┘
```

How the host picks a receiver: every 10 s it lists the established SSH connections into port 22
(`lsof` on macOS, `ss` on Linux). It keeps the peers inside a trusted range and sends each clip to the first one whose
`:7790/health` answers. If no receiver answers, the clip plays on the host itself.

## Trusted ranges

| Network between the two machines | What to set on the LifeOS host |
|---|---|
| Tailscale (100.64.0.0/10) | nothing, trusted by default |
| NetBird (default 100.64.0.0/10 range) | nothing, trusted by default |
| Plain LAN, no tunnel | `VOICE_RECEIVER_PEERS=<workstation IP>` |
| WireGuard or another overlay on its own range | `VOICE_RECEIVER_PEERS=<workstation tunnel IP>` |

`VOICE_RECEIVER_PEERS` is a comma-separated list of IPv4 addresses or CIDRs. Pulse reads it from `~/.claude/.env`.
Restart Pulse after you change it. List single hosts, not a whole shared subnet. An established TCP connection on
:22 does not prove that someone logged in. On a wide range, any device that opens a socket to sshd and answers on
:7790 would receive the DA's speech.

## Setup

**1. On the LifeOS host,** for a LAN or a non-100.64 overlay only:

```sh
echo 'VOICE_RECEIVER_PEERS=192.168.1.20' >> ~/.claude/.env
systemctl --user restart com.lifeos.pulse.service      # macOS: restart Pulse the usual way
```

**2. On the workstation,** copy the receiver over and install it as a login service. It needs `bun` and a player:
`afplay` on macOS, otherwise `mpv`, `ffplay` or `paplay`.

```sh
scp host:~/.claude/LIFEOS/PULSE/VoiceServer/receiver/VoiceReceiver.ts /tmp/
bun /tmp/VoiceReceiver.ts --install --allow <LifeOS host IP as the workstation sees it>
```

On macOS this writes a launchd agent. On Linux it writes and starts the systemd user unit
`lifeos-voice-receiver.service`. The receiver returns 403 to every address except `--allow`. It holds no keys.
Remove it with `bun ~/.voice-receiver/VoiceReceiver.ts --uninstall`.

**3. Open the port** if the workstation runs a firewall. With ufw on Linux:

```sh
sudo ufw allow from <LifeOS host IP> to any port 7790 proto tcp
```

**4. Check it.** SSH from the workstation into the host, then on the host:

```sh
curl -s http://<workstation IP>:7790/health        # {"ok":true,"version":"1.1.0"}
curl -s -X POST localhost:31337/notify -H 'Content-Type: application/json' -d '{"message":"Voice test"}'
grep 'remote receiver' ~/.claude/LIFEOS/PULSE/logs/pulse-stdout.log
```

Something has to make the speech first: either Fish or a local TTS server (next section). With neither configured,
voice is off and nothing is sent to the receiver.

## Speech engine: Fish or a local model

| Engine | Set on the LifeOS host | Notes |
|---|---|---|
| Fish Audio (cloud) | `FISH_API_KEY` in `.env`, `fish_reference_id` under `[da.voices.main]` in `LIFEOS_CONFIG.toml` | Voice clones and emotion tags. Wins whenever a Fish key is set. |
| Local TTS | `LOCAL_TTS_URL`, used only when no `FISH_API_KEY` is set | No account. The text stays on your network. Tags are stripped before synthesis. |

`LOCAL_TTS_URL` must answer with WAV. Two request shapes are supported:

- **OpenAI-compatible** (`…/v1/audio/speech`, for example Kokoro-FastAPI, Speaches or LocalAI). The request is
  `{model, input, voice, response_format: "wav"}`. `LOCAL_TTS_MODEL` defaults to `tts-1` and `LOCAL_TTS_VOICE` to `alloy`.
- **Piper-style** (any other path). The request is `{text, voice?, speed?}`, for example a small Piper HTTP wrapper
  on `/say`.

Optional: `LOCAL_TTS_VOICE` and `LOCAL_TTS_SPEED`. Set these in `~/.claude/.env` or in a systemd drop-in for the Pulse
unit, then restart Pulse. `curl localhost:31337/voice/health` then reports `"voice_system":"local"`. The message text
goes to whatever URL you set, so point it at hardware you control. Piper on CPU makes a sentence in well under a second.

## Which address to use

- `--allow` is the address the host's packets arrive from **as the workstation sees it**: its LAN IP, or its tunnel IP
  when the SSH session runs over the tunnel.
- `VOICE_RECEIVER_PEERS` is the address the workstation's SSH session arrives from **as the host sees it**. To check,
  run `ss -tnH state established '( sport = :22 )'` on the host and read the last column.
