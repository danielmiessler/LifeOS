#!/usr/bin/env bun
/**
 * ============================================================================
 * PAI ACTIONS v2 - Runner with Capability Injection
 * ============================================================================
 *
 * Loads action packages (action.json + action.ts) and provides capabilities.
 *
 * ============================================================================
 */

import { readFile, readdir } from "fs/promises";
import { join, dirname } from "path";
import type {
  ActionManifest,
  ActionImplementation,
  ActionContext,
  ActionCapabilities,
  ActionResult,
  LLMOptions,
  LLMResponse,
} from "./types.v2";
import { validateSchema } from "./types.v2";

const ACTIONS_DIR = dirname(import.meta.dir);

/**
 * Local LLM provider using PAI's Inference tool
 */
async function createLocalLLM(): Promise<ActionCapabilities["llm"]> {
  const inferenceModule = await import(
    join(process.env.HOME!, ".claude/skills/PAI/Tools/Inference.ts")
  );
  const { inference } = inferenceModule;

  return async (prompt: string, options?: LLMOptions): Promise<LLMResponse> => {
    const tierMap = { fast: "fast", standard: "standard", smart: "smart" } as const;

    const result = await inference({
      userPrompt: prompt,
      systemPrompt: options?.system,
      level: tierMap[options?.tier || "fast"],
      expectJson: options?.json,
      maxTokens: options?.maxTokens,
    });

    if (!result.success) {
      throw new Error(result.error || "LLM inference failed");
    }

    return {
      text: result.response || "",
      json: result.parsed,
      usage: result.usage,
    };
  };
}

/**
 * Create capability providers for local execution
 */
async function createLocalCapabilities(
  required: ActionManifest["requires"] = []
): Promise<ActionCapabilities> {
  const capabilities: ActionCapabilities = {};

  for (const cap of required) {
    switch (cap) {
      case "llm":
        capabilities.llm = await createLocalLLM();
        break;
      case "fetch":
        capabilities.fetch = fetch;
        break;
      case "shell":
        capabilities.shell = async (cmd: string) => {
          const { $ } = await import("bun");
          try {
            const result = await $`sh -c ${cmd}`.quiet();
            return { stdout: result.text(), stderr: "", code: 0 };
          } catch (err: unknown) {
            const e = err as { stderr?: { toString(): string }; exitCode?: number };
            return {
              stdout: "",
              stderr: e.stderr?.toString() || String(err),
              code: e.exitCode || 1,
            };
          }
        };
        break;
      case "readFile":
        capabilities.readFile = async (path: string) => {
          return Bun.file(path).text();
        };
        break;
      case "writeFile":
        capabilities.writeFile = async (path: string, content: string) => {
          await Bun.write(path, content);
        };
        break;
      // kv would need a backend - skip for now
    }
  }

  return capabilities;
}

/**
 * Load an action manifest from a directory
 */
export async function loadManifest(actionPath: string): Promise<ActionManifest> {
  const manifestPath = join(actionPath, "action.json");
  const content = await readFile(manifestPath, "utf-8");
  return JSON.parse(content) as ActionManifest;
}

/**
 * Load an action implementation
 */
export async function loadImplementation<TInput, TOutput>(
  actionPath: string
): Promise<ActionImplementation<TInput, TOutput>> {
  const implPath = join(actionPath, "action.ts");
  const module = await import(implPath);
  return module.default as ActionImplementation<TInput, TOutput>;
}

/**
 * Find action directory by name (e.g., "blog/proofread")
 */
export async function findAction(name: string): Promise<string | null> {
  const parts = name.split("/");
  if (parts.length !== 2) return null;

  const [category, actionName] = parts;
  const actionPath = join(ACTIONS_DIR, category, actionName);

  try {
    await readFile(join(actionPath, "action.json"), "utf-8");
    return actionPath;
  } catch {
    return null;
  }
}

/**
 * Run an action with capability injection
 */
export async function runAction<TInput = unknown, TOutput = unknown>(
  name: string,
  input: TInput,
  options: { mode?: "local" | "cloud" } = {}
): Promise<ActionResult<TOutput>> {
  const startTime = Date.now();
  const mode = options.mode || "local";

  // Find action
  const actionPath = await findAction(name);
  if (!actionPath) {
    return { success: false, error: `Action not found: ${name}` };
  }

  try {
    // Load manifest and implementation
    const manifest = await loadManifest(actionPath);
    const implementation = await loadImplementation<TInput, TOutput>(actionPath);

    // Validate input
    const inputValidation = await validateSchema(input, manifest.input);
    if (!inputValidation.valid) {
      return {
        success: false,
        error: `Input validation failed: ${inputValidation.errors?.join(", ")}`,
      };
    }

    // Create capabilities
    const capabilities = await createLocalCapabilities(manifest.requires);

    // Create context
    const ctx: ActionContext = {
      capabilities,
      env: { mode },
    };

    // Execute
    const output = await implementation.execute(input, ctx);

    // Validate output
    const outputValidation = await validateSchema(output, manifest.output);
    if (!outputValidation.valid) {
      return {
        success: false,
        error: `Output validation failed: ${outputValidation.errors?.join(", ")}`,
      };
    }

    return {
      success: true,
      output,
      metadata: {
        durationMs: Date.now() - startTime,
        action: manifest.name,
        version: manifest.version,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      metadata: {
        durationMs: Date.now() - startTime,
        action: name,
        version: "unknown",
      },
    };
  }
}

/**
 * List all v2 actions (those with action.json)
 */
export async function listActionsV2(): Promise<ActionManifest[]> {
  const manifests: ActionManifest[] = [];

  try {
    const categories = await readdir(ACTIONS_DIR, { withFileTypes: true });

    for (const cat of categories) {
      if (!cat.isDirectory() || cat.name === "lib") continue;

      const catPath = join(ACTIONS_DIR, cat.name);
      const items = await readdir(catPath, { withFileTypes: true });

      for (const item of items) {
        if (!item.isDirectory()) continue;

        const actionPath = join(catPath, item.name);
        try {
          const manifest = await loadManifest(actionPath);
          manifests.push(manifest);
        } catch {
          // Not a v2 action, skip
        }
      }
    }
  } catch {
    // No actions directory
  }

  return manifests;
}

// CLI support
if (import.meta.main) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === "list") {
    const actions = await listActionsV2();
    console.log(JSON.stringify({ actions: actions.map(a => a.name) }, null, 2));
  } else if (cmd === "run" && args[1]) {
    const input = args[2] ? JSON.parse(args[2]) : {};
    const result = await runAction(args[1], input);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("Usage: runner.v2.ts list | run <action> [input-json]");
  }
}
