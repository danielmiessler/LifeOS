/**
 * PAI Installer v5.0 — CLI Wizard
 * Interactive command-line installation experience.
 */

import type { EngineEvent, InstallState, StepId } from "../engine/types";
import { STEPS, getProgress } from "../engine/steps";
import {
  createFreshState,
  hasSavedState,
  loadState,
  saveState,
  clearState,
  completeStep,
} from "../engine/state";
import {
  runSystemDetect,
  runPrerequisites,
  runApiKeys,
  runIdentity,
  runRepository,
  runConfiguration,
  runPulseSetup,
  runTelegramSetup,
} from "../engine/actions";
import { runValidation, generateSummary } from "../engine/validate";
import {
  printBanner,
  printStep,
  printSectionHeader,
  printDetection,
  printValidation,
  printSummary,
  print,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  progressBar,
  c,
} from "./display";
import { promptText, promptSecret, promptChoice, promptConfirm } from "./prompts";

type CLIChoice = {
  label: string;
  value: string;
  description?: string;
};

/**
 * Handle engine events in CLI mode.
 */
function createEventHandler(): (event: EngineEvent) => void {
  return (event: EngineEvent) => {
    switch (event.event) {
      case "step_start":
        // Handled by the main loop with printStep
        break;
      case "section_header":
        printSectionHeader(event.title, event.subtitle, event.stepNumber);
        break;
      case "step_complete":
        printSuccess("Step complete");
        break;
      case "step_skip":
        printInfo(`Skipped: ${event.reason}`);
        break;
      case "step_error":
        printError(`Error: ${event.error}`);
        break;
      case "progress":
        print(`  ${progressBar(event.percent)} ${c.gray}${event.detail}${c.reset}`);
        break;
      case "message":
        print(`\n  ${event.content}\n`);
        break;
      case "error":
        printError(event.message);
        break;
    }
  };
}

/**
 * CLI input adapter — bridges engine's input requests to readline prompts.
 */
async function getInput(
  id: string,
  prompt: string,
  type: "text" | "password" | "key",
  placeholder?: string,
  daName?: string
): Promise<string> {
  if (type === "key" || type === "password") {
    return promptSecret(prompt, placeholder, daName);
  }
  return promptText(prompt, placeholder, daName);
}

/**
 * CLI choice adapter.
 */
async function getChoice(
  id: string,
  prompt: string,
  choices: CLIChoice[],
  daName?: string
): Promise<string> {
  return promptChoice(prompt, choices, daName);
}

/**
 * Run the full CLI installation wizard.
 */
export async function runCLI(): Promise<void> {
  printBanner();

  const emit = createEventHandler();

  // Check for resume
  let state: InstallState;

  if (hasSavedState()) {
    const saved = loadState();
    if (saved) {
      print(`  ${c.yellow}Found previous installation in progress.${c.reset}`);
      print(`  ${c.gray}Started: ${saved.startedAt}${c.reset}`);
      print(`  ${c.gray}Progress: ${getProgress(saved)}% (${saved.completedSteps.length} steps completed)${c.reset}`);
      print("");

      const resume = await promptConfirm("Resume previous installation?");
      if (resume) {
        state = saved;
        state.mode = "cli";
        print(`\n  ${c.green}Resuming from step: ${state.currentStep}${c.reset}\n`);
      } else {
        state = createFreshState("cli");
      }
    } else {
      state = createFreshState("cli");
    }
  } else {
    state = createFreshState("cli");
  }

  try {
    // ── Step 1: System Detection ──
    if (!state.completedSteps.includes("system-detect")) {
      const step = STEPS[0];
      printStep(step.number, 9, step.name);
      const detection = await runSystemDetect(state, emit, getChoice);
      printDetection(detection);
      completeStep(state, "system-detect");
      state.currentStep = "prerequisites";
    }

    // ── Step 2: Prerequisites ──
    if (!state.completedSteps.includes("prerequisites")) {
      const step = STEPS[1];
      printStep(step.number, 9, step.name);
      await runPrerequisites(state, emit);
      completeStep(state, "prerequisites");
      state.currentStep = "api-keys";
    }

    // ── Step 3: API Keys ──
    if (!state.completedSteps.includes("api-keys")) {
      const step = STEPS[2];
      printStep(step.number, 9, step.name);
      await runApiKeys(state, emit, getInput, getChoice);
      completeStep(state, "api-keys");
      state.currentStep = "identity";
    }

    // ── Step 4: Identity ──
    if (!state.completedSteps.includes("identity")) {
      const step = STEPS[3];
      printStep(step.number, 9, step.name);
      await runIdentity(state, emit, getInput);
      completeStep(state, "identity");
      state.currentStep = "repository";
    }

    // ── Step 5: Repository ──
    if (!state.completedSteps.includes("repository")) {
      const step = STEPS[4];
      printStep(step.number, 9, step.name);
      await runRepository(state, emit);
      completeStep(state, "repository");
      state.currentStep = "configuration";
    }

    // ── Step 6: Configuration ──
    if (!state.completedSteps.includes("configuration")) {
      const step = STEPS[5];
      printStep(step.number, 9, step.name);
      await runConfiguration(state, emit);
      completeStep(state, "configuration");
      state.currentStep = "pulse";
    }

    // ── Step 7: Pulse ──
    if (!state.completedSteps.includes("pulse") && !state.skippedSteps.includes("pulse")) {
      const step = STEPS[6];
      printStep(step.number, 9, step.name);
      await runPulseSetup(state, emit, getChoice);
      completeStep(state, "pulse");
      state.currentStep = "telegram";
    }

    // ── Step 8: Telegram (optional) ──
    if (!state.completedSteps.includes("telegram") && !state.skippedSteps.includes("telegram")) {
      const step = STEPS[7];
      printStep(step.number, 9, step.name);
      await runTelegramSetup(state, emit, getChoice, getInput);
      // runTelegramSetup either completes or marks the step skipped internally;
      // ensure something is recorded so the loop advances.
      if (!state.completedSteps.includes("telegram") && !state.skippedSteps.includes("telegram")) {
        completeStep(state, "telegram");
      }
      state.currentStep = "validation";
    }

    // ── Step 9: Validation ──
    if (!state.completedSteps.includes("validation")) {
      const step = STEPS[8];
      printStep(step.number, 9, step.name);

      const checks = await runValidation(state, emit);
      printValidation(checks);

      const allCritical = checks.filter((c) => c.critical).every((c) => c.passed);
      if (allCritical) {
        completeStep(state, "validation");
      } else {
        printError("\nSome critical checks failed. Please review and fix the issues above.");
      }
    }

    // ── Summary ──
    const summary = generateSummary(state);
    printSummary(summary);

    // Clean up state file on success
    clearState();

    print(`  ${c.green}${c.bold}Installation complete!${c.reset}`);
    print("");
    print(`  ${c.lightBlue}${c.bold}You have a working PAI, but it's a generic shell.${c.reset}`);
    print(`  ${c.gray}To make it ${c.bold}yours${c.reset}${c.gray}, you tell it who you are, what you're working on,${c.reset}`);
    print(`  ${c.gray}and how you think. Two paths to do that:${c.reset}`);
    print("");
    print(`  ${c.lightBlue}${c.bold}Fast path — let the DA interview you:${c.reset}`);
    print(`  ${c.gray}1.${c.reset} Run ${c.bold}source ~/.zshrc && pai${c.reset}${c.gray} to launch PAI.${c.reset}`);
    print(`  ${c.gray}2.${c.reset} Type ${c.bold}/interview${c.reset}${c.gray} — the DA walks through TELOS, identity, projects, preferences. Pause and resume anytime.${c.reset}`);
    print(`     ${c.gray}(Already have goals/journals/notes in Obsidian, Notion, etc.? Run the ${c.bold}Migrate${c.reset}${c.gray} skill first so the interview fills gaps instead of asking you to re-type.)${c.reset}`);
    print("");
    print(`  ${c.lightBlue}${c.bold}Manual path — edit the files yourself:${c.reset}`);
    print(`  ${c.gray}Each subdirectory under ~/.claude/PAI/USER/ has a README.md explaining what goes inside and how to customize it.${c.reset}`);
    print(`  ${c.gray}Start with:${c.reset}`);
    print(`     ${c.bold}~/.claude/PAI/USER/README.md${c.reset}             ${c.gray}— full layout map${c.reset}`);
    print(`     ${c.bold}~/.claude/PAI/USER/TELOS/README.md${c.reset}       ${c.gray}— missions, goals, problems, strategies${c.reset}`);
    print(`     ${c.bold}~/.claude/PAI/USER/DA/README.md${c.reset}          ${c.gray}— your DA's identity and personality${c.reset}`);
    print(`     ${c.bold}~/.claude/PAI/USER/PROJECTS/README.md${c.reset}    ${c.gray}— project registry + routing aliases${c.reset}`);
    print(`     ${c.bold}~/.claude/PAI/USER/SECURITY/README.md${c.reset}    ${c.gray}— bash/path rules (already has working defaults)${c.reset}`);
    print(`     ${c.bold}~/.claude/PAI/USER/Config/README.md${c.reset}      ${c.gray}— credentials and PAI config${c.reset}`);
    print("");
    print(`  ${c.lightBlue}${c.bold}While you're here:${c.reset}`);
    print(`  ${c.gray}•${c.reset} Visit the Life Dashboard at ${c.bold}http://localhost:31337${c.reset}${c.gray} (Pulse).${c.reset}`);
    print(`  ${c.gray}•${c.reset} Anything you write under ${c.bold}PAI/USER/${c.reset}${c.gray} stays on your machine — it never ships in any PAI release.${c.reset}`);
    print("");

    process.exit(0);
  } catch (error: any) {
    printError(`\nInstallation failed: ${error.message}`);
    printInfo("Your progress has been saved. Run the installer again to resume.");
    saveState(state);
    process.exit(1);
  }
}
