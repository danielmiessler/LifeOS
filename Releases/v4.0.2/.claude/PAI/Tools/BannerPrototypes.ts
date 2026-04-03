#!/usr/bin/env bun

/**
 * Banner Prototypes - Testing different cyberpunk designs
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

// Cyberpunk color palette
const CYAN = "\x1b[38;2;0;255;255m";
const MAGENTA = "\x1b[38;2;255;0;255m";
const NEON_BLUE = "\x1b[38;2;0;150;255m";
const NEON_PINK = "\x1b[38;2;255;50;150m";
const GREEN = "\x1b[38;2;0;255;136m";
const ORANGE = "\x1b[38;2;255;150;0m";
const WHITE = "\x1b[38;2;255;255;255m";
const GRAY = "\x1b[38;2;100;100;100m";
const DARK = "\x1b[38;2;50;50;60m";

// ═══════════════════════════════════════════════════════════════
// DESIGN 1: GLITCH CYBERPUNK
// ═══════════════════════════════════════════════════════════════
function design1_glitch(): string {
  const glitchChars = "░▒▓█▀▄▌▐╳╱╲";
  const randomGlitch = () => glitchChars[Math.floor(Math.random() * glitchChars.length)];

  return `
${DARK}░▒▓${CYAN}█${RESET}${BOLD}${CYAN} WELCOME TO YOUR PAI SYSTEM ${RESET}${CYAN}█${DARK}▓▒░░▒▓▒░${RESET}

${GRAY}    ██╗  ██╗ █████╗ ██╗${RESET}
${CYAN}    ██║ ██╔╝██╔══██╗██║${RESET}      ${DARK}░░░░░░░░░░░░░░░${RESET}
${NEON_BLUE}    █████╔╝ ███████║██║${RESET}      ${DARK}▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒${RESET}
${MAGENTA}    ██╔═██╗ ██╔══██║██║${RESET}      ${DARK}░ ${DIM}sys.init${RESET}${DARK} ░░░░░${RESET}
${NEON_PINK}    ██║  ██╗██║  ██║██║${RESET}      ${DARK}▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒${RESET}
${GRAY}    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝${RESET}      ${DARK}░░░░░░░░░░░░░░░${RESET}

${DARK}──────────────────────────────────────────────────────────${RESET}
  ${GREEN}✓${RESET} ${DIM}CORE LOADED${RESET}    ${DARK}│${RESET} ${DIM}v2.0${RESET}    ${DARK}│${RESET} ${DIM}${new Date().toISOString().split('T')[0]}${RESET}
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 2: HOLOGRAPHIC HUD
// ═══════════════════════════════════════════════════════════════
function design2_holo(): string {
  return `
${CYAN}┌──${RESET}${BOLD} WELCOME TO YOUR PAI SYSTEM ${RESET}${CYAN}────────────────────────────
${CYAN}│${RESET}
${CYAN}│${RESET}   ${BOLD}${WHITE}╦╔═${CYAN}╔═╗${NEON_PINK}╦${RESET}
${CYAN}│${RESET}   ${BOLD}${WHITE}╠╩╗${CYAN}╠═╣${NEON_PINK}║${RESET}          ${DIM}Personal AI Infrastructure${RESET}
${CYAN}│${RESET}   ${BOLD}${WHITE}╩ ╩${CYAN}╩ ╩${NEON_PINK}╩${RESET}
${CYAN}│${RESET}
${CYAN}│${RESET}   ${GREEN}●${RESET} ${DIM}CORE${RESET}    ${GREEN}●${RESET} ${DIM}SKILLS${RESET}    ${GREEN}●${RESET} ${DIM}HOOKS${RESET}
${CYAN}│${RESET}
${CYAN}└─────────────────────────────────────────────────────────────
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 3: MATRIX NOIR
// ═══════════════════════════════════════════════════════════════
function design3_matrix(): string {
  return `
${DARK}╔══════════════════════════════════════════════════════════════
${DARK}║${RESET}
${DARK}║${RESET}  ${DIM}welcome to your${RESET}
${DARK}║${RESET}
${DARK}║${RESET}  ${BOLD}${GREEN}██████╗  █████╗ ██╗${RESET}
${DARK}║${RESET}  ${BOLD}${GREEN}██╔══██╗██╔══██╗██║${RESET}     ${DARK}▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
${DARK}║${RESET}  ${BOLD}${GREEN}██████╔╝███████║██║${RESET}     ${DARK}░ personal ai ░░░░░░
${DARK}║${RESET}  ${BOLD}${GREEN}██╔═══╝ ██╔══██║██║${RESET}     ${DARK}░ infrastructure ░░░
${DARK}║${RESET}  ${BOLD}${GREEN}██║     ██║  ██║██║${RESET}     ${DARK}▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
${DARK}║${RESET}  ${BOLD}${GREEN}╚═╝     ╚═╝  ╚═╝╚═╝${RESET}
${DARK}║${RESET}
${DARK}║${RESET}  ${GREEN}[✓]${RESET} ${DIM}core.loaded${RESET}
${DARK}║${RESET}
${DARK}╚══════════════════════════════════════════════════════════════
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 4: NEON SCANLINES
// ═══════════════════════════════════════════════════════════════
function design4_scanlines(): string {
  return `
${DARK}▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀${RESET}
${CYAN}░░${RESET} ${BOLD}WELCOME TO YOUR PAI SYSTEM${RESET}
${DARK}▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄${RESET}

${NEON_PINK}     ▄█▀▀█▄  ${CYAN}▄█▀▀█▄  ${WHITE}▀█▀${RESET}
${NEON_PINK}     █▄▀▀▄█  ${CYAN}█▄▀▀█▄  ${WHITE} █ ${RESET}    ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}
${NEON_PINK}     █  ▀▀█  ${CYAN}█  ▀▀█  ${WHITE} █ ${RESET}    ${DIM}Personal AI Infrastructure${RESET}
${NEON_PINK}     ▀█▄▄█▀  ${CYAN}▀█▄▄█▀  ${WHITE}▄█▄${RESET}    ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}

${DARK}────────────────────────────────────────────────────────────────${RESET}
${GREEN}  ✓${RESET} ${DIM}CORE LOADED${RESET}                          ${DARK}[${DIM}init: 0.${Math.floor(Math.random()*900)+100}s${DARK}]${RESET}
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 5: MINIMAL BLADE RUNNER
// ═══════════════════════════════════════════════════════════════
function design5_blade(): string {
  return `
${ORANGE}▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓${RESET}

${DIM}    welcome to your${RESET}

${BOLD}${ORANGE}    ▄█▀▀▀█▄ █▀▀▀█ ▀█▀${RESET}
${BOLD}${ORANGE}    ██▄▄▄▀  █▀▀▀█  █ ${RESET}        ${DARK}┃${RESET} ${DIM}personal ai${RESET}
${BOLD}${ORANGE}    ██      █   █ ▄█▄${RESET}        ${DARK}┃${RESET} ${DIM}infrastructure${RESET}

${DARK}────────────────────────────────────────────────────────────────${RESET}
    ${GREEN}◉${RESET} ${DIM}core${RESET}    ${GREEN}◉${RESET} ${DIM}skills${RESET}    ${GREEN}◉${RESET} ${DIM}memory${RESET}    ${GREEN}◉${RESET} ${DIM}agents${RESET}
`;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN 6: GHOST IN THE SHELL
// ═══════════════════════════════════════════════════════════════
function design6_ghost(): string {
  const hex = () => Math.floor(Math.random()*256).toString(16).padStart(2,'0');
  return `
${CYAN}╭─────────────────────────────────────────────────────────────────
${CYAN}│${RESET}
${CYAN}│${RESET}  ${DARK}0x${hex()}${hex()}${RESET}  ${BOLD}${CYAN}K${NEON_BLUE}A${MAGENTA}I${RESET}  ${DARK}0x${hex()}${hex()}${RESET}
${CYAN}│${RESET}
${CYAN}│${RESET}  ${DIM}▸ welcome to your personal ai system${RESET}
${CYAN}│${RESET}
${CYAN}│${RESET}  ${GREEN}■${RESET} ${DIM}core${RESET}     ${DIM}────────────────${RESET} ${GREEN}online${RESET}
${CYAN}│${RESET}  ${GREEN}■${RESET} ${DIM}skills${RESET}   ${DIM}────────────────${RESET} ${GREEN}loaded${RESET}
${CYAN}│${RESET}  ${GREEN}■${RESET} ${DIM}memory${RESET}   ${DIM}────────────────${RESET} ${GREEN}active${RESET}
${CYAN}│${RESET}
${CYAN}╰─────────────────────────────────────────────────────────────────
`;
}

// Print all designs
console.log("\n" + "═".repeat(70));
console.log(" DESIGN 1: GLITCH CYBERPUNK");
console.log("═".repeat(70));
console.log(design1_glitch());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN 2: HOLOGRAPHIC HUD");
console.log("═".repeat(70));
console.log(design2_holo());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN 3: MATRIX NOIR");
console.log("═".repeat(70));
console.log(design3_matrix());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN 4: NEON SCANLINES");
console.log("═".repeat(70));
console.log(design4_scanlines());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN 5: MINIMAL BLADE RUNNER");
console.log("═".repeat(70));
console.log(design5_blade());

console.log("\n" + "═".repeat(70));
console.log(" DESIGN 6: GHOST IN THE SHELL");
console.log("═".repeat(70));
console.log(design6_ghost());
