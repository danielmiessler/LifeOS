/**
 * PAI Installer v5.0 — CLI Interactive Prompts
 * readline-based input collection with proper cleanup.
 *
 * Non-interactive mode: when PAI_TEST_AUTOMATED=1 or stdin is not a TTY
 * (CI, ssh-without-tty, headless test harnesses), every prompt returns the
 * documented sensible default without ever touching readline. This keeps
 * the wizard runnable end-to-end from automation.
 */

import * as readline from "readline";
import { c, print, printQuestion } from "./display";

const ANSWER_PREFIX = `  ${c.green}❯ you:${c.reset} `;

type PromptChoiceOption = {
  label: string;
  value: string;
  description?: string;
};

function isAutomated(): boolean {
  return process.env.PAI_TEST_AUTOMATED === "1" || process.stdin.isTTY === false;
}

/**
 * Prompt for text input with optional default value.
 *
 * In automated mode we return an empty string and let the caller's own
 * fallback ("User", "PAI", etc.) take effect. The `defaultValue` here is
 * really a UI placeholder hint ("Your name", "e.g., Atlas, Nova, Sage"),
 * NOT a sensible install-time default — returning it as the answer
 * persisted those literal hint strings into settings.json on automated
 * runs.
 */
export async function promptText(
  question: string,
  defaultValue?: string,
  daName?: string
): Promise<string> {
  if (isAutomated()) return "";

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const defaultHint = defaultValue ? ` ${c.gray}(default: ${defaultValue})${c.reset}` : "";

  printQuestion(question + defaultHint, daName);
  return new Promise<string>((resolve) => {
    rl.question(ANSWER_PREFIX, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

/**
 * Prompt for a password/key (masked input).
 */
export async function promptSecret(
  question: string,
  placeholder?: string,
  daName?: string
): Promise<string> {
  if (isAutomated()) return "";

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const hint = placeholder ? ` ${c.gray}(${placeholder})${c.reset}` : "";

  printQuestion(question + hint + `\n${c.dim}(input will be visible — paste your key)${c.reset}`, daName);
  return new Promise<string>((resolve) => {
    rl.question(ANSWER_PREFIX, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for a choice from a list.
 */
export async function promptChoice(
  question: string,
  choices: PromptChoiceOption[],
  daName?: string
): Promise<string> {
  if (isAutomated()) return choices[0]?.value ?? "";

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  printQuestion(question, daName);
  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    print(`  ${c.blue}${i + 1})${c.reset} ${c.bold}${choice.label}${c.reset}${choice.description ? ` ${c.gray}— ${choice.description}${c.reset}` : ""}`);
  }

  return new Promise<string>((resolve) => {
    rl.question(ANSWER_PREFIX, (answer) => {
      rl.close();
      const idx = parseInt(answer.trim()) - 1;
      if (idx >= 0 && idx < choices.length) {
        resolve(choices[idx].value);
      } else {
        // Default to first choice
        resolve(choices[0].value);
      }
    });
  });
}

/**
 * Prompt for yes/no confirmation.
 */
export async function promptConfirm(
  question: string,
  defaultYes: boolean = true,
  daName?: string
): Promise<boolean> {
  if (isAutomated()) return defaultYes;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const hint = defaultYes ? `${c.gray}(Y/n)${c.reset}` : `${c.gray}(y/N)${c.reset}`;

  printQuestion(`${question} ${hint}`, daName);
  return new Promise<boolean>((resolve) => {
    rl.question(ANSWER_PREFIX, (answer) => {
      rl.close();
      const val = answer.trim().toLowerCase();
      if (val === "") resolve(defaultYes);
      else resolve(val === "y" || val === "yes");
    });
  });
}
