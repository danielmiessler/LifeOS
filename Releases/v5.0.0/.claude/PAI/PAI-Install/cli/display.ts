/**
 * PAI Installer v5.0 — CLI Display Helpers
 * ANSI colors, progress bars, banners, and formatted output.
 */

// ─── ANSI Colors ─────────────────────────────────────────────────

export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  blue: "\x1b[38;2;59;130;246m",
  lightBlue: "\x1b[38;2;147;197;253m",
  navy: "\x1b[38;2;30;58;138m",
  green: "\x1b[38;2;34;197;94m",
  yellow: "\x1b[38;2;234;179;8m",
  red: "\x1b[38;2;239;68;68m",
  gray: "\x1b[38;2;100;116;139m",
  steel: "\x1b[38;2;51;65;85m",
  silver: "\x1b[38;2;203;213;225m",
  white: "\x1b[38;2;203;213;225m",
  cyan: "\x1b[36m",
};

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export function print(text: string): void {
  process.stdout.write(text + "\n");
}

export function printSuccess(text: string): void {
  print(`  ${c.green}✓${c.reset} ${text}`);
}

export function printError(text: string): void {
  print(`  ${c.red}✗${c.reset} ${text}`);
}

export function printWarning(text: string): void {
  print(`  ${c.yellow}⚠${c.reset} ${text}`);
}

export function printInfo(text: string): void {
  print(`  ${c.blue}ℹ${c.reset} ${text}`);
}

export function printStep(num: number, total: number, name: string): void {
  // Loud, unambiguous section frame — heavy double-line border in PAI blue,
  // step number prominent, generous whitespace above and below so the
  // reader's eye lands on it first when the wizard moves to a new section.
  const label = ` STEP ${num} / ${total}  —  ${name.toUpperCase()} `;
  const inner = label.length;
  const border = "═".repeat(inner);
  print("");
  print("");
  print(`  ${c.blue}╔${border}╗${c.reset}`);
  print(`  ${c.blue}║${c.bold}${c.lightBlue}${label}${c.reset}${c.blue}║${c.reset}`);
  print(`  ${c.blue}╚${border}╝${c.reset}`);
  print("");
}

function padVisible(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleLength(text)));
}

export function printSectionHeader(title: string, subtitle?: string, stepNumber?: number): void {
  const stepLabel = stepNumber ? `Step ${stepNumber}/9` : "";
  const leftLabel = `${c.bold}${c.white}▸ ${title}${c.reset}`;
  const innerWidth = Math.max(
    53,
    visibleLength(`▸ ${title}`) + (stepLabel ? stepLabel.length + 4 : 0),
    subtitle ? subtitle.length + 4 : 0
  );
  const rightPadding = stepLabel ? Math.max(2, innerWidth - visibleLength(`▸ ${title}`) - stepLabel.length) : 0;

  print("");
  print(`  ${c.lightBlue}╭${"─".repeat(innerWidth + 2)}╮${c.reset}`);
  print(`  ${c.lightBlue}│${c.reset} ${leftLabel}${stepLabel ? `${" ".repeat(rightPadding)}${c.gray}${stepLabel}${c.reset}` : padVisible("", innerWidth)} ${c.lightBlue}│${c.reset}`);
  if (subtitle) {
    print(`  ${c.lightBlue}│${c.reset} ${c.gray}${padVisible(subtitle, innerWidth)}${c.reset} ${c.lightBlue}│${c.reset}`);
  }
  print(`  ${c.lightBlue}╰${"─".repeat(innerWidth + 2)}╯${c.reset}`);
}

/**
 * Render a question prompt with a distinct visual frame so it stands out
 * from informational messages and progress lines. The wizard's answers go
 * BELOW the box; the question stays inside. Used by cli/prompts.ts for
 * promptText / promptChoice / promptConfirm / promptSecret.
 */
function visibleLength(text: string): number {
  return text.replace(ANSI_PATTERN, "").length;
}

export function printQuestion(text: string, daName: string = "{{DA_NAME}}"): void {
  const borderColor = c.lightBlue;
  const header = `${daName} asks`;
  const lines = text.split("\n");
  const innerWidth = Math.max(header.length, ...lines.map(visibleLength));

  print("");
  print(`  ${borderColor}╭─ ${header} ${"─".repeat(Math.max(0, innerWidth - header.length))}╮${c.reset}`);
  for (const line of lines) {
    print(`  ${borderColor}│${c.reset} ${c.white}${line}${c.reset}${" ".repeat(Math.max(0, innerWidth - visibleLength(line)))} ${borderColor}│${c.reset}`);
  }
  print(`  ${borderColor}╰${"─".repeat(innerWidth + 2)}╯${c.reset}`);
}

// ─── Progress Bar ────────────────────────────────────────────────

export function progressBar(percent: number, width: number = 30): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `${c.blue}${"▓".repeat(filled)}${c.gray}${"░".repeat(empty)}${c.reset} ${percent}%`;
}

// ─── Banner ──────────────────────────────────────────────────────

export function printBanner(): void {
  const sep = `${c.steel}│${c.reset}`;
  const bar = `${c.steel}────────────────────────${c.reset}`;

  print("");
  print(`${c.steel}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${c.reset}`);
  print("");
  print(`                      ${c.navy}P${c.reset}${c.blue}A${c.reset}${c.lightBlue}I${c.reset} ${c.steel}|${c.reset} ${c.gray}Personal AI Infrastructure${c.reset}`);
  print("");
  print(`                     ${c.italic}${c.lightBlue}"Magnifying human capabilities..."${c.reset}`);
  print("");
  print("");
  print(`           ${c.navy}████████████████${c.reset}${c.lightBlue}████${c.reset}   ${sep}  ${c.gray}"${c.reset}${c.lightBlue}{{DA_NAME}} here, ready to go${c.reset}${c.gray}..."${c.reset}`);
  print(`           ${c.navy}████████████████${c.reset}${c.lightBlue}████${c.reset}   ${sep}  ${bar}`);
  print(`           ${c.navy}████${c.reset}        ${c.navy}████${c.reset}${c.lightBlue}████${c.reset}   ${sep}  ${c.navy}⬢${c.reset}  ${c.gray}PAI${c.reset}       ${c.silver}v5.0.0${c.reset}`);
  print(`           ${c.navy}████${c.reset}        ${c.navy}████${c.reset}${c.lightBlue}████${c.reset}   ${sep}  ${c.navy}⚙${c.reset}  ${c.gray}Algo${c.reset}      ${c.silver}v6.3.0${c.reset}`);
  print(`           ${c.navy}████████████████${c.reset}${c.lightBlue}████${c.reset}   ${sep}  ${c.lightBlue}✦${c.reset}  ${c.gray}Installer${c.reset} ${c.silver}v5.0${c.reset}`);
  print(`           ${c.navy}████████████████${c.reset}${c.lightBlue}████${c.reset}   ${sep}  ${bar}`);
  print(`           ${c.navy}████${c.reset}        ${c.blue}████${c.reset}${c.lightBlue}████${c.reset}   ${sep}`);
  print(`           ${c.navy}████${c.reset}        ${c.blue}████${c.reset}${c.lightBlue}████${c.reset}   ${sep}  ${c.yellow}⚠  Alpha — rough edges expected${c.reset}`);
  print(`           ${c.navy}████${c.reset}        ${c.blue}████${c.reset}${c.lightBlue}████${c.reset}   ${sep}`);
  print(`           ${c.navy}████${c.reset}        ${c.blue}████${c.reset}${c.lightBlue}████${c.reset}   ${sep}`);
  print("");
  print("");
  print(`                       ${c.steel}→${c.reset} ${c.blue}github.com/danielmiessler/PAI${c.reset}`);
  print("");
  print(`${c.steel}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${c.reset}`);
  print("");
}

// ─── Detection Display ───────────────────────────────────────────

import type { DetectionResult } from "../engine/types";

export function printDetection(det: DetectionResult): void {
  printSuccess(`Operating System: ${det.os.name} (${det.os.arch})`);
  printSuccess(`Shell: ${det.shell.name} ${det.shell.version ? `v${det.shell.version.substring(0, 20)}` : ""}`);

  if (det.tools.bun.installed) {
    printSuccess(`Bun: v${det.tools.bun.version}`);
  } else {
    printError("Bun: not found — will install");
  }

  if (det.tools.git.installed) {
    printSuccess(`Git: v${det.tools.git.version}`);
  } else {
    printError("Git: not found — will install");
  }

  if (det.tools.claude.installed) {
    printSuccess(`Claude Code: v${det.tools.claude.version}`);
  } else {
    printWarning("Claude Code: not found — will install");
  }

  if (det.existing.paiInstalled) {
    printInfo(`Existing PAI: v${det.existing.paiVersion || "unknown"} (fresh install will restore from backup if you allow it)`);
  } else {
    printInfo("Existing PAI: not detected (fresh install)");
  }

  // Scan-first findings — surface pre-fillable values so the user sees what
  // the wizard already has answers for.
  if (det.principal?.name) {
    printSuccess(`Detected name: ${det.principal.name}`);
  }
  if (det.principal?.email) {
    printInfo(`Detected email: ${det.principal.email}`);
  }
  if (det.existing.daName) {
    printSuccess(`Detected DA name: ${det.existing.daName} (from prior install/backup)`);
  }
  const apiHits: string[] = [];
  if (det.existing.apiKeys?.anthropic) apiHits.push("Anthropic");
  if (det.existing.apiKeys?.openai) apiHits.push("OpenAI");
  if (det.existing.apiKeys?.google) apiHits.push("Google");
  if (det.existing.apiKeys?.xai) apiHits.push("xAI/Grok");
  if (det.existing.apiKeys?.perplexity) apiHits.push("Perplexity");
  if (apiHits.length > 0) {
    printSuccess(`Detected API keys: ${apiHits.join(", ")} (from shell rc files / .env)`);
  }

  printInfo(`Timezone: ${det.timezone}`);
}

// ─── Validation Display ──────────────────────────────────────────

import type { ValidationCheck, InstallSummary } from "../engine/types";

export function printValidation(checks: ValidationCheck[]): void {
  print("");
  print(`${c.bold}  Validation Results${c.reset}`);
  print(`${c.gray}  ${"─".repeat(40)}${c.reset}`);

  for (const check of checks) {
    if (check.passed) {
      printSuccess(`${check.name}: ${check.detail}`);
    } else if (check.critical) {
      printError(`${check.name}: ${check.detail}`);
    } else {
      printWarning(`${check.name}: ${check.detail}`);
    }
  }
}

export function printSummary(summary: InstallSummary): void {
  const installTypeLabel = summary.installType === "upgrade" ? "fresh + backup migration" : "fresh";

  print("");
  print(`${c.navy}╔══════════════════════════════════════════════════╗${c.reset}`);
  print(`${c.navy}║${c.reset}  ${c.green}${c.bold}SYSTEM ONLINE${c.reset}                                    ${c.navy}║${c.reset}`);
  print(`${c.navy}╠══════════════════════════════════════════════════╣${c.reset}`);
  print(`${c.navy}║${c.reset}  PAI Version:  ${c.white}v${summary.paiVersion}${c.reset}                             ${c.navy}║${c.reset}`);
  print(`${c.navy}║${c.reset}  Principal:    ${c.white}${summary.principalName}${c.reset}${" ".repeat(Math.max(0, 33 - summary.principalName.length))}${c.navy}║${c.reset}`);
  print(`${c.navy}║${c.reset}  AI Name:      ${c.white}${summary.aiName}${c.reset}${" ".repeat(Math.max(0, 33 - summary.aiName.length))}${c.navy}║${c.reset}`);
  print(`${c.navy}║${c.reset}  Timezone:     ${c.white}${summary.timezone}${c.reset}${" ".repeat(Math.max(0, 33 - summary.timezone.length))}${c.navy}║${c.reset}`);
  print(`${c.navy}║${c.reset}  Install Type: ${c.white}${installTypeLabel}${c.reset}${" ".repeat(Math.max(0, 33 - installTypeLabel.length))}${c.navy}║${c.reset}`);
  print(`${c.navy}╠══════════════════════════════════════════════════╣${c.reset}`);
  print(`${c.navy}║${c.reset}                                                  ${c.navy}║${c.reset}`);
  print(`${c.navy}║${c.reset}  ${c.lightBlue}Run: ${c.bold}source ~/.zshrc && pai${c.reset}                      ${c.navy}║${c.reset}`);
  print(`${c.navy}║${c.reset}                                                  ${c.navy}║${c.reset}`);
  print(`${c.navy}╚══════════════════════════════════════════════════╝${c.reset}`);
  print("");
}
