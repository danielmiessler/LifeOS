#!/usr/bin/env bun

/**
 * Spawn Agent With Profile
 *
 * Helper utility to spawn agents with pre-loaded profile context.
 * Generates enriched prompts for the Task tool.
 */

import AgentProfileLoader from "./AgentProfileLoader";

export interface SpawnAgentOptions {
  agentType: string;
  taskDescription: string;
  projectPath?: string;
  model?: "opus" | "sonnet" | "haiku";
  runInBackground?: boolean;
  description?: string;
}

export interface AgentPrompt {
  prompt: string;
  model: "opus" | "sonnet" | "haiku";
  description: string;
}

/**
 * Generate enriched prompt for spawning an agent with profile
 */
export async function generateAgentPrompt(
  options: SpawnAgentOptions
): Promise<AgentPrompt> {
  const loader = new AgentProfileLoader();

  // Load the profile
  const loaded = await loader.loadProfile(
    options.agentType,
    options.taskDescription,
    options.projectPath
  );

  // Use profile's model preference if not overridden
  const model = options.model || loaded.profile.modelPreference || "sonnet";

  // Generate description if not provided
  const description =
    options.description ||
    `${options.agentType}: ${options.taskDescription.substring(0, 50)}...`;

  return {
    prompt: loaded.fullPrompt,
    model,
    description,
  };
}

// CLI usage
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: SpawnAgentWithProfile.ts <agentType> <taskDescription> [projectPath]");
    console.log("\nExample:");
    console.log('  bun run SpawnAgentWithProfile.ts Architect "Design REST API" ~/Projects/MyApp');
    console.log("\nAvailable profiles:");
    const loader = new AgentProfileLoader();
    const profiles = loader.getAvailableProfiles();
    profiles.forEach((p) => console.log(`  - ${p}`));
    process.exit(1);
  }

  const [agentType, taskDescription, projectPath] = args;

  try {
    const prompt = await generateAgentPrompt({
      agentType,
      taskDescription,
      projectPath,
    });

    console.log("\n=== Agent Spawn Configuration ===\n");
    console.log(`Agent Type: ${agentType}`);
    console.log(`Model: ${prompt.model}`);
    console.log(`Description: ${prompt.description}`);
    console.log("\n=== Enriched Prompt (ready for Task tool) ===\n");
    console.log(prompt.prompt);
  } catch (error) {
    console.error(`Error generating prompt: ${error}`);
    process.exit(1);
  }
}

export default { generateAgentPrompt };
