# Skill Customizations

Override any skill's default behavior by creating a matching directory with a `PREFERENCES.md` file.

## How It Works

Every PAI skill checks this directory before executing:
```
SKILLCUSTOMIZATIONS/{SkillName}/PREFERENCES.md
```

If found, the preferences are loaded and applied on top of skill defaults.

## Example

```
SKILLCUSTOMIZATIONS/
├── Art/
│   └── PREFERENCES.md    # "Always use illustration style, never photorealistic"
├── Research/
│   └── PREFERENCES.md    # "Prefer academic sources, cite in APA format"
├── Agents/
│   └── PREFERENCES.md    # "Default to collaborative tone"
└── Remotion/
    └── PREFERENCES.md    # "Use 1080p, 30fps, brand colors #1E3A8A"
```

## PREFERENCES.md Format

Free-form markdown. Include any preferences, constraints, or overrides you want the skill to follow. The skill reads this file and adapts accordingly.
