# PAI Security System

A foundational security framework for Personal AI Infrastructure.

---

## Two-Layer Design

This directory (`skills/PAI/PAISECURITYSYSTEM/`) contains the **base system**—default patterns, documentation, and the security hook. It provides sensible defaults that work out of the box.

Your personal security policies live in `skills/PAI/USER/PAISECURITYSYSTEM/`. This is where you:
- Define your own blocked/confirm/alert patterns
- Add project-specific rules
- Customize path protections
- Keep policies that should never be shared publicly

**The hook checks USER first, then falls back to this base system.** This means:
- New PAI users get working security immediately
- You can override any default with your own rules
- Your personal policies stay private (USER/ is never synced to public PAI)

---

## Status: Foundation Release

This security system provides essential protection against catastrophic operations while maintaining development velocity. It represents a **starting point**, not a final destination.

**What it does today:**
- Blocks irreversible filesystem and repository operations
- Prompts for confirmation on dangerous but legitimate commands
- Logs all security events for audit trails
- Protects sensitive paths (credentials, keys, configs)

**What it doesn't do (yet):**
- Behavioral anomaly detection
- Session-based threat modeling
- Adaptive pattern learning
- Cross-session attack correlation
- Network egress monitoring

---

## Architecture

```
skills/PAI/PAISECURITYSYSTEM/   # System defaults (this directory)
├── README.md                            # This file
├── ARCHITECTURE.md                      # Security layer design
├── HOOKS.md                             # Hook implementation docs
├── PROMPTINJECTION.md                   # Prompt injection defense
├── COMMANDINJECTION.md                  # Command injection defense
└── patterns.example.yaml                # Default security patterns

skills/PAI/USER/PAISECURITYSYSTEM/                  # Your customizations
├── patterns.yaml                        # Your security rules
├── QUICKREF.md                          # Quick lookup
└── ...                                  # Your additions
```

The hook loads `skills/PAI/USER/PAISECURITYSYSTEM/patterns.yaml` first, falling back to `patterns.example.yaml` if not found.

---

## Quick Start

1. Security works out of the box with `patterns.example.yaml`
2. To customize, copy to `skills/PAI/USER/PAISECURITYSYSTEM/patterns.yaml`
3. Add your own blocked/confirm/alert patterns
4. Events log to `MEMORY/SECURITY/YYYY/MM/`

---

## Future Development

This system will evolve. Expect updates in:
- Pattern coverage (more dangerous command detection)
- Path protection (smarter glob matching)
- Logging (richer event context)
- Integration (MCP server validation, API call monitoring)

Contributions and feedback welcome.

---

## Documentation

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE.md` | Security layers, trust hierarchy, philosophy |
| `HOOKS.md` | SecurityValidator implementation details |
| `PROMPTINJECTION.md` | Defense against prompt injection attacks |
| `COMMANDINJECTION.md` | Defense against command injection |
| `patterns.example.yaml` | Default pattern template |
