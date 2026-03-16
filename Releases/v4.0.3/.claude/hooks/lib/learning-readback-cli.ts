#!/usr/bin/env bun
/**
 * learning-readback-cli.ts — CLI wrapper for learning readback functions
 *
 * Used by the Algorithm during OBSERVE phase (Extended+ effort) to load
 * additional learning context beyond what SessionStart provides.
 *
 * Usage:
 *   bun run hooks/lib/learning-readback-cli.ts --depth standard
 *   bun run hooks/lib/learning-readback-cli.ts --depth extended
 *   bun run hooks/lib/learning-readback-cli.ts --failures 10
 *   bun run hooks/lib/learning-readback-cli.ts --synthesis
 */

import { parseArgs } from 'util';
import { getPaiDir } from './paths';
import { loadLearningDigest, loadFailurePatterns, loadSynthesisPatterns } from './learning-readback';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    depth: { type: 'string', default: 'standard' },
    failures: { type: 'string' },
    synthesis: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log('Usage: bun run learning-readback-cli.ts [--depth standard|extended] [--failures N] [--synthesis]');
  process.exit(0);
}

const paiDir = getPaiDir();

if (values.synthesis) {
  const synthesis = loadSynthesisPatterns(paiDir);
  if (synthesis) console.log(synthesis);
  else console.log('No synthesis data available. Run: bun run PAI/Tools/LearningPatternSynthesis.ts --week');
  process.exit(0);
}

const depth = values.depth || 'standard';
const failureCount = values.failures ? parseInt(values.failures, 10) : (depth === 'extended' ? 10 : 5);
const learningCount = depth === 'extended' ? 8 : 5;

const parts: string[] = [];

const failures = loadFailurePatterns(paiDir, failureCount);
if (failures) parts.push(failures);

const learnings = loadLearningDigest(paiDir, learningCount);
if (learnings) parts.push(learnings);

const synthesis = loadSynthesisPatterns(paiDir);
if (synthesis) parts.push(synthesis);

if (parts.length > 0) {
  console.log(parts.join('\n\n'));
} else {
  console.log('No learning data available.');
}
