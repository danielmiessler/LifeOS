# Terminal Tab State System

## Overview

The PAI system uses Kitty terminal tab colors and title suffixes to provide instant visual feedback on session state. At a glance, you can see which tabs are working, completed, waiting for input, or have errors.

## State System

| State | Icon | Format | Suffix | Inactive Background | When |
|-------|------|--------|--------|---------------------|------|
| **Inference** | 🧠 | Normal | `…` | Purple `#1E0A3C` | AI thinking (Haiku/Sonnet inference) |
| **Working** | ⚙️ | *Italic* | `…` | Orange `#804000` | Processing your request |
| **Completed** | ✓ | Normal | (none) | Green `#022800` | Task finished successfully |
| **Awaiting Input** | ❓ | **BOLD CAPS** | (none) | Teal `#0D4F4F` | AskUserQuestion tool used |
| **Error** | ⚠ | Normal | `!` | Orange `#804000` | Error detected in response |

**Text Colors:**
- Active tab: White `#FFFFFF`
- Inactive tab: Gray `#A0A0A0`

**Active Tab Background:** Always Dark Blue `#002B80` (regardless of state)

**Key Design:** State colors only affect **inactive** tabs. The active tab always stays dark blue so you can quickly identify which tab you're in. When you switch away from a tab, you see its state color.

## How It Works

### Two-Hook Architecture

**1. UserPromptSubmit (Start of Work)**
- Hook: `SessionAnalysis.hook.ts`
- Sets title with `…` suffix
- Sets background to orange (working)

**2. Stop (End of Work)**
- Hook: `SessionAnalysis.hook.ts` → `handlers/TabState.ts`
- Detects final state (completed, awaiting input, error)
- Sets appropriate suffix and color

### State Detection Logic

```typescript
function detectResponseState(lastMessage, transcriptPath): ResponseState {
  // Check for AskUserQuestion tool → 'awaitingInput'
  // Check for error patterns in STATUS section → 'error'
  // Default → 'completed'
}
```

**Awaiting Input Detection:**
- Scans last 20 transcript entries for `AskUserQuestion` tool use

**Error Detection:**
- Checks `📊 STATUS:` section for: error, failed, broken, problem, issue
- Checks for error keywords + error emoji combination

## Examples

| Scenario | Tab Appearance | Notes |
|----------|----------------|-------|
| AI inference running | `🧠 Analyzing…` (purple when inactive) | Brain icon shows AI is thinking |
| Processing request | `⚙️ 𝘍𝘪𝘹𝘪𝘯𝘨 𝘣𝘶𝘨…` (orange when inactive) | Gear icon + italic text |
| Task completed | `✓Fixing bug` (green when inactive) | Checkmark, normal text |
| Need clarification | `❓𝗤𝗨𝗘𝗦𝗧𝗜𝗢𝗡` (teal when inactive) | Bold ALL CAPS |
| Error occurred | `⚠Fixing bug!` (orange when inactive) | Warning icon + exclamation |

**Note:** Active tab always shows dark blue (#002B80) background. State colors only visible when tab is inactive.

### Text Formatting

- **Working state:** Uses Unicode Mathematical Italic (`𝘈𝘉𝘊...`) for italic appearance
- **Question state:** Uses Unicode Mathematical Bold (`𝗔𝗕𝗖...`) in ALL CAPS

## Algorithm Phase Tab System

Separate from the State System above, **Algorithm runs** drive tab titles/colors via `setPhaseTab()` in `hooks/lib/tab-setter.ts`. Each phase (OBSERVE, THINK, PLAN, BUILD, EXECUTE, VERIFY, LEARN, COMPLETE) has a distinct emoji prefix and background color defined in `hooks/lib/tab-constants.ts::PHASE_TAB_CONFIG`. The title format is `{symbol} {ONE_WORD} | {description}` — for example `⚡ ALGORITHM STATE SYNC | Fixing Algorithm State Sync.`.

**Two drivers feed `setPhaseTab`:**

1. **`ISASync.hook.ts` (PostToolUse, Edit on ISA.md)** — fires when the Algorithm executor edits the ISA frontmatter `phase:` field.
2. **Pulse daemon `/notify` phase capture (out-of-process)** — fires when an Algorithm phase signal hits `/notify` with `phase` + `slug`. The daemon resolves the kitty socket via the per-session file at `MEMORY/STATE/kitty-sessions/{sessionUUID}.json` (written by `KittyEnvPersist.hook.ts` at SessionStart).

**Cross-process support details:**

- `tab-setter.ts::kittenBin()` resolves the `kitten` binary via `command -v`, falling back to `/Applications/kitty.app/Contents/MacOS/kitten` — required because the Pulse daemon runs under launchd with a restricted PATH that doesn't include `/Applications/*`.
- All `kitten @` invocations in `tab-setter.ts` pass `--match="id:{windowId}"` so the daemon (which has no focused kitty window) targets the correct tab instead of whichever tab happens to be focused.
- Fallback chain for socket discovery: process env (`KITTY_LISTEN_ON`) → per-session file → default `/tmp/kitty-$USER` socket.

## Terminal Compatibility

Requires **Kitty terminal** with remote control enabled:

```bash
# kitty.conf
allow_remote_control yes
listen_on unix:/tmp/kitty
```

## Implementation Details

### Kitty Commands Used

```bash
# Set tab title
kitty @ set-tab-title "Title here"

# Set tab colors
kitten @ set-tab-color --self \
  active_bg=#1244B3 active_fg=#FFFFFF \
  inactive_bg=#022800 inactive_fg=#A0A0A0
```

### Hook Files

| File | Event | Purpose |
|------|-------|---------|
| `SessionAnalysis.hook.ts` | UserPromptSubmit | Set working state (italic text) |
| `SetQuestionTab.hook.ts` | PreToolUse (AskUserQuestion) | Set question state (bold caps) |
| `SessionAnalysis.hook.ts` → `handlers/TabState.ts` | Stop | Set final state |

### Color Constants

```typescript
// In SessionAnalysis.hook.ts
const TAB_WORKING_BG = '#804000';      // Dark orange (inactive tabs only)
const TAB_INFERENCE_BG = '#1E0A3C';    // Dark purple (AI thinking)
const ACTIVE_TAB_BG = '#002B80';       // Dark blue (always for active tab)
const ACTIVE_TEXT = '#FFFFFF';          // White
const INACTIVE_TEXT = '#A0A0A0';        // Gray

// In SetQuestionTab.hook.ts (via lib/tab-constants.ts)
const TAB_AWAITING_BG = '#0D4F4F';     // Dark teal (waiting for input)

// In handlers/TabState.ts (via lib/tab-constants.ts)
const TAB_COLORS = {
  awaitingInput: '#0D4F4F', // Dark teal
  completed: '#022800',     // Dark green
  error: '#804000',         // Dark orange
};

// Tab icons and formatting
const TAB_ICONS = {
  inference: '🧠',   // Brain - AI thinking
  working: '⚙️',     // Gear - processing (italic text)
  completed: '✓',    // Checkmark
  awaiting: '❓',    // Question (bold caps text)
  error: '⚠',       // Warning
};

const TAB_SUFFIXES = {
  inference: '…',
  working: '…',
  awaitingInput: '',  // No suffix, uses bold QUESTION
  completed: '',
  error: '!',
};
```

**Key Point:** `active_bg` is always set to `#002B80` (dark blue). State colors are applied to `inactive_bg` only.

## Debugging

### Check Current Tab Colors

```bash
kitty @ ls | jq '.[].tabs[] | {title, id}'
```

### Manually Reset All Tabs to Completed

```bash
kitten @ set-tab-color --match all \
  active_bg=#002B80 active_fg=#FFFFFF \
  inactive_bg=#022800 inactive_fg=#A0A0A0
```

### Test State Colors

```bash
# Inference (purple) - inactive only
kitten @ set-tab-color --self active_bg=#002B80 inactive_bg=#1E0A3C

# Working (orange) - inactive only
kitten @ set-tab-color --self active_bg=#002B80 inactive_bg=#804000

# Completed (green) - inactive only
kitten @ set-tab-color --self active_bg=#002B80 inactive_bg=#022800

# Awaiting input (teal) - inactive only
kitten @ set-tab-color --self active_bg=#002B80 inactive_bg=#0D4F4F
```

**Note:** Always set `active_bg=#002B80` to maintain consistent dark blue for active tabs.

## Benefits

- **Visual Task Tracking** - See state at a glance without reading titles
- **Multi-Session Management** - Quickly identify which tabs need attention
- **Color-Coded Priority** - Teal tabs need input, green tabs are done
- **Automatic** - No manual updates needed, hooks handle everything

---

**Last Updated:** 2026-04-19
**Status:** Production - Implemented via hook system + out-of-process daemon phase updates
