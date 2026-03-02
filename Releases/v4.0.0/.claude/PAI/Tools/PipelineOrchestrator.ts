#!/usr/bin/env bun
/**
 * ============================================================================
 * PAI Pipeline Orchestrator - Run Pipelines with Monitoring
 * ============================================================================
 *
 * Runs pipelines and reports progress to the PipelineMonitor.
 *
 * USAGE:
 *   bun PipelineOrchestrator.ts run <pipeline> [--input '<json>'] [--agent <name>]
 *   bun PipelineOrchestrator.ts demo   # Run demo with multiple pipelines
 *
 * ============================================================================
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";

const ACTIONS_DIR = join(import.meta.dir, "..", "ACTIONS");
const PIPELINES_DIR = join(import.meta.dir, "..", "PIPELINES");
const MONITOR_URL = process.env.MONITOR_URL || "http://localhost:8765";

interface Step {
  id: string;
  action: string;
  input: Record<string, unknown>;
}

interface Pipeline {
  name: string;
  version: string;
  description: string;
  steps: Step[];
}

// Report to monitor
async function reportStart(agent: string, pipeline: string, steps: Step[]): Promise<string | null> {
  try {
    const res = await fetch(`${MONITOR_URL}/api/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, pipeline, steps }),
    });
    const data = await res.json() as { id: string };
    return data.id;
  } catch {
    return null; // Monitor not running
  }
}

async function reportUpdate(id: string, status: string, result?: unknown, error?: string) {
  try {
    await fetch(`${MONITOR_URL}/api/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, result, error }),
    });
  } catch {
    // Monitor not running
  }
}

async function reportStep(executionId: string, stepId: string, status: string, output?: unknown, error?: string) {
  try {
    await fetch(`${MONITOR_URL}/api/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId, stepId, status, output, error }),
    });
  } catch {
    // Monitor not running
  }
}

// Load pipeline YAML
async function loadPipeline(name: string): Promise<Pipeline> {
  const path = join(PIPELINES_DIR, `${name}.pipeline.yaml`);
  const content = await readFile(path, "utf-8");
  return parseYaml(content) as Pipeline;
}

// Template interpolation
function interpolate(template: unknown, context: Record<string, unknown>): unknown {
  if (typeof template === "string") {
    const fullMatch = template.match(/^\{\{(.+?)\}\}$/);
    if (fullMatch) {
      return resolvePath(fullMatch[1].trim(), context);
    }
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

function resolvePath(path: string, context: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Run an action
async function runAction(actionName: string, input: unknown): Promise<{ success: boolean; output?: unknown; error?: string }> {
  const [category, name] = actionName.split("/");
  const actionPath = join(ACTIONS_DIR, category, `${name}.action.ts`);

  try {
    const module = await import(actionPath);
    const action = module.default;
    const parsedInput = action.inputSchema.parse(input);
    const output = await action.execute(parsedInput, { mode: "local" });
    const parsedOutput = action.outputSchema.parse(output);
    return { success: true, output: parsedOutput };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Run a pipeline with monitoring
async function runPipeline(pipelineName: string, input: Record<string, unknown>, agent: string) {
  console.log(`[${agent}] Loading pipeline: ${pipelineName}`);

  const pipeline = await loadPipeline(pipelineName);
  const executionId = await reportStart(agent, pipelineName, pipeline.steps);

  if (executionId) {
    await reportUpdate(executionId, "running");
  }

  const context: Record<string, unknown> = {
    input,
    steps: {},
  };

  console.log(`[${agent}] Running ${pipeline.steps.length} steps...`);

  for (const step of pipeline.steps) {
    console.log(`[${agent}] Step: ${step.id} (${step.action})`);

    if (executionId) {
      await reportStep(executionId, step.id, "running");
    }

    // Interpolate input
    const stepInput = interpolate(step.input, context);

    // Run action
    const result = await runAction(step.action, stepInput);

    if (result.success) {
      (context.steps as Record<string, unknown>)[step.id] = { output: result.output };

      if (executionId) {
        await reportStep(executionId, step.id, "completed", result.output);
      }

      console.log(`[${agent}] ✓ ${step.id} completed`);
    } else {
      if (executionId) {
        await reportStep(executionId, step.id, "failed", undefined, result.error);
        await reportUpdate(executionId, "failed", undefined, result.error);
      }

      console.log(`[${agent}] ✗ ${step.id} failed: ${result.error}`);
      return { success: false, error: result.error };
    }

    // Small delay for visual effect in UI
    await Bun.sleep(200);
  }

  const finalResult = { steps: context.steps };

  if (executionId) {
    await reportUpdate(executionId, "completed", finalResult);
  }

  console.log(`[${agent}] ✓ Pipeline completed`);
  return { success: true, result: finalResult };
}

// Demo mode - run multiple pipelines in parallel
async function runDemo() {
  console.log("Starting demo with PAI pipelines...\n");

  const jobs = [
    {
      agent: "BlogReviewer-1",
      pipeline: "blog-review",
      input: {
        content: `# Why AI Agents Need Composable Pipelines

The promise of AI agents is autonomy—systems that can break down complex tasks, execute them, and deliver results without constant human intervention.

## The Problem with Monolithic Agents

Most AI agent frameworks start with a seductive premise: give the LLM tools and let it figure out the rest. This works great in demos. In production, it fails in fascinating ways.

## The Unix Philosophy for AI

Unix solved this problem decades ago: do one thing well. PAI applies the same principle to AI workflows with small, focused actions that chain together predictably.

## Conclusion

The most capable AI agents won't be the ones with the most tools. They'll be the ones with the best composition primitives.`,
        minWords: 50,
      },
    },
    {
      agent: "BlogReviewer-2",
      pipeline: "blog-review",
      input: {
        content: `# Building AI Systems That Actually Work

After two years of building AI applications, here's what I've learned about production reliability.

## Start With Constraints

The best AI systems are the most constrained. Give your model specific tasks, clear boundaries, and explicit formats.

## Validate Everything

Every AI output should be validated before use. Don't trust—verify with structured outputs and schema validation.

## Conclusion

Production AI isn't about the smartest model. It's about the most reliable pipeline.`,
        minWords: 50,
      },
    },
    {
      agent: "ReportGenerator-1",
      pipeline: "content-report",
      input: {
        title: "Q1 2026 AI Infrastructure Review",
        sections: {
          summary: "PAI infrastructure matured significantly this quarter with new pipeline orchestration.",
          highlights: ["Pipeline monitor UI launched", "5 new actions created", "WebSocket real-time updates"],
          metrics: { pipelines_run: 47, success_rate: "94%", avg_duration: "1.2s" },
        },
      },
    },
    {
      agent: "ReportGenerator-2",
      pipeline: "content-report",
      input: {
        title: "Security Audit Summary",
        sections: {
          overview: "Comprehensive review of PAI security posture completed.",
          findings: ["No critical vulnerabilities", "Hook system validates all destructive commands", "Sandbox isolation working"],
          recommendations: ["Add rate limiting", "Improve secret detection"],
        },
      },
    },
    {
      agent: "QAEngineer",
      pipeline: "blog-qa",
      input: {
        title: "Testing the Pipeline System",
        body: `This post demonstrates the PAI pipeline QA system.

The blog-qa pipeline runs two steps: first format the content as markdown, then validate it for publication readiness.

## How It Works

The format step converts structured input into clean markdown with proper headings.

The validate step checks word count, link integrity, heading structure, and more.

## Results

If both steps pass, the content is ready for review.`,
        minWords: 30,
      },
    },
  ];

  // Add staggered start for visual effect
  const promises = jobs.map(async (job, i) => {
    await Bun.sleep(i * 300); // Stagger start
    return runPipeline(job.pipeline, job.input, job.agent);
  });

  const results = await Promise.all(promises);

  console.log("\n=== Demo Results ===");
  results.forEach((result, i) => {
    console.log(`${jobs[i].agent}: ${result.success ? "✓ Success" : "✗ Failed"}`);
  });
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "demo") {
    await runDemo();
    return;
  }

  if (command === "run" && args[1]) {
    const pipelineName = args[1];
    let input: Record<string, unknown> = {};
    let agent = "Agent-CLI";

    // Parse args
    for (let i = 2; i < args.length; i += 2) {
      if (args[i] === "--input") {
        input = JSON.parse(args[i + 1]);
      } else if (args[i] === "--agent") {
        agent = args[i + 1];
      } else if (args[i].startsWith("--")) {
        const key = args[i].slice(2);
        let value: unknown = args[i + 1];
        try { value = JSON.parse(value as string); } catch {}
        input[key] = value;
      }
    }

    const result = await runPipeline(pipelineName, input, agent);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`
PAI Pipeline Orchestrator

USAGE:
  bun PipelineOrchestrator.ts run <pipeline> [--input '<json>'] [--agent <name>]
  bun PipelineOrchestrator.ts demo

EXAMPLES:
  bun PipelineOrchestrator.ts run blog-draft --content "# My Post..."
  bun PipelineOrchestrator.ts run research --topic "AI agents" --depth 3
  bun PipelineOrchestrator.ts run youtube-knowledge --url "https://youtube.com/..." --domain security
  bun PipelineOrchestrator.ts demo
`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
