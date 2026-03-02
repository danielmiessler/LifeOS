/**
 * State Check Grader
 * Verify system state after agent execution
 */

import { BaseGrader, registerGrader, type GraderContext } from '../Base.ts';
import type { GraderConfig, GraderResult, StateCheckParams } from '../../Types/index.ts';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export class StateCheckGrader extends BaseGrader {
  type = 'state_check' as const;
  category = 'code_based' as const;

  async grade(context: GraderContext): Promise<GraderResult> {
    const start = performance.now();
    const params = this.config.params as StateCheckParams;

    const checks: { check: string; passed: boolean; expected?: unknown; actual?: unknown }[] = [];
    const workingDir = context.working_dir ?? process.cwd();

    // Check expected state object (e.g., security_logs: {event_type: "auth_blocked"})
    if (params.expect) {
      for (const [key, expected] of Object.entries(params.expect)) {
        const checkResult = await this.checkState(key, expected, context);
        checks.push({
          check: `state.${key}`,
          passed: checkResult.passed,
          expected,
          actual: checkResult.actual,
        });
      }
    }

    // Check file contents
    if (params.check_files) {
      for (const fileCheck of params.check_files) {
        const filePath = join(workingDir, fileCheck.path);

        if (!existsSync(filePath)) {
          checks.push({
            check: `file.${fileCheck.path}`,
            passed: false,
            expected: 'file exists',
            actual: 'file not found',
          });
          continue;
        }

        const content = readFileSync(filePath, 'utf-8');

        // Check contains
        if (fileCheck.contains) {
          for (const pattern of fileCheck.contains) {
            const found = content.includes(pattern);
            checks.push({
              check: `file.${fileCheck.path}.contains`,
              passed: found,
              expected: pattern,
              actual: found ? 'found' : 'not found',
            });
          }
        }

        // Check not_contains
        if (fileCheck.not_contains) {
          for (const pattern of fileCheck.not_contains) {
            const found = content.includes(pattern);
            checks.push({
              check: `file.${fileCheck.path}.not_contains`,
              passed: !found,
              expected: `NOT: ${pattern}`,
              actual: found ? 'found (should not exist)' : 'not found (correct)',
            });
          }
        }
      }
    }

    // Check environment variables
    if (params.check_env) {
      for (const [key, expected] of Object.entries(params.check_env)) {
        const actual = process.env[key];
        checks.push({
          check: `env.${key}`,
          passed: actual === expected,
          expected,
          actual,
        });
      }
    }

    const passCount = checks.filter(c => c.passed).length;
    const score = checks.length > 0 ? passCount / checks.length : 1;
    const passed = passCount === checks.length;

    return this.createResult(score, passed, performance.now() - start, {
      reasoning: `${passCount}/${checks.length} state checks passed`,
      details: { checks },
    });
  }

  private async checkState(
    key: string,
    expected: unknown,
    context: GraderContext
  ): Promise<{ passed: boolean; actual?: unknown }> {
    // Check if expected state exists in the transcript's final outcome
    if (context.transcript.final_outcome) {
      const outcome = context.transcript.final_outcome as Record<string, unknown>;
      if (key in outcome) {
        const actual = outcome[key];
        const passed = this.deepEqual(actual, expected);
        return { passed, actual };
      }
    }

    // Also check in the output text for JSON-like patterns
    try {
      const jsonMatch = context.output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (key in parsed) {
          const actual = parsed[key];
          const passed = this.deepEqual(actual, expected);
          return { passed, actual };
        }
      }
    } catch {
      // Not valid JSON, continue
    }

    return { passed: false, actual: undefined };
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;

    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;

    // For expected, check if all expected keys match (subset matching)
    for (const key of Object.keys(bObj)) {
      if (!(key in aObj)) return false;
      if (!this.deepEqual(aObj[key], bObj[key])) return false;
    }

    return true;
  }
}

registerGrader('state_check', StateCheckGrader);
