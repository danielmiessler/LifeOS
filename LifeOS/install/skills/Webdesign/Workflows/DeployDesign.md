# DeployDesign

Built design → production host.

## Trigger Phrases

"deploy the design", "ship to production", "publish this prototype", "put this online"

## Inputs

Required:
- **Source** — path to the generated code (from `ExportToCode`) or integrated branch (from `IntegrateIntoApp`)
- **Target host** — one of: cloudflare-pages, vercel, netlify, github-pages, static-s3, custom

Optional:
- **Domain** — custom domain if configured
- **Preview flag** — deploy to a preview URL instead of production

## Workflow

### 1. Preflight

Confirm:
- Source directory builds clean (`bun install && bun run build`)
- No secrets in the build output (`rg -i "API_KEY|SECRET|PRIVATE_KEY|sk_live|sk_test" "$OUT/dist"`)
- Target host CLI is installed (`wrangler`, `vercel`, `netlify`, `gh`)

### 2. Build

```bash
cd "$SOURCE"
bun install --frozen-lockfile
bun run build
```

Verify `dist/` (or `.vercel/output/`, `.netlify/`) is populated.

### 3. Deploy — host-specific

**Cloudflare Pages:**
```bash
bunx wrangler pages deploy dist --project-name "$PROJECT" ${PREVIEW:+--branch preview}
```

**Vercel:**
```bash
vercel deploy ${PREVIEW:+--prebuilt} ${PRODUCTION:+--prod}
```

**Netlify:**
```bash
netlify deploy --dir dist ${PRODUCTION:+--prod}
```

**GitHub Pages:**
```bash
gh workflow run pages.yml  # assumes a configured workflow
```

**Static S3 / custom:**
```bash
aws s3 sync dist "s3://$BUCKET" --delete
```

### 4. Verify Live

Post-deploy, hit the URL and screenshot:

```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/VerifyDesign.ts "https://$DEPLOYED_URL" "$OUT/live-verify"
```

Compare against `$OUT/preview.png` — the live site should match within visual tolerance.

### 5. Accessibility + Performance Probe

```bash
bun $LIFEOS_ROOT/skills/Webdesign/Tools/VerifyDesign.ts --a11y --lighthouse "https://$DEPLOYED_URL" "$OUT/live-quality"
```

Output includes:
- axe-core a11y scan results
- Lighthouse scores (performance, accessibility, best-practices, SEO)

### 6. Report

Return:
- Deployed URL
- Screenshot proof
- a11y + lighthouse summary (pass / fail / warn)
- Rollback command (host-specific)

## Preview vs Production

Always deploy to preview first for non-trivial changes:

```bash
# Preview
Skill("Webdesign") → Workflows/DeployDesign.md --preview
# Review preview URL
# Only then deploy to production
Skill("Webdesign") → Workflows/DeployDesign.md --production
```

## Common Pitfalls

- **Deploying without building** — some frameworks need an explicit build step. `bun run build` is not optional.
- **Skipping the secret scan** — leaked API keys in a bundle are the most common preventable incident. The grep is 200ms of paranoia that prevents rotation hell.
- **Skipping live verify** — a successful deploy command means "files uploaded," not "site works." Always hit the URL post-deploy.
- **Deploying to production on first ship** — preview first. Every time.
- **Forgetting to configure the domain** — check DNS / custom-domain settings BEFORE deploying if a specific domain is expected.

## Rollback

Each host has a rollback mechanism:

- **Cloudflare Pages**: `wrangler pages deployment list` → pick previous → promote
- **Vercel**: `vercel ls` → `vercel promote <old-deployment>`
- **Netlify**: `netlify rollback`
- **GitHub Pages**: revert the commit and re-run the workflow
- **S3**: the host has a previous `dist/` snapshot; re-sync from that

## Time Estimate

2-5 minutes for a clean deploy + verify. Add 5-15 minutes per rollback or failed-verify iteration.
