#!/usr/bin/env bun
/**
 * ============================================================================
 * PAI CLI - Unified Actions & Pipelines Interface
 * ============================================================================
 *
 * The main entry point for running PAI actions and pipelines.
 *
 * USAGE:
 *   # Run an action
 *   pai action parse/topic --input '{"text":"quantum computing"}'
 *   echo '{"text":"quantum"}' | pai action parse/topic
 *
 *   # Run a pipeline
 *   pai pipeline research --topic "quantum computing"
 *
 *   # Piping actions together
 *   pai action parse/topic | pai action transform/summarize
 *
 *   # List available actions/pipelines
 *   pai actions
 *   pai pipelines
 *
 *   # Show action/pipeline info
 *   pai info parse/topic
 *
 * OPTIONS:
 *   --mode local|cloud    Execution mode (default: local)
 *   --input '<json>'      Input as JSON string
 *   --verbose             Show execution details
 *
 * ============================================================================
 */

import { runAction, listActions } from "./lib/runner";
import { dirname, join } from "path";
import { readdir, readFile } from "fs/promises";

const PIPELINES_DIR = join(dirname(import.meta.dir), "PIPELINES");

interface CLIOptions {
  mode: "local" | "cloud";
  verbose: boolean;
  input?: string;
}

function parseArgs(args: string[]): { command: string; target?: string; options: CLIOptions; extra: Record<string, string> } {
  const options: CLIOptions = { mode: "local", verbose: false };
  const extra: Record<string, string> = {};
  let command = "";
  let target: string | undefined;
  let expectingValue: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (expectingValue) {
      if (expectingValue === "mode") options.mode = arg as "local" | "cloud";
      else if (expectingValue === "input") options.input = arg;
      else extra[expectingValue] = arg;
      expectingValue = null;
      continue;
    }

    if (arg === "--mode") { expectingValue = "mode"; continue; }
    if (arg === "--input") { expectingValue = "input"; continue; }
    if (arg === "--verbose" || arg === "-v") { options.verbose = true; continue; }
    if (arg.startsWith("--")) { expectingValue = arg.slice(2); continue; }

    if (!command) { command = arg; continue; }
    if (!target) { target = arg; continue; }
  }

  return { command, target, options, extra };
}

async function readStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const content = Buffer.concat(chunks).toString().trim();
  return content || null;
}

async function listPipelines(): Promise<string[]> {
  try {
    const files = await readdir(PIPELINES_DIR);
    return files
      .filter(f => f.endsWith(".pipeline.yaml") || f.endsWith(".pipeline.yml"))
      .map(f => f.replace(/\.pipeline\.(yaml|yml)$/, ""));
  } catch {
    return [];
  }
}

async function showHelp() {
  console.log(`
PAI - Personal AI Actions & Pipelines

USAGE:
  pai action <name> [--input '<json>']     Run an action
  pai pipeline <name> [--<param> <value>]  Run a pipeline
  pai actions                               List all actions
  pai pipelines                             List all pipelines
  pai info <name>                           Show action/pipeline details

OPTIONS:
  --mode local|cloud    Execution mode (default: local)
  --input '<json>'      Input as JSON string
  --verbose, -v         Show execution details

EXAMPLES:
  pai action parse/topic --input '{"text":"quantum computing"}'
  echo '{"text":"AI"}' | pai action parse/topic
  pai action parse/topic | pai action transform/summarize
  pai pipeline research --topic "machine learning"
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    await showHelp();
    return;
  }

  const { command, target, options, extra } = parseArgs(args);

  switch (command) {
    case "action": {
      if (!target) {
        console.error("Error: Action name required. Usage: pai action <name>");
        process.exit(1);
      }

      // Get input from stdin, --input flag, or extra params
      let input: unknown;
      const stdinContent = await readStdin();

      if (stdinContent) {
        input = JSON.parse(stdinContent);
      } else if (options.input) {
        input = JSON.parse(options.input);
      } else if (Object.keys(extra).length > 0) {
        input = extra;
      } else {
        console.error("Error: No input provided. Use --input, pipe JSON, or pass --<param> <value>");
        process.exit(1);
      }

      if (options.verbose) {
        console.error(`[pai] Running action: ${target}`);
        console.error(`[pai] Mode: ${options.mode}`);
        console.error(`[pai] Input: ${JSON.stringify(input)}`);
      }

      const result = await runAction(target, input, { mode: options.mode });

      if (result.success) {
        console.log(JSON.stringify(result.output));
        if (options.verbose && result.metadata) {
          console.error(`[pai] Duration: ${result.metadata.durationMs}ms`);
        }
      } else {
        console.error(JSON.stringify({ error: result.error }));
        process.exit(1);
      }
      break;
    }

    case "pipeline": {
      if (!target) {
        console.error("Error: Pipeline name required. Usage: pai pipeline <name>");
        process.exit(1);
      }

      // Get input from stdin, --input flag, or extra params
      let pipelineInput: Record<string, unknown>;
      const stdinContent = await readStdin();

      if (stdinContent) {
        pipelineInput = JSON.parse(stdinContent);
      } else if (options.input) {
        pipelineInput = JSON.parse(options.input);
      } else if (Object.keys(extra).length > 0) {
        pipelineInput = extra;
      } else {
        console.error("Error: No input provided. Use --input, pipe JSON, or pass --<param> <value>");
        process.exit(1);
      }

      if (options.verbose) {
        console.error(`[pai] Running pipeline: ${target}`);
        console.error(`[pai] Input: ${JSON.stringify(pipelineInput)}`);
      }

      const { runPipeline } = await import("./lib/pipeline-runner");
      const pipelineResult = await runPipeline(target, pipelineInput);

      if (pipelineResult.success) {
        console.log(JSON.stringify(pipelineResult.output, null, 2));
      } else {
        console.error(JSON.stringify({ error: pipelineResult.error }, null, 2));
        process.exit(1);
      }
      break;
    }

    case "actions": {
      const actions = await listActions();
      console.log(JSON.stringify({ actions }, null, 2));
      break;
    }

    case "pipelines": {
      const pipelines = await listPipelines();
      console.log(JSON.stringify({ pipelines }, null, 2));
      break;
    }

    case "info": {
      if (!target) {
        console.error("Error: Name required. Usage: pai info <action-or-pipeline-name>");
        process.exit(1);
      }

      // Try loading as action first
      try {
        const { loadAction } = await import("./lib/runner");
        const action = await loadAction(target);
        console.log(JSON.stringify({
          type: "action",
          name: action.name,
          version: action.version,
          description: action.description,
          tags: action.tags,
          deployment: action.deployment,
          inputSchema: action.inputSchema._def,
          outputSchema: action.outputSchema._def,
        }, null, 2));
      } catch {
        console.error(`Not found: ${target}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      await showHelp();
      process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
