# IntegrateIntoApp

> **Prefer Path 2 first.** If `/design-sync` is available, use `Workflows/NativeDesignSync.md` to keep design and code in lockstep natively. This Interceptor-bundle integration flow (Path 3) is the fallback for working from the web canvas and is unproven (the `interceptor-test` profile isn't logged into claude.ai). See SKILL.md → Prerequisites. (If your prototype source is already a generated code directory, the audit/diff/verify steps below still apply regardless of how it was produced.)

Land a Claude Design prototype INTO an existing application as a framework-aware diff, not a greenfield scaffold.

## Why This Workflow Exists

Most design tools assume you're starting fresh. Real site work isn't like that. You already have an Astro app with a theme, a Next.js dashboard with a component library, a VitePress blog with a VP config. When a prototype lands, it must:

- Reuse the app's existing design tokens (no second color palette)
- Match the app's component patterns (don't introduce a new button style)
- Respect the app's router and layout conventions
- Merge, not replace, unless explicitly asked to replace

This workflow does that.

## Trigger Phrases

"integrate this into", "patch into the app", "land this in the codebase", "merge this prototype", "add this page to the site"

## Inputs

Required:
- **Prototype source** — either an active Claude Design session, a handoff bundle path, or a generated code directory (from `ExportToCode`)
- **Target project path** — local path to the existing app
- **Integration target** — a route/page/component identifier inside the app ("the pricing page", "the sidebar nav", "a new blog layout")

Optional:
- **Preserve list** — existing code/tokens/components that must NOT be overwritten
- **Replace flag** — explicit permission to replace existing components in scope

## Workflow

### 1. Audit the Target Project

Before any code lands, understand what's already there.

```bash
TARGET="$PROJECT_PATH"
OUT=~/Downloads/webdesign/integrate/$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"

# Detect framework
cat "$TARGET/package.json" | jq -r '.dependencies, .devDependencies | keys[]' | grep -iE "^(next|astro|vitepress|vite|vue|remix|nuxt|sveltekit)$" | head -1 > "$OUT/framework.txt"

# Capture existing design tokens
find "$TARGET" -maxdepth 4 \( -name "tailwind.config.*" -o -name "tokens.*" -o -name "theme.*" -o -name "variables.css" \) | head -20 > "$OUT/token-files.txt"

# Capture existing component patterns
find "$TARGET/src" -type d -name "components" -o -name "ui" 2>/dev/null > "$OUT/component-dirs.txt"
```

### 2. Extract the App's Design System

If `ExtractDesignSystem.md` has not already been run on this project, run it NOW. This primes Claude Design with the app's real tokens and stops it from inventing a competing palette.

```bash
Skill("Webdesign") → Workflows/ExtractDesignSystem.md --codebase "$TARGET"
```

### 3. Compose the Integration Brief

Build a brief that constrains Claude Design to the app's conventions:

```
TASK: Produce $PROTOTYPE to land at $INTEGRATION_TARGET inside $FRAMEWORK app.

CONSTRAINTS (HARD):
- Use existing tokens from $TARGET/src/styles (do NOT invent new colors)
- Match existing component patterns in $TARGET/src/components
- Follow the app's routing conventions ($FRAMEWORK-specific)
- Preserve these existing files verbatim: $PRESERVE_LIST

INTEGRATION MODE:
- merge (default) — adds new files, modifies minimal existing files
- replace (explicit flag) — allowed to overwrite existing route/component in scope

OUTPUT FORMAT:
- Unified diff (.patch) against the current working tree
- Or: full new files + explicit list of existing files to modify
```

### 4. Run the Prototype through Framework Translation

Claude Design produces generic output; we need framework-specific code. Use the `frontend-design` plugin with explicit framework context:

> "Translate this Claude Design prototype to $FRAMEWORK conventions used in $TARGET. Use the tokens from $TARGET/tailwind.config.ts. Reuse components from $TARGET/src/components/ui wherever possible."

Output lands in `$OUT/translated/`.

### 5. Generate the Diff

Compare translated output against target state:

```bash
# Copy target files that will be touched into a staging area
mkdir -p "$OUT/staging"
# ... (list files that would be modified based on the translation)

# Produce the patch
diff -urN "$OUT/staging-original/" "$OUT/staging-new/" > "$OUT/integration.patch"
```

### 6. Review the Diff

**This is the critical human gate.** Before applying, show the user:

- Files added: (list)
- Files modified: (list with lines changed)
- Files deleted: (should be empty in merge mode)
- Token conflicts flagged: (any place Claude Design's tokens diverged from app's)

### 7. Apply the Diff

Only after review approval:

```bash
cd "$TARGET"
git checkout -b webdesign-integration-$(date +%Y%m%d)
patch -p1 < "$OUT/integration.patch"
```

### 8. Verify in Context

Start the app's dev server and navigate to the integrated route:

```bash
cd "$TARGET"
bun dev &
DEV_PID=$!
sleep 5

bun "${LIFEOS_ROOT}/skills/Webdesign/Tools/VerifyDesign.ts" "http://localhost:$DEV_PORT$INTEGRATION_TARGET" "$OUT/in-context"

kill $DEV_PID
```

Screenshot should show the new design rendering correctly inside the app's shell (nav, footer, theme).

### 9. Run Existing Test Suite

```bash
cd "$TARGET"
bun test && bun run typecheck && bun run lint
```

Zero regressions. If any test or type-check fails, the integration needs fixes before merging.

### 10. Hand Back to Caller

The skill returns:
- Branch name with the integration
- Diff summary
- Screenshot of in-context render
- Test/typecheck/lint status

Calling context (blog work, admin panel feature, marketing page) decides whether to merge, iterate, or revert.

## Integration Modes

| Mode | When | Effect |
|------|------|--------|
| **merge** (default) | Adding a new page/component/section | Minimal modification of existing files |
| **replace** | Full redesign of an existing route | Overwrite in scope; existing tokens still respected |
| **token-only** | Tight hand-off; user will write the code | Only updates `tokens.json` / tailwind config |

## Common Pitfalls

- **Skipping the app audit** — jumping straight to translation without auditing the target produces code that collides with existing patterns.
- **Skipping `ExtractDesignSystem`** — Claude Design WILL invent tokens if not primed with the app's real ones. Extract first, always.
- **Bypassing the diff review** — auto-applying a large diff is how legitimate work gets lost in overwrite. The review gate is not optional.
- **Not running tests post-apply** — integration can subtly break existing paths (layout regressions, type errors, a11y regressions). The test suite is the safety net.
- **Merge into main directly** — always use a branch. The user reviews the branch before merging.

## Time Estimate

15-45 minutes for a single component/page integration. Complex multi-route integrations: decompose into multiple sessions, one per integration target.
