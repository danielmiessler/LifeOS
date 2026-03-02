#!/usr/bin/env bun

/**
 * Load Agent Context
 *
 * Simple utility to load agent context files when spawning specialized agents.
 * Each agent type (Architect, Engineer, Designer, etc.) has ONE markdown context file
 * that references relevant parts of the Skills system.
 *
 * Usage: bun run LoadAgentContext.ts <agentType>
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface AgentContext {
  agentType: string;
  contextContent: string;
  model: "opus" | "sonnet" | "haiku";
}

export class AgentContextLoader {
  private claudeHome: string;
  private agentsDir: string;

  constructor() {
    this.claudeHome = join(homedir(), ".claude");
    this.agentsDir = join(this.claudeHome, "Skills", "Agents");
  }

  /**
   * Load context for a specific agent type
   */
  loadContext(agentType: string): AgentContext {
    const contextPath = join(this.agentsDir, `${agentType}Context.md`);

    if (!existsSync(contextPath)) {
      throw new Error(
        `Context file not found for agent type: ${agentType}\nExpected at: ${contextPath}`
      );
    }

    const contextContent = readFileSync(contextPath, "utf-8");

    // Extract model preference from context file (defaults to opus)
    const modelMatch = contextContent.match(/\*\*Model\*\*:\s*(opus|sonnet|haiku)/i);
    const model = (modelMatch?.[1].toLowerCase() as "opus" | "sonnet" | "haiku") || "opus";

    return {
      agentType,
      contextContent,
      model,
    };
  }

  /**
   * Get list of available agent types
   */
  getAvailableAgents(): string[] {
    if (!existsSync(this.agentsDir)) {
      return [];
    }

    const files = readdirSync(this.agentsDir);

    return files
      .filter((f) => f.endsWith("Context.md"))
      .map((f) => f.replace("Context.md", ""));
  }

  /**
   * Generate enriched prompt for spawning agent with Task tool
   */
  generateEnrichedPrompt(agentType: string, taskDescription: string): {
    prompt: string;
    model: "opus" | "sonnet" | "haiku";
  } {
    const context = this.loadContext(agentType);

    const enrichedPrompt = `${context.contextContent}

---

## Current Task

${taskDescription}`;

    return {
      prompt: enrichedPrompt,
      model: context.model,
    };
  }
}

// CLI usage
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: LoadAgentContext.ts <agentType> [taskDescription]");
    console.log("\nAvailable agent types:");
    const loader = new AgentContextLoader();
    const agents = loader.getAvailableAgents();
    agents.forEach((a) => console.log(`  - ${a}`));
    process.exit(1);
  }

  const [agentType, ...taskParts] = args;
  const taskDescription = taskParts.join(" ");

  try {
    const loader = new AgentContextLoader();

    if (taskDescription) {
      // Generate enriched prompt for spawning
      const { prompt, model } = loader.generateEnrichedPrompt(agentType, taskDescription);
      console.log(`\n=== Enriched Prompt for ${agentType} Agent (Model: ${model}) ===\n`);
      console.log(prompt);
    } else {
      // Just load the context
      const context = loader.loadContext(agentType);
      console.log(`\n=== Context for ${context.agentType} Agent (Model: ${context.model}) ===\n`);
      console.log(context.contextContent);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

export default AgentContextLoader;
