/**
 * Static Analysis Grader
 * Run linters, type checkers, security scanners
 */

import { BaseGrader, registerGrader, type GraderContext } from '../Base.ts';
import type { GraderConfig, GraderResult, StaticAnalysisParams } from '../../Types/index.ts';
import { $ } from 'bun';

export class StaticAnalysisGrader extends BaseGrader {
  type = 'static_analysis' as const;
  category = 'code_based' as const;

  async grade(context: GraderContext): Promise<GraderResult> {
    const start = performance.now();
    const params = this.config.params as StaticAnalysisParams;

    if (!params?.commands?.length) {
      return this.createResult(0, false, performance.now() - start, {
        reasoning: 'No analysis commands configured',
      });
    }

    const workingDir = context.working_dir ?? process.cwd();
    const results: { command: string; passed: boolean; output: string; warnings: number; errors: number }[] = [];

    for (const command of params.commands) {
      try {
        const result = await $`cd ${workingDir} && ${command}`.quiet().nothrow();

        const output = result.stdout.toString() + result.stderr.toString();
        const warnings = this.countIssues(output, 'warning');
        const errors = this.countIssues(output, 'error');

        // Pass if no errors (and no warnings if fail_on_warning is set)
        const passed = errors === 0 && (!params.fail_on_warning || warnings === 0);

        results.push({
          command,
          passed,
          output: output.slice(-1000),  // Last 1000 chars
          warnings,
          errors,
        });
      } catch (e) {
        results.push({
          command,
          passed: false,
          output: String(e),
          warnings: 0,
          errors: 1,
        });
      }
    }

    const passCount = results.filter(r => r.passed).length;
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0);

    const score = passCount / params.commands.length;
    const passed = passCount === params.commands.length;

    return this.createResult(score, passed, performance.now() - start, {
      reasoning: `${passCount}/${params.commands.length} checks passed (${totalErrors} errors, ${totalWarnings} warnings)`,
      details: {
        results,
        total_errors: totalErrors,
        total_warnings: totalWarnings,
        fail_on_warning: params.fail_on_warning ?? false,
      },
    });
  }

  private countIssues(output: string, type: 'warning' | 'error'): number {
    const patterns = type === 'error'
      ? [/error:/gi, /\berror\b/gi, /failed/gi, /\[E\d+\]/g]
      : [/warning:/gi, /\bwarn\b/gi, /\[W\d+\]/g];

    let count = 0;
    for (const pattern of patterns) {
      const matches = output.match(pattern);
      count += matches?.length ?? 0;
    }
    return Math.min(count, 100);  // Cap at 100
  }
}

registerGrader('static_analysis', StaticAnalysisGrader);
