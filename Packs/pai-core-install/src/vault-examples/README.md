# VAULT.md Examples

These are example `VAULT.md` files showing what's possible. Your vaults can look like these, completely different, or anything in between.

## What is VAULT.md?

When you launch `claude` in a directory, if there's a `VAULT.md` file present, it's automatically loaded into my context. This gives me project-specific knowledge without you having to explain everything each time.

## How to use

1. Navigate to your project/client directory
2. Create a `VAULT.md` file with whatever context helps
3. Launch `claude`
4. I'll have that context automatically

## What to include

**Basics:**
- Client/project name
- What type of work (pentest, development, assessment, etc.)
- Current status or phase

**Helpful context:**
- Key findings or progress
- References to other files
- Relevant skills or tools
- Notes or reminders

**Keep it flexible:**
- No required structure
- No templates to fill out
- Just markdown
- Update as you work

## Examples

- **AZURE_PENTEST_EXAMPLE.md** - Azure cloud penetration test
- **GENERAL_CLIENT_EXAMPLE.md** - Web application assessment

These show possible patterns, not requirements. Your VAULT.md can be as simple as:

```markdown
# ClientName - Azure Pentest

Enumerating Azure AD for ClientName
Tenant: client.onmicrosoft.com
See Azure Creds.md for credentials
```

Or as detailed as you find useful. It's entirely up to you.
