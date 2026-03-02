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
const USER_ACTIONS_DIR = join(ACTIONS_DIR, "..", "USER", "ACTIONS");

/**
 * Local LLM provider using PAI's Inference tool
 */
async function createLocalLLM(): Promise<ActionCapabilities["llm"]> {
  const inferenceModule = await import(
    join(process.env.HOME!, ".claude/PAI/Tools/Inference.ts")
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
      text: result.output || "",
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
 * Find action directory by name
 * Resolution order: USER/ACTIONS (personal) → ACTIONS (system/framework)
 * Supports: A_NAME (flat, new) or category/name (legacy)
 */
export async function findAction(name: string): Promise<string | null> {
  // New flat format: A_EXTRACT_TRANSCRIPT
  if (name.startsWith("A_")) {
    // Check USER/ACTIONS first (personal actions override system)
    const userPath = join(USER_ACTIONS_DIR, name);
    try {
      await readFile(join(userPath, "action.json"), "utf-8");
      return userPath;
    } catch {}

    // Fall back to ACTIONS (system/framework)
    const systemPath = join(ACTIONS_DIR, name);
    try {
      await readFile(join(systemPath, "action.json"), "utf-8");
      return systemPath;
    } catch {
      return null;
    }
  }

  // Legacy format: category/name → check USER first, then SYSTEM
  const parts = name.split("/");
  if (parts.length !== 2) return null;

  const [category, actionName] = parts;

  // Check USER/ACTIONS first
  const userPath = join(USER_ACTIONS_DIR, category, actionName);
  try {
    await readFile(join(userPath, "action.json"), "utf-8");
    return userPath;
  } catch {}

  // Fall back to ACTIONS (system)
  const systemPath = join(ACTIONS_DIR, category, actionName);
  try {
    await readFile(join(systemPath, "action.json"), "utf-8");
    return systemPath;
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

    // Validate required input fields (simplified — no ajv for new format)
    if (manifest.input && !manifest.input.type) {
      // New simplified format: { field: { type, required } }
      const inputObj = input as Record<string, unknown>;
      for (const [field, spec] of Object.entries(manifest.input as Record<string, { required?: boolean }>)) {
        if (spec.required && (inputObj[field] === undefined || inputObj[field] === null)) {
          return { success: false, error: `Missing required input: ${field}` };
        }
      }
    } else if (manifest.input?.type === "object") {
      // Legacy JSON Schema format — use ajv
      const inputValidation = await validateSchema(input, manifest.input);
      if (!inputValidation.valid) {
        return { success: false, error: `Input validation failed: ${inputValidation.errors?.join(", ")}` };
      }
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

    return {
      success: true,
      output,
      metadata: {
        durationMs: Date.now() - startTime,
        action: manifest.name,
        version: manifest.version || "1.0.0",
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
 * List all actions from both USER (personal) and SYSTEM (framework) directories.
 * USER actions take precedence over SYSTEM actions with the same name.
 */
export async function listActionsV2(): Promise<ActionManifest[]> {
  const manifests: ActionManifest[] = [];
  const seen = new Set<string>();

  // Scan a directory for actions (A_ flat + legacy nested)
  async function scanDir(baseDir: string) {
    try {
      const entries = await readdir(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "lib") continue;

        if (entry.name.startsWith("A_")) {
          if (seen.has(entry.name)) continue;
          try {
            const manifest = await loadManifest(join(baseDir, entry.name));
            manifests.push(manifest);
            seen.add(entry.name);
          } catch {}
        } else {
          const catPath = join(baseDir, entry.name);
          try {
            const items = await readdir(catPath, { withFileTypes: true });
            for (const item of items) {
              if (!item.isDirectory()) continue;
              const key = `${entry.name}/${item.name}`;
              if (seen.has(key)) continue;
              try {
                const manifest = await loadManifest(join(catPath, item.name));
                manifests.push(manifest);
                seen.add(key);
              } catch {}
            }
          } catch {}
        }
      }
    } catch {}
  }

  // USER first (personal takes precedence), then SYSTEM
  await scanDir(USER_ACTIONS_DIR);
  await scanDir(ACTIONS_DIR);

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
