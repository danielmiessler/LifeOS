#!/usr/bin/env bun

/**
 * BannerMatrix - Matrix Digital Rain PAI Banner
 * Neofetch-style layout with The Matrix aesthetic
 *
 * Design:
 *   LEFT:  PAI logo emerging from Matrix rain (Katakana cascade)
 *   RIGHT: System stats as terminal readout
 *   BOTTOM: Glitched branding + PAI in dripping Matrix style
 *
 * Aesthetic: The Matrix / Mr. Robot
 *   - Green (#00FF00) phosphor glow
 *   - Katakana character rain
 *   - Binary/hex scattered
 *   - Glitch effects
 *   - Hacker terminal feel
 */

import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const HOME = process.env.HOME!;
const CLAUDE_DIR = process.env.PAI_DIR || join(HOME, ".claude");

// =============================================================================
// Terminal Width Detection
// =============================================================================

type DisplayMode = "nano" | "micro" | "mini" | "normal";

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

function getDisplayMode(): DisplayMode {
  const width = getTerminalWidth();
  if (width < 40) return "nano";
  if (width < 60) return "micro";
  if (width < 85) return "mini";
  return "normal";
}

// =============================================================================
// ANSI Colors - Matrix Palette
// =============================================================================

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const rgb = (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`;
const bg = (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`;

// Matrix color palette
const MATRIX = {
  // Primary green variations (phosphor glow effect)
  bright: rgb(0, 255, 0),       // #00FF00 - brightest (foreground chars)
  primary: rgb(0, 220, 0),      // #00DC00 - primary text
  mid: rgb(0, 180, 0),          // #00B400 - mid-intensity
  dim: rgb(0, 140, 0),          // #008C00 - dimmer
  dark: rgb(0, 100, 0),         // #006400 - darker
  darkest: rgb(0, 60, 0),       // #003C00 - trailing/fading

  // Accent colors
  white: rgb(255, 255, 255),    // rare bright flashes
  cyan: rgb(0, 255, 180),       // subtle cyan tint

  // Frame/structure
  frame: rgb(0, 80, 0),         // #005000 - borders
  frameDim: rgb(0, 50, 0),      // #003200 - dim borders
};

// Katakana characters for rain effect
const KATAKANA = [
  "ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ",
  "サ", "シ", "ス", "セ", "ソ", "タ", "チ", "ツ", "テ", "ト",
  "ナ", "ニ", "ヌ", "ネ", "ノ", "ハ", "ヒ", "フ", "ヘ", "ホ",
  "マ", "ミ", "ム", "メ", "モ", "ヤ", "ユ", "ヨ",
  "ラ", "リ", "ル", "レ", "ロ", "ワ", "ヲ", "ン",
  "ァ", "ィ", "ゥ", "ェ", "ォ", "ッ", "ャ", "ュ", "ョ",
  "ガ", "ギ", "グ", "ゲ", "ゴ", "ザ", "ジ", "ズ", "ゼ", "ゾ",
  "ダ", "ヂ", "ヅ", "デ", "ド", "バ", "ビ", "ブ", "ベ", "ボ",
  "パ", "ピ", "プ", "ペ", "ポ",
];

// Additional matrix characters
const MATRIX_CHARS = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  ":", ";", "<", ">", "=", "?", "@", "#", "$", "%",
  "&", "*", "+", "-", "/", "\\", "|", "^", "~",
  "A", "B", "C", "D", "E", "F",
];

// Half-width katakana for denser rain
const HALFWIDTH_KANA = [
  "ｱ", "ｲ", "ｳ", "ｴ", "ｵ", "ｶ", "ｷ", "ｸ", "ｹ", "ｺ",
  "ｻ", "ｼ", "ｽ", "ｾ", "ｿ", "ﾀ", "ﾁ", "ﾂ", "ﾃ", "ﾄ",
  "ﾅ", "ﾆ", "ﾇ", "ﾈ", "ﾉ", "ﾊ", "ﾋ", "ﾌ", "ﾍ", "ﾎ",
  "ﾏ", "ﾐ", "ﾑ", "ﾒ", "ﾓ", "ﾔ", "ﾕ", "ﾖ",
];

// =============================================================================
// Random Generators
// =============================================================================

function randomKatakana(): string {
  return KATAKANA[Math.floor(Math.random() * KATAKANA.length)];
}

function randomMatrixChar(): string {
  const pool = [...MATRIX_CHARS, ...HALFWIDTH_KANA];
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomHex(len: number = 4): string {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join("");
}

function randomBinary(len: number): string {
  return Array.from({ length: len }, () => Math.random() > 0.5 ? "1" : "0").join("");
}

// Generate a rain column with varying intensity
function generateRainColumn(height: number): string[] {
  const column: string[] = [];
  const colors = [MATRIX.bright, MATRIX.primary, MATRIX.mid, MATRIX.dim, MATRIX.dark, MATRIX.darkest];

  for (let i = 0; i < height; i++) {
    // Random intensity - brighter near "head" of rain drop
    const intensity = Math.random();
    let color: string;
    let char: string;

    if (intensity > 0.95) {
      // Bright white flash (rare)
      color = MATRIX.white;
      char = randomKatakana();
    } else if (intensity > 0.8) {
      color = MATRIX.bright;
      char = randomKatakana();
    } else if (intensity > 0.6) {
      color = MATRIX.primary;
      char = Math.random() > 0.7 ? randomKatakana() : randomMatrixChar();
    } else if (intensity > 0.4) {
      color = MATRIX.mid;
      char = Math.random() > 0.5 ? randomKatakana() : randomMatrixChar();
    } else if (intensity > 0.2) {
      color = MATRIX.dim;
      char = randomMatrixChar();
    } else {
      color = MATRIX.darkest;
      char = Math.random() > 0.5 ? " " : randomMatrixChar();
    }

    column.push(`${color}${char}${RESET}`);
  }

  return column;
}

// =============================================================================
// PAI Logo in Matrix Style (ASCII that emerges from rain)
// =============================================================================

// Large PAI letters that will "emerge" from the rain
const PAI_MATRIX_LOGO = [
  " ██████╗   █████╗  ██╗",
  " ██╔══██╗ ██╔══██╗ ██║",
  " ██████╔╝ ███████║ ██║",
  " ██╔═══╝  ██╔══██║ ██║",
  " ██║      ██║  ██║ ██║",
  " ╚═╝      ╚═╝  ╚═╝ ╚═╝",
];

// Dripping/melting PAI effect
const PAI_DRIP = [
  "██████╗  █████╗ ██╗",
  "██╔══██╗██╔══██╗██║",
  "██████╔╝███████║██║",
  "██╔═══╝ ██╔══██║██║",
  "██║     ██║  ██║██║",
  "╚═╝     ╚═╝  ╚═╝╚═╝",
  " ░       ░    ░  ░ ",
  "  ▒       ▒    ▒   ",
  "   ▓       ▓       ",
];

// Compact PAI logo for smaller modes
const PAI_COMPACT = [
  "┌───┐┌───┐┌─┐",
  "│ ┌─┘│ ┌─┤│ │",
  "│ │  │ ├─┤│ │",
  "└─┘  └─┘ ┘└─┘",
];

// =============================================================================
// Dynamic Stats Collection
// =============================================================================

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
  const workDir = join(CLAUDE_DIR, "MEMORY", "WORK");
  if (!existsSync(workDir)) return 0;
  let count = 0;
  try {
    for (const entry of readdirSync(workDir, { withFileTypes: true })) {
      if (entry.isDirectory()) count++;
    }
  } catch {}
  return count > 100 ? "100+" as any : count;
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

// =============================================================================
// Glitch Text Effects
// =============================================================================

function glitchText(text: string): string {
  // Add random glitch characters around/in the text
  const glitchChars = ["░", "▒", "▓", "█", "▄", "▀", "■", "□"];
  let result = "";

  for (let i = 0; i < text.length; i++) {
    if (Math.random() > 0.9) {
      // Insert a glitch char
      result += `${MATRIX.dim}${glitchChars[Math.floor(Math.random() * glitchChars.length)]}${RESET}`;
    }
    result += text[i];
  }

  return result;
}

// Create rain overlay effect for a line
function rainOverlay(line: string, intensity: number = 0.3): string {
  let result = "";
  const chars = [...line];

  for (const char of chars) {
    if (Math.random() < intensity && char === " ") {
      // Replace space with rain character
      const rainIntensity = Math.random();
      let color: string;
      if (rainIntensity > 0.8) color = MATRIX.mid;
      else if (rainIntensity > 0.5) color = MATRIX.dim;
      else color = MATRIX.darkest;

      result += `${color}${randomMatrixChar()}${RESET}`;
    } else {
      result += char;
    }
  }

  return result;
}

// =============================================================================
// Banner Modes
// =============================================================================

/**
 * NANO mode (<40 chars): Ultra minimal
 */
function createNanoBanner(stats: SystemStats): string {
  const g = MATRIX.bright;
  const d = MATRIX.dim;
  const w = MATRIX.white;

  return `${d}ｱ${RESET}${g}PAI${RESET}${d}ｲ${RESET} ${w}${stats.name}${RESET} ${g}[ON]${RESET}`;
}

/**
 * MICRO mode (40-59 chars): Compact Matrix indicator
 */
function createMicroBanner(stats: SystemStats): string {
  const width = getTerminalWidth();
  const g = MATRIX.bright;
  const p = MATRIX.primary;
  const d = MATRIX.dim;
  const dk = MATRIX.darkest;
  const w = MATRIX.white;
  const f = MATRIX.frame;

  const lines: string[] = [];

  // Rain header
  const rainLine = Array.from({ length: width }, () => {
    const r = Math.random();
    if (r > 0.9) return `${g}${randomKatakana()}${RESET}`;
    if (r > 0.7) return `${p}${randomMatrixChar()}${RESET}`;
    if (r > 0.4) return `${d}${randomMatrixChar()}${RESET}`;
    return `${dk}${randomMatrixChar()}${RESET}`;
  }).join("");

  lines.push(rainLine);

  // PAI line
  const paiStr = `${w}${BOLD}> ${RESET}${g}${BOLD}P${p}A${g}I${RESET} ${d}:: ${stats.name}${RESET}`;
  lines.push(paiStr);

  // Stats line
  const statsStr = `${d}  skills:${RESET}${p}${stats.skills}${RESET} ${d}hooks:${RESET}${p}${stats.hooks}${RESET} ${g}[ONLINE]${RESET}`;
  lines.push(statsStr);

  // Rain footer
  lines.push(rainLine.split("").reverse().join(""));

  return lines.join("\n");
}

/**
 * MINI mode (60-84 chars): Medium Matrix display
 */
function createMiniBanner(stats: SystemStats): string {
  const width = getTerminalWidth();
  const g = MATRIX.bright;
  const p = MATRIX.primary;
  const m = MATRIX.mid;
  const d = MATRIX.dim;
  const dk = MATRIX.darkest;
  const w = MATRIX.white;
  const f = MATRIX.frame;

  const lines: string[] = [];

  // Generate rain columns
  const generateRainLine = (intensity: number = 0.5): string => {
    return Array.from({ length: width }, () => {
      const r = Math.random();
      if (r > 0.95) return `${w}${randomKatakana()}${RESET}`;
      if (r > 0.85) return `${g}${randomKatakana()}${RESET}`;
      if (r > 0.7) return `${p}${randomMatrixChar()}${RESET}`;
      if (r > 0.5 * intensity) return `${m}${randomMatrixChar()}${RESET}`;
      if (r > 0.3 * intensity) return `${d}${randomMatrixChar()}${RESET}`;
      return `${dk}${randomMatrixChar()}${RESET}`;
    }).join("");
  };

  // Rain top
  lines.push(generateRainLine(0.8));
  lines.push(generateRainLine(0.6));

  // Frame top
  lines.push(`${f}${BOLD}${"=".repeat(width)}${RESET}`);

  // PAI header with glitch
  const paiHeader = `${g}${BOLD} ██████╗   █████╗  ██╗${RESET}`;
  const hex = randomHex(8);
  const headerLine = ` ${paiHeader}  ${d}0x${hex}${RESET}`;
  lines.push(rainOverlay(headerLine.padEnd(width), 0.2));

  // Stats as terminal readout
  lines.push(`${d} > ${RESET}${p}DA_NAME${RESET}${d}.......: ${RESET}${w}${BOLD}${stats.name}${RESET}`);
  lines.push(`${d} > ${RESET}${p}SKILLS_COUNT${RESET}${d}.: ${RESET}${g}${stats.skills}${RESET}`);
  lines.push(`${d} > ${RESET}${p}HOOKS_ACTIVE${RESET}${d}.: ${RESET}${g}${stats.hooks}${RESET}`);
  lines.push(`${d} > ${RESET}${p}MODEL${RESET}${d}........: ${RESET}${g}${stats.model}${RESET}`);
  lines.push(`${d} > ${RESET}${p}STATUS${RESET}${d}.......: ${RESET}${g}${BOLD}[ONLINE]${RESET}`);

  // Frame bottom
  lines.push(`${f}${BOLD}${"=".repeat(width)}${RESET}`);

  // Rain bottom
  lines.push(generateRainLine(0.6));
  lines.push(generateRainLine(0.4));

  return lines.join("\n");
}

/**
 * NORMAL mode (85+ chars): Full Matrix neofetch-style banner
 * LEFT: PAI logo with rain | RIGHT: System stats
 * BOTTOM: PAI dripping + branding
 */
function createNormalBanner(stats: SystemStats): string {
  const width = getTerminalWidth();
  const g = MATRIX.bright;
  const p = MATRIX.primary;
  const m = MATRIX.mid;
  const d = MATRIX.dim;
  const dk = MATRIX.darkest;
  const w = MATRIX.white;
  const c = MATRIX.cyan;
  const f = MATRIX.frame;

  const lines: string[] = [];

  // Dimensions
  const logoWidth = 40;  // Width for PAI logo + rain
  const statsWidth = width - logoWidth - 3;  // Right side stats
  const dividerCol = logoWidth + 1;

  // Generate rain line with varying intensity
  const makeRainLine = (len: number, intensity: number = 0.5): string => {
    return Array.from({ length: len }, () => {
      const r = Math.random();
      if (r > 0.97) return `${w}${randomKatakana()}${RESET}`;
      if (r > 0.90) return `${g}${randomKatakana()}${RESET}`;
      if (r > 0.75) return `${p}${randomKatakana()}${RESET}`;
      if (r > 0.55) return `${m}${randomMatrixChar()}${RESET}`;
      if (r > 0.35 * intensity) return `${d}${randomMatrixChar()}${RESET}`;
      return `${dk}${randomMatrixChar()}${RESET}`;
    }).join("");
  };

  // Rain header (full width)
  lines.push(makeRainLine(width, 0.9));
  lines.push(makeRainLine(width, 0.7));

  // Frame top
  const topFrame = `${f}${BOLD}${"=".repeat(dividerCol - 1)}[${RESET}${g}${BOLD}MATRIX${RESET}${f}${BOLD}]${"=".repeat(width - dividerCol - 8)}${RESET}`;
  lines.push(topFrame);

  // Content section: Logo left, Stats right
  const statLabels = [
    { key: "DA_NAME", val: stats.name, color: w, bold: true },
    { key: "SKILLS_COUNT", val: String(stats.skills), color: g, bold: false },
    { key: "HOOKS_ACTIVE", val: String(stats.hooks), color: g, bold: false },
    { key: "WORK_ITEMS", val: String(stats.workItems), color: g, bold: false },
    { key: "LEARNINGS", val: String(stats.learnings), color: g, bold: false },
    { key: "USER_FILES", val: String(stats.userFiles), color: g, bold: false },
    { key: "MODEL", val: stats.model, color: c, bold: false },
    { key: "STATUS", val: "[ONLINE]", color: g, bold: true },
  ];

  // PAI logo lines with rain surrounding
  const paiLines = PAI_MATRIX_LOGO.map((line, i) => {
    // Colorize the logo with gradient effect
    let coloredLine: string;
    if (i < 2) {
      coloredLine = `${g}${BOLD}${line}${RESET}`;
    } else if (i < 4) {
      coloredLine = `${p}${line}${RESET}`;
    } else {
      coloredLine = `${m}${line}${RESET}`;
    }
    return coloredLine;
  });

  // Combine logo + stats
  const contentRows = Math.max(paiLines.length, statLabels.length);

  for (let i = 0; i < contentRows; i++) {
    // Left side: rain + logo + rain
    const logoLine = i < paiLines.length ? paiLines[i] : "";
    const logoVisLen = logoLine.replace(/\x1b\[[0-9;]*m/g, "").length;
    const rainLeft = makeRainLine(3, 0.6);
    const rainRight = makeRainLine(logoWidth - logoVisLen - 6, 0.5);

    // Right side: stat line
    let statLine = "";
    if (i < statLabels.length) {
      const stat = statLabels[i];
      const dots = ".".repeat(12 - stat.key.length);
      const valDisplay = stat.bold
        ? `${stat.color}${BOLD}${stat.val}${RESET}`
        : `${stat.color}${stat.val}${RESET}`;
      statLine = `${d}> ${RESET}${p}${stat.key}${RESET}${d}${dots}: ${RESET}${valDisplay}`;
    }

    // Combine with divider
    const leftPart = `${rainLeft}${logoLine}${rainRight}`;
    const leftVisLen = leftPart.replace(/\x1b\[[0-9;]*m/g, "").length;
    const paddedLeft = leftPart + " ".repeat(Math.max(0, logoWidth - leftVisLen));

    lines.push(`${paddedLeft}${f}${BOLD}|${RESET} ${statLine}`);
  }

  // Divider with hex
  const hex1 = randomHex(4);
  const hex2 = randomHex(4);
  const binary = randomBinary(16);
  const midFrame = `${f}${BOLD}${"=".repeat(5)}${RESET}${dk}${binary}${RESET}${f}${BOLD}${"=".repeat(dividerCol - 26)}[${RESET}${d}0x${hex1}${RESET}${f}${BOLD}]${"=".repeat(width - dividerCol - 8)}${RESET}`;
  lines.push(midFrame);

  // Bottom section: Glitched branding
  const brandLine1 = `${d}  "Magnifying human capabilities through intelligent automation..."${RESET}`;
  lines.push(rainOverlay(brandLine1.padEnd(width), 0.15));

  // PAI dripping effect
  const paiDripLines = PAI_DRIP.slice(0, 4);  // Just first 4 lines for compactness
  for (const paiLine of paiDripLines) {
    // Color gradient: bright to dim going down
    const coloredPai = `${g}${BOLD}${paiLine}${RESET}`;
    const centered = " ".repeat(Math.floor((width - paiLine.length) / 2));
    lines.push(`${centered}${coloredPai}`);
  }

  // Drip trail
  const dripLine = `${m}░${RESET}${d}  ▒${RESET}${dk}    ▓${RESET}${d}  ░${RESET}${dk}    ▒${RESET}${m}░${RESET}`;
  const dripCentered = " ".repeat(Math.floor((width - 19) / 2));
  lines.push(`${dripCentered}${dripLine}`);

  // GitHub URL as terminal command
  const urlLine = `${d}$ git clone ${RESET}${g}https://github.com/danielmiessler/PAI${RESET}`;
  const urlCentered = " ".repeat(Math.floor((width - 50) / 2));
  lines.push(rainOverlay(`${urlCentered}${urlLine}`.padEnd(width), 0.1));

  // Frame bottom
  const bottomFrame = `${f}${BOLD}${"=".repeat(dividerCol - 1)}[${RESET}${p}PAI${RESET}${f}${BOLD}]${"=".repeat(width - dividerCol - 5)}${RESET}`;
  lines.push(bottomFrame);

  // Rain footer
  lines.push(makeRainLine(width, 0.5));
  lines.push(makeRainLine(width, 0.3));

  return lines.join("\n");
}

// =============================================================================
// Main
// =============================================================================

function createBanner(forceMode?: DisplayMode): string {
  const mode = forceMode || getDisplayMode();
  const stats = getStats();

  switch (mode) {
    case "nano":
      return createNanoBanner(stats);
    case "micro":
      return createMicroBanner(stats);
    case "mini":
      return createMiniBanner(stats);
    case "normal":
    default:
      return createNormalBanner(stats);
  }
}

// CLI args: --test (show all modes), --mode=nano|micro|mini|normal
const args = process.argv.slice(2);
const testMode = args.includes("--test");
const modeArg = args.find(a => a.startsWith("--mode="))?.split("=")[1] as DisplayMode | undefined;

try {
  if (testMode) {
    const modes: DisplayMode[] = ["nano", "micro", "mini", "normal"];
    for (const mode of modes) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`  MODE: ${mode.toUpperCase()}`);
      console.log(`${"=".repeat(60)}`);
      console.log(createBanner(mode));
    }
  } else {
    console.log();
    console.log(createBanner(modeArg));
    console.log();
  }
} catch (e) {
  console.error("Banner error:", e);
}
