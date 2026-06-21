# Personal Architecture — User

> Bootstrap default. Run `/interview` to map your actual setup.

Your personal-system architecture — what runs where, how the pieces talk
to each other, what depends on what. The DA reads this when making
infrastructure suggestions or debugging cross-system issues.

## Compute

- **Primary machine:** (interview — laptop/desktop/etc.)
- **Workers/agents:** (interview — Mac minis, cloud workers, anything
  running PAI on your behalf)

## Cloud

- **Hosting:** (interview — Cloudflare Pages, Vercel, etc.)
- **Storage:** (interview — R2, S3, Backblaze)
- **Databases:** (interview — D1, Supabase, Postgres)

## Communications

- (interview — how you reach the DA when not at the keyboard: iMessage,
  Telegram, etc.)

## Identity boundaries

- **Public properties:** (your blog, social, open-source repos)
- **Private properties:** (internal sites, work, tooling)

This map matters because the DA respects it: public-property work goes
through public-clean workflows; private stuff stays private.
