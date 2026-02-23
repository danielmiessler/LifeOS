#!/usr/bin/env bun

/**
 * PAI Banner - Dynamic Multi-Design Neofetch Banner
 * Randomly selects from curated designs based on terminal size
 *
 * Large terminals (85+ cols): Navy, Electric, Teal, Ice themes
 * Small terminals (<85 cols): Minimal, Vertical, Wrapping layouts
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

  if (!width || width <= 0) {
    try {
      const result = spawnSync("sh", ["-c", "stty size </dev/tty 2>/dev/null"], { encoding: "utf-8" });
      if (result.stdout) {
        const cols = parseInt(result.stdout.trim().split(/\s+/)[1]);
        if (cols > 0) width = cols;
      }
    } catch {}
  }

  if (!width || width <= 0) {
    try {
      const result = spawnSync("tput", ["cols"], { encoding: "utf-8" });
      if (result.stdout) {
        const cols = parseInt(result.stdout.trim());
        if (cols > 0) width = cols;
      }
    } catch {}
  }

  if (!width || width <= 0) {
    width = parseInt(process.env.COLUMNS || "100") || 100;
  }

  return width;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANSI Helpers
// ═══════════════════════════════════════════════════════════════════════════

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ITALIC = "\x1b[3m";

const rgb = (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`;

// Sparkline characters
const SPARK = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];

// Box drawing
const BOX = {
  tl: "\u256d", tr: "\u256e", bl: "\u2570", br: "\u256f",
  h: "\u2500", v: "\u2502", dh: "\u2550",
};

// ═══════════════════════════════════════════════════════════════════════════
// Stats Collection
// ═══════════════════════════════════════════════════════════════════════════

interface SystemStats {
  name: string;
  catchphrase: string;
  repoUrl: string;
  skills: number;
  workflows: number;
  hooks: number;
  learnings: number;
  userFiles: number;
  sessions: number;
  model: string;
  platform: string;
  arch: string;
  ccVersion: string;
  paiVersion: string;
  algorithmVersion: string;
}

function getStats(): SystemStats {
  let name = "PAI";
  let paiVersion = "3.0";
  let algorithmVersion = "0.2";
  let catchphrase = "{name} here, ready to go";
  let repoUrl = "github.com/danielmiessler/PAI";
  try {
    const settings = JSON.parse(readFileSync(join(CLAUDE_DIR, "settings.json"), "utf-8"));
    name = settings.daidentity?.displayName || settings.daidentity?.name || "PAI";
    paiVersion = settings.pai?.version || "2.0";
    catchphrase = settings.daidentity?.startupCatchphrase || catchphrase;
    repoUrl = settings.pai?.repoUrl || repoUrl;
  } catch {}

  // Read algorithm version from LATEST file (single source of truth)
  try {
    const latestPath = join(CLAUDE_DIR, "skills/PAI/Components/Algorithm/LATEST");
    const latestContent = readFileSync(latestPath, "utf-8").trim();
    // Extract version number (handles "v0.2" or "0.2" format)
    algorithmVersion = latestContent.replace(/^v/i, "");
  } catch {}

  // Replace {name} placeholder in catchphrase
  catchphrase = catchphrase.replace(/\{name\}/gi, name);

  // Read counts from settings.json (updated by StopOrchestrator at end of each session)
  // This is instant - no spawning, no file scanning
  let skills = 0, workflows = 0, hooks = 0, learnings = 0, userFiles = 0, sessions = 0;

  try {
    const settings = JSON.parse(readFileSync(join(CLAUDE_DIR, "settings.json"), "utf-8"));
    if (settings.counts) {
      skills = settings.counts.skills || 0;
      workflows = settings.counts.workflows || 0;
      hooks = settings.counts.hooks || 0;
      learnings = settings.counts.signals || 0;
      userFiles = settings.counts.files || 0;
    }
  } catch {
    // Fallback to reasonable defaults if settings.json is missing or malformed
    skills = 65;
    workflows = 339;
    hooks = 18;
    learnings = 3000;
    userFiles = 172;
  }

  try {
    const historyFile = join(CLAUDE_DIR, "history.jsonl");
    if (existsSync(historyFile)) {
      const content = readFileSync(historyFile, "utf-8");
      sessions = content.split("\n").filter(line => line.trim()).length;
    }
  } catch {}

  // Get platform info
  const platform = process.platform === "darwin" ? "macOS" : process.platform;
  const arch = process.arch;

  // Try to get Claude Code version
  let ccVersion = "2.0";
  try {
    const result = spawnSync("claude", ["--version"], { encoding: "utf-8" });
    if (result.stdout) {
      const match = result.stdout.match(/(\d+\.\d+\.\d+)/);
      if (match) ccVersion = match[1];
    }
  } catch {}

  return {
    name,
    catchphrase,
    repoUrl,
    skills,
    workflows,
    hooks,
    learnings,
    userFiles,
    sessions,
    model: "Opus 4.5",
    platform,
    arch,
    ccVersion,
    paiVersion,
    algorithmVersion,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

function visibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function padEnd(str: string, width: number): string {
  return str + " ".repeat(Math.max(0, width - visibleLength(str)));
}

function padStart(str: string, width: number): string {
  return " ".repeat(Math.max(0, width - visibleLength(str))) + str;
}

function center(str: string, width: number): string {
  const visible = visibleLength(str);
  const left = Math.floor((width - visible) / 2);
  return " ".repeat(Math.max(0, left)) + str + " ".repeat(Math.max(0, width - visible - left));
}

function randomHex(len: number = 4): string {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join("");
}

function sparkline(length: number, colors?: string[]): string {
  return Array.from({ length }, (_, i) => {
    const level = Math.floor(Math.random() * 8);
    const color = colors ? colors[i % colors.length] : "";
    return `${color}${SPARK[level]}${RESET}`;
  }).join("");
}

// ═══════════════════════════════════════════════════════════════════════════
// LARGE TERMINAL DESIGNS (85+ cols)
// ═══════════════════════════════════════════════════════════════════════════

// Design 13: Navy/Steel Blue Theme - Neofetch style
function createNavyBanner(stats: SystemStats, width: number): string {
  const C = {
    // Logo colors matching reference image
    navy: rgb(30, 58, 138),       // Dark navy (P column, horizontal bars)
    medBlue: rgb(59, 130, 246),   // Medium blue (A column, bottom right blocks)
    lightBlue: rgb(147, 197, 253), // Light blue (I column accent)
    // Info section colors - blue palette gradient
    steel: rgb(51, 65, 85),
    slate: rgb(100, 116, 139),
    silver: rgb(203, 213, 225),
    white: rgb(240, 240, 255),
    muted: rgb(71, 85, 105),
    // Blue palette for data lines
    deepNavy: rgb(30, 41, 82),
    royalBlue: rgb(65, 105, 225),
    skyBlue: rgb(135, 206, 235),
    iceBlue: rgb(176, 196, 222),
    periwinkle: rgb(140, 160, 220),
    // URL - subtle dark teal (visible but muted)
    darkTeal: rgb(55, 100, 105),
  };

  // PAI logo - 2x scale (20 wide × 10 tall), same proportions
  // Each unit is 4 chars wide, 2 rows tall
  const B = "\u2588"; // Full block
  const logo = [
    // Row 1 (top bar) - 2 rows
    `${C.navy}${B.repeat(16)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(16)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    // Row 2 (P stem + gap + A upper) - 2 rows
    `${C.navy}${B.repeat(4)}${RESET}        ${C.navy}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(4)}${RESET}        ${C.navy}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    // Row 3 (middle bar) - 2 rows
    `${C.navy}${B.repeat(16)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(16)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    // Row 4 (P stem + gap + A leg) - 2 rows
    `${C.navy}${B.repeat(4)}${RESET}        ${C.medBlue}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(4)}${RESET}        ${C.medBlue}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    // Row 5 (P stem + gap + A leg) - 2 rows
    `${C.navy}${B.repeat(4)}${RESET}        ${C.medBlue}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(4)}${RESET}        ${C.medBlue}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
  ];
  const LOGO_WIDTH = 20;
  const SEPARATOR = `${C.steel}${BOX.v}${RESET}`;

  // Info section with Unicode icons - meaningful symbols (10 lines for perfect centering with 10-row logo)
  const infoLines = [
    `${C.slate}"${RESET}${C.lightBlue}${stats.catchphrase}${RESET}${C.slate}..."${RESET}`,
    `${C.steel}${BOX.h.repeat(24)}${RESET}`,
    `${C.navy}\u2B22${RESET}  ${C.slate}PAI${RESET}       ${C.silver}v${stats.paiVersion}${RESET}`,                            // ⬢ hexagon (tech/AI)
    `${C.navy}\u2699${RESET}  ${C.slate}Algo${RESET}      ${C.silver}v${stats.algorithmVersion}${RESET}`,                      // ⚙ gear (algorithm)
    `${C.lightBlue}\u2726${RESET}  ${C.slate}SK${RESET}        ${C.silver}${stats.skills}${RESET}`,             // ✦ four-pointed star (skills)
    `${C.skyBlue}\u21BB${RESET}  ${C.slate}WF${RESET}        ${C.iceBlue}${stats.workflows}${RESET}`,           // ↻ cycle (workflows)
    `${C.royalBlue}\u21AA${RESET}  ${C.slate}Hooks${RESET}     ${C.periwinkle}${stats.hooks}${RESET}`,         // ↪ hook arrow
    `${C.medBlue}\u2726${RESET}  ${C.slate}Signals${RESET}   ${C.skyBlue}${stats.learnings}${RESET}`,          // ✦ star (user sentiment signals)
    `${C.navy}\u2261${RESET}  ${C.slate}Files${RESET}     ${C.lightBlue}${stats.userFiles}${RESET}`,           // ≡ identical to (files/menu)
    `${C.steel}${BOX.h.repeat(24)}${RESET}`,
  ];

  // Layout with separator: logo | separator | info
  const gap = "   "; // Gap before separator
  const gapAfter = "  "; // Gap after separator
  const totalContentWidth = LOGO_WIDTH + gap.length + 1 + gapAfter.length + 28;
  const leftPad = Math.floor((width - totalContentWidth) / 2);
  const pad = " ".repeat(Math.max(2, leftPad));
  const emptyLogoSpace = " ".repeat(LOGO_WIDTH);

  // Vertically center logo relative to the full separator height
  const logoTopPad = Math.ceil((infoLines.length - logo.length) / 2);

  // Reticle corner characters (heavy/thick)
  const RETICLE = {
    tl: "\u250F", // ┏
    tr: "\u2513", // ┓
    bl: "\u2517", // ┗
    br: "\u251B", // ┛
    h: "\u2501",  // ━
  };

  // Frame dimensions
  const frameWidth = 70;
  const framePad = " ".repeat(Math.floor((width - frameWidth) / 2));
  const cornerLen = 3; // Length of corner pieces
  const innerSpace = frameWidth - (cornerLen * 2);

  const lines: string[] = [""];

  // Top border with full horizontal line and reticle corners
  const topBorder = `${C.steel}${RETICLE.tl}${RETICLE.h.repeat(frameWidth - 2)}${RETICLE.tr}${RESET}`;
  lines.push(`${framePad}${topBorder}`);
  lines.push("");

  // Header: PAI (in logo colors) | Personal AI Infrastructure
  const paiColored = `${C.navy}P${RESET}${C.medBlue}A${RESET}${C.lightBlue}I${RESET}`;
  const headerText = `${paiColored} ${C.steel}|${RESET} ${C.slate}Personal AI Infrastructure${RESET}`;
  const headerLen = 33; // "PAI | Personal AI Infrastructure"
  const headerPad = " ".repeat(Math.floor((width - headerLen) / 2));
  lines.push(`${headerPad}${headerText}`);
  lines.push(""); // Blank line between header and tagline

  // Tagline in light blue with ellipsis
  const quote = `${ITALIC}${C.lightBlue}"Magnifying human capabilities..."${RESET}`;
  const quoteLen = 35; // includes ellipsis
  const quotePad = " ".repeat(Math.floor((width - quoteLen) / 2));
  lines.push(`${quotePad}${quote}`);

  // Extra space between top text area and main content
  lines.push("");
  lines.push("");

  // Main content: logo | separator | info
  for (let i = 0; i < infoLines.length; i++) {
    const logoIndex = i - logoTopPad;
    const logoRow = (logoIndex >= 0 && logoIndex < logo.length) ? logo[logoIndex] : emptyLogoSpace;
    const infoRow = infoLines[i];
    lines.push(`${pad}${padEnd(logoRow, LOGO_WIDTH)}${gap}${SEPARATOR}${gapAfter}${infoRow}`);
  }

  // Extra space between main content and footer
  lines.push("");
  lines.push("");

  // Footer: Unicode symbol + URL in medium blue (A color)
  const urlLine = `${C.steel}\u2192${RESET} ${C.medBlue}${stats.repoUrl}${RESET}`;
  const urlLen = stats.repoUrl.length + 3;
  const urlPad = " ".repeat(Math.floor((width - urlLen) / 2));
  lines.push(`${urlPad}${urlLine}`);
  lines.push("");

  // Bottom border with full horizontal line and reticle corners
  const bottomBorder = `${C.steel}${RETICLE.bl}${RETICLE.h.repeat(frameWidth - 2)}${RETICLE.br}${RESET}`;
  lines.push(`${framePad}${bottomBorder}`);
  lines.push("");

  return lines.join("\n");
}

// Design 14: Electric/Neon Blue Theme
function createElectricBanner(stats: SystemStats, width: number): string {
  const P = {
    logoP: rgb(0, 80, 180),
    logoA: rgb(0, 191, 255),
    logoI: rgb(125, 249, 255),
    electricBlue: rgb(0, 191, 255),
    neonBlue: rgb(30, 144, 255),
    ultraBlue: rgb(0, 255, 255),
    electric: rgb(125, 249, 255),
    plasma: rgb(0, 150, 255),
    glow: rgb(100, 200, 255),
    midBase: rgb(20, 40, 80),
    active: rgb(0, 255, 136),
  };

  // PAI logo - matching reference image exactly
  const B = "\u2588";
  const logo = [
    `${P.logoP}${B.repeat(8)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(2)}${RESET}    ${P.logoP}${B.repeat(2)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(8)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(2)}${RESET}    ${P.logoA}${B.repeat(2)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(2)}${RESET}    ${P.logoA}${B.repeat(2)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
  ];
  const LOGO_WIDTH = 10;

  const hex1 = randomHex(4);
  const hex2 = randomHex(4);
  const SYM = { user: "\u25c6", skills: "\u26a1", hooks: "\u2699", learn: "\u25c8", files: "\u25a0", model: "\u25ce", link: "\u21e2", pulse: "\u25cf", target: "\u25ce" };

  const infoLines = [
    `${P.electricBlue}${SYM.user}${RESET} ${BOLD}${P.electric}${stats.name}${RESET}${P.glow}@${RESET}${P.ultraBlue}pai${RESET} ${P.midBase}[0x${hex1}]${RESET}`,
    `${P.plasma}${BOX.h.repeat(32)}${RESET}`,
    `${P.neonBlue}${SYM.target}${RESET} ${P.glow}OS${RESET}         ${P.electric}PAI v${stats.paiVersion}${RESET}`,
    `${P.neonBlue}${SYM.skills}${RESET} ${P.glow}Skills${RESET}     ${BOLD}${P.electricBlue}${stats.skills}${RESET} ${P.active}${SYM.pulse}${RESET}`,
    `${P.neonBlue}${SYM.hooks}${RESET} ${P.glow}Hooks${RESET}      ${BOLD}${P.electricBlue}${stats.hooks}${RESET}`,
    `${P.neonBlue}${SYM.learn}${RESET} ${P.glow}Signals${RESET}    ${BOLD}${P.electricBlue}${stats.learnings}${RESET}`,
    `${P.neonBlue}${SYM.files}${RESET} ${P.glow}Files${RESET}      ${BOLD}${P.electricBlue}${stats.userFiles}${RESET}`,
    `${P.neonBlue}${SYM.model}${RESET} ${P.glow}Model${RESET}      ${BOLD}${P.ultraBlue}${stats.model}${RESET}`,
    `${P.plasma}${BOX.h.repeat(32)}${RESET}`,
    `${sparkline(24, [P.plasma, P.neonBlue, P.electricBlue, P.electric, P.ultraBlue])}`,
    `${P.neonBlue}${SYM.link}${RESET} ${P.midBase}${stats.repoUrl}${RESET} ${P.midBase}[0x${hex2}]${RESET}`,
  ];

  const gap = "   ";
  const logoTopPad = Math.floor((infoLines.length - logo.length) / 2);
  const contentWidth = LOGO_WIDTH + 3 + 45;
  const leftPad = Math.floor((width - contentWidth) / 2);
  const pad = " ".repeat(Math.max(2, leftPad));

  const lines: string[] = [""];
  for (let i = 0; i < infoLines.length; i++) {
    const logoIndex = i - logoTopPad;
    const logoRow = (logoIndex >= 0 && logoIndex < logo.length) ? logo[logoIndex] : " ".repeat(LOGO_WIDTH);
    lines.push(`${pad}${padEnd(logoRow, LOGO_WIDTH)}${gap}${infoLines[i]}`);
  }

  const footerWidth = Math.min(width - 4, 65);
  const paiText = `${BOLD}${P.logoP}P${RESET}${BOLD}${P.logoA}A${RESET}${BOLD}${P.logoI}I${RESET}`;
  const footer = `${P.electric}\u26a1${RESET} ${paiText} ${P.plasma}${BOX.v}${RESET} ${ITALIC}${P.glow}Electric Blue Theme${RESET} ${P.electric}\u26a1${RESET}`;
  lines.push("");
  lines.push(`${pad}${P.plasma}${BOX.tl}${BOX.h.repeat(footerWidth - 2)}${BOX.tr}${RESET}`);
  lines.push(`${pad}${P.plasma}${BOX.v}${RESET}${center(footer, footerWidth - 2)}${P.plasma}${BOX.v}${RESET}`);
  lines.push(`${pad}${P.plasma}${BOX.bl}${BOX.h.repeat(footerWidth - 2)}${BOX.br}${RESET}`);
  lines.push("");

  return lines.join("\n");
}

// Design 15: Teal/Aqua Theme
function createTealBanner(stats: SystemStats, width: number): string {
  const P = {
    logoP: rgb(0, 77, 77),
    logoA: rgb(32, 178, 170),
    logoI: rgb(127, 255, 212),
    teal: rgb(0, 128, 128),
    mediumTeal: rgb(32, 178, 170),
    aqua: rgb(0, 255, 255),
    aquamarine: rgb(127, 255, 212),
    turquoise: rgb(64, 224, 208),
    paleAqua: rgb(175, 238, 238),
    midSea: rgb(20, 50, 60),
    active: rgb(50, 205, 50),
  };

  const WAVE = ["\u2248", "\u223c", "\u2307", "\u2312"];
  const wavePattern = (length: number): string => {
    return Array.from({ length }, (_, i) => {
      const wave = WAVE[i % WAVE.length];
      const color = i % 2 === 0 ? P.turquoise : P.aquamarine;
      return `${color}${wave}${RESET}`;
    }).join("");
  };

  // PAI logo - matching reference image exactly
  const B = "\u2588";
  const logo = [
    `${P.logoP}${B.repeat(8)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(2)}${RESET}    ${P.logoP}${B.repeat(2)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(8)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(2)}${RESET}    ${P.logoA}${B.repeat(2)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(2)}${RESET}    ${P.logoA}${B.repeat(2)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
  ];
  const LOGO_WIDTH = 10;

  const SYM = { user: "\u2756", skills: "\u25c6", hooks: "\u2699", learn: "\u25c7", files: "\u25a2", model: "\u25ce", link: "\u27a4", wave: "\u223c", drop: "\u25cf" };

  const infoLines = [
    `${P.aquamarine}${SYM.user}${RESET} ${BOLD}${P.turquoise}${stats.name}${RESET}${P.mediumTeal}@${RESET}${P.aqua}pai${RESET}`,
    `${P.teal}${BOX.h.repeat(28)}${RESET}`,
    `${P.mediumTeal}${SYM.wave}${RESET} ${P.paleAqua}OS${RESET}         ${P.aquamarine}PAI v${stats.paiVersion}${RESET}`,
    `${P.mediumTeal}${SYM.skills}${RESET} ${P.paleAqua}Skills${RESET}     ${BOLD}${P.turquoise}${stats.skills}${RESET} ${P.active}${SYM.drop}${RESET}`,
    `${P.mediumTeal}${SYM.hooks}${RESET} ${P.paleAqua}Hooks${RESET}      ${BOLD}${P.turquoise}${stats.hooks}${RESET}`,
    `${P.mediumTeal}${SYM.learn}${RESET} ${P.paleAqua}Signals${RESET}    ${BOLD}${P.turquoise}${stats.learnings}${RESET}`,
    `${P.mediumTeal}${SYM.files}${RESET} ${P.paleAqua}Files${RESET}      ${BOLD}${P.turquoise}${stats.userFiles}${RESET}`,
    `${P.mediumTeal}${SYM.model}${RESET} ${P.paleAqua}Model${RESET}      ${BOLD}${P.aquamarine}${stats.model}${RESET}`,
    `${P.teal}${BOX.h.repeat(28)}${RESET}`,
    `${sparkline(20, [P.logoP, P.teal, P.mediumTeal, P.turquoise, P.aquamarine])}`,
    `${P.mediumTeal}${SYM.link}${RESET} ${P.midSea}${stats.repoUrl}${RESET}`,
  ];

  const gap = "   ";
  const logoTopPad = Math.floor((infoLines.length - logo.length) / 2);
  const contentWidth = LOGO_WIDTH + 3 + 35;
  const leftPad = Math.floor((width - contentWidth) / 2);
  const pad = " ".repeat(Math.max(2, leftPad));

  const lines: string[] = [""];
  for (let i = 0; i < infoLines.length; i++) {
    const logoIndex = i - logoTopPad;
    const logoRow = (logoIndex >= 0 && logoIndex < logo.length) ? logo[logoIndex] : " ".repeat(LOGO_WIDTH);
    lines.push(`${pad}${padEnd(logoRow, LOGO_WIDTH)}${gap}${infoLines[i]}`);
  }

  const footerWidth = Math.min(width - 4, 60);
  const paiText = `${BOLD}${P.logoP}P${RESET}${BOLD}${P.logoA}A${RESET}${BOLD}${P.logoI}I${RESET}`;
  const waves = wavePattern(3);
  const footer = `${waves} ${paiText} ${P.teal}${BOX.v}${RESET} ${ITALIC}${P.paleAqua}Teal Aqua Theme${RESET} ${waves}`;
  lines.push("");
  lines.push(`${pad}${P.teal}${BOX.tl}${BOX.h.repeat(footerWidth - 2)}${BOX.tr}${RESET}`);
  lines.push(`${pad}${P.teal}${BOX.v}${RESET}${center(footer, footerWidth - 2)}${P.teal}${BOX.v}${RESET}`);
  lines.push(`${pad}${P.teal}${BOX.bl}${BOX.h.repeat(footerWidth - 2)}${BOX.br}${RESET}`);
  lines.push("");

  return lines.join("\n");
}

// Design 16: Ice/Frost Theme
function createIceBanner(stats: SystemStats, width: number): string {
  const P = {
    logoP: rgb(135, 160, 190),
    logoA: rgb(173, 216, 230),
    logoI: rgb(240, 248, 255),
    deepIce: rgb(176, 196, 222),
    iceBlue: rgb(173, 216, 230),
    frost: rgb(200, 230, 255),
    paleFrost: rgb(220, 240, 255),
    white: rgb(248, 250, 252),
    pureWhite: rgb(255, 255, 255),
    glacierBlue: rgb(135, 206, 235),
    slateBlue: rgb(106, 135, 165),
    active: rgb(100, 200, 150),
  };

  const CRYSTAL = ["\u2727", "\u2728", "\u2729", "\u272a", "\u00b7", "\u2022"];
  const crystalPattern = (length: number): string => {
    return Array.from({ length }, (_, i) => {
      const crystal = CRYSTAL[i % CRYSTAL.length];
      const color = i % 2 === 0 ? P.frost : P.white;
      return `${color}${crystal}${RESET}`;
    }).join(" ");
  };

  // PAI logo - matching reference image exactly
  const B = "\u2588";
  const logo = [
    `${P.logoP}${B.repeat(8)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(2)}${RESET}    ${P.logoP}${B.repeat(2)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(8)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(2)}${RESET}    ${P.logoA}${B.repeat(2)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
    `${P.logoP}${B.repeat(2)}${RESET}    ${P.logoA}${B.repeat(2)}${RESET}${P.logoI}${B.repeat(2)}${RESET}`,
  ];
  const LOGO_WIDTH = 10;

  const SYM = { user: "\u2727", skills: "\u2726", hooks: "\u2699", learn: "\u25c7", files: "\u25a1", model: "\u25cb", link: "\u2192", snow: "\u2022", crystal: "\u2729" };

  const infoLines = [
    `${P.white}${SYM.user}${RESET} ${BOLD}${P.pureWhite}${stats.name}${RESET}${P.frost}@${RESET}${P.paleFrost}pai${RESET}`,
    `${P.deepIce}${BOX.h.repeat(28)}${RESET}`,
    `${P.iceBlue}${SYM.crystal}${RESET} ${P.frost}OS${RESET}         ${P.white}PAI v${stats.paiVersion}${RESET}`,
    `${P.iceBlue}${SYM.skills}${RESET} ${P.frost}Skills${RESET}     ${BOLD}${P.pureWhite}${stats.skills}${RESET} ${P.active}${SYM.snow}${RESET}`,
    `${P.iceBlue}${SYM.hooks}${RESET} ${P.frost}Hooks${RESET}      ${BOLD}${P.pureWhite}${stats.hooks}${RESET}`,
    `${P.iceBlue}${SYM.learn}${RESET} ${P.frost}Signals${RESET}    ${BOLD}${P.pureWhite}${stats.learnings}${RESET}`,
    `${P.iceBlue}${SYM.files}${RESET} ${P.frost}Files${RESET}      ${BOLD}${P.pureWhite}${stats.userFiles}${RESET}`,
    `${P.iceBlue}${SYM.model}${RESET} ${P.frost}Model${RESET}      ${BOLD}${P.glacierBlue}${stats.model}${RESET}`,
    `${P.deepIce}${BOX.h.repeat(28)}${RESET}`,
    `${sparkline(20, [P.slateBlue, P.deepIce, P.iceBlue, P.frost, P.paleFrost])}`,
    `${P.iceBlue}${SYM.link}${RESET} ${P.slateBlue}${stats.repoUrl}${RESET}`,
  ];

  const gap = "   ";
  const logoTopPad = Math.floor((infoLines.length - logo.length) / 2);
  const contentWidth = LOGO_WIDTH + 3 + 35;
  const leftPad = Math.floor((width - contentWidth) / 2);
  const pad = " ".repeat(Math.max(2, leftPad));

  const lines: string[] = [""];
  for (let i = 0; i < infoLines.length; i++) {
    const logoIndex = i - logoTopPad;
    const logoRow = (logoIndex >= 0 && logoIndex < logo.length) ? logo[logoIndex] : " ".repeat(LOGO_WIDTH);
    lines.push(`${pad}${padEnd(logoRow, LOGO_WIDTH)}${gap}${infoLines[i]}`);
  }

  const footerWidth = Math.min(width - 4, 60);
  const paiText = `${BOLD}${P.logoP}P${RESET}${BOLD}${P.logoA}A${RESET}${BOLD}${P.logoI}I${RESET}`;
  const crystals = crystalPattern(2);
  const footer = `${crystals} ${paiText} ${P.deepIce}${BOX.v}${RESET} ${ITALIC}${P.frost}Ice Frost Theme${RESET} ${crystals}`;
  lines.push("");
  lines.push(`${pad}${P.deepIce}${BOX.tl}${BOX.h.repeat(footerWidth - 2)}${BOX.tr}${RESET}`);
  lines.push(`${pad}${P.deepIce}${BOX.v}${RESET}${center(footer, footerWidth - 2)}${P.deepIce}${BOX.v}${RESET}`);
  lines.push(`${pad}${P.deepIce}${BOX.bl}${BOX.h.repeat(footerWidth - 2)}${BOX.br}${RESET}`);
  lines.push("");

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSIVE NAVY BANNER VARIANTS (progressive compaction)
// ═══════════════════════════════════════════════════════════════════════════

// Shared Navy color palette for all compact variants
function getNavyColors() {
  return {
    navy: rgb(30, 58, 138),
    medBlue: rgb(59, 130, 246),
    lightBlue: rgb(147, 197, 253),
    steel: rgb(51, 65, 85),
    slate: rgb(100, 116, 139),
    silver: rgb(203, 213, 225),
    iceBlue: rgb(176, 196, 222),
    periwinkle: rgb(140, 160, 220),
    skyBlue: rgb(135, 206, 235),
    royalBlue: rgb(65, 105, 225),
  };
}

// Small logo (10x5) for compact layouts
function getSmallLogo(C: ReturnType<typeof getNavyColors>) {
  const B = "\u2588";
  return [
    `${C.navy}${B.repeat(8)}${RESET}${C.lightBlue}${B.repeat(2)}${RESET}`,
    `${C.navy}${B.repeat(2)}${RESET}    ${C.navy}${B.repeat(2)}${RESET}${C.lightBlue}${B.repeat(2)}${RESET}`,
    `${C.navy}${B.repeat(8)}${RESET}${C.lightBlue}${B.repeat(2)}${RESET}`,
    `${C.navy}${B.repeat(2)}${RESET}    ${C.medBlue}${B.repeat(2)}${RESET}${C.lightBlue}${B.repeat(2)}${RESET}`,
    `${C.navy}${B.repeat(2)}${RESET}    ${C.medBlue}${B.repeat(2)}${RESET}${C.lightBlue}${B.repeat(2)}${RESET}`,
  ];
}

// Medium Banner (70-84 cols) - No border, full content
function createNavyMediumBanner(stats: SystemStats, width: number): string {
  const C = getNavyColors();
  const B = "\u2588";

  // Full logo (20x10)
  const logo = [
    `${C.navy}${B.repeat(16)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(16)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(4)}${RESET}        ${C.navy}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(4)}${RESET}        ${C.navy}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(16)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(16)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(4)}${RESET}        ${C.medBlue}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(4)}${RESET}        ${C.medBlue}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(4)}${RESET}        ${C.medBlue}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
    `${C.navy}${B.repeat(4)}${RESET}        ${C.medBlue}${B.repeat(4)}${RESET}${C.lightBlue}${B.repeat(4)}${RESET}`,
  ];
  const LOGO_WIDTH = 20;
  const SEPARATOR = `${C.steel}${BOX.v}${RESET}`;

  const infoLines = [
    `${C.slate}"${RESET}${C.lightBlue}${stats.catchphrase}${RESET}${C.slate}..."${RESET}`,
    `${C.steel}${BOX.h.repeat(24)}${RESET}`,
    `${C.navy}\u2B22${RESET}  ${C.slate}PAI${RESET}       ${C.silver}v${stats.paiVersion}${RESET}`,
    `${C.navy}\u2699${RESET}  ${C.slate}Algo${RESET}      ${C.silver}v${stats.algorithmVersion}${RESET}`,
    `${C.lightBlue}\u2726${RESET}  ${C.slate}SK${RESET}        ${C.silver}${stats.skills}${RESET}`,
    `${C.skyBlue}\u21BB${RESET}  ${C.slate}WF${RESET}        ${C.iceBlue}${stats.workflows}${RESET}`,
    `${C.royalBlue}\u21AA${RESET}  ${C.slate}Hooks${RESET}     ${C.periwinkle}${stats.hooks}${RESET}`,
    `${C.medBlue}\u2726${RESET}  ${C.slate}Signals${RESET}   ${C.skyBlue}${stats.learnings}${RESET}`,
    `${C.navy}\u2261${RESET}  ${C.slate}Files${RESET}     ${C.lightBlue}${stats.userFiles}${RESET}`,
    `${C.steel}${BOX.h.repeat(24)}${RESET}`,
  ];

  const gap = "   ";
  const gapAfter = "  ";
  const totalContentWidth = LOGO_WIDTH + gap.length + 1 + gapAfter.length + 28;
  const leftPad = Math.floor((width - totalContentWidth) / 2);
  const pad = " ".repeat(Math.max(1, leftPad));
  const emptyLogoSpace = " ".repeat(LOGO_WIDTH);
  const logoTopPad = Math.ceil((infoLines.length - logo.length) / 2);

  const lines: string[] = [""];

  // Header (no border)
  const paiColored = `${C.navy}P${RESET}${C.medBlue}A${RESET}${C.lightBlue}I${RESET}`;
  const headerText = `${paiColored} ${C.steel}|${RESET} ${C.slate}Personal AI Infrastructure${RESET}`;
  const headerPad = " ".repeat(Math.max(0, Math.floor((width - 33) / 2)));
  lines.push(`${headerPad}${headerText}`);
  lines.push("");

  // Tagline
  const quote = `${ITALIC}${C.lightBlue}"Magnifying human capabilities..."${RESET}`;
  const quotePad = " ".repeat(Math.max(0, Math.floor((width - 35) / 2)));
  lines.push(`${quotePad}${quote}`);
  lines.push("");

  // Main content
  for (let i = 0; i < infoLines.length; i++) {
    const logoIndex = i - logoTopPad;
    const logoRow = (logoIndex >= 0 && logoIndex < logo.length) ? logo[logoIndex] : emptyLogoSpace;
    lines.push(`${pad}${padEnd(logoRow, LOGO_WIDTH)}${gap}${SEPARATOR}${gapAfter}${infoLines[i]}`);
  }

  lines.push("");
  const urlLine = `${C.steel}\u2192${RESET} ${C.medBlue}${stats.repoUrl}${RESET}`;
  const urlPad = " ".repeat(Math.max(0, Math.floor((width - stats.repoUrl.length - 3) / 2)));
  lines.push(`${urlPad}${urlLine}`);
  lines.push("");

  return lines.join("\n");
}

// Compact Banner (55-69 cols) - Small logo, reduced info
function createNavyCompactBanner(stats: SystemStats, width: number): string {
  const C = getNavyColors();
  const logo = getSmallLogo(C);
  const LOGO_WIDTH = 10;
  const SEPARATOR = `${C.steel}${BOX.v}${RESET}`;

  // Condensed info (6 lines to match logo height better)
  // Truncate catchphrase for compact display
  const shortCatchphrase = stats.catchphrase.length > 20 ? stats.catchphrase.slice(0, 17) + "..." : stats.catchphrase;
  const infoLines = [
    `${C.slate}"${RESET}${C.lightBlue}${shortCatchphrase}${RESET}${C.slate}"${RESET}`,
    `${C.steel}${BOX.h.repeat(18)}${RESET}`,
    `${C.navy}\u2B22${RESET} ${C.slate}PAI${RESET} ${C.silver}v${stats.paiVersion}${RESET} ${C.navy}\u2699${RESET} ${C.silver}v${stats.algorithmVersion}${RESET}`,
    `${C.lightBlue}\u2726${RESET} ${C.slate}SK${RESET} ${C.silver}${stats.skills}${RESET}  ${C.skyBlue}\u21BB${RESET} ${C.iceBlue}${stats.workflows}${RESET}  ${C.royalBlue}\u21AA${RESET} ${C.periwinkle}${stats.hooks}${RESET}`,
    `${C.medBlue}\u2726${RESET} ${C.slate}Signals${RESET} ${C.skyBlue}${stats.learnings}${RESET}`,
    `${C.steel}${BOX.h.repeat(18)}${RESET}`,
  ];

  const gap = "  ";
  const gapAfter = " ";
  const totalContentWidth = LOGO_WIDTH + gap.length + 1 + gapAfter.length + 20;
  const leftPad = Math.floor((width - totalContentWidth) / 2);
  const pad = " ".repeat(Math.max(1, leftPad));
  const emptyLogoSpace = " ".repeat(LOGO_WIDTH);
  const logoTopPad = Math.floor((infoLines.length - logo.length) / 2);

  const lines: string[] = [""];

  // Condensed header
  const paiColored = `${C.navy}P${RESET}${C.medBlue}A${RESET}${C.lightBlue}I${RESET}`;
  const headerPad = " ".repeat(Math.max(0, Math.floor((width - 3) / 2)));
  lines.push(`${headerPad}${paiColored}`);
  lines.push("");

  // Main content
  for (let i = 0; i < infoLines.length; i++) {
    const logoIndex = i - logoTopPad;
    const logoRow = (logoIndex >= 0 && logoIndex < logo.length) ? logo[logoIndex] : emptyLogoSpace;
    lines.push(`${pad}${padEnd(logoRow, LOGO_WIDTH)}${gap}${SEPARATOR}${gapAfter}${infoLines[i]}`);
  }
  lines.push("");

  return lines.join("\n");
}

// Minimal Banner (45-54 cols) - Very condensed
function createNavyMinimalBanner(stats: SystemStats, width: number): string {
  const C = getNavyColors();
  const logo = getSmallLogo(C);
  const LOGO_WIDTH = 10;

  // Minimal info beside logo
  const infoLines = [
    `${C.lightBlue}${stats.name}${RESET}${C.slate}@pai${RESET}`,
    `${C.slate}v${stats.paiVersion}${RESET} ${C.navy}\u2699${RESET}${C.silver}v${stats.algorithmVersion}${RESET}`,
    `${C.steel}${BOX.h.repeat(14)}${RESET}`,
    `${C.lightBlue}\u2726${RESET}${C.silver}${stats.skills}${RESET} ${C.skyBlue}\u21BB${RESET}${C.iceBlue}${stats.workflows}${RESET} ${C.royalBlue}\u21AA${RESET}${C.periwinkle}${stats.hooks}${RESET}`,
    ``,
  ];

  const gap = " ";
  const totalContentWidth = LOGO_WIDTH + gap.length + 16;
  const leftPad = Math.floor((width - totalContentWidth) / 2);
  const pad = " ".repeat(Math.max(1, leftPad));

  const lines: string[] = [""];

  for (let i = 0; i < logo.length; i++) {
    lines.push(`${pad}${padEnd(logo[i], LOGO_WIDTH)}${gap}${infoLines[i] || ""}`);
  }
  lines.push("");

  return lines.join("\n");
}

// Ultra-compact Banner (<45 cols) - Text only, vertical
function createNavyUltraCompactBanner(stats: SystemStats, width: number): string {
  const C = getNavyColors();

  const paiColored = `${C.navy}P${RESET}${C.medBlue}A${RESET}${C.lightBlue}I${RESET}`;

  const lines: string[] = [""];
  lines.push(center(paiColored, width));
  lines.push(center(`${C.lightBlue}${stats.name}${RESET}${C.slate}@pai v${stats.paiVersion}${RESET} ${C.navy}\u2699${RESET}${C.silver}v${stats.algorithmVersion}${RESET}`, width));
  lines.push(center(`${C.steel}${BOX.h.repeat(Math.min(20, width - 4))}${RESET}`, width));
  lines.push(center(`${C.lightBlue}\u2726${RESET}${C.silver}${stats.skills}${RESET} ${C.skyBlue}\u21BB${RESET}${C.iceBlue}${stats.workflows}${RESET} ${C.royalBlue}\u21AA${RESET}${C.periwinkle}${stats.hooks}${RESET}`, width));
  lines.push("");

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Banner Selection - Width-based routing
// ═══════════════════════════════════════════════════════════════════════════

// Breakpoints for responsive Navy banner
const BREAKPOINTS = {
  FULL: 85,      // Full Navy with border
  MEDIUM: 70,    // No border, full content
  COMPACT: 55,   // Small logo, reduced info
  MINIMAL: 45,   // Very condensed
  // Below 45: Ultra-compact text only
};

type DesignName = "navy" | "navy-medium" | "navy-compact" | "navy-minimal" | "navy-ultra" | "electric" | "teal" | "ice";
const ALL_DESIGNS: DesignName[] = ["navy", "navy-medium", "navy-compact", "navy-minimal", "navy-ultra", "electric", "teal", "ice"];

function createBanner(forceDesign?: string): string {
  const width = getTerminalWidth();
  const stats = getStats();

  // If a specific design is requested (for --design= flag or --test mode)
  if (forceDesign) {
    switch (forceDesign) {
      case "navy": return createNavyBanner(stats, width);
      case "navy-medium": return createNavyMediumBanner(stats, width);
      case "navy-compact": return createNavyCompactBanner(stats, width);
      case "navy-minimal": return createNavyMinimalBanner(stats, width);
      case "navy-ultra": return createNavyUltraCompactBanner(stats, width);
      case "electric": return createElectricBanner(stats, width);
      case "teal": return createTealBanner(stats, width);
      case "ice": return createIceBanner(stats, width);
    }
  }

  // Width-based responsive routing (Navy theme only)
  if (width >= BREAKPOINTS.FULL) {
    return createNavyBanner(stats, width);
  } else if (width >= BREAKPOINTS.MEDIUM) {
    return createNavyMediumBanner(stats, width);
  } else if (width >= BREAKPOINTS.COMPACT) {
    return createNavyCompactBanner(stats, width);
  } else if (width >= BREAKPOINTS.MINIMAL) {
    return createNavyMinimalBanner(stats, width);
  } else {
    return createNavyUltraCompactBanner(stats, width);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const testMode = args.includes("--test");
const designArg = args.find(a => a.startsWith("--design="))?.split("=")[1];

try {
  if (testMode) {
    for (const design of ALL_DESIGNS) {
      console.log(`\n${"═".repeat(60)}`);
      console.log(`  DESIGN: ${design.toUpperCase()}`);
      console.log(`${"═".repeat(60)}`);
      console.log(createBanner(design));
    }
  } else {
    console.log(createBanner(designArg));
  }
} catch (e) {
  console.error("Banner error:", e);
}
