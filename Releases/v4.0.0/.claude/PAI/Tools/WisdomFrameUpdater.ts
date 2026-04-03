#!/usr/bin/env bun
/**
 * WisdomFrameUpdater - Update Wisdom Frames with new observations
 *
 * Takes a domain and observation, then updates the appropriate frame file.
 * Handles: adding new observations, incrementing counts, updating confidence,
 * recording evolution log entries.
 *
 * Usage:
 *   bun WisdomFrameUpdater.ts --domain communication --observation "{PRINCIPAL.NAME} preferred bullet points over prose for status updates"
 *   bun WisdomFrameUpdater.ts --domain development --observation "Refactoring without permission caused pushback" --type anti-pattern
 *   bun WisdomFrameUpdater.ts --domain deployment --observation "Always verify Cloudflare deployment with screenshot" --type principle
 *   bun WisdomFrameUpdater.ts --from-session  # Extract observations from current session context
 *
 * Types: principle, contextual-rule, prediction, anti-pattern, evolution
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseArgs } from 'util';

const BASE_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const FRAMES_DIR = join(BASE_DIR, 'MEMORY', 'WISDOM', 'FRAMES');

// ── Types ──

type ObservationType = 'principle' | 'contextual-rule' | 'prediction' | 'anti-pattern' | 'evolution';

interface UpdateResult {
  success: boolean;
  domain: string;
  type: ObservationType;
  message: string;
  framePath: string;
}

// ── Frame Operations ──

function getFramePath(domain: string): string {
  return join(FRAMES_DIR, `${domain}.md`);
}

function getDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Parse the observation count from a frame's meta section
 */
function parseObservationCount(content: string): number {
  const match = content.match(/\*\*Observation Count:\*\*\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Increment the top-level observation count
 */
function incrementObservationCount(content: string): string {
  const current = parseObservationCount(content);
  return content.replace(
    /(\*\*Observation Count:\*\*\s*)\d+/,
    `$1${current + 1}`
  );
}

/**
 * Update the Last Crystallized date
 */
function updateCrystallizedDate(content: string): string {
  return content.replace(
    /(\*\*Last Crystallized:\*\*\s*)\S+/,
    `$1${getDateStr()}`
  );
}

/**
 * Append to the Evolution Log section
 */
function appendEvolution(content: string, entry: string): string {
  const logSection = '## Evolution Log';
  const logIndex = content.indexOf(logSection);

  if (logIndex === -1) {
    // Add evolution log section if missing
    return content + `\n\n## Evolution Log\n- ${getDateStr()}: ${entry}\n`;
  }

  // Find the end of evolution log (last line before EOF or next ##)
  const afterLog = content.slice(logIndex + logSection.length);
  const nextSection = afterLog.indexOf('\n## ');
  const insertPoint = nextSection === -1
    ? content.length
    : logIndex + logSection.length + nextSection;

  return (
    content.slice(0, insertPoint) +
    `\n- ${getDateStr()}: ${entry}` +
    content.slice(insertPoint)
  );
}

/**
 * Add a new anti-pattern to the Anti-Patterns section
 */
function addAntiPattern(content: string, observation: string): string {
  const section = '## Anti-Patterns';
  const sectionIndex = content.indexOf(section);

  if (sectionIndex === -1) {
    // Add section before Cross-Frame Connections or at end
    const crossFrame = content.indexOf('## Cross-Frame');
    const evolutionLog = content.indexOf('## Evolution Log');
    const insertBefore = crossFrame !== -1 ? crossFrame : evolutionLog !== -1 ? evolutionLog : content.length;

    const newSection = `## Anti-Patterns (from observations)\n\n### ${observation}\n- **Severity:** Medium\n- **Frequency:** Observed\n- **Root Cause:** To be determined\n- **Counter:** To be determined from further observations\n\n---\n\n`;
    return content.slice(0, insertBefore) + newSection + content.slice(insertBefore);
  }

  // Find the end of anti-patterns section
  const afterSection = content.slice(sectionIndex + section.length);
  const nextSection = afterSection.indexOf('\n## ');
  const insertPoint = nextSection === -1
    ? content.length
    : sectionIndex + section.length + nextSection;

  const newEntry = `\n\n### ${observation}\n- **Severity:** Medium\n- **Frequency:** Observed\n- **Root Cause:** To be determined\n- **Counter:** To be determined from further observations`;

  return content.slice(0, insertPoint) + newEntry + content.slice(insertPoint);
}

/**
 * Add a contextual rule
 */
function addContextualRule(content: string, observation: string): string {
  const section = '## Contextual Rules';
  const sectionIndex = content.indexOf(section);

  if (sectionIndex === -1) {
    const predictive = content.indexOf('## Predictive');
    const insertBefore = predictive !== -1 ? predictive : content.length;
    return content.slice(0, insertBefore) + `## Contextual Rules\n\n- ${observation} (learned ${getDateStr()})\n\n` + content.slice(insertBefore);
  }

  // Add at end of contextual rules section
  const afterSection = content.slice(sectionIndex + section.length);
  const nextSection = afterSection.indexOf('\n## ');
  const insertPoint = nextSection === -1
    ? content.length
    : sectionIndex + section.length + nextSection;

  return content.slice(0, insertPoint) + `\n- ${observation} (learned ${getDateStr()})` + content.slice(insertPoint);
}

/**
 * Add a prediction to the Predictive Model table
 */
function addPrediction(content: string, observation: string): string {
  const section = '## Predictive Model';
  const sectionIndex = content.indexOf(section);

  if (sectionIndex === -1) {
    const antiPatterns = content.indexOf('## Anti-Patterns');
    const insertBefore = antiPatterns !== -1 ? antiPatterns : content.length;
    return content.slice(0, insertBefore) + `## Predictive Model\n\n| Request Pattern | Predicted Want | Confidence |\n|----------------|---------------|------------|\n| ${observation} | To be refined | 60% |\n\n` + content.slice(insertBefore);
  }

  // Add row to end of table
  const afterSection = content.slice(sectionIndex + section.length);
  const tableEnd = afterSection.lastIndexOf('|');
  if (tableEnd === -1) return content;

  const insertPoint = sectionIndex + section.length + tableEnd;
  // Find end of that line
  const lineEnd = content.indexOf('\n', insertPoint);
  return content.slice(0, lineEnd) + `\n| ${observation} | To be refined | 60% |` + content.slice(lineEnd);
}

// ── Core Update Function ──

export function updateFrame(
  domain: string,
  observation: string,
  type: ObservationType = 'evolution'
): UpdateResult {
  const framePath = getFramePath(domain);

  // Create frame if it doesn't exist
  if (!existsSync(framePath)) {
    if (!existsSync(FRAMES_DIR)) {
      mkdirSync(FRAMES_DIR, { recursive: true });
    }

    const newFrame = `# Frame: ${domain.charAt(0).toUpperCase() + domain.slice(1)} Domain

## Meta
- **Domain:** ${domain}
- **Confidence:** 50%
- **Observation Count:** 1
- **Last Crystallized:** ${getDateStr()}
- **Source:** Auto-created from observation

---

## Core Principles

*No crystallized principles yet. Observations accumulating.*

---

## Contextual Rules

${type === 'contextual-rule' ? `- ${observation} (learned ${getDateStr()})` : '*None yet.*'}

---

## Predictive Model

| Request Pattern | Predicted Want | Confidence |
|----------------|---------------|------------|
${type === 'prediction' ? `| ${observation} | To be refined | 60% |` : ''}

---

## Anti-Patterns (from observations)

${type === 'anti-pattern' ? `### ${observation}\n- **Severity:** Medium\n- **Frequency:** Observed\n- **Root Cause:** To be determined\n- **Counter:** To be determined` : '*None yet.*'}

---

## Cross-Frame Connections

*To be discovered through cross-frame synthesis.*

---

## Evolution Log
- ${getDateStr()}: Frame created with initial observation: ${observation}
`;

    writeFileSync(framePath, newFrame);
    return {
      success: true,
      domain,
      type,
      message: `Created new frame for domain "${domain}" with initial observation`,
      framePath,
    };
  }

  // Update existing frame
  let content = readFileSync(framePath, 'utf-8');

  // Always increment observation count and update crystallized date
  content = incrementObservationCount(content);
  content = updateCrystallizedDate(content);

  // Apply type-specific update
  switch (type) {
    case 'anti-pattern':
      content = addAntiPattern(content, observation);
      content = appendEvolution(content, `New anti-pattern observed: ${observation}`);
      break;
    case 'contextual-rule':
      content = addContextualRule(content, observation);
      content = appendEvolution(content, `New contextual rule: ${observation}`);
      break;
    case 'prediction':
      content = addPrediction(content, observation);
      content = appendEvolution(content, `New prediction added: ${observation}`);
      break;
    case 'principle':
      // Principles are high-confidence — just log for manual crystallization
      content = appendEvolution(content, `Principle candidate observed: ${observation}`);
      break;
    case 'evolution':
    default:
      content = appendEvolution(content, observation);
      break;
  }

  writeFileSync(framePath, content);

  return {
    success: true,
    domain,
    type,
    message: `Updated "${domain}" frame with ${type}: ${observation}`,
    framePath,
  };
}

// ── CLI ──

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      domain: { type: 'string', short: 'd' },
      observation: { type: 'string', short: 'o' },
      type: { type: 'string', short: 't' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`
WisdomFrameUpdater - Update Wisdom Frames with new observations

Usage:
  bun WisdomFrameUpdater.ts --domain communication --observation "text" [--type principle|contextual-rule|prediction|anti-pattern|evolution]

Types:
  principle        High-confidence pattern (logs for manual crystallization)
  contextual-rule  Context-specific behavioral rule
  prediction       Request→response prediction
  anti-pattern     Something to avoid
  evolution        General observation (default)
`);
    process.exit(0);
  }

  if (!values.domain || !values.observation) {
    console.error('Required: --domain and --observation');
    process.exit(1);
  }

  const type = (values.type || 'evolution') as ObservationType;
  const result = updateFrame(values.domain, values.observation, type);
  console.log(JSON.stringify(result, null, 2));
}
