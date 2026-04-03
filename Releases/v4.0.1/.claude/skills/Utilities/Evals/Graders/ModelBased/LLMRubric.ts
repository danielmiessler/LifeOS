/**
 * LLM Rubric Grader
 * Score output against a detailed rubric using an LLM judge
 */

import { BaseGrader, registerGrader, type GraderContext } from '../Base.ts';
import type { GraderConfig, GraderResult, LLMRubricParams } from '../../Types/index.ts';
import { inference, type InferenceLevel } from '../../../PAI/Tools/Inference';
import { readFileSync, existsSync } from 'fs';

export class LLMRubricGrader extends BaseGrader {
  type = 'llm_rubric' as const;
  category = 'model_based' as const;

  async grade(context: GraderContext): Promise<GraderResult> {
    const start = performance.now();
    const params = this.config.params as LLMRubricParams;

    // Load rubric
    let rubric = params.rubric;
    if (existsSync(params.rubric)) {
      rubric = readFileSync(params.rubric, 'utf-8');
    }

    const scale = params.scale ?? '1-5';
    // Map model preference to inference level (default to standard/Sonnet)
    const levelMap: Record<string, InferenceLevel> = {
      'claude-haiku-4-5-20251001': 'fast',
      'claude-sonnet-4-20250514': 'standard',
      'claude-opus-4-20250514': 'smart',
    };
    const level: InferenceLevel = levelMap[params.judge_model ?? ''] ?? 'standard';

    // Build prompt
    const systemPrompt = this.buildSystemPrompt(scale, params.reasoning_first ?? true);
    const userPrompt = this.buildUserPrompt(rubric, params.assertions, context);

    try {
      const result = await inference({
        systemPrompt,
        userPrompt,
        level,
        timeout: 30000,
      });

      if (!result.success) {
        throw new Error(result.error || 'Inference failed');
      }

      const text = result.output;
      const { score, reasoning, assertion_results } = this.parseResponse(text, scale, params.assertions);

      const passed = this.scoreToPassed(score, scale);

      return this.createResult(score, passed, performance.now() - start, {
        reasoning,
        details: {
          assertion_results,
          inference_level: level,
          scale,
          raw_response: text,
        },
      });
    } catch (e) {
      return this.createResult(0, false, performance.now() - start, {
        reasoning: `LLM judge error: ${e}`,
      });
    }
  }

  private buildSystemPrompt(scale: string, reasoningFirst: boolean): string {
    const scaleInstructions = {
      '1-5': 'Score from 1 (very poor) to 5 (excellent)',
      '1-10': 'Score from 1 (very poor) to 10 (excellent)',
      'pass-fail': 'Determine if the output PASSES or FAILS the criteria',
    }[scale];

    const format = reasoningFirst
      ? `First explain your reasoning, then provide your score. Format:
REASONING: <your detailed analysis>
SCORE: <your score>`
      : `Provide your score first, then explain. Format:
SCORE: <your score>
REASONING: <your explanation>`;

    return `You are an expert evaluator assessing AI-generated output against quality criteria.

${scaleInstructions}

${format}

Be objective and fair. Consider both strengths and weaknesses.`;
  }

  private buildUserPrompt(
    rubric: string,
    assertions: string[] | undefined,
    context: GraderContext
  ): string {
    let prompt = `## Evaluation Rubric

${rubric}

## Output to Evaluate

${context.output}
`;

    if (assertions?.length) {
      prompt += `
## Specific Assertions to Check

For each assertion, determine if it is TRUE or FALSE:

${assertions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

After the main evaluation, provide assertion results in this format:
ASSERTIONS:
${assertions.map((_, i) => `${i + 1}. TRUE/FALSE`).join('\n')}
`;
    }

    if (context.reference) {
      prompt += `
## Reference Output (for comparison)

${context.reference}
`;
    }

    prompt += `
## Your Evaluation

Evaluate the output against the rubric and provide your assessment.`;

    return prompt;
  }

  private parseResponse(
    text: string,
    scale: string,
    assertions?: string[]
  ): { score: number; reasoning: string; assertion_results?: boolean[] } {
    // Extract score
    let score = 0;
    const scoreMatch = text.match(/SCORE:\s*(\d+(?:\.\d+)?|PASS|FAIL)/i);

    if (scoreMatch) {
      if (scale === 'pass-fail') {
        score = scoreMatch[1].toUpperCase() === 'PASS' ? 1 : 0;
      } else if (scale === '1-5') {
        score = (parseFloat(scoreMatch[1]) - 1) / 4;  // Normalize to 0-1
      } else if (scale === '1-10') {
        score = (parseFloat(scoreMatch[1]) - 1) / 9;  // Normalize to 0-1
      }
    }

    // Extract reasoning
    const reasoningMatch = text.match(/REASONING:\s*([\s\S]*?)(?=SCORE:|ASSERTIONS:|$)/i);
    const reasoning = reasoningMatch?.[1]?.trim() ?? text;

    // Extract assertion results
    let assertion_results: boolean[] | undefined;
    if (assertions?.length) {
      const assertionsMatch = text.match(/ASSERTIONS:\s*([\s\S]*?)$/i);
      if (assertionsMatch) {
        assertion_results = assertions.map((_, i) => {
          const lineMatch = assertionsMatch[1].match(new RegExp(`${i + 1}\\.\\s*(TRUE|FALSE)`, 'i'));
          return lineMatch?.[1]?.toUpperCase() === 'TRUE';
        });
      }
    }

    return { score: Math.max(0, Math.min(1, score)), reasoning, assertion_results };
  }

  private scoreToPassed(score: number, scale: string): boolean {
    if (scale === 'pass-fail') return score >= 0.5;
    // For 1-5 and 1-10, pass if score is above middle
    return score >= 0.5;
  }
}

registerGrader('llm_rubric', LLMRubricGrader);
