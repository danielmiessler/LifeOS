#!/usr/bin/env bun

/**
 * NeofetchBanner - PAI System Banner in Neofetch Style
 *
 * Layout:
 *   LEFT:   Isometric PAI cube logo (ASCII/Braille art)
 *   RIGHT:  System stats as key-value pairs
 *   BOTTOM: PAI header, quote, sentiment histogram, PAI name, GitHub URL
 *
 * Aesthetic: Cyberpunk/hacker with Tokyo Night colors
 *   - Hex addresses (0x7A2F)
 *   - Binary streams
 *   - Targeting reticle elements
 *   - Neon glow feel
 */

import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const HOME = process.env.HOME!;
const CLAUDE_DIR = join(HOME, ".claude");

// ═══════════════════════════════════════════════════════════════════════
// Terminal Width Detection
// ═══════════════════════════════════════════════════════════════════════

type DisplayMode = "compact" | "normal" | "wide";

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
    width = parseInt(process.env.COLUMNS || "100") || 100;
  }

  return width;
}

function getDisplayMode(): DisplayMode {
  const width = getTerminalWidth();
  if (width < 80) return "compact";
  if (width < 120) return "normal";
  return "wide";
}

// ═══════════════════════════════════════════════════════════════════════
// ANSI & Tokyo Night Color System
// ═══════════════════════════════════════════════════════════════════════

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ITALIC = "\x1b[3m";

const rgb = (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`;
const bgRgb = (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`;

// Tokyo Night Storm palette
const COLORS = {
  // Primary brand colors
  blue: rgb(122, 162, 247),       // #7aa2f7
  magenta: rgb(187, 154, 247),    // #bb9af7
  cyan: rgb(125, 207, 255),       // #7dcfff

  // Neon variants
  neonCyan: rgb(0, 255, 255),     // Pure cyan glow
  neonPurple: rgb(180, 100, 255), // Bright purple
  neonPink: rgb(255, 100, 200),   // Hot pink

  // Semantic colors
  green: rgb(158, 206, 106),      // #9ece6a
  orange: rgb(255, 158, 100),     // #ff9e64
  red: rgb(247, 118, 142),        // #f7768e
  yellow: rgb(224, 175, 104),     // #e0af68

  // UI colors
  frame: rgb(59, 66, 97),         // #3b4261
  text: rgb(169, 177, 214),       // #a9b1d6
  subtext: rgb(86, 95, 137),      // #565f89
  bright: rgb(192, 202, 245),     // #c0caf5
  dark: rgb(36, 40, 59),          // #24283b

  // Teal accent
  teal: rgb(45, 130, 130),        // Dark teal for URLs
};

// ═══════════════════════════════════════════════════════════════════════
// Unicode Elements
// ═══════════════════════════════════════════════════════════════════════

const RETICLE = {
  topLeft: "\u231C",     // Top-left corner bracket
  topRight: "\u231D",    // Top-right corner bracket
  bottomLeft: "\u231E",  // Bottom-left corner bracket
  bottomRight: "\u231F", // Bottom-right corner bracket
  crosshair: "\u25CE",   // Bullseye
  target: "\u25C9",      // Fisheye
};

const BOX = {
  horizontal: "\u2500",
  vertical: "\u2502",
  topLeft: "\u256D",
  topRight: "\u256E",
  bottomLeft: "\u2570",
  bottomRight: "\u256F",
  leftT: "\u251C",
  rightT: "\u2524",
  cross: "\u253C",
};

// Sparkline characters for sentiment histogram
const SPARK = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];

// ═══════════════════════════════════════════════════════════════════════
// PAI Isometric Cube Logo - ASCII Art with P, A, I on faces
// ═══════════════════════════════════════════════════════════════════════

// Large isometric cube with letters on three visible faces
// Using block characters and line drawing for the cube structure
const PAI_CUBE_LOGO = [
  "              \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
  "             \u2571              \u2571\u2502",
  "            \u2571   \u2588\u2588\u2588\u2588\u2588     \u2571 \u2502",
  "           \u2571    \u2588   \u2588   \u2571  \u2502",
  "          \u2571     \u2588\u2588\u2588\u2588\u2588  \u2571   \u2502",
  "         \u2571      \u2588     \u2571    \u2502",
  "        \u2571       \u2588    \u2571     \u2502",
  "       \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518     \u2502",
  "       \u2502              \u2502     \u2502",
  "       \u2502   \u2588\u2588\u2588\u2588\u2588     \u2502     \u2502",
  "       \u2502   \u2588   \u2588     \u2502    \u2571",
  "       \u2502   \u2588\u2588\u2588\u2588\u2588     \u2502   \u2571",
  "       \u2502   \u2588   \u2588     \u2502  \u2571",
  "       \u2502   \u2588   \u2588     \u2502 \u2571",
  "       \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\u2571",
];

// Isometric PAI cube using box drawing and blocks
// Shows P on top, A on front, I on right side
const PAI_CUBE_ASCII = [
  "         ╭───────────╮",
  "        ╱     P     ╱│",
  "       ╱───────────╱ │",
  "      ╱           ╱  │",
  "     ╭───────────╮   │",
  "     │     A     │   I",
  "     │           │  ╱",
  "     │           │ ╱",
  "     ╰───────────╯╱",
];

// Enhanced braille-based PAI logo for smaller terminals
const PAI_BRAILLE_LOGO = [
  "⣿⣿⣿⣛⣛⣛⣿⣿⣿⣿⣛⣛⣛⣛⣿⣿",
  "⣿⣿⣛⣛⣿⣿⣛⣿⣿⣛⣛⣿⣿⣿⣛⣿",
  "⣿⣛⣛⣿⣿⣿⣿⣛⣛⣿⣿⣿⣿⣿⣛⣛",
  "⣛⣛⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣛",
  "⣛⣿⣿⣿⣛⣛⣛⣿⣿⣿⣿⣛⣛⣿⣿⣛",
  "⣛⣿⣛⣛⣿⣿⣛⣿⣿⣛⣛⣿⣿⣛⣿⣛",
  "⣛⣛⣿⣿⣿⣿⣿⣛⣛⣿⣿⣿⣿⣿⣿⣛",
  "⣿⣿⣛⣛⣛⣿⣿⣿⣿⣿⣛⣛⣛⣿⣿⣿",
];

// Alternative minimal cube using Unicode box drawing
const PAI_MINIMAL_CUBE = [
  "    \u256D\u2500\u2500\u2500\u2500\u2500\u256E",
  "   \u2571P \u25C6 A\u2571\u2502",
  "  \u2571\u2500\u2500\u2500\u2500\u2500\u2500\u2571 \u2502",
  "  \u2502  I   \u2502 \u2502",
  "  \u2502 \u25C6\u25C7\u25C6  \u2502\u2571",
  "  \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u256F",
];

// High-quality isometric cube using block elements
const PAI_BLOCK_CUBE = [
  "         \u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584",
  "       \u2584\u2588\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2580\u2588\u2584",
  "     \u2584\u2588\u2580  \u2588\u2588\u2588\u2588\u2588\u2588   \u2588\u2580\u2584",
  "   \u2584\u2588\u2580    \u2588\u2588  \u2588\u2588    \u2588\u2580\u2584",
  " \u2584\u2588\u2580      \u2588\u2588\u2588\u2588\u2588\u2588      \u2588\u2580\u2584",
  " \u2588        \u2588\u2588          \u2588  \u2588",
  " \u2588        \u2588\u2588          \u2588  \u2588",
  " \u2588\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2588  \u2588",
  " \u2588                    \u2588  \u2588",
  " \u2588   \u2588\u2588\u2588\u2588\u2588    \u2588   \u2588   \u2588 \u2571",
  " \u2588   \u2588   \u2588   \u2588   \u2588   \u2588\u2571",
  " \u2588   \u2588\u2588\u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588   \u2588",
  " \u2588   \u2588   \u2588   \u2588   \u2588   \u2588",
  " \u2588   \u2588   \u2588   \u2588   \u2588   \u2588",
  " \u2580\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2584\u2580",
];

// Cleaner isometric cube for the banner
const PAI_ISOMETRIC = [
  "        \u2571\u2572",
  "       \u2571P \u2572",
  "      \u2571    \u2572",
  "     \u2571\u2500\u2500\u2500\u2500\u2500\u2500\u2572",
  "    \u2502      \u2502\u2572",
  "   A\u2502  PAI \u2502 I",
  "    \u2502      \u2502\u2571",
  "     \u2572\u2500\u2500\u2500\u2500\u2500\u2500\u2571",
  "      \u2572    \u2571",
  "       \u2572  \u2571",
  "        \u2572\u2571",
];

// Final version - clean isometric cube with letters on visible faces
const LOGO_LINES = [
  "          .---.---.---.---.",
  "         /   /   /   /   /|",
  "        .---.---.---.---. |",
  "       /   / P /   /   /| |",
  "      .---.---.---.---. |/|",
  "     /   /   /   /   /| | |",
  "    .---.---.---.---. |/|/|",
  "    | A |   |   |   | | | |",
  "    |   |   |   |   |/|/|/",
  "    .---.---.---.---. |/",
  "    | I |   |   |   |/",
  "    .---.---.---.---.",
];

// Simple elegant cube logo
const CUBE_LOGO = [
  "      \u2571\u2572          ",
  "     \u2571  \u2572         ",
  "    \u2571 P  \u2572        ",
  "   \u2571\u2500\u2500\u2500\u2500\u2500\u2500\u2572       ",
  "   \u2502      \u2502\u2572      ",
  "   \u2502  A   \u2502 \u2572     ",
  "   \u2502      \u2502  I    ",
  "   \u2502      \u2502 \u2571     ",
  "   \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u256F\u2571      ",
];

// ═══════════════════════════════════════════════════════════════════════
// PAI Block Letters (5 rows)
// ═══════════════════════════════════════════════════════════════════════

const LETTERS: Record<string, string[]> = {
  P: [
    "\u2588\u2588\u2588\u2588\u2588\u2588\u2557 ",
    "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557",
    "\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D",
    "\u2588\u2588\u2554\u2550\u2550\u2550\u255D ",
    "\u2588\u2588\u2551    ",
  ],
  A: [
    " \u2588\u2588\u2588\u2588\u2588\u2557 ",
    "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557",
    "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551",
    "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551",
    "\u2588\u2588\u2551  \u2588\u2588\u2551",
  ],
  I: [
    "\u2588\u2588\u2557",
    "\u2588\u2588\u2551",
    "\u2588\u2588\u2551",
    "\u2588\u2588\u2551",
    "\u2588\u2588\u2551",
  ],
  " ": ["   ", "   ", "   ", "   ", "   "],
};

// ═══════════════════════════════════════════════════════════════════════
// Dynamic Stats Collection
// ═══════════════════════════════════════════════════════════════════════

interface SystemStats {
  DA_NAME: string;
  skills: number;
  hooks: number;
  workItems: string;
  learnings: number;
  userFiles: number;
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

function countWorkItems(): string {
  const workDir = join(CLAUDE_DIR, "MEMORY", "WORK");
  if (!existsSync(workDir)) return "0";
  let count = 0;
  try {
    for (const entry of readdirSync(workDir, { withFileTypes: true })) {
      if (entry.isDirectory()) count++;
    }
  } catch {}
  return count > 100 ? "100+" : String(count);
}

function countLearnings(): number {
  const learningsDir = join(CLAUDE_DIR, "MEMORY", "LEARNING");
  if (!existsSync(learningsDir)) return 0;
  let count = 0;
  const countRecursive = (dir: string) => {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) countRecursive(join(dir, entry.name));
        else if (entry.isFile() && entry.name.endsWith(".md")) count++;
      }
    } catch {}
  };
  countRecursive(learningsDir);
  return count;
}

function countUserFiles(): number {
  const userDir = join(CLAUDE_DIR, "skills/PAI/USER");
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

function getStats(): SystemStats {
  return {
    DA_NAME: readDAIdentity(),
    skills: countSkills(),
    hooks: countHooks(),
    workItems: countWorkItems(),
    learnings: countLearnings(),
    userFiles: countUserFiles(),
    model: "Opus 4.5",
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════

function randomHex(len: number = 4): string {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join("");
}

function generateSentimentHistogram(): string {
  // Generate a sample sentiment histogram (could read from actual data)
  // Bias towards higher values for positive sentiment visualization
  const weights = [1, 2, 3, 4, 6, 8, 10, 8]; // More weight to higher bars
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let result = "";
  for (let i = 0; i < 16; i++) {
    // Weighted random selection biased towards higher values
    let rand = Math.random() * totalWeight;
    let idx = 0;
    for (let j = 0; j < weights.length; j++) {
      rand -= weights[j];
      if (rand <= 0) {
        idx = j;
        break;
      }
    }
    result += SPARK[idx];
  }
  return result;
}

function generateBinary(len: number = 8): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 2).toString()).join("");
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

function padRight(str: string, len: number): string {
  const visible = visibleLength(str);
  return str + " ".repeat(Math.max(0, len - visible));
}

function padLeft(str: string, len: number): string {
  const visible = visibleLength(str);
  return " ".repeat(Math.max(0, len - visible)) + str;
}

function center(str: string, width: number): string {
  const visible = visibleLength(str);
  const leftPad = Math.floor((width - visible) / 2);
  const rightPad = width - visible - leftPad;
  return " ".repeat(Math.max(0, leftPad)) + str + " ".repeat(Math.max(0, rightPad));
}

// ═══════════════════════════════════════════════════════════════════════
// Generate PAI ASCII Art
// ═══════════════════════════════════════════════════════════════════════

function generatePaiArt(): string[] {
  const name = "PAI";
  const letterColors = [COLORS.blue, COLORS.magenta, COLORS.cyan];
  const rows: string[] = ["", "", "", "", ""];

  for (let charIdx = 0; charIdx < name.length; charIdx++) {
    const char = name[charIdx];
    const letterArt = LETTERS[char] || LETTERS[" "];
    const color = letterColors[charIdx % letterColors.length];

    for (let row = 0; row < 5; row++) {
      rows[row] += `${BOLD}${color}${letterArt[row]}${RESET} `;
    }
  }

  return rows.map(r => r.trimEnd());
}

// ═══════════════════════════════════════════════════════════════════════
// PAI Cube Logo with Gradient Coloring
// ═══════════════════════════════════════════════════════════════════════

function colorLogo(lines: string[]): string[] {
  const b = COLORS.blue;
  const m = COLORS.magenta;
  const c = COLORS.cyan;
  const f = COLORS.frame;
  const nc = COLORS.neonCyan;
  const np = COLORS.neonPurple;

  return lines.map((line) => {
    // Color the letters P, A, I distinctly
    let colored = line;

    // Color P in neon cyan (on top face)
    colored = colored.replace(/P/, `${RESET}${BOLD}${nc}P${RESET}${b}`);

    // Color A in neon purple (on front face)
    colored = colored.replace(/A/, `${RESET}${BOLD}${np}A${RESET}${c}`);

    // Color I in cyan (on right face)
    colored = colored.replace(/I/, `${RESET}${BOLD}${c}I${RESET}${m}`);

    // Wrap line with base color for structure
    return `${f}${colored}${RESET}`;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Main Banner Generator
// ═══════════════════════════════════════════════════════════════════════

function createNeofetchBanner(): string {
  const width = getTerminalWidth();
  const stats = getStats();
  const mode = getDisplayMode();

  const f = COLORS.frame;
  const s = COLORS.subtext;
  const t = COLORS.text;
  const b = COLORS.blue;
  const m = COLORS.magenta;
  const c = COLORS.cyan;
  const g = COLORS.green;
  const o = COLORS.orange;
  const y = COLORS.yellow;
  const nc = COLORS.neonCyan;
  const np = COLORS.neonPurple;
  const tl = COLORS.teal;

  const lines: string[] = [];

  // Generate hex addresses for cyberpunk feel
  const hex1 = randomHex(4);
  const hex2 = randomHex(4);
  const hex3 = randomHex(4);
  const hex4 = randomHex(4);
  const binary1 = generateBinary(8);
  const binary2 = generateBinary(8);

  // ─────────────────────────────────────────────────────────────────
  // TOP BORDER with targeting reticles and hex
  // ─────────────────────────────────────────────────────────────────
  const topBorder = `${f}${RETICLE.topLeft}${RESET} ${s}0x${hex1}${RESET} ${f}${BOX.horizontal.repeat(width - 24)}${RESET} ${s}0x${hex2}${RESET} ${f}${RETICLE.topRight}${RESET}`;
  lines.push(topBorder);
  lines.push("");

  // ─────────────────────────────────────────────────────────────────
  // LEFT: PAI Logo | RIGHT: System Stats
  // ─────────────────────────────────────────────────────────────────

  // Use ASCII cube logo for clear rendering with P, A, I visible
  const logo = colorLogo(PAI_CUBE_ASCII);
  const logoWidth = 26; // Logo column width (includes cube width + padding)
  const statsGap = 2;   // Gap between logo and stats

  // Stats formatted as key-value pairs
  const statItems = [
    { key: "DA Name", value: stats.DA_NAME, color: nc },
    { key: "Skills", value: String(stats.skills), color: g },
    { key: "Hooks", value: String(stats.hooks), color: c },
    { key: "Work Items", value: stats.workItems, color: o },
    { key: "Learnings", value: String(stats.learnings), color: m },
    { key: "User Files", value: String(stats.userFiles), color: b },
    { key: "Model", value: stats.model, color: np },
  ];

  // Build side-by-side layout
  const maxStatRows = Math.max(logo.length, statItems.length);
  const logoOffset = Math.floor((maxStatRows - logo.length) / 2);
  const statsOffset = Math.floor((maxStatRows - statItems.length) / 2);

  for (let i = 0; i < maxStatRows; i++) {
    const logoIdx = i - logoOffset;
    const statsIdx = i - statsOffset;

    // Logo part (or padding)
    let logoLine = " ".repeat(logoWidth);
    if (logoIdx >= 0 && logoIdx < logo.length) {
      logoLine = padRight(logo[logoIdx], logoWidth);
    }

    // Stats part (or padding)
    let statsLine = "";
    if (statsIdx >= 0 && statsIdx < statItems.length) {
      const stat = statItems[statsIdx];
      statsLine = `${s}${stat.key}:${RESET} ${BOLD}${stat.color}${stat.value}${RESET}`;
    }

    lines.push(`  ${logoLine}${" ".repeat(statsGap)}${statsLine}`);
  }

  lines.push("");

  // ─────────────────────────────────────────────────────────────────
  // DIVIDER with binary streams
  // ─────────────────────────────────────────────────────────────────
  const dividerWidth = Math.min(width - 4, 80);
  const dividerPad = Math.floor((width - dividerWidth) / 2);
  const dividerHalf = Math.floor((dividerWidth - 16) / 2);
  const divider = `${" ".repeat(dividerPad)}${s}${binary1}${RESET}${f}${BOX.horizontal.repeat(dividerHalf)}${c}${BOX.cross}${RESET}${f}${BOX.horizontal.repeat(dividerHalf)}${RESET}${s}${binary2}${RESET}`;
  lines.push(divider);
  lines.push("");

  // ─────────────────────────────────────────────────────────────────
  // BOTTOM SECTION
  // ─────────────────────────────────────────────────────────────────

  // PAI Header
  const paiHeader = `${BOLD}${nc}P${RESET}${BOLD}${np}A${RESET}${BOLD}${c}I${RESET} ${f}|${RESET} ${t}Personal AI Infrastructure${RESET}`;
  lines.push(center(paiHeader, width));
  lines.push("");

  // Quote
  const quote = `${s}"Magnifying human capabilities..."${RESET}`;
  lines.push(center(quote, width));
  lines.push("");

  // Sentiment Histogram
  const histogram = generateSentimentHistogram();
  const histogramLine = `${s}Sentiment:${RESET} ${o}${histogram}${RESET}`;
  lines.push(center(histogramLine, width));
  lines.push("");

  // PAI ASCII Art
  const paiArt = generatePaiArt();
  for (const row of paiArt) {
    lines.push(center(row, width));
  }
  lines.push("");

  // GitHub URL with targeting reticle
  const githubUrl = `${f}${RETICLE.topLeft}${RESET} ${tl}github.com/danielmiessler/PAI${RESET} ${f}${RETICLE.topRight}${RESET}`;
  lines.push(center(githubUrl, width));

  // ─────────────────────────────────────────────────────────────────
  // BOTTOM BORDER
  // ─────────────────────────────────────────────────────────────────
  lines.push("");
  const bottomBorder = `${f}${RETICLE.bottomLeft}${RESET} ${s}0x${hex3}${RESET} ${f}${BOX.horizontal.repeat(width - 24)}${RESET} ${s}0x${hex4}${RESET} ${f}${RETICLE.bottomRight}${RESET}`;
  lines.push(bottomBorder);

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// Compact Banner for Narrow Terminals
// ═══════════════════════════════════════════════════════════════════════

function createCompactBanner(): string {
  const stats = getStats();
  const f = COLORS.frame;
  const s = COLORS.subtext;
  const c = COLORS.cyan;
  const m = COLORS.magenta;
  const b = COLORS.blue;
  const g = COLORS.green;
  const nc = COLORS.neonCyan;

  const hex = randomHex(4);
  const spark = generateSentimentHistogram().slice(0, 8);

  const lines: string[] = [];

  lines.push(`${f}${RETICLE.topLeft}${s}0x${hex}${f}${RETICLE.topRight}${RESET}`);
  lines.push(`${nc}${RETICLE.crosshair}${RESET} ${BOLD}${b}P${m}A${c}I${RESET} ${g}${RETICLE.target}${RESET}`);
  lines.push(`${s}Skills:${g}${stats.skills}${RESET} ${s}Hooks:${c}${stats.hooks}${RESET}`);
  lines.push(`${s}${spark}${RESET}`);
  lines.push(`${f}${RETICLE.bottomLeft}${s}PAI${f}${RETICLE.bottomRight}${RESET}`);

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const mode = getDisplayMode();

  const testMode = args.includes("--test");
  const compactMode = args.includes("--compact") || mode === "compact";

  try {
    if (testMode) {
      console.log("\n=== COMPACT MODE ===\n");
      console.log(createCompactBanner());
      console.log("\n=== NORMAL MODE ===\n");
      console.log(createNeofetchBanner());
    } else if (compactMode) {
      console.log(createCompactBanner());
    } else {
      console.log();
      console.log(createNeofetchBanner());
      console.log();
    }
  } catch (e) {
    console.error("Banner error:", e);
  }
}

main();
