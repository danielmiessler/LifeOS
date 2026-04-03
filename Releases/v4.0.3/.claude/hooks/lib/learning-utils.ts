/**
 * Shared Learning Utilities
 *
 * Categorization logic for learnings across the hook system.
 * Used by: RatingCapture, WorkCompletionLearning
 */

/**
 * Categorize learning as SYSTEM (tooling/infrastructure) or ALGORITHM (task execution)
 *
 * SYSTEM = hook failures, tooling issues, infrastructure problems, system errors
 * ALGORITHM = task execution issues, approach errors, method improvements
 *
 * Check ALGORITHM first because user feedback about task execution is more valuable.
 * Default to ALGORITHM since most learnings are about task quality, not infrastructure.
 *
 * @param content - The main content to analyze
 * @param comment - Optional user comment to include in analysis
 */
export function getLearningCategory(content: string, comment?: string): 'SYSTEM' | 'ALGORITHM' {
  const text = `${content} ${comment || ''}`.toLowerCase();

  // ALGORITHM indicators - task execution/approach issues (check first)
  const algorithmIndicators = [
    /over.?engineer/,
    /wrong approach/,
    /should have asked/,
    /didn't follow/,
    /missed the point/,
    /too complex/,
    /didn't understand/,
    /wrong direction/,
    /not what i wanted/,
    /approach|method|strategy|reasoning/
  ];

  // SYSTEM indicators - tooling/infrastructure issues
  const systemIndicators = [
    /hook|crash|broken/,
    /tool|config|deploy|path/,
    /import|module|file.*not.*found/,
    /typescript|javascript|npm|bun/
  ];

  // Check ALGORITHM first (user feedback about approach is valuable)
  for (const pattern of algorithmIndicators) {
    if (pattern.test(text)) return 'ALGORITHM';
  }

  for (const pattern of systemIndicators) {
    if (pattern.test(text)) return 'SYSTEM';
  }

  // Default: learnings reflect task quality → ALGORITHM
  return 'ALGORITHM';
}

/**
 * Determine if a response represents a learning moment
 */
export function isLearningCapture(text: string, summary?: string, analysis?: string): boolean {
  const learningIndicators = [
    /problem|issue|bug|error|failed|broken/i,
    /fixed|solved|resolved|discovered|realized|learned/i,
    /troubleshoot|debug|investigate|root cause/i,
    /lesson|takeaway|now we know|next time/i,
  ];

  const checkText = `${summary || ''} ${analysis || ''} ${text}`;

  let indicatorCount = 0;
  for (const pattern of learningIndicators) {
    if (pattern.test(checkText)) {
      indicatorCount++;
    }
  }

  // If 2+ learning indicators, consider it a learning
  return indicatorCount >= 2;
}
