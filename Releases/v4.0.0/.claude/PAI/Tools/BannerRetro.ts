#!/usr/bin/env bun

/**
 * BannerRetro - Retro BBS/DOS Terminal Banner for PAI
 *
 * Neofetch-style layout with classic ASCII art aesthetic:
 * - LEFT: Isometric PAI cube using classic ASCII characters
 * - RIGHT: System stats in retro box frame
 * - BOTTOM: Double-line box, quote, progress bar, block KAI, GitHub URL
 *
 * Design inspired by:
 * - neofetch/screenfetch system info displays
 * - BBS door games and ANSI art
 * - DOS-era interface aesthetics
 * - Amber/green phosphor CRT terminals
 */

import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const HOME = process.env.HOME!;
const CLAUDE_DIR = join(HOME, ".claude");

// ═══════════════════════════════════════════════════════════════════════════
// Terminal Width Detection
// ═══════════════════════════════════════════════════════════════════════════

function getTerminalWidth(): number {
  let width: number | null = null;

  // Tier 1: Kitty IPC
  const kittyWindowId = process.env.KITTY_WINDOW_ID;
  if (kittyWindowId) {
    try {
      const result = spawnSync("kitten", ["@", "ls"], { encoding: "utf-8" });
      if (result.stdout) {
        const data = JSON.parse(result.stdout);
        for (const osWindow of data) {
          for (const tab of osWindow.tabs) {
            for (const win of tab.windows) {
              if (win.id === parseInt(kittyWindowId)) {
                width = win.columns;
                break;
              }
            }
          }
        }
      }
    } catch {}
  }

  // Tier 2: Direct TTY query
  if (!width || width <= 0) {
    try {
      const result = spawnSync("sh", ["-c", "stty size </dev/tty 2>/dev/null"], {
        encoding: "utf-8"
      });
      if (result.stdout) {
        const cols = parseInt(result.stdout.trim().split(/\s+/)[1]);
        if (cols > 0) width = cols;
      }
    } catch {}
  }

  // Tier 3: tput fallback
  if (!width || width <= 0) {
    try {
      const result = spawnSync("tput", ["cols"], { encoding: "utf-8" });
      if (result.stdout) {
        const cols = parseInt(result.stdout.trim());
        if (cols > 0) width = cols;
      }
    } catch {}
  }

  // Tier 4: Environment variable fallback
  if (!width || width <= 0) {
    width = parseInt(process.env.COLUMNS || "80") || 80;
  }

  return width;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANSI Color System - Retro Phosphor Theme
// ═══════════════════════════════════════════════════════════════════════════

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const BLINK = "\x1b[5m"; // Terminal-dependent blinking

const rgb = (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`;

// Retro phosphor color palette
const COLORS = {
  // Classic green phosphor (P1)
  greenBright: rgb(51, 255, 51),    // #33ff33 - bright green CRT
  greenNormal: rgb(0, 200, 0),       // #00c800 - normal green
  greenDim: rgb(0, 128, 0),          // #008000 - dim green

  // Amber phosphor (P3)
  amberBright: rgb(255, 191, 0),     // #ffbf00 - bright amber
  amberNormal: rgb(255, 140, 0),     // #ff8c00 - normal amber
  amberDim: rgb(180, 100, 0),        // #b46400 - dim amber

  // Frame and accent colors (keeping retro feel)
  frame: rgb(0, 140, 0),             // Frame green
  highlight: rgb(100, 255, 100),     // Highlighted text

  // For the PAI logo gradient
  cyan: rgb(0, 255, 255),            // Cyan accent
  blue: rgb(100, 150, 255),          // Blue accent
  purple: rgb(200, 100, 255),        // Purple accent
};

// ═══════════════════════════════════════════════════════════════════════════
// Box Drawing Characters - Retro DOS Style
// ═══════════════════════════════════════════════════════════════════════════

const BOX = {
  // Double-line box (DOS style)
  dtl: "╔", dtr: "╗", dbl: "╚", dbr: "╝",
  dh: "═", dv: "║",
  dlt: "╠", drt: "╣", dtt: "╦", dbt: "╩",
  dcross: "╬",

  // Single-line box
  stl: "┌", str: "┐", sbl: "└", sbr: "┘",
  sh: "─", sv: "│",
  slt: "├", srt: "┤", stt: "┬", sbt: "┴",
  scross: "┼",

  // Mixed (single-double)
  sdl: "╓", sdr: "╖", sdbl: "╙", sdbr: "╜",
  dsl: "╒", dsr: "╕", dsbl: "╘", dsbr: "╛",

  // Blocks for progress
  full: "█", light: "░", medium: "▒", dark: "▓",
  half: "▌", halfR: "▐",

  // Block letter elements
  blockFull: "█",
  blockTop: "▀",
  blockBottom: "▄",
  blockLeft: "▌",
  blockRight: "▐",
};

// ═══════════════════════════════════════════════════════════════════════════
// Isometric PAI Cube - Classic ASCII Art
// ═══════════════════════════════════════════════════════════════════════════

// Isometric cube with P, A, I on visible faces
// Using only classic ASCII: @ # $ % ^ & * ( ) - _ + = [ ] { } | \ / < > , . ? ! ~
const PAI_CUBE_ASCII = [
  "          __________",
  "         /\\         \\",
  "        /  \\   @@    \\",
  "       / @@ \\  @@     \\",
  "      /  @@  \\ @@      \\",
  "     /  @@@@ \\__________\\",
  "     \\       /          /",
  "      \\  ## /   ##     /",
  "       \\## /  ####    /",
  "        \\ /  ##  ##  /",
  "         \\   ##  ## /",
  "          \\ ########/",
  "           \\  $$   /",
  "            \\ $$  /",
  "             \\$$ /",
  "              \\ /",
  "               V",
];

// Alternative simpler isometric cube
const PAI_CUBE_SIMPLE = [
  "       _______________",
  "      /\\              \\",
  "     /  \\    P         \\",
  "    /    \\              \\",
  "   /      \\______________\\",
  "   \\      /              /",
  "    \\    /      A       /",
  "     \\  /              /",
  "      \\/______I_______/",
];

// Clean isometric cube with clear letters
const PAI_CUBE = [
  "            .-------.",
  "           /   P   /|",
  "          /       / |",
  "         .-------.  |",
  "         |       |  |",
  "         |   A   | /",
  "         |       |/",
  "         '---I---'",
];

// Full ASCII art isometric PAI cube - detailed version
const PAI_LOGO_FULL = [
  "          __________________",
  "         /\\                 \\",
  "        /  \\   P  P  P       \\",
  "       /    \\  P  P  P        \\",
  "      /  P   \\ P     P         \\",
  "     /  P P   \\P  P  P          \\",
  "    /  PPPPP   \\__________________\\",
  "    \\  P        /                  /",
  "     \\ P       /    A      A      /",
  "      \\       /    A A    A A    /",
  "       \\     /    AAAAA  AAAAA  /",
  "        \\   /    A    A A    A /",
  "         \\ /____A____A_A____A_/",
  "          \\                  /",
  "           \\    I  I  I     /",
  "            \\   I  I  I    /",
  "             \\  I  I  I   /",
  "              \\ I  I  I  /",
  "               \\________/",
];

// Compact but effective isometric cube
const PAI_CUBE_COMPACT = [
  "      .=========.",
  "     /    P    /|",
  "    /   PPP   / |",
  "   /   P   P / .|",
  "  +=========+ A |",
  "  |    A    |AAA|",
  "  |   AAA   +A A/",
  "  |  A   A  | I/",
  "  |  AAAAA  |I /",
  "  |  A   A  |I/",
  "  +---------+/",
  "     I I I",
];

// The BEST isometric ASCII cube - clean and readable
const PAI_ASCII_LOGO = [
  "        ,-------.",
  "       /   P   /|",
  "      /  PPP  / |",
  "     / P   P /  |",
  "    +-------+   |",
  "    |       | A |",
  "    |  AAA  |AAA|",
  "    | A   A +--A+",
  "    | AAAAA /  /",
  "    | A   A/  /",
  "    +-----+ I /",
  "    | III |  /",
  "    | III | /",
  "    | III |/",
  "    +-----+",
];

// Simpler, wider ASCII cube for better terminal display
const PAI_CUBE_WIDE = [
  "        .============.",
  "       /      P     /|",
  "      /    P   P   / |",
  "     /   PPPPPPP  /  |",
  "    /    P     P /   |",
  "   +=============+   |",
  "   |             | A |",
  "   |      A      |A A|",
  "   |     A A     +---+",
  "   |    AAAAA   /   /",
  "   |   A     A /   /",
  "   +----------+   /",
  "   |    III   |  /",
  "   |    III   | /",
  "   |    III   |/",
  "   +----------+",
];

// ═══════════════════════════════════════════════════════════════════════════
// Block Letter KAI (using block characters)
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_KAI = [
  "█  █  █████  █████",
  "█ █   █   █    █  ",
  "██    █████    █  ",
  "█ █   █   █    █  ",
  "█  █  █   █  █████",
];

// Smaller block KAI
const BLOCK_KAI_SMALL = [
  "█▀▄  ▄▀█  █",
  "█▀▄  █▀█  █",
  "▀ ▀  ▀ ▀  █",
];

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Stats & Identity
// ═══════════════════════════════════════════════════════════════════════════

interface SystemStats {
  name: string;
  skills: number;
  userFiles: number;
  hooks: number;
  workItems: number;
  learnings: number;
  model: string;
}

function readDAIdentity(): string {
  const settingsPath = join(CLAUDE_DIR, "settings.json");
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    return settings.daidentity?.displayName || settings.daidentity?.name || settings.env?.DA || "PAI";
  } catch {
    return "PAI";
  }
}

function countSkills(): number {
  const skillsDir = join(CLAUDE_DIR, "skills");
  if (!existsSync(skillsDir)) return 0;
  let count = 0;
  try {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(skillsDir, entry.name, "SKILL.md"))) count++;
    }
  } catch {}
  return count;
}

function countUserFiles(): number {
  const userDir = join(CLAUDE_DIR, "PAI/USER");
  if (!existsSync(userDir)) return 0;
  let count = 0;
  const countRecursive = (dir: string) => {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) countRecursive(join(dir, entry.name));
        else if (entry.isFile()) count++;
      }
    } catch {}
  };
  countRecursive(userDir);
  return count;
}

function countHooks(): number {
  const hooksDir = join(CLAUDE_DIR, "hooks");
  if (!existsSync(hooksDir)) return 0;
  let count = 0;
  try {
    for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".ts")) count++;
    }
  } catch {}
  return count;
}

function countWorkItems(): number {
  const workDir = join(CLAUDE_DIR, "MEMORY/WORK");
  if (!existsSync(workDir)) return 0;
  try {
    return readdirSync(workDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

function countLearnings(): number {
  const learningDir = join(CLAUDE_DIR, "MEMORY/LEARNING");
  if (!existsSync(learningDir)) return 0;
  let count = 0;
  const countRecursive = (dir: string) => {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) countRecursive(join(dir, entry.name));
        else if (entry.isFile() && entry.name.endsWith(".md")) count++;
      }
    } catch {}
  };
  countRecursive(learningDir);
  return count;
}

function getStats(): SystemStats {
  return {
    name: readDAIdentity(),
    skills: countSkills(),
    userFiles: countUserFiles(),
    hooks: countHooks(),
    workItems: countWorkItems(),
    learnings: countLearnings(),
    model: "Opus 4.5",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Progress Bar Generation
// ═══════════════════════════════════════════════════════════════════════════

function generateProgressBar(width: number, fill: number = 0.7): string {
  const filled = Math.floor(width * fill);
  const empty = width - filled;
  return `[${BOX.full.repeat(filled)}${BOX.light.repeat(empty)}]`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Banner Generator - Neofetch Style Layout
// ═══════════════════════════════════════════════════════════════════════════

function createRetroBanner(): string {
  const width = getTerminalWidth();
  const stats = getStats();

  const g = COLORS.greenBright;
  const gn = COLORS.greenNormal;
  const gd = COLORS.greenDim;
  const a = COLORS.amberBright;
  const f = COLORS.frame;
  const h = COLORS.highlight;
  const c = COLORS.cyan;
  const b = COLORS.blue;
  const p = COLORS.purple;

  const lines: string[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // TOP SECTION: ASCII Logo (left) + System Stats (right)
  // ─────────────────────────────────────────────────────────────────────────

  // Use the wide cube for main display
  const logo = PAI_CUBE_WIDE;
  const logoWidth = 18; // Visual width of logo
  const gap = 4;

  // System stats box content
  const statsBox = [
    `${f}${BOX.stl}${BOX.sh.repeat(24)}${BOX.str}${RESET}`,
    `${f}${BOX.sv}${RESET} ${g}DA${RESET}${gd}..........${RESET}: ${h}${stats.name.padEnd(8)}${RESET} ${f}${BOX.sv}${RESET}`,
    `${f}${BOX.sv}${RESET} ${g}Skills${RESET}${gd}......${RESET}: ${h}${String(stats.skills).padEnd(8)}${RESET} ${f}${BOX.sv}${RESET}`,
    `${f}${BOX.sv}${RESET} ${g}Hooks${RESET}${gd}.......${RESET}: ${h}${String(stats.hooks).padEnd(8)}${RESET} ${f}${BOX.sv}${RESET}`,
    `${f}${BOX.sv}${RESET} ${g}Work Items${RESET}${gd}..${RESET}: ${h}${(stats.workItems > 100 ? "100+" : String(stats.workItems)).padEnd(8)}${RESET} ${f}${BOX.sv}${RESET}`,
    `${f}${BOX.sv}${RESET} ${g}Learnings${RESET}${gd}...${RESET}: ${h}${String(stats.learnings).padEnd(8)}${RESET} ${f}${BOX.sv}${RESET}`,
    `${f}${BOX.sv}${RESET} ${g}User Files${RESET}${gd}..${RESET}: ${h}${String(stats.userFiles).padEnd(8)}${RESET} ${f}${BOX.sv}${RESET}`,
    `${f}${BOX.sv}${RESET} ${g}Model${RESET}${gd}.......${RESET}: ${h}${stats.model.padEnd(8)}${RESET} ${f}${BOX.sv}${RESET}`,
    `${f}${BOX.sbl}${BOX.sh.repeat(24)}${BOX.sbr}${RESET}`,
  ];

  // Combine logo and stats side by side
  const maxRows = Math.max(logo.length, statsBox.length);
  const logoOffset = 2; // Start stats 2 rows down from logo start

  for (let i = 0; i < maxRows; i++) {
    // Logo part (colored)
    let logoPart = "";
    if (i < logo.length) {
      // Color the logo with gradient
      const logoLine = logo[i];
      if (i < 5) {
        logoPart = `${c}${logoLine}${RESET}`;
      } else if (i < 11) {
        logoPart = `${b}${logoLine}${RESET}`;
      } else {
        logoPart = `${p}${logoLine}${RESET}`;
      }
      // Pad to consistent width
      logoPart += " ".repeat(Math.max(0, logoWidth - logoLine.length));
    } else {
      logoPart = " ".repeat(logoWidth);
    }

    // Stats part (starts with offset)
    const statsIndex = i - logoOffset;
    let statsPart = "";
    if (statsIndex >= 0 && statsIndex < statsBox.length) {
      statsPart = statsBox[statsIndex];
    }

    lines.push(logoPart + " ".repeat(gap) + statsPart);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEPARATOR
  // ─────────────────────────────────────────────────────────────────────────
  lines.push("");

  // ─────────────────────────────────────────────────────────────────────────
  // MIDDLE SECTION: Double-line box with branding
  // ─────────────────────────────────────────────────────────────────────────
  const brandingText = "  PAI | Personal AI Infrastructure  ";
  const brandingWidth = brandingText.length + 2;

  lines.push(`${a}${BOX.dtl}${BOX.dh.repeat(brandingWidth)}${BOX.dtr}${RESET}`);
  lines.push(`${a}${BOX.dv}${RESET} ${g}${BOLD}PAI${RESET} ${gd}|${RESET} ${h}Personal AI Infrastructure${RESET}  ${a}${BOX.dv}${RESET}`);
  lines.push(`${a}${BOX.dbl}${BOX.dh.repeat(brandingWidth)}${BOX.dbr}${RESET}`);

  // ─────────────────────────────────────────────────────────────────────────
  // QUOTE SECTION
  // ─────────────────────────────────────────────────────────────────────────
  lines.push("");
  lines.push(`  ${gd}"${RESET}${g}Magnifying human capabilities through intelligent assistance${RESET}${gd}"${RESET}`);

  // ─────────────────────────────────────────────────────────────────────────
  // PROGRESS BAR
  // ─────────────────────────────────────────────────────────────────────────
  lines.push("");
  const progress = generateProgressBar(24, 0.75);
  lines.push(`  ${gd}System Status:${RESET} ${g}${progress}${RESET} ${h}75%${RESET}`);

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCK LETTER KAI
  // ─────────────────────────────────────────────────────────────────────────
  lines.push("");
  for (const row of BLOCK_KAI_SMALL) {
    lines.push(`    ${c}${row}${RESET}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GITHUB URL
  // ─────────────────────────────────────────────────────────────────────────
  lines.push("");
  lines.push(`  ${gd}${BOX.sh.repeat(40)}${RESET}`);
  lines.push(`  ${g}>${RESET} ${h}github.com/danielmiessler/PAI${RESET}${BLINK}_${RESET}`);
  lines.push(`  ${gd}${BOX.sh.repeat(40)}${RESET}`);

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// Alternative: Pure Classic ASCII Version (no unicode boxes)
// ═══════════════════════════════════════════════════════════════════════════

function createPureASCIIBanner(): string {
  const stats = getStats();

  const g = COLORS.greenBright;
  const gn = COLORS.greenNormal;
  const gd = COLORS.greenDim;
  const h = COLORS.highlight;
  const c = COLORS.cyan;
  const b = COLORS.blue;
  const p = COLORS.purple;

  const lines: string[] = [];

  // Pure ASCII isometric cube
  const logo = [
    "        .=========.",
    "       /    P    /|",
    "      /   PPP   / |",
    "     /  P   P  / .|",
    "    +=========+ A |",
    "    |    A    |AAA|",
    "    |   AAA   +A-A+",
    "    |  A   A  | I/",
    "    |  AAAAA  |I /",
    "    |  A   A  |I/",
    "    +---------+/",
    "       I I I",
  ];

  // Stats in ASCII box - dynamically pad DA name to fit
  const DA_NAME = stats.name.substring(0, 10).padEnd(10);
  const statsBox = [
    "+------------------------+",
    `| DA.........: ${DA_NAME} |`,
    "| Skills.....: " + String(stats.skills).padEnd(10) + " |",
    "| Hooks......: " + String(stats.hooks).padEnd(10) + " |",
    "| Work Items.: " + (stats.workItems > 100 ? "100+" : String(stats.workItems)).padEnd(10) + " |",
    "| Learnings..: " + String(stats.learnings).padEnd(10) + " |",
    "| User Files.: " + String(stats.userFiles).padEnd(10) + " |",
    "| Model......: " + stats.model.padEnd(10) + " |",
    "+------------------------+",
  ];

  // Combine logo and stats
  const logoWidth = 20;
  const gap = 4;
  const maxRows = Math.max(logo.length, statsBox.length);
  const logoOffset = 1;

  for (let i = 0; i < maxRows; i++) {
    let logoPart = "";
    if (i < logo.length) {
      const logoLine = logo[i];
      // Color gradient
      if (i < 4) {
        logoPart = `${c}${logoLine}${RESET}`;
      } else if (i < 8) {
        logoPart = `${b}${logoLine}${RESET}`;
      } else {
        logoPart = `${p}${logoLine}${RESET}`;
      }
      logoPart += " ".repeat(Math.max(0, logoWidth - logoLine.length));
    } else {
      logoPart = " ".repeat(logoWidth);
    }

    const statsIndex = i - logoOffset;
    let statsPart = "";
    if (statsIndex >= 0 && statsIndex < statsBox.length) {
      statsPart = `${g}${statsBox[statsIndex]}${RESET}`;
    }

    lines.push(logoPart + " ".repeat(gap) + statsPart);
  }

  lines.push("");

  // Double-line title (ASCII approximation)
  lines.push(`${gd}+======================================+${RESET}`);
  lines.push(`${gd}||${RESET}  ${g}PAI${RESET} ${gd}|${RESET} ${h}Personal AI Infrastructure${RESET}  ${gd}||${RESET}`);
  lines.push(`${gd}+======================================+${RESET}`);

  lines.push("");
  lines.push(`  ${gd}"${RESET}${g}Magnifying human capabilities...${RESET}${gd}"${RESET}`);

  lines.push("");
  lines.push(`  ${gd}Status:${RESET} ${g}[########....] 75%${RESET}`);

  lines.push("");
  // Simple block KAI
  lines.push(`    ${c}#  # ### ###${RESET}`);
  lines.push(`    ${c}# #  ### ###${RESET}`);
  lines.push(`    ${c}##   # # ###${RESET}`);
  lines.push(`    ${c}# #  ### ###${RESET}`);
  lines.push(`    ${c}#  # # # ###${RESET}`);

  lines.push("");
  lines.push(`  ${gd}----------------------------------------${RESET}`);
  lines.push(`  ${g}>${RESET} ${h}github.com/danielmiessler/PAI${RESET}${g}_${RESET}`);
  lines.push(`  ${gd}----------------------------------------${RESET}`);

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// Compact Retro Banner (for narrower terminals)
// ═══════════════════════════════════════════════════════════════════════════

function createCompactRetroBanner(): string {
  const stats = getStats();

  const g = COLORS.greenBright;
  const gd = COLORS.greenDim;
  const h = COLORS.highlight;
  const c = COLORS.cyan;

  const lines: string[] = [];

  // Simple cube
  const logo = [
    "   .---.",
    "  / P /|",
    " +---+ |",
    " | A | +",
    " +---+/",
    "   I",
  ];

  // Minimal stats
  const statsLines = [
    `${g}DA${gd}:${RESET} ${h}${stats.name}${RESET}`,
    `${g}Skills${gd}:${RESET} ${h}${stats.skills}${RESET}`,
    `${g}Model${gd}:${RESET} ${h}${stats.model}${RESET}`,
  ];

  for (let i = 0; i < logo.length; i++) {
    let part = `${c}${logo[i]}${RESET}`;
    part += " ".repeat(Math.max(0, 10 - logo[i].length));
    if (i > 0 && i <= statsLines.length) {
      part += " " + statsLines[i - 1];
    }
    lines.push(part);
  }

  lines.push("");
  lines.push(`${g}PAI${RESET} ${gd}|${RESET} ${h}Personal AI Infrastructure${RESET}`);
  lines.push(`${gd}> github.com/danielmiessler/PAI${RESET}`);

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

type BannerMode = "retro" | "ascii" | "compact";

function createBanner(mode: BannerMode = "retro"): string {
  switch (mode) {
    case "ascii":
      return createPureASCIIBanner();
    case "compact":
      return createCompactRetroBanner();
    case "retro":
    default:
      return createRetroBanner();
  }
}

// CLI args
const args = process.argv.slice(2);
const testMode = args.includes("--test");
const modeArg = args.find(a => a.startsWith("--mode="))?.split("=")[1] as BannerMode | undefined;

try {
  if (testMode) {
    const modes: BannerMode[] = ["retro", "ascii", "compact"];
    for (const mode of modes) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`  MODE: ${mode.toUpperCase()}`);
      console.log(`${"=".repeat(60)}\n`);
      console.log(createBanner(mode));
    }
  } else {
    console.log();
    console.log(createBanner(modeArg || "retro"));
    console.log();
  }
} catch (e) {
  console.error("Banner error:", e);
}
