/**
 * Pulse Desktop on Linux: what only Linux needs lives in `linux.ts`, and the app files call it from the branch that is not
 * the macOS one. The test reads the accelerators and labels from the app files themselves, so a new shortcut with no
 * Linux key fails here instead of silently in use.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  desktopEntry, EDIT_ROLES, isEditRole, isLinux, linuxEditCommand, LINUX_PULSE_START, linuxAccelerator, linuxBrowserCommand, linuxMenu, linuxMenuCommand,
  linuxShortcutLabel, linuxTerminalSwallows, linuxTmuxConfig, matchesAccelerator, type MenuEntry,
} from "./linux";

const DESKTOP = import.meta.dir;
const read = (file: string) => readFileSync(join(DESKTOP, file), "utf8");
const main = read("main.ts");

/** Every accelerator of the author's menu, the page shortcuts (⌘1…⌘3) spelled out. */
function authorAccelerators(): string[] {
  const fixed = [...main.matchAll(/accelerator:'([^']+)'/g)].map(m => m[1]);
  const pageLine = read("commands.ts").split("\n").find(l => l.startsWith("const pageShortcuts"))!;
  const pages = [...pageLine.matchAll(/'⌘(\d)'/g)].map(m => `CmdOrCtrl+${m[1]}`);
  expect(pages.length).toBe(3);
  expect(main).toContain("accelerator:`CmdOrCtrl+${p.shortcut!.slice(1)}`");
  return [...fixed, ...pages];
}

test("every menu accelerator gets a distinct Ctrl+Shift key on Linux", () => {
  const mac = authorAccelerators();
  expect(mac.length).toBeGreaterThan(15);
  const added = linuxMenu([{ role: "editMenu" }, { role: "windowMenu" }, { role: "quit" }])
    .flatMap(i => [i, ...(i.submenu ?? [])]).map(i => i.accelerator).filter((a): a is string => !!a);
  const linux = [...mac.map(linuxAccelerator), ...added];
  for (const a of linux) expect(a).toMatch(/^Ctrl\+Shift\+/);
  expect(new Set(linux).size).toBe(linux.length);
  expect(linuxAccelerator("CmdOrCtrl+T")).toBe("Ctrl+Shift+T");
  expect(linuxAccelerator("CmdOrCtrl+Shift+T")).toBe("Ctrl+Shift+Alt+T");
  expect(linuxAccelerator("CmdOrCtrl+Alt+R")).toBe("Ctrl+Shift+F5");
  expect(linuxAccelerator("Control+Command+F")).toBe("Ctrl+Shift+F");
});

test("an accelerator with no Linux key fails loudly", () => {
  expect(() => linuxAccelerator("CmdOrCtrl+Alt+T")).toThrow(/linux\.ts/);
  expect(() => linuxAccelerator("Ctrl+T")).toThrow(/Command/);
  expect(() => linuxAccelerator("Hyper+T")).toThrow(/Unknown modifier/);
});

test("the Linux menu drops macOS-only roles and leaves no Ctrl without Shift", () => {
  const roles = new Set([...main.matchAll(/role:'(\w+)'/g)].map(m => m[1]));
  const template: MenuEntry[] = [
    { label: "Pulse Desktop", submenu: [...roles].filter(r => !["editMenu", "windowMenu", "close"].includes(r)).flatMap(r => [{ role: r }, { type: "separator" }]) },
    { label: "File", submenu: [{ label: "New", accelerator: "CmdOrCtrl+T" }, { role: "close", label: "Close Window", accelerator: "CmdOrCtrl+Shift+W" }] },
    { role: "editMenu" },
    { role: "windowMenu" },
  ];
  const linux = linuxMenu(template);
  const flat = (items: MenuEntry[]): MenuEntry[] => items.flatMap(i => [i, ...flat(i.submenu ?? [])]);
  const all = flat(linux);
  for (const item of all) {
    if (item.accelerator) expect(item.accelerator).toMatch(/^Ctrl\+Shift\+/);
    if (item.role && !["about", "close"].includes(item.role)) expect(item.accelerator).toBeDefined();
  }
  for (const gone of ["services", "hide", "hideOthers", "unhide", "editMenu", "windowMenu"]) expect(all.some(i => i.role === gone)).toBe(false);
  expect(all.find(i => i.role === "quit")?.accelerator).toBe("Ctrl+Shift+Q");
  const app = linux[0].submenu!;
  for (let i = 1; i < app.length; i++) expect(app[i].type === "separator" && app[i - 1].type === "separator").toBe(false);
  expect(() => linuxMenu([{ role: "reload" }])).toThrow(/needs a Linux accelerator/);
});

test("letters and digits match by key position, punctuation by character, on any layout", () => {
  const key = (code: string, k: string, extra: Partial<{ shift: boolean; alt: boolean }> = {}) =>
    ({ control: true, shift: true, alt: false, meta: false, code, key: k, ...extra });
  expect(matchesAccelerator("Ctrl+Shift+1", key("Digit1", "!"))).toBe(true);
  expect(matchesAccelerator("Ctrl+Shift+T", key("KeyT", "T", { alt: true }))).toBe(false);
  expect(matchesAccelerator("Ctrl+Shift+Alt+T", key("KeyT", "T", { alt: true }))).toBe(true);
  expect(matchesAccelerator("Ctrl+Shift+T", { ...key("KeyT", "t"), shift: false })).toBe(false);
  // US: "[" is BracketLeft. ABNT2 (xkb symbols/br): "[" is the US BracketRight key, "]" the US Backslash key.
  expect(matchesAccelerator("Ctrl+Shift+[", key("BracketLeft", "{"))).toBe(true);
  expect(matchesAccelerator("Ctrl+Shift+[", key("BracketRight", "{"))).toBe(true);
  expect(matchesAccelerator("Ctrl+Shift+]", key("BracketRight", "{"))).toBe(false);
  expect(matchesAccelerator("Ctrl+Shift+]", key("Backslash", "}"))).toBe(true);
  expect(matchesAccelerator("Ctrl+Shift+Plus", key("Equal", "+"))).toBe(true);
  expect(matchesAccelerator("Ctrl+Shift+-", key("Minus", "_"))).toBe(true);
});

test("edit commands go to the page, with the role as Electron returns it", () => {
  const key = (code: string) => ({ control: true, shift: true, alt: false, meta: false, code, key: code.slice(3) });
  const items = [
    { role: "copy", accelerator: "Ctrl+Shift+C" },
    { role: "selectall", accelerator: "Ctrl+Shift+A" },
    { label: "File", submenu: { items: [{ role: null, accelerator: "Ctrl+Shift+T" }] } },
  ];
  expect(linuxMenuCommand(items, key("KeyC"))).toBeNull();
  expect(linuxMenuCommand(items, key("KeyA"))).toBeNull();
  expect(linuxMenuCommand(items, key("KeyT"))?.accelerator).toBe("Ctrl+Shift+T");
  for (const role of ["undo", "redo", "cut", "copy", "paste", "selectAll", "selectall"]) expect(isEditRole(role)).toBe(true);
  const press = (code: string, alt = false) => ({ control: true, shift: true, alt, meta: false, code, key: code.slice(3) });
  expect(["KeyZ", "KeyX", "KeyC", "KeyV", "KeyA"].map(c => linuxEditCommand(press(c)))).toEqual(["undo", "cut", "copy", "paste", "selectAll"]);
  expect(linuxEditCommand(press("KeyZ", true))).toBe("redo");
  expect(linuxEditCommand(press("KeyT"))).toBeNull();
  expect(linuxEditCommand({ ...press("KeyC"), shift: false })).toBeNull();
  expect(EDIT_ROLES.size).toBe(6);
});

test("in the terminal, Ctrl+Shift edit keys never become ^C, ^X, ^Z or ^A", () => {
  const k = (key: string, extra = {}) => ({ ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, key, ...extra });
  for (const key of ["C", "X", "Z", "A"]) expect(linuxTerminalSwallows(k(key), false)).toBe(true);
  expect(linuxTerminalSwallows(k("C"), true)).toBe(false);
  expect(linuxTerminalSwallows(k("V"), false)).toBe(false);
  expect(linuxTerminalSwallows(k("c", { shiftKey: false }), false)).toBe(false);
  expect(linuxTerminalSwallows(k("Z", { altKey: true }), false)).toBe(false);
});

test("every shortcut the app shows names the Linux key", () => {
  const shown = ["workspace.ts", "commands.ts", "workspace.html"].flatMap(f => [...read(f).matchAll(/[⌃⌥⇧]*[⌘⌃][^\s'"<`]/gu)].map(m => m[0]));
  expect(shown.length).toBeGreaterThan(15);
  for (const label of shown) expect(linuxShortcutLabel(label)).not.toMatch(/[⌘⌃⇧⌥]/u);
  // Text the renderer sets after start-up escapes the one-time kbd/title pass. The shipped line stays as written,
  // so each such label is followed by its Linux line, which writes the same text through keyLabel.
  const code = read("workspace.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const glyphLabels = [...code.matchAll(/\$\('([\w-]+)'\)\.textContent='([^']*[⌘⌃⇧⌥][^']*)'/gu)];
  expect(glyphLabels.length).toBeGreaterThan(0);
  for (const [, id, text] of glyphLabels) expect(code).toContain(`if(LINUX)$('${id}').textContent=keyLabel('${text}');`);
  expect(linuxShortcutLabel("⇧⌘W")).toBe("Ctrl+Shift+Alt+W");
  expect(linuxShortcutLabel("⌃H / ⌃L")).toBe("Ctrl+H / Ctrl+L");
  expect(linuxShortcutLabel("After ⌘B; Enter selects")).toBe("After Ctrl+Shift+B; Enter selects");
  expect(linuxShortcutLabel("⌘+")).toBe("Ctrl+Shift+Plus");
  // The offline page runs no script: the author's file stays as written, and the Linux build writes the converted copy.
  expect(read("offline.html")).not.toContain("Ctrl+");
  expect(linuxShortcutLabel(read("offline.html"))).toContain("Shortcut: Ctrl+Shift+Alt+R.");
  expect(read("build.ts")).toContain("linuxShortcutLabel(readFileSync(join(root,'offline.html'),'utf8'))");
});

test("the shipped tmux.conf gets the login shell and wl-copy", () => {
  for (const shell of ["/usr/bin/bash", "/usr/bin/zsh", "/bin/zsh", "/usr/local/bin/zsh", "/usr/bin/fish"]) {
    const conf = linuxTmuxConfig(read("tmux.conf"), shell);
    expect(conf).toContain(`set -g default-shell ${shell}\n`);
    expect(conf).toContain(`default-command '${shell} -l'`);
    expect(conf.split('copy-pipe-and-cancel "wl-copy"').length - 1).toBe(2);
    expect(conf).not.toContain("pbcopy");
  }
  expect(() => linuxTmuxConfig(read("tmux.conf"), "/opt/my shell")).toThrow(/spaces/);
  expect(() => linuxTmuxConfig(read("tmux.conf"), "bash")).toThrow(/absolute/);
  expect(() => linuxTmuxConfig("set -g x 'pbcopy'", "/usr/bin/bash")).toThrow(/changed shape/);
});

test("links, Pulse start and the launcher entry", () => {
  expect(linuxBrowserCommand("https://example.com")).toEqual(["google-chrome-stable", ["https://example.com"]]);
  expect(LINUX_PULSE_START).toEqual(["systemctl", ["--user", "start", "com.lifeos.pulse.service"]]);
  const entry = desktopEntry("/home/u/.local/share/pulse-desktop/pulse-desktop", "/home/u/.local/share/pulse-desktop/pulse-desktop.png");
  expect(entry).toContain('Exec="/home/u/.local/share/pulse-desktop/pulse-desktop"');
  expect(entry).toContain("StartupWMClass=pulse-desktop");
  expect(() => desktopEntry('/tmp/a"b', "/i.png")).toThrow(/quotes/);
  expect(() => desktopEntry("/tmp/50%/app", "/i.png")).toThrow(/%/);
});

test("one platform test picks the Linux path, and only on Linux", () => {
  for (const p of ["linux", "Linux x86_64", "Linux aarch64"]) expect(isLinux(p)).toBe(true);
  for (const p of ["darwin", "MacIntel", "win32", "Win32", "freebsd", ""]) expect(isLinux(p)).toBe(false);
  // Every app file decides by that one test; none branches on "not macOS".
  for (const f of ["main.ts", "terminals.ts", "build.ts", "workspace.ts"]) {
    expect(read(f)).toMatch(/const LINUX=isLinux\((process|navigator)\.platform\);/);
    expect(read(f)).not.toContain("isMacPlatform(navigator.platform)?");
  }
});
