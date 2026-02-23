/**
 * Binary Tests Grader
 * Run actual test files and check pass/fail
 */

import { BaseGrader, registerGrader, type GraderContext } from '../Base.ts';
import type { GraderConfig, GraderResult, BinaryTestsParams } from '../../Types/index.ts';
import { $ } from 'bun';

export class BinaryTestsGrader extends BaseGrader {
  type = 'binary_tests' as const;
  category = 'code_based' as const;

  async grade(context: GraderContext): Promise<GraderResult> {
    const start = performance.now();
    const params = this.config.params as BinaryTestsParams;

    if (!params?.test_files?.length) {
      return this.createResult(0, false, performance.now() - start, {
        reasoning: 'No test files configured',
      });
    }

    const workingDir = context.working_dir ?? process.cwd();
    const timeout = params.timeout_ms ?? 60000;
    const results: { file: string; passed: boolean; output: string; error?: string }[] = [];

    for (const testFile of params.test_files) {
      try {
        // Detect test command based on file extension
        const command = params.test_command ?? this.detectTestCommand(testFile);

        const result = await $`cd ${workingDir} && timeout ${Math.ceil(timeout/1000)} ${command} ${testFile}`
          .quiet()
          .nothrow();

        const passed = result.exitCode === 0;
        results.push({
          file: testFile,
          passed,
          output: result.stdout.toString().slice(-500),  // Last 500 chars
          error: passed ? undefined : result.stderr.toString().slice(-500),
        });
      } catch (e) {
        results.push({
          file: testFile,
          passed: false,
          output: '',
          error: String(e),
        });
      }
    }

    const passCount = results.filter(r => r.passed).length;
    const score = passCount / params.test_files.length;
    const passed = passCount === params.test_files.length;

    return this.createResult(score, passed, performance.now() - start, {
      reasoning: `${passCount}/${params.test_files.length} tests passed`,
      details: {
        results,
        working_dir: workingDir,
      },
    });
  }

  private detectTestCommand(file: string): string {
    if (file.endsWith('.py')) return 'python -m pytest';
    if (file.endsWith('.ts')) return 'bun test';
    if (file.endsWith('.js')) return 'node --test';
    if (file.endsWith('.go')) return 'go test';
    if (file.endsWith('.rs')) return 'cargo test --';
    return 'bun test';  // Default
  }
}

registerGrader('binary_tests', BinaryTestsGrader);
