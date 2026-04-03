#!/usr/bin/env bun

/**
 * Banner - Tokyo Night Theme
 * Deep blue-black with soft neon accents
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

// Tokyo Night palette
const BG_DARK = "\x1b[38;2;26;27;38m";      // #1a1b26
const FG = "\x1b[38;2;169;177;214m";         // #a9b1d6 lavender
const CYAN = "\x1b[38;2;125;207;255m";       // #7dcfff
const BLUE = "\x1b[38;2;122;162;247m";       // #7aa2f7
const MAGENTA = "\x1b[38;2;187;154;247m";    // #bb9af7
const PURPLE = "\x1b[38;2;157;124;216m";     // #9d7cd8
const GREEN = "\x1b[38;2;158;206;106m";      // #9ece6a
const ORANGE = "\x1b[38;2;255;158;100m";     // #ff9e64
const RED = "\x1b[38;2;247;118;142m";        // #f7768e
const COMMENT = "\x1b[38;2;86;95;137m";      // #565f89
const DARK = "\x1b[38;2;52;59;88m";          // darker comment

// ═══════════════════════════════════════════════════════════════
// DESIGN A: TOKYO DRIFT
// ═══════════════════════════════════════════════════════════════
function designA(): string {
  return `
${COMMENT}┌──────────────────────────────────────────────────────────────────
${COMMENT}│${RESET}
${COMMENT}│${RESET}  ${DIM}${FG}welcome to your${RESET}
${COMMENT}│${RESET}
${COMMENT}│${RESET}  ${BOLD}${BLUE}██╗  ██╗${MAGENTA} █████╗ ${CYAN}██╗${RESET}
${COMMENT}│${RESET}  ${BOLD}${BLUE}██║ ██╔╝${MAGENTA}██╔══██╗${CYAN}██║${RESET}
${COMMENT}│${RESET}  ${BOLD}${BLUE}█████╔╝ ${MAGENTA}███████║${CYAN}██║${RESET}      ${DARK}░░░░░░░░░░░░░░░░░░░░░${RESET}
${COMMENT}│${RESET}  ${BOLD}${BLUE}██╔═██╗ ${MAGENTA}██╔══██║${CYAN}██║${RESET}      ${COMMENT}personal ai system${RESET}
${COMMENT}│${RESET}  ${BOLD}${BLUE}██║  ██╗${MAGENTA}██║  ██║${CYAN}██║${RESET}      ${DARK}░░░░░░░░░░░░░░░░░░░░░${RESET}
${COMMENT}│${RESET}  ${BOLD}${BLUE}╚═╝  ╚═╝${MAGENTA}╚═╝  ╚═╝${CYAN}╚═╝${RESET}
${COMMENT}│${RESET}
${COMMENT}│${RESET}  ${GREEN}✓${RESET} ${DIM}${FG}core loaded${RESET}
${COMMENT}│${RESET}
${COMMENT}└──────────────────────────────────────────────────────────────────
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN B: NEON TOKYO
// ═══════════════════════════════════════════════════════════════
function designB(): string {
  return `
${DARK}▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀${RESET}
${MAGENTA}░${RESET} ${BOLD}${FG}WELCOME TO YOUR PAI SYSTEM${RESET}
${DARK}▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄${RESET}

  ${BOLD}${MAGENTA}    ██╗  ██╗${RESET}${BOLD}${BLUE} █████╗ ${RESET}${BOLD}${CYAN}██╗${RESET}
  ${BOLD}${MAGENTA}    ██║ ██╔╝${RESET}${BOLD}${BLUE}██╔══██╗${RESET}${BOLD}${CYAN}██║${RESET}
  ${BOLD}${MAGENTA}    █████╔╝ ${RESET}${BOLD}${BLUE}███████║${RESET}${BOLD}${CYAN}██║${RESET}
  ${BOLD}${MAGENTA}    ██╔═██╗ ${RESET}${BOLD}${BLUE}██╔══██║${RESET}${BOLD}${CYAN}██║${RESET}
  ${BOLD}${MAGENTA}    ██║  ██╗${RESET}${BOLD}${BLUE}██║  ██║${RESET}${BOLD}${CYAN}██║${RESET}
  ${BOLD}${MAGENTA}    ╚═╝  ╚═╝${RESET}${BOLD}${BLUE}╚═╝  ╚═╝${RESET}${BOLD}${CYAN}╚═╝${RESET}

${DARK}───────────────────────────────────────────────────────────────${RESET}
  ${GREEN}✓${RESET} ${COMMENT}core${RESET}    ${GREEN}✓${RESET} ${COMMENT}skills${RESET}    ${GREEN}✓${RESET} ${COMMENT}hooks${RESET}    ${GREEN}✓${RESET} ${COMMENT}memory${RESET}
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN C: MINIMAL TOKYO
// ═══════════════════════════════════════════════════════════════
function designC(): string {
  return `
${BLUE}╭─${RESET}${BOLD}${FG} PAI ${RESET}${BLUE}─────────────────────────────────────────────────────────
${BLUE}│${RESET}
${BLUE}│${RESET}   ${BOLD}${MAGENTA}K${BLUE}A${CYAN}I${RESET}
${BLUE}│${RESET}
${BLUE}│${RESET}   ${COMMENT}▸ welcome to your personal ai system${RESET}
${BLUE}│${RESET}
${BLUE}│${RESET}   ${GREEN}■${RESET} ${DIM}${FG}core${RESET}       ${DARK}━━━━━━━━━━━━${RESET}  ${GREEN}online${RESET}
${BLUE}│${RESET}   ${GREEN}■${RESET} ${DIM}${FG}skills${RESET}     ${DARK}━━━━━━━━━━━━${RESET}  ${GREEN}loaded${RESET}
${BLUE}│${RESET}   ${GREEN}■${RESET} ${DIM}${FG}memory${RESET}     ${DARK}━━━━━━━━━━━━${RESET}  ${GREEN}active${RESET}
${BLUE}│${RESET}
${BLUE}╰──────────────────────────────────────────────────────────────────
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN D: TOKYO GLITCH
// ═══════════════════════════════════════════════════════════════
function designD(): string {
  return `
${DARK}░▒▓${MAGENTA}█${RESET}${BOLD}${FG} WELCOME TO YOUR PAI SYSTEM ${RESET}${MAGENTA}█${DARK}▓▒░${RESET}

${COMMENT}    ██╗  ██╗ █████╗ ██╗${RESET}
${BLUE}    ██║ ██╔╝██╔══██╗██║${RESET}      ${DARK}░░░░░░░░░░░░░░░░${RESET}
${BLUE}    █████╔╝ ███████║██║${RESET}      ${DARK}▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒${RESET}
${MAGENTA}    ██╔═██╗ ██╔══██║██║${RESET}      ${COMMENT}personal ai${RESET}
${MAGENTA}    ██║  ██╗██║  ██║██║${RESET}      ${DARK}▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒${RESET}
${PURPLE}    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝${RESET}      ${DARK}░░░░░░░░░░░░░░░░${RESET}

${DARK}──────────────────────────────────────────────────────────────${RESET}
  ${GREEN}✓${RESET} ${COMMENT}CORE LOADED${RESET}    ${DARK}│${RESET} ${COMMENT}v2.0${RESET}    ${DARK}│${RESET} ${COMMENT}${new Date().toISOString().split('T')[0]}${RESET}
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN E: TOKYO STORM (dramatic)
// ═══════════════════════════════════════════════════════════════
function designE(): string {
  return `
${PURPLE}════════════════════════════════════════════════════════════════${RESET}

  ${DIM}${COMMENT}// welcome to your${RESET}

  ${BOLD}${BLUE}    ▄█▀▀█▄  ${MAGENTA}▄█▀▀█▄  ${CYAN}▀█▀${RESET}
  ${BOLD}${BLUE}    █▄▀▀▄█  ${MAGENTA}█▄▀▀█▄  ${CYAN} █ ${RESET}
  ${BOLD}${BLUE}    █  ▀▀█  ${MAGENTA}█  ▀▀█  ${CYAN} █ ${RESET}
  ${BOLD}${BLUE}    ▀█▄▄█▀  ${MAGENTA}▀█▄▄█▀  ${CYAN}▄█▄${RESET}

  ${DIM}${COMMENT}// personal ai system${RESET}

${PURPLE}════════════════════════════════════════════════════════════════${RESET}
  ${GREEN}◉${RESET} ${COMMENT}core${RESET}    ${GREEN}◉${RESET} ${COMMENT}skills${RESET}    ${GREEN}◉${RESET} ${COMMENT}memory${RESET}    ${GREEN}◉${RESET} ${COMMENT}agents${RESET}
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN F: TOKYO TERMINAL
// ═══════════════════════════════════════════════════════════════
function designF(): string {
  const hex = () => Math.floor(Math.random()*256).toString(16).padStart(2,'0');
  return `
${BLUE}╭──────────────────────────────────────────────────────────────────
${BLUE}│${RESET}
${BLUE}│${RESET}  ${DARK}0x${hex()}${hex()}${RESET}  ${BOLD}${MAGENTA}K${BLUE}A${CYAN}I${RESET}  ${DARK}:: ${COMMENT}personal ai system${RESET}
${BLUE}│${RESET}
${BLUE}│${RESET}  ${COMMENT}welcome to your pai system${RESET}
${BLUE}│${RESET}
${BLUE}│${RESET}  ${GREEN}▪${RESET} ${FG}core${RESET}     ${DARK}────────${RESET} ${GREEN}online${RESET}
${BLUE}│${RESET}  ${GREEN}▪${RESET} ${FG}skills${RESET}   ${DARK}────────${RESET} ${GREEN}63 loaded${RESET}
${BLUE}│${RESET}  ${GREEN}▪${RESET} ${FG}memory${RESET}   ${DARK}────────${RESET} ${GREEN}active${RESET}
${BLUE}│${RESET}
${BLUE}╰──────────────────────────────────────────────────────────────────
`;
}

// Print all designs
console.log("\n" + "═".repeat(70));
console.log(" DESIGN A: TOKYO DRIFT");
console.log("═".repeat(70));
console.log(designA());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN B: NEON TOKYO");
console.log("═".repeat(70));
console.log(designB());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN C: MINIMAL TOKYO");
console.log("═".repeat(70));
console.log(designC());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN D: TOKYO GLITCH");
console.log("═".repeat(70));
console.log(designD());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN E: TOKYO STORM");
console.log("═".repeat(70));
console.log(designE());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN F: TOKYO TERMINAL");
console.log("═".repeat(70));
console.log(designF());
