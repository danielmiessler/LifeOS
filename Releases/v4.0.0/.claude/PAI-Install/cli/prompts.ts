/**
 * PAI Installer v4.0 — CLI Interactive Prompts
 * readline-based input collection with proper cleanup.
 */

import * as readline from "readline";
import { c, print } from "./display";

/**
 * Prompt for text input with optional default value.
 */
export async function promptText(
  question: string,
  defaultValue?: string
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const defaultHint = defaultValue ? ` ${c.gray}(${defaultValue})${c.reset}` : "";

  return new Promise<string>((resolve) => {
    rl.question(`  ${question}${defaultHint}\n  ${c.blue}>${c.reset} `, (answer) => {
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
  placeholder?: string
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const hint = placeholder ? ` ${c.gray}(${placeholder})${c.reset}` : "";

  return new Promise<string>((resolve) => {
    // We can't truly mask in basic readline, but we can note it
    print(`  ${question}${hint}`);
    print(`  ${c.dim}(Input will be visible — paste your key)${c.reset}`);

    rl.question(`  ${c.blue}>${c.reset} `, (answer) => {
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
  choices: { label: string; value: string; description?: string }[]
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  print(`  ${question}`);
  print("");

  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    print(`    ${c.blue}${i + 1}${c.reset}) ${choice.label}${choice.description ? ` ${c.gray}— ${choice.description}${c.reset}` : ""}`);
  }

  print("");

  return new Promise<string>((resolve) => {
    rl.question(`  ${c.blue}>${c.reset} `, (answer) => {
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
  defaultYes: boolean = true
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const hint = defaultYes ? `${c.gray}(Y/n)${c.reset}` : `${c.gray}(y/N)${c.reset}`;

  return new Promise<boolean>((resolve) => {
    rl.question(`  ${question} ${hint} `, (answer) => {
      rl.close();
      const val = answer.trim().toLowerCase();
      if (val === "") resolve(defaultYes);
      else resolve(val === "y" || val === "yes");
    });
  });
}
