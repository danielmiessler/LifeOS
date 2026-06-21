# Your USER Directory

**Welcome to your Life OS.**

This is where your DA learns who you are, what you're working toward, and what matters to you. When you first install PAI, this directory is scaffolded from `PAI/TEMPLATES/User/`. Every file here is yours to fill in — your DA will help via the `Interview` skill.

## The One Rule

> **Single concept → single file at root. Multi-file concept → Capitalized directory at root, with `README.md` as the narrative entry.**

Walking into this directory should read like a biography. `Books.md` is you. `Beliefs.md` is you. `Rhythms.md` is you. Don't bury these in subdirectories — they are the person.

## How to Get Started

1. **Run the Interview** — `/interview` walks you through every file, phase by phase, filling them in conversationally.
2. **Start small** — `PrincipalIdentity.md`, `Telos/Mission.md`, `Beliefs.md`. The rest accretes over time.
3. **Drop new files at root** — `Podcasts.md`, `Gratitude.md`, `Travel.md`, anything. They appear in Pulse automatically.

## The Frontmatter Contract

Every file has YAML frontmatter. This is what makes Pulse, Daemon, and Interview work:

```yaml
---
category: taste           # identity | mind | taste | shape | ops | domain
kind: collection          # collection | narrative | reference | index
publish: false            # false | daemon-summary | daemon | public
review_cadence: 180d
last_updated: 2026-04-16
---
```

Full spec: `PAI/DOCUMENTATION/LifeOs/LifeOsSchema.md`.

## Categories

- **identity** — who you are (`PrincipalIdentity.md`, `DaIdentity.md`, `Resume.md`, `Contacts.md`)
- **mind** — how you think (`Beliefs.md`, `Wisdom.md`, `Models.md`, `Definitions.md`)
- **taste** — what you love (`Books.md`, `Movies.md`, `Music.md`, `Restaurants.md`, `Food.md`)
- **shape** — how your life runs (`Rhythms.md`, `Sparks.md`, `Current.md`, `Ideal.md`)
- **ops** — infrastructure of self (`Productivity.md`, `AssetManagement.md`, `Feed.md`)
- **domain** — multi-file life domains as directories (`Telos/`, `Health/`, `Finances/`, `Business/`, `Work/`)

## Privacy

This entire directory is **private by default**. Nothing leaves your machine unless a file explicitly sets `publish:` to a non-false value. The `publish:` flag is the universal broadcast contract consumed by the Daemon skill for your public profile.

## See Also

- `PAI/DOCUMENTATION/LifeOs/LifeOsSchema.md` — the authoritative spec
- `PAI/DOCUMENTATION/LifeOs/LifeOsThesis.md` — why Life OS exists
- `PAI/DOCUMENTATION/Pulse/PulseSystem.md` — how the dashboard renders this directory
