# Pulse Desktop

A macOS Electron front door to the existing Pulse dashboard at `http://localhost:31337`.
It uses the same live interface and APIs, with a Dock icon, native menus, back/forward, zoom, full screen, and remembered window size and page. Closing the app never stops Pulse or its jobs. The existing menu-bar app remains separate.

## Build and install

Requires Bun, macOS, tmux (Homebrew), and an installed LifeOS Pulse service.

```sh
bun install
bun run install-app
open "/Applications/Pulse Desktop.app"
```

The app icon defaults to the LifeOS logo the dashboard ships (`../Observability/public/lifeos-logo.png`); pass `--icon <PNG>` to use your own. Later builds reuse the ignored local copy in `assets/`. Session cards show Claude Code and Codex as text labels unless you place your own marks at `assets/providers/claude.svg` and `chatgpt.svg`; the release does not ship them. `bun run start` launches a development build; `bun run package` creates an app in `release/`. No credentials, server files, USER data, or dashboard data are copied into the bundle. Fonts come from the dashboard’s installed custom font assets. This is a local build, not a notarized distribution or standalone LifeOS installer.

The installed app lives at `/Applications/Pulse Desktop.app`. Replacement backups stay in `~/Library/Application Support/LifeOS/App Backups.noindex`, outside application search. The separate menu-bar helper lives in `~/Library/Application Support/LifeOS/Helpers.noindex`.

### Linux

The same `bun install` and `bun run install-app` build the app for Linux and install it to `~/.local/share/pulse-desktop`, with a `pulse-desktop.desktop` launcher entry in `~/.local/share/applications`; a replaced copy moves to `~/.local/share/LifeOS/app-backups`. It needs tmux from the package manager and Pulse as the systemd user service `com.lifeos.pulse.service`, which the app starts when it is stopped. App shortcuts use Ctrl+Shift where macOS uses ⌘, and Ctrl+Shift+Alt for ⇧⌘; ⌃H / ⌃L stay as they are. Everything only Linux needs lives in `linux.ts`, and every other platform runs the files as written. Tested on Arch Linux with Hyprland (Wayland).

## Controls

- ⌘K opens Commands & shortcuts from any dashboard or terminal. Search actions, pages, or sessions; ↑/↓ selects, Enter runs, and Escape returns to the workspace. “Show keyboard shortcuts” lists bindings with their scope. The sidebar also has a Commands & shortcuts button.
- ⌘1 Home, ⌘2 and ⌘3 open the pages pinned in `commands.ts`.
- ⌘T creates a terminal; ⇧⌘T chooses its working folder.
- Ctrl+H / Ctrl+L switches between dashboard pages and terminal sessions.
- ⌘B focuses the sidebar; j/k moves its focus and Enter selects. Escape returns to the workspace.
- Dashboard pages support j/k, gg/G, Ctrl+D/U. Text fields keep normal editing. Ctrl+J is untouched.
- Inside a terminal, Vim and shell keys pass through except Ctrl+H/L and native app shortcuts. Every ⌘ chord is an app shortcut even while a terminal is focused; the shell never sees its bare key (⌘C with a selection copies, ⌘V pastes).
- Held keys repeat inside the terminal as in kitty: the installer switches macOS press-and-hold off for the app bundle (`ApplePressAndHoldEnabled`), and the app re-asserts it at launch.
- Click plain HTTPS URLs and OSC 8 terminal hyperlinks to open Chrome directly, like dashboard links. HTTP, credential-bearing and other unsupported URLs are refused.
- ⌘[ / ⌘] Back / forward; ⌘R reload.
- ⇧⌘R reconnect. If Pulse is stopped, the app starts the already-installed launchd service without restarting a running one.
- Closing the window hides the live workspace; clicking Pulse Desktop in the Dock restores that same session rail. ⌘Q quits the app while terminals keep running in tmux.
- Standard Edit, zoom, full-screen and Window menus.
- External HTTPS links open Chrome directly. Downloads use the native save dialog.

Dashboard content is sandboxed without Node, preload or terminal IPC. The separately bundled workspace has a narrow preload API; the main process accepts requests only from that exact local file and its top-level frame. Session IDs, titles and dimensions are validated. Terminal output is rendered by a vendored libghostty-vt (WebAssembly) core on a canvas, with bounded PTY backpressure, never inserted as HTML. External navigation, webviews and arbitrary popups are blocked. OS capability requests require explicit consent.

## Persistent sessions

Terminals run in an isolated `tmux -L pulse-desktop` server. Closing or reloading Pulse detaches its clients; shells and programs continue until they exit or you explicitly choose End session and confirm. Persistence spans app restarts, not a Mac reboot. The sidebar's Rename action names a session without changing its shell. All listed sessions run inside Pulse; no Kitty discovery or handoff is present.

Terminal palette and point size are read from the installed Kitty configuration, and the configured regular font file is bundled when it is installed under `~/Library/Fonts` or `/Library/Fonts` as `<Family>-Regular.ttf` or `.otf` (spaces optional). Without a Kitty config or that file, the build still succeeds and the terminal uses its fixed-width fallback font. The Kitty background image follows kitty.conf too (`background_image`, `background_image_layout`, `background_tint`) and is blended the way Kitty blends it, so lowering `background_tint` brightens both terminals; the dashboard pages keep their own styling. New shells discard inherited color-suppression flags. Existing programs retain their launch environment until restarted. Native tabs consume the shared terminal-state decorations. UI fonts reuse Pulse's custom assets. The app remembers the selected workspace and window dimensions; terminal session metadata lives in the dedicated tmux server.

`bun test` checks URL boundaries, renderer privileges, readiness and state sanitization. `bun run start -- --offline-preview` is a development-only way to inspect the disconnected view without stopping Pulse.
