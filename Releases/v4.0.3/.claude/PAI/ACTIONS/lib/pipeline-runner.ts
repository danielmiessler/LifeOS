#!/usr/bin/env bun
/**
 * PAI Pipeline Runner — v2 (simplified)
 *
 * A pipeline is a list of actions. That's it.
 * Each action's output pipes into the next action's input.
 * The pipeline output is the last action's output.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";

const ACTIONS_DIR = join(import.meta.dir, "..");
const PIPELINES_DIR = join(ACTIONS_DIR, "..", "PIPELINES");
const USER_PIPELINES_DIR = join(ACTIONS_DIR, "..", "USER", "PIPELINES");

interface Pipeline {
  name: string;
  description: string;
  actions: string[];
}

/**
 * Load a pipeline YAML
 * Resolution order: USER/PIPELINES (personal) → PIPELINES (system/framework)
 */
async function loadPipeline(name: string): Promise<Pipeline> {
  // Check USER/PIPELINES first
  const userPath = join(USER_PIPELINES_DIR, `${name}.yaml`);
  try {
    const content = await readFile(userPath, "utf-8");
    return parseYaml(content) as Pipeline;
  } catch {}

  // Fall back to PIPELINES (system)
  const systemPath = join(PIPELINES_DIR, `${name}.yaml`);
  const content = await readFile(systemPath, "utf-8");
  return parseYaml(content) as Pipeline;
}

/**
 * Run a pipeline: pipe data through each action sequentially
 */
export async function runPipeline(
  name: string,
  input: Record<string, unknown>
): Promise<{ success: boolean; output?: unknown; error?: string }> {
  try {
    const pipeline = await loadPipeline(name);
    let data: unknown = input;

    for (const actionName of pipeline.actions) {
      console.error(`[pipeline] ${actionName}`);

      const { runAction } = await import("./runner.v2");
      const result = await runAction(actionName, data);

      if (!result.success) {
        return { success: false, error: `${actionName} failed: ${result.error}` };
      }

      data = result.output; // pipe: output becomes next input
    }

    return { success: true, output: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * List all pipelines from both USER (personal) and SYSTEM (framework) directories.
 */
export async function listPipelines(): Promise<string[]> {
  const { readdir } = await import("fs/promises");
  const seen = new Set<string>();
  const result: string[] = [];

  // USER first (personal takes precedence)
  for (const dir of [USER_PIPELINES_DIR, PIPELINES_DIR]) {
    try {
      const files = await readdir(dir);
      for (const f of files) {
        if (f.endsWith(".yaml")) {
          const name = f.replace(".yaml", "");
          if (!seen.has(name)) {
            result.push(name);
            seen.add(name);
          }
        }
      }
    } catch {}
  }

  return result;
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args[0] === "list") {
    const pipelines = await listPipelines();
    console.log(JSON.stringify({ pipelines }, null, 2));
  } else if (args[0] === "run" && args[1]) {
    const name = args[1];
    const input: Record<string, unknown> = {};

    for (let i = 2; i < args.length; i += 2) {
      const key = args[i].replace(/^--/, "");
      let value: unknown = args[i + 1];
      try { value = JSON.parse(value as string); } catch {}
      input[key] = value;
    }

    const result = await runPipeline(name, input);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("Usage:");
    console.log("  pipeline-runner.ts list");
    console.log("  pipeline-runner.ts run <pipeline> [--key value ...]");
  }
}
