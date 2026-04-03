/**
 * Tool Call Verification Grader
 * Verify that specific tools were called with expected parameters
 */

import { BaseGrader, registerGrader, type GraderContext } from '../Base.ts';
import type { GraderConfig, GraderResult, ToolCallsParams } from '../../Types/index.ts';

export class ToolCallVerificationGrader extends BaseGrader {
  type = 'tool_calls' as const;
  category = 'code_based' as const;

  async grade(context: GraderContext): Promise<GraderResult> {
    const start = performance.now();
    const params = this.config.params as ToolCallsParams;
    const toolCalls = context.transcript.tool_calls;

    const checks: { check: string; passed: boolean; details?: string }[] = [];

    // Check required tool calls
    if (params.required) {
      for (const req of params.required) {
        const matchingCall = toolCalls.find(tc => {
          if (tc.name !== req.tool) return false;

          // If params specified, check they match
          if (req.params) {
            for (const [key, expected] of Object.entries(req.params)) {
              const actual = tc.params[key];

              // Support glob patterns for paths
              if (typeof expected === 'string' && expected.includes('*')) {
                const pattern = new RegExp('^' + expected.replace(/\*/g, '.*') + '$');
                if (!pattern.test(String(actual))) return false;
              } else if (actual !== expected) {
                return false;
              }
            }
          }

          return true;
        });

        checks.push({
          check: `required.${req.tool}`,
          passed: !!matchingCall,
          details: matchingCall
            ? `Found: ${JSON.stringify(matchingCall.params).slice(0, 100)}`
            : `Not found in ${toolCalls.length} tool calls`,
        });
      }
    }

    // Check forbidden tool calls
    if (params.forbidden) {
      for (const forbidden of params.forbidden) {
        const found = toolCalls.some(tc => tc.name === forbidden);
        checks.push({
          check: `forbidden.${forbidden}`,
          passed: !found,
          details: found ? 'Found (should not exist)' : 'Not found (correct)',
        });
      }
    }

    // Check sequence (tools must be called in order)
    if (params.sequence) {
      const toolOrder = toolCalls.map(tc => tc.name);
      let seqIndex = 0;

      for (const tool of toolOrder) {
        if (seqIndex < params.sequence.length && tool === params.sequence[seqIndex]) {
          seqIndex++;
        }
      }

      const sequenceComplete = seqIndex === params.sequence.length;
      checks.push({
        check: 'sequence',
        passed: sequenceComplete,
        details: sequenceComplete
          ? `Sequence complete: ${params.sequence.join(' → ')}`
          : `Incomplete: found ${seqIndex}/${params.sequence.length} in order`,
      });
    }

    // Check max calls
    if (params.max_calls !== undefined) {
      const withinLimit = toolCalls.length <= params.max_calls;
      checks.push({
        check: 'max_calls',
        passed: withinLimit,
        details: `${toolCalls.length} calls (max: ${params.max_calls})`,
      });
    }

    const passCount = checks.filter(c => c.passed).length;
    const score = checks.length > 0 ? passCount / checks.length : 1;
    const passed = passCount === checks.length;

    return this.createResult(score, passed, performance.now() - start, {
      reasoning: `${passCount}/${checks.length} tool call checks passed`,
      details: {
        checks,
        total_tool_calls: toolCalls.length,
        tool_call_summary: toolCalls.map(tc => tc.name),
      },
    });
  }
}

registerGrader('tool_calls', ToolCallVerificationGrader);
