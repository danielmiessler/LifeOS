---
provenance: template
---

# Config — Credentials and LifeOS Configuration

This directory holds the structured config that LifeOS tools read at runtime:
credential pointers, project paths, integration settings. Treat it as the
single source of truth for "where does my stuff live and how do I authenticate."

## Files

| File | What it holds |
|------|----------------|
| `LIFEOS_CONFIG.yaml` | The main config — projects directory, default temperature unit, integration toggles. |

## Where credentials actually live

`LIFEOS_CONFIG.yaml` itself does **not** store credentials. Secrets live in
two places:

- **`{{LIFEOS_ROOT}}/.env`** — environment variables (`ELEVENLABS_API_KEY`,
  `TELEGRAM_BOT_TOKEN`, etc.). Pulse loads this on boot. The installer
  writes here when you complete the voice / Telegram steps.
- **`{{LIFEOS_DIR}}/USER/CREDENTIALS/`** — credential JSON files (Google
  OAuth, AWS profiles, etc.). The directory does not exist by default;
  create it on demand and `chmod 700` it.

`LIFEOS_CONFIG.yaml` references these by path, never by value. That keeps
secrets out of any file that gets accidentally committed or shared.

## Customization

Open `LIFEOS_CONFIG.yaml` and update:

- `projectsDir` — where your code projects live (default `~/Projects`).
- `temperatureUnit` — `celsius` or `fahrenheit`.
- Any integration-specific blocks added by skills you install.

The installer writes sensible defaults during the configuration step.
You only need to edit this file when you want to change a default or
add a new integration's settings.

## Privacy

Nothing in this directory ships in a public LifeOS release. The release
builder overlays a generic public-default scaffold; your customized
config stays on your machine.
