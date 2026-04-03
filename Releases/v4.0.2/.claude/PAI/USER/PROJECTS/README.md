# Projects Registry

Your project definitions and metadata. PAI uses this to route requests to the correct project context.

## Suggested Format

Create a `PROJECTS.md` with your project registry:

```markdown
| Project | Path | URL | Stack |
|---------|------|-----|-------|
| Website | ~/Projects/MySite | mysite.com | Astro, React, TS |
| API | ~/Projects/MyAPI | api.mysite.com | Hono, CF Workers |
```

Or create individual project files:
```
PROJECTS/
├── PROJECTS.md       # Master registry
├── website.md        # Detailed project context
└── api.md            # Detailed project context
```
