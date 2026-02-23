/**
 * Regex Match Grader
 * Pattern matching with regular expressions
 */

import { BaseGrader, registerGrader, type GraderContext } from '../Base.ts';
import type { GraderConfig, GraderResult, RegexMatchParams } from '../../Types/index.ts';

export class RegexMatchGrader extends BaseGrader {
  type = 'regex_match' as const;
  category = 'code_based' as const;

  async grade(context: GraderContext): Promise<GraderResult> {
    const start = performance.now();
    const params = this.config.params as RegexMatchParams;

    if (!params?.patterns?.length) {
      return this.createResult(0, false, performance.now() - start, {
        reasoning: 'No patterns configured',
      });
    }

    const flags = params.flags ?? 'gm';
    const results = params.patterns.map(pattern => {
      try {
        const regex = new RegExp(pattern, flags);
        const matched = regex.test(context.output);
        return { pattern, matched, error: null };
      } catch (e) {
        return { pattern, matched: false, error: String(e) };
      }
    });

    const matchCount = results.filter(r => r.matched).length;
    const errorCount = results.filter(r => r.error).length;

    let passed: boolean;
    let score: number;

    if (params.mode === 'all') {
      passed = matchCount === params.patterns.length;
      score = matchCount / params.patterns.length;
    } else {
      passed = matchCount > 0;
      score = passed ? 1 : 0;
    }

    // Penalize for errors
    if (errorCount > 0) {
      score *= (params.patterns.length - errorCount) / params.patterns.length;
    }

    return this.createResult(score, passed, performance.now() - start, {
      reasoning: `Matched ${matchCount}/${params.patterns.length} patterns${errorCount > 0 ? ` (${errorCount} errors)` : ''} (mode: ${params.mode})`,
      details: {
        results,
        mode: params.mode,
        flags,
      },
    });
  }
}

registerGrader('regex_match', RegexMatchGrader);
