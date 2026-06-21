# Config — Credentials and PAI Configuration

This directory holds the structured config that PAI tools read at runtime:
credential pointers, project paths, integration settings. Treat it as the
single source of truth for "where does my stuff live and how do I authenticate."

## Files

| File | What it holds |
|------|----------------|
| `PAI_CONFIG.yaml` | The main config — projects directory, default temperature unit, integration toggles. |

## Where credentials actually live

`PAI_CONFIG.yaml` itself does **not** store credentials. Secrets live in
two places:

- **`~/.claude/.env`** — environment variables (`TELEGRAM_BOT_TOKEN`,
  etc.). Pulse loads this on boot. The installer writes here when you
  complete the Telegram step.
- **`~/.claude/PAI/USER/CREDENTIALS/`** — credential JSON files (Google
  OAuth, AWS profiles, etc.). The directory does not exist by default;
  create it on demand and `chmod 700` it.

`PAI_CONFIG.yaml` references these by path, never by value. That keeps
secrets out of any file that gets accidentally committed or shared.

## Customization

Open `PAI_CONFIG.yaml` and update:

- `projectsDir` — where your code projects live (default `~/Projects`).
- `temperatureUnit` — `celsius` or `fahrenheit`.
- Any integration-specific blocks added by skills you install.

The installer writes sensible defaults during the configuration step.
You only need to edit this file when you want to change a default or
add a new integration's settings.

## Privacy

Nothing in this directory ships in a public PAI release. The release
builder overlays a generic public-default scaffold; your customized
config stays on your machine.
