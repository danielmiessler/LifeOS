#!/usr/bin/env bun
/**
 * WisdomCrossFrameSynthesizer - Extract shared principles across Wisdom Frames
 *
 * Scans all frames for repeated principles, anti-patterns, and predictions
 * that appear across 2+ domains. Writes verified cross-domain principles
 * to WISDOM/PRINCIPLES/verified.md.
 *
 * Usage:
 *   bun WisdomCrossFrameSynthesizer.ts              # Run synthesis
 *   bun WisdomCrossFrameSynthesizer.ts --dry-run     # Preview without writing
 *   bun WisdomCrossFrameSynthesizer.ts --health       # Show frame health metrics
 *
 * Designed to be run periodically (weekly) or after significant frame updates.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { parseArgs } from 'util';
import { getPaiDir } from '../../hooks/lib/paths';

const BASE_DIR = getPaiDir();
const WISDOM_DIR = join(BASE_DIR, 'MEMORY', 'WISDOM');
const FRAMES_DIR = join(WISDOM_DIR, 'FRAMES');
const PRINCIPLES_DIR = join(WISDOM_DIR, 'PRINCIPLES');
const META_DIR = join(WISDOM_DIR, 'META');

// ── Types ──

interface FrameData {
  domain: string;
  path: string;
  confidence: number;
  observationCount: number;
  lastCrystallized: string;
  principles: string[];
  antiPatterns: string[];
  crossConnections: string[];
}

interface CrossPrinciple {
  principle: string;
  domains: string[];
  confidence: number;
  evidence: string;
}

interface FrameHealth {
  domain: string;
  confidence: number;
  observationCount: number;
  lastCrystallized: string;
  principleCount: number;
  antiPatternCount: number;
  crossConnectionCount: number;
  health: 'growing' | 'stable' | 'stale';
}

// ── Frame Parsing ──

function parseFrame(filepath: string): FrameData {
  const content = readFileSync(filepath, 'utf-8');
  const domain = basename(filepath, '.md');

  // Parse meta
  const confMatch = content.match(/\*\*Confidence:\*\*\s*(\d+)%/);
  const obsMatch = content.match(/\*\*Observation Count:\*\*\s*(\d+)/);
  const crystMatch = content.match(/\*\*Last Crystallized:\*\*\s*(\S+)/);

  // Extract principle titles (### headings under Core Principles with [CRYSTAL])
  const principles: string[] = [];
  const principleRegex = /### (.+?) \[CRYSTAL/g;
  let match;
  while ((match = principleRegex.exec(content)) !== null) {
    principles.push(match[1].trim());
  }

  // Extract anti-pattern titles
  const antiPatterns: string[] = [];
  const antiSection = content.indexOf('## Anti-Patterns');
  if (antiSection !== -1) {
    const afterAnti = content.slice(antiSection);
    const nextSection = afterAnti.indexOf('\n## ', 1);
    const antiContent = nextSection !== -1 ? afterAnti.slice(0, nextSection) : afterAnti;
    const antiRegex = /### (.+)/g;
    while ((match = antiRegex.exec(antiContent)) !== null) {
      antiPatterns.push(match[1].trim());
    }
  }

  // Extract cross-frame connections
  const crossConnections: string[] = [];
  const crossSection = content.indexOf('## Cross-Frame Connections');
  if (crossSection !== -1) {
    const afterCross = content.slice(crossSection);
    const nextSection = afterCross.indexOf('\n## ', 1);
    const crossContent = nextSection !== -1 ? afterCross.slice(0, nextSection) : afterCross;
    const connRegex = /\*\*(.+?)\*\*/g;
    while ((match = connRegex.exec(crossContent)) !== null) {
      crossConnections.push(match[1].trim());
    }
  }

  return {
    domain,
    path: filepath,
    confidence: confMatch ? parseInt(confMatch[1], 10) : 50,
    observationCount: obsMatch ? parseInt(obsMatch[1], 10) : 0,
    lastCrystallized: crystMatch?.[1] || 'unknown',
    principles,
    antiPatterns,
    crossConnections,
  };
}

// ── Cross-Frame Analysis ──

/**
 * Find principles that appear semantically similar across 2+ frames.
 * Uses simple keyword overlap for now — can be enhanced with embedding similarity.
 */
function findCrossPrinciples(frames: FrameData[]): CrossPrinciple[] {
  const crossPrinciples: CrossPrinciple[] = [];
  const seen = new Set<string>();

  // Compare each frame's principles against every other frame
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const frameA = frames[i];
      const frameB = frames[j];

      for (const principleA of frameA.principles) {
        for (const principleB of frameB.principles) {
          const similarity = computeSimilarity(principleA, principleB);
          const key = [principleA, principleB].sort().join('||');

          if (similarity > 0.3 && !seen.has(key)) {
            seen.add(key);
            crossPrinciples.push({
              principle: `${principleA} / ${principleB}`,
              domains: [frameA.domain, frameB.domain],
              confidence: Math.min(frameA.confidence, frameB.confidence),
              evidence: `Shared principle across ${frameA.domain} and ${frameB.domain}`,
            });
          }
        }
      }
    }
  }

  // Also check explicit cross-frame connections
  for (const frame of frames) {
    for (const conn of frame.crossConnections) {
      const targetDomain = conn.replace('.md', '').replace(':', '');
      const existing = crossPrinciples.find(cp =>
        cp.domains.includes(frame.domain) && cp.domains.includes(targetDomain)
      );
      if (!existing) {
        crossPrinciples.push({
          principle: `Explicit connection: ${frame.domain} ↔ ${targetDomain}`,
          domains: [frame.domain, targetDomain],
          confidence: frame.confidence,
          evidence: `Declared in ${frame.domain} frame cross-connections`,
        });
      }
    }
  }

  return crossPrinciples.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Simple word-overlap similarity (Jaccard index on significant words)
 */
function computeSimilarity(a: string, b: string): number {
  const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
    'may', 'might', 'must', 'can', 'could', 'of', 'in', 'to', 'for', 'with', 'on', 'at',
    'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'over', 'and', 'but', 'or', 'not', 'no', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very']);

  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stopwords.has(w)));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stopwords.has(w)));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;

  return intersection / union;
}

// ── Frame Health Assessment ──

function assessHealth(frame: FrameData): FrameHealth {
  const daysSinceCrystallized = frame.lastCrystallized !== 'unknown'
    ? Math.floor((Date.now() - new Date(frame.lastCrystallized).getTime()) / 86400000)
    : 999;

  let health: 'growing' | 'stable' | 'stale';
  if (daysSinceCrystallized <= 7 && frame.observationCount > 10) {
    health = 'growing';
  } else if (daysSinceCrystallized <= 30) {
    health = 'stable';
  } else {
    health = 'stale';
  }

  return {
    domain: frame.domain,
    confidence: frame.confidence,
    observationCount: frame.observationCount,
    lastCrystallized: frame.lastCrystallized,
    principleCount: frame.principles.length,
    antiPatternCount: frame.antiPatterns.length,
    crossConnectionCount: frame.crossConnections.length,
    health,
  };
}

// ── Output Generation ──

function generatePrinciplesReport(crossPrinciples: CrossPrinciple[], frames: FrameData[]): string {
  const date = new Date().toISOString().split('T')[0];

  return `# Verified Cross-Domain Principles

**Generated:** ${date}
**Frames Analyzed:** ${frames.length}
**Cross-Domain Principles Found:** ${crossPrinciples.length}

---

## Principles Confirmed Across Multiple Domains

${crossPrinciples.length === 0
    ? '*No cross-domain principles found yet. Frames need more observations.*'
    : crossPrinciples.map((cp, i) => `### ${i + 1}. ${cp.principle}

- **Domains:** ${cp.domains.join(', ')}
- **Confidence:** ${cp.confidence}%
- **Evidence:** ${cp.evidence}
`).join('\n')}

---

## Frame Coverage

| Domain | Confidence | Observations | Principles | Anti-Patterns |
|--------|-----------|-------------|------------|---------------|
${frames.map(f => `| ${f.domain} | ${f.confidence}% | ${f.observationCount}+ | ${f.principles.length} | ${f.antiPatterns.length} |`).join('\n')}

---

*Generated by WisdomCrossFrameSynthesizer*
`;
}

function generateHealthReport(healthData: FrameHealth[]): string {
  const date = new Date().toISOString().split('T')[0];

  return `# Wisdom Frame Health Report

**Generated:** ${date}
**Total Frames:** ${healthData.length}

## Frame Status

| Domain | Health | Confidence | Observations | Last Updated | Principles | Anti-Patterns |
|--------|--------|-----------|-------------|-------------|------------|---------------|
${healthData.map(h => {
    const icon = h.health === 'growing' ? '🟢' : h.health === 'stable' ? '🟡' : '🔴';
    return `| ${h.domain} | ${icon} ${h.health} | ${h.confidence}% | ${h.observationCount}+ | ${h.lastCrystallized} | ${h.principleCount} | ${h.antiPatternCount} |`;
  }).join('\n')}

## Recommendations

${healthData.filter(h => h.health === 'stale').map(h => `- **${h.domain}:** Stale — needs new observations or review`).join('\n') || '- All frames are active'}
${healthData.filter(h => h.principleCount === 0).map(h => `- **${h.domain}:** No crystallized principles yet — needs more observations`).join('\n') || ''}
${healthData.filter(h => h.antiPatternCount === 0).map(h => `- **${h.domain}:** No anti-patterns captured — review recent failures`).join('\n') || ''}

---

*Generated by WisdomCrossFrameSynthesizer*
`;
}

// ── Main ──

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean' },
      health: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`
WisdomCrossFrameSynthesizer - Extract shared principles across Wisdom Frames

Usage:
  bun WisdomCrossFrameSynthesizer.ts              Run synthesis
  bun WisdomCrossFrameSynthesizer.ts --dry-run     Preview without writing
  bun WisdomCrossFrameSynthesizer.ts --health       Show frame health metrics

Output: WISDOM/PRINCIPLES/verified.md and WISDOM/META/frame-health.md
`);
    process.exit(0);
  }

  // Load all frames
  if (!existsSync(FRAMES_DIR)) {
    console.log('No frames directory found');
    process.exit(0);
  }

  const frameFiles = readdirSync(FRAMES_DIR).filter(f => f.endsWith('.md'));
  if (frameFiles.length === 0) {
    console.log('No frames found');
    process.exit(0);
  }

  console.log(`📊 Loading ${frameFiles.length} frames...`);
  const frames = frameFiles.map(f => parseFrame(join(FRAMES_DIR, f)));

  if (values.health) {
    const healthData = frames.map(assessHealth);
    const report = generateHealthReport(healthData);

    if (values['dry-run']) {
      console.log(report);
    } else {
      if (!existsSync(META_DIR)) mkdirSync(META_DIR, { recursive: true });
      writeFileSync(join(META_DIR, 'frame-health.md'), report);
      console.log(`✅ Health report written to WISDOM/META/frame-health.md`);
    }
    process.exit(0);
  }

  // Run cross-frame synthesis
  console.log('🔍 Analyzing cross-frame principles...');
  const crossPrinciples = findCrossPrinciples(frames);
  console.log(`   Found ${crossPrinciples.length} cross-domain principles`);

  const report = generatePrinciplesReport(crossPrinciples, frames);

  if (values['dry-run']) {
    console.log(report);
  } else {
    if (!existsSync(PRINCIPLES_DIR)) mkdirSync(PRINCIPLES_DIR, { recursive: true });
    writeFileSync(join(PRINCIPLES_DIR, 'verified.md'), report);
    console.log(`✅ Principles report written to WISDOM/PRINCIPLES/verified.md`);

    // Also generate health report
    const healthData = frames.map(assessHealth);
    const healthReport = generateHealthReport(healthData);
    if (!existsSync(META_DIR)) mkdirSync(META_DIR, { recursive: true });
    writeFileSync(join(META_DIR, 'frame-health.md'), healthReport);
    console.log(`✅ Health report written to WISDOM/META/frame-health.md`);
  }
}
