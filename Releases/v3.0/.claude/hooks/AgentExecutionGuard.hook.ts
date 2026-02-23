#!/usr/bin/env bun
import './lib/gate';
/**
 * AgentExecutionGuard.hook.ts - Enforce Background Agent Execution (PreToolUse)
 *
 * PURPOSE:
 * Structural enforcement for the Algorithm's background execution rule.
 * When the Task tool is called without run_in_background: true and the
 * timing context is not "fast", injects a warning system-reminder.
 *
 * This is the enforcement layer that v0.2.27-v0.2.30 lacked.
 * The CapabilityRecommender hook SUGGESTS background execution.
 * This hook ENFORCES it at the point of action.
 *
 * TRIGGER: PreToolUse (matcher: Task)
 *
 * INPUT:
 * - stdin: Hook input JSON with tool_input containing Task parameters
 *   - tool_input.run_in_background: boolean (should be true)
 *   - tool_input.subagent_type: string (agent type being spawned)
 *   - tool_input.description: string (task description)
 *   - tool_input.model: string (optional model override)
 *
 * OUTPUT:
 * - If foreground violation detected: system-reminder warning
 * - If background correctly set: silent pass (exit 0)
 *
 * DECISION LOGIC:
 * - run_in_background: true → PASS (correct usage)
 * - run_in_background: false/missing AND model is "haiku" → PASS (fast-tier inline)
 * - run_in_background: false/missing AND subagent_type is "Explore" → PASS (quick lookups)
 * - All other cases → WARNING (inject system-reminder)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - DEPENDS ON: CapabilityRecommender (timing classification context)
 * - COORDINATES WITH: StopOrchestrator (handles post-execution cleanup)
 * - MUST RUN BEFORE: Task tool execution
 *
 * PERFORMANCE:
 * - Non-blocking: Yes (warning only, never blocks)
 * - Typical execution: <10ms (pure JSON parsing, no I/O)
 */

interface HookInput {
  tool_name: string;
  tool_input: {
    run_in_background?: boolean;
    subagent_type?: string;
    description?: string;
    prompt?: string;
    model?: string;
    max_turns?: number;
  };
}

// Agent types that are typically fast/inline and don't need background
const FAST_AGENT_TYPES = ['Explore'];

// Models that indicate fast-tier execution
const FAST_MODELS = ['haiku'];

async function readStdin(timeout = 1000): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), timeout);
    process.stdin.on('data', chunk => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(''); });
  });
}

async function main() {
  try {
    const input = await readStdin();
    if (!input) {
      process.exit(0);
    }

    const data: HookInput = JSON.parse(input);
    const toolInput = data.tool_input || {};

    // Already using background — correct usage, pass silently
    if (toolInput.run_in_background === true) {
      process.exit(0);
    }

    // Fast-tier agents don't need background (quick lookups)
    const agentType = toolInput.subagent_type || '';
    if (FAST_AGENT_TYPES.includes(agentType)) {
      process.exit(0);
    }

    // Haiku model indicates fast-tier — inline is acceptable
    const model = toolInput.model || '';
    if (FAST_MODELS.includes(model)) {
      process.exit(0);
    }

    // Check if prompt contains ## Scope with FAST timing
    const prompt = toolInput.prompt || '';
    if (/##\s*Scope[\s\S]*?Timing:\s*FAST/i.test(prompt)) {
      process.exit(0);
    }

    // VIOLATION: Non-fast agent spawned without run_in_background: true
    const desc = toolInput.description || agentType || 'unknown';

    console.log(`<system-reminder>
WARNING: FOREGROUND AGENT DETECTED — "${desc}" (${agentType})
run_in_background is NOT set to true. This will BLOCK the user interface.

FIX: Add run_in_background: true to this Task call.

The Algorithm (v0.2.31) requires ALL non-fast agents to run in background:
- Spawn with run_in_background: true
- Report immediately: "Spawned [type] in background..."
- Poll with TaskOutput(block=false) every 15-30s
- Collect results when done

Only exceptions: Explore agents, haiku-model agents, and agents with ## Scope FAST.
</system-reminder>`);

    process.exit(0);
  } catch (err) {
    // On any error, pass silently — don't block agent execution
    process.exit(0);
  }
}

main();
