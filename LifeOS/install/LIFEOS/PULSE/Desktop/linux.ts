/**
 * What Pulse Desktop needs on Linux in place of its macOS-only parts. The app was written for macOS; on any other
 * platform the author's files call this module from a branch that leaves the macOS path as written.
 *
 * Keys: the window manager owns Super, and a bare Ctrl chord belongs to the shell, so every app shortcut that uses ⌘
 * on macOS uses Ctrl+Shift here, the way kitty and Chrome do on Linux. ⇧⌘ adds Alt, and ⌥⌘R (reload without cache),
 * which would land on ⇧⌘R, becomes Ctrl+Shift+F5. The ⌃H / ⌃L session switches stay as the author made them.
 *
 * Pure functions only: the workspace renderer imports the label mapping, so nothing here touches Node.
 */

/** The one platform test: `process.platform` in the main process and the build, `navigator.platform` in the renderer.
 * Every Linux branch in the app files tests it, so every other platform runs the shipped code as written. */
export const isLinux = (platform: string): boolean => /^linux/i.test(platform);

const COMMAND = new Set(['CmdOrCtrl', 'CommandOrControl', 'Command', 'Cmd']);
const MODIFIERS = new Set([...COMMAND, 'Shift', 'Alt', 'Option', 'Control', 'Ctrl']);

function linuxChord(shift: boolean, alt: boolean, key: string, source: string): string {
  if (alt) {
    if (key === 'R' && !shift) return 'Ctrl+Shift+F5';
    throw new Error(`No Linux shortcut for ${source}: add it to linux.ts`);
  }
  return shift ? `Ctrl+Shift+Alt+${key}` : `Ctrl+Shift+${key}`;
}

/** The Linux accelerator for one of the app's macOS menu accelerators (Electron syntax). */
export function linuxAccelerator(mac: string): string {
  const parts = mac.split('+');
  const key = parts.pop()!;
  for (const part of parts) if (!MODIFIERS.has(part)) throw new Error(`Unknown modifier ${part} in ${mac}`);
  if (!parts.some(p => COMMAND.has(p))) throw new Error(`No Linux shortcut for ${mac}: it has no Command key`);
  return linuxChord(parts.includes('Shift'), parts.includes('Alt') || parts.includes('Option'), key, mac);
}

const KEY_NAMES: Record<string, string> = { '+': 'Plus', '−': 'Minus', '-': 'Minus' };

/** A shortcut as the app shows it (⌘T, ⇧⌘W, ⌃H, "After ⌘B; …"), written with the Linux keys. */
export function linuxShortcutLabel(text: string): string {
  return text
    .replace(/([⌃⌥⇧]*)⌘(\S)/gu, (whole, mods: string, key: string) =>
      linuxChord(mods.includes('⇧'), mods.includes('⌥'), KEY_NAMES[key] ?? key, whole))
    .replace(/⌃(\S)/gu, 'Ctrl+$1');
}

export type MenuEntry = {
  role?: string;
  label?: string;
  accelerator?: string;
  type?: string;
  submenu?: MenuEntry[];
  [key: string]: unknown;
};

const MAC_ONLY_ROLES = new Set(['services', 'hide', 'hideOthers', 'unhide']);
/** Edit commands stay with the page and the terminal surface (it owns copy and paste); the menu only backs them up. */
export const EDIT_ROLES = new Set(['undo', 'redo', 'cut', 'copy', 'paste', 'selectall']);
/** Electron lowercases a live MenuItem's role (selectAll → selectall), so roles compare in lowercase. */
export const isEditRole = (role: string | null | undefined) => !!role && EDIT_ROLES.has(role.toLowerCase());
const LINUX_EDIT: MenuEntry = {
  label: 'Edit',
  submenu: [
    { role: 'undo', accelerator: 'Ctrl+Shift+Z' },
    { role: 'redo', accelerator: 'Ctrl+Shift+Alt+Z' },
    { type: 'separator' },
    { role: 'cut', accelerator: 'Ctrl+Shift+X' },
    { role: 'copy', accelerator: 'Ctrl+Shift+C' },
    { role: 'paste', accelerator: 'Ctrl+Shift+V' },
    { role: 'selectAll', accelerator: 'Ctrl+Shift+A' },
  ],
};
const LINUX_WINDOW: MenuEntry = { label: 'Window', submenu: [{ role: 'minimize', accelerator: 'Ctrl+Shift+M' }] };
/** Roles that carry no default accelerator; any other role must get an explicit Linux one. */
const SILENT_ROLES = new Set(['about', 'close']);

function convert(item: MenuEntry): MenuEntry[] {
  if (item.role && MAC_ONLY_ROLES.has(item.role)) return [];
  if (item.role === 'editMenu') return [LINUX_EDIT];
  if (item.role === 'windowMenu') return [LINUX_WINDOW];
  if (item.role === 'quit') return [{ ...item, accelerator: 'Ctrl+Shift+Q' }];
  const out: MenuEntry = { ...item };
  if (item.accelerator) out.accelerator = linuxAccelerator(item.accelerator);
  else if (item.role && !SILENT_ROLES.has(item.role)) throw new Error(`Menu role ${item.role} needs a Linux accelerator`);
  if (item.submenu) {
    out.submenu = item.submenu.flatMap(convert)
      .filter((entry, i, all) => entry.type !== 'separator' || (i > 0 && all[i - 1].type !== 'separator'));
  }
  return [out];
}

/** The app menu for Linux: macOS-only roles out, explicit Linux accelerators, and none that is a bare Ctrl chord. */
export function linuxMenu<T extends MenuEntry>(template: T[]): T[] {
  return template.flatMap(convert) as T[];
}

/** Punctuation keys sit in different places on each layout (on ABNT2 "]" is the US Backslash key), so they match by the
 * character the key types, unshifted or shifted. */
const PUNCTUATION: Record<string, string[]> = { '[': ['[', '{'], ']': [']', '}'], Plus: ['=', '+'], '=': ['=', '+'], '-': ['-', '_'] };
function keyMatches(key: string, input: KeyInput): boolean {
  if (/^[a-z]$/i.test(key)) return input.code === 'Key' + key.toUpperCase();
  if (/^\d$/.test(key)) return input.code === 'Digit' + key;
  if (/^F\d{1,2}$/.test(key)) return input.code === key;
  const chars = PUNCTUATION[key];
  if (!chars) throw new Error(`No Linux key for ${key}: add it to linux.ts`);
  return chars.includes(input.key);
}

export type KeyInput = { control: boolean; shift: boolean; alt: boolean; meta: boolean; code: string; key: string };

/** Whether a key press is this Linux accelerator: letters, digits and F-keys by physical key (Shift turns 1 into !),
 * punctuation by the character the layout gives it. */
export function matchesAccelerator(accelerator: string, input: KeyInput): boolean {
  const parts = accelerator.split('+');
  const key = parts.pop()!;
  return !input.meta && input.control === parts.includes('Ctrl') && input.shift === parts.includes('Shift')
    && input.alt === parts.includes('Alt') && keyMatches(key, input);
}

export type EditCommand = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll';
const EDIT_COMMANDS: Record<string, EditCommand> = { undo: 'undo', redo: 'redo', cut: 'cut', copy: 'copy', paste: 'paste', selectall: 'selectAll' };

/**
 * The edit command a key press asks for, by the Linux Edit menu. With the menu bar hidden, Electron on Linux does not
 * run these from the menu, so the main process runs them on text fields itself (webContents.copy() and the rest).
 */
export function linuxEditCommand(input: KeyInput): EditCommand | null {
  for (const item of LINUX_EDIT.submenu!) {
    if (item.role && item.accelerator && matchesAccelerator(item.accelerator, input)) return EDIT_COMMANDS[item.role.toLowerCase()];
  }
  return null;
}

/**
 * Edit chords the terminal must not encode. The Ghostty surface copies with Ctrl+Shift+C when text is selected and
 * pastes with Ctrl+Shift+V; with nothing selected its encoder sends Ctrl+Shift+C as ^C, and Ctrl+Shift+X/Z/A as
 * ^X/^Z/^A, so the shown copy key would interrupt the program and the undo key suspend it. Those presses stop here.
 */
export function linuxTerminalSwallows(e: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean; key: string }, hasSelection: boolean): boolean {
  if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return false;
  const key = e.key.toLowerCase();
  return key === 'x' || key === 'z' || key === 'a' || (key === 'c' && !hasSelection);
}

type LiveItem = { role?: string | null; accelerator?: string | null; submenu?: { items: LiveItem[] } | null };

/**
 * The menu command a key press runs, edit commands excepted. The main process runs it before the page sees the key,
 * so the terminal never encodes an app shortcut as shell input.
 */
export function linuxMenuCommand<T extends LiveItem>(items: readonly T[], input: KeyInput): T | null {
  for (const item of items) {
    if (item.accelerator && !isEditRole(item.role) && matchesAccelerator(item.accelerator, input)) return item;
    const found = item.submenu ? linuxMenuCommand(item.submenu.items as T[], input) : null;
    if (found) return found;
  }
  return null;
}

/** tmux on Linux lives in the system path. */
export const LINUX_TMUX = ['/usr/bin/tmux', '/usr/local/bin/tmux'];
export const LINUX_TMUX_MISSING = 'tmux is required. Install it with your package manager (for example: sudo pacman -S tmux).';

const TMUX_SHELL = 'set -g default-shell /bin/zsh\n';
const TMUX_COMMAND = "set -g default-command '/bin/zsh -l'\n";

/** The author's tmux.conf with the user's login shell for zsh and the Wayland clipboard for pbcopy. The author's lines
 * are checked as they are, so a changed tmux.conf fails here instead of starting the wrong shell. */
export function linuxTmuxConfig(config: string, shell: string): string {
  if (!shell.startsWith('/') || /[\s'"]/.test(shell)) throw new Error(`Login shell must be an absolute path without spaces or quotes, got ${shell}`);
  const copies = config.split('"pbcopy"').length - 1;
  if (!config.includes(TMUX_SHELL) || !config.includes(TMUX_COMMAND) || copies !== 2 || config.replaceAll('"pbcopy"', '').includes('pbcopy')) {
    throw new Error('tmux.conf changed shape: update linuxTmuxConfig in linux.ts');
  }
  return config.replace(TMUX_SHELL, `set -g default-shell ${shell}\n`)
    .replace(TMUX_COMMAND, `set -g default-command '${shell} -l'\n`)
    .replaceAll('"pbcopy"', '"wl-copy"');
}

/** Where the stable tmux config lives (macOS: ~/Library/Application Support/LifeOS/pulse-terminal). */
export function linuxTerminalDir(home: string): string {
  return `${home}/.local/share/LifeOS/pulse-terminal`;
}

/** The shell environment with the login shell and the PATH the app started with, without the Homebrew prefix. */
export function linuxShellEnvironment(env: Record<string, string | undefined>, path: string | undefined, shell: string): Record<string, string | undefined> {
  return { ...env, SHELL: shell, PATH: path || '/usr/local/bin:/usr/bin:/bin' };
}

/** Font folders for the kitty font file: the user's, then the system's with one level of subfolders (Arch: TTF/, OTF/). */
export function linuxFontDirs(home: string, subdirs: (dir: string) => string[]): string[] {
  const roots = [`${home}/.local/share/fonts`, `${home}/.fonts`, '/usr/local/share/fonts', '/usr/share/fonts'];
  return roots.flatMap(root => [root, ...subdirs(root)]);
}

/** HTTPS links open in Google Chrome, as `open -a "Google Chrome"` does on macOS. */
export function linuxBrowserCommand(url: string): [string, string[]] {
  return ['google-chrome-stable', [url]];
}

/** Starts the installed Pulse user service; `start` leaves a running one alone, like `launchctl kickstart` without -k. */
export const LINUX_PULSE_START: [string, string[]] = ['systemctl', ['--user', 'start', 'com.lifeos.pulse.service']];

/** The launcher entry for the installed app. */
export function desktopEntry(exec: string, icon: string): string {
  if (/["\\`$%\n]/.test(exec) || /\n/.test(icon)) throw new Error('Install paths must not hold quotes, backslashes, $, % or newlines');
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Pulse Desktop',
    'Comment=LifeOS Pulse dashboard with persistent terminal sessions',
    `Exec="${exec}"`,
    `Icon=${icon}`,
    'Terminal=false',
    'Categories=Utility;',
    'StartupWMClass=pulse-desktop',
    '',
  ].join('\n');
}
