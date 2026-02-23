#!/usr/bin/env bun
/**
 * ============================================================================
 * PAI Pipeline Runner
 * ============================================================================
 *
 * Executes pipeline YAML files by running action steps sequentially,
 * passing outputs between steps via template interpolation.
 *
 * ============================================================================
 */

import { readFile, writeFile, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parse as parseYaml } from "yaml";

const ACTIONS_DIR = join(import.meta.dir, "..");
const PIPELINES_DIR = join(ACTIONS_DIR, "..", "PIPELINES");

interface PipelineStep {
  id: string;
  action: string;
  input: Record<string, unknown>;
  parallel?: boolean;
  foreach?: string;
}

interface PipelineDefinition {
  name: string;
  version: string;
  description: string;
  input: Record<string, { type: string; required?: boolean; default?: unknown; description?: string }>;
  output: Record<string, { type: string; description?: string }>;
  steps: PipelineStep[];
  output_mapping: Record<string, string>;
}

interface ExecutionContext {
  input: Record<string, unknown>;
  steps: Record<string, { output: unknown }>;
}

/**
 * Interpolate template strings like {{input.content}} or {{steps.proofread.output.corrected}}
 */
function interpolate(template: unknown, context: ExecutionContext): unknown {
  if (typeof template === "string") {
    // Check if entire string is a template
    const fullMatch = template.match(/^\{\{(.+?)\}\}$/);
    if (fullMatch) {
      return resolvePath(fullMatch[1].trim(), context);
    }

    // Otherwise do string interpolation
    return template.replace(/\{\{(.+?)\}\}/g, (_, path) => {
      const value = resolvePath(path.trim(), context);
      return typeof value === "string" ? value : JSON.stringify(value);
    });
  }

  if (Array.isArray(template)) {
    return template.map(item => interpolate(item, context));
  }

  if (typeof template === "object" && template !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = interpolate(value, context);
    }
    return result;
  }

  return template;
}

/**
 * Resolve a dot-path like "steps.proofread.output.corrected"
 */
function resolvePath(path: string, context: ExecutionContext): unknown {
  const parts = path.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Run an action by name
 */
async function runAction(
  actionName: string,
  input: unknown
): Promise<{ success: boolean; output?: unknown; error?: string }> {
  // Handle built-in actions
  if (actionName.startsWith("_builtin/")) {
    return runBuiltinAction(actionName, input);
  }

  // Try v2 format first (action.json + action.ts)
  const [category, name] = actionName.split("/");
  const v2Path = join(ACTIONS_DIR, category, name, "action.json");

  try {
    await readFile(v2Path, "utf-8");
    // V2 action exists, use v2 runner
    const { runAction: runV2 } = await import("./runner.v2");
    return runV2(actionName, input);
  } catch {
    // Fall back to v1 format (single .action.ts file)
    try {
      const { runAction: runV1 } = await import("./runner");
      return runV1(actionName, input);
    } catch (err) {
      return { success: false, error: `Action not found: ${actionName}` };
    }
  }
}

/**
 * Built-in actions that don't need separate files
 */
async function runBuiltinAction(
  actionName: string,
  input: unknown
): Promise<{ success: boolean; output?: unknown; error?: string }> {
  const name = actionName.replace("_builtin/", "");
  const inp = input as Record<string, unknown>;

  switch (name) {
    case "preview-markdown": {
      // Write content to temp file and open in browser
      const content = inp.content as string;
      const title = (inp.title as string) || "Preview";

      // Create temp directory and HTML file
      const tempDir = await mkdtemp(join(tmpdir(), "pai-preview-"));
      const htmlPath = join(tempDir, "preview.html");

      // Generate HTML with markdown rendering
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
    }
    pre { background: #f4f4f4; padding: 16px; overflow-x: auto; }
    code { background: #f4f4f4; padding: 2px 6px; }
    pre code { padding: 0; background: none; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script>
    document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
  </script>
</body>
</html>`;

      await writeFile(htmlPath, html);

      // Open in browser
      const { $ } = await import("bun");
      await $`open ${htmlPath}`.quiet();

      return {
        success: true,
        output: {
          url: `file://${htmlPath}`,
          path: htmlPath,
        },
      };
    }

    case "write-file": {
      const path = inp.path as string;
      const content = inp.content as string;
      await writeFile(path, content);
      return { success: true, output: { path, written: true } };
    }

    case "open-url": {
      const url = inp.url as string;
      const { $ } = await import("bun");
      await $`open ${url}`.quiet();
      return { success: true, output: { opened: url } };
    }

    default:
      return { success: false, error: `Unknown builtin action: ${name}` };
  }
}

/**
 * Load a pipeline definition from YAML
 */
export async function loadPipeline(name: string): Promise<PipelineDefinition> {
  const yamlPath = join(PIPELINES_DIR, `${name}.pipeline.yaml`);
  const content = await readFile(yamlPath, "utf-8");
  return parseYaml(content) as PipelineDefinition;
}

/**
 * Execute a pipeline
 */
export async function runPipeline(
  name: string,
  input: Record<string, unknown>
): Promise<{ success: boolean; output?: unknown; error?: string; stepResults?: Record<string, unknown> }> {
  try {
    const pipeline = await loadPipeline(name);

    // Initialize context
    const context: ExecutionContext = {
      input,
      steps: {},
    };

    // Execute steps sequentially
    for (const step of pipeline.steps) {
      console.error(`[pipeline] Running step: ${step.id} (${step.action})`);

      // Interpolate input
      const stepInput = interpolate(step.input, context);

      // Run action
      const result = await runAction(step.action, stepInput);

      if (!result.success) {
        return {
          success: false,
          error: `Step '${step.id}' failed: ${result.error}`,
          stepResults: context.steps,
        };
      }

      // Store result
      context.steps[step.id] = { output: result.output };
    }

    // Build output
    const output = interpolate(pipeline.output_mapping, context);

    return {
      success: true,
      output,
      stepResults: context.steps,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * List all pipelines
 */
export async function listPipelines(): Promise<string[]> {
  const { readdir } = await import("fs/promises");
  const files = await readdir(PIPELINES_DIR);
  return files
    .filter(f => f.endsWith(".pipeline.yaml"))
    .map(f => f.replace(".pipeline.yaml", ""));
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args[0] === "list") {
    const pipelines = await listPipelines();
    console.log(JSON.stringify({ pipelines }, null, 2));
  } else if (args[0] === "run" && args[1]) {
    const pipelineName = args[1];

    // Parse remaining args as --key value pairs
    const input: Record<string, unknown> = {};
    for (let i = 2; i < args.length; i += 2) {
      const key = args[i].replace(/^--/, "");
      let value: unknown = args[i + 1];

      // Try to parse as JSON
      try {
        value = JSON.parse(value as string);
      } catch {
        // Keep as string
      }

      input[key] = value;
    }

    const result = await runPipeline(pipelineName, input);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("Usage:");
    console.log("  pipeline-runner.ts list");
    console.log("  pipeline-runner.ts run <pipeline> [--key value ...]");
  }
}
