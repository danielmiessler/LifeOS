/**
 * String Match Grader
 * Fast deterministic check for exact or pattern matching
 */

import { BaseGrader, registerGrader, type GraderContext } from '../Base.ts';
import type { GraderConfig, GraderResult, StringMatchParams } from '../../Types/index.ts';

export class StringMatchGrader extends BaseGrader {
  type = 'string_match' as const;
  category = 'code_based' as const;

  async grade(context: GraderContext): Promise<GraderResult> {
    const start = performance.now();
    const params = this.config.params as StringMatchParams;

    if (!params?.patterns?.length) {
      return this.createResult(0, false, performance.now() - start, {
        reasoning: 'No patterns configured',
      });
    }

    const output = params.case_sensitive ? context.output : context.output.toLowerCase();
    const patterns = params.patterns.map(p =>
      params.case_sensitive ? p : p.toLowerCase()
    );

    const matches = patterns.map(pattern => output.includes(pattern));
    const matchCount = matches.filter(Boolean).length;

    let passed: boolean;
    let score: number;

    if (params.mode === 'all') {
      passed = matchCount === patterns.length;
      score = matchCount / patterns.length;
    } else {
      // 'any' mode
      passed = matchCount > 0;
      score = passed ? 1 : 0;
    }

    return this.createResult(score, passed, performance.now() - start, {
      reasoning: `Matched ${matchCount}/${patterns.length} patterns (mode: ${params.mode})`,
      details: {
        patterns,
        matches: patterns.map((p, i) => ({ pattern: p, matched: matches[i] })),
        mode: params.mode,
      },
    });
  }
}

registerGrader('string_match', StringMatchGrader);
