/**
 * PAI Installer v3.0 — Step Definitions
 * Defines the 8 installation steps, their dependencies, and conditions.
 */

import type { StepDefinition, StepId, InstallState } from "./types";

export const STEPS: StepDefinition[] = [
  {
    id: "system-detect",
    name: "System Detection",
    description: "Detect operating system, installed tools, and existing PAI installation",
    number: 1,
    required: true,
    dependsOn: [],
  },
  {
    id: "prerequisites",
    name: "Prerequisites",
    description: "Install required tools: Git, Bun, Claude Code",
    number: 2,
    required: true,
    dependsOn: ["system-detect"],
  },
  {
    id: "api-keys",
    name: "API Keys",
    description: "Find or collect ElevenLabs API key for voice features",
    number: 3,
    required: true,
    dependsOn: ["prerequisites"],
  },
  {
    id: "identity",
    name: "Identity",
    description: "Configure your name, AI assistant name, timezone, and catchphrase",
    number: 4,
    required: true,
    dependsOn: ["api-keys"],
  },
  {
    id: "repository",
    name: "PAI Repository",
    description: "Clone or update the PAI repository into ~/.claude",
    number: 5,
    required: true,
    dependsOn: ["identity"],
  },
  {
    id: "configuration",
    name: "Configuration",
    description: "Generate settings.json, environment files, and directory structure",
    number: 6,
    required: true,
    dependsOn: ["repository"],
  },
  {
    id: "voice",
    name: "Digital Assistant Voice",
    description: "Configure ElevenLabs key, select voice, start voice server, and test",
    number: 7,
    required: true,
    dependsOn: ["configuration"],
  },
  {
    id: "validation",
    name: "Validation",
    description: "Verify installation completeness and show summary",
    number: 8,
    required: true,
    dependsOn: ["voice"],
  },
];

/**
 * Get a step definition by ID.
 */
export function getStep(id: StepId): StepDefinition {
  const step = STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`Unknown step: ${id}`);
  return step;
}

/**
 * Get the next step to execute based on current state.
 */
export function getNextStep(state: InstallState): StepDefinition | null {
  for (const step of STEPS) {
    // Skip completed and skipped steps
    if (state.completedSteps.includes(step.id)) continue;
    if (state.skippedSteps.includes(step.id)) continue;

    // Check if condition allows this step
    if (step.condition && !step.condition(state)) {
      continue;
    }

    // Check dependencies are met
    const depsReady = step.dependsOn.every(
      (dep) => state.completedSteps.includes(dep) || state.skippedSteps.includes(dep)
    );
    if (!depsReady) continue;

    return step;
  }
  return null; // All steps done
}

/**
 * Get all steps with their current status.
 */
export function getStepStatuses(state: InstallState): Array<StepDefinition & { status: string }> {
  return STEPS.map((step) => {
    let status: string;
    if (state.completedSteps.includes(step.id)) {
      status = "completed";
    } else if (state.skippedSteps.includes(step.id)) {
      status = "skipped";
    } else if (state.currentStep === step.id) {
      status = "active";
    } else if (step.condition && !step.condition(state)) {
      status = "skipped";
    } else {
      status = "pending";
    }
    return { ...step, status };
  });
}

/**
 * Calculate overall progress percentage.
 */
export function getProgress(state: InstallState): number {
  const applicableSteps = STEPS.filter(
    (s) => !s.condition || s.condition(state)
  );
  const done = applicableSteps.filter(
    (s) => state.completedSteps.includes(s.id) || state.skippedSteps.includes(s.id)
  );
  return Math.round((done.length / applicableSteps.length) * 100);
}
